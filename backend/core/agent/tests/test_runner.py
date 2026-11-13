import json
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.test import TestCase

from agent.models import AgentConversation, AgentUsage
from agent.providers.base import (
    Done,
    ProviderAuthError,
    ProviderRateLimited,
    ProviderStreamInterrupted,
    ProviderTimeout,
    ProviderUnavailable,
    TextDelta,
    ToolCall,
    Usage,
)
from agent.providers.fake import FakeProvider
from agent.runner import MAX_HISTORY, load_history, run_turn
from agent.tools import tool_specs
from project.models import Project

User = get_user_model()
SIGNATURE = {"google": {"thought_signature": "SIG_PLACEHOLDER"}}


def make_user(email, name=""):
    return User.objects.create_user(
        email=email, full_name=name or email, password="Str0ng-pass-123", role="creator", email_verified=True
    )


def tool_call(call_id, name, args=None, extra=None):
    raw = {"id": call_id, "type": "function", "function": {"name": name, "arguments": json.dumps(args or {})}}
    if extra:
        raw["extra_content"] = extra
    return ToolCall(id=call_id, name=name, arguments=args or {}, raw=raw)


def text_turn(text, total=9):
    return [TextDelta(text), Usage(5, 4, total), Done("stop")]


def tool_turn(*calls, extra=None, total=12):
    return [*calls, Usage(6, 6, total), Done("stop", extra)]


class RunnerTestCase(TestCase):
    def setUp(self):
        self.user = make_user("a@test.com", "Ada Creator")
        self.conversation = AgentConversation.objects.create(user=self.user)
        Project.objects.create(creator=self.user, name="Alpha site")

    def run_turn(self, *script, text="What is on?", **kwargs):
        provider = FakeProvider(script)
        events = list(run_turn(self.conversation, text, provider, **kwargs))
        return events, provider

    def roles(self):
        return [m.role for m in self.conversation.messages.all()]


class PlainAnswerTests(RunnerTestCase):
    def test_streams_text_then_done_and_saves_both_messages(self):
        events, _ = self.run_turn(text_turn("Hello there"))
        self.assertEqual([e["type"] for e in events], ["text_delta", "done"])
        self.assertEqual(events[0]["text"], "Hello there")
        self.assertEqual(self.roles(), ["user", "assistant"])
        saved = self.conversation.messages.last()
        self.assertEqual(saved.content, "Hello there")
        self.assertEqual(events[-1]["message_id"], str(saved.id))

    def test_first_message_becomes_the_title_and_later_ones_do_not_replace_it(self):
        self.run_turn(text_turn("ok"), text="x" * 100)
        self.conversation.refresh_from_db()
        self.assertEqual(self.conversation.title, "x" * 60)
        self.run_turn(text_turn("ok"), text="second question")
        self.conversation.refresh_from_db()
        self.assertEqual(self.conversation.title, "x" * 60)

    def test_usage_is_recorded_with_the_model_name(self):
        provider = FakeProvider([text_turn("hi", total=94)])
        provider.model = "fake-model"
        list(run_turn(self.conversation, "hi", provider))
        row = AgentUsage.objects.get()
        self.assertEqual((row.user, row.conversation, row.model), (self.user, self.conversation, "fake-model"))
        self.assertEqual((row.prompt_tokens, row.completion_tokens, row.total_tokens), (5, 4, 94))

    def test_system_prompt_and_tools_are_sent_to_the_model(self):
        _, provider = self.run_turn(text_turn("hi"))
        call = provider.calls[0]
        self.assertIn("Ada Creator", call["system"])
        self.assertIn("data, not instructions", call["system"])
        self.assertEqual(call["tools"], tool_specs())

    def test_an_empty_answer_is_an_error_and_saves_no_blank_message(self):
        events, _ = self.run_turn([Usage(5, 0, 5), Done("stop")])
        self.assertEqual(events[-1]["code"], "empty_response")
        self.assertEqual(self.roles(), ["user"])


class ToolLoopTests(RunnerTestCase):
    def round_trip(self, **kwargs):
        call = tool_call("call_1", "list_projects", extra=SIGNATURE)
        return self.run_turn(
            tool_turn(call, extra={"google": {"thought_signature": "MSG_SIG"}}),
            text_turn("You have one project."),
            **kwargs,
        )

    def test_event_order_for_a_tool_round_trip(self):
        events, _ = self.round_trip()
        self.assertEqual(
            [e["type"] for e in events], ["tool_call", "tool_result", "text_delta", "done"]
        )
        self.assertEqual(events[0]["name"], "list_projects")
        self.assertTrue(events[1]["ok"])

    def test_messages_are_saved_in_replayable_order_with_one_usage_row_per_model_call(self):
        self.round_trip()
        self.assertEqual(self.roles(), ["user", "assistant", "tool", "assistant"])
        self.assertEqual(AgentUsage.objects.count(), 2)

    def test_the_tool_result_and_raw_call_are_replayed_to_the_model_verbatim(self):
        _, provider = self.round_trip()
        second = provider.calls[1]["messages"]
        self.assertEqual([m["role"] for m in second], ["user", "assistant", "tool"])
        replayed = second[1]
        self.assertEqual(replayed["tool_calls"][0]["extra_content"], SIGNATURE)  # thought signature
        self.assertEqual(replayed["extra_content"], {"google": {"thought_signature": "MSG_SIG"}})
        self.assertEqual(second[2]["tool_call_id"], "call_1")
        self.assertIn("Alpha site", second[2]["content"])

    def test_the_first_model_call_is_not_changed_by_what_happens_after_it(self):
        _, provider = self.round_trip()
        self.assertEqual([m["role"] for m in provider.calls[0]["messages"]], ["user"])

    def test_an_unknown_tool_is_reported_to_the_model_and_the_turn_continues(self):
        events, provider = self.run_turn(
            tool_turn(tool_call("c1", "drop_database")), text_turn("Sorry, I can't do that.")
        )
        self.assertFalse(events[1]["ok"])
        self.assertEqual(events[-1]["type"], "done")
        self.assertIn("Unknown tool", provider.calls[1]["messages"][-1]["content"])

    def test_invalid_arguments_are_reported_to_the_model_so_it_can_retry(self):
        events, provider = self.run_turn(
            tool_turn(tool_call("c1", "list_projects", {"status": "bogus"})), text_turn("ok")
        )
        self.assertFalse(events[1]["ok"])
        self.assertIn("must be one of", provider.calls[1]["messages"][-1]["content"])

    def test_a_crashing_tool_does_not_leak_its_error_and_the_turn_continues(self):
        with patch("agent.runner.run_tool", side_effect=RuntimeError("secret internals")):
            with self.assertLogs("agent.runner", level="ERROR"):
                events, provider = self.run_turn(
                    tool_turn(tool_call("c1", "list_projects")), text_turn("ok")
                )
        self.assertFalse(events[1]["ok"])
        sent_back = provider.calls[1]["messages"][-1]["content"]
        self.assertNotIn("secret internals", sent_back)
        self.assertEqual(events[-1]["type"], "done")

    def test_tools_only_see_the_conversation_owners_data(self):
        other = make_user("b@test.com")
        Project.objects.create(creator=other, name="Bravo secret")
        _, provider = self.run_turn(tool_turn(tool_call("c1", "list_projects")), text_turn("ok"))
        sent_back = provider.calls[1]["messages"][-1]["content"]
        self.assertIn("Alpha site", sent_back)
        self.assertNotIn("Bravo", sent_back)

    def test_parallel_tool_calls_all_get_results_before_the_model_is_called_again(self):
        _, provider = self.run_turn(
            tool_turn(tool_call("c1", "list_projects"), tool_call("c2", "list_tasks")), text_turn("ok")
        )
        second = provider.calls[1]["messages"]
        self.assertEqual([m["role"] for m in second], ["user", "assistant", "tool", "tool"])
        self.assertEqual([m["tool_call_id"] for m in second[2:]], ["c1", "c2"])

    def test_the_loop_stops_after_the_iteration_cap(self):
        turns = [tool_turn(tool_call(f"c{i}", "list_projects")) for i in range(10)]
        events, provider = self.run_turn(*turns)
        self.assertEqual(events[-1]["code"], "too_many_steps")
        self.assertEqual(len(provider.calls), 4)

    def test_the_cap_can_be_lowered(self):
        turns = [tool_turn(tool_call(f"c{i}", "list_projects")) for i in range(10)]
        _, provider = self.run_turn(*turns, max_iterations=2)
        self.assertEqual(len(provider.calls), 2)

    def test_a_stream_cut_off_mid_tools_leaves_no_dangling_tool_call(self):
        provider = FakeProvider([tool_turn(tool_call("c1", "list_projects")), text_turn("ok")])
        stream = run_turn(self.conversation, "hi", provider)
        while next(stream)["type"] != "tool_call":
            pass
        stream.close()  # the client went away
        self.assertEqual(self.roles(), ["user"])


class ProviderErrorTests(RunnerTestCase):
    def error_event(self, error):
        with self.assertLogs("agent.runner", level="WARNING"):
            events, _ = self.run_turn(error)
        self.assertEqual(len(events), 1)
        self.assertEqual(events[0]["type"], "error")
        return events[0]

    def test_rate_limit_becomes_busy_with_the_retry_hint(self):
        event = self.error_event(ProviderRateLimited("Rate limited: quota", status=429, retry_after=37))
        self.assertEqual((event["code"], event["retry_after"]), ("busy", 37))

    def test_outages_and_timeouts_become_provider_unavailable(self):
        for error in (ProviderUnavailable("down", status=503), ProviderTimeout("slow")):
            self.assertEqual(self.error_event(error)["code"], "provider_unavailable")

    def test_a_dropped_stream_becomes_interrupted(self):
        self.assertEqual(self.error_event(ProviderStreamInterrupted("cut"))["code"], "interrupted")

    def test_configuration_errors_never_reach_the_creator(self):
        event = self.error_event(
            ProviderAuthError("The AI provider rejected the API key. Check AGENT_LLM_API_KEY.", status=401)
        )
        self.assertEqual(event["code"], "unavailable")
        self.assertNotIn("AGENT_LLM", event["message"])
        self.assertNotIn("key", event["message"].lower())

    def test_nothing_is_saved_for_a_failed_turn_except_the_users_question(self):
        self.error_event(ProviderUnavailable("down", status=503))
        self.assertEqual(self.roles(), ["user"])


class HistoryTests(RunnerTestCase):
    def test_only_recent_history_is_sent_and_it_starts_with_a_user_message(self):
        for i in range(60):
            self.conversation.add_message(role="user" if i % 2 == 0 else "assistant", content=f"m{i}")
        _, provider = self.run_turn(text_turn("ok"), text="latest")
        sent = provider.calls[0]["messages"]
        self.assertLessEqual(len(sent), MAX_HISTORY)
        self.assertEqual(sent[0]["role"], "user")
        self.assertEqual(sent[-1]["content"], "latest")

    def test_trimming_never_starts_on_a_tool_result(self):
        raw = [{"id": "c", "type": "function", "function": {"name": "list_projects", "arguments": "{}"}}]
        for _ in range(20):
            self.conversation.add_message(role="user", content="q")
            self.conversation.add_message(role="assistant", tool_calls=raw)
            self.conversation.add_message(role="tool", tool_call_id="c", content="{}")
        rows = load_history(self.conversation)
        self.assertEqual(rows[0].role, "user")
        for i, row in enumerate(rows):
            if row.role == "tool":
                self.assertEqual(rows[i - 1].role, "assistant")

    def test_a_short_history_is_sent_whole(self):
        self.conversation.add_message(role="user", content="earlier")
        self.conversation.add_message(role="assistant", content="reply")
        _, provider = self.run_turn(text_turn("ok"), text="now")
        self.assertEqual([m["content"] for m in provider.calls[0]["messages"]], ["earlier", "reply", "now"])
