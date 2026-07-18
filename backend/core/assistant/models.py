import uuid

from django.conf import settings
from django.db import models


class AssistantNudge(models.Model):
    """One deadline nudge sent by the OnSwift Assistant to a task assignee.

    The unique (task, user) pair both deduplicates the sweep and lets a talent's
    reply in the assistant chat be attributed back to the nudged task.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    task = models.ForeignKey(
        "project.Task", on_delete=models.CASCADE, related_name="assistant_nudges"
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="assistant_nudges"
    )
    sent_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = [("task", "user")]

    def __str__(self):
        return f"Nudge for {self.user_id} on task {self.task_id}"
