from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from .models import Project, Task

User = get_user_model()


def make_user(email, role):
    return User.objects.create_user(email=email, full_name=email.split("@")[0], password="pass1234", role=role)


class TalentTaskStatusTests(TestCase):
    """A talent may start/pause their own task (planning <-> in-progress); nothing else."""

    def setUp(self):
        self.creator = make_user("creator@test.com", "creator")
        self.talent = make_user("talent@test.com", "talent")
        self.other = make_user("other@test.com", "talent")
        self.project = Project.objects.create(creator=self.creator, name="Alpha")
        self.task = Task.objects.create(project=self.project, name="Design", status="planning")
        self.task.assignees.add(self.talent)
        self.url = f"/api/v2/tasks/{self.task.id}/"

    def patch(self, user, payload):
        client = APIClient()
        client.force_authenticate(user)
        return client.patch(self.url, payload, format="json")

    def test_assignee_can_start_and_pause_their_task(self):
        self.assertEqual(self.patch(self.talent, {"status": "in-progress"}).status_code, 200)
        self.task.refresh_from_db()
        self.assertEqual(self.task.status, "in-progress")

        self.assertEqual(self.patch(self.talent, {"status": "planning"}).status_code, 200)
        self.task.refresh_from_db()
        self.assertEqual(self.task.status, "planning")

    def test_talent_cannot_complete_a_task(self):
        res = self.patch(self.talent, {"status": "completed"})
        self.assertEqual(res.status_code, 403)
        self.task.refresh_from_db()
        self.assertEqual(self.task.status, "planning")

    def test_talent_cannot_change_anything_besides_status(self):
        for payload in (
            {"name": "Renamed"},
            {"status": "in-progress", "name": "Renamed"},
            {"status": "in-progress", "deadline": "2030-01-01"},
        ):
            self.assertEqual(self.patch(self.talent, payload).status_code, 403, payload)
        self.task.refresh_from_db()
        self.assertEqual((self.task.name, self.task.status), ("Design", "planning"))

    def test_talent_cannot_put_or_delete(self):
        client = APIClient()
        client.force_authenticate(self.talent)
        self.assertEqual(client.put(self.url, {"name": "x", "status": "in-progress"}, format="json").status_code, 403)
        self.assertEqual(client.delete(self.url).status_code, 403)
        self.assertTrue(Task.objects.filter(id=self.task.id).exists())

    def test_someone_not_assigned_cannot_touch_the_task(self):
        res = self.patch(self.other, {"status": "in-progress"})
        self.assertEqual(res.status_code, 404)
        self.task.refresh_from_db()
        self.assertEqual(self.task.status, "planning")

    def test_completed_task_is_locked_for_the_talent(self):
        self.task.status = "completed"
        self.task.save(update_fields=["status"])
        self.assertEqual(self.patch(self.talent, {"status": "in-progress"}).status_code, 403)
        self.task.refresh_from_db()
        self.assertEqual(self.task.status, "completed")

    def test_task_awaiting_approval_is_locked_for_the_talent(self):
        self.task.status = "in-progress"
        self.task.awaiting_approval = True
        self.task.save(update_fields=["status", "awaiting_approval"])
        self.assertEqual(self.patch(self.talent, {"status": "planning"}).status_code, 403)
        self.task.refresh_from_db()
        self.assertEqual(self.task.status, "in-progress")

    def test_creator_behaviour_is_unchanged(self):
        self.assertEqual(self.patch(self.creator, {"status": "completed"}).status_code, 200)
        self.task.refresh_from_db()
        self.assertEqual(self.task.status, "completed")
        self.assertEqual(self.patch(self.creator, {"name": "Renamed"}).status_code, 200)

    def test_client_still_cannot_modify_tasks(self):
        client_user = make_user("client@test.com", "client")
        self.assertEqual(self.patch(client_user, {"status": "in-progress"}).status_code, 403)
