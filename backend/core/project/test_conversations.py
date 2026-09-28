from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework import status
from rest_framework.test import APIClient

from .models import Conversation

User = get_user_model()

START_URL = "/api/v2/conversations/start/"
LIST_URL = "/api/v2/conversations/"


def make_user(email, role):
    return User.objects.create_user(email=email, full_name=email, password="pass1234", role=role)


class ConversationStartTests(TestCase):
    def setUp(self):
        self.creator = make_user("creator@test.com", "creator")
        self.talent = make_user("talent@test.com", "talent")
        self.api = APIClient()
        self.api.force_authenticate(user=self.creator)

    def test_cannot_start_a_conversation_with_yourself(self):
        res = self.api.post(START_URL, {"user_id": str(self.creator.id)}, format="json")
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(Conversation.objects.count(), 0)

    def test_starting_with_another_user_returns_their_details(self):
        res = self.api.post(START_URL, {"user_id": str(self.talent.id)}, format="json")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data["other_user"]["id"], str(self.talent.id))

    def test_list_still_serialises_a_conversation_with_no_other_participant(self):
        # Legacy rows (self-chats created before the guard, or a deleted account) must not 500;
        # the frontend treats other_user=null as "skip".
        conv = Conversation.objects.create()
        conv.participants.add(self.creator)
        res = self.api.get(LIST_URL)
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(len(res.data), 1)
        self.assertIsNone(res.data[0]["other_user"])
