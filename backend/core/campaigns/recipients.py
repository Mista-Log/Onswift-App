"""Building recipient lists: CSV uploads (same rules as send_winback.py) and platform users."""
import csv
import io
from datetime import timedelta

from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError
from django.core.validators import validate_email
from django.db.models import Q
from django.utils import timezone

from .models import CampaignRecipient, EmailSuppression

MAX_ROWS = 5000
NAME_COLUMNS = ("first_name", "firstname", "first name", "full_name", "name")


def _valid(email):
    try:
        validate_email(email)
        return True
    except ValidationError:
        return False


def parse_csv(raw_bytes):
    """Returns ([{email, first_name}], invalid_count). Raises ValueError for unusable files."""
    text = raw_bytes.decode("utf-8-sig", errors="replace")
    reader = csv.DictReader(io.StringIO(text))
    fields = [(f or "").strip().lower() for f in (reader.fieldnames or [])]
    if "email" not in fields:
        raise ValueError("The CSV needs an 'email' column (first_name is optional).")
    rows, invalid = [], 0
    for i, r in enumerate(reader):
        if i >= MAX_ROWS:
            raise ValueError(f"Upload at most {MAX_ROWS} rows at a time.")
        r = {(k or "").strip().lower(): (v or "") for k, v in r.items()}
        email = r.get("email", "").strip().lower()
        if not _valid(email):
            invalid += 1
            continue
        name = next((r[c].strip() for c in NAME_COLUMNS if r.get(c, "").strip()), "")
        rows.append({"email": email, "first_name": name.split()[0][:100] if name else ""})
    return rows, invalid


def users_queryset(filters):
    """Active platform users matching the admin's filters."""
    qs = get_user_model().objects.filter(is_active=True)
    role = filters.get("role")
    if role in ("creator", "talent", "client"):
        qs = qs.filter(role=role)
    if filters.get("never_logged_in"):
        qs = qs.filter(last_login__isnull=True)
    days = filters.get("inactive_days")
    if days not in (None, ""):
        cutoff = timezone.now() - timedelta(days=int(days))
        qs = qs.filter(Q(last_login__lt=cutoff) | Q(last_login__isnull=True))
    if filters.get("joined_after"):
        qs = qs.filter(date_joined__date__gte=filters["joined_after"])
    if filters.get("joined_before"):
        qs = qs.filter(date_joined__date__lte=filters["joined_before"])
    return qs.order_by("date_joined")


def rows_from_users(qs):
    return [
        {"email": u.email.strip().lower(), "first_name": ((u.full_name or "").split() or [""])[0][:100]}
        for u in qs.only("email", "full_name")
        if _valid(u.email.strip().lower())
    ]


def add_recipients(campaign, rows, source):
    """Adds new, non-opted-out rows. Returns counts for the UI."""
    existing = set(campaign.recipients.values_list("email", flat=True))
    suppressed = set(EmailSuppression.objects.values_list("email", flat=True))
    previously = set(
        CampaignRecipient.objects.filter(status=CampaignRecipient.SENT)
        .exclude(campaign=campaign)
        .values_list("email", flat=True)
    )
    new, seen, dupes, opted_out, already = [], set(), 0, 0, 0
    for row in rows:
        email = row["email"]
        if email in existing or email in seen:
            dupes += 1
            continue
        seen.add(email)
        if email in suppressed:
            opted_out += 1
            continue
        if email in previously:
            already += 1
        new.append(CampaignRecipient(campaign=campaign, email=email, first_name=row["first_name"], source=source))
    CampaignRecipient.objects.bulk_create(new, ignore_conflicts=True)
    return {
        "added": len(new),
        "duplicates": dupes,
        "opted_out": opted_out,
        "previously_emailed": already,
    }
