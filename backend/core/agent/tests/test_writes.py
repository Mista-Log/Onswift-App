"""The write tools: the model can only propose them, and every change is checked against current data."""
import uuid

from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings

from agent.tools import ToolError, run_tool, tool_specs
from agent.tools.base import execute_write, propose_tool
from project.models import Project, Task

User = get_user_model()
FAST_HASH = override_settings(PASSWORD_HASHERS=["django.contrib.auth.hashers.MD5PasswordHasher"])
WRITE_TOOLS = ["create_project", "create_task", "update_task"]


def make_user(email, role="creator"):
    return User.objects.create_user(
        email=email, full_name=email, password="Str0ng-pass-123", role=role, email_verified=True
    )


@FAST_HASH
class WriteToolTests(TestCase):
    def setUp(self):
        self.a = make_user("a@test.com")
        self.b = make_user("b@test.com")
        self.project_a = Project.objects.create(creator=self.a, name="Alpha site")
        self.project_b = Project.objects.create(creator=self.b, name="Bravo secret")
        self.task_a = Task.objects.create(project=self.project_a, name="Write copy")
        self.task_b = Task.objects.create(project=self.project_b, name="Bravo task")

    def counts(self):
        return Project.objects.count(), Task.objects.count()

    def valid_args(self):
        return {
            "create_project": {"name": "New site", "due_date": "2026-12-01"},
            "create_task": {"project_id": str(self.project_a.id), "name": "New task"},
            "update_task": {"task_id": str(self.task_a.id), "name": "Renamed"},
        }

    # --- the model can never perform a write --------------------------------------------------

    def test_the_model_path_refuses_every_write_tool_and_changes_nothing(self):
        before = self.counts()
        for name, args in self.valid_args().items():
            with self.assertRaises(ToolError, msg=name):
                run_tool(self.a, name, args)
        self.assertEqual(self.counts(), before)
        self.task_a.refresh_from_db()
        self.assertEqual(self.task_a.name, "Write copy")

    def test_proposing_changes_nothing_and_describes_the_change(self):
        before = self.counts()
        _, summary = propose_tool(self.a, "create_task", {**self.valid_args()["create_task"], "deadline": "2026-12-01"})
        self.assertEqual(self.counts(), before)
        self.assertIn("New task", summary)
        self.assertIn("Alpha site", summary)
        self.assertIn("2026-12-01", summary)

    def test_every_write_tool_tells_the_model_it_only_proposes(self):
        specs = {s["function"]["name"]: s["function"]["description"] for s in tool_specs()}
        for name in WRITE_TOOLS:
            self.assertIn("PROPOSES", specs[name])

    # --- asking for what is missing, instead of guessing --------------------------------------

    def test_every_write_tool_says_what_it_needs_from_the_user(self):
        specs = {s["function"]["name"]: s["function"] for s in tool_specs()}
        writes = {name for name, f in specs.items() if "PROPOSES" in f["description"]}
        self.assertEqual(writes, {"create_project", "create_task", "update_task", "create_doc", "create_form", "update_form", "create_onboarding_form"})
        for name in writes:
            self.assertIn("Needs from the user:", specs[name]["description"], name)
            self.assertIn("never invent a value", specs[name]["description"], name)

    def test_a_project_needs_a_deadline_and_the_model_is_told_to_ask_for_it(self):
        spec = next(s["function"] for s in tool_specs() if s["function"]["name"] == "create_project")
        self.assertEqual(set(spec["parameters"]["required"]), {"name", "due_date"})
        self.assertIn("Always ask for the deadline", spec["description"])
        self.assertIn("Optional, never ask about these: a description", spec["description"])
        self.assertNotIn("description", spec["parameters"]["required"])

    def test_a_project_without_a_deadline_is_refused_with_a_hint_to_ask(self):
        before = self.counts()
        with self.assertRaises(ToolError) as caught:
            propose_tool(self.a, "create_project", {"name": "No date"})
        self.assertIn("due_date", str(caught.exception))
        self.assertIn("ask them", str(caught.exception))
        self.assertEqual(self.counts(), before)

    def test_a_project_with_no_description_is_fine(self):
        _, summary = propose_tool(self.a, "create_project", {"name": "Plain", "due_date": "2026-12-01"})
        self.assertIn("due 2026-12-01", summary)

    def test_the_system_prompt_tells_the_model_to_ask_before_proposing(self):
        from agent.runner import system_prompt
        prompt = system_prompt(self.a)
        self.assertIn("Needs from the user", prompt)
        self.assertIn("do not guess", prompt)
        self.assertIn("never ask about optional details", prompt)

    # --- executing a confirmed change ---------------------------------------------------------

    def test_create_project(self):
        result = execute_write(self.a, "create_project", {"name": "New site", "due_date": "2026-12-01"})
        project = Project.objects.get(id=result["id"])
        self.assertEqual((project.creator, project.name, str(project.due_date)), (self.a, "New site", "2026-12-01"))
        self.assertEqual(result["link"], f"/projects/{project.id}")

    def test_create_task_goes_into_the_callers_project_unassigned(self):
        result = execute_write(self.a, "create_task", {**self.valid_args()["create_task"], "priority": "high"})
        task = Task.objects.get(id=result["id"])
        self.assertEqual((task.project, task.name, task.priority), (self.project_a, "New task", "high"))
        self.assertEqual(task.assignees.count(), 0)  # nobody is assigned unless the user asked for it

    # --- assigning teammates ------------------------------------------------------------------

    def hire(self, creator, talent, status="accepted"):
        from notification.models import HireRequest
        return HireRequest.objects.create(creator=creator, talent=talent, status=status)

    def test_a_task_can_be_assigned_to_someone_on_the_team_and_the_card_says_who(self):
        lero = make_user("lero@test.com", "talent")
        self.hire(self.a, lero)
        args = {**self.valid_args()["create_task"], "assignee_ids": [str(lero.id)]}
        _, summary = propose_tool(self.a, "create_task", args)
        self.assertIn("assigned to lero@test.com", summary)

        from notification.models import Notification
        self.assertEqual(Notification.objects.filter(user=lero).count(), 0)  # proposing notifies nobody
        result = execute_write(self.a, "create_task", args)
        self.assertEqual(list(Task.objects.get(id=result["id"]).assignees.all()), [lero])
        self.assertEqual(Notification.objects.filter(user=lero).count(), 1)  # confirming does

    def test_only_the_callers_own_accepted_team_can_be_assigned(self):
        stranger = make_user("stranger@test.com", "talent")        # nobody hired them
        theirs = make_user("theirs@test.com", "talent")
        self.hire(self.b, theirs)                                  # on someone else's team
        pending = make_user("pending@test.com", "talent")
        self.hire(self.a, pending, status="pending")               # invited, not accepted
        before = self.counts()
        for person in (stranger, theirs, pending, self.b):
            with self.assertRaises(ToolError, msg=person.email):
                propose_tool(self.a, "create_task", {**self.valid_args()["create_task"], "assignee_ids": [str(person.id)]})
        with self.assertRaises(ToolError):
            propose_tool(self.a, "create_task", {**self.valid_args()["create_task"], "assignee_ids": ["not-a-uuid"]})
        self.assertEqual(self.counts(), before)

    def test_a_removed_teammate_is_refused_again_when_the_card_is_confirmed(self):
        lero = make_user("lero@test.com", "talent")
        hire = self.hire(self.a, lero)
        args = {**self.valid_args()["create_task"], "assignee_ids": [str(lero.id)]}
        propose_tool(self.a, "create_task", args)
        hire.delete()
        before = self.counts()
        with self.assertRaises(ToolError):
            execute_write(self.a, "create_task", args)
        self.assertEqual(self.counts(), before)

    def test_list_team_shows_only_my_accepted_team_without_emails(self):
        lero = make_user("lero@test.com", "talent")
        self.hire(self.a, lero)
        self.hire(self.b, make_user("other@test.com", "talent"))
        self.hire(self.a, make_user("wait@test.com", "talent"), status="pending")
        text = str(run_tool(self.a, "list_team", {}))
        self.assertIn(str(lero.id), text)
        self.assertNotIn("other@test.com", text)
        self.assertNotIn("wait@test.com", text)

    def test_the_model_is_told_to_ask_for_description_deadline_and_priority_and_to_use_list_team(self):
        spec = next(s["function"] for s in tool_specs() if s["function"]["name"] == "create_task")
        self.assertEqual(set(spec["parameters"]["required"]), {"project_id", "name"})
        for phrase in ("a short description", "a deadline", "a priority", "list_team", "ONE short message"):
            self.assertIn(phrase, spec["description"])

    def test_update_task_changes_only_the_fields_given(self):
        execute_write(self.a, "update_task", {"task_id": str(self.task_a.id), "name": "Renamed", "priority": "low"})
        self.task_a.refresh_from_db()
        self.assertEqual((self.task_a.name, self.task_a.priority, self.task_a.status), ("Renamed", "low", "planning"))

    def test_update_task_can_move_between_planning_and_in_progress(self):
        execute_write(self.a, "update_task", {"task_id": str(self.task_a.id), "status": "in-progress"})
        self.task_a.refresh_from_db()
        self.assertEqual(self.task_a.status, "in-progress")

    # --- scoping ------------------------------------------------------------------------------

    def test_create_task_in_another_creators_project_looks_like_a_missing_project(self):
        before = self.counts()
        errors = []
        for project_id in (self.project_b.id, uuid.uuid4(), "not-a-uuid"):
            with self.assertRaises(ToolError) as caught:
                propose_tool(self.a, "create_task", {"project_id": str(project_id), "name": "x"})
            errors.append(str(caught.exception))
        self.assertEqual(len(set(errors)), 1)
        self.assertNotIn("Bravo", errors[0])
        self.assertEqual(self.counts(), before)

    def test_update_task_on_another_creators_task_looks_like_a_missing_task(self):
        errors = []
        for task_id in (self.task_b.id, uuid.uuid4(), "not-a-uuid"):
            with self.assertRaises(ToolError) as caught:
                propose_tool(self.a, "update_task", {"task_id": str(task_id), "name": "hijacked"})
            errors.append(str(caught.exception))
        self.assertEqual(len(set(errors)), 1)
        self.task_b.refresh_from_db()
        self.assertEqual(self.task_b.name, "Bravo task")

    # --- what the Agent is not allowed to do --------------------------------------------------

    def test_it_cannot_complete_a_task(self):
        with self.assertRaises(ToolError):
            propose_tool(self.a, "update_task", {"task_id": str(self.task_a.id), "status": "completed"})

    def test_it_will_not_touch_a_task_that_is_already_completed(self):
        Task.objects.filter(pk=self.task_a.pk).update(status="completed")
        with self.assertRaises(ToolError):
            propose_tool(self.a, "update_task", {"task_id": str(self.task_a.id), "name": "reopened"})

    def test_it_cannot_assign_people_or_pick_whose_data_to_change(self):
        for extra in ({"assignees": [str(self.b.id)]}, {"user_id": str(self.b.id)}, {"creator": str(self.b.id)}):
            with self.assertRaises(ToolError):
                propose_tool(self.a, "create_task", {**self.valid_args()["create_task"], **extra})

    def test_an_update_with_nothing_to_change_is_refused(self):
        with self.assertRaises(ToolError):
            propose_tool(self.a, "update_task", {"task_id": str(self.task_a.id)})

    # --- bad values ---------------------------------------------------------------------------

    def test_bad_values_are_refused_and_create_nothing(self):
        before = self.counts()
        bad = [
            ("create_project", {"name": "", "due_date": "2026-12-01"}),
            ("create_project", {"name": "   ", "due_date": "2026-12-01"}),
            ("create_project", {"name": "x" * 256, "due_date": "2026-12-01"}),
            ("create_project", {"name": "ok", "due_date": "tomorrow"}),
            ("create_project", {"name": "ok", "due_date": "2026-12-01", "description": "d" * 2001}),
            ("create_task", {"project_id": str(self.project_a.id), "name": "ok", "priority": "urgent!!"}),
            ("create_task", {"project_id": str(self.project_a.id), "name": "ok", "deadline": "31/12/2026"}),
            ("create_task", {"project_id": str(self.project_a.id)}),
        ]
        for name, args in bad:
            with self.assertRaises(ToolError, msg=f"{name} {args}"):
                propose_tool(self.a, name, args)
        self.assertEqual(self.counts(), before)

    # --- confirm-time re-validation -----------------------------------------------------------

    def test_a_change_that_was_valid_when_proposed_is_refused_if_the_project_is_gone(self):
        args, _ = propose_tool(self.a, "create_task", self.valid_args()["create_task"])
        self.project_a.delete()
        before = self.counts()
        with self.assertRaises(ToolError):
            execute_write(self.a, "create_task", args)
        self.assertEqual(self.counts(), before)

    def test_a_change_is_refused_if_ownership_changed_after_it_was_proposed(self):
        args, _ = propose_tool(self.a, "create_task", self.valid_args()["create_task"])
        Project.objects.filter(pk=self.project_a.pk).update(creator=self.b)
        with self.assertRaises(ToolError):
            execute_write(self.a, "create_task", args)
        self.assertEqual(Task.objects.filter(name="New task").count(), 0)

    def test_an_update_is_refused_if_the_task_was_completed_after_it_was_proposed(self):
        args, _ = propose_tool(self.a, "update_task", self.valid_args()["update_task"])
        Task.objects.filter(pk=self.task_a.pk).update(status="completed")
        with self.assertRaises(ToolError):
            execute_write(self.a, "update_task", args)
        self.task_a.refresh_from_db()
        self.assertEqual(self.task_a.name, "Write copy")

    def test_execute_write_will_not_run_a_read_tool_or_an_unknown_one(self):
        for name in ("list_projects", "drop_database"):
            with self.assertRaises(ToolError):
                execute_write(self.a, name, {})
