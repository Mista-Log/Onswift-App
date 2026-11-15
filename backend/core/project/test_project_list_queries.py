from datetime import timedelta

from django.contrib.auth import get_user_model
from django.db import connection
from django.test import TestCase
from django.test.utils import CaptureQueriesContext
from django.utils import timezone
from rest_framework.test import APIClient

from account.models import UserSettings
from notification.models import HireRequest
from portal.models import ClientInvite
from .models import Project, ProjectClientMembership, Task, TeamMember

User = get_user_model()


def make_user(email, role):
    return User.objects.create_user(email=email, full_name=email.split("@")[0].title(), password="pass1234", role=role)


def api(user):
    client = APIClient()
    client.force_authenticate(user)
    return client


def queries_for(user, url):
    client = api(user)
    with CaptureQueriesContext(connection) as ctx:
        res = client.get(url)
    assert res.status_code == 200, res.content
    return len(ctx), res.json()


class ProjectListQueryTests(TestCase):
    """The project and task lists must cost the same number of queries however long they are."""

    def setUp(self):
        self.creator = make_user("creator@test.com", "creator")
        self.talent = make_user("talent@test.com", "talent")
        self.client_user = make_user("client@test.com", "client")

    def add_project(self, owner, name, tasks=("planning", "in-progress", "completed"), assignee=None):
        project = Project.objects.create(creator=owner, name=name)
        TeamMember.objects.create(project=project, name="Ada")
        for status in tasks:
            task = Task.objects.create(project=project, name=f"{name} {status}", status=status)
            if assignee:
                task.assignees.add(assignee)
        return project

    def test_creator_list_query_count_does_not_grow_with_projects(self):
        self.add_project(self.creator, "One")
        few, _ = queries_for(self.creator, "/api/v2/projects/")
        for i in range(8):
            self.add_project(self.creator, f"More {i}")
        many, data = queries_for(self.creator, "/api/v2/projects/")
        self.assertEqual(len(data), 9)
        self.assertEqual(many, few, f"queries: {few} then {many}")

    def test_talent_list_query_count_does_not_grow_with_projects(self):
        self.add_project(self.creator, "One", assignee=self.talent)
        few, _ = queries_for(self.talent, "/api/v2/projects/")
        for i in range(8):
            self.add_project(self.creator, f"More {i}", assignee=self.talent)
        many, data = queries_for(self.talent, "/api/v2/projects/")
        self.assertEqual(len(data), 9)
        self.assertEqual(many, few, f"queries: {few} then {many}")

    def test_newest_project_comes_first_for_creator_and_talent(self):
        for name in ("First", "Second", "Third"):
            self.add_project(self.creator, name, assignee=self.talent)
        for user in (self.creator, self.talent):
            names = [p["name"] for p in api(user).get("/api/v2/projects/").json()]
            self.assertEqual(names, ["Third", "Second", "First"], user.email)

    def test_task_list_query_count_does_not_grow_with_tasks(self):
        project = self.add_project(self.creator, "One", tasks=("planning",), assignee=self.talent)
        url = f"/api/v2/projects/{project.id}/tasks/"
        few, _ = queries_for(self.creator, url)
        for i in range(8):
            Task.objects.create(project=project, name=f"T{i}").assignees.add(self.talent)
        many, data = queries_for(self.creator, url)
        self.assertEqual(len(data), 9)
        self.assertEqual(many, few, f"queries: {few} then {many}")
        self.assertEqual(data[0]["assignee_names"], ["Talent"])
        self.assertEqual(data[0]["assignees"], [str(self.talent.id)])

    def test_list_values_are_still_right(self):
        self.add_project(self.creator, "Plain", tasks=())
        busy = self.add_project(self.creator, "Busy", tasks=("planning", "in-progress", "completed", "completed"))
        invited = self.add_project(self.creator, "Invited", tasks=("completed",))
        ProjectClientMembership.objects.create(project=busy, client=self.client_user)
        ClientInvite.objects.create(
            project=invited, creator=self.creator, client_email="new@test.com",
            expires_at=timezone.now() + timedelta(days=7),
        )

        by_name = {p["name"]: p for p in api(self.creator).get("/api/v2/projects/").json()}

        self.assertEqual(
            [by_name["Plain"][k] for k in ("task_count", "completed_tasks", "in_progress_tasks", "progress")],
            [0, 0, 0, 0],
        )
        self.assertEqual(
            [by_name["Busy"][k] for k in ("task_count", "completed_tasks", "in_progress_tasks", "progress")],
            [4, 2, 1, 50],
        )
        self.assertEqual(by_name["Invited"]["progress"], 100)
        self.assertFalse(by_name["Plain"]["has_clients"])
        self.assertTrue(by_name["Busy"]["has_clients"])
        self.assertTrue(by_name["Invited"]["has_clients"])
        self.assertEqual(by_name["Busy"]["owner_name"], "Creator")
        self.assertEqual([m["name"] for m in by_name["Busy"]["teamMembers"]], ["Ada"])
        self.assertTrue(by_name["Busy"]["allow_talent_task_creation"])

    def test_team_task_setting_follows_the_owner(self):
        self.add_project(self.creator, "One")
        UserSettings.objects.update_or_create(user=self.creator, defaults={"allow_team_task_creation": False})
        project = api(self.creator).get("/api/v2/projects/").json()[0]
        self.assertFalse(project["allow_talent_task_creation"])

    def test_talent_counts_cover_the_whole_project_not_just_their_tasks(self):
        project = self.add_project(self.creator, "Shared work", tasks=("planning", "completed"))
        Task.objects.create(project=project, name="Mine", status="completed").assignees.add(self.talent)
        Task.objects.create(project=project, name="Mine too", status="planning").assignees.add(self.talent)

        data = api(self.talent).get("/api/v2/projects/").json()

        self.assertEqual(len(data), 1)
        self.assertEqual((data[0]["task_count"], data[0]["completed_tasks"]), (4, 2))

    def test_shared_projects_list_carries_the_same_values(self):
        HireRequest.objects.create(creator=self.creator, talent=self.talent, status="accepted")
        project = self.add_project(self.talent, "Talent's own")
        project.shared_with_creators = True
        project.save()

        data = api(self.creator).get("/api/v2/projects/shared/").json()

        self.assertEqual([(p["name"], p["task_count"], p["owner_name"]) for p in data], [("Talent's own", 3, "Talent")])
