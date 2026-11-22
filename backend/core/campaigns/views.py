"""Email campaign API for the /admin panel. Mounted at /api/v10/."""
import hmac
import os
import smtplib

from django.core import signing
from django.core.exceptions import ImproperlyConfigured, ValidationError
from django.core.validators import validate_email
from django.db.models import Count, Q
from django.http import HttpResponse
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.utils.html import escape
from django.views.decorators.csrf import csrf_exempt
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from . import crypto
from .auth import SupabaseAdminAuthentication
from .models import Campaign, CampaignRecipient, EmailSuppression, SenderAccount
from .recipients import add_recipients, parse_csv, rows_from_users, users_queryset
from .sender import build_message, email_from_token, send_single, send_tick, sent_in_last_day, verify_sender

MAX_CSV_BYTES = 2 * 1024 * 1024
R = CampaignRecipient


def public_base_url(request):
    """Where unsubscribe links point. PUBLIC_API_URL wins; else the host that served this request."""
    return os.environ.get("PUBLIC_API_URL", "").rstrip("/") or request.build_absolute_uri("/").rstrip("/")


def _valid_email(value):
    try:
        validate_email(value)
        return True
    except ValidationError:
        return False


def _err(message, code=400):
    return Response({"error": message}, status=code)


class AdminAPIView(APIView):
    authentication_classes = [SupabaseAdminAuthentication]
    permission_classes = [IsAuthenticated]


# ── Serializers (plain dicts; the shapes are small) ────────────────────────────

def sender_json(s):
    if s is None:
        return None
    return {
        "from_name": s.from_name,
        "from_email": s.from_email,
        "smtp_host": s.smtp_host,
        "smtp_port": s.smtp_port,
        "smtp_username": s.smtp_username,
        "has_password": bool(s.password_encrypted),
        "daily_cap": s.daily_cap,
        "verified_at": s.verified_at,
        "sent_last_24h": sent_in_last_day(s),
    }


COUNT_ANNOTATIONS = {
    "total": Count("recipients"),
    "pending": Count("recipients", filter=Q(recipients__status=R.PENDING)),
    "sent": Count("recipients", filter=Q(recipients__status=R.SENT)),
    "failed": Count("recipients", filter=Q(recipients__status=R.FAILED)),
    "skipped": Count("recipients", filter=Q(recipients__status=R.SKIPPED)),
}


def campaign_json(c):
    return {
        "id": c.id,
        "name": c.name,
        "subject": c.subject,
        "body": c.body,
        "exclude_previously_emailed": c.exclude_previously_emailed,
        "status": c.status,
        "created_by": c.created_by,
        "started_by": c.started_by,
        "sender": {"from_name": c.sender.from_name, "from_email": c.sender.from_email} if c.sender else None,
        "last_error": c.last_error,
        "next_send_at": c.next_send_at,
        "created_at": c.created_at,
        "updated_at": c.updated_at,
        "counts": {k: getattr(c, k, 0) for k in COUNT_ANNOTATIONS},
    }


def _campaign(pk):
    return get_object_or_404(
        Campaign.objects.select_related("sender").annotate(**COUNT_ANNOTATIONS), pk=pk
    )


def _reopen_if_done(campaign, result):
    """New recipients on a finished campaign: move it to paused so it can be resumed."""
    if result["added"] and campaign.status == Campaign.DONE:
        Campaign.objects.filter(pk=campaign.pk).update(status=Campaign.PAUSED)


def _my_sender(request):
    return SenderAccount.objects.filter(admin_email=request.user.email).first()


# ── Who am I ───────────────────────────────────────────────────────────────────

class MeView(AdminAPIView):
    def get(self, request):
        return Response({"email": request.user.email, "sender": sender_json(_my_sender(request))})


# ── Sender (the caller's own mailbox) ──────────────────────────────────────────

class SenderMeView(AdminAPIView):
    def get(self, request):
        return Response({"sender": sender_json(_my_sender(request))})

    def put(self, request):
        d = request.data
        s = _my_sender(request) or SenderAccount(admin_email=request.user.email)
        from_name = (d.get("from_name") or "").strip()
        from_email = (d.get("from_email") or "").strip().lower()
        host = (d.get("smtp_host") or "").strip()
        username = (d.get("smtp_username") or "").strip()
        password = d.get("password") or ""
        try:
            port = int(d.get("smtp_port") or 465)
            cap = int(d.get("daily_cap") or 300)
        except (TypeError, ValueError):
            return _err("Port and daily limit must be numbers.")
        if not from_name or not host or not username:
            return _err("Name, SMTP host and username are required.")
        if not _valid_email(from_email):
            return _err("Enter a valid From email address.")
        if not 1 <= port <= 65535:
            return _err("Enter a valid SMTP port (usually 465 or 587).")
        if not 1 <= cap <= 2000:
            return _err("Daily limit must be between 1 and 2000.")
        if not s.pk and not password:
            return _err("Enter the mailbox password (an app password for Gmail or Zoho with 2FA).")

        login_changed = (host, port, username) != (s.smtp_host, s.smtp_port, s.smtp_username) or bool(password)
        s.from_name, s.from_email, s.smtp_host, s.smtp_port = from_name, from_email, host, port
        s.smtp_username, s.daily_cap = username, cap
        if password:
            try:
                s.password_encrypted = crypto.encrypt(password)
            except ImproperlyConfigured as e:
                return _err(str(e), 503)
        if login_changed:
            s.verified_at = None
        s.save()
        return Response({"sender": sender_json(s)})


class SenderVerifyView(AdminAPIView):
    def post(self, request):
        s = _my_sender(request)
        if s is None:
            return _err("Save your mailbox settings first.")
        ok, message = verify_sender(s)
        if ok:
            s.verified_at = timezone.now()
            s.save(update_fields=["verified_at"])
        return Response({"ok": ok, "message": message, "sender": sender_json(s)}, status=200 if ok else 400)


# ── Campaigns ──────────────────────────────────────────────────────────────────

class CampaignListView(AdminAPIView):
    def get(self, request):
        qs = Campaign.objects.select_related("sender").annotate(**COUNT_ANNOTATIONS)
        return Response({"campaigns": [campaign_json(c) for c in qs]})

    def post(self, request):
        d = request.data
        name = (d.get("name") or "").strip()
        if not name:
            return _err("Give the campaign a name.")
        c = Campaign.objects.create(
            name=name[:200],
            subject=(d.get("subject") or "").strip()[:300],
            body=d.get("body") or "",
            exclude_previously_emailed=bool(d.get("exclude_previously_emailed", True)),
            created_by=request.user.email,
        )
        return Response({"campaign": campaign_json(_campaign(c.pk))}, status=201)


class CampaignDetailView(AdminAPIView):
    def get(self, request, pk):
        return Response({"campaign": campaign_json(_campaign(pk))})

    def patch(self, request, pk):
        c = _campaign(pk)
        if c.status == Campaign.SENDING:
            return _err("Pause the campaign before editing it.", 409)
        d = request.data
        if "name" in d:
            if not (d["name"] or "").strip():
                return _err("Give the campaign a name.")
            c.name = d["name"].strip()[:200]
        if "subject" in d:
            c.subject = (d["subject"] or "").strip()[:300]
        if "body" in d:
            c.body = d["body"] or ""
        if "exclude_previously_emailed" in d:
            c.exclude_previously_emailed = bool(d["exclude_previously_emailed"])
        c.save()
        return Response({"campaign": campaign_json(_campaign(pk))})

    def delete(self, request, pk):
        c = _campaign(pk)
        if c.status == Campaign.SENDING:
            return _err("Pause the campaign before deleting it.", 409)
        c.delete()
        return Response(status=204)


class CampaignCsvView(AdminAPIView):
    def post(self, request, pk):
        c = _campaign(pk)
        f = request.FILES.get("file")
        if f is None:
            return _err("Attach a CSV file.")
        if f.size > MAX_CSV_BYTES:
            return _err("That file is over 2 MB. Split it into smaller uploads.")
        try:
            rows, invalid = parse_csv(f.read())
        except ValueError as e:
            return _err(str(e))
        result = add_recipients(c, rows, "csv")
        result["invalid"] = invalid
        _reopen_if_done(c, result)
        return Response({"result": result, "campaign": campaign_json(_campaign(pk))})


class CampaignUsersView(AdminAPIView):
    """POST {filters..., preview: bool}. preview=true only counts matches."""

    def post(self, request, pk):
        c = _campaign(pk)
        d = request.data
        try:
            qs = users_queryset(d)
            matched = qs.count()
        except (TypeError, ValueError, ValidationError):
            return _err("Check the filter values.")
        if d.get("preview"):
            return Response({"matched": matched, "sample": list(qs.values_list("email", flat=True)[:5])})
        result = add_recipients(c, rows_from_users(qs), "user")
        _reopen_if_done(c, result)
        return Response({"result": result, "campaign": campaign_json(_campaign(pk))})


class CampaignRecipientsView(AdminAPIView):
    PAGE = 100

    def get(self, request, pk):
        c = _campaign(pk)
        qs = c.recipients.all()
        status = request.query_params.get("status")
        if status in dict(R.STATUS_CHOICES):
            qs = qs.filter(status=status)
        q = (request.query_params.get("q") or "").strip().lower()
        if q:
            qs = qs.filter(Q(email__icontains=q) | Q(first_name__icontains=q))
        try:
            offset = max(int(request.query_params.get("offset", 0)), 0)
        except ValueError:
            offset = 0
        total = qs.count()
        page = qs[offset:offset + self.PAGE]
        return Response({
            "total": total,
            "offset": offset,
            "recipients": [
                {"id": r.id, "email": r.email, "first_name": r.first_name, "source": r.source,
                 "status": r.status, "error": r.error, "sent_at": r.sent_at}
                for r in page
            ],
        })


class CampaignRecipientDeleteView(AdminAPIView):
    def delete(self, request, pk, rid):
        r = get_object_or_404(R, pk=rid, campaign_id=pk)
        if r.status != R.PENDING:
            return _err("Only recipients who haven't been emailed can be removed.", 409)
        r.delete()
        return Response(status=204)


class CampaignClearPendingView(AdminAPIView):
    def post(self, request, pk):
        c = _campaign(pk)
        if c.status == Campaign.SENDING:
            return _err("Pause the campaign first.", 409)
        deleted, _ = c.recipients.filter(status=R.PENDING).delete()
        return Response({"removed": deleted, "campaign": campaign_json(_campaign(pk))})


class CampaignRetryFailedView(AdminAPIView):
    def post(self, request, pk):
        c = _campaign(pk)
        n = c.recipients.filter(status=R.FAILED).update(status=R.PENDING, error="")
        if n and c.status == Campaign.DONE:
            Campaign.objects.filter(pk=c.pk).update(status=Campaign.PAUSED)
        return Response({"requeued": n, "campaign": campaign_json(_campaign(pk))})


class CampaignPreviewView(AdminAPIView):
    def get(self, request, pk):
        c = _campaign(pk)
        sample = c.recipients.filter(status=R.PENDING).first() or c.recipients.first()
        to = sample.email if sample else "someone@example.com"
        first = sample.first_name if sample else "Alex"
        sender = c.sender if c.status == Campaign.SENDING and c.sender else _my_sender(request)
        placeholder = SenderAccount(from_name="Your name", from_email="you@onswift.org")
        msg = build_message(sender or placeholder, to, first, c.subject, c.body, public_base_url(request))
        return Response({"from": msg["From"], "to": to, "subject": msg["Subject"], "body": msg.get_content()})


class CampaignTestView(AdminAPIView):
    def post(self, request, pk):
        c = _campaign(pk)
        to = (request.data.get("email") or "").strip().lower()
        if not _valid_email(to):
            return _err("Enter a valid email address for the test.")
        if not c.subject.strip() or not c.body.strip():
            return _err("Add a subject and body first.")
        s = _my_sender(request)
        if s is None or not s.password_encrypted:
            return _err("Connect your mailbox in Sender settings first.")
        sample = c.recipients.filter(status=R.PENDING).first()
        try:
            send_single(s, to, sample.first_name if sample else "", c.subject, c.body, public_base_url(request))
        except smtplib.SMTPAuthenticationError:
            SenderAccount.objects.filter(pk=s.pk).update(verified_at=None)
            return _err("Your mail server rejected the login. Check Sender settings.")
        except ImproperlyConfigured as e:
            return _err(str(e), 503)
        except (smtplib.SMTPException, OSError) as e:
            return _err(f"The test didn't send ({e.__class__.__name__}: {str(e)[:200]}).", 502)
        if not s.verified_at:
            SenderAccount.objects.filter(pk=s.pk).update(verified_at=timezone.now())
        return Response({"ok": True, "message": f"Test sent to {to}."})


class CampaignStartView(AdminAPIView):
    def post(self, request, pk):
        c = _campaign(pk)
        if c.status not in (Campaign.DRAFT, Campaign.PAUSED):
            return _err("This campaign can't be started from its current state.", 409)
        if not c.subject.strip() or not c.body.strip():
            return _err("Add a subject and body first.")
        s = _my_sender(request)
        if s is None or not s.verified_at:
            return _err("Connect and verify your mailbox in Sender settings first.")
        if not c.recipients.filter(status=R.PENDING).exists():
            return _err("There's nobody left to email. Add recipients first.")
        Campaign.objects.filter(pk=c.pk).update(
            status=Campaign.SENDING, sender=s, started_by=request.user.email,
            next_send_at=None, last_error="",
        )
        return Response({"campaign": campaign_json(_campaign(pk))})


class CampaignPauseView(AdminAPIView):
    def post(self, request, pk):
        c = _campaign(pk)
        if c.status != Campaign.SENDING:
            return _err("This campaign isn't sending.", 409)
        Campaign.objects.filter(pk=c.pk).update(status=Campaign.PAUSED, next_send_at=None)
        return Response({"campaign": campaign_json(_campaign(pk))})


# ── Opt-outs ───────────────────────────────────────────────────────────────────

class SuppressionListView(AdminAPIView):
    def get(self, request):
        qs = EmailSuppression.objects.all()
        q = (request.query_params.get("q") or "").strip().lower()
        if q:
            qs = qs.filter(email__icontains=q)
        return Response({
            "total": qs.count(),
            "suppressions": [
                {"id": s.id, "email": s.email, "reason": s.reason, "added_by": s.added_by, "created_at": s.created_at}
                for s in qs[:500]
            ],
        })

    def post(self, request):
        d = request.data
        raw = d.get("emails")
        if raw is None:
            raw = [d.get("email") or ""]
        elif isinstance(raw, str):
            raw = raw.replace(",", "\n").split()
        entries = [(e or "").strip().lower() for e in raw]
        entries = [e for e in entries if e]
        if not entries:
            return _err("Enter at least one email address.")
        reason = d.get("reason") if d.get("reason") in dict(EmailSuppression.REASON_CHOICES) else "manual"
        added, invalid = 0, 0
        for e in entries:
            if not _valid_email(e):
                invalid += 1
                continue
            _, created = EmailSuppression.objects.get_or_create(
                email=e, defaults={"reason": reason, "added_by": request.user.email}
            )
            added += int(created)
        return Response({"added": added, "invalid": invalid}, status=201)


class SuppressionDeleteView(AdminAPIView):
    def delete(self, request, sid):
        get_object_or_404(EmailSuppression, pk=sid).delete()
        return Response(status=204)


# ── Scheduler entry point ──────────────────────────────────────────────────────

class SendDueView(APIView):
    """POST /campaigns/send-due/ -> called every minute by Cloud Scheduler. Requires X-Cron-Token."""
    authentication_classes = []
    permission_classes = [AllowAny]

    def post(self, request):
        expected = os.environ.get("DIGEST_CRON_TOKEN")
        if not expected:
            return _err("Campaign sending is not configured.", 503)
        provided = request.headers.get("X-Cron-Token", "")
        if not hmac.compare_digest(provided.encode(), expected.encode()):
            return _err("Forbidden.", 403)
        return Response({"sent": send_tick(public_base_url(request))})


# ── Public unsubscribe page ────────────────────────────────────────────────────

_PAGE = """<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>OnSwift email preferences</title>
<style>body{{font-family:Roboto,system-ui,sans-serif;background:#fef7ff;color:#1d1b20;display:grid;place-items:center;min-height:100vh;margin:0;padding:16px}}
.card{{background:#f3edf7;border-radius:28px;padding:32px;max-width:420px;width:100%;box-sizing:border-box}}
h1{{font-size:24px;font-weight:400;margin:0 0 12px}}p{{line-height:1.5;color:#49454f}}
button{{background:#6750a4;color:#fff;border:0;border-radius:20px;padding:10px 24px;font-size:14px;font-weight:500;cursor:pointer}}</style>
</head><body><div class="card">{content}</div></body></html>"""


@csrf_exempt
def unsubscribe_view(request, token):
    try:
        email = email_from_token(token)
    except signing.BadSignature:
        return HttpResponse(_PAGE.format(content="<h1>Link not valid</h1><p>This unsubscribe link is broken. Reply to the email with &ldquo;stop&rdquo; and we&rsquo;ll remove you.</p>"), status=400)
    if request.method == "POST":  # the button below, or a mail client's one-click unsubscribe
        EmailSuppression.objects.get_or_create(email=email, defaults={"reason": "unsubscribed", "added_by": "unsubscribe link"})
        return HttpResponse(_PAGE.format(content=f"<h1>You&rsquo;re unsubscribed</h1><p>{escape(email)} won&rsquo;t get these emails from OnSwift again.</p>"))
    # GET only shows a confirm button, so link scanners that open URLs don't unsubscribe people.
    return HttpResponse(_PAGE.format(content=(
        f"<h1>Unsubscribe?</h1><p>Stop OnSwift update emails to <strong>{escape(email)}</strong>.</p>"
        f'<form method="post"><button type="submit">Unsubscribe</button></form>'
    )))
