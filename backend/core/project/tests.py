"""
Tests for the project app.
Covers:
  1. Task model — multi-assignees (M2M)
  2. TaskSerializer — assignees field, assignee_names, notifications
  3. spawn_recurring_task — inherits M2M assignees
  4. API endpoints — create/update with assignees, talent visibility
  5. _get_task_for_user — access control with M2M
  6. Backward-compat: tasks with zero assignees work fine
  7. Serializer field exposure (recurrence — unchanged)
  8. API recurrence (unchanged)
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

def make_user(email, role="creator", full_name="Test User"):
    return User.objects.create_user(
        email=email, full_name=full_name, password="pass1234", role=role
    )

def make_creator(email="creator@test.com"):
    return make_user(email, role="creator", full_name="Test Creator")

def make_talent(email="talent@test.com", full_name="Test Talent"):
    return make_user(email, role="talent", full_name=full_name)

def make_project(creator):
    return Project.objects.create(creator=creator, name="Test Project", description="")

def make_task(project, assignees=None, **kwargs):
    defaults = dict(name="Task", status="planning")
    defaults.update(kwargs)
    task = Task.objects.create(project=project, **defaults)
    if assignees:
        task.assignees.set(assignees)
    return task


# ── 1. Multi-assignee model tests ─────────────────────────────────────────────

class TaskMultiAssigneeModelTest(TestCase):
    def setUp(self):
        self.creator = make_creator()
        self.project = make_project(self.creator)
        self.talent1 = make_talent("t1@test.com", "Talent One")
        self.talent2 = make_talent("t2@test.com", "Talent Two")

    def test_task_starts_with_zero_assignees(self):
        task = Task.objects.create(project=self.project, name="T")
        self.assertEqual(task.assignees.count(), 0)

    def test_can_add_single_assignee(self):
        task = Task.objects.create(project=self.project, name="T")
        task.assignees.add(self.talent1)
        self.assertEqual(task.assignees.count(), 1)
        self.assertIn(self.talent1, task.assignees.all())

    def test_can_add_multiple_assignees(self):
        task = Task.objects.create(project=self.project, name="T")
        task.assignees.set([self.talent1, self.talent2])
        self.assertEqual(task.assignees.count(), 2)
        self.assertIn(self.talent1, task.assignees.all())
        self.assertIn(self.talent2, task.assignees.all())

    def test_can_remove_one_assignee(self):
        task = Task.objects.create(project=self.project, name="T")
        task.assignees.set([self.talent1, self.talent2])
        task.assignees.remove(self.talent1)
        self.assertEqual(task.assignees.count(), 1)
        self.assertNotIn(self.talent1, task.assignees.all())

    def test_creator_can_be_an_assignee(self):
        task = Task.objects.create(project=self.project, name="T")
        task.assignees.add(self.creator)
        self.assertIn(self.creator, task.assignees.all())

    def test_old_single_assignee_field_absent(self):
        """The old FK `assignee` must be gone after the migration."""
        task = Task.objects.create(project=self.project, name="T")
        self.assertFalse(hasattr(task, "assignee"))


# ── 2. Serializer field tests ─────────────────────────────────────────────────

class TaskSerializerMultiAssigneeTest(TestCase):
    def setUp(self):
        self.creator = make_creator()
        self.project = make_project(self.creator)
        self.talent1 = make_talent("t1@test.com", "Alice")
        self.talent2 = make_talent("t2@test.com", "Bob")

    def test_assignees_exposed_as_id_list(self):
        task = Task.objects.create(project=self.project, name="T")
        task.assignees.set([self.talent1, self.talent2])
        data = TaskSerializer(task).data
        self.assertIn("assignees", data)
        self.assertIsInstance(data["assignees"], list)
        self.assertIn(str(self.talent1.id), [str(i) for i in data["assignees"]])
        self.assertIn(str(self.talent2.id), [str(i) for i in data["assignees"]])

    def test_assignee_names_exposed_as_name_list(self):
        task = Task.objects.create(project=self.project, name="T")
        task.assignees.set([self.talent1, self.talent2])
        data = TaskSerializer(task).data
        self.assertIn("assignee_names", data)
        self.assertIn("Alice", data["assignee_names"])
        self.assertIn("Bob", data["assignee_names"])

    def test_assignees_empty_for_unassigned_task(self):
        task = Task.objects.create(project=self.project, name="T")
        data = TaskSerializer(task).data
        self.assertEqual(data["assignees"], [])
        self.assertEqual(data["assignee_names"], [])

    def test_old_single_assignee_fields_absent_from_output(self):
        task = Task.objects.create(project=self.project, name="T")
        data = TaskSerializer(task).data
        self.assertNotIn("assignee", data)
        self.assertNotIn("assignee_name", data)

    def test_create_via_serializer_sets_assignees(self):
        s = TaskSerializer(data={
            "name": "Multi task",
            "status": "planning",
            "assignees": [self.talent1.id, self.talent2.id],
        })
        self.assertTrue(s.is_valid(), s.errors)
        task = s.save(project=self.project)
        self.assertEqual(task.assignees.count(), 2)

    def test_update_via_serializer_replaces_assignees(self):
        task = Task.objects.create(project=self.project, name="T")
        task.assignees.add(self.talent1)

        s = TaskSerializer(task, data={"assignees": [self.talent2.id]}, partial=True)
        self.assertTrue(s.is_valid(), s.errors)
        updated = s.save()
        ids = list(updated.assignees.values_list("id", flat=True))
        self.assertNotIn(self.talent1.id, ids)
        self.assertIn(self.talent2.id, ids)

    def test_create_with_no_assignees_is_valid(self):
        s = TaskSerializer(data={"name": "Empty", "status": "planning"})
        self.assertTrue(s.is_valid(), s.errors)
        task = s.save(project=self.project)
        self.assertEqual(task.assignees.count(), 0)

    def test_serializer_accepts_null_recurrence(self):
        task = Task.objects.create(project=self.project, name="T")
        s = TaskSerializer(task, data={"recurrence_type": None}, partial=True)
        self.assertTrue(s.is_valid(), s.errors)

    def test_serializer_rejects_invalid_recurrence_type(self):
        task = Task.objects.create(project=self.project, name="T")
        s = TaskSerializer(task, data={"recurrence_type": "hourly"}, partial=True)
        self.assertFalse(s.is_valid())
        self.assertIn("recurrence_type", s.errors)


# ── 3. Recurring task spawn with multi-assignees ──────────────────────────────

class SpawnNextOccurrenceTest(TestCase):
    def setUp(self):
        self.creator = make_creator()
        self.project = make_project(self.creator)
        self.talent1 = make_talent("t1@test.com", "Alice")
        self.talent2 = make_talent("t2@test.com", "Bob")

    def _complete(self, task):
        s = TaskSerializer(task, data={"status": "completed"}, partial=True)
        s.is_valid(raise_exception=True)
        return s.save()

    def test_daily_spawn(self):
        task = Task.objects.create(project=self.project, name="S", deadline=date(2026, 6, 10), recurrence_type="daily")
        self._complete(task)
        spawned = Task.objects.exclude(pk=task.pk).get(project=self.project)
        self.assertEqual(spawned.deadline, date(2026, 6, 11))
        self.assertEqual(spawned.status, "planning")
        self.assertEqual(spawned.recurrence_type, "daily")

    def test_weekly_spawn(self):
        task = Task.objects.create(project=self.project, deadline=date(2026, 6, 10), recurrence_type="weekly")
        self._complete(task)
        spawned = Task.objects.exclude(pk=task.pk).get(project=self.project)
        self.assertEqual(spawned.deadline, date(2026, 6, 17))

    def test_monthly_spawn(self):
        task = Task.objects.create(project=self.project, deadline=date(2026, 6, 30), recurrence_type="monthly")
        self._complete(task)
        spawned = Task.objects.exclude(pk=task.pk).get(project=self.project)
        self.assertEqual(spawned.deadline, date(2026, 7, 30))

    def test_monthly_clamps_month_end(self):
        task = Task.objects.create(project=self.project, deadline=date(2026, 1, 31), recurrence_type="monthly")
        self._complete(task)
        spawned = Task.objects.exclude(pk=task.pk).get(project=self.project)
        self.assertEqual(spawned.deadline, date(2026, 2, 28))

    def test_custom_spawn(self):
        task = Task.objects.create(project=self.project, deadline=date(2026, 6, 10), recurrence_type="custom", recurrence_days=14)
        self._complete(task)
        spawned = Task.objects.exclude(pk=task.pk).get(project=self.project)
        self.assertEqual(spawned.deadline, date(2026, 6, 24))

    def test_spawned_task_inherits_all_assignees(self):
        """Spawned recurring task must carry over the full M2M assignee set."""
        task = Task.objects.create(project=self.project, name="Morning Standup", deadline=date(2026, 6, 10), recurrence_type="daily")
        task.assignees.set([self.talent1, self.talent2])
        self._complete(task)

        spawned = Task.objects.exclude(pk=task.pk).get(project=self.project)
        self.assertEqual(spawned.name, "Morning Standup")
        self.assertEqual(spawned.assignees.count(), 2)
        self.assertIn(self.talent1, spawned.assignees.all())
        self.assertIn(self.talent2, spawned.assignees.all())

    def test_spawned_task_with_no_assignees(self):
        task = Task.objects.create(project=self.project, deadline=date(2026, 6, 10), recurrence_type="daily")
        self._complete(task)
        spawned = Task.objects.exclude(pk=task.pk).get(project=self.project)
        self.assertEqual(spawned.assignees.count(), 0)

    def test_spawned_task_inherits_task_time(self):
        from datetime import time
        task = Task.objects.create(project=self.project, deadline=date(2026, 6, 10), task_time=time(8, 0), recurrence_type="daily")
        self._complete(task)
        spawned = Task.objects.exclude(pk=task.pk).get(project=self.project)
        self.assertEqual(spawned.task_time.hour, 8)

    def test_no_spawn_on_in_progress_transition(self):
        task = Task.objects.create(project=self.project, deadline=date(2026, 6, 10), recurrence_type="daily")
        s = TaskSerializer(task, data={"status": "in-progress"}, partial=True)
        s.is_valid(raise_exception=True)
        s.save()
        self.assertEqual(Task.objects.filter(project=self.project).count(), 1)

    def test_no_spawn_when_already_completed(self):
        task = Task.objects.create(project=self.project, deadline=date(2026, 6, 10), recurrence_type="daily", status="completed")
        s = TaskSerializer(task, data={"name": "Updated"}, partial=True)
        s.is_valid(raise_exception=True)
        s.save()
        self.assertEqual(Task.objects.filter(project=self.project).count(), 1)

    def test_custom_without_days_does_not_spawn(self):
        task = Task.objects.create(project=self.project, deadline=date(2026, 6, 10), recurrence_type="custom", recurrence_days=None)
        self._complete(task)
        self.assertEqual(Task.objects.filter(project=self.project).count(), 1)

    def test_spawn_uses_today_if_no_deadline(self):
        task = Task.objects.create(project=self.project, deadline=None, recurrence_type="daily")
        self._complete(task)
        spawned = Task.objects.exclude(pk=task.pk).get(project=self.project)
        self.assertEqual(spawned.deadline, date.today() + timedelta(days=1))

    def test_recurring_chain_spawns_again(self):
        task = Task.objects.create(project=self.project, deadline=date(2026, 6, 1), recurrence_type="daily")
        self._complete(task)
        second = Task.objects.exclude(pk=task.pk).get()
        self._complete(second)
        self.assertEqual(Task.objects.count(), 3)
        third = Task.objects.order_by("-created_at").first()
        self.assertEqual(third.deadline, date(2026, 6, 3))


# ── 4. API integration — multi-assignees ──────────────────────────────────────

class TaskAPIMultiAssigneeTest(TestCase):
    def setUp(self):
        self.creator = make_creator()
        self.project = make_project(self.creator)
        self.talent1 = make_talent("t1@test.com", "Alice")
        self.talent2 = make_talent("t2@test.com", "Bob")
        self.client = APIClient()
        self.client.force_authenticate(user=self.creator)

    def _create_url(self):
        return f"/api/v2/projects/{self.project.id}/tasks/"

    def _task_url(self, task):
        return f"/api/v2/tasks/{task.id}/"

    def test_create_task_with_single_assignee(self):
        resp = self.client.post(self._create_url(), {
            "name": "Solo task", "status": "planning",
            "assignees": [self.talent1.id],
        }, format="json")
        self.assertEqual(resp.status_code, 201, resp.data)
        task = Task.objects.get(name="Solo task")
        self.assertEqual(task.assignees.count(), 1)

    def test_create_task_with_multiple_assignees(self):
        resp = self.client.post(self._create_url(), {
            "name": "Team task", "status": "planning",
            "assignees": [self.talent1.id, self.talent2.id],
        }, format="json")
        self.assertEqual(resp.status_code, 201, resp.data)
        self.assertEqual(Task.objects.get(name="Team task").assignees.count(), 2)

    def test_create_task_with_no_assignees(self):
        resp = self.client.post(self._create_url(), {"name": "Unassigned", "status": "planning"}, format="json")
        self.assertEqual(resp.status_code, 201)
        self.assertEqual(Task.objects.get(name="Unassigned").assignees.count(), 0)

    def test_response_includes_assignees_and_assignee_names(self):
        resp = self.client.post(self._create_url(), {
            "name": "Named", "status": "planning",
            "assignees": [self.talent1.id],
        }, format="json")
        self.assertEqual(resp.status_code, 201)
        self.assertIn("assignees", resp.data)
        self.assertIn("assignee_names", resp.data)
        self.assertEqual(resp.data["assignee_names"], ["Alice"])

    def test_response_does_not_include_old_assignee_field(self):
        resp = self.client.post(self._create_url(), {"name": "T", "status": "planning"}, format="json")
        self.assertEqual(resp.status_code, 201)
        self.assertNotIn("assignee", resp.data)
        self.assertNotIn("assignee_name", resp.data)

    def test_patch_replaces_assignees(self):
        task = make_task(self.project, assignees=[self.talent1])
        resp = self.client.patch(self._task_url(task), {"assignees": [self.talent2.id]}, format="json")
        self.assertEqual(resp.status_code, 200, resp.data)
        task.refresh_from_db()
        self.assertNotIn(self.talent1, task.assignees.all())
        self.assertIn(self.talent2, task.assignees.all())

    def test_patch_clears_assignees(self):
        task = make_task(self.project, assignees=[self.talent1])
        resp = self.client.patch(self._task_url(task), {"assignees": []}, format="json")
        self.assertEqual(resp.status_code, 200)
        task.refresh_from_db()
        self.assertEqual(task.assignees.count(), 0)

    def test_talent_sees_only_their_assigned_tasks(self):
        mine = make_task(self.project, name="Mine", assignees=[self.talent1])
        other = make_task(self.project, name="Not mine", assignees=[self.talent2])

        c = APIClient()
        c.force_authenticate(user=self.talent1)
        resp = c.get(f"/api/v2/projects/{self.project.id}/tasks/")
        names = [t["name"] for t in resp.data]
        self.assertIn("Mine", names)
        self.assertNotIn("Not mine", names)

    def test_talent_assigned_to_multiple_tasks_sees_all(self):
        make_task(self.project, name="Task A", assignees=[self.talent1])
        make_task(self.project, name="Task B", assignees=[self.talent1])

        c = APIClient()
        c.force_authenticate(user=self.talent1)
        resp = c.get(f"/api/v2/projects/{self.project.id}/tasks/")
        names = [t["name"] for t in resp.data]
        self.assertIn("Task A", names)
        self.assertIn("Task B", names)

    def test_creator_sees_all_tasks(self):
        make_task(self.project, name="A", assignees=[self.talent1])
        make_task(self.project, name="B")  # unassigned
        resp = self.client.get(self._create_url())
        names = [t["name"] for t in resp.data]
        self.assertIn("A", names)
        self.assertIn("B", names)

    def test_talent_cannot_create_task(self):
        c = APIClient()
        c.force_authenticate(user=self.talent1)
        resp = c.post(self._create_url(), {"name": "Nope", "status": "planning"}, format="json")
        self.assertIn(resp.status_code, [403, 404])

    def test_unauthenticated_cannot_access(self):
        resp = APIClient().post(self._create_url(), {"name": "T"}, format="json")
        self.assertEqual(resp.status_code, 401)


# ── 5. Access control (_get_task_for_user) ────────────────────────────────────

class TaskAccessControlTest(TestCase):
    def setUp(self):
        self.creator = make_creator()
        self.project = make_project(self.creator)
        self.talent1 = make_talent("t1@test.com", "Alice")
        self.talent2 = make_talent("t2@test.com", "Bob")

    def test_assigned_talent_can_fetch_task_detail(self):
        task = make_task(self.project, assignees=[self.talent1])
        c = APIClient()
        c.force_authenticate(user=self.talent1)
        self.assertEqual(c.get(f"/api/v2/tasks/{task.id}/").status_code, 200)

    def test_unassigned_talent_gets_404(self):
        task = make_task(self.project, assignees=[self.talent1])
        c = APIClient()
        c.force_authenticate(user=self.talent2)
        self.assertEqual(c.get(f"/api/v2/tasks/{task.id}/").status_code, 404)

    def test_all_assignees_can_view_shared_task(self):
        task = make_task(self.project, assignees=[self.talent1, self.talent2])
        for talent in [self.talent1, self.talent2]:
            c = APIClient()
            c.force_authenticate(user=talent)
            self.assertEqual(c.get(f"/api/v2/tasks/{task.id}/").status_code, 200)

    def test_unassigned_task_invisible_to_talent(self):
        task = make_task(self.project)  # no assignees
        c = APIClient()
        c.force_authenticate(user=self.talent1)
        self.assertEqual(c.get(f"/api/v2/tasks/{task.id}/").status_code, 404)

    def test_creator_can_always_fetch_any_task(self):
        task = make_task(self.project)
        c = APIClient()
        c.force_authenticate(user=self.creator)
        self.assertEqual(c.get(f"/api/v2/tasks/{task.id}/").status_code, 200)

    def test_talent_cannot_modify_task(self):
        task = make_task(self.project, assignees=[self.talent1])
        c = APIClient()
        c.force_authenticate(user=self.talent1)
        resp = c.patch(f"/api/v2/tasks/{task.id}/", {"name": "Hijack"}, format="json")
        self.assertEqual(resp.status_code, 403)


# ── 6. API recurrence (unchanged) ─────────────────────────────────────────────

class TaskAPIRecurrenceTest(TestCase):
    def setUp(self):
        self.creator = make_creator()
        self.project = make_project(self.creator)
        self.client = APIClient()
        self.client.force_authenticate(user=self.creator)

    def _url(self):
        return f"/api/v2/projects/{self.project.id}/tasks/"

    def test_create_with_recurrence_via_api(self):
        resp = self.client.post(self._url(), {
            "name": "Daily Sync", "status": "planning",
            "deadline": "2026-06-15", "task_time": "09:00:00",
            "recurrence_type": "daily",
        }, format="json")
        self.assertEqual(resp.status_code, 201, resp.data)
        self.assertEqual(Task.objects.get(name="Daily Sync").recurrence_type, "daily")

    def test_recurrence_fields_in_response(self):
        resp = self.client.post(self._url(), {
            "name": "Weekly Report", "status": "planning",
            "recurrence_type": "weekly",
        }, format="json")
        self.assertEqual(resp.status_code, 201)
        self.assertEqual(resp.data["recurrence_type"], "weekly")

    def test_completing_recurring_via_api_spawns(self):
        task = Task.objects.create(
            project=self.project, name="Standup",
            deadline=date(2026, 6, 10), recurrence_type="daily",
        )
        resp = self.client.patch(f"/api/v2/tasks/{task.id}/", {"status": "completed"}, format="json")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(Task.objects.filter(project=self.project).count(), 2)

    def test_completing_non_recurring_via_api_no_spawn(self):
        task = Task.objects.create(project=self.project, name="One-off", deadline=date(2026, 6, 10))
        self.client.patch(f"/api/v2/tasks/{task.id}/", {"status": "completed"}, format="json")
        self.assertEqual(Task.objects.filter(project=self.project).count(), 1)

    def test_custom_recurrence_days_stored(self):
        resp = self.client.post(self._url(), {
            "name": "Biweekly", "status": "planning",
            "recurrence_type": "custom", "recurrence_days": 14,
        }, format="json")
        self.assertEqual(resp.status_code, 201)
        self.assertEqual(Task.objects.get(name="Biweekly").recurrence_days, 14)
