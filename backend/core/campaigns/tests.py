import os
import smtplib
from datetime import timedelta
from unittest import mock

from cryptography.fernet import Fernet
from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from . import crypto
from .auth import AdminPrincipal
from .models import Campaign, CampaignRecipient, EmailSuppression, SenderAccount
from .recipients import add_recipients, parse_csv
from .sender import email_from_token, render, send_tick, unsubscribe_token

KEY = Fernet.generate_key().decode()
ENV = {
    "CAMPAIGN_CREDS_KEY": KEY,
    "CAMPAIGN_ADMIN_EMAILS": "admin@onswift.org, second@onswift.org",
    "SUPABASE_URL": "https://example.supabase.co",
    "SUPABASE_ANON_KEY": "anon",
    "DIGEST_CRON_TOKEN": "cron-secret",
    "PUBLIC_API_URL": "https://api.example.com",
}
BASE = "/api/v10"
R = CampaignRecipient


class EnvTestCase(TestCase):
    """Patches the env for setUp and every test (a class decorator would skip setUp)."""

    def setUp(self):
        patcher = mock.patch.dict(os.environ, ENV)
        patcher.start()
        self.addCleanup(patcher.stop)
        cache.clear()


def make_sender(email="admin@onswift.org", verified=True, cap=300):
    return SenderAccount.objects.create(
        admin_email=email, from_name="Daniel", from_email=email, smtp_host="smtp.zoho.com",
        smtp_port=465, smtp_username=email, password_encrypted=crypto.encrypt("app-pass"),
        daily_cap=cap, verified_at=timezone.now() if verified else None,
    )


def make_campaign(**kw):
    defaults = dict(name="Win-back", subject="Hi {first_name}", body="Hello {first_name}\n\nBye {unsubscribe_link}",
                    created_by="admin@onswift.org")
    defaults.update(kw)
    return Campaign.objects.create(**defaults)


class CryptoAndRenderTests(EnvTestCase):
    def test_password_round_trip(self):
        token = crypto.encrypt("s3cret")
        self.assertNotIn("s3cret", token)
        self.assertEqual(crypto.decrypt(token), "s3cret")

    def test_render_fills_placeholders_and_tolerates_braces(self):
        out = render("Hi {first_name}, {weird} {unsubscribe_link}", "jane doe", "https://u")
        self.assertEqual(out, "Hi Jane, {weird} https://u")

    def test_render_appends_unsubscribe_when_missing_and_defaults_name(self):
        out = render("Hi {first_name}", "", "https://u")
        self.assertEqual(out, "Hi there\n\nUnsubscribe: https://u")

    def test_unsubscribe_token_round_trip(self):
        self.assertEqual(email_from_token(unsubscribe_token("Jane@Example.com")), "jane@example.com")


class CsvTests(EnvTestCase):
    def test_parse_normalises_headers_dedupes_and_skips_invalid(self):
        data = "﻿Email , First_Name\nJane@Example.com,jane\nbad-address,x\njane@example.com,dup\nbob@example.com,Bob Smith\n"
        rows, invalid = parse_csv(data.encode())
        self.assertEqual(invalid, 1)
        campaign = make_campaign()
        result = add_recipients(campaign, rows, "csv")
        self.assertEqual(result["added"], 2)
        self.assertEqual(result["duplicates"], 1)
        self.assertEqual(
            list(campaign.recipients.values_list("email", "first_name")),
            [("jane@example.com", "jane"), ("bob@example.com", "Bob")],
        )

    def test_requires_email_column(self):
        with self.assertRaises(ValueError):
            parse_csv(b"name\nJane\n")

    def test_opted_out_not_added_previously_emailed_reported(self):
        EmailSuppression.objects.create(email="stop@example.com")
        old = make_campaign(name="Old")
        R.objects.create(campaign=old, email="seen@example.com", status=R.SENT)
        result = add_recipients(make_campaign(), [
            {"email": "stop@example.com", "first_name": ""},
            {"email": "seen@example.com", "first_name": ""},
        ], "csv")
        self.assertEqual(result, {"added": 1, "duplicates": 0, "opted_out": 1, "previously_emailed": 1})


@mock.patch("campaigns.sender.smtplib.SMTP_SSL")
class SendTickTests(EnvTestCase):
    def setUp(self):
        super().setUp()
        self.sender = make_sender()
        self.campaign = make_campaign(status=Campaign.SENDING, sender=self.sender)

    def add(self, *emails):
        for e in emails:
            R.objects.create(campaign=self.campaign, email=e, first_name="Jane")

    def test_sends_one_then_schedules_gap_then_done(self, smtp):
        self.add("a@example.com", "b@example.com")
        sent = send_tick("https://api.example.com", budget_s=0)
        self.assertEqual(sent, 1)
        smtp.return_value.login.assert_called_with("admin@onswift.org", "app-pass")
        msg = smtp.return_value.send_message.call_args[0][0]
        self.assertEqual(msg["To"], "a@example.com")
        self.assertIn("https://api.example.com/api/v10/unsubscribe/", msg["List-Unsubscribe"])
        self.campaign.refresh_from_db()
        gap = (self.campaign.next_send_at - timezone.now()).total_seconds()
        self.assertTrue(15 <= gap <= 45, gap)

        # Not due yet: nothing goes out.
        self.assertEqual(send_tick("https://x", budget_s=0), 0)

        Campaign.objects.filter(pk=self.campaign.pk).update(next_send_at=timezone.now())
        self.assertEqual(send_tick("https://x", budget_s=0), 1)
        Campaign.objects.filter(pk=self.campaign.pk).update(next_send_at=timezone.now())
        send_tick("https://x", budget_s=0)
        self.campaign.refresh_from_db()
        self.assertEqual(self.campaign.status, Campaign.DONE)
        self.assertEqual(R.objects.filter(status=R.SENT).count(), 2)

    def test_waits_for_gap_within_budget(self, smtp):
        self.add("a@example.com", "b@example.com")
        clock = iter(range(0, 1000, 1))
        sleeps = []

        def fake_sleep(s):
            sleeps.append(s)
            Campaign.objects.filter(pk=self.campaign.pk).update(next_send_at=timezone.now())

        sent = send_tick("https://x", budget_s=100, sleep=fake_sleep, clock=lambda: next(clock))
        self.assertEqual(sent, 2)
        self.assertTrue(sleeps and all(15 <= w <= 45 for w in sleeps), sleeps)
        self.campaign.refresh_from_db()
        self.assertEqual(self.campaign.status, Campaign.DONE)

    def test_skips_suppressed_and_previously_emailed(self, smtp):
        EmailSuppression.objects.create(email="stop@example.com")
        R.objects.create(campaign=make_campaign(name="Old"), email="seen@example.com", status=R.SENT)
        self.add("stop@example.com", "seen@example.com", "ok@example.com")
        self.assertEqual(send_tick("https://x", budget_s=0), 1)
        statuses = dict(self.campaign.recipients.values_list("email", "status"))
        self.assertEqual(statuses, {"stop@example.com": R.SKIPPED, "seen@example.com": R.SKIPPED, "ok@example.com": R.SENT})

    def test_daily_cap_defers(self, smtp):
        self.sender.daily_cap = 1
        self.sender.save()
        R.objects.create(campaign=self.campaign, email="done@example.com", status=R.SENT, sent_at=timezone.now())
        self.add("a@example.com")
        self.assertEqual(send_tick("https://x", budget_s=0), 0)
        self.campaign.refresh_from_db()
        self.assertEqual(self.campaign.status, Campaign.SENDING)
        self.assertIn("Daily limit", self.campaign.last_error)
        self.assertGreater(self.campaign.next_send_at, timezone.now() + timedelta(minutes=20))
        smtp.assert_not_called()

    def test_auth_failure_pauses_and_unverifies(self, smtp):
        smtp.return_value.login.side_effect = smtplib.SMTPAuthenticationError(535, b"bad")
        self.add("a@example.com")
        send_tick("https://x", budget_s=0)
        self.campaign.refresh_from_db()
        self.sender.refresh_from_db()
        self.assertEqual(self.campaign.status, Campaign.PAUSED)
        self.assertIsNone(self.sender.verified_at)
        self.assertEqual(R.objects.get().status, R.PENDING)

    def test_recipient_refused_marks_failed_and_continues(self, smtp):
        smtp.return_value.send_message.side_effect = smtplib.SMTPRecipientsRefused({})
        self.add("a@example.com")
        send_tick("https://x", budget_s=0)
        self.assertEqual(R.objects.get().status, R.FAILED)


class ApiTests(EnvTestCase):
    def setUp(self):
        super().setUp()
        self.client = APIClient()
        self.client.force_authenticate(user=AdminPrincipal("admin@onswift.org"))

    def test_sender_password_is_write_only_and_change_resets_verified(self):
        r = self.client.put(f"{BASE}/senders/me/", {
            "from_name": "Daniel", "from_email": "admin@onswift.org", "smtp_host": "smtp.zoho.com",
            "smtp_port": 465, "smtp_username": "admin@onswift.org", "password": "app-pass",
        }, format="json")
        self.assertEqual(r.status_code, 200, r.data)
        self.assertNotIn("password", r.data["sender"])
        self.assertTrue(r.data["sender"]["has_password"])
        s = SenderAccount.objects.get()
        self.assertEqual(crypto.decrypt(s.password_encrypted), "app-pass")
        s.verified_at = timezone.now()
        s.save()
        self.client.put(f"{BASE}/senders/me/", {
            "from_name": "Dan", "from_email": "admin@onswift.org", "smtp_host": "smtp.zoho.com",
            "smtp_port": 465, "smtp_username": "admin@onswift.org",
        }, format="json")
        s.refresh_from_db()
        self.assertIsNotNone(s.verified_at)  # name-only change keeps verification
        self.assertEqual(crypto.decrypt(s.password_encrypted), "app-pass")
        self.client.put(f"{BASE}/senders/me/", {
            "from_name": "Dan", "from_email": "admin@onswift.org", "smtp_host": "smtp.gmail.com",
            "smtp_port": 465, "smtp_username": "admin@onswift.org",
        }, format="json")
        s.refresh_from_db()
        self.assertIsNone(s.verified_at)

    def test_each_admin_sees_only_their_own_sender(self):
        make_sender("second@onswift.org")
        r = self.client.get(f"{BASE}/senders/me/")
        self.assertIsNone(r.data["sender"])

    def test_campaign_flow_csv_and_start_requires_verified_sender(self):
        r = self.client.post(f"{BASE}/campaigns/", {"name": "Test", "subject": "Hi", "body": "Hello {first_name}"}, format="json")
        cid = r.data["campaign"]["id"]
        f = SimpleUploadedFile("leads.csv", b"email,first_name\na@example.com,Ann\n", content_type="text/csv")
        r = self.client.post(f"{BASE}/campaigns/{cid}/recipients/csv/", {"file": f}, format="multipart")
        self.assertEqual(r.data["result"]["added"], 1)
        self.assertEqual(r.data["campaign"]["counts"]["pending"], 1)

        self.assertEqual(self.client.post(f"{BASE}/campaigns/{cid}/start/").status_code, 400)
        make_sender()
        r = self.client.post(f"{BASE}/campaigns/{cid}/start/")
        self.assertEqual(r.status_code, 200, r.data)
        self.assertEqual(r.data["campaign"]["status"], "sending")
        self.assertEqual(self.client.patch(f"{BASE}/campaigns/{cid}/", {"name": "x"}, format="json").status_code, 409)
        self.assertEqual(self.client.post(f"{BASE}/campaigns/{cid}/pause/").data["campaign"]["status"], "paused")

    def test_users_filter_preview_and_add(self):
        User = get_user_model()
        User.objects.create_user(email="old@example.com", full_name="Olu Ade", password="x", role="creator")
        u = User.objects.create_user(email="active@example.com", full_name="Act", password="x", role="creator")
        u.last_login = timezone.now()
        u.save()
        cid = make_campaign().id
        r = self.client.post(f"{BASE}/campaigns/{cid}/recipients/users/", {"inactive_days": 30, "preview": True}, format="json")
        self.assertEqual(r.data["matched"], 1)
        r = self.client.post(f"{BASE}/campaigns/{cid}/recipients/users/", {"inactive_days": 30}, format="json")
        self.assertEqual(r.data["result"]["added"], 1)
        self.assertEqual(R.objects.get().first_name, "Olu")

    def test_suppressions_bulk_add(self):
        r = self.client.post(f"{BASE}/suppressions/", {"emails": "a@example.com, b@example.com\nnope"}, format="json")
        self.assertEqual(r.data, {"added": 2, "invalid": 1})

    def test_send_due_requires_token(self):
        anon = APIClient()
        self.assertEqual(anon.post(f"{BASE}/campaigns/send-due/").status_code, 403)
        r = anon.post(f"{BASE}/campaigns/send-due/", HTTP_X_CRON_TOKEN="cron-secret")
        self.assertEqual(r.data, {"sent": 0})

    def test_unsubscribe_get_confirms_post_suppresses(self):
        anon = APIClient()
        url = f"{BASE}/unsubscribe/{unsubscribe_token('jane@example.com')}/"
        self.assertEqual(anon.get(url).status_code, 200)
        self.assertFalse(EmailSuppression.objects.exists())
        anon.post(url)
        self.assertEqual(EmailSuppression.objects.get().reason, "unsubscribed")
        self.assertEqual(anon.get(f"{BASE}/unsubscribe/forged/").status_code, 400)


class SupabaseAuthTests(EnvTestCase):
    def _get(self, token="tok"):
        return APIClient().get(f"{BASE}/me/", HTTP_AUTHORIZATION=f"Bearer {token}")

    @mock.patch("campaigns.auth.requests.get")
    def test_allowlisted_admin_passes(self, get):
        get.return_value = mock.Mock(status_code=200, json=lambda: {"email": "Admin@OnSwift.org"})
        r = self._get()
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.data["email"], "admin@onswift.org")

    @mock.patch("campaigns.auth.requests.get")
    def test_supabase_user_not_on_allowlist_is_forbidden(self, get):
        get.return_value = mock.Mock(status_code=200, json=lambda: {"email": "random@example.com"})
        self.assertEqual(self._get().status_code, 403)

    @mock.patch("campaigns.auth.requests.get")
    def test_invalid_token_is_401(self, get):
        get.return_value = mock.Mock(status_code=401, json=lambda: {})
        self.assertEqual(self._get().status_code, 401)

    def test_no_token_is_401(self):
        self.assertEqual(APIClient().get(f"{BASE}/me/").status_code, 401)


class ImportCommandTests(EnvTestCase):
    def test_imports_sent_log_and_optouts_idempotently(self):
        import tempfile
        from django.core.management import call_command

        with tempfile.TemporaryDirectory() as d:
            sent, opt = os.path.join(d, "sent_log.txt"), os.path.join(d, "optouts.txt")
            with open(sent, "w", encoding="utf-8") as f:
                f.write("A@example.com\nb@example.com\n\n")
            with open(opt, "w", encoding="utf-8") as f:
                f.write("stop@example.com\n")
            for _ in range(2):
                call_command("import_winback_state", sent_log=sent, optouts=opt, stdout=open(os.devnull, "w"))
        c = Campaign.objects.get(name="Win-back")
        self.assertEqual(c.status, Campaign.DRAFT)
        self.assertIn("{unsubscribe_link}", c.body)
        self.assertEqual(sorted(c.recipients.filter(status=R.SENT).values_list("email", flat=True)), ["a@example.com", "b@example.com"])
        self.assertEqual(list(EmailSuppression.objects.values_list("email", flat=True)), ["stop@example.com"])
        # A later CSV upload to any campaign reports them as already emailed.
        result = add_recipients(make_campaign(name="Next"), [{"email": "a@example.com", "first_name": ""}], "csv")
        self.assertEqual(result["previously_emailed"], 1)
