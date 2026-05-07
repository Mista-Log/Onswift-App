"""
Portal models — Client-specific models for the portal.
Reuses existing Project, Task, Deliverable, Message, Conversation models from the project app.
Only creates portal-specific models that don't exist yet.
"""
import uuid
import secrets
from django.db import models
from django.conf import settings
from django.utils import timezone
from datetime import timedelta


def _generate_invite_token():
    """Generate a unique, URL-safe token for client invites."""
    return secrets.token_urlsafe(48)


class PortalMessage(models.Model):
    """
    Messages between a Client and Creator within a portal project context.
    Extends beyond the existing Message model by adding project scope and
    an optional thread_id for future group thread expansion.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    project = models.ForeignKey(
        "project.Project",
        on_delete=models.CASCADE,
        related_name="portal_messages",
    )
    sender = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="portal_sent_messages",
    )
    content = models.TextField()
    file = models.FileField(upload_to="portal_attachments/", null=True, blank=True)
    file_name = models.CharField(max_length=255, blank=True)
    is_read = models.BooleanField(default=False)
    read_at = models.DateTimeField(null=True, blank=True)

    # Future expansion: optional thread_id for group thread support
    thread_id = models.UUIDField(null=True, blank=True, db_index=True)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["created_at"]

    def __str__(self):
        return f"Portal msg in {self.project.name}: {self.content[:50]}"


class ClientInvite(models.Model):
    """
    Invite link to onboard a client to a project.
    Creator customizes the onboarding form (questions) for each project/client.
    Token is unique and time-limited.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    project = models.ForeignKey(
        "project.Project",
        on_delete=models.CASCADE,
        related_name="client_invites",
    )
    creator = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="created_invites",
    )
    token = models.CharField(
        max_length=64,
        unique=True,
        default=_generate_invite_token,
        db_index=True,
    )
    client_email = models.EmailField()
    
    # Stores the customized onboarding questions as JSON
    # Format: {"questions": [{"id": 1, "type": "text", "label": "..."}, ...]}
    onboarding_form = models.JSONField(default=dict, blank=True)
    
    # Responses from the client (submitted answers)
    responses = models.JSONField(default=dict, blank=True)
    
    expires_at = models.DateTimeField()
    accepted_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        ordering = ["-created_at"]
        unique_together = ("project", "client_email")  # One invite per client per project

    def __str__(self):
        return f"Invite: {self.client_email} → {self.project.name}"

    @staticmethod
    def generate_invite(project, creator, client_email, onboarding_form, expires_in_days=30):
        """Helper to create an invite with expiry."""
        expires_at = timezone.now() + timedelta(days=expires_in_days)
        return ClientInvite.objects.create(
            project=project,
            creator=creator,
            client_email=client_email,
            onboarding_form=onboarding_form,
            expires_at=expires_at,
        )

    def is_valid(self):
        """Check if invite is still valid (not expired and not already accepted)."""
        return (
            self.accepted_at is None
            and timezone.now() < self.expires_at
        )

    def is_expired(self):
        """Check if invite has expired."""
        return timezone.now() >= self.expires_at

