"""
One-time move of send_winback.py's local state into the database.

    python manage.py import_winback_state --sent-log ../../sent_log.txt --optouts ../../optouts.txt

- sent_log.txt  -> recipients marked "sent" on a "Win-back" campaign, so nobody gets it twice
- optouts.txt   -> the shared opt-out list
- creates the Win-back campaign as a draft with the script's subject and body

Safe to run more than once.
"""
import os

from django.core.management.base import BaseCommand, CommandError
from django.utils import timezone

from campaigns.models import Campaign, CampaignRecipient, EmailSuppression

WINBACK_NAME = "Win-back"
WINBACK_SUBJECT = "You Trusted Us to Cook, It's Time to Serve You"
WINBACK_BODY = """Hi {first_name},

I'm Daniel, one of the founders of OnSwift. You signed up early, and then we went quiet. I'm sorry about that.

When we launched the beta, we realised we hadn't quite got it right for many businesses, so we spent the last few months rebuilding it around feedback.

The biggest addition is OnSwift AI. Instead of setting up projects and tasks by hand in a tool like Notion or ClickUp, you chat with it: ask about your deadlines, or tell it to draft a new project with its tasks, a document or a form. Nothing changes until you confirm.

We've also fixed a batch of bugs, and the app now loads smoothly.

Would you like me to send you the link to take another look? Just reply "yes". And if something put you off before, I'd genuinely like to hear it.

Daniel
Co-founder, OnSwift

If you'd rather not hear from us, reply "stop" or unsubscribe here: {unsubscribe_link}
"""


def _emails(path):
    if not path:
        return []
    if not os.path.exists(path):
        raise CommandError(f"File not found: {path}")
    with open(path, encoding="utf-8") as f:
        return sorted({line.strip().lower() for line in f if "@" in line})


class Command(BaseCommand):
    help = "Import send_winback.py's sent_log.txt / optouts.txt and create the Win-back campaign."

    def add_arguments(self, parser):
        parser.add_argument("--sent-log", default="", help="Path to sent_log.txt")
        parser.add_argument("--optouts", default="", help="Path to optouts.txt")
        parser.add_argument("--created-by", default="import@onswift.org")

    def handle(self, *args, **opts):
        campaign, created = Campaign.objects.get_or_create(
            name=WINBACK_NAME,
            defaults={"subject": WINBACK_SUBJECT, "body": WINBACK_BODY, "created_by": opts["created_by"]},
        )
        self.stdout.write(f"{'Created' if created else 'Found'} campaign '{campaign.name}' (id {campaign.id}).")

        sent = _emails(opts["sent_log"])
        existing = set(campaign.recipients.values_list("email", flat=True))
        now = timezone.now()
        new = [
            CampaignRecipient(campaign=campaign, email=e, source="import", status=CampaignRecipient.SENT, sent_at=now)
            for e in sent if e not in existing
        ]
        CampaignRecipient.objects.bulk_create(new, ignore_conflicts=True)
        self.stdout.write(f"Already-sent: {len(new)} imported, {len(sent) - len(new)} were already there.")

        added = 0
        for e in _emails(opts["optouts"]):
            _, made = EmailSuppression.objects.get_or_create(
                email=e, defaults={"reason": "replied_stop", "added_by": "import"}
            )
            added += int(made)
        self.stdout.write(f"Opt-outs: {added} added.")
