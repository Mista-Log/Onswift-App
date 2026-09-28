from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from .models import Project, Task
from .serializers import ProjectSerializer, duplicate_project

User = get_user_model()


def make_creator():
    return User.objects.create_user(
        email="creator@test.com", full_name="Creator", password="pass1234", role="creator"
    )


class ProjectCountsTests(TestCase):
    def setUp(self):
        self.creator = make_creator()
        self.project = Project.objects.create(creator=self.creator, name="Alpha")

    def test_serializer_reports_in_progress_tasks(self):
        Task.objects.create(project=self.project, name="a", status="planning")
        Task.objects.create(project=self.project, name="b", status="in-progress")
        Task.objects.create(project=self.project, name="c", status="in-progress")
        Task.objects.create(project=self.project, name="d", status="completed")

        data = ProjectSerializer(self.project).data
        self.assertEqual(data["task_count"], 4)
        self.assertEqual(data["completed_tasks"], 1)
        self.assertEqual(data["in_progress_tasks"], 2)


class DuplicateProjectTests(TestCase):
    def setUp(self):
        self.creator = make_creator()
        self.source = Project.objects.create(creator=self.creator, name="Launch", status="completed")
        Task.objects.create(project=self.source, name="done", status="completed")
        Task.objects.create(project=self.source, name="doing", status="in-progress")
        Task.objects.create(project=self.source, name="todo", status="planning")

    def test_copy_starts_in_planning_with_nothing_started(self):
        copy = duplicate_project(self.source, self.creator)

        self.assertEqual(copy.status, "pending")
        self.assertEqual(copy.tasks.count(), 3)
        self.assertEqual(set(copy.tasks.values_list("status", flat=True)), {"planning"})

        data = ProjectSerializer(copy).data
        self.assertEqual(data["completed_tasks"], 0)
        self.assertEqual(data["in_progress_tasks"], 0)

    def test_endpoint_returns_a_project_with_no_started_tasks(self):
        api = APIClient()
        api.force_authenticate(user=self.creator)
        res = api.post(f"/api/v2/projects/{self.source.id}/duplicate/")
        self.assertEqual(res.status_code, 201)
        self.assertEqual(res.data["in_progress_tasks"], 0)
        self.assertEqual(res.data["completed_tasks"], 0)
        self.assertEqual(res.data["task_count"], 3)
