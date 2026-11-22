"""Email campaigns run from the /admin panel (the production version of send_winback.py)."""
from django.db import models


class SenderAccount(models.Model):
    """One admin's own mailbox. The SMTP password is Fernet-encrypted and never returned by the API."""

    admin_email = models.EmailField(unique=True)  # the Supabase admin who owns this mailbox
    from_name = models.CharField(max_length=100)
    from_email = models.EmailField()
    smtp_host = models.CharField(max_length=255, default="smtp.zoho.com")
    smtp_port = models.PositiveIntegerField(default=465)
    smtp_username = models.CharField(max_length=255)
    password_encrypted = models.TextField(blank=True, default="")
    daily_cap = models.PositiveIntegerField(default=300)
    verified_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.from_name} <{self.from_email}>"


class Campaign(models.Model):
    DRAFT, SENDING, PAUSED, DONE = "draft", "sending", "paused", "done"
    STATUS_CHOICES = [(s, s.title()) for s in (DRAFT, SENDING, PAUSED, DONE)]

    name = models.CharField(max_length=200)
    subject = models.CharField(max_length=300)
    # Plain text. {first_name} and {unsubscribe_link} are filled in per recipient.
    body = models.TextField()
    # Skip anyone a campaign has already emailed (the old sent_log.txt behaviour).
    exclude_previously_emailed = models.BooleanField(default=True)
    # Set when the campaign is started: it sends from that admin's mailbox.
    sender = models.ForeignKey(
        SenderAccount, null=True, blank=True, on_delete=models.SET_NULL, related_name="campaigns"
    )
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default=DRAFT)
    created_by = models.EmailField()
    started_by = models.EmailField(blank=True, default="")
    last_error = models.TextField(blank=True, default="")
    next_send_at = models.DateTimeField(null=True, blank=True)
    min_gap_s = models.PositiveIntegerField(default=20)
    max_gap_s = models.PositiveIntegerField(default=45)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return self.name


class CampaignRecipient(models.Model):
    PENDING, SENT, FAILED, SKIPPED = "pending", "sent", "failed", "skipped"
    STATUS_CHOICES = [(s, s.title()) for s in (PENDING, SENT, FAILED, SKIPPED)]
    SOURCE_CHOICES = [("csv", "CSV"), ("user", "Platform user"), ("import", "Imported")]

    campaign = models.ForeignKey(Campaign, on_delete=models.CASCADE, related_name="recipients")
    email = models.EmailField()  # always stored lowercase
    first_name = models.CharField(max_length=100, blank=True, default="")
    source = models.CharField(max_length=10, choices=SOURCE_CHOICES, default="csv")
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default=PENDING)
    error = models.TextField(blank=True, default="")
    sent_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["id"]
        constraints = [
            models.UniqueConstraint(fields=["campaign", "email"], name="uniq_campaign_recipient_email"),
        ]
        indexes = [
            models.Index(fields=["campaign", "status"]),
            models.Index(fields=["email", "status"]),
        ]


class EmailSuppression(models.Model):
    """Global do-not-email list, shared by every campaign and admin."""

    REASON_CHOICES = [
        ("unsubscribed", "Unsubscribed via link"),
        ("replied_stop", "Replied stop"),
        ("manual", "Added manually"),
    ]
    email = models.EmailField(unique=True)
    reason = models.CharField(max_length=20, choices=REASON_CHOICES, default="manual")
    added_by = models.CharField(max_length=254, blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
