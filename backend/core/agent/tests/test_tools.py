import datetime as dt
import uuid
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.test import SimpleTestCase, TestCase

from agent.tools import ToolError, run_tool, tool_specs
from agent.tools.base import MAX_ROWS, MAX_TEXT, validate_args
from project.models import PersonalTask, Project, Task

User = get_user_model()
TODAY = dt.date(2026, 10, 31)


def make_user(email, role="creator"):
    return User.objects.create_user(
        email=email, full_name=email, password="Str0ng-pass-123", role=role, email_verified=True
    )


def day(offset):
    return TODAY + dt.timedelta(days=offset)


class ToolTestCase(TestCase):
    """Two creators, each with a project and tasks, so every tool can be checked for leakage."""

    def setUp(self):
        patcher = patch("agent.tools.projects.timezone.localdate", return_value=TODAY)
        patcher.start()
        self.addCleanup(patcher.stop)

        self.a = make_user("a@test.com")
        self.b = make_user("b@test.com")
        self.project_a = Project.objects.create(creator=self.a, name="Alpha site", status="in-progress")
        self.project_b = Project.objects.create(creator=self.b, name="Bravo secret", status="pending")
        self.task_a = Task.objects.create(project=self.project_a, name="Write copy", deadline=day(2))
        self.task_b = Task.objects.create(project=self.project_b, name="Bravo task", deadline=day(1))

    def names(self, result):
        return [item["name"] for item in result["items"]]


class ScopingTests(ToolTestCase):
    def test_list_projects_only_returns_the_callers_projects(self):
        self.assertEqual(self.names(run_tool(self.a, "list_projects", {})), ["Alpha site"])
        self.assertEqual(self.names(run_tool(self.b, "list_projects", {})), ["Bravo secret"])

    def test_list_tasks_only_returns_tasks_in_the_callers_projects(self):
        self.assertEqual(self.names(run_tool(self.a, "list_tasks", {})), ["Write copy"])

    def test_list_tasks_with_another_creators_project_id_returns_nothing(self):
        result = run_tool(self.a, "list_tasks", {"project_id": str(self.project_b.id)})
        self.assertEqual(result["items"], [])

    def test_list_deadlines_only_returns_the_callers_tasks_and_personal_tasks(self):
        PersonalTask.objects.create(owner=self.a, name="A personal", deadline=day(1))
        PersonalTask.objects.create(owner=self.b, name="B personal", deadline=day(1))
        self.assertEqual(self.names(run_tool(self.a, "list_deadlines", {})), ["A personal", "Write copy"])

    def test_get_project_for_another_creator_looks_the_same_as_a_missing_one(self):
        with self.assertRaises(ToolError) as other:
            run_tool(self.a, "get_project", {"project_id": str(self.project_b.id)})
        with self.assertRaises(ToolError) as missing:
            run_tool(self.a, "get_project", {"project_id": str(uuid.uuid4())})
        with self.assertRaises(ToolError) as malformed:
            run_tool(self.a, "get_project", {"project_id": "not-a-uuid"})
        self.assertEqual(str(other.exception), str(missing.exception))
        self.assertEqual(str(other.exception), str(malformed.exception))
        self.assertNotIn("Bravo", str(other.exception))

    def test_a_user_id_argument_is_rejected_so_the_model_cannot_pick_whose_data_to_read(self):
        with self.assertRaises(ToolError):
            run_tool(self.a, "list_projects", {"user_id": self.b.id})

    def test_non_creators_see_nothing(self):
        talent = make_user("t@test.com", role="talent")
        self.task_a.assignees.add(talent)
        self.assertEqual(run_tool(talent, "list_projects", {})["items"], [])
        self.assertEqual(run_tool(talent, "list_tasks", {})["items"], [])


class BehaviourTests(ToolTestCase):
    def test_get_project_summarises_tasks_by_status(self):
        Task.objects.create(project=self.project_a, name="Done thing", status="completed")
        result = run_tool(self.a, "get_project", {"project_id": str(self.project_a.id)})
        self.assertEqual(result["name"], "Alpha site")
        self.assertEqual(result["tasks_by_status"], {"planning": 1, "completed": 1})

    def test_get_project_clips_long_descriptions(self):
        self.project_a.description = "x" * 1000
        self.project_a.save()
        result = run_tool(self.a, "get_project", {"project_id": str(self.project_a.id)})
        self.assertEqual(len(result["description"]), MAX_TEXT + 1)

    def test_list_projects_filters_by_status(self):
        Project.objects.create(creator=self.a, name="Old", status="completed")
        result = run_tool(self.a, "list_projects", {"status": "completed"})
        self.assertEqual(self.names(result), ["Old"])

    def test_overdue_means_past_deadline_and_not_completed(self):
        Task.objects.create(project=self.project_a, name="Late", deadline=day(-3))
        Task.objects.create(project=self.project_a, name="Late but done", deadline=day(-3), status="completed")
        Task.objects.create(project=self.project_a, name="Due today", deadline=TODAY)
        result = run_tool(self.a, "list_tasks", {"overdue": True})
        self.assertEqual(self.names(result), ["Late"])
        self.assertTrue(result["items"][0]["overdue"])

    def test_deadlines_respect_the_window_and_flag_overdue(self):
        Task.objects.create(project=self.project_a, name="Late", deadline=day(-1))
        Task.objects.create(project=self.project_a, name="Far away", deadline=day(30))
        Task.objects.create(project=self.project_a, name="Done", deadline=day(1), status="completed")
        result = run_tool(self.a, "list_deadlines", {"days": 7})
        self.assertEqual(self.names(result), ["Late", "Write copy"])
        self.assertEqual([i["overdue"] for i in result["items"]], [True, False])

    def test_deadlines_default_to_two_weeks(self):
        Task.objects.create(project=self.project_a, name="Day 14", deadline=day(14))
        Task.objects.create(project=self.project_a, name="Day 15", deadline=day(15))
        names = self.names(run_tool(self.a, "list_deadlines", {}))
        self.assertIn("Day 14", names)
        self.assertNotIn("Day 15", names)

    def test_results_are_capped_and_flagged_truncated(self):
        for i in range(MAX_ROWS + 5):
            Project.objects.create(creator=self.a, name=f"P{i}")
        result = run_tool(self.a, "list_projects", {})
        self.assertEqual(len(result["items"]), MAX_ROWS)
        self.assertTrue(result["truncated"])

    def test_small_results_are_not_flagged_truncated(self):
        self.assertFalse(run_tool(self.a, "list_projects", {})["truncated"])


class ValidationTests(SimpleTestCase):
    SCHEMA = {
        "type": "object",
        "properties": {
            "status": {"type": "string", "enum": ["a", "b"]},
            "days": {"type": "integer", "minimum": 0, "maximum": 365},
            "overdue": {"type": "boolean"},
            "project_id": {"type": "string"},
        },
        "required": ["project_id"],
    }

    def invalid(self, args):
        with self.assertRaises(ToolError):
            validate_args(self.SCHEMA, args)

    def test_accepts_valid_arguments(self):
        args = {"project_id": "x", "status": "a", "days": 7, "overdue": True}
        self.assertEqual(validate_args(self.SCHEMA, args), args)

    def test_rejects_missing_required_unknown_and_non_object_arguments(self):
        self.invalid({})
        self.invalid({"project_id": "x", "extra": 1})
        self.invalid(["project_id"])

    def test_rejects_wrong_types_including_bool_as_integer(self):
        self.invalid({"project_id": 5})
        self.invalid({"project_id": "x", "days": "7"})
        self.invalid({"project_id": "x", "days": True})
        self.invalid({"project_id": "x", "overdue": "yes"})

    def test_rejects_values_outside_enum_and_range(self):
        self.invalid({"project_id": "x", "status": "c"})
        self.invalid({"project_id": "x", "days": -1})
        self.invalid({"project_id": "x", "days": 366})


class RegistryTests(SimpleTestCase):
    def test_unknown_tool_is_a_recoverable_error(self):
        with self.assertRaises(ToolError):
            run_tool(None, "drop_database", {})

    def test_specs_are_in_openai_function_format(self):
        specs = {s["function"]["name"]: s for s in tool_specs()}
        self.assertEqual(
            set(specs),
            {
                "list_projects", "get_project", "list_tasks", "list_deadlines", "list_team",
                "list_notifications", "list_clients", "get_client",
                "create_project", "create_task", "update_task",
                "get_analytics", "search_docs", "search_library", "create_doc", "create_form",
                "list_forms", "get_form", "update_form", "create_onboarding_form",
            },
        )
        for spec in specs.values():
            self.assertEqual(spec["type"], "function")
            self.assertEqual(spec["function"]["parameters"]["type"], "object")
            self.assertTrue(spec["function"]["description"])

    def test_no_read_tool_accepts_a_user_argument(self):
        for spec in tool_specs():
            self.assertNotIn("user_id", spec["function"]["parameters"]["properties"])
            self.assertNotIn("user", spec["function"]["parameters"]["properties"])
