import uuid
from django.db import models
from django.conf import settings


class Doc(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="docs",
    )
    parent = models.ForeignKey(
        "self",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="children",
    )
    project = models.ForeignKey(
        "project.Project",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="docs",
    )
    title = models.CharField(max_length=500, default="Untitled")
    icon = models.CharField(max_length=10, blank=True)
    content = models.JSONField(default=list, blank=True)
    order = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["order", "created_at"]

    def __str__(self):
        return self.title or "Untitled"


class DocAccess(models.Model):
    ROLE_CHOICES = [
        ("viewer", "Viewer"),
        ("editor", "Editor"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    doc = models.ForeignKey(Doc, on_delete=models.CASCADE, related_name="access_list")
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="doc_access",
    )
    role = models.CharField(max_length=10, choices=ROLE_CHOICES, default="viewer")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ["doc", "user"]
        ordering = ["created_at"]

    def __str__(self):
        return f"{self.user} → {self.doc.title} ({self.role})"
