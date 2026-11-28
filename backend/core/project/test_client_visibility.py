"""Clients only see completed work the creator shared, and talk to the creator in their own thread."""
from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from account.models import UserSettings
from notification.models import Notification

from .models import Project, ProjectClientMembership, Task, TaskAttachment, TaskChecklist, TaskComment

User = get_user_model()


def make_user(email, role):
    return User.objects.create_user(email=email, full_name=email.split("@")[0], password="pass1234", role=role)


def api(user):
    client = APIClient()
    client.force_authenticate(user)
    return client


class ClientVisibilityTests(TestCase):
    def setUp(self):
        self.creator = make_user("creator@test.com", "creator")
        self.talent = make_user("talent@test.com", "talent")
        self.client_user = make_user("client@test.com", "client")
        self.project = Project.objects.create(creator=self.creator, name="Alpha")
        # The open task goes first: a project whose tasks are all done completes itself (and its
        # client memberships), which would take the client out of the project.
        self.open = Task.objects.create(project=self.project, name="Website", status="in-progress")
        self.done = Task.objects.create(project=self.project, name="Logo", status="completed")
        self.done.assignees.add(self.talent)
        ProjectClientMembership.objects.create(project=self.project, client=self.client_user)

    def share(self, task):
        return api(self.creator).patch(f"/api/v2/tasks/{task.id}/", {"shared_with_client": True}, format="json")

    def portal(self):
        return api(self.client_user).get(f"/api/v5/projects/{self.project.id}/").data["project"]

    # ── What clients see ─────────────────────────────────────────────────────

    def test_unshared_tasks_are_hidden_everywhere(self):
        self.assertEqual(self.portal()["tasks"], [])
        c = api(self.client_user)
        self.assertEqual(c.get(f"/api/v2/tasks/{self.done.id}/").status_code, 404)
        self.assertEqual(c.get(f"/api/v2/tasks/{self.done.id}/attachments/").status_code, 404)
        self.assertEqual(c.get(f"/api/v2/tasks/{self.done.id}/checklists/").status_code, 404)
        self.assertEqual(c.get(f"/api/v2/tasks/{self.done.id}/client-comments/").status_code, 404)

    def test_sharing_a_completed_task_shows_it_and_notifies_the_client(self):
        res = self.share(self.done)
        self.assertEqual(res.status_code, 200)
        self.done.refresh_from_db()
        self.assertTrue(self.done.shared_with_client)
        self.assertIsNotNone(self.done.shared_at)

        names = [t["name"] for t in self.portal()["tasks"]]
        self.assertEqual(names, ["Logo"])
        self.assertEqual(api(self.client_user).get(f"/api/v2/tasks/{self.done.id}/").status_code, 200)
        self.assertTrue(Notification.objects.filter(user=self.client_user, title="New completed work").exists())

    def test_a_shared_task_that_is_reopened_disappears_again(self):
        self.share(self.done)
        api(self.creator).patch(f"/api/v2/tasks/{self.done.id}/", {"status": "in-progress"}, format="json")
        self.assertEqual(self.portal()["tasks"], [])
        self.assertEqual(api(self.client_user).get(f"/api/v2/tasks/{self.done.id}/").status_code, 404)

    def test_an_unfinished_task_stays_hidden_even_if_flagged(self):
        self.share(self.open)
        self.assertEqual(self.portal()["tasks"], [])

    def test_progress_counts_shared_completed_work_out_of_all_tasks(self):
        self.assertEqual(self.portal()["progress"], 0)
        self.share(self.done)
        project = self.portal()
        self.assertEqual((project["completed_tasks"], project["total_tasks"], project["progress"]), (1, 2, 50))

    def test_only_the_creator_can_share(self):
        res = api(self.talent).patch(f"/api/v2/tasks/{self.done.id}/", {"shared_with_client": True}, format="json")
        self.assertIn(res.status_code, (400, 403))
        self.done.refresh_from_db()
        self.assertFalse(self.done.shared_with_client)

    def test_bulk_share_shares_every_completed_task_once(self):
        Task.objects.create(project=self.project, name="Brand guide", status="completed")
        res = api(self.creator).post(f"/api/v2/projects/{self.project.id}/share-completed/")
        self.assertEqual(res.data, {"shared": 2})
        self.assertEqual(len(self.portal()["tasks"]), 2)
        again = api(self.creator).post(f"/api/v2/projects/{self.project.id}/share-completed/")
        self.assertEqual(again.data, {"shared": 0})
        # Only the project's creator may do it.
        self.assertEqual(api(self.talent).post(f"/api/v2/projects/{self.project.id}/share-completed/").status_code, 404)

    # ── Clients look, they don't change ──────────────────────────────────────

    def test_clients_cannot_add_attachments_or_tick_checklist_items(self):
        self.share(self.done)
        c = api(self.client_user)
        res = c.post(f"/api/v2/tasks/{self.done.id}/attachments/", {"url": "https://x.com"}, format="json")
        self.assertEqual(res.status_code, 403)
        self.assertFalse(TaskAttachment.objects.exists())

        checklist = TaskChecklist.objects.create(task=self.done, title="QA")
        item = checklist.items.create(content="Check colours")
        res = c.patch(
            f"/api/v2/tasks/{self.done.id}/checklists/{checklist.id}/items/{item.id}/", {"is_checked": True}, format="json"
        )
        self.assertEqual(res.status_code, 403)

    # ── Two separate comment threads ────────────────────────────────────────

    def test_team_comments_never_reach_the_client(self):
        self.share(self.done)
        TaskComment.objects.create(task=self.done, author=self.talent, content="internal note")
        c = api(self.client_user)
        self.assertEqual(c.get(f"/api/v2/tasks/{self.done.id}/").data["comments"], [])
        self.assertEqual(c.get(f"/api/v2/tasks/{self.done.id}/comments/").status_code, 403)
        res = c.post(f"/api/v2/tasks/{self.done.id}/comments/", {"content": "hi"}, format="json")
        self.assertEqual(res.status_code, 403)

    def test_client_feedback_thread_between_client_and_creator(self):
        self.share(self.done)
        res = api(self.client_user).post(
            f"/api/v2/tasks/{self.done.id}/client-comments/", {"content": "Love it, slightly bigger?"}, format="json"
        )
        self.assertEqual(res.status_code, 201)
        self.assertEqual(res.data["audience"], "client")
        self.assertTrue(Notification.objects.filter(user=self.creator, title="New client feedback").exists())

        reply = api(self.creator).post(
            f"/api/v2/tasks/{self.done.id}/client-comments/", {"content": "On it", "parent": res.data["id"]}, format="json"
        )
        self.assertEqual(reply.status_code, 201)
        self.assertTrue(Notification.objects.filter(user=self.client_user, title="New reply on your feedback").exists())

        # The creator sees both threads separately; the team thread stays empty.
        detail = api(self.creator).get(f"/api/v2/tasks/{self.done.id}/").data
        self.assertEqual(len(detail["client_comments"]), 2)
        self.assertEqual(detail["comments"], [])

    def test_talents_are_not_part_of_the_client_thread(self):
        self.share(self.done)
        TaskComment.objects.create(task=self.done, author=self.client_user, content="feedback", audience="client")
        t = api(self.talent)
        self.assertEqual(t.get(f"/api/v2/tasks/{self.done.id}/client-comments/").status_code, 404)
        self.assertEqual(t.get(f"/api/v2/tasks/{self.done.id}/").data["client_comments"], [])
        # And the team thread doesn't list client feedback.
        self.assertEqual(api(self.creator).get(f"/api/v2/tasks/{self.done.id}/comments/").data, [])

    # ── Creator profile as a portfolio ──────────────────────────────────────

    def test_creator_profile_is_only_shown_when_switched_on(self):
        c = api(self.client_user)
        url = f"/api/v5/projects/{self.project.id}/creator-profile/"
        self.assertEqual(c.get(url).status_code, 404)
        self.assertFalse(self.portal()["creator_profile_available"])

        UserSettings.objects.update_or_create(user=self.creator, defaults={"show_profile_to_clients": True})
        res = c.get(url)
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data["full_name"], "creator")
        self.assertNotIn("id", res.data)
        self.assertTrue(self.portal()["creator_profile_available"])
