import datetime as dt
import re
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.contrib.auth.tokens import PasswordResetTokenGenerator
from django.core import mail
from django.core.cache import cache
from django.test import TestCase, override_settings
from django.utils import timezone
from django.utils.encoding import force_bytes
from django.utils.http import urlsafe_base64_encode
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from .otp import (
    OTP_EXPIRED,
    OTP_INVALID,
    OTP_LOCKED,
    OTP_MAX_ATTEMPTS,
    OTP_NONE,
    OTP_OK,
    generate_and_send_otp,
    verify_otp,
)

User = get_user_model()


def make_user(email="a@test.com", verified=False, role="creator"):
    return User.objects.create_user(
        email=email,
        full_name=email,
        password="Str0ng-pass-123",
        role=role,
        email_verified=verified,
    )


def sent_code():
    """The most recent 6-digit code from the (locmem) test outbox."""
    return re.search(r"\b(\d{6})\b", mail.outbox[-1].body).group(1)


def auth(client, user):
    token = RefreshToken.for_user(user).access_token
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")


@override_settings(EMAIL_VERIFICATION_REQUIRED=True)
class OtpCoreTests(TestCase):
    def setUp(self):
        cache.clear()
        self.user = make_user()

    def test_code_is_stored_hashed_not_plaintext(self):
        generate_and_send_otp(self.user)
        code = sent_code()
        self.user.refresh_from_db()
        self.assertNotEqual(self.user.otp_code, code)
        self.assertEqual(len(self.user.otp_code), 64)

    def test_correct_code_verifies_and_is_single_use(self):
        generate_and_send_otp(self.user)
        code = sent_code()
        self.assertEqual(verify_otp(self.user, code), OTP_OK)
        self.user.refresh_from_db()
        self.assertTrue(self.user.email_verified)
        self.assertIsNone(self.user.otp_code)
        self.assertEqual(verify_otp(self.user, code), OTP_NONE)

    def test_wrong_codes_lock_and_burn_the_real_code(self):
        generate_and_send_otp(self.user)
        code = sent_code()
        wrong = "000000" if code != "000000" else "111111"
        for _ in range(OTP_MAX_ATTEMPTS - 1):
            self.assertEqual(verify_otp(self.user, wrong), OTP_INVALID)
        self.assertEqual(verify_otp(self.user, wrong), OTP_LOCKED)
        # The right code no longer works: the user has to request a new one.
        self.assertEqual(verify_otp(self.user, code), OTP_NONE)
        self.user.refresh_from_db()
        self.assertFalse(self.user.email_verified)

    def test_expired_code_is_rejected(self):
        generate_and_send_otp(self.user)
        code = sent_code()
        self.user.otp_expires_at = timezone.now() - dt.timedelta(seconds=1)
        self.user.save(update_fields=["otp_expires_at"])
        self.assertEqual(verify_otp(self.user, code), OTP_EXPIRED)

    def test_failed_send_returns_false_and_clears_cooldown(self):
        with patch("account.otp.send_mail", side_effect=OSError("smtp down")):
            self.assertFalse(generate_and_send_otp(self.user))
        self.user.refresh_from_db()
        self.assertIsNone(self.user.otp_sent_at)


@override_settings(EMAIL_VERIFICATION_REQUIRED=True)
class OtpEndpointTests(TestCase):
    def setUp(self):
        cache.clear()
        self.user = make_user()
        self.client = APIClient()
        auth(self.client, self.user)

    def test_resend_cooldown_then_allowed(self):
        self.assertEqual(self.client.post("/api/v1/auth/resend-otp/").status_code, 200)
        self.assertEqual(self.client.post("/api/v1/auth/resend-otp/").status_code, 429)
        self.user.refresh_from_db()
        self.user.otp_sent_at = timezone.now() - dt.timedelta(seconds=61)
        self.user.save(update_fields=["otp_sent_at"])
        self.assertEqual(self.client.post("/api/v1/auth/resend-otp/").status_code, 200)

    def test_resend_reports_failed_send(self):
        with patch("account.otp.send_mail", side_effect=OSError("smtp down")):
            res = self.client.post("/api/v1/auth/resend-otp/")
        self.assertEqual(res.status_code, 503)

    def test_verify_endpoint_lockout(self):
        self.client.post("/api/v1/auth/resend-otp/")
        code = sent_code()
        wrong = "000000" if code != "000000" else "111111"
        for _ in range(OTP_MAX_ATTEMPTS - 1):
            self.assertEqual(
                self.client.post("/api/v1/auth/verify-otp/", {"code": wrong}, format="json").status_code, 400
            )
        res = self.client.post("/api/v1/auth/verify-otp/", {"code": wrong}, format="json")
        self.assertEqual(res.status_code, 429)

    def test_verify_endpoint_happy_path(self):
        self.client.post("/api/v1/auth/resend-otp/")
        res = self.client.post("/api/v1/auth/verify-otp/", {"code": sent_code()}, format="json")
        self.assertEqual(res.status_code, 200)
        self.user.refresh_from_db()
        self.assertTrue(self.user.email_verified)


@override_settings(EMAIL_VERIFICATION_REQUIRED=True)
class ServerSideGateTests(TestCase):
    def setUp(self):
        cache.clear()

    def test_unverified_token_is_blocked_outside_verification_endpoints(self):
        client = APIClient()
        auth(client, make_user("u@test.com", verified=False))
        res = client.get("/api/v2/projects/")
        self.assertEqual(res.status_code, 403)
        self.assertEqual(res.json()["code"], "email_not_verified")

    def test_unverified_token_can_reach_verification_endpoints(self):
        client = APIClient()
        auth(client, make_user("u@test.com", verified=False))
        self.assertEqual(client.get("/api/v1/auth/user/").status_code, 200)
        self.assertEqual(client.post("/api/v1/auth/resend-otp/").status_code, 200)

    def test_verified_user_is_unaffected(self):
        client = APIClient()
        auth(client, make_user("v@test.com", verified=True))
        self.assertEqual(client.get("/api/v2/projects/").status_code, 200)


@override_settings(EMAIL_VERIFICATION_REQUIRED=True)
class LoginAndSignupTests(TestCase):
    def setUp(self):
        cache.clear()
        self.client = APIClient()

    def test_login_of_unverified_user_sends_a_code_once(self):
        make_user("u@test.com", verified=False)
        body = {"email": "u@test.com", "password": "Str0ng-pass-123"}
        self.assertEqual(self.client.post("/api/v1/auth/login/", body, format="json").status_code, 200)
        self.assertEqual(len(mail.outbox), 1)
        # A second login inside the cooldown must not send another email.
        self.assertEqual(self.client.post("/api/v1/auth/login/", body, format="json").status_code, 200)
        self.assertEqual(len(mail.outbox), 1)

    def test_login_of_verified_user_sends_nothing(self):
        make_user("v@test.com", verified=True)
        body = {"email": "v@test.com", "password": "Str0ng-pass-123"}
        self.client.post("/api/v1/auth/login/", body, format="json")
        self.assertEqual(len(mail.outbox), 0)

    def test_signup_rejects_weak_password(self):
        res = self.client.post(
            "/api/v1/auth/signup/",
            {"email": "n@test.com", "full_name": "N", "password": "12345678", "role": "creator"},
            format="json",
        )
        self.assertEqual(res.status_code, 400)
        self.assertIn("password", res.json())

    def test_signup_creates_unverified_user_and_sends_code(self):
        res = self.client.post(
            "/api/v1/auth/signup/",
            {"email": "n@test.com", "full_name": "N", "password": "Str0ng-pass-123", "role": "creator"},
            format="json",
        )
        self.assertEqual(res.status_code, 201)
        self.assertFalse(User.objects.get(email="n@test.com").email_verified)
        self.assertGreaterEqual(len(mail.outbox), 1)


@override_settings(EMAIL_VERIFICATION_REQUIRED=False)
class VerificationSwitchedOffTests(TestCase):
    """The default while mail is not set up: nobody is held at /verify-email and no code is emailed."""

    def setUp(self):
        cache.clear()
        self.client = APIClient()

    def test_signup_sends_no_code_and_the_new_user_is_not_blocked(self):
        res = self.client.post(
            "/api/v1/auth/signup/",
            {"email": "n@test.com", "full_name": "N", "password": "Str0ng-pass-123", "role": "creator"},
            format="json",
        )
        self.assertEqual(res.status_code, 201)
        self.assertEqual(len(mail.outbox), 0)
        self.assertTrue(res.json()["user"]["email_verified"])
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {res.json()['access']}")
        self.assertNotEqual(self.client.get("/api/v2/projects/").status_code, 403)

    def test_an_unverified_user_can_log_in_and_use_the_api_without_any_email(self):
        user = make_user("u@test.com", verified=False)
        res = self.client.post("/api/v1/auth/login/", {"email": "u@test.com", "password": "Str0ng-pass-123"}, format="json")
        self.assertEqual(res.status_code, 200)
        self.assertTrue(res.json()["user"]["email_verified"])
        self.assertEqual(len(mail.outbox), 0)
        auth(self.client, user)
        self.assertNotEqual(self.client.get("/api/v2/projects/").status_code, 403)

    def test_the_stored_flag_is_left_alone_so_switching_it_on_later_still_asks(self):
        make_user("u@test.com", verified=False)
        self.assertFalse(User.objects.get(email="u@test.com").email_verified)
        with override_settings(EMAIL_VERIFICATION_REQUIRED=True):
            user = User.objects.get(email="u@test.com")
            auth(self.client, user)
            self.assertEqual(self.client.get("/api/v2/projects/").status_code, 403)


@override_settings(EMAIL_VERIFICATION_REQUIRED=True)
class GoogleTests(TestCase):
    def setUp(self):
        cache.clear()
        self.client = APIClient()

    def post(self, idinfo, **extra):
        with patch("account.serializers.id_token.verify_oauth2_token", return_value=idinfo):
            return self.client.post("/api/v1/auth/google/", {"token": "t", **extra}, format="json")

    def test_unverified_google_email_is_rejected(self):
        res = self.post({"email": "g@test.com", "name": "G", "email_verified": False})
        self.assertEqual(res.status_code, 400)

    def test_google_login_takes_over_preregistered_unverified_account(self):
        user = make_user("g@test.com", verified=False)
        res = self.post({"email": "g@test.com", "name": "G", "email_verified": True})
        self.assertEqual(res.status_code, 200)
        user.refresh_from_db()
        self.assertTrue(user.email_verified)
        # The squatter's password must no longer work.
        self.assertFalse(user.has_usable_password())


class PasswordResetTests(TestCase):
    def setUp(self):
        cache.clear()
        self.client = APIClient()

    def test_request_response_is_identical_for_known_and_unknown_email(self):
        make_user("k@test.com", verified=True)
        known = self.client.post("/api/v1/password-reset/", {"email": "k@test.com"}, format="json")
        unknown = self.client.post("/api/v1/password-reset/", {"email": "nobody@test.com"}, format="json")
        self.assertEqual(known.status_code, unknown.status_code)
        self.assertEqual(known.json(), unknown.json())

    def test_confirm_enforces_password_validation_and_verifies_email(self):
        user = make_user("k@test.com", verified=False)
        uid = urlsafe_base64_encode(force_bytes(user.pk))
        token = PasswordResetTokenGenerator().make_token(user)

        weak = self.client.post(
            "/api/v1/password-reset-confirm/",
            {"uid": uid, "token": token, "password": "12345678"},
            format="json",
        )
        self.assertEqual(weak.status_code, 400)

        ok = self.client.post(
            "/api/v1/password-reset-confirm/",
            {"uid": uid, "token": token, "password": "An0ther-Str0ng-pass"},
            format="json",
        )
        self.assertEqual(ok.status_code, 200)
        user.refresh_from_db()
        self.assertTrue(user.email_verified)
        self.assertTrue(user.check_password("An0ther-Str0ng-pass"))
