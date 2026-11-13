from django.contrib.auth import get_user_model
from django.db import IntegrityError, transaction
from django.test import RequestFactory, TestCase, override_settings

from agent.models import (
    AgentAction,
    AgentConversation,
    AgentMessage,
    AgentStreamSlot,
    AgentUsage,
)
from agent.permissions import HasAgentAccess

User = get_user_model()


def make_user(email="a@test.com", role="creator", verified=True):
    return User.objects.create_user(
        email=email,
        full_name=email,
        password="Str0ng-pass-123",
        role=role,
        email_verified=verified,
    )


class AnonymousUser:
    is_authenticated = False


class HasAgentAccessTests(TestCase):
    def allowed(self, user):
        request = RequestFactory().get("/")
        request.user = user
        return HasAgentAccess().has_permission(request, view=None)

    def test_verified_creator_is_allowed(self):
        self.assertTrue(self.allowed(make_user()))

    def test_talent_and_client_are_denied(self):
        self.assertFalse(self.allowed(make_user("t@test.com", role="talent")))
        self.assertFalse(self.allowed(make_user("c@test.com", role="client")))

    @override_settings(EMAIL_VERIFICATION_REQUIRED=True)
    def test_unverified_creator_is_denied(self):
        self.assertFalse(self.allowed(make_user(verified=False)))

    def test_anonymous_is_denied(self):
        self.assertFalse(self.allowed(AnonymousUser()))


class AgentModelTests(TestCase):
    def setUp(self):
        self.user = make_user()
        self.conversation = AgentConversation.objects.create(user=self.user, title="Hello")

    def test_messages_come_back_in_the_order_they_were_added(self):
        for role, text in [("user", "first"), ("assistant", "second"), ("user", "third")]:
            self.conversation.add_message(role=role, content=text)
        self.assertEqual(
            [m.content for m in self.conversation.messages.all()], ["first", "second", "third"]
        )

    def test_order_does_not_depend_on_the_clock(self):
        for text in ["first", "second", "third"]:
            self.conversation.add_message(role="user", content=text)
        AgentMessage.objects.update(created_at=self.conversation.created_at)  # identical timestamps
        self.assertEqual(
            [m.content for m in self.conversation.messages.all()], ["first", "second", "third"]
        )

    def test_positions_are_unique_within_a_conversation(self):
        self.conversation.add_message(role="user", content="a")
        with self.assertRaises(IntegrityError), transaction.atomic():
            AgentMessage.objects.create(conversation=self.conversation, position=1, role="user", content="b")

    def test_each_conversation_numbers_its_own_messages(self):
        other = AgentConversation.objects.create(user=self.user)
        self.conversation.add_message(role="user", content="a")
        self.assertEqual(other.add_message(role="user", content="b").position, 1)

    def test_tool_calls_and_extras_are_stored_verbatim(self):
        raw = [{"id": "c1", "type": "function", "function": {"name": "x", "arguments": "{}"},
                "extra_content": {"google": {"thought_signature": "SIG"}}}]
        extra = {"google": {"thought_signature": "SIG2"}}
        message = self.conversation.add_message(role="assistant", tool_calls=raw, message_extra=extra)
        message.refresh_from_db()
        self.assertEqual(message.tool_calls, raw)
        self.assertEqual(message.message_extra, extra)

    def test_a_new_action_starts_pending(self):
        action = AgentAction.objects.create(
            user=self.user, conversation=self.conversation, tool="create_task", arguments={"title": "t"}
        )
        self.assertEqual(action.status, "pending")
        self.assertIsNone(action.resolved_at)

    def test_deleting_the_user_removes_their_agent_data(self):
        self.conversation.add_message(role="user", content="hi")
        AgentUsage.objects.create(user=self.user, conversation=self.conversation, total_tokens=9)
        self.user.delete()
        self.assertEqual(AgentConversation.objects.count(), 0)
        self.assertEqual(AgentMessage.objects.count(), 0)
        self.assertEqual(AgentUsage.objects.count(), 0)

    def test_usage_survives_its_conversation_being_deleted(self):
        AgentUsage.objects.create(user=self.user, conversation=self.conversation, total_tokens=9)
        self.conversation.delete()
        self.assertIsNone(AgentUsage.objects.get().conversation)

    def test_a_user_can_hold_only_one_stream_slot(self):
        AgentStreamSlot.objects.create(user=self.user)
        with self.assertRaises(IntegrityError), transaction.atomic():
            AgentStreamSlot.objects.create(user=self.user)

    def test_two_users_can_each_hold_a_slot(self):
        AgentStreamSlot.objects.create(user=self.user)
        AgentStreamSlot.objects.create(user=make_user("b@test.com"))
        self.assertEqual(AgentStreamSlot.objects.count(), 2)
