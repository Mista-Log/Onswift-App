"""Public share links (onswift.org/<handle>) and the "show my profile" option on forms."""
from django.core.cache import cache
from django.test import TestCase
from rest_framework import serializers
from rest_framework.test import APIClient

from account.models import CreatorProfile, User
from account.profiles import clean_handle, suggest_handle
from onboarding.models import OnboardingInstance, OnboardingTemplate, StandaloneForm
from project.models import Project


def as_user(user):
    api = APIClient()
    api.force_authenticate(User.objects.get(pk=user.pk))
    return api


class Base(TestCase):
    def setUp(self):
        cache.clear()  # the public page is rate limited; start each test with a clean count
        self.creator = User.objects.create_user(email="c@x.com", password="pw12345678", full_name="Ada Lovelace", role="creator")
        self.other = User.objects.create_user(email="o@x.com", password="pw12345678", full_name="Ada Lovelace", role="creator")
        self.talent = User.objects.create_user(email="t@x.com", password="pw12345678", full_name="Tal Ent", role="talent")
        CreatorProfile.objects.create(user=self.creator, company_name="Studio X", bio="We make films")
        self.anon = APIClient()

    def share(self, user, **body):
        return as_user(user).patch("/api/v1/auth/share/", body, format="json")


class HandleRules(TestCase):
    def test_accepts_the_user_dot_name_style(self):
        for ok in ("ada.lovelace", "studio-x", "ada_l", "abc", "a1.b2.c3"):
            self.assertEqual(clean_handle(ok), ok)

    def test_is_lowercased_and_trimmed(self):
        self.assertEqual(clean_handle("  @Ada.Lovelace "), "ada.lovelace")

    def test_rejects_bad_shapes(self):
        for bad in ("ab", "a" * 31, ".ada", "ada.", "ada..l", "ada l", "ada/l", "adá", "", None, "a.-b"):
            with self.assertRaises(serializers.ValidationError, msg=repr(bad)):
                clean_handle(bad)

    def test_rejects_app_pages_and_file_names(self):
        for bad in ("login", "dashboard", "api", "settings", "Admin", "robots.txt", "logo.png", "index.html"):
            with self.assertRaises(serializers.ValidationError, msg=bad):
                clean_handle(bad)


class ManagingYourLink(Base):
    def test_starts_off_with_a_suggestion_from_the_name(self):
        res = as_user(self.creator).get("/api/v1/auth/share/")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json(), {"handle": None, "suggested_handle": "ada.lovelace", "is_public": False})

    def test_suggestion_avoids_a_taken_handle(self):
        self.share(self.creator, handle="ada.lovelace", is_public=True)
        self.assertEqual(suggest_handle(self.other), "ada.lovelace2")

    def test_suggestion_survives_a_name_with_nothing_usable(self):
        self.creator.full_name = "!!!"
        self.assertEqual(suggest_handle(self.creator), "creator")
        self.creator.full_name = "Login"
        self.assertEqual(suggest_handle(self.creator), "creator")

    def test_switch_on_then_off(self):
        res = self.share(self.creator, handle="Ada.Lovelace", is_public=True)
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json()["handle"], "ada.lovelace")
        self.assertTrue(res.json()["is_public"])
        res = self.share(self.creator, is_public=False)
        self.assertFalse(res.json()["is_public"])
        self.assertEqual(res.json()["handle"], "ada.lovelace")  # kept for when it's switched back on

    def test_cannot_go_public_without_a_link(self):
        res = self.share(self.creator, is_public=True)
        self.assertEqual(res.status_code, 400)
        self.assertFalse(CreatorProfile.objects.get(user=self.creator).is_public)

    def test_a_taken_or_invalid_handle_is_refused_and_nothing_changes(self):
        self.share(self.creator, handle="ada.lovelace", is_public=True)
        res = self.share(self.other, handle="ADA.lovelace", is_public=True)
        self.assertEqual(res.status_code, 400)
        self.assertIn("taken", res.json()["handle"][0])
        res = self.share(self.other, handle="login", is_public=True)
        self.assertEqual(res.status_code, 400)
        self.assertFalse(CreatorProfile.objects.get(user=self.other).is_public)

    def test_keeping_your_own_handle_is_not_a_clash(self):
        self.share(self.creator, handle="ada.lovelace", is_public=True)
        self.assertEqual(self.share(self.creator, handle="ada.lovelace").status_code, 200)

    def test_a_creator_without_a_profile_row_still_works(self):
        self.assertEqual(self.share(self.other, handle="other.ada", is_public=True).status_code, 200)

    def test_talents_are_told_it_is_a_creator_feature(self):
        self.assertEqual(as_user(self.talent).get("/api/v1/auth/share/").status_code, 403)
        self.assertEqual(self.share(self.talent, handle="tal.ent", is_public=True).status_code, 403)

    def test_signed_out_cannot_manage_a_link(self):
        self.assertEqual(self.anon.get("/api/v1/auth/share/").status_code, 401)


class ThePublicPage(Base):
    def test_nobody_is_public_until_they_switch_it_on(self):
        self.share(self.creator, handle="ada.lovelace")
        self.assertEqual(self.anon.get("/api/v1/public/profiles/ada.lovelace/").status_code, 404)

    def test_anyone_can_open_it_once_on(self):
        self.share(self.creator, handle="ada.lovelace", is_public=True)
        res = self.anon.get("/api/v1/public/profiles/Ada.Lovelace/")  # case does not matter
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data["full_name"], "Ada Lovelace")
        self.assertEqual(data["headline"], "Studio X")
        self.assertEqual(data["handle"], "ada.lovelace")

    def test_it_never_gives_out_the_email_or_the_user_id(self):
        self.share(self.creator, handle="ada.lovelace", is_public=True)
        body = self.anon.get("/api/v1/public/profiles/ada.lovelace/").content.decode()
        self.assertNotIn("c@x.com", body)
        self.assertNotIn(str(self.creator.id), body)

    def test_switching_off_takes_the_page_down(self):
        self.share(self.creator, handle="ada.lovelace", is_public=True)
        self.share(self.creator, is_public=False)
        self.assertEqual(self.anon.get("/api/v1/public/profiles/ada.lovelace/").status_code, 404)

    def test_a_deactivated_account_has_no_page(self):
        self.share(self.creator, handle="ada.lovelace", is_public=True)
        User.objects.filter(pk=self.creator.pk).update(is_active=False)
        self.assertEqual(self.anon.get("/api/v1/public/profiles/ada.lovelace/").status_code, 404)

    def test_an_unknown_handle_is_not_found(self):
        self.assertEqual(self.anon.get("/api/v1/public/profiles/no.body/").status_code, 404)

    def test_a_stale_login_token_does_not_block_the_page(self):
        self.share(self.creator, handle="ada.lovelace", is_public=True)
        api = APIClient()
        api.credentials(HTTP_AUTHORIZATION="Bearer not-a-real-token")
        self.assertEqual(api.get("/api/v1/public/profiles/ada.lovelace/").status_code, 200)


class ProfileOnForms(Base):
    def setUp(self):
        super().setUp()
        self.form = StandaloneForm.objects.create(creator=self.creator, title="Brief", blocks=[])
        project = Project.objects.create(creator=self.creator, name="P")
        self.template = OnboardingTemplate.objects.create(creator=self.creator, title="Onboard", blocks=[], project=project)
        self.instance = OnboardingInstance.objects.create(template=self.template, project=project)

    def test_forms_do_not_show_the_profile_by_default(self):
        self.assertIsNone(self.anon.get(f"/api/v4/f/{self.form.slug}/").json()["creator_profile"])
        self.assertIsNone(self.anon.get(f"/api/v4/onboard/{self.instance.slug}/").json()["creator_profile"])

    def test_the_creator_switches_it_on_from_the_form_editor(self):
        res = as_user(self.creator).patch(f"/api/v4/forms/{self.form.id}/", {"show_creator_profile": True}, format="json")
        self.assertEqual(res.status_code, 200)
        self.assertTrue(res.json()["show_creator_profile"])
        profile = self.anon.get(f"/api/v4/f/{self.form.slug}/").json()["creator_profile"]
        self.assertEqual(profile["full_name"], "Ada Lovelace")
        self.assertEqual(profile["headline"], "Studio X")
        self.assertNotIn("id", profile)

    def test_onboarding_forms_too(self):
        res = as_user(self.creator).patch(
            f"/api/v4/templates/{self.template.id}/", {"show_creator_profile": True}, format="json"
        )
        self.assertEqual(res.status_code, 200)
        profile = self.anon.get(f"/api/v4/onboard/{self.instance.slug}/").json()["creator_profile"]
        self.assertEqual(profile["full_name"], "Ada Lovelace")

    def test_the_form_only_links_to_the_public_page_while_it_is_on(self):
        StandaloneForm.objects.filter(pk=self.form.pk).update(show_creator_profile=True)
        self.share(self.creator, handle="ada.lovelace")
        self.assertIsNone(self.anon.get(f"/api/v4/f/{self.form.slug}/").json()["creator_profile"]["handle"])
        self.share(self.creator, is_public=True)
        self.assertEqual(self.anon.get(f"/api/v4/f/{self.form.slug}/").json()["creator_profile"]["handle"], "ada.lovelace")

    def test_another_creator_cannot_switch_it_on_for_you(self):
        res = as_user(self.other).patch(f"/api/v4/forms/{self.form.id}/", {"show_creator_profile": True}, format="json")
        self.assertEqual(res.status_code, 404)
        self.assertFalse(StandaloneForm.objects.get(pk=self.form.pk).show_creator_profile)
