from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework import status
from rest_framework.test import APIClient

from .models import PersonalTask, Project, Task

User = get_user_model()

LIST_URL = "/api/v2/personal-tasks/"
ELIGIBILITY_URL = "/api/v2/personal-tasks/eligibility/"


def make_user(email, role):
    return User.objects.create_user(email=email, full_name=email, password="pass1234", role=role)


class PersonalTaskTests(TestCase):
    def setUp(self):
        self.creator = make_user("creator@test.com", "creator")
        self.talent = make_user("talent@test.com", "talent")
        self.client_user = make_user("client@test.com", "client")
        self.project = Project.objects.create(creator=self.creator, name="Alpha")
        self.other_project = Project.objects.create(creator=self.creator, name="Beta")
        Task.objects.create(project=self.project, name="Team task").assignees.add(self.talent)

    def api(self, user):
        c = APIClient()
        c.force_authenticate(user=user)
        return c

    def test_creator_creates_personal_task_linked_to_multiple_projects(self):
        res = self.api(self.creator).post(LIST_URL, {
            "name": "Buy domain",
            "deadline": "2026-10-01",
            "linked_project_ids": [str(self.project.id), str(self.other_project.id)],
        }, format="json")
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertEqual(len(res.data["linked_projects"]), 2)
        self.assertTrue(res.data["is_personal"])
        self.assertEqual(PersonalTask.objects.get().owner, self.creator)

    def test_creator_cannot_link_someone_elses_project(self):
        foreign = Project.objects.create(creator=self.talent, name="Not mine")
        res = self.api(self.creator).post(LIST_URL, {
            "name": "x", "linked_project_ids": [str(foreign.id)],
        }, format="json")
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

    def test_talent_blocked_until_creator_enables_task_creation(self):
        res = self.api(self.talent).post(LIST_URL, {"name": "Mine"}, format="json")
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)
        self.assertFalse(self.api(self.talent).get(ELIGIBILITY_URL).data["allowed"])

        self.project.allow_talent_task_creation = True
        self.project.save()

        res = self.api(self.talent).post(LIST_URL, {
            "name": "Mine", "linked_project_ids": [str(self.project.id)],
        }, format="json")
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        elig = self.api(self.talent).get(ELIGIBILITY_URL).data
        self.assertTrue(elig["allowed"])
        self.assertEqual([p["name"] for p in elig["projects"]], ["Alpha"])

    def test_talent_cannot_link_project_without_flag(self):
        self.project.allow_talent_task_creation = True
        self.project.save()
        Task.objects.create(project=self.other_project, name="T2").assignees.add(self.talent)
        res = self.api(self.talent).post(LIST_URL, {
            "name": "Mine", "linked_project_ids": [str(self.other_project.id)],
        }, format="json")
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

    def test_client_cannot_create(self):
        res = self.api(self.client_user).post(LIST_URL, {"name": "x"}, format="json")
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

    def test_tasks_are_private_to_owner(self):
        PersonalTask.objects.create(owner=self.creator, name="Secret")
        self.assertEqual(len(self.api(self.creator).get(LIST_URL).data), 1)
        self.assertEqual(len(self.api(self.talent).get(LIST_URL).data), 0)
        pk = PersonalTask.objects.get().id
        self.assertEqual(self.api(self.talent).get(f"{LIST_URL}{pk}/").status_code, 404)
        self.assertEqual(self.api(self.talent).delete(f"{LIST_URL}{pk}/").status_code, 404)

    def test_project_filter_returns_only_callers_linked_tasks(self):
        mine = PersonalTask.objects.create(owner=self.creator, name="linked")
        mine.linked_projects.add(self.project)
        other_link = PersonalTask.objects.create(owner=self.creator, name="elsewhere")
        other_link.linked_projects.add(self.other_project)
        PersonalTask.objects.create(owner=self.creator, name="unlinked")

        # A talent who also links a task to the same project must stay invisible to the creator.
        self.project.allow_talent_task_creation = True
        self.project.save()
        theirs = PersonalTask.objects.create(owner=self.talent, name="talent private")
        theirs.linked_projects.add(self.project)

        rows = self.api(self.creator).get(f"{LIST_URL}?project={self.project.id}").data
        self.assertEqual([r["name"] for r in rows], ["linked"])

        rows = self.api(self.talent).get(f"{LIST_URL}?project={self.project.id}").data
        self.assertEqual([r["name"] for r in rows], ["talent private"])

        self.assertEqual(self.api(self.creator).get(f"{LIST_URL}?project=not-a-uuid").data, [])
        self.assertEqual(len(self.api(self.creator).get(LIST_URL).data), 3)

    def test_completing_sets_and_clears_completed_at(self):
        task = PersonalTask.objects.create(owner=self.creator, name="Do it")
        api = self.api(self.creator)
        res = api.patch(f"{LIST_URL}{task.id}/", {"status": "completed"}, format="json")
        self.assertEqual(res.status_code, 200)
        self.assertIsNotNone(res.data["completed_at"])
        res = api.patch(f"{LIST_URL}{task.id}/", {"status": "planning"}, format="json")
        self.assertIsNone(res.data["completed_at"])
