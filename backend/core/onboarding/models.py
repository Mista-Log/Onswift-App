"""
Onboarding models — Form Builder templates and unique onboarding instances.
"""
import uuid
import secrets
from django.db import models
from django.conf import settings


class OnboardingTemplate(models.Model):
    """
    Creator-owned form template with configurable block types.
    blocks is a JSON array of typed block objects, e.g.:
    [
        {"type": "welcome", "content": "<p>Welcome!</p>"},
        {"type": "short_answer", "label": "Your name?", "required": true},
        {"type": "long_answer", "label": "Tell us about your project", "required": true},
        {"type": "multiple_choice", "label": "Budget range?", "options": ["<5k","5-10k",">10k"], "required": true},
        {"type": "file_upload", "label": "Upload brand assets", "required": false},
        {"type": "checkbox", "label": "I agree to the terms", "required": true}
    ]
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    creator = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="onboarding_templates",
    )
    title = models.CharField(max_length=255)
    blocks = models.JSONField(default=list, help_text="JSON array of typed form block objects")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.title} (by {self.creator.email})"


def _generate_slug():
    """Generate a unique URL-safe slug using secrets.token_urlsafe(8)."""
    return secrets.token_urlsafe(8)


class OnboardingInstance(models.Model):
    """
    Each generated onboarding link is a unique instance.
    Slugs are never reused. Status tracks the link lifecycle.
    """

    STATUS_CHOICES = (
        ("SENT", "Sent"),
        ("OPENED", "Opened"),
        ("COMPLETED", "Completed"),
    )

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    template = models.ForeignKey(
        OnboardingTemplate,
        on_delete=models.CASCADE,
        related_name="instances",
    )
    slug = models.CharField(
        max_length=20,
        unique=True,
        default=_generate_slug,
        db_index=True,
    )
    client = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="onboarding_instances",
    )
    project = models.ForeignKey(
        "project.Project",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="onboarding_instances",
    )
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default="SENT")
    expires_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    responses = models.JSONField(null=True, blank=True, help_text="Client form responses")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"Onboarding {self.slug} ({self.status})"

    @property
    def is_expired(self):
        """Check if this onboarding link has expired."""
        if self.expires_at is None:
            return False
        from django.utils import timezone
        return timezone.now() > self.expires_at
