from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from .models import Deliverable, Project, Task, TaskComment

User = get_user_model()


def make_user(email, role):
    return User.objects.create_user(email=email, full_name=email.split("@")[0], password="pass1234", role=role)


def api(user):
    client = APIClient()
    client.force_authenticate(user)
    return client


class RevisionFlowTests(TestCase):
    """When a creator sends work back, the task says so (for every list that shows it) and the
    creator's note lands in the task's comments."""

    def setUp(self):
        self.creator = make_user("creator@test.com", "creator")
        self.talent = make_user("talent@test.com", "talent")
        self.project = Project.objects.create(creator=self.creator, name="Alpha")
        self.task = Task.objects.create(project=self.project, name="Design", status="in-progress")
        self.task.assignees.add(self.talent)

    def reload(self):
        self.task.refresh_from_db()
        return self.task

    # ── Task sent back (no deliverable) ──────────────────────────────────────

    def ask_for_approval(self):
        return api(self.talent).post(f"/api/v2/tasks/{self.task.id}/request-completion/")

    def send_back(self, feedback="Tighten the logo spacing"):
        return api(self.creator).post(
            f"/api/v2/tasks/{self.task.id}/request-revision/", {"feedback": feedback}, format="json"
        )

    def test_sending_a_task_back_flags_it_and_posts_the_note_as_a_comment(self):
        self.ask_for_approval()
        res = self.send_back()
        self.assertEqual(res.status_code, 200)
        self.assertTrue(res.data["revision_requested"])
        self.assertFalse(res.data["awaiting_approval"])

        task = self.reload()
        self.assertTrue(task.revision_requested)
        self.assertFalse(task.awaiting_approval)

        comment = TaskComment.objects.get(task=task)
        self.assertEqual(comment.author, self.creator)
        self.assertEqual(comment.content, "Revision requested: Tighten the logo spacing")
        self.assertEqual(res.data["comment"]["id"], str(comment.id))

    def test_no_note_still_leaves_a_comment(self):
        self.ask_for_approval()
        self.send_back(feedback="")
        self.assertEqual(TaskComment.objects.get(task=self.task).content, "Revision requested.")

    def test_the_talent_sees_the_flag_in_their_task_list_and_on_the_task(self):
        self.ask_for_approval()
        self.send_back()
        listed = api(self.talent).get("/api/v2/my-tasks/").data
        self.assertTrue([t for t in listed if t["id"] == str(self.task.id)][0]["revision_requested"])
        detail = api(self.talent).get(f"/api/v2/tasks/{self.task.id}/").data
        self.assertTrue(detail["revision_requested"])
        self.assertEqual(detail["comments"][0]["content"], "Revision requested: Tighten the logo spacing")

    def test_sending_back_a_task_that_is_not_waiting_does_nothing(self):
        res = self.send_back()
        self.assertEqual(res.status_code, 200)
        self.assertFalse(self.reload().revision_requested)
        self.assertEqual(TaskComment.objects.count(), 0)

    def test_only_the_creator_can_send_a_task_back(self):
        self.ask_for_approval()
        res = api(self.talent).post(f"/api/v2/tasks/{self.task.id}/request-revision/", {"feedback": "x"}, format="json")
        self.assertEqual(res.status_code, 403)
        self.assertFalse(self.reload().revision_requested)

    def test_handing_it_in_again_clears_the_flag(self):
        self.ask_for_approval()
        self.send_back()
        self.ask_for_approval()
        task = self.reload()
        self.assertFalse(task.revision_requested)
        self.assertTrue(task.awaiting_approval)

    def test_completing_the_task_clears_the_flag(self):
        self.ask_for_approval()
        self.send_back()
        res = api(self.creator).patch(f"/api/v2/tasks/{self.task.id}/", {"status": "completed"}, format="json")
        self.assertEqual(res.status_code, 200)
        self.assertFalse(self.reload().revision_requested)

    def test_the_flag_cannot_be_set_by_editing_the_task(self):
        api(self.creator).patch(f"/api/v2/tasks/{self.task.id}/", {"revision_requested": True}, format="json")
        self.assertFalse(self.reload().revision_requested)

    # ── Deliverable sent back ────────────────────────────────────────────────

    def deliverable(self, title="Logo v1"):
        return Deliverable.objects.create(task=self.task, title=title, submitted_by=self.talent)

    def review(self, deliverable, status, feedback=None):
        body = {"status": status}
        if feedback is not None:
            body["feedback"] = feedback
        return api(self.creator).patch(f"/api/v2/deliverables/{deliverable.id}/review/", body, format="json")

    def test_sending_a_deliverable_back_flags_the_task_and_comments_against_the_deliverable(self):
        d = self.deliverable()
        res = self.review(d, "revision", "Colours are off")
        self.assertEqual(res.status_code, 200)
        self.assertTrue(self.reload().revision_requested)

        comment = TaskComment.objects.get(task=self.task)
        self.assertEqual(comment.author, self.creator)
        self.assertEqual(comment.content, "Re: Logo v1 : Revision requested: Colours are off")

    def test_a_deliverable_revision_also_releases_a_pending_approval(self):
        self.ask_for_approval()
        self.review(self.deliverable(), "revision", "Redo")
        task = self.reload()
        self.assertTrue(task.revision_requested)
        self.assertFalse(task.awaiting_approval)

    def test_approving_a_deliverable_clears_the_flag_and_adds_no_comment(self):
        d = self.deliverable()
        self.review(d, "revision", "Colours are off")
        self.review(d, "approved")
        task = self.reload()
        self.assertFalse(task.revision_requested)
        self.assertEqual(task.status, "completed")
        self.assertEqual(TaskComment.objects.filter(task=task).count(), 1)

    def test_submitting_a_new_deliverable_clears_the_flag(self):
        self.review(self.deliverable(), "revision", "Colours are off")
        res = api(self.talent).post("/api/v2/deliverables/", {"task": str(self.task.id), "title": "Logo v2"})
        self.assertEqual(res.status_code, 201)
        self.assertFalse(self.reload().revision_requested)

    def test_a_talent_cannot_send_a_deliverable_back(self):
        d = self.deliverable()
        res = api(self.talent).patch(f"/api/v2/deliverables/{d.id}/review/", {"status": "revision"}, format="json")
        self.assertEqual(res.status_code, 404)
        self.assertFalse(self.reload().revision_requested)
        self.assertEqual(TaskComment.objects.count(), 0)
