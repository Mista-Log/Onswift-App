import datetime as dt
import os
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from account.models import UserSettings

from .models import Deliverable, PersonalTask, Project, Task
from .reminders import build_report, is_scheduled_day, send_due_digests

User = get_user_model()

WED = dt.date(2026, 9, 23)  # a Wednesday
UTC = dt.timezone.utc


def make_user(email, role):
    return User.objects.create_user(email=email, full_name=email, password="pass1234", role=role)


class ReportTests(TestCase):
    def setUp(self):
        self.creator = make_user("c@test.com", "creator")
        self.talent = make_user("t@test.com", "talent")
        self.project = Project.objects.create(creator=self.creator, name="Alpha")

    def task(self, name, days, **kw):
        t = Task.objects.create(project=self.project, name=name, deadline=WED + dt.timedelta(days=days), **kw)
        t.assignees.add(self.talent)
        return t

    def test_buckets_and_exclusions(self):
        self.task("late", -2)
        self.task("now", 0)
        self.task("soon", 5)
        self.task("far", 20)
        self.task("done", -1, status="completed")
        PersonalTask.objects.create(owner=self.creator, name="mine", deadline=WED)

        report = build_report(self.creator, WED)
        self.assertEqual([i["name"] for i in report["overdue"]], ["late"])
        self.assertEqual(sorted(i["name"] for i in report["today"]), ["mine", "now"])
        self.assertEqual([i["name"] for i in report["this_week"]], ["soon"])

    def test_talent_only_sees_assigned_tasks(self):
        self.task("assigned", 0)
        Task.objects.create(project=self.project, name="other", deadline=WED)
        report = build_report(self.talent, WED)
        self.assertEqual([i["name"] for i in report["today"]], ["assigned"])

    def test_needs_action_for_creator_and_talent(self):
        awaiting = self.task("wait", 3, awaiting_approval=True)
        Deliverable.objects.create(task=awaiting, title="Draft", submitted_by=self.talent, status="pending")
        Deliverable.objects.create(task=awaiting, title="Logo", submitted_by=self.talent, status="revision")

        creator_reasons = sorted(i["reason"] for i in build_report(self.creator, WED)["needs_action"])
        self.assertEqual(creator_reasons, ["Completion awaiting your approval", "Deliverable awaiting your review"])
        talent_items = build_report(self.talent, WED)["needs_action"]
        self.assertEqual([i["reason"] for i in talent_items], ["Revision requested"])


class ScheduleTests(TestCase):
    def test_is_scheduled_day(self):
        s = UserSettings(reminder_frequency="daily")
        self.assertTrue(is_scheduled_day(s, WED))

        s = UserSettings(reminder_frequency="weekends")
        self.assertFalse(is_scheduled_day(s, WED))
        self.assertTrue(is_scheduled_day(s, dt.date(2026, 9, 26)))  # Saturday
        self.assertTrue(is_scheduled_day(s, dt.date(2026, 9, 27)))  # Sunday

        s = UserSettings(reminder_frequency="weekly", reminder_weekday=2)  # Wednesday
        self.assertTrue(is_scheduled_day(s, WED))
        self.assertFalse(is_scheduled_day(s, dt.date(2026, 9, 24)))


@patch("project.reminders.send_email")
class SendDigestTests(TestCase):
    def setUp(self):
        self.creator = make_user("c@test.com", "creator")
        project = Project.objects.create(creator=self.creator, name="Alpha")
        Task.objects.create(project=project, name="Due", deadline=WED)
        self.settings = UserSettings.objects.create(
            user=self.creator, reminder_enabled=True, reminder_frequency="daily",
            reminder_time=dt.time(8, 0), reminder_timezone="UTC",
        )
        self.noon = dt.datetime(2026, 9, 23, 12, 0, tzinfo=UTC)

    def test_sends_once_per_day(self, send_email):
        self.assertEqual(send_due_digests(self.noon), 1)
        self.assertEqual(send_email.call_count, 1)
        self.settings.refresh_from_db()
        self.assertEqual(self.settings.last_reminder_sent_on, WED)
        self.assertEqual(send_due_digests(self.noon), 0)

    def test_waits_until_delivery_time(self, send_email):
        early = dt.datetime(2026, 9, 23, 6, 0, tzinfo=UTC)
        self.assertEqual(send_due_digests(early), 0)

    def test_respects_timezone(self, send_email):
        self.settings.reminder_timezone = "Africa/Lagos"  # UTC+1
        self.settings.save()
        # 06:30 UTC is 07:30 in Lagos, before the 08:00 delivery time.
        self.assertEqual(send_due_digests(dt.datetime(2026, 9, 23, 6, 30, tzinfo=UTC)), 0)
        self.assertEqual(send_due_digests(dt.datetime(2026, 9, 23, 7, 30, tzinfo=UTC)), 1)

    def test_skips_off_days_disabled_and_email_off(self, send_email):
        self.settings.reminder_frequency = "weekends"
        self.settings.save()
        self.assertEqual(send_due_digests(self.noon), 0)

        self.settings.reminder_frequency = "daily"
        self.settings.reminder_enabled = False
        self.settings.save()
        self.assertEqual(send_due_digests(self.noon), 0)

        self.settings.reminder_enabled = True
        self.settings.reminder_email = False
        self.settings.save()
        self.assertEqual(send_due_digests(self.noon), 0)
        send_email.assert_not_called()

    def test_empty_report_is_not_emailed_but_marked_sent(self, send_email):
        Task.objects.all().delete()
        self.assertEqual(send_due_digests(self.noon), 0)
        send_email.assert_not_called()
        self.settings.refresh_from_db()
        self.assertEqual(self.settings.last_reminder_sent_on, WED)


class EndpointTests(TestCase):
    def setUp(self):
        self.user = make_user("c@test.com", "creator")
        self.api = APIClient()
        self.api.force_authenticate(user=self.user)

    def test_settings_round_trip_and_validation(self):
        res = self.api.patch("/api/v1/settings/", {
            "reminder_enabled": True, "reminder_frequency": "weekly",
            "reminder_weekday": 4, "reminder_time": "07:30:00",
            "reminder_timezone": "Africa/Lagos",
        }, format="json")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(self.api.get("/api/v1/settings/").data["reminder_frequency"], "weekly")

        bad = self.api.patch("/api/v1/settings/", {"reminder_timezone": "Mars/Base"}, format="json")
        self.assertEqual(bad.status_code, 400)
        bad = self.api.patch("/api/v1/settings/", {"reminder_weekday": 9}, format="json")
        self.assertEqual(bad.status_code, 400)

    def test_report_endpoint(self):
        UserSettings.objects.create(user=self.user, reminder_enabled=True, reminder_frequency="daily")
        res = self.api.get("/api/v2/reminders/report/")
        self.assertEqual(res.status_code, 200)
        self.assertTrue(res.data["scheduled_today"])
        self.assertIn("counts", res.data)

    def test_send_due_requires_token(self):
        anon = APIClient()
        env_without_token = {k: v for k, v in os.environ.items() if k != "DIGEST_CRON_TOKEN"}
        with patch.dict("os.environ", env_without_token, clear=True):
            self.assertEqual(anon.post("/api/v2/reminders/send-due/").status_code, 503)
        with patch.dict("os.environ", {"DIGEST_CRON_TOKEN": "s3cret"}):
            self.assertEqual(anon.post("/api/v2/reminders/send-due/").status_code, 403)
            self.assertEqual(
                anon.post("/api/v2/reminders/send-due/", HTTP_X_CRON_TOKEN="wrong").status_code, 403
            )
            with patch("project.reminders.send_due_digests", return_value=2):
                res = anon.post("/api/v2/reminders/send-due/", HTTP_X_CRON_TOKEN="s3cret")
            self.assertEqual(res.status_code, 200)
            self.assertEqual(res.data["sent"], 2)
