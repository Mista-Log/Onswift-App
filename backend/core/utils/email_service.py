import logging
import threading
from django.core.mail import send_mail
from django.conf import settings

logger = logging.getLogger(__name__)


def _send(subject, body, to_email, html_body=None):
    """Internal: runs on a background thread."""
    from_email = settings.DEFAULT_FROM_EMAIL
    try:
        send_mail(
            subject=subject,
            message=body,
            from_email=from_email,
            recipient_list=[to_email],
            html_message=html_body,
            fail_silently=False,
        )
        logger.info("Email sent to %s: %s", to_email, subject)
    except Exception as exc:
        logger.error("Failed to send email to %s: %s", to_email, exc, exc_info=True)


def send_email(to_email: str, subject: str, body: str, html_body: str | None = None) -> None:
    """Send a single email off the request thread (fire-and-forget)."""
    t = threading.Thread(target=_send, args=(subject, body, to_email, html_body), daemon=True)
    t.start()
