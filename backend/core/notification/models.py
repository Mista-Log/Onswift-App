# notifications/models.py
from django.db import models
import uuid
from datetime import timedelta
from django.utils import timezone
from account.models import User

class HireRequest(models.Model):
    STATUS_CHOICES = (
        ("pending", "Pending"),
        ("accepted", "Accepted"),
        ("rejected", "Rejected"),
    )

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    creator = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="sent_hire_requests"
    )

    talent = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="received_hire_requests"
    )

    message = models.TextField(blank=True)
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default="pending")

    created_at = models.DateTimeField(auto_now_add=True)
    responded_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        unique_together = ("creator", "talent")

    def __str__(self):
        return f"{self.creator.email} → {self.talent.email} ({self.status})"


class Notification(models.Model):
    TYPE_CHOICES = (
        ("hire", "Hire"),
        ("system", "System"),
    )

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="notifications"
    )

    title = models.CharField(max_length=255)
    message = models.TextField()

    notification_type = models.CharField(max_length=20, choices=TYPE_CHOICES)

    is_read = models.BooleanField(default=False)

    # Optional link to HireRequest
    hire_request = models.ForeignKey(
        HireRequest,
        on_delete=models.CASCADE,
        null=True,
        blank=True
    )

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]


class InviteToken(models.Model):
    """Invite tokens for onboarding talents to a creator's team"""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    token = models.CharField(max_length=100, unique=True, db_index=True)

    creator = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="sent_invites"
    )

    # Optional: specific email the invite is for
    invited_email = models.EmailField(blank=True, null=True)

    # Tracking
    is_used = models.BooleanField(default=False)
    used_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="received_invite"
    )
    used_at = models.DateTimeField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()

    class Meta:
        ordering = ["-created_at"]

    def save(self, *args, **kwargs):
        # Auto-generate token if not provided
        if not self.token:
            self.token = str(uuid.uuid4())

        # Auto-set expiry to 7 days if not provided
        if not self.expires_at:
            self.expires_at = timezone.now() + timedelta(days=7)

        super().save(*args, **kwargs)

    def is_valid(self):
        """Check if invite is still valid"""
        if self.is_used:
            return False
        if timezone.now() > self.expires_at:
            return False
        return True

    def __str__(self):
        return f"Invite from {self.creator.email} - {self.token[:8]}..."
