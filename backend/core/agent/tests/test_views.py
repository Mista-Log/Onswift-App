import json
from datetime import timedelta
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient
from rest_framework.throttling import ScopedRateThrottle
from rest_framework_simplejwt.tokens import RefreshToken

from agent import streams
from agent.models import AgentConversation, AgentStreamSlot
from agent.providers.base import Done, TextDelta, Usage
from agent.providers.fake import FakeProvider
from project.models import Project

User = get_user_model()
LIST_URL = "/api/v9/conversations/"


def make_user(email, role="creator", verified=True):
    return User.objects.create_user(
        email=email, full_name=email, password="Str0ng-pass-123", role=role, email_verified=verified
    )


def client_for(user):
    client = APIClient()
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {RefreshToken.for_user(user).access_token}")
    return client


def text_turn(text="Hello"):
    return [TextDelta(text), Usage(1, 1, 2), Done("stop")]


def body(response):
    return b"".join(response.streaming_content).decode()


class ViewTestCase(TestCase):
    def setUp(self):
        cache.clear()  # throttle counters live in the cache
        streams._active = 0
        self.addCleanup(setattr, streams, "_active", 0)
        self.a = make_user("a@test.com")
        self.b = make_user("b@test.com")
        self.client_a = client_for(self.a)
        self.client_b = client_for(self.b)

    def conversation(self, user=None):
        return AgentConversation.objects.create(user=user or self.a)

    def send(self, client, conversation, provider=None, **payload):
        provider = provider or FakeProvider([text_turn()])
        payload.setdefault("content", "hi")
        with patch("agent.views.get_llm_provider", return_value=provider):
            return client.post(f"{LIST_URL}{conversation.id}/messages/", payload, format="json")


class AccessTests(ViewTestCase):
    def test_anonymous_users_are_rejected(self):
        self.assertEqual(APIClient().get(LIST_URL).status_code, 401)

    def test_talent_and_clients_are_forbidden_on_every_endpoint(self):
        conversation = self.conversation()
        for role in ("talent", "client"):
            client = client_for(make_user(f"{role}@test.com", role=role))
            self.assertEqual(client.get(LIST_URL).status_code, 403)
            self.assertEqual(client.post(LIST_URL).status_code, 403)
            self.assertEqual(client.get(f"{LIST_URL}{conversation.id}/").status_code, 403)
            self.assertEqual(self.send(client, conversation).status_code, 403)

    @override_settings(EMAIL_VERIFICATION_REQUIRED=True)
    def test_an_unverified_creator_is_forbidden(self):
        client = client_for(make_user("u@test.com", verified=False))
        self.assertEqual(client.get(LIST_URL).status_code, 403)


class ConversationTests(ViewTestCase):
    def test_creating_a_conversation_lists_it_for_its_owner_only(self):
        created = self.client_a.post(LIST_URL)
        self.assertEqual(created.status_code, 201)
        AgentConversation.objects.filter(id=created.json()["id"]).update(title="Plan the launch")  # set by the first message
        self.assertEqual([c["id"] for c in self.client_a.get(LIST_URL).json()], [created.json()["id"]])
        self.assertEqual(self.client_b.get(LIST_URL).json(), [])

    def test_the_history_list_hides_chats_where_nothing_was_said(self):
        self.client_a.post(LIST_URL)  # created, but no first message ever gave it a title
        self.assertEqual(self.client_a.get(LIST_URL).json(), [])

    def test_the_history_list_is_newest_first_and_never_shows_another_users_chats(self):
        older = AgentConversation.objects.create(user=self.a, title="Older chat")
        AgentConversation.objects.create(user=self.a, title="Newer chat")
        AgentConversation.objects.create(user=self.b, title="Someone else's chat")
        AgentConversation.objects.filter(id=older.id).update(updated_at=timezone.now() - timedelta(days=2))
        self.assertEqual([c["title"] for c in self.client_a.get(LIST_URL).json()], ["Newer chat", "Older chat"])
        self.assertEqual([c["title"] for c in self.client_b.get(LIST_URL).json()], ["Someone else's chat"])

    def test_another_users_conversation_is_not_found(self):
        conversation = self.conversation()
        self.assertEqual(self.client_b.get(f"{LIST_URL}{conversation.id}/").status_code, 404)

    def test_detail_returns_what_was_said_and_hides_tool_plumbing(self):
        conversation = self.conversation()
        raw = [{"id": "c1", "type": "function", "function": {"name": "list_projects", "arguments": "{}"}}]
        conversation.add_message(role="user", content="what is on?")
        conversation.add_message(role="assistant", tool_calls=raw)
        conversation.add_message(role="tool", tool_call_id="c1", content='{"items": []}')
        conversation.add_message(role="assistant", content="Nothing yet.")
        data = self.client_a.get(f"{LIST_URL}{conversation.id}/").json()
        self.assertEqual([(m["role"], m["content"]) for m in data["messages"]], [
            ("user", "what is on?"), ("assistant", "Nothing yet."),
        ])
        self.assertNotIn("tool_calls", json.dumps(data))


class MessageStreamTests(ViewTestCase):
    def test_a_message_streams_server_sent_events_and_is_saved(self):
        conversation = self.conversation()
        response = self.send(self.client_a, conversation)
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response["Content-Type"].startswith("text/event-stream"))
        self.assertEqual(response["Cache-Control"], "no-cache")
        self.assertEqual(response["X-Accel-Buffering"], "no")
        text = body(response)
        self.assertIn("event: text_delta", text)
        self.assertIn("event: done", text)
        self.assertEqual([m.role for m in conversation.messages.all()], ["user", "assistant"])

    def test_the_slot_is_freed_after_the_body_is_read(self):
        response = self.send(self.client_a, self.conversation())
        body(response)
        self.assertEqual(AgentStreamSlot.objects.count(), 0)

    def test_the_slot_is_freed_when_the_client_never_reads_the_body(self):
        response = self.send(self.client_a, self.conversation())
        self.assertEqual(AgentStreamSlot.objects.count(), 1)
        response.close()
        self.assertEqual(AgentStreamSlot.objects.count(), 0)
        self.assertEqual(streams._active, 0)

    def test_another_users_conversation_is_not_found_and_nothing_runs(self):
        conversation = self.conversation(self.a)
        provider = FakeProvider([text_turn()])
        response = self.send(self.client_b, conversation, provider)
        self.assertEqual(response.status_code, 404)
        self.assertEqual(provider.calls, [])
        self.assertEqual(conversation.messages.count(), 0)
        self.assertEqual(AgentStreamSlot.objects.count(), 0)

    def test_invalid_messages_are_rejected_before_any_slot_or_model_call(self):
        conversation = self.conversation()
        for payload in ({}, {"content": ""}, {"content": "   "}, {"content": 5}, {"content": "x" * 4001}):
            with patch("agent.views.get_llm_provider") as factory:
                response = self.client_a.post(f"{LIST_URL}{conversation.id}/messages/", payload, format="json")
            self.assertEqual(response.status_code, 400, payload)
            factory.assert_not_called()
        self.assertEqual(AgentStreamSlot.objects.count(), 0)
        self.assertEqual(conversation.messages.count(), 0)

    @override_settings(AGENT_LLM_API_KEY="")
    def test_a_missing_key_is_a_503_that_does_not_name_the_setting_and_takes_no_slot(self):
        conversation = self.conversation()
        with self.assertLogs("agent.views", level="ERROR"):
            response = self.client_a.post(f"{LIST_URL}{conversation.id}/messages/", {"content": "hi"}, format="json")
        self.assertEqual(response.status_code, 503)
        self.assertNotIn("AGENT_LLM", response.content.decode())
        self.assertEqual(AgentStreamSlot.objects.count(), 0)


class StreamLimitTests(ViewTestCase):
    def test_a_second_stream_for_the_same_user_gets_429_and_leaves_the_first_alone(self):
        AgentStreamSlot.objects.create(user=self.a)  # a response is already in progress
        provider = FakeProvider([text_turn()])
        response = self.send(self.client_a, self.conversation(), provider)
        self.assertEqual(response.status_code, 429)
        self.assertEqual(response.json()["code"], "stream_in_progress")
        self.assertEqual(provider.calls, [])
        self.assertEqual(AgentStreamSlot.objects.filter(user=self.a).count(), 1)

    def test_one_users_stream_does_not_block_another_user(self):
        AgentStreamSlot.objects.create(user=self.a)
        response = self.send(self.client_b, self.conversation(self.b))
        self.assertEqual(response.status_code, 200)
        body(response)

    @override_settings(AGENT_MAX_CONCURRENT_STREAMS=0)
    def test_the_process_cap_returns_429_server_busy_without_creating_a_slot(self):
        response = self.send(self.client_a, self.conversation())
        self.assertEqual(response.status_code, 429)
        self.assertEqual(response.json()["code"], "server_busy")
        self.assertEqual(AgentStreamSlot.objects.count(), 0)

    def test_the_message_throttle_returns_429_before_taking_a_slot(self):
        conversation = self.conversation()
        with patch.dict(ScopedRateThrottle.THROTTLE_RATES, {"agent_message": "1/hour"}):
            first = self.send(self.client_a, conversation)
            body(first)
            second = self.send(self.client_a, conversation)
        self.assertEqual(first.status_code, 200)
        self.assertEqual(second.status_code, 429)
        self.assertNotIn("code", second.json())  # DRF's throttle response, not the stream-slot one
        self.assertEqual(AgentStreamSlot.objects.count(), 0)


class PageContextTests(ViewTestCase):
    def system_sent(self, **payload):
        provider = FakeProvider([text_turn()])
        body(self.send(self.client_a, self.conversation(), provider, **payload))
        return provider.calls[0]["system"]

    def test_the_callers_own_project_reaches_the_prompt(self):
        mine = Project.objects.create(creator=self.a, name="Alpha site")
        self.assertIn("Alpha site", self.system_sent(context={"project_id": str(mine.id)}))

    def test_another_creators_project_id_adds_nothing_and_looks_like_a_missing_id(self):
        theirs = Project.objects.create(creator=self.b, name="Bravo secret")
        foreign = self.system_sent(context={"project_id": str(theirs.id)})
        missing = self.system_sent(context={"project_id": "00000000-0000-4000-8000-000000000000"})
        none = self.system_sent()
        self.assertNotIn("Bravo", foreign)
        self.assertNotIn(str(theirs.id), foreign)
        self.assertEqual(foreign, missing)
        self.assertEqual(foreign, none)
