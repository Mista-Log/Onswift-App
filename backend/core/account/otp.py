import logging
import random
from datetime import timedelta

from django.conf import settings
from django.core.mail import send_mail
from django.utils import timezone

logger = logging.getLogger(__name__)


def generate_and_send_otp(user):
    """Generate a 6-digit OTP, save it on the user, and email it.
    Never raises: a failed send shouldn't block signup or a resend request."""
    code = f"{random.randint(0, 999999):06d}"
    user.otp_code = code
    user.otp_expires_at = timezone.now() + timedelta(minutes=10)
    user.save(update_fields=["otp_code", "otp_expires_at"])
    try:
        send_mail(
            subject="Your OnSwift verification code",
            message=f"Your verification code is {code}. It expires in 10 minutes.",
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[user.email],
        )
    except Exception:
        logger.exception("Failed to send OTP email to %s", user.email)
