import hmac
import logging
import os
from datetime import timedelta
from zoneinfo import ZoneInfo

from django.conf import settings as django_settings
from django.utils import timezone
from django.utils.html import escape
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from account.models import UserSettings
from utils.email_service import send_email

from .models import Deliverable, PersonalTask, Task

logger = logging.getLogger(__name__)


def _zone(name):
    try:
        return ZoneInfo(name)
    except Exception:
        return ZoneInfo("UTC")


def is_scheduled_day(user_settings, day):
    if user_settings.reminder_frequency == "daily":
        return True
    if user_settings.reminder_frequency == "weekends":
        return day.weekday() >= 5
    return day.weekday() == user_settings.reminder_weekday


def _item(task_id, name, project_id, project_name, deadline, kind):
    return {
        "id": str(task_id),
        "name": name,
        "project_id": str(project_id) if project_id else None,
        "project_name": project_name,
        "deadline": deadline.isoformat() if deadline else None,
        "kind": kind,
    }


def build_report(user, today):
    """What's left for `user`, bucketed relative to their local `today`."""
    week_end = today + timedelta(days=7)

    if user.role == "creator":
        base = Task.objects.filter(project__creator=user)
    else:
        base = Task.objects.filter(assignees=user)

    open_tasks = (
        base.exclude(status="completed")
        .filter(deadline__isnull=False)
        .select_related("project")
        .distinct()
    )
    entries = [
        _item(t.id, t.name, t.project_id, t.project.name, t.deadline, "project")
        for t in open_tasks
    ]
    entries += [
        _item(t.id, t.name, None, "Personal", t.deadline, "personal")
        for t in PersonalTask.objects.filter(owner=user, deadline__isnull=False).exclude(status="completed")
    ]
    entries.sort(key=lambda e: (e["deadline"], e["name"]))

    overdue = [e for e in entries if e["deadline"] < today.isoformat()]
    due_today = [e for e in entries if e["deadline"] == today.isoformat()]
    this_week = [e for e in entries if today.isoformat() < e["deadline"] <= week_end.isoformat()]

    needs_action = []
    if user.role == "creator":
        for t in base.filter(awaiting_approval=True).exclude(status="completed").select_related("project"):
            needs_action.append({**_item(t.id, t.name, t.project_id, t.project.name, t.deadline, "project"),
                                 "reason": "Completion awaiting your approval"})
        for d in Deliverable.objects.filter(task__project__creator=user, status="pending").select_related("task__project"):
            needs_action.append({**_item(d.task_id, d.title, d.task.project_id, d.task.project.name, d.task.deadline, "project"),
                                 "reason": "Deliverable awaiting your review"})
    else:
        for d in Deliverable.objects.filter(submitted_by=user, status="revision").select_related("task__project"):
            needs_action.append({**_item(d.task_id, d.title, d.task.project_id, d.task.project.name, d.task.deadline, "project"),
                                 "reason": "Revision requested"})

    return {
        "local_date": today.isoformat(),
        "counts": {
            "overdue": len(overdue),
            "today": len(due_today),
            "this_week": len(this_week),
            "needs_action": len(needs_action),
        },
        "overdue": overdue,
        "today": due_today,
        "this_week": this_week,
        "needs_action": needs_action,
    }


def _report_total(report):
    return sum(report["counts"].values())


def _render_email(user, report):
    c = report["counts"]
    subject = f"Your OnSwift report: {c['overdue']} overdue, {c['today']} due today"
    link = f"{(django_settings.FRONTEND_URL or '').rstrip('/')}/calendar"
    sections = [
        ("Overdue", report["overdue"]),
        ("Due today", report["today"]),
        ("Due this week", report["this_week"]),
        ("Needs your action", report["needs_action"]),
    ]
    text_lines = [f"Hi {user.full_name or 'there'}, here's what's left across your projects.", ""]
    html = [f"<p>Hi {escape(user.full_name or 'there')}, here's what's left across your projects.</p>"]
    for title, rows in sections:
        if not rows:
            continue
        text_lines.append(f"{title} ({len(rows)})")
        html.append(f"<h3 style='margin:16px 0 4px'>{escape(title)} ({len(rows)})</h3><ul>")
        for r in rows:
            extra = r.get("reason") or (f"due {r['deadline']}" if r["deadline"] else "")
            text_lines.append(f"  - {r['name']} [{r['project_name']}] {extra}")
            html.append(
                f"<li><strong>{escape(r['name'])}</strong> &middot; {escape(r['project_name'])}"
                f"{' &middot; ' + escape(extra) if extra else ''}</li>"
            )
        text_lines.append("")
        html.append("</ul>")
    text_lines.append(f"Open your deadlines: {link}")
    html.append(f"<p><a href='{escape(link)}'>Open your deadlines</a></p>")
    return subject, "\n".join(text_lines), "".join(html)


def send_due_digests(now=None):
    """Email every user whose schedule matches right now. Safe to call hourly."""
    now = now or timezone.now()
    sent = 0
    qs = UserSettings.objects.filter(reminder_enabled=True, reminder_email=True).select_related("user")
    for s in qs:
        try:
            local_now = now.astimezone(_zone(s.reminder_timezone))
            today = local_now.date()
            if s.last_reminder_sent_on == today:
                continue
            if not is_scheduled_day(s, today) or local_now.time() < s.reminder_time:
                continue
            report = build_report(s.user, today)
            if _report_total(report):
                subject, text, html = _render_email(s.user, report)
                send_email(s.user.email, subject, text, html)
                sent += 1
            s.last_reminder_sent_on = today
            s.save(update_fields=["last_reminder_sent_on"])
        except Exception:
            logger.exception("Digest failed for user %s", s.user_id)
    return sent


class ReminderReportView(APIView):
    """GET /reminders/report/ -> the user's current report plus whether today is a scheduled day."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        s, _ = UserSettings.objects.get_or_create(user=request.user)
        today = timezone.now().astimezone(_zone(s.reminder_timezone)).date()
        report = build_report(request.user, today)
        report["scheduled_today"] = bool(s.reminder_enabled and is_scheduled_day(s, today))
        return Response(report)


class SendDueDigestsView(APIView):
    """POST /reminders/send-due/ -> for a scheduler (e.g. hourly Cloud Scheduler). Requires X-Cron-Token."""
    authentication_classes = []
    permission_classes = [AllowAny]

    def post(self, request):
        expected = os.environ.get("DIGEST_CRON_TOKEN")
        if not expected:
            return Response({"error": "Digest sending is not configured."}, status=503)
        provided = request.headers.get("X-Cron-Token", "")
        if not hmac.compare_digest(provided.encode(), expected.encode()):
            return Response({"error": "Forbidden."}, status=403)
        return Response({"sent": send_due_digests()})
