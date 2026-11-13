import json
from datetime import timedelta
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings
from django.utils import timezone

from agent import streams
from agent.models import AgentConversation, AgentStreamSlot
from agent.providers.base import Done, TextDelta, ToolCall, Usage
from agent.providers.fake import FakeProvider
from agent.streams import AgentStream, acquire, frame, release

User = get_user_model()


def make_user(email):
    return User.objects.create_user(
        email=email, full_name=email, password="Str0ng-pass-123", role="creator", email_verified=True
    )


def parse(frames):
    events = []
    for text in frames:
        head, data = text.strip().split("\n", 1)
        events.append((head.removeprefix("event: "), json.loads(data.removeprefix("data: "))))
    return events


def tool_turn():
    raw = {"id": "c1", "type": "function", "function": {"name": "list_projects", "arguments": "{}"}}
    return [ToolCall("c1", "list_projects", {}, raw), Usage(1, 1, 2), Done("stop")]


def text_turn(text="hi"):
    return [TextDelta(text), Usage(1, 1, 2), Done("stop")]


class StreamTestCase(TestCase):
    def setUp(self):
        streams._active = 0
        self.addCleanup(setattr, streams, "_active", 0)
        self.a = make_user("a@test.com")
        self.b = make_user("b@test.com")

    def stream(self, *script, user=None):
        user = user or self.a
        conversation = AgentConversation.objects.create(user=user)
        provider = FakeProvider(script)
        self.assertIsNone(acquire(user))
        return AgentStream(user, conversation, "hi", provider), provider


class SlotTests(StreamTestCase):
    def test_a_user_can_hold_only_one_slot_but_other_users_are_unaffected(self):
        self.assertIsNone(acquire(self.a))
        self.assertEqual(acquire(self.a), "in_progress")
        self.assertIsNone(acquire(self.b))

    def test_a_refused_second_stream_does_not_leak_the_process_counter(self):
        acquire(self.a)
        acquire(self.a)
        self.assertEqual(streams._active, 1)

    def test_release_frees_the_slot(self):
        acquire(self.a)
        release(self.a)
        self.assertEqual(AgentStreamSlot.objects.count(), 0)
        self.assertEqual(streams._active, 0)
        self.assertIsNone(acquire(self.a))

    @override_settings(AGENT_MAX_CONCURRENT_STREAMS=1)
    def test_the_process_cap_refuses_other_users_until_a_stream_ends(self):
        self.assertIsNone(acquire(self.a))
        self.assertEqual(acquire(self.b), "server_busy")
        self.assertEqual(AgentStreamSlot.objects.filter(user=self.b).count(), 0)
        release(self.a)
        self.assertIsNone(acquire(self.b))

    def test_a_stale_slot_from_a_crashed_stream_expires(self):
        acquire(self.a)
        AgentStreamSlot.objects.update(heartbeat_at=timezone.now() - timedelta(minutes=10))
        streams._active = 0  # the crashed process is gone
        self.assertIsNone(acquire(self.a))

    def test_a_fresh_slot_is_not_treated_as_stale(self):
        acquire(self.a)
        AgentStreamSlot.objects.update(heartbeat_at=timezone.now() - timedelta(seconds=5))
        self.assertEqual(acquire(self.a), "in_progress")


class AgentStreamTests(StreamTestCase):
    def test_frames_are_sse_formatted(self):
        self.assertEqual(
            frame({"type": "done", "message_id": "1"}),
            'event: done\ndata: {"type": "done", "message_id": "1"}\n\n',
        )

    def test_a_normal_stream_yields_events_in_order_and_frees_the_slot(self):
        stream, _ = self.stream(text_turn("Hello"))
        events = parse(list(stream))
        self.assertEqual([e[0] for e in events], ["text_delta", "done"])
        self.assertEqual(AgentStreamSlot.objects.count(), 0)
        self.assertEqual(streams._active, 0)

    def test_closing_before_the_first_byte_still_frees_the_slot(self):
        stream, _ = self.stream(text_turn())
        stream.close()  # the client dropped before iteration started
        self.assertEqual(AgentStreamSlot.objects.count(), 0)
        self.assertEqual(streams._active, 0)

    def test_closing_mid_stream_frees_the_slot_once(self):
        stream, _ = self.stream(tool_turn(), text_turn())
        frames = iter(stream)
        next(frames)
        stream.close()
        stream.close()  # idempotent: a double close must not under-count the process counter
        frames.close()
        self.assertEqual(AgentStreamSlot.objects.count(), 0)
        self.assertEqual(streams._active, 0)

    def test_double_close_does_not_free_another_streams_capacity(self):
        stream, _ = self.stream(text_turn())
        other = acquire(self.b)
        self.assertIsNone(other)
        stream.close()
        stream.close()
        self.assertEqual(streams._active, 1)

    @override_settings(AGENT_STREAM_TIMEOUT_S=-1)
    def test_the_hard_timeout_ends_the_stream_with_an_error_and_frees_the_slot(self):
        stream, provider = self.stream(tool_turn(), text_turn())
        events = parse(list(stream))
        self.assertEqual(events[-1][1]["code"], "timeout")
        self.assertEqual(len(provider.calls), 1)  # no second model call after the deadline
        self.assertEqual(AgentStreamSlot.objects.count(), 0)

    def test_an_unexpected_crash_becomes_an_error_event_and_frees_the_slot(self):
        stream, _ = self.stream(RuntimeError("boom"))
        with self.assertLogs("agent.streams", level="ERROR"):
            events = parse(list(stream))
        self.assertEqual(events[-1][1]["code"], "unavailable")
        self.assertNotIn("boom", json.dumps(events))
        self.assertEqual(AgentStreamSlot.objects.count(), 0)

    def test_the_heartbeat_keeps_a_long_stream_from_looking_stale(self):
        stream, _ = self.stream(tool_turn(), text_turn())
        old = timezone.now() - timedelta(minutes=5)
        AgentStreamSlot.objects.update(heartbeat_at=old)
        with patch("agent.streams.HEARTBEAT_EVERY", -1):
            frames = iter(stream)
            next(frames)
            next(frames)
            self.assertGreater(AgentStreamSlot.objects.get().heartbeat_at, old)
        stream.close()
