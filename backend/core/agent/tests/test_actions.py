"""Proposing, confirming and rejecting changes: the logic and the endpoints."""
import dataclasses
import json
from datetime import timedelta
from unittest.mock import patch

from django.core.cache import cache
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from agent import actions, streams
from agent.models import AgentAction, AgentConversation
from agent.providers.base import Done, TextDelta, ToolCall, Usage
from agent.providers.fake import FakeProvider
from agent.tests.test_views import client_for, make_user
from agent.tools import ToolError
from agent.tools.base import _REGISTRY
from project.models import Project, Task

FAST_HASH = override_settings(PASSWORD_HASHERS=["django.contrib.auth.hashers.MD5PasswordHasher"])
CONVERSATIONS = "/api/v9/conversations/"


def confirm_url(action):
    return f"/api/v9/actions/{action.id}/confirm/"


def reject_url(action):
    return f"/api/v9/actions/{action.id}/reject/"


@FAST_HASH
class ActionTestCase(TestCase):
    def setUp(self):
        cache.clear()
        streams._active = 0
        self.addCleanup(setattr, streams, "_active", 0)
        self.a = make_user("a@test.com")
        self.b = make_user("b@test.com")
        self.client_a = client_for(self.a)
        self.client_b = client_for(self.b)
        self.project_a = Project.objects.create(creator=self.a, name="Alpha site")
        self.project_b = Project.objects.create(creator=self.b, name="Bravo secret")
        self.conversation = AgentConversation.objects.create(user=self.a)

    def propose_project(self, name="New site"):
        return actions.propose(self.conversation, "create_project", {"name": name, "due_date": "2026-12-01"})

    def propose_task(self, name="New task"):
        return actions.propose(self.conversation, "create_task", {"project_id": str(self.project_a.id), "name": name})

    def projects(self):
        return Project.objects.count()

    def tasks(self):
        return Task.objects.count()


class ProposeTests(ActionTestCase):
    def test_proposing_records_a_pending_action_and_creates_nothing(self):
        before = self.projects()
        action = self.propose_project()
        self.assertEqual(action.status, "pending")
        self.assertEqual((action.user, action.conversation, action.tool), (self.a, self.conversation, "create_project"))
        self.assertEqual(action.arguments, {"name": "New site", "due_date": "2026-12-01"})
        self.assertEqual(self.projects(), before)

    def test_a_proposal_expires_in_about_fifteen_minutes(self):
        action = self.propose_project()
        remaining = action.expires_at - timezone.now()
        self.assertGreater(remaining, timedelta(minutes=14))
        self.assertLessEqual(remaining, timedelta(minutes=15))

    def test_the_summary_is_capped_so_a_long_name_cannot_break_the_row(self):
        action = self.propose_project("n" * 255)
        self.assertLessEqual(len(action.summary), 300)

    def test_an_invalid_proposal_records_nothing(self):
        with self.assertRaises(ToolError):
            actions.propose(self.conversation, "create_task", {"project_id": str(self.project_b.id), "name": "x"})
        self.assertEqual(AgentAction.objects.count(), 0)

    def test_there_is_a_limit_on_unconfirmed_proposals_and_expired_ones_do_not_count(self):
        for i in range(actions.PENDING_LIMIT):
            self.propose_project(f"P{i}")
        with self.assertRaises(ToolError):
            self.propose_project("one too many")
        AgentAction.objects.filter(status="pending").update(expires_at=timezone.now() - timedelta(minutes=1))
        self.propose_project("fine now")  # the old ones have lapsed

    def test_the_limit_is_per_user(self):
        for i in range(actions.PENDING_LIMIT):
            self.propose_project(f"P{i}")
        other = AgentConversation.objects.create(user=self.b)
        actions.propose(other, "create_project", {"name": "B can still propose", "due_date": "2026-12-01"})


class ConfirmTests(ActionTestCase):
    def test_confirming_executes_the_change_once(self):
        action = self.propose_project()
        response = self.client_a.post(confirm_url(action))
        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertEqual(body["status"], "executed")
        project = Project.objects.get(id=body["result"]["id"])
        self.assertEqual((project.creator, project.name), (self.a, "New site"))
        action.refresh_from_db()
        self.assertEqual(action.status, "executed")
        self.assertIsNotNone(action.resolved_at)

    def test_a_double_click_reports_the_same_result_and_does_not_run_it_twice(self):
        action = self.propose_project()
        first = self.client_a.post(confirm_url(action)).json()
        before = self.projects()
        second = self.client_a.post(confirm_url(action))
        self.assertEqual(second.status_code, 200)
        self.assertEqual(second.json()["result"], first["result"])
        self.assertEqual(self.projects(), before)

    def test_confirming_a_rejected_action_does_nothing(self):
        action = self.propose_project()
        self.client_a.post(reject_url(action))
        before = self.projects()
        response = self.client_a.post(confirm_url(action))
        self.assertEqual(response.status_code, 409)
        self.assertEqual(self.projects(), before)
        action.refresh_from_db()
        self.assertEqual(action.status, "rejected")

    def test_an_expired_action_is_refused_and_marked_expired(self):
        action = self.propose_project()
        AgentAction.objects.filter(pk=action.pk).update(expires_at=timezone.now() - timedelta(seconds=1))
        before = self.projects()
        response = self.client_a.post(confirm_url(action))
        self.assertEqual(response.status_code, 410)
        self.assertEqual(self.projects(), before)
        action.refresh_from_db()
        self.assertEqual(action.status, "expired")
        self.assertEqual(self.client_a.post(confirm_url(action)).status_code, 409)

    def test_a_task_proposal_creates_the_task_in_the_right_project_when_confirmed(self):
        action = self.propose_task()
        self.assertEqual(self.client_a.post(confirm_url(action)).status_code, 200)
        self.assertEqual(Task.objects.get(name="New task").project, self.project_a)


class RevalidationTests(ActionTestCase):
    def failed(self, response, action):
        self.assertEqual(response.status_code, 422)
        action.refresh_from_db()
        self.assertEqual(action.status, "failed")
        self.assertTrue(action.error)

    def test_a_project_deleted_after_proposing_makes_the_confirm_fail_cleanly(self):
        action = self.propose_task()
        self.project_a.delete()
        self.failed(self.client_a.post(confirm_url(action)), action)
        self.assertEqual(self.tasks(), 0)

    def test_tampered_arguments_pointing_at_another_creators_project_are_refused(self):
        action = self.propose_task()
        action.arguments = {**action.arguments, "project_id": str(self.project_b.id)}
        action.save()
        self.failed(self.client_a.post(confirm_url(action)), action)
        self.assertEqual(Task.objects.filter(project=self.project_b).count(), 0)

    def test_tampered_arguments_with_extra_fields_are_refused(self):
        action = self.propose_task()
        action.arguments = {**action.arguments, "assignees": [str(self.b.id)]}
        action.save()
        self.failed(self.client_a.post(confirm_url(action)), action)
        self.assertEqual(self.tasks(), 0)

    def test_a_tampered_tool_name_cannot_make_confirm_run_a_read_tool_or_an_unknown_one(self):
        for name in ("list_projects", "drop_database"):
            action = self.propose_project(f"for {name}")
            action.tool = name
            action.save()
            self.failed(self.client_a.post(confirm_url(action)), action)

    def test_a_crash_during_the_write_leaves_no_half_made_change(self):
        action = self.propose_project("half made")
        tool = _REGISTRY["create_project"]

        def crashing_run(user, args):
            Project.objects.create(creator=user, name="half made")
            raise RuntimeError("secret internal detail")

        with patch.dict(_REGISTRY, {"create_project": dataclasses.replace(tool, run=crashing_run)}):
            response = self.client_a.post(confirm_url(action))
        self.assertEqual(response.status_code, 500)
        self.assertFalse(Project.objects.filter(name="half made").exists())
        action.refresh_from_db()
        self.assertEqual(action.status, "failed")
        self.assertNotIn("secret", action.error + json.dumps(response.json()))


class RejectTests(ActionTestCase):
    def test_rejecting_marks_it_rejected_and_creates_nothing(self):
        action = self.propose_project()
        before = self.projects()
        response = self.client_a.post(reject_url(action))
        self.assertEqual((response.status_code, response.json()["status"]), (200, "rejected"))
        self.assertEqual(self.projects(), before)

    def test_rejecting_twice_is_harmless(self):
        action = self.propose_project()
        self.client_a.post(reject_url(action))
        self.assertEqual(self.client_a.post(reject_url(action)).status_code, 200)

    def test_an_executed_action_cannot_be_rejected(self):
        action = self.propose_project()
        self.client_a.post(confirm_url(action))
        response = self.client_a.post(reject_url(action))
        self.assertEqual(response.status_code, 409)
        action.refresh_from_db()
        self.assertEqual(action.status, "executed")


class CrossUserTests(ActionTestCase):
    def test_another_users_confirm_is_a_404_and_changes_nothing(self):
        action = self.propose_project()
        before = self.projects()
        response = self.client_b.post(confirm_url(action))
        self.assertEqual(response.status_code, 404)
        self.assertEqual(self.projects(), before)
        action.refresh_from_db()
        self.assertEqual(action.status, "pending")
        self.assertIsNone(action.resolved_at)

    def test_another_users_reject_is_a_404_and_changes_nothing(self):
        action = self.propose_project()
        self.assertEqual(self.client_b.post(reject_url(action)).status_code, 404)
        action.refresh_from_db()
        self.assertEqual(action.status, "pending")

    def test_another_users_id_looks_exactly_like_one_that_does_not_exist(self):
        action = self.propose_project()
        other = self.client_b.post(confirm_url(action))
        missing = self.client_b.post("/api/v9/actions/00000000-0000-4000-8000-000000000000/confirm/")
        self.assertEqual((other.status_code, other.json()), (missing.status_code, missing.json()))
        self.assertNotIn("New site", json.dumps(other.json()))

    def test_the_owner_can_still_confirm_after_someone_else_probed_it(self):
        action = self.propose_project()
        self.client_b.post(confirm_url(action))
        self.assertEqual(self.client_a.post(confirm_url(action)).status_code, 200)

    def test_anonymous_and_non_creator_accounts_are_refused(self):
        action = self.propose_project()
        self.assertEqual(APIClient().post(confirm_url(action)).status_code, 401)
        for role in ("talent", "client"):
            client = client_for(make_user(f"{role}@test.com", role=role))
            self.assertEqual(client.post(confirm_url(action)).status_code, 403)
            self.assertEqual(client.post(reject_url(action)).status_code, 403)
        action.refresh_from_db()
        self.assertEqual(action.status, "pending")


class ConversationDetailTests(ActionTestCase):
    def test_a_reload_shows_pending_and_finished_actions_for_that_conversation_only(self):
        pending = self.propose_project("still waiting")
        done = self.propose_project("already done")
        self.client_a.post(confirm_url(done))
        elsewhere = AgentConversation.objects.create(user=self.a)
        actions.propose(elsewhere, "create_project", {"name": "other conversation", "due_date": "2026-12-01"})

        data = self.client_a.get(f"{CONVERSATIONS}{self.conversation.id}/").json()
        self.assertEqual(
            [(a["id"], a["status"]) for a in data["actions"]],
            [(str(pending.id), "pending"), (str(done.id), "executed")],
        )
        self.assertEqual(data["actions"][0]["arguments"], {"name": "still waiting", "due_date": "2026-12-01"})


class StreamTests(ActionTestCase):
    def test_a_proposal_arrives_on_the_stream_as_an_action_proposed_event(self):
        raw = {"id": "c1", "type": "function", "function": {"name": "create_project", "arguments": '{"name": "Streamed", "due_date": "2026-12-01"}'}}
        provider = FakeProvider([
            [ToolCall("c1", "create_project", {"name": "Streamed", "due_date": "2026-12-01"}, raw), Usage(1, 1, 2), Done("stop")],
            [TextDelta("Please confirm."), Usage(1, 1, 2), Done("stop")],
        ])
        with patch("agent.views.get_llm_provider", return_value=provider):
            response = self.client_a.post(
                f"{CONVERSATIONS}{self.conversation.id}/messages/", {"content": "make a project"}, format="json"
            )
        text = b"".join(response.streaming_content).decode()
        self.assertIn("action_proposed", text)
        self.assertFalse(Project.objects.filter(name="Streamed").exists())  # proposed, not made
        self.assertEqual(AgentAction.objects.get().status, "pending")
