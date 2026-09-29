import tempfile

from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from .models import Project, Task, TaskAttachment

User = get_user_model()


def make_user(email, role):
    return User.objects.create_user(email=email, full_name=email.split("@")[0], password="pass1234", role=role)


@override_settings(MEDIA_ROOT=tempfile.mkdtemp(prefix="onswift-test-media-"))
class TaskAttachmentTests(TestCase):
    """Regression coverage for the "Reference files & links" section: adding a file or a link
    with no name used to 400 (DRF's auto-required `name` field rejected the request before
    perform_create's filename/URL fallback ever ran)."""

    def setUp(self):
        self.creator = make_user("creator@test.com", "creator")
        self.talent = make_user("talent@test.com", "talent")
        self.project = Project.objects.create(creator=self.creator, name="Alpha")
        self.task = Task.objects.create(project=self.project, name="Design")
        self.task.assignees.add(self.talent)
        self.url = f"/api/v2/tasks/{self.task.id}/attachments/"

    def api(self, user):
        client = APIClient()
        client.force_authenticate(user)
        return client

    def test_a_file_with_no_name_is_named_after_the_file(self):
        upload = SimpleUploadedFile("brief.pdf", b"hello", content_type="application/pdf")
        res = self.api(self.talent).post(self.url, {"file": upload}, format="multipart")
        self.assertEqual(res.status_code, 201)
        self.assertEqual(res.data["name"], "brief.pdf")

    def test_a_link_with_no_name_is_named_after_the_url(self):
        res = self.api(self.creator).post(self.url, {"url": "example.com/notes"}, format="multipart")
        self.assertEqual(res.status_code, 201)
        self.assertEqual(res.data["url"], "https://example.com/notes")
        self.assertEqual(res.data["name"], "https://example.com/notes")

    def test_a_supplied_name_is_kept(self):
        res = self.api(self.creator).post(
            self.url, {"url": "https://a.test", "name": "Kickoff notes"}, format="multipart"
        )
        self.assertEqual(res.status_code, 201)
        self.assertEqual(res.data["name"], "Kickoff notes")

    def test_neither_a_file_nor_a_url_is_still_rejected(self):
        res = self.api(self.creator).post(self.url, {"name": "Empty"}, format="multipart")
        self.assertEqual(res.status_code, 400)
        self.assertEqual(TaskAttachment.objects.count(), 0)
