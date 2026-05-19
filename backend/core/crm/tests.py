"""
CRM Builder backend test suite.
Covers: models, CRUD endpoints, permission enforcement, nested routes.
"""
import uuid
from django.test import TestCase
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from rest_framework import status

from .models import CRMSheet, CRMColumn, CRMRow, CRMAccess

User = get_user_model()


# ── Fixtures ──────────────────────────────────────────────────────────────────

def make_creator(**kw):
    defaults = dict(email=f"creator_{uuid.uuid4().hex[:6]}@test.com", full_name="Creator", role="creator")
    defaults.update(kw)
    return User.objects.create_user(password="pass1234", **defaults)

def make_talent(**kw):
    defaults = dict(email=f"talent_{uuid.uuid4().hex[:6]}@test.com", full_name="Talent", role="talent")
    defaults.update(kw)
    return User.objects.create_user(password="pass1234", **defaults)

def auth(user):
    c = APIClient()
    c.force_authenticate(user=user)
    return c


# ── 1. Model tests ────────────────────────────────────────────────────────────

class CRMModelTests(TestCase):

    def setUp(self):
        self.owner = make_creator()

    def test_sheet_creates_with_uuid(self):
        sheet = CRMSheet.objects.create(owner=self.owner, name="Test Sheet")
        self.assertIsNotNone(sheet.id)
        self.assertEqual(str(sheet), "Test Sheet")

    def test_column_creates_under_sheet(self):
        sheet = CRMSheet.objects.create(owner=self.owner, name="Sheet")
        col = CRMColumn.objects.create(sheet=sheet, name="Email", field_type="email")
        self.assertEqual(col.sheet, sheet)
        self.assertEqual(col.field_type, "email")
        self.assertEqual(col.options, [])

    def test_row_creates_with_json_values(self):
        sheet = CRMSheet.objects.create(owner=self.owner, name="Sheet")
        col = CRMColumn.objects.create(sheet=sheet, name="Name", field_type="text")
        row = CRMRow.objects.create(sheet=sheet, values={str(col.id): "Alice"})
        self.assertEqual(row.values[str(col.id)], "Alice")

    def test_access_unique_together(self):
        from django.db import IntegrityError
        sheet = CRMSheet.objects.create(owner=self.owner, name="Sheet")
        talent = make_talent()
        CRMAccess.objects.create(sheet=sheet, user=talent, role="viewer")
        with self.assertRaises(IntegrityError):
            CRMAccess.objects.create(sheet=sheet, user=talent, role="editor")

    def test_sheet_cascade_deletes_columns_and_rows(self):
        sheet = CRMSheet.objects.create(owner=self.owner, name="Sheet")
        col = CRMColumn.objects.create(sheet=sheet, name="Name", field_type="text")
        row = CRMRow.objects.create(sheet=sheet, values={})
        sheet_id = sheet.id
        sheet.delete()
        self.assertFalse(CRMColumn.objects.filter(id=col.id).exists())
        self.assertFalse(CRMRow.objects.filter(id=row.id).exists())
        self.assertFalse(CRMSheet.objects.filter(id=sheet_id).exists())


# ── 2. Sheet CRUD endpoints ───────────────────────────────────────────────────

class CRMSheetEndpointTests(TestCase):

    def setUp(self):
        self.creator = make_creator()
        self.talent = make_talent()
        self.creator_client = auth(self.creator)
        self.talent_client = auth(self.talent)

    # ── List / Create ──────────────────────────────────────────────────────────

    def test_creator_can_list_their_sheets(self):
        CRMSheet.objects.create(owner=self.creator, name="Mine")
        CRMSheet.objects.create(owner=make_creator(), name="Other")  # different owner
        r = self.creator_client.get("/api/v7/sheets/")
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.assertEqual(len(r.data), 1)
        self.assertEqual(r.data[0]["name"], "Mine")

    def test_creator_can_create_sheet(self):
        r = self.creator_client.post("/api/v7/sheets/", {"name": "My CRM"}, format="json")
        self.assertEqual(r.status_code, status.HTTP_201_CREATED)
        self.assertEqual(r.data["name"], "My CRM")
        self.assertTrue(CRMSheet.objects.filter(name="My CRM").exists())

    def test_talent_cannot_create_sheet(self):
        r = self.talent_client.post("/api/v7/sheets/", {"name": "Talent CRM"}, format="json")
        self.assertEqual(r.status_code, status.HTTP_403_FORBIDDEN)

    def test_unauthenticated_cannot_create_sheet(self):
        r = APIClient().post("/api/v7/sheets/", {"name": "Anon CRM"}, format="json")
        self.assertEqual(r.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_response_includes_summary_fields(self):
        r = self.creator_client.post("/api/v7/sheets/", {"name": "Summary Test"}, format="json")
        self.assertIn("id", r.data)
        self.assertIn("column_count", r.data)
        self.assertIn("row_count", r.data)
        self.assertIn("column_names", r.data)
        self.assertIn("created_at", r.data)

    # ── Retrieve / Update / Delete ─────────────────────────────────────────────

    def test_creator_can_retrieve_sheet_detail(self):
        sheet = CRMSheet.objects.create(owner=self.creator, name="Detail Sheet")
        r = self.creator_client.get(f"/api/v7/sheets/{sheet.id}/")
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.assertIn("columns", r.data)
        self.assertIn("rows", r.data)
        self.assertIn("access_list", r.data)

    def test_creator_can_rename_sheet(self):
        sheet = CRMSheet.objects.create(owner=self.creator, name="Old Name")
        r = self.creator_client.patch(f"/api/v7/sheets/{sheet.id}/", {"name": "New Name"}, format="json")
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        sheet.refresh_from_db()
        self.assertEqual(sheet.name, "New Name")

    def test_creator_can_delete_sheet(self):
        sheet = CRMSheet.objects.create(owner=self.creator, name="To Delete")
        r = self.creator_client.delete(f"/api/v7/sheets/{sheet.id}/")
        self.assertEqual(r.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(CRMSheet.objects.filter(id=sheet.id).exists())

    def test_cannot_access_another_creators_sheet(self):
        other = make_creator()
        sheet = CRMSheet.objects.create(owner=other, name="Not Mine")
        r = self.creator_client.get(f"/api/v7/sheets/{sheet.id}/")
        self.assertEqual(r.status_code, status.HTTP_404_NOT_FOUND)

    def test_talent_cannot_delete_sheet(self):
        sheet = CRMSheet.objects.create(owner=self.creator, name="Sheet")
        r = self.talent_client.delete(f"/api/v7/sheets/{sheet.id}/")
        # 403 (permission denied) or 404 (not found because queryset filters by owner)
        self.assertIn(r.status_code, [status.HTTP_403_FORBIDDEN, status.HTTP_404_NOT_FOUND])


# ── 3. Column endpoints ───────────────────────────────────────────────────────

class CRMColumnEndpointTests(TestCase):

    def setUp(self):
        self.creator = make_creator()
        self.client_ = auth(self.creator)
        self.sheet = CRMSheet.objects.create(owner=self.creator, name="Sheet")

    def test_add_text_column(self):
        r = self.client_.post(
            f"/api/v7/sheets/{self.sheet.id}/columns/",
            {"name": "Notes", "field_type": "text"},
            format="json",
        )
        self.assertEqual(r.status_code, status.HTTP_201_CREATED)
        self.assertEqual(r.data["name"], "Notes")
        self.assertEqual(r.data["field_type"], "text")

    def test_add_select_column_with_options(self):
        r = self.client_.post(
            f"/api/v7/sheets/{self.sheet.id}/columns/",
            {"name": "Stage", "field_type": "single_select", "options": ["Lead", "Won", "Lost"]},
            format="json",
        )
        self.assertEqual(r.status_code, status.HTTP_201_CREATED)
        self.assertEqual(r.data["options"], ["Lead", "Won", "Lost"])

    def test_list_columns_for_sheet(self):
        CRMColumn.objects.create(sheet=self.sheet, name="A", field_type="text")
        CRMColumn.objects.create(sheet=self.sheet, name="B", field_type="number")
        r = self.client_.get(f"/api/v7/sheets/{self.sheet.id}/columns/")
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.assertEqual(len(r.data), 2)

    def test_delete_column(self):
        col = CRMColumn.objects.create(sheet=self.sheet, name="Temp", field_type="text")
        r = self.client_.delete(f"/api/v7/sheets/{self.sheet.id}/columns/{col.id}/")
        self.assertEqual(r.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(CRMColumn.objects.filter(id=col.id).exists())

    def test_columns_scoped_to_sheet(self):
        other_sheet = CRMSheet.objects.create(owner=self.creator, name="Other")
        col = CRMColumn.objects.create(sheet=other_sheet, name="X", field_type="text")
        r = self.client_.get(f"/api/v7/sheets/{self.sheet.id}/columns/{col.id}/")
        self.assertEqual(r.status_code, status.HTTP_404_NOT_FOUND)

    def test_all_field_types_accepted(self):
        for ft in ["text", "email", "phone", "number", "date", "single_select", "multi_select", "checkbox"]:
            opts = ["a", "b"] if ft in ("single_select", "multi_select") else []
            r = self.client_.post(
                f"/api/v7/sheets/{self.sheet.id}/columns/",
                {"name": ft.title(), "field_type": ft, "options": opts},
                format="json",
            )
            self.assertEqual(r.status_code, status.HTTP_201_CREATED, msg=f"field_type={ft} failed")


# ── 4. Row endpoints ──────────────────────────────────────────────────────────

class CRMRowEndpointTests(TestCase):

    def setUp(self):
        self.creator = make_creator()
        self.client_ = auth(self.creator)
        self.sheet = CRMSheet.objects.create(owner=self.creator, name="Sheet")
        self.col = CRMColumn.objects.create(sheet=self.sheet, name="Name", field_type="text")

    def test_add_row(self):
        r = self.client_.post(
            f"/api/v7/sheets/{self.sheet.id}/rows/",
            {"values": {str(self.col.id): "Alice"}},
            format="json",
        )
        self.assertEqual(r.status_code, status.HTTP_201_CREATED)
        self.assertEqual(r.data["values"][str(self.col.id)], "Alice")

    def test_update_row_values(self):
        row = CRMRow.objects.create(sheet=self.sheet, values={str(self.col.id): "Old"})
        r = self.client_.patch(
            f"/api/v7/sheets/{self.sheet.id}/rows/{row.id}/",
            {"values": {str(self.col.id): "New"}},
            format="json",
        )
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        row.refresh_from_db()
        self.assertEqual(row.values[str(self.col.id)], "New")

    def test_delete_row(self):
        row = CRMRow.objects.create(sheet=self.sheet, values={})
        r = self.client_.delete(f"/api/v7/sheets/{self.sheet.id}/rows/{row.id}/")
        self.assertEqual(r.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(CRMRow.objects.filter(id=row.id).exists())

    def test_list_rows_for_sheet(self):
        CRMRow.objects.create(sheet=self.sheet, values={})
        CRMRow.objects.create(sheet=self.sheet, values={})
        r = self.client_.get(f"/api/v7/sheets/{self.sheet.id}/rows/")
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.assertEqual(len(r.data), 2)

    def test_row_scoped_to_sheet(self):
        other_sheet = CRMSheet.objects.create(owner=self.creator, name="Other")
        row = CRMRow.objects.create(sheet=other_sheet, values={})
        r = self.client_.get(f"/api/v7/sheets/{self.sheet.id}/rows/{row.id}/")
        self.assertEqual(r.status_code, status.HTTP_404_NOT_FOUND)

    def test_add_empty_row(self):
        r = self.client_.post(
            f"/api/v7/sheets/{self.sheet.id}/rows/",
            {"values": {}},
            format="json",
        )
        self.assertEqual(r.status_code, status.HTTP_201_CREATED)


# ── 5. Access endpoints ───────────────────────────────────────────────────────

class CRMAccessEndpointTests(TestCase):

    def setUp(self):
        self.creator = make_creator()
        self.talent = make_talent()
        self.client_ = auth(self.creator)
        self.sheet = CRMSheet.objects.create(owner=self.creator, name="Sheet")

    def test_grant_viewer_access(self):
        r = self.client_.post(
            f"/api/v7/sheets/{self.sheet.id}/access/",
            {"user": str(self.talent.id), "role": "viewer"},
            format="json",
        )
        self.assertEqual(r.status_code, status.HTTP_201_CREATED)
        self.assertEqual(r.data["role"], "viewer")
        self.assertEqual(r.data["user_email"], self.talent.email)

    def test_grant_editor_access(self):
        r = self.client_.post(
            f"/api/v7/sheets/{self.sheet.id}/access/",
            {"user": str(self.talent.id), "role": "editor"},
            format="json",
        )
        self.assertEqual(r.status_code, status.HTTP_201_CREATED)
        self.assertEqual(r.data["role"], "editor")

    def test_update_access_role(self):
        access = CRMAccess.objects.create(sheet=self.sheet, user=self.talent, role="viewer")
        r = self.client_.patch(
            f"/api/v7/sheets/{self.sheet.id}/access/{access.id}/",
            {"role": "admin"},
            format="json",
        )
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        access.refresh_from_db()
        self.assertEqual(access.role, "admin")

    def test_delete_access(self):
        access = CRMAccess.objects.create(sheet=self.sheet, user=self.talent, role="viewer")
        r = self.client_.delete(f"/api/v7/sheets/{self.sheet.id}/access/{access.id}/")
        self.assertEqual(r.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(CRMAccess.objects.filter(id=access.id).exists())

    def test_list_access_entries(self):
        talent2 = make_talent()
        CRMAccess.objects.create(sheet=self.sheet, user=self.talent, role="viewer")
        CRMAccess.objects.create(sheet=self.sheet, user=talent2, role="editor")
        r = self.client_.get(f"/api/v7/sheets/{self.sheet.id}/access/")
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.assertEqual(len(r.data), 2)

    def test_access_response_includes_user_details(self):
        r = self.client_.post(
            f"/api/v7/sheets/{self.sheet.id}/access/",
            {"user": str(self.talent.id), "role": "viewer"},
            format="json",
        )
        self.assertIn("user_name", r.data)
        self.assertIn("user_email", r.data)


# ── 6. Permission & isolation tests ──────────────────────────────────────────

class CRMPermissionTests(TestCase):

    def setUp(self):
        self.creator_a = make_creator()
        self.creator_b = make_creator()
        self.talent = make_talent()

    def test_creator_cannot_see_other_creators_sheets(self):
        CRMSheet.objects.create(owner=self.creator_b, name="B's Sheet")
        r = auth(self.creator_a).get("/api/v7/sheets/")
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.assertEqual(len(r.data), 0)

    def test_unauthenticated_cannot_list_sheets(self):
        r = APIClient().get("/api/v7/sheets/")
        self.assertEqual(r.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_talent_can_list_sheets_but_gets_empty(self):
        # Talent has no owned sheets — list returns empty (not 403)
        CRMSheet.objects.create(owner=self.creator_a, name="A's Sheet")
        r = auth(self.talent).get("/api/v7/sheets/")
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.assertEqual(len(r.data), 0)

    def test_talent_cannot_access_another_users_sheet_detail(self):
        sheet = CRMSheet.objects.create(owner=self.creator_a, name="Private")
        r = auth(self.talent).get(f"/api/v7/sheets/{sheet.id}/")
        self.assertEqual(r.status_code, status.HTTP_404_NOT_FOUND)

    def test_nested_column_endpoint_requires_sheet_ownership(self):
        sheet = CRMSheet.objects.create(owner=self.creator_a, name="Sheet")
        r = auth(self.creator_b).get(f"/api/v7/sheets/{sheet.id}/columns/")
        self.assertEqual(r.status_code, status.HTTP_404_NOT_FOUND)

    def test_nested_row_endpoint_requires_sheet_ownership(self):
        sheet = CRMSheet.objects.create(owner=self.creator_a, name="Sheet")
        r = auth(self.creator_b).post(
            f"/api/v7/sheets/{sheet.id}/rows/",
            {"values": {}},
            format="json",
        )
        self.assertEqual(r.status_code, status.HTTP_404_NOT_FOUND)
