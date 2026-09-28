import tempfile

from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from .models import PersonalTask, PersonalTaskAttachment

User = get_user_model()


def make_user(email, role):
    return User.objects.create_user(email=email, full_name=email.split("@")[0], password="pass1234", role=role)


@override_settings(MEDIA_ROOT=tempfile.mkdtemp(prefix="onswift-test-media-"))
class PersonalTaskAttachmentTests(TestCase):
    def setUp(self):
        self.talent = make_user("talent@test.com", "talent")
        self.creator = make_user("creator@test.com", "creator")
        self.task = PersonalTask.objects.create(owner=self.talent, name="Prep brief")
        self.url = f"/api/v2/personal-tasks/{self.task.id}/attachments/"

    def api(self, user):
        client = APIClient()
        client.force_authenticate(user)
        return client

    def test_owner_can_attach_a_link(self):
        res = self.api(self.talent).post(self.url, {"url": "example.com/brief"}, format="multipart")
        self.assertEqual(res.status_code, 201)
        self.assertEqual(res.data["url"], "https://example.com/brief")
        self.assertEqual(res.data["name"], "https://example.com/brief")

    def test_owner_can_attach_a_file(self):
        upload = SimpleUploadedFile("notes.txt", b"hello", content_type="text/plain")
        res = self.api(self.talent).post(self.url, {"file": upload}, format="multipart")
        self.assertEqual(res.status_code, 201)
        self.assertEqual(res.data["name"], "notes.txt")
        self.assertTrue(res.data["file_url"])

    def test_a_file_or_link_is_required(self):
        res = self.api(self.talent).post(self.url, {"name": "empty"}, format="multipart")
        self.assertEqual(res.status_code, 400)
        self.assertEqual(PersonalTaskAttachment.objects.count(), 0)

    def test_attachments_show_up_on_the_task_and_in_the_list(self):
        self.api(self.talent).post(self.url, {"url": "https://a.test", "name": "Ref"}, format="multipart")

        listing = self.api(self.talent).get(self.url)
        self.assertEqual([a["name"] for a in listing.data], ["Ref"])

        task = self.api(self.talent).get(f"/api/v2/personal-tasks/{self.task.id}/")
        self.assertEqual([a["name"] for a in task.data["attachments"]], ["Ref"])

    def test_owner_can_remove_an_attachment(self):
        att = PersonalTaskAttachment.objects.create(task=self.task, name="Ref", url="https://a.test")
        res = self.api(self.talent).delete(f"{self.url}{att.id}/")
        self.assertEqual(res.status_code, 204)
        self.assertFalse(PersonalTaskAttachment.objects.filter(id=att.id).exists())

    def test_nobody_else_can_see_add_or_remove_them(self):
        att = PersonalTaskAttachment.objects.create(task=self.task, name="Ref", url="https://a.test")
        for other in (self.creator, make_user("other@test.com", "talent")):
            client = self.api(other)
            self.assertEqual(client.get(self.url).status_code, 404)
            self.assertEqual(client.post(self.url, {"url": "https://x.test"}, format="multipart").status_code, 404)
            self.assertEqual(client.delete(f"{self.url}{att.id}/").status_code, 404)
        self.assertEqual(PersonalTaskAttachment.objects.count(), 1)

    def test_requires_authentication(self):
        self.assertEqual(APIClient().get(self.url).status_code, 401)
