"""Library tests — Document Library operations."""
from django.test import TestCase
from rest_framework.test import APIClient
from account.models import User
from library.models import Folder, Document, DocumentVersion


class DocumentLibraryTest(TestCase):
    """Test Document Library CRUD and versioning."""

    def setUp(self):
        self.api = APIClient()
        self.creator = User.objects.create_user(
            email="creator@test.com",
            full_name="Test Creator",
            password="testpass123",
            role="creator",
        )
        self.other_creator = User.objects.create_user(
            email="other@test.com",
            full_name="Other Creator",
            password="testpass123",
            role="creator",
        )
        self.talent = User.objects.create_user(
            email="talent@test.com",
            full_name="Talent",
            password="testpass123",
            role="talent",
        )

    def test_creator_only_access(self):
        """Only creators can access the document library."""
        self.api.force_authenticate(self.talent)
        response = self.api.get("/api/v6/folders/")
        self.assertEqual(response.status_code, 403)

    def test_folder_scoping(self):
        """Creators only see their own folders."""
        Folder.objects.create(creator=self.creator, name="My Folder", folder_type="INTERNAL")
        Folder.objects.create(creator=self.other_creator, name="Other Folder", folder_type="INTERNAL")

        self.api.force_authenticate(self.creator)
        response = self.api.get("/api/v6/folders/")
        self.assertEqual(response.status_code, 200)

        names = [f["name"] for f in response.data]
        self.assertIn("My Folder", names)
        self.assertNotIn("Other Folder", names)

    def test_client_folder_structure_creation(self):
        """Auto-create client folder with standard subfolders."""
        client_user = User.objects.create_user(
            email="client@test.com",
            full_name="Test Client",
            password="testpass123",
            role="client",
        )
        root = Folder.create_client_folder_structure(self.creator, client_user)

        subfolders = Folder.objects.filter(parent_folder=root)
        subfolder_names = set(subfolders.values_list("name", flat=True))

        self.assertEqual(subfolder_names, {
            "Contracts", "Briefs", "Deliverables", "Onboarding Responses"
        })

    def test_soft_delete_and_restore(self):
        """Documents should support soft-delete and restore."""
        folder = Folder.objects.create(
            creator=self.creator, name="Test", folder_type="INTERNAL"
        )
        from django.core.files.base import ContentFile
        doc = Document.objects.create(
            creator=self.creator,
            folder=folder,
            name="test.txt",
            file=ContentFile(b"hello", name="test.txt"),
            file_type="text/plain",
            size_kb=0.005,
        )

        # Soft delete
        doc.soft_delete()
        self.assertTrue(doc.is_deleted)
        self.assertIsNotNone(doc.deleted_at)

        # Should not appear in normal queries
        self.assertEqual(
            Document.objects.filter(creator=self.creator, is_deleted=False).count(), 0
        )

        # Restore
        doc.restore()
        self.assertFalse(doc.is_deleted)
        self.assertIsNone(doc.deleted_at)

    def test_unauthenticated_blocked(self):
        """Unauthenticated requests are blocked."""
        response = self.api.get("/api/v6/folders/")
        self.assertEqual(response.status_code, 401)
