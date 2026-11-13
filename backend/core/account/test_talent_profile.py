"""The talent profile form: what is saved comes back, and fields can be emptied again."""
from django.test import TestCase
from rest_framework.test import APIClient

from account.models import User

URL = "/api/v1/auth/profile/"
ME = "/api/v1/auth/user/"


class TalentProfileRoundTripTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            email="t@example.com", password="pw12345678", full_name="Tal Ent", role="talent"
        )
        self.api = APIClient()
        self.api.force_authenticate(self.user)

    def save(self, data):
        res = self.api.patch(URL, data, format="multipart")
        self.assertEqual(res.status_code, 200, res.content)
        # force_authenticate reuses one user object that caches its profile, so ask as a fresh request would.
        self.api.force_authenticate(User.objects.get(pk=self.user.pk))
        return self.api.get(ME).json()["profile"]

    def test_everything_saved_comes_back(self):
        p = self.save({
            "full_name": "Tal Ent",
            "professional_title": "Designer",
            "bio": "Hello",
            "hourly_rate": "45",
            "availability": "Available Now",
            "skills": ["UI/UX Design", "Animation"],
            "portfolio_links": ["https://a.example", "https://b.example"],
            "social_links": '{"linkedin": "https://li.example"}',
        })
        self.assertEqual(p["professional_title"], "Designer")
        self.assertEqual(p["bio"], "Hello")
        self.assertEqual(p["hourly_rate"], "45.00")
        self.assertEqual(p["availability"], "Available Now")
        self.assertEqual(p["skills"], ["UI/UX Design", "Animation"])
        self.assertEqual(p["portfolio_links"], ["https://a.example", "https://b.example"])
        self.assertEqual(p["social_links"]["linkedin"], "https://li.example")

    def test_fields_can_be_emptied_again(self):
        self.save({
            "professional_title": "Designer", "bio": "Hello", "hourly_rate": "45",
            "availability": "Available Now", "skills": ["Animation"],
            "portfolio_links": ["https://a.example"],
        })
        p = self.save({
            "professional_title": "", "bio": "", "hourly_rate": "", "availability": "",
            "clear_fields": ["skills", "portfolio_links"],
        })
        self.assertEqual(p["professional_title"], "")
        self.assertEqual(p["bio"], "")
        self.assertIsNone(p["hourly_rate"])
        self.assertEqual(p["availability"], "")
        self.assertEqual(p["skills"], [])
        self.assertEqual(p["portfolio_links"], [])

    def test_leaving_lists_out_keeps_them(self):
        self.save({"skills": ["Animation"], "portfolio_links": ["https://a.example"]})
        p = self.save({"bio": "Only the bio changed"})
        self.assertEqual(p["skills"], ["Animation"])
        self.assertEqual(p["portfolio_links"], ["https://a.example"])
