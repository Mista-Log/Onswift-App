"""Profile previews (who can open whose) and the Featured section."""
from io import BytesIO
from unittest import mock

from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase
from PIL import Image
from rest_framework.test import APIClient

from account.models import CreatorProfile, FeaturedWork, TalentProfile, User
from notification.models import HireRequest


def png(name="work.png", size=(8, 8)):
    buf = BytesIO()
    Image.new("RGB", size, "purple").save(buf, "PNG")
    return SimpleUploadedFile(name, buf.getvalue(), content_type="image/png")


def as_user(user):
    api = APIClient()
    api.force_authenticate(User.objects.get(pk=user.pk))
    return api


class ProfileBase(TestCase):
    def setUp(self):
        self.creator = User.objects.create_user(email="c@x.com", password="pw12345678", full_name="Cree Ator", role="creator")
        self.talent = User.objects.create_user(email="t@x.com", password="pw12345678", full_name="Tal Ent", role="talent")
        self.stranger = User.objects.create_user(email="s@x.com", password="pw12345678", full_name="Stran Ger", role="talent")
        TalentProfile.objects.create(
            user=self.talent, professional_title="Designer", bio="I draw", skills=["Animation"],
            portfolio_links=["https://folio.example"], social_links={"linkedin": "https://li.example"},
        )
        CreatorProfile.objects.create(user=self.creator, company_name="Studio X", bio="We make films")
        HireRequest.objects.create(creator=self.creator, talent=self.talent, status="accepted")


class WhoCanOpenWhat(ProfileBase):
    def test_creator_opens_their_team_member(self):
        res = as_user(self.creator).get(f"/api/v1/profiles/{self.talent.id}/")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data["headline"], "Designer")
        self.assertEqual(data["skills"], ["Animation"])
        self.assertEqual(data["links"], ["https://folio.example"])
        self.assertEqual(data["stats"][0]["label"], "Projects")

    def test_talent_opens_the_creator_who_hired_them(self):
        res = as_user(self.talent).get(f"/api/v1/profiles/{self.creator.id}/")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json()["headline"], "Studio X")

    def test_anyone_can_open_their_own(self):
        self.assertEqual(as_user(self.stranger).get(f"/api/v1/profiles/{self.stranger.id}/").status_code, 200)

    def test_someone_you_do_not_work_with_is_not_found(self):
        self.assertEqual(as_user(self.creator).get(f"/api/v1/profiles/{self.stranger.id}/").status_code, 404)
        self.assertEqual(as_user(self.stranger).get(f"/api/v1/profiles/{self.talent.id}/").status_code, 404)

    def test_a_pending_invite_is_not_a_team(self):
        HireRequest.objects.filter(creator=self.creator).update(status="pending")
        self.assertEqual(as_user(self.creator).get(f"/api/v1/profiles/{self.talent.id}/").status_code, 404)

    def test_signed_out_is_refused(self):
        self.assertIn(APIClient().get(f"/api/v1/profiles/{self.talent.id}/").status_code, (401, 403))

    def test_never_leaks_email_or_rates(self):
        TalentProfile.objects.filter(user=self.talent).update(hourly_rate=99)
        body = as_user(self.creator).get(f"/api/v1/profiles/{self.talent.id}/").content.decode()
        self.assertNotIn("t@x.com", body)
        self.assertNotIn("hourly", body)


class BannerAndCreatorLinks(ProfileBase):
    FAKE = {"public_id": "b1", "version": 1, "type": "upload", "resource_type": "image", "format": "png"}

    def test_a_talent_can_set_a_banner_and_it_shows_on_the_profile(self):
        with mock.patch("cloudinary.uploader.upload", return_value=self.FAKE):
            res = as_user(self.talent).patch("/api/v1/auth/profile/", {"banner": png("b.png", (32, 4))}, format="multipart")
        self.assertEqual(res.status_code, 200, res.content)
        self.assertTrue(as_user(self.talent).get("/api/v1/auth/user/").json()["profile"]["banner"])
        self.assertTrue(as_user(self.creator).get(f"/api/v1/profiles/{self.talent.id}/").json()["banner"])

    def test_a_creator_can_set_one_too(self):
        with mock.patch("cloudinary.uploader.upload", return_value=self.FAKE):
            res = as_user(self.creator).patch("/api/v1/auth/profile/", {"banner": png()}, format="multipart")
        self.assertEqual(res.status_code, 200, res.content)
        self.assertTrue(as_user(self.creator).get("/api/v1/auth/user/").json()["profile"]["banner"])

    def test_a_banner_that_is_not_an_image_is_refused(self):
        junk = SimpleUploadedFile("a.pdf", b"%PDF", content_type="application/pdf")
        res = as_user(self.talent).patch("/api/v1/auth/profile/", {"banner": junk}, format="multipart")
        self.assertEqual(res.status_code, 400)

    def test_the_banner_can_be_removed(self):
        User.objects.filter(pk=self.talent.pk).update(banner="sample")
        res = as_user(self.talent).patch("/api/v1/auth/profile/", {"clear_fields": ["banner"]}, format="multipart")
        self.assertEqual(res.status_code, 200, res.content)
        self.assertIsNone(as_user(self.talent).get("/api/v1/auth/user/").json()["profile"]["banner"])

    def test_saving_other_fields_keeps_the_banner(self):
        User.objects.filter(pk=self.talent.pk).update(banner="sample")
        as_user(self.talent).patch("/api/v1/auth/profile/", {"bio": "New bio"}, format="multipart")
        self.assertTrue(as_user(self.talent).get("/api/v1/auth/user/").json()["profile"]["banner"])

    def test_no_banner_is_null_not_an_error(self):
        self.assertIsNone(as_user(self.creator).get(f"/api/v1/profiles/{self.talent.id}/").json()["banner"])

    def test_creator_portfolio_links_save_show_and_clear(self):
        api = as_user(self.creator)
        api.patch("/api/v1/auth/profile/", {"portfolio_links": ["https://studio.example", "https://reel.example"]}, format="multipart")
        self.assertEqual(
            as_user(self.creator).get("/api/v1/auth/user/").json()["profile"]["portfolio_links"],
            ["https://studio.example", "https://reel.example"],
        )
        self.assertEqual(
            as_user(self.talent).get(f"/api/v1/profiles/{self.creator.id}/").json()["links"],
            ["https://studio.example", "https://reel.example"],
        )
        as_user(self.creator).patch("/api/v1/auth/profile/", {"clear_fields": ["portfolio_links"]}, format="multipart")
        self.assertEqual(as_user(self.creator).get("/api/v1/auth/user/").json()["profile"]["portfolio_links"], [])


class FeaturedSection(ProfileBase):
    def add(self, user, **extra):
        return FeaturedWork.objects.create(user=user, image="sample", **extra)

    def test_featured_shows_on_the_profile(self):
        self.add(self.talent, title="Brand film", link="https://v.example")
        data = as_user(self.creator).get(f"/api/v1/profiles/{self.talent.id}/").json()
        self.assertEqual([f["title"] for f in data["featured"]], ["Brand film"])
        self.assertEqual(data["stats"][2], {"label": "Featured", "value": 1})

    def test_upload_adds_a_piece(self):
        fake = {"public_id": "w1", "version": 1, "type": "upload", "resource_type": "image", "format": "png"}
        with mock.patch("cloudinary.uploader.upload", return_value=fake):
            res = as_user(self.talent).post(
                "/api/v1/auth/featured/", {"image": png(), "title": "Poster", "link": "https://p.example"}, format="multipart"
            )
        self.assertEqual(res.status_code, 201, res.content)
        self.assertEqual(res.json()["title"], "Poster")
        self.assertEqual(self.talent.featured_works.count(), 1)

    def test_creators_can_feature_work_too(self):
        fake = {"public_id": "w2", "version": 1, "type": "upload", "resource_type": "image", "format": "png"}
        with mock.patch("cloudinary.uploader.upload", return_value=fake):
            res = as_user(self.creator).post("/api/v1/auth/featured/", {"image": png()}, format="multipart")
        self.assertEqual(res.status_code, 201, res.content)

    def test_not_an_image_is_refused(self):
        junk = SimpleUploadedFile("a.txt", b"hello", content_type="text/plain")
        res = as_user(self.talent).post("/api/v1/auth/featured/", {"image": junk}, format="multipart")
        self.assertEqual(res.status_code, 400)
        self.assertEqual(self.talent.featured_works.count(), 0)

    def test_an_image_is_required(self):
        res = as_user(self.talent).post("/api/v1/auth/featured/", {"title": "No image"}, format="multipart")
        self.assertEqual(res.status_code, 400)

    def test_there_is_a_cap(self):
        for _ in range(FeaturedWork.MAX_PER_USER):
            self.add(self.talent)
        res = as_user(self.talent).post("/api/v1/auth/featured/", {"image": png()}, format="multipart")
        self.assertEqual(res.status_code, 400)
        self.assertEqual(self.talent.featured_works.count(), FeaturedWork.MAX_PER_USER)

    def test_edit_title_and_link(self):
        w = self.add(self.talent, title="Old")
        res = as_user(self.talent).patch(f"/api/v1/auth/featured/{w.id}/", {"title": "New", "link": "https://n.example"}, format="multipart")
        self.assertEqual(res.status_code, 200)
        w.refresh_from_db()
        self.assertEqual((w.title, w.link), ("New", "https://n.example"))

    def test_bad_link_is_refused(self):
        w = self.add(self.talent)
        res = as_user(self.talent).patch(f"/api/v1/auth/featured/{w.id}/", {"link": "not a url"}, format="multipart")
        self.assertEqual(res.status_code, 400)

    def test_remove_a_piece(self):
        w = self.add(self.talent)
        self.assertEqual(as_user(self.talent).delete(f"/api/v1/auth/featured/{w.id}/").status_code, 204)
        self.assertEqual(self.talent.featured_works.count(), 0)

    def test_cannot_touch_someone_elses_piece(self):
        w = self.add(self.talent)
        other = as_user(self.stranger)
        self.assertEqual(other.delete(f"/api/v1/auth/featured/{w.id}/").status_code, 404)
        self.assertEqual(other.patch(f"/api/v1/auth/featured/{w.id}/", {"title": "x"}, format="multipart").status_code, 404)
        self.assertEqual(self.talent.featured_works.count(), 1)

    def test_list_is_only_your_own(self):
        self.add(self.talent, title="Mine")
        self.add(self.stranger, title="Theirs")
        titles = [f["title"] for f in as_user(self.talent).get("/api/v1/auth/featured/").json()]
        self.assertEqual(titles, ["Mine"])
