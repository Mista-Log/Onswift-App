"""Scoping and behaviour tests for the notification and client read tools."""
import datetime as dt
import json
import uuid

from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings
from django.utils import timezone

from agent.tools import ToolError, run_tool
from agent.tools.base import MAX_ROWS, MAX_TEXT
from notification.models import Notification
from project.models import Project, ProjectClientMembership

User = get_user_model()

# These tests create several users each; the real password hasher is deliberately slow, which only
# makes the suite crawl. Test users never log in, so a fast hasher changes nothing that is tested.
FAST_HASH = override_settings(PASSWORD_HASHERS=["django.contrib.auth.hashers.MD5PasswordHasher"])


def make_user(email, role="creator", name=None):
    return User.objects.create_user(
        email=email,
        full_name=email if name is None else name,
        password="Str0ng-pass-123",
        role=role,
        email_verified=True,
    )


def notify(user, title="Hello", message="Body", read=False, **extra):
    return Notification.objects.create(
        user=user, title=title, message=message, notification_type="system", is_read=read, **extra
    )


@FAST_HASH
class NotificationToolTests(TestCase):
    def setUp(self):
        self.a = make_user("a@test.com")
        self.b = make_user("b@test.com")

    def titles(self, result):
        return [n["title"] for n in result["items"]]

    def test_only_the_callers_notifications_are_returned(self):
        notify(self.a, "For A")
        notify(self.b, "For B")
        self.assertEqual(self.titles(run_tool(self.a, "list_notifications", {})), ["For A"])
        self.assertEqual(self.titles(run_tool(self.b, "list_notifications", {})), ["For B"])

    def test_unread_count_never_includes_another_users_notifications(self):
        notify(self.a)
        notify(self.b)
        notify(self.b)
        self.assertEqual(run_tool(self.a, "list_notifications", {})["unread_count"], 1)

    def test_unread_only_filters_the_list_but_not_the_total_count(self):
        notify(self.a, "read one", read=True)
        notify(self.a, "unread one")
        result = run_tool(self.a, "list_notifications", {"unread_only": True})
        self.assertEqual(self.titles(result), ["unread one"])
        self.assertEqual(result["unread_count"], 1)
        everything = run_tool(self.a, "list_notifications", {})
        self.assertEqual(len(everything["items"]), 2)

    def test_newest_first(self):
        old = notify(self.a, "old")
        new = notify(self.a, "new")
        Notification.objects.filter(pk=old.pk).update(created_at=timezone.now() - dt.timedelta(days=2))
        Notification.objects.filter(pk=new.pk).update(created_at=timezone.now())
        self.assertEqual(self.titles(run_tool(self.a, "list_notifications", {})), ["new", "old"])

    def test_long_text_is_clipped(self):
        notify(self.a, "t" * 1000, "m" * 1000)
        item = run_tool(self.a, "list_notifications", {})["items"][0]
        self.assertLessEqual(len(item["title"]), MAX_TEXT + 1)
        self.assertLessEqual(len(item["message"]), MAX_TEXT + 1)

    def test_list_is_capped_and_says_so(self):
        for i in range(MAX_ROWS + 3):
            notify(self.a, f"n{i}")
        result = run_tool(self.a, "list_notifications", {})
        self.assertEqual(len(result["items"]), MAX_ROWS)
        self.assertTrue(result["truncated"])
        self.assertEqual(result["unread_count"], MAX_ROWS + 3)  # the count is real, not capped

    def test_a_user_id_argument_is_rejected(self):
        with self.assertRaises(ToolError):
            run_tool(self.a, "list_notifications", {"user_id": str(self.b.id)})

    def test_no_notifications_gives_an_empty_list(self):
        result = run_tool(self.a, "list_notifications", {})
        self.assertEqual(result, {"items": [], "truncated": False, "unread_count": 0})


@FAST_HASH
class ClientToolTests(TestCase):
    def setUp(self):
        self.a = make_user("a@test.com")
        self.b = make_user("b@test.com")
        self.alpha = Project.objects.create(creator=self.a, name="Alpha site", status="in-progress")
        self.alpha2 = Project.objects.create(creator=self.a, name="Alpha two", status="pending")
        self.bravo = Project.objects.create(creator=self.b, name="Bravo secret", status="pending")
        self.c1 = make_user("c1@test.com", role="client", name="Client One")
        self.c2 = make_user("c2@test.com", role="client", name="Client Two")
        self.shared = make_user("shared@test.com", role="client", name="Shared Client")

    def link(self, project, client, status="active", days_ago=0):
        m = ProjectClientMembership.objects.create(project=project, client=client, status=status)
        ProjectClientMembership.objects.filter(pk=m.pk).update(
            added_at=timezone.now() - dt.timedelta(days=days_ago)
        )
        return m

    def names(self, result):
        return [c["name"] for c in result["items"]]

    # --- scoping -----------------------------------------------------------------------------

    def test_a_creator_only_sees_clients_on_their_own_projects(self):
        self.link(self.alpha, self.c1)
        self.link(self.bravo, self.c2)
        self.assertEqual(self.names(run_tool(self.a, "list_clients", {})), ["Client One"])
        self.assertEqual(self.names(run_tool(self.b, "list_clients", {})), ["Client Two"])

    def test_a_client_on_both_creators_projects_only_counts_the_callers_projects(self):
        self.link(self.alpha, self.shared, status="active")
        self.link(self.bravo, self.shared, status="completed")
        row = run_tool(self.a, "list_clients", {})["items"][0]
        self.assertEqual(row["total_projects"], 1)
        self.assertEqual(row["by_status"], {"active": 1})

    def test_get_client_for_a_client_of_someone_else_looks_the_same_as_a_missing_one(self):
        self.link(self.bravo, self.c2)
        with self.assertRaises(ToolError) as other:
            run_tool(self.a, "get_client", {"client_id": str(self.c2.id)})
        with self.assertRaises(ToolError) as missing:
            run_tool(self.a, "get_client", {"client_id": str(uuid.uuid4())})
        with self.assertRaises(ToolError) as malformed:
            run_tool(self.a, "get_client", {"client_id": "not-a-uuid"})
        self.assertEqual(str(other.exception), str(missing.exception))
        self.assertEqual(str(other.exception), str(malformed.exception))
        self.assertNotIn("Client Two", str(other.exception))

    def test_get_client_never_lists_the_other_creators_projects(self):
        self.link(self.alpha, self.shared)
        self.link(self.bravo, self.shared)
        result = run_tool(self.a, "get_client", {"client_id": str(self.shared.id)})
        self.assertEqual([p["project_name"] for p in result["projects"]["items"]], ["Alpha site"])
        self.assertNotIn("Bravo", json.dumps(result))

    def test_a_user_id_argument_is_rejected(self):
        with self.assertRaises(ToolError):
            run_tool(self.a, "list_clients", {"user_id": str(self.b.id)})

    def test_a_client_account_sees_no_clients(self):
        self.link(self.alpha, self.c1)
        self.assertEqual(run_tool(self.c1, "list_clients", {})["items"], [])

    # --- behaviour ---------------------------------------------------------------------------

    def test_counts_projects_and_statuses_per_client(self):
        self.link(self.alpha, self.c1, status="active")
        self.link(self.alpha2, self.c1, status="completed")
        row = run_tool(self.a, "list_clients", {})["items"][0]
        self.assertEqual(row["total_projects"], 2)
        self.assertEqual(row["by_status"], {"active": 1, "completed": 1})

    def test_most_recent_client_first_and_last_activity_is_their_newest_membership(self):
        self.link(self.alpha, self.c1, days_ago=10)
        self.link(self.alpha2, self.c1, days_ago=1)
        self.link(self.alpha, self.c2, days_ago=5)
        result = run_tool(self.a, "list_clients", {})
        self.assertEqual(self.names(result), ["Client One", "Client Two"])
        newest = timezone.now() - dt.timedelta(days=1)
        last = dt.datetime.fromisoformat(result["items"][0]["last_activity"])
        self.assertLess(abs((last - newest).total_seconds()), 60)

    def test_email_addresses_are_never_returned(self):
        self.link(self.alpha, self.c1)
        output = json.dumps(run_tool(self.a, "list_clients", {})) + json.dumps(
            run_tool(self.a, "get_client", {"client_id": str(self.c1.id)})
        )
        self.assertNotIn("c1@test.com", output)
        self.assertNotIn("email", output)

    def test_a_client_with_no_name_gets_a_placeholder(self):
        nameless = make_user("n@test.com", role="client", name="")
        self.link(self.alpha, nameless)
        self.assertEqual(self.names(run_tool(self.a, "list_clients", {})), ["Unnamed client"])

    def test_get_client_lists_their_projects_with_both_statuses(self):
        self.link(self.alpha, self.c1, status="on_hold")
        result = run_tool(self.a, "get_client", {"client_id": str(self.c1.id)})
        self.assertEqual(result["name"], "Client One")
        self.assertEqual(
            result["projects"]["items"],
            [{
                "project_id": str(self.alpha.id),
                "project_name": "Alpha site",
                "project_status": "in-progress",
                "client_status": "on_hold",
            }],
        )

    def test_no_clients_gives_an_empty_list(self):
        self.assertEqual(run_tool(self.a, "list_clients", {}), {"items": [], "truncated": False})

    def test_the_client_list_is_capped_and_says_so(self):
        for i in range(MAX_ROWS + 2):
            self.link(self.alpha, make_user(f"bulk{i}@test.com", role="client", name=f"Bulk {i}"))
        result = run_tool(self.a, "list_clients", {})
        self.assertEqual(len(result["items"]), MAX_ROWS)
        self.assertTrue(result["truncated"])
