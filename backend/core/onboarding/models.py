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
    # Required for new forms (enforced in the serializer/UI; nullable for
    # legacy rows): onboarded clients join this project so they never land on
    # an empty dashboard.
    project = models.ForeignKey(
        "project.Project",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="onboarding_templates",
    )
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
        null=True,
        blank=True,
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


class OnboardingUpload(models.Model):
    """
    A file uploaded by a client while filling out an onboarding form.
    Uploads happen before the client account exists, so they are tied to the
    OnboardingInstance (by slug) rather than to a user. The stored file's URL is
    written into the instance's `responses` payload for the matching block.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    instance = models.ForeignKey(
        OnboardingInstance,
        on_delete=models.CASCADE,
        related_name="uploads",
    )
    block_index = models.PositiveIntegerField(null=True, blank=True)
    file = models.FileField(upload_to="onboarding_uploads/")
    original_name = models.CharField(max_length=255, blank=True)
    uploaded_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-uploaded_at"]

    def __str__(self):
        return f"Upload {self.original_name or self.id} ({self.instance.slug})"


# ── Standalone forms — plain, reusable, project/client-independent forms ───
# Deliberately parallel to OnboardingTemplate/OnboardingInstance rather than
# adapting them: those bake "one slug = one client = one terminal submission"
# into their core fields, whereas a standalone form is "one slug = many
# independent anonymous responses". See plan doc for the full rationale.

class StandaloneForm(models.Model):
    """
    Creator-owned plain form. One form has one shareable slug that any number
    of people can submit responses to (unlike OnboardingInstance, which is
    single-use per client). Not linked to any Project or client.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    creator = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="standalone_forms",
    )
    title = models.CharField(max_length=255)
    blocks = models.JSONField(default=list, help_text="JSON array of typed form block objects")
    slug = models.CharField(
        max_length=20,
        unique=True,
        default=_generate_slug,
        db_index=True,
    )
    is_open = models.BooleanField(default=True, help_text="Whether the form is still accepting responses")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.title} (by {self.creator.email})"


class StandaloneFormResponse(models.Model):
    """One anonymous submission to a StandaloneForm. No client/user is created."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    form = models.ForeignKey(
        StandaloneForm,
        on_delete=models.CASCADE,
        related_name="responses",
    )
    responses = models.JSONField(help_text="Array of {block_index, value} response objects")
    submitted_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-submitted_at"]

    def __str__(self):
        return f"Response to {self.form.title} at {self.submitted_at}"


class StandaloneFormUpload(models.Model):
    """
    A file uploaded while filling a StandaloneForm. Like OnboardingUpload,
    keyed by the form (via slug) rather than by respondent, since uploads
    happen mid-fill before any response row exists.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    form = models.ForeignKey(
        StandaloneForm,
        on_delete=models.CASCADE,
        related_name="uploads",
    )
    block_index = models.PositiveIntegerField(null=True, blank=True)
    file = models.FileField(upload_to="standalone_form_uploads/")
    original_name = models.CharField(max_length=255, blank=True)
    uploaded_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-uploaded_at"]

    def __str__(self):
        return f"Upload {self.original_name or self.id} ({self.form.slug})"
