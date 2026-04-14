"""
Portal models — Client-specific models for the portal.
Reuses existing Project, Task, Deliverable, Message, Conversation models from the project app.
Only creates portal-specific models that don't exist yet.
"""
import uuid
from django.db import models
from django.conf import settings


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
