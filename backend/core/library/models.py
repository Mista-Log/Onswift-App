"""
Library models — Document Library with folders, versioning, sharing, and activity logs.
"""
import uuid
import secrets
from django.db import models
from django.conf import settings
from django.utils import timezone


class Folder(models.Model):
    """
    Hierarchical folder structure for the Document Library.
    Top-level types: CLIENT (auto-created per client), TEMPLATE, INTERNAL.
    Each Client Folder auto-contains: Contracts, Briefs, Deliverables, Onboarding Responses.
    """

    FOLDER_TYPE_CHOICES = (
        ("CLIENT", "Client"),
        ("TEMPLATE", "Template"),
        ("INTERNAL", "Internal"),
    )

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    creator = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="library_folders",
    )
    parent_folder = models.ForeignKey(
        "self",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="subfolders",
    )
    name = models.CharField(max_length=255)
    folder_type = models.CharField(max_length=10, choices=FOLDER_TYPE_CHOICES, default="INTERNAL")
    client = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="client_folders",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return f"{self.name} ({self.folder_type})"

    @classmethod
    def create_client_folder_structure(cls, creator, client_user):
        """
        Auto-create the standard client folder structure:
        Client Name/
        ├── Contracts
        ├── Briefs
        ├── Deliverables
        └── Onboarding Responses
        """
        root = cls.objects.create(
            creator=creator,
            name=client_user.full_name or client_user.email,
            folder_type="CLIENT",
            client=client_user,
        )
        for subfolder_name in ["Contracts", "Briefs", "Deliverables", "Onboarding Responses"]:
            cls.objects.create(
                creator=creator,
                parent_folder=root,
                name=subfolder_name,
                folder_type="CLIENT",
                client=client_user,
            )
        return root


class Document(models.Model):
    """
    File record in the Document Library.
    Files are stored via Cloudinary (matching existing file storage pattern).
    Soft-delete: is_deleted=True, recoverable for 30 days.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    creator = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="library_documents",
    )
    client = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="client_documents",
    )
    folder = models.ForeignKey(
        Folder,
        on_delete=models.CASCADE,
        related_name="documents",
    )
    name = models.CharField(max_length=255)
    file = models.FileField(upload_to="library/")
    file_type = models.CharField(max_length=100, blank=True)
    size_kb = models.FloatField(default=0)
    tags = models.JSONField(default=list, blank=True)
    color_label = models.CharField(max_length=50, null=True, blank=True)
    is_locked = models.BooleanField(default=False)
    is_deleted = models.BooleanField(default=False)
    deleted_at = models.DateTimeField(null=True, blank=True)
    version = models.IntegerField(default=1)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-updated_at"]

    def __str__(self):
        return f"{self.name} (v{self.version})"

    def soft_delete(self):
        """Mark as deleted — recoverable for 30 days."""
        self.is_deleted = True
        self.deleted_at = timezone.now()
        self.save(update_fields=["is_deleted", "deleted_at"])

    def restore(self):
        """Restore a soft-deleted document."""
        self.is_deleted = False
        self.deleted_at = None
        self.save(update_fields=["is_deleted", "deleted_at"])


class DocumentVersion(models.Model):
    """
    Tracks previous versions of a document when re-uploaded.
    The current version is always the Document record itself;
    this table stores prior versions.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    document = models.ForeignKey(
        Document,
        on_delete=models.CASCADE,
        related_name="versions",
    )
    version_number = models.IntegerField()
    file = models.FileField(upload_to="library/versions/")
    file_type = models.CharField(max_length=100, blank=True)
    size_kb = models.FloatField(default=0)
    uploaded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-version_number"]
        unique_together = ["document", "version_number"]

    def __str__(self):
        return f"{self.document.name} v{self.version_number}"


class DocumentActivity(models.Model):
    """
    Activity log per document: who viewed, downloaded, or edited with timestamps.
    """

    ACTION_CHOICES = (
        ("VIEWED", "Viewed"),
        ("DOWNLOADED", "Downloaded"),
        ("EDITED", "Edited"),
        ("SHARED", "Shared"),
        ("UPLOADED", "Uploaded"),
        ("DELETED", "Deleted"),
        ("RESTORED", "Restored"),
    )

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    document = models.ForeignKey(
        Document,
        on_delete=models.CASCADE,
        related_name="activities",
    )
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="document_activities",
    )
    actor_role = models.CharField(max_length=10)
    action = models.CharField(max_length=20, choices=ACTION_CHOICES)
    timestamp = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-timestamp"]

    def __str__(self):
        return f"{self.actor.email} {self.action} {self.document.name}"


class DocumentShareLink(models.Model):
    """
    Time-limited sharing links per document.
    Supports VIEW or EDIT permission levels.
    """

    PERMISSION_CHOICES = (
        ("VIEW", "View Only"),
        ("EDIT", "Editable"),
    )

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    document = models.ForeignKey(
        Document,
        on_delete=models.CASCADE,
        related_name="share_links",
    )
    slug = models.CharField(
        max_length=20,
        unique=True,
        db_index=True,
    )
    permission = models.CharField(max_length=4, choices=PERMISSION_CHOICES, default="VIEW")
    expires_at = models.DateTimeField()
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = secrets.token_urlsafe(8)
        super().save(*args, **kwargs)

    @property
    def is_expired(self):
        return timezone.now() > self.expires_at

    def __str__(self):
        return f"Share: {self.document.name} ({self.permission}) - {self.slug}"
