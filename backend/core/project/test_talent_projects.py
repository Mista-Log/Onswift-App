from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from notification.models import HireRequest
from .models import Project, Task

User = get_user_model()


def make_user(email, role):
    return User.objects.create_user(email=email, full_name=email.split("@")[0].title(), password="pass1234", role=role)


def api(user):
    client = APIClient()
    client.force_authenticate(user)
    return client


class TalentOwnProjectTests(TestCase):
    """A talent can make their own projects and run them, with no creator involved."""

    def setUp(self):
        self.creator = make_user("creator@test.com", "creator")
        self.talent = make_user("talent@test.com", "talent")
        self.other_talent = make_user("other@test.com", "talent")

    def make_project(self, name="Mine"):
        res = api(self.talent).post("/api/v2/projects/", {"name": name, "due_date": "2030-01-01"}, format="json")
        self.assertEqual(res.status_code, 201, res.content)
        return res.json()["id"]

    def test_talent_creates_a_project_and_it_is_theirs_and_private(self):
        pid = self.make_project()
        project = Project.objects.get(id=pid)
        self.assertEqual(project.creator, self.talent)
        self.assertFalse(project.shared_with_creators)
        ids = [p["id"] for p in api(self.talent).get("/api/v2/projects/").json()]
        self.assertEqual(ids, [pid])

    def test_nobody_else_sees_it_by_default(self):
        pid = self.make_project()
        HireRequest.objects.create(creator=self.creator, talent=self.talent, status="accepted")
        for user in (self.creator, self.other_talent):
            self.assertEqual(api(user).get("/api/v2/projects/").json(), [])
            self.assertEqual(api(user).get(f"/api/v2/projects/{pid}/").status_code, 404)
            self.assertEqual(api(user).get(f"/api/v2/projects/{pid}/tasks/").json(), [])
        self.assertEqual(api(self.creator).get("/api/v2/projects/shared/").json(), [])

    def test_talent_can_rename_and_delete_their_own_project(self):
        pid = self.make_project()
        res = api(self.talent).patch(f"/api/v2/projects/{pid}/", {"name": "Renamed"}, format="json")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(Project.objects.get(id=pid).name, "Renamed")
        self.assertEqual(api(self.talent).delete(f"/api/v2/projects/{pid}/").status_code, 204)
        self.assertFalse(Project.objects.filter(id=pid).exists())

    def test_talent_still_cannot_modify_a_creators_project(self):
        project = Project.objects.create(creator=self.creator, name="Theirs")
        task = Task.objects.create(project=project, name="T")
        task.assignees.add(self.talent)
        client = api(self.talent)
        self.assertEqual(client.patch(f"/api/v2/projects/{project.id}/", {"name": "x"}, format="json").status_code, 403)
        self.assertEqual(client.delete(f"/api/v2/projects/{project.id}/").status_code, 403)
        self.assertEqual(client.patch(f"/api/v2/tasks/{task.id}/", {"name": "x"}, format="json").status_code, 403)
        self.assertEqual(client.delete(f"/api/v2/tasks/{task.id}/").status_code, 403)
        project.refresh_from_db()
        self.assertEqual(project.name, "Theirs")

    def test_talent_adds_edits_and_deletes_tasks_in_their_own_project(self):
        pid = self.make_project()
        client = api(self.talent)
        res = client.post(f"/api/v2/projects/{pid}/tasks/", {"name": "Write", "status": "planning"}, format="json")
        self.assertEqual(res.status_code, 201, res.content)
        task = Task.objects.get(id=res.json()["id"])
        self.assertEqual(list(task.assignees.all()), [self.talent])  # always self-assigned

        # Not limited to start/pause: it is their own project, so they can complete it too.
        res = client.patch(f"/api/v2/tasks/{task.id}/", {"name": "Write more", "status": "completed"}, format="json")
        self.assertEqual(res.status_code, 200, res.content)
        task.refresh_from_db()
        self.assertEqual((task.name, task.status), ("Write more", "completed"))
        self.assertEqual(len(client.get(f"/api/v2/projects/{pid}/tasks/").json()), 1)

        self.assertEqual(client.delete(f"/api/v2/tasks/{task.id}/").status_code, 204)

    def test_talent_cannot_hand_their_own_tasks_to_someone_else(self):
        pid = self.make_project()
        client = api(self.talent)
        res = client.post(
            f"/api/v2/projects/{pid}/tasks/",
            {"name": "Write", "status": "planning", "assignees": [str(self.other_talent.id)]},
            format="json",
        )
        self.assertEqual(res.status_code, 201, res.content)
        task = Task.objects.get(id=res.json()["id"])
        self.assertEqual(list(task.assignees.all()), [self.talent])
        client.patch(f"/api/v2/tasks/{task.id}/", {"assignees": [str(self.other_talent.id)]}, format="json")
        self.assertEqual(list(task.assignees.all()), [self.talent])

    def test_another_talent_cannot_touch_the_project_or_its_tasks(self):
        pid = self.make_project()
        task = Task.objects.create(project=Project.objects.get(id=pid), name="T")
        task.assignees.add(self.talent)
        other = api(self.other_talent)
        self.assertEqual(other.get(f"/api/v2/projects/{pid}/").status_code, 404)
        self.assertEqual(other.patch(f"/api/v2/projects/{pid}/", {"name": "x"}, format="json").status_code, 404)
        self.assertEqual(other.delete(f"/api/v2/projects/{pid}/").status_code, 404)
        self.assertEqual(other.post(f"/api/v2/projects/{pid}/tasks/", {"name": "x", "status": "planning"}, format="json").status_code, 403)
        self.assertEqual(other.patch(f"/api/v2/tasks/{task.id}/", {"name": "x"}, format="json").status_code, 404)

    def test_creator_cannot_make_tasks_in_a_talents_project(self):
        pid = self.make_project()
        res = api(self.creator).post(f"/api/v2/projects/{pid}/tasks/", {"name": "x", "status": "planning"}, format="json")
        self.assertEqual(res.status_code, 404)


class SharingTests(TestCase):
    """The talent can switch a project to shared. Their creators then see it, read-only."""

    def setUp(self):
        self.creator = make_user("creator@test.com", "creator")
        self.stranger = make_user("stranger@test.com", "creator")
        self.pending_creator = make_user("pending@test.com", "creator")
        self.talent = make_user("talent@test.com", "talent")
        HireRequest.objects.create(creator=self.creator, talent=self.talent, status="accepted")
        HireRequest.objects.create(creator=self.pending_creator, talent=self.talent, status="pending")
        self.project = Project.objects.create(creator=self.talent, name="Side gig")
        self.task = Task.objects.create(project=self.project, name="Sketch", status="planning")
        self.task.assignees.add(self.talent)

    def share(self, on=True):
        res = api(self.talent).patch(f"/api/v2/projects/{self.project.id}/", {"shared_with_creators": on}, format="json")
        self.assertEqual(res.status_code, 200, res.content)
        self.assertEqual(res.json()["shared_with_creators"], on)

    def test_sharing_is_off_until_the_talent_turns_it_on(self):
        self.assertFalse(api(self.talent).get(f"/api/v2/projects/{self.project.id}/").json()["shared_with_creators"])
        self.assertEqual(api(self.creator).get("/api/v2/projects/shared/").json(), [])

    def test_creators_who_hired_them_see_it_with_the_owner_name(self):
        self.share()
        rows = api(self.creator).get("/api/v2/projects/shared/").json()
        self.assertEqual([r["id"] for r in rows], [str(self.project.id)])
        self.assertEqual(rows[0]["owner_name"], "Talent")
        self.assertEqual(api(self.creator).get(f"/api/v2/projects/{self.project.id}/").status_code, 200)
        tasks = api(self.creator).get(f"/api/v2/projects/{self.project.id}/tasks/").json()
        self.assertEqual([t["name"] for t in tasks], ["Sketch"])
        self.assertEqual(api(self.creator).get(f"/api/v2/tasks/{self.task.id}/").status_code, 200)

    def test_it_stays_out_of_the_creators_own_project_list(self):
        self.share()
        self.assertEqual(api(self.creator).get("/api/v2/projects/").json(), [])

    def test_only_creators_who_hired_this_talent_can_see_it(self):
        self.share()
        for user in (self.stranger, self.pending_creator):
            client = api(user)
            self.assertEqual(client.get("/api/v2/projects/shared/").json(), [])
            self.assertEqual(client.get(f"/api/v2/projects/{self.project.id}/").status_code, 404)
            self.assertEqual(client.get(f"/api/v2/projects/{self.project.id}/tasks/").json(), [])
            self.assertEqual(client.get(f"/api/v2/tasks/{self.task.id}/").status_code, 404)

    def test_switching_it_off_hides_it_again(self):
        self.share(True)
        self.share(False)
        self.assertEqual(api(self.creator).get("/api/v2/projects/shared/").json(), [])
        self.assertEqual(api(self.creator).get(f"/api/v2/projects/{self.project.id}/").status_code, 404)

    def test_a_removed_team_member_no_longer_shares_with_that_creator(self):
        self.share()
        HireRequest.objects.filter(creator=self.creator, talent=self.talent).delete()
        self.assertEqual(api(self.creator).get("/api/v2/projects/shared/").json(), [])

    def test_the_creator_can_look_but_never_change(self):
        self.share()
        client = api(self.creator)
        pid, tid = self.project.id, self.task.id
        self.assertEqual(client.patch(f"/api/v2/projects/{pid}/", {"name": "x"}, format="json").status_code, 404)
        self.assertEqual(client.delete(f"/api/v2/projects/{pid}/").status_code, 404)
        self.assertEqual(client.patch(f"/api/v2/tasks/{tid}/", {"name": "x"}, format="json").status_code, 404)
        self.assertEqual(client.delete(f"/api/v2/tasks/{tid}/").status_code, 404)
        self.assertEqual(client.post(f"/api/v2/projects/{pid}/tasks/", {"name": "x", "status": "planning"}, format="json").status_code, 404)
        self.project.refresh_from_db()
        self.assertEqual(self.project.name, "Side gig")
        self.assertTrue(Task.objects.filter(id=tid).exists())

    def test_a_creator_cannot_turn_sharing_on_for_their_own_project(self):
        mine = Project.objects.create(creator=self.creator, name="Mine")
        res = api(self.creator).patch(f"/api/v2/projects/{mine.id}/", {"shared_with_creators": True}, format="json")
        self.assertEqual(res.status_code, 200)
        mine.refresh_from_db()
        self.assertFalse(mine.shared_with_creators)

    def test_the_shared_list_is_for_creators_only(self):
        self.share()
        self.assertEqual(api(self.talent).get("/api/v2/projects/shared/").json(), [])

    def test_a_shared_task_deadline_does_not_leak_into_the_creators_deadlines(self):
        self.share()
        self.task.deadline = "2030-01-01"
        self.task.save()
        res = api(self.creator).get("/api/v2/deadlines/")
        self.assertEqual(res.status_code, 200)
        self.assertNotIn("Sketch", res.content.decode())
