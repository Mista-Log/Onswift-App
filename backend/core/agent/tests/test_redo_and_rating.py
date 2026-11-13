"""Retry, edit and rating on the Agent's replies."""
from agent.models import AgentAction, AgentConversation, AgentMessage, AgentStreamSlot
from agent.providers.fake import FakeProvider

from .test_views import LIST_URL, ViewTestCase, body, client_for, make_user, text_turn


class RedoAndRatingTestCase(ViewTestCase):
    def say(self, conversation, content, reply="Hello", **payload):
        """One full turn: send, read the whole stream so it finishes."""
        response = self.send(self.client_a, conversation, FakeProvider([text_turn(reply)]), content=content, **payload)
        self.assertEqual(response.status_code, 200)
        return body(response)

    def thread(self, conversation):
        return [(m.role, m.content) for m in conversation.messages.filter(role__in=["user", "assistant"])]

    def reply(self, conversation):
        return conversation.messages.filter(role="assistant").order_by("-position").first()


class RatingTests(RedoAndRatingTestCase):
    def rate(self, client, message_id, rating):
        return client.post(f"/api/v9/messages/{message_id}/rating/", {"rating": rating}, format="json")

    def test_a_reply_can_be_rated_changed_and_cleared(self):
        conversation = self.conversation()
        self.say(conversation, "hi")
        reply = self.reply(conversation)
        self.assertEqual(reply.rating, 0)
        for value in (1, -1, 0):
            response = self.rate(self.client_a, reply.id, value)
            self.assertEqual((response.status_code, response.json()["rating"]), (200, value))
            reply.refresh_from_db()
            self.assertEqual(reply.rating, value)

    def test_only_one_minus_one_and_zero_are_accepted(self):
        conversation = self.conversation()
        self.say(conversation, "hi")
        reply = self.reply(conversation)
        for bad in (2, -2, "1", True, None, 1.5, [1]):
            self.assertEqual(self.rate(self.client_a, reply.id, bad).status_code, 400, repr(bad))
        reply.refresh_from_db()
        self.assertEqual(reply.rating, 0)

    def test_someone_elses_reply_looks_like_it_does_not_exist(self):
        conversation = self.conversation()
        self.say(conversation, "hi")
        reply = self.reply(conversation)
        self.assertEqual(self.rate(self.client_b, reply.id, 1).status_code, 404)
        reply.refresh_from_db()
        self.assertEqual(reply.rating, 0)

    def test_only_the_agents_replies_can_be_rated(self):
        conversation = self.conversation()
        self.say(conversation, "hi")
        mine = conversation.messages.get(role="user")
        self.assertEqual(self.rate(self.client_a, mine.id, 1).status_code, 404)

    def test_non_creators_are_forbidden(self):
        conversation = self.conversation()
        self.say(conversation, "hi")
        talent = client_for(make_user("t@test.com", role="talent"))
        self.assertEqual(self.rate(talent, self.reply(conversation).id, 1).status_code, 403)

    def test_the_rating_comes_back_when_the_conversation_is_reopened(self):
        conversation = self.conversation()
        self.say(conversation, "hi")
        self.rate(self.client_a, self.reply(conversation).id, -1)
        messages = self.client_a.get(f"{LIST_URL}{conversation.id}/").json()["messages"]
        self.assertEqual([m["rating"] for m in messages], [0, -1])


class RedoTests(RedoAndRatingTestCase):
    def test_retry_replaces_the_latest_turn_with_a_new_answer(self):
        conversation = self.conversation()
        self.say(conversation, "What is due?", reply="first answer")
        self.say(conversation, "What is due?", reply="second answer", replace_last=True)
        self.assertEqual(self.thread(conversation), [("user", "What is due?"), ("assistant", "second answer")])
        self.assertEqual(list(conversation.messages.values_list("position", flat=True)), [1, 2])

    def test_edit_replaces_the_latest_user_message_and_retitles_a_first_message(self):
        conversation = self.conversation()
        self.say(conversation, "Whats due", reply="a")
        self.say(conversation, "What is due this week?", reply="b", replace_last=True)
        self.assertEqual(self.thread(conversation), [("user", "What is due this week?"), ("assistant", "b")])
        conversation.refresh_from_db()
        self.assertEqual(conversation.title, "What is due this week?")

    def test_only_the_latest_turn_is_redone(self):
        conversation = self.conversation()
        self.say(conversation, "one", reply="1")
        self.say(conversation, "two", reply="2")
        self.say(conversation, "two again", reply="2b", replace_last=True)
        self.assertEqual(
            self.thread(conversation),
            [("user", "one"), ("assistant", "1"), ("user", "two again"), ("assistant", "2b")],
        )

    def test_a_rating_goes_with_the_reply_it_was_given_to(self):
        conversation = self.conversation()
        self.say(conversation, "hi", reply="first")
        old = self.reply(conversation)
        old.rating = 1
        old.save()
        self.say(conversation, "hi", reply="second", replace_last=True)
        self.assertEqual(self.reply(conversation).rating, 0)
        self.assertFalse(AgentMessage.objects.filter(id=old.id).exists())

    def test_cards_still_waiting_are_cancelled_when_the_turn_is_redone(self):
        conversation = self.conversation()
        self.say(conversation, "make a project")
        card = AgentAction.objects.create(user=self.a, conversation=conversation, tool="create_project", status="pending")
        self.say(conversation, "make a project", replace_last=True)
        card.refresh_from_db()
        self.assertEqual(card.status, "superseded")
        self.assertIsNotNone(card.resolved_at)

    def test_a_turn_with_a_confirmed_change_cannot_be_redone_and_nothing_is_touched(self):
        for status in ("executed", "confirmed"):
            with self.subTest(status=status):
                conversation = self.conversation()
                self.say(conversation, "make a project", reply="proposed")
                AgentAction.objects.create(user=self.a, conversation=conversation, tool="create_project", status=status)
                before = self.thread(conversation)
                response = self.send(
                    self.client_a, conversation, FakeProvider([text_turn("new")]), content="make a project", replace_last=True
                )
                self.assertEqual(response.status_code, 409)
                self.assertEqual(response.json()["code"], "turn_has_changes")
                self.assertEqual(self.thread(conversation), before)
                self.assertEqual(AgentStreamSlot.objects.count(), 0)  # the refusal did not strand the slot

    def test_a_change_confirmed_in_an_earlier_turn_does_not_block_the_latest_one(self):
        conversation = self.conversation()
        self.say(conversation, "make a project")
        AgentAction.objects.create(user=self.a, conversation=conversation, tool="create_project", status="executed")
        self.say(conversation, "and what is due?", reply="old")
        self.say(conversation, "and what is due today?", reply="new", replace_last=True)
        self.assertEqual(self.thread(conversation)[-2:], [("user", "and what is due today?"), ("assistant", "new")])

    def test_a_failed_or_rejected_card_does_not_block_a_retry(self):
        conversation = self.conversation()
        self.say(conversation, "make a project")
        for status in ("failed", "rejected", "expired"):
            AgentAction.objects.create(user=self.a, conversation=conversation, tool="create_project", status=status)
        self.say(conversation, "make a project", reply="again", replace_last=True)
        self.assertEqual(self.thread(conversation)[-1], ("assistant", "again"))

    def test_there_is_nothing_to_redo_in_an_empty_conversation(self):
        conversation = self.conversation()
        response = self.send(self.client_a, conversation, content="hi", replace_last=True)
        self.assertEqual(response.status_code, 400)
        self.assertEqual(AgentStreamSlot.objects.count(), 0)

    def test_it_only_acts_on_the_callers_own_conversation(self):
        conversation = self.conversation(self.b)
        self.assertEqual(self.send(self.client_a, conversation, content="hi", replace_last=True).status_code, 404)

    def test_only_a_real_true_counts_as_redo(self):
        conversation = self.conversation()
        self.say(conversation, "hi", reply="first")
        self.say(conversation, "hi", reply="second", replace_last="yes")
        self.assertEqual(len(self.thread(conversation)), 4)  # appended, not replaced

    def test_a_busy_stream_refuses_the_redo_without_removing_anything(self):
        conversation = self.conversation()
        self.say(conversation, "hi", reply="first")
        AgentStreamSlot.objects.create(user=self.a)  # a reply is already being written
        before = self.thread(conversation)
        response = self.send(self.client_a, conversation, content="hi", replace_last=True)
        self.assertEqual(response.status_code, 429)
        self.assertEqual(self.thread(conversation), before)
