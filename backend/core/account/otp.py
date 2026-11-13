import hashlib
import hmac
import logging
import math
import secrets
from datetime import timedelta

from django.conf import settings
from django.core.mail import send_mail
from django.db import transaction
from django.utils import timezone

logger = logging.getLogger(__name__)

OTP_TTL = timedelta(minutes=10)
OTP_MAX_ATTEMPTS = 5
OTP_RESEND_COOLDOWN = timedelta(seconds=60)

# verify_otp() results
OTP_OK = "ok"
OTP_INVALID = "invalid"
OTP_EXPIRED = "expired"
OTP_LOCKED = "locked"  # too many wrong guesses — the code has been burned
OTP_NONE = "none"  # no code pending


def is_email_verified(user):
    """What the app should treat as verified. With EMAIL_VERIFICATION_REQUIRED off everyone passes, so a
    broken mail service can never lock people out. The stored flag is left alone, so turning the setting
    on later still asks users who never verified to do so."""
    return (not settings.EMAIL_VERIFICATION_REQUIRED) or user.email_verified


def _hash_code(user, code):
    """Keyed hash of the code, bound to the user. Only this is stored."""
    return hmac.new(
        settings.SECRET_KEY.encode(), f"{user.pk}:{code}".encode(), hashlib.sha256
    ).hexdigest()


def has_live_otp(user):
    return bool(user.otp_code and user.otp_expires_at and timezone.now() <= user.otp_expires_at)


def resend_wait_seconds(user):
    """Seconds the user must still wait before another code may be sent (0 = none)."""
    if not user.otp_sent_at:
        return 0
    remaining = (user.otp_sent_at + OTP_RESEND_COOLDOWN - timezone.now()).total_seconds()
    return max(0, math.ceil(remaining))


def generate_and_send_otp(user):
    """Generate a 6-digit OTP, store its hash on the user, and email the code.
    Never raises: a failed send shouldn't block signup. Returns True if the
    email was handed to SMTP, False if sending failed."""
    code = f"{secrets.randbelow(10**6):06d}"
    user.otp_code = _hash_code(user, code)
    user.otp_expires_at = timezone.now() + OTP_TTL
    user.otp_attempts = 0
    user.otp_sent_at = timezone.now()
    user.save(update_fields=["otp_code", "otp_expires_at", "otp_attempts", "otp_sent_at"])
    try:
        send_mail(
            subject="Your OnSwift verification code",
            message=f"Your verification code is {code}. It expires in 10 minutes.",
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[user.email],
        )
        return True
    except Exception:
        logger.exception("Failed to send OTP email to %s", user.email)
        # Nothing was delivered, so don't make the user wait out the cooldown.
        user.otp_sent_at = None
        user.save(update_fields=["otp_sent_at"])
        return False


def verify_otp(user, code):
    """Check a submitted code. Single-use, constant-time compare, and at most
    OTP_MAX_ATTEMPTS wrong guesses before the code is burned. Returns one of
    the OTP_* constants; on OTP_OK the user is marked email_verified."""
    code = str(code or "").strip()
    with transaction.atomic():
        # Lock the row so concurrent guesses can't bypass the attempt counter.
        locked = type(user).objects.select_for_update().get(pk=user.pk)

        if not locked.otp_code or not locked.otp_expires_at:
            return OTP_NONE
        if timezone.now() > locked.otp_expires_at:
            return OTP_EXPIRED
        if locked.otp_attempts >= OTP_MAX_ATTEMPTS:
            return OTP_LOCKED

        if hmac.compare_digest(locked.otp_code, _hash_code(locked, code)):
            locked.email_verified = True
            locked.otp_code = None
            locked.otp_expires_at = None
            locked.otp_attempts = 0
            locked.save(update_fields=["email_verified", "otp_code", "otp_expires_at", "otp_attempts"])
            return OTP_OK

        locked.otp_attempts += 1
        if locked.otp_attempts >= OTP_MAX_ATTEMPTS:
            locked.otp_code = None
            locked.otp_expires_at = None
            locked.save(update_fields=["otp_attempts", "otp_code", "otp_expires_at"])
            return OTP_LOCKED
        locked.save(update_fields=["otp_attempts"])
        return OTP_INVALID
