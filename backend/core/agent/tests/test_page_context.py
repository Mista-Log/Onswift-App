import uuid

from django.contrib.auth import get_user_model
from django.test import TestCase

from agent.page_context import page_note
from project.models import Project

User = get_user_model()


def make_user(email):
    return User.objects.create_user(
        email=email, full_name=email, password="Str0ng-pass-123", role="creator", email_verified=True
    )


class PageNoteTests(TestCase):
    def setUp(self):
        self.a = make_user("a@test.com")
        self.b = make_user("b@test.com")
        self.mine = Project.objects.create(creator=self.a, name="Alpha site")
        self.theirs = Project.objects.create(creator=self.b, name="Bravo secret")

    def test_the_callers_own_project_is_described(self):
        note = page_note(self.a, {"project_id": str(self.mine.id)})
        self.assertIn("Alpha site", note)
        self.assertIn(str(self.mine.id), note)

    def test_another_creators_project_is_dropped(self):
        self.assertIsNone(page_note(self.a, {"project_id": str(self.theirs.id)}))

    def test_a_foreign_id_and_a_missing_id_look_the_same(self):
        self.assertEqual(
            page_note(self.a, {"project_id": str(self.theirs.id)}),
            page_note(self.a, {"project_id": str(uuid.uuid4())}),
        )

    def test_malformed_context_is_ignored(self):
        for context in (None, "x", [], 5, {}, {"project_id": 5}, {"project_id": "not-a-uuid"}, {"project_id": None}):
            self.assertIsNone(page_note(self.a, context))

    def test_other_keys_in_the_context_are_ignored(self):
        note = page_note(self.a, {"project_id": str(self.mine.id), "route": "/admin", "user_id": self.b.id})
        self.assertIn("Alpha site", note)
        self.assertNotIn("/admin", note)
        self.assertNotIn(str(self.b.id), note)

    def test_a_long_project_name_is_clipped(self):
        self.mine.name = "x" * 255
        self.mine.save()
        self.assertLess(len(page_note(self.a, {"project_id": str(self.mine.id)})), 400)
