"""
Comprehensive tests for recurring task feature.
Covers: model fields, serializer spawn logic, API endpoints, edge cases.
"""
from datetime import date, timedelta
from django.test import TestCase
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from rest_framework import status

from .models import Project, Task
from .serializers import TaskSerializer

User = get_user_model()


# ── Helpers ────────────────────────────────────────────────────────────────────

def make_creator(email="creator@test.com"):
    return User.objects.create_user(
        email=email,
        full_name="Test Creator",
        password="pass1234",
        role="creator",
    )

def make_project(creator):
    return Project.objects.create(
        creator=creator,
        name="Test Project",
        description="",
    )

def make_task(project, **kwargs):
    defaults = dict(name="Task", status="planning")
    defaults.update(kwargs)
    return Task.objects.create(project=project, **defaults)


# ── 1. Model field tests ───────────────────────────────────────────────────────

class TaskModelFieldsTest(TestCase):
    def setUp(self):
        self.creator = make_creator()
        self.project = make_project(self.creator)

    def test_new_fields_default_to_null(self):
        task = make_task(self.project)
        self.assertIsNone(task.task_time)
        self.assertIsNone(task.recurrence_type)
        self.assertIsNone(task.recurrence_days)

    def test_can_save_all_recurrence_types(self):
        for rtype in ("daily", "weekly", "monthly", "custom"):
            task = make_task(self.project, recurrence_type=rtype)
            task.refresh_from_db()
            self.assertEqual(task.recurrence_type, rtype)

    def test_can_save_task_time(self):
        from datetime import time
        task = make_task(self.project, task_time=time(9, 30))
        task.refresh_from_db()
        self.assertEqual(task.task_time.hour, 9)
        self.assertEqual(task.task_time.minute, 30)

    def test_recurrence_days_stored(self):
        task = make_task(self.project, recurrence_type="custom", recurrence_days=5)
        task.refresh_from_db()
        self.assertEqual(task.recurrence_days, 5)


# ── 2. Spawn logic unit tests ──────────────────────────────────────────────────

class SpawnNextOccurrenceTest(TestCase):
    """
    Tests _spawn_next_occurrence indirectly via serializer.update().
    Completing a recurring task via the serializer must produce a new
    planning-status task with the correct next deadline.
    """
    def setUp(self):
        self.creator = make_creator()
        self.project = make_project(self.creator)

    def _complete_task(self, task):
        s = TaskSerializer(task, data={"status": "completed"}, partial=True)
        s.is_valid(raise_exception=True)
        return s.save()

    def test_daily_spawn(self):
        base = date(2026, 6, 10)
        task = make_task(self.project, deadline=base, recurrence_type="daily")
        self._complete_task(task)

        spawned = Task.objects.exclude(pk=task.pk).get(project=self.project)
        self.assertEqual(spawned.deadline, date(2026, 6, 11))
        self.assertEqual(spawned.status, "planning")
        self.assertEqual(spawned.recurrence_type, "daily")

    def test_weekly_spawn(self):
        base = date(2026, 6, 10)
        task = make_task(self.project, deadline=base, recurrence_type="weekly")
        self._complete_task(task)

        spawned = Task.objects.exclude(pk=task.pk).get(project=self.project)
        self.assertEqual(spawned.deadline, date(2026, 6, 17))

    def test_monthly_spawn(self):
        base = date(2026, 6, 30)
        task = make_task(self.project, deadline=base, recurrence_type="monthly")
        self._complete_task(task)

        spawned = Task.objects.exclude(pk=task.pk).get(project=self.project)
        self.assertEqual(spawned.deadline, date(2026, 7, 30))

    def test_monthly_spawn_handles_month_end(self):
        """Jan 31 + 1 month → Feb 28 (dateutil clamps, not overflows)."""
        base = date(2026, 1, 31)
        task = make_task(self.project, deadline=base, recurrence_type="monthly")
        self._complete_task(task)

        spawned = Task.objects.exclude(pk=task.pk).get(project=self.project)
        self.assertEqual(spawned.deadline, date(2026, 2, 28))

    def test_custom_spawn(self):
        base = date(2026, 6, 10)
        task = make_task(self.project, deadline=base, recurrence_type="custom", recurrence_days=14)
        self._complete_task(task)

        spawned = Task.objects.exclude(pk=task.pk).get(project=self.project)
        self.assertEqual(spawned.deadline, date(2026, 6, 24))

    def test_custom_with_no_days_does_not_spawn(self):
        """custom without recurrence_days → no spawn."""
        task = make_task(self.project, deadline=date(2026, 6, 10), recurrence_type="custom", recurrence_days=None)
        self._complete_task(task)
        self.assertEqual(Task.objects.filter(project=self.project).count(), 1)

    def test_no_recurrence_no_spawn(self):
        task = make_task(self.project, deadline=date(2026, 6, 10))
        self._complete_task(task)
        self.assertEqual(Task.objects.filter(project=self.project).count(), 1)

    def test_spawned_task_inherits_name_and_assignee(self):
        task = make_task(
            self.project,
            name="Morning Standup",
            deadline=date(2026, 6, 10),
            recurrence_type="daily",
            assignee=self.creator,
        )
        self._complete_task(task)

        spawned = Task.objects.exclude(pk=task.pk).get(project=self.project)
        self.assertEqual(spawned.name, "Morning Standup")
        self.assertEqual(spawned.assignee, self.creator)

    def test_spawned_task_inherits_task_time(self):
        from datetime import time
        task = make_task(
            self.project,
            deadline=date(2026, 6, 10),
            task_time=time(8, 0),
            recurrence_type="daily",
        )
        self._complete_task(task)

        spawned = Task.objects.exclude(pk=task.pk).get(project=self.project)
        self.assertIsNotNone(spawned.task_time)
        self.assertEqual(spawned.task_time.hour, 8)

    def test_no_spawn_on_in_progress_transition(self):
        """Moving to in-progress must never spawn."""
        task = make_task(self.project, deadline=date(2026, 6, 10), recurrence_type="daily")
        s = TaskSerializer(task, data={"status": "in-progress"}, partial=True)
        s.is_valid(raise_exception=True)
        s.save()
        self.assertEqual(Task.objects.filter(project=self.project).count(), 1)

    def test_no_spawn_when_already_completed(self):
        """Patching a field on an already-completed task must not spawn again."""
        task = make_task(
            self.project,
            deadline=date(2026, 6, 10),
            recurrence_type="daily",
            status="completed",
        )
        s = TaskSerializer(task, data={"name": "Updated"}, partial=True)
        s.is_valid(raise_exception=True)
        s.save()
        self.assertEqual(Task.objects.filter(project=self.project).count(), 1)

    def test_spawn_uses_today_if_no_deadline(self):
        """Task with no deadline bases next date on today."""
        task = make_task(self.project, deadline=None, recurrence_type="daily")
        self._complete_task(task)

        spawned = Task.objects.exclude(pk=task.pk).get(project=self.project)
        self.assertEqual(spawned.deadline, date.today() + timedelta(days=1))

    def test_spawned_task_is_not_itself_completed(self):
        """The auto-spawned task starts in planning, not completed."""
        task = make_task(self.project, deadline=date(2026, 6, 10), recurrence_type="weekly")
        self._complete_task(task)

        spawned = Task.objects.exclude(pk=task.pk).get(project=self.project)
        self.assertEqual(spawned.status, "planning")

    def test_completing_spawned_task_spawns_again(self):
        """Recurring chain: complete task → spawned task → complete that → third task."""
        task = make_task(self.project, deadline=date(2026, 6, 1), recurrence_type="daily")
        self._complete_task(task)
        self.assertEqual(Task.objects.count(), 2)

        second = Task.objects.exclude(pk=task.pk).get()
        self._complete_task(second)
        self.assertEqual(Task.objects.count(), 3)

        third = Task.objects.order_by("-created_at").first()
        self.assertEqual(third.deadline, date(2026, 6, 3))


# ── 3. API endpoint integration tests ─────────────────────────────────────────

class TaskAPIRecurrenceTest(TestCase):
    def setUp(self):
        self.creator = make_creator()
        self.project = make_project(self.creator)
        self.client = APIClient()
        self.client.force_authenticate(user=self.creator)

    def _create_url(self):
        return f"/api/v2/projects/{self.project.id}/tasks/"

    def _task_url(self, task):
        return f"/api/v2/tasks/{task.id}/"

    def test_create_task_with_recurrence_via_api(self):
        payload = {
            "name": "Daily Sync",
            "status": "planning",
            "deadline": "2026-06-15",
            "task_time": "09:00:00",
            "recurrence_type": "daily",
        }
        resp = self.client.post(self._create_url(), payload, format="json")
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED, resp.data)

        task = Task.objects.get(name="Daily Sync")
        self.assertEqual(task.recurrence_type, "daily")
        self.assertIsNotNone(task.task_time)

    def test_recurrence_fields_returned_in_response(self):
        payload = {
            "name": "Weekly Report",
            "status": "planning",
            "deadline": "2026-06-15",
            "task_time": "08:00:00",
            "recurrence_type": "weekly",
        }
        resp = self.client.post(self._create_url(), payload, format="json")
        self.assertEqual(resp.status_code, 201)
        self.assertIn("recurrence_type", resp.data)
        self.assertEqual(resp.data["recurrence_type"], "weekly")
        self.assertIn("task_time", resp.data)

    def test_patch_completed_spawns_task(self):
        task = make_task(
            self.project,
            name="Daily Standup",
            deadline=date(2026, 6, 10),
            recurrence_type="daily",
        )
        resp = self.client.patch(self._task_url(task), {"status": "completed"}, format="json")
        self.assertEqual(resp.status_code, 200, resp.data)

        tasks = Task.objects.filter(project=self.project)
        self.assertEqual(tasks.count(), 2)

        spawned = tasks.exclude(pk=task.pk).first()
        self.assertEqual(spawned.status, "planning")
        self.assertEqual(spawned.deadline, date(2026, 6, 11))

    def test_patch_completed_non_recurring_no_spawn(self):
        task = make_task(self.project, name="One-off", deadline=date(2026, 6, 10))
        resp = self.client.patch(self._task_url(task), {"status": "completed"}, format="json")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(Task.objects.filter(project=self.project).count(), 1)

    def test_create_custom_recurrence_stores_days(self):
        payload = {
            "name": "Biweekly Review",
            "status": "planning",
            "recurrence_type": "custom",
            "recurrence_days": 14,
        }
        resp = self.client.post(self._create_url(), payload, format="json")
        self.assertEqual(resp.status_code, 201)
        task = Task.objects.get(name="Biweekly Review")
        self.assertEqual(task.recurrence_days, 14)

    def test_talent_cannot_create_task(self):
        talent = User.objects.create_user(
            email="talent@test.com", full_name="Talent", password="x", role="talent"
        )
        c = APIClient()
        c.force_authenticate(user=talent)
        resp = c.post(self._create_url(), {"name": "T", "status": "planning"}, format="json")
        self.assertIn(resp.status_code, [403, 404])

    def test_unauthenticated_cannot_access(self):
        c = APIClient()
        resp = c.post(self._create_url(), {"name": "T"}, format="json")
        self.assertEqual(resp.status_code, 401)


# ── 4. Serializer field exposure tests ────────────────────────────────────────

class TaskSerializerFieldsTest(TestCase):
    def setUp(self):
        from datetime import time
        self.creator = make_creator()
        self.project = make_project(self.creator)
        self.task = make_task(
            self.project,
            deadline=date(2026, 6, 15),
            task_time=time(10, 0),
            recurrence_type="weekly",
        )

    def test_serializer_exposes_recurrence_fields(self):
        data = TaskSerializer(self.task).data
        self.assertIn("task_time", data)
        self.assertIn("recurrence_type", data)
        self.assertIn("recurrence_days", data)
        self.assertEqual(data["recurrence_type"], "weekly")

    def test_serializer_accepts_null_recurrence(self):
        s = TaskSerializer(self.task, data={"recurrence_type": None}, partial=True)
        self.assertTrue(s.is_valid(), s.errors)

    def test_serializer_rejects_invalid_recurrence_type(self):
        s = TaskSerializer(self.task, data={"recurrence_type": "hourly"}, partial=True)
        self.assertFalse(s.is_valid())
        self.assertIn("recurrence_type", s.errors)
