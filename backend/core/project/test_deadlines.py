import datetime as dt

from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from .models import PersonalTask, Project, Task

User = get_user_model()
URL = "/api/v2/deadlines/"
DUE = dt.date(2026, 10, 1)


def make_user(email, role):
    return User.objects.create_user(email=email, full_name=email, password="pass1234", role=role)


class DeadlineListTests(TestCase):
    def setUp(self):
        self.creator = make_user("c@test.com", "creator")
        self.talent = make_user("t@test.com", "talent")
        self.other = make_user("o@test.com", "creator")
        self.project = Project.objects.create(creator=self.creator, name="Alpha")

    def api(self, user):
        c = APIClient()
        c.force_authenticate(user=user)
        return c

    def task(self, name, project=None, deadline=DUE, assignee=None):
        t = Task.objects.create(project=project or self.project, name=name, deadline=deadline)
        if assignee:
            t.assignees.add(assignee)
        return t

    def test_creator_sees_all_tasks_with_deadlines_in_own_projects(self):
        self.task("a", assignee=self.talent)
        self.task("b")
        self.task("no date", deadline=None)
        foreign = Project.objects.create(creator=self.other, name="Not mine")
        self.task("foreign", project=foreign)

        names = sorted(r["name"] for r in self.api(self.creator).get(URL).data)
        self.assertEqual(names, ["a", "b"])

    def test_talent_sees_only_assigned_tasks(self):
        self.task("mine", assignee=self.talent)
        self.task("theirs")
        rows = self.api(self.talent).get(URL).data
        self.assertEqual([r["name"] for r in rows], ["mine"])
        self.assertEqual(rows[0]["project_name"], "Alpha")
        self.assertEqual(rows[0]["assignee_id"], str(self.talent.id))
        self.assertEqual(rows[0]["deadline"], "2026-10-01")

    def test_personal_tasks_included_and_private(self):
        PersonalTask.objects.create(owner=self.creator, name="mine", deadline=DUE)
        PersonalTask.objects.create(owner=self.creator, name="undated")
        PersonalTask.objects.create(owner=self.other, name="not mine", deadline=DUE)

        rows = self.api(self.creator).get(URL).data
        self.assertEqual([r["name"] for r in rows], ["mine"])
        self.assertTrue(rows[0]["is_personal"])
        self.assertIsNone(rows[0]["project_id"])
        self.assertEqual(rows[0]["project_name"], "Personal")

    def test_requires_authentication(self):
        self.assertEqual(APIClient().get(URL).status_code, 401)

    def test_query_count_does_not_grow_with_projects(self):
        def make_projects(n):
            for i in range(n):
                p = Project.objects.create(creator=self.creator, name=f"P{i}")
                self.task(f"t{i}", project=p, assignee=self.talent)

        make_projects(2)
        api = self.api(self.creator)
        with self.assertNumQueries(3):
            api.get(URL)

        make_projects(10)
        with self.assertNumQueries(3):
            api.get(URL)
