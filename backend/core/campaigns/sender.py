"""
SMTP sending for campaigns.

Cloud Run can't hold a 40-minute loop that sleeps 20-45s between emails (60s gunicorn
timeout, CPU throttled outside requests). Instead a scheduler calls send_tick() every
minute; each call sends whatever is due for up to ~45s and records the next slot in
Campaign.next_send_at. All state lives in the DB, so sends survive restarts and deploys.
"""
import logging
import random
import smtplib
import ssl
import time
from datetime import timedelta
from email.message import EmailMessage
from email.utils import formataddr, make_msgid

from django.core import signing
from django.core.exceptions import ImproperlyConfigured
from django.db.models import Min, Q
from django.utils import timezone

from .crypto import decrypt
from .models import Campaign, CampaignRecipient, EmailSuppression, SenderAccount

logger = logging.getLogger(__name__)

UNSUB_SALT = "campaigns.unsubscribe"
TICK_BUDGET_S = 45  # stays under the 60s gunicorn timeout
CAP_RETRY_MINUTES = 30


# ── Unsubscribe links ──────────────────────────────────────────────────────────

def unsubscribe_token(email):
    return signing.dumps(email.strip().lower(), salt=UNSUB_SALT, compress=True)


def email_from_token(token):
    """Raises signing.BadSignature if the token was tampered with."""
    return signing.loads(token, salt=UNSUB_SALT)


def unsubscribe_url(base_url, email):
    return f"{base_url.rstrip('/')}/api/v10/unsubscribe/{unsubscribe_token(email)}/"


# ── Rendering ──────────────────────────────────────────────────────────────────

def greeting_name(first_name):
    parts = (first_name or "").strip().split()
    return parts[0].title() if parts else "there"


def render(text, first_name, unsub_url=None):
    # str.replace, not str.format: a stray "{" in a campaign body must not crash a send.
    out = text.replace("{first_name}", greeting_name(first_name))
    if unsub_url is not None:
        if "{unsubscribe_link}" in out:
            out = out.replace("{unsubscribe_link}", unsub_url)
        else:
            out = out.rstrip() + f"\n\nUnsubscribe: {unsub_url}"
    return out


def build_message(sender, to_email, first_name, subject, body, base_url):
    unsub = unsubscribe_url(base_url, to_email)
    msg = EmailMessage()
    msg["Subject"] = render(subject, first_name)
    msg["From"] = formataddr((sender.from_name, sender.from_email))
    msg["To"] = to_email
    msg["Reply-To"] = sender.from_email
    msg["Message-ID"] = make_msgid(domain=sender.from_email.split("@")[-1])
    msg["List-Unsubscribe"] = f"<{unsub}>, <mailto:{sender.from_email}?subject=stop>"
    msg["List-Unsubscribe-Post"] = "List-Unsubscribe=One-Click"
    msg.set_content(render(body, first_name, unsub).strip("\n") + "\n")
    return msg


# ── SMTP ───────────────────────────────────────────────────────────────────────

def open_smtp(sender, timeout=20):
    """Logged-in SMTP connection for this sender. Port 465 = implicit TLS, else STARTTLS."""
    password = decrypt(sender.password_encrypted)
    ctx = ssl.create_default_context()
    if sender.smtp_port == 465:
        server = smtplib.SMTP_SSL(sender.smtp_host, sender.smtp_port, context=ctx, timeout=timeout)
    else:
        server = smtplib.SMTP(sender.smtp_host, sender.smtp_port, timeout=timeout)
    try:
        if sender.smtp_port != 465:
            server.ehlo()
            server.starttls(context=ctx)
            server.ehlo()
        server.login(sender.smtp_username, password)
    except Exception:
        try:
            server.close()
        except Exception:
            pass
        raise
    return server


def verify_sender(sender):
    """Log in without sending anything. Returns (ok, message)."""
    if not sender.password_encrypted:
        return False, "Add the mailbox password first."
    try:
        server = open_smtp(sender, timeout=15)
        server.quit()
    except smtplib.SMTPAuthenticationError:
        return False, "The mail server rejected the username or password. Use an app password if your provider requires one."
    except ImproperlyConfigured as e:
        return False, str(e)
    except (smtplib.SMTPException, OSError) as e:
        return False, f"Couldn't connect to {sender.smtp_host}:{sender.smtp_port} ({e.__class__.__name__})."
    return True, "Connected."


def send_single(sender, to_email, first_name, subject, body, base_url):
    """Send one email right away (used for test sends). Raises on failure."""
    server = open_smtp(sender)
    with server:
        server.send_message(build_message(sender, to_email, first_name, subject, body, base_url))


# ── Queue processing ───────────────────────────────────────────────────────────

def sent_in_last_day(sender):
    since = timezone.now() - timedelta(hours=24)
    return CampaignRecipient.objects.filter(
        campaign__sender=sender, status=CampaignRecipient.SENT, sent_at__gte=since
    ).count()


def skip_reason(campaign, recipient):
    if EmailSuppression.objects.filter(email=recipient.email).exists():
        return "Opted out"
    if campaign.exclude_previously_emailed and (
        CampaignRecipient.objects.filter(email=recipient.email, status=CampaignRecipient.SENT)
        .exclude(campaign=campaign)
        .exists()
    ):
        return "Already emailed by another campaign"
    return ""


def _pause(campaign, reason):
    Campaign.objects.filter(pk=campaign.pk).update(
        status=Campaign.PAUSED, next_send_at=None, last_error=reason
    )


def _process_campaign(campaign, base_url):
    """Send at most one email for this campaign. Returns 1 if an email went out."""
    now = timezone.now()
    gap = random.uniform(campaign.min_gap_s, max(campaign.max_gap_s, campaign.min_gap_s))

    # Claim this send slot so overlapping scheduler calls can't double-send.
    slot = Campaign.objects.filter(pk=campaign.pk, status=Campaign.SENDING)
    slot = (
        slot.filter(next_send_at__isnull=True)
        if campaign.next_send_at is None
        else slot.filter(next_send_at=campaign.next_send_at)
    )
    if not slot.update(next_send_at=now + timedelta(seconds=gap)):
        return 0

    sender = campaign.sender
    if sender is None or not sender.verified_at or not sender.password_encrypted:
        _pause(campaign, "The sending mailbox isn't connected and verified. Check Sender settings, then resume.")
        return 0

    if sent_in_last_day(sender) >= sender.daily_cap:
        Campaign.objects.filter(pk=campaign.pk).update(
            next_send_at=now + timedelta(minutes=CAP_RETRY_MINUTES),
            last_error=f"Daily limit of {sender.daily_cap} emails reached for {sender.from_email}. Sending resumes automatically.",
        )
        return 0

    while True:
        recipient = campaign.recipients.filter(status=CampaignRecipient.PENDING).order_by("id").first()
        if recipient is None:
            Campaign.objects.filter(pk=campaign.pk).update(
                status=Campaign.DONE, next_send_at=None, last_error=""
            )
            return 0
        reason = skip_reason(campaign, recipient)
        if not reason:
            break
        recipient.status, recipient.error = CampaignRecipient.SKIPPED, reason
        recipient.save(update_fields=["status", "error"])

    try:
        server = open_smtp(sender)
    except smtplib.SMTPAuthenticationError:
        SenderAccount.objects.filter(pk=sender.pk).update(verified_at=None)
        _pause(campaign, f"{sender.from_email} rejected the login. Update the password in Sender settings, then resume.")
        return 0
    except ImproperlyConfigured as e:
        _pause(campaign, str(e))
        return 0
    except (smtplib.SMTPException, OSError) as e:
        # Transient (network, server busy): the recipient stays pending for the next slot.
        logger.warning("campaign %s: SMTP connect failed: %s", campaign.pk, e)
        Campaign.objects.filter(pk=campaign.pk).update(last_error=f"Mail server unreachable, retrying ({e.__class__.__name__}).")
        return 0

    try:
        with server:
            server.send_message(
                build_message(sender, recipient.email, recipient.first_name, campaign.subject, campaign.body, base_url)
            )
    except (smtplib.SMTPException, OSError) as e:
        recipient.status, recipient.error = CampaignRecipient.FAILED, str(e)[:500]
        recipient.save(update_fields=["status", "error"])
        return 0

    recipient.status, recipient.error, recipient.sent_at = CampaignRecipient.SENT, "", timezone.now()
    recipient.save(update_fields=["status", "error", "sent_at"])
    if campaign.last_error:
        Campaign.objects.filter(pk=campaign.pk).update(last_error="")
    return 1


def send_tick(base_url, budget_s=TICK_BUDGET_S, sleep=time.sleep, clock=time.monotonic):
    """Send everything due within the time budget. Returns how many emails went out."""
    deadline = clock() + budget_s
    sent = 0
    while True:
        now = timezone.now()
        due = list(
            Campaign.objects.filter(status=Campaign.SENDING)
            .filter(Q(next_send_at__isnull=True) | Q(next_send_at__lte=now))
            .select_related("sender")
        )
        for campaign in due:
            sent += _process_campaign(campaign, base_url)
        if clock() >= deadline:
            break
        nxt = Campaign.objects.filter(status=Campaign.SENDING).aggregate(m=Min("next_send_at"))["m"]
        if nxt is None:
            if not due:
                break
            continue  # a campaign just became due with no slot yet
        wait = (nxt - timezone.now()).total_seconds()
        if wait > deadline - clock():
            break  # the next tick will pick it up
        if wait > 0:
            sleep(wait)
    return sent
