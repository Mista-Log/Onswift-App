import uuid

from django.conf import settings
from django.db import models
from django.db.models import Max


class AgentConversation(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="agent_conversations"
    )
    title = models.CharField(max_length=200, blank=True)
    project = models.ForeignKey(
        "project.Project", on_delete=models.SET_NULL, null=True, blank=True, related_name="+"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-updated_at"]

    def add_message(self, **fields):
        """Append a message with the next position. Position, not created_at, defines order:
        two messages saved in the same instant would otherwise tie on a coarse clock."""
        last = self.messages.aggregate(last=Max("position"))["last"] or 0
        message = self.messages.create(position=last + 1, **fields)
        self.save(update_fields=["updated_at"])
        return message


class AgentMessage(models.Model):
    ROLE_CHOICES = [("user", "User"), ("assistant", "Assistant"), ("tool", "Tool")]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    conversation = models.ForeignKey(AgentConversation, on_delete=models.CASCADE, related_name="messages")
    position = models.PositiveIntegerField()
    role = models.CharField(max_length=10, choices=ROLE_CHOICES)
    content = models.TextField(blank=True)
    # Raw provider tool-call objects, stored verbatim so they can be replayed (thought signatures).
    tool_calls = models.JSONField(default=list, blank=True)
    tool_call_id = models.CharField(max_length=200, blank=True)
    # Provider extras from the closing chunk (Done.message_extra), also replayed verbatim.
    message_extra = models.JSONField(null=True, blank=True)
    # The creator's thumbs on a reply: 1 = helpful, -1 = not helpful, 0 = not rated.
    rating = models.SmallIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["position"]
        constraints = [
            models.UniqueConstraint(fields=["conversation", "position"], name="agent_message_unique_position")
        ]


class AgentAction(models.Model):
    """A write the agent proposed. Nothing runs until the user confirms it."""

    STATUS_CHOICES = [
        ("pending", "Pending"),
        ("confirmed", "Confirmed"),
        ("rejected", "Rejected"),
        ("executed", "Executed"),
        ("failed", "Failed"),
        ("expired", "Expired"),
        ("superseded", "Superseded"),  # replaced by a newer proposal for the same thing
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="agent_actions")
    conversation = models.ForeignKey(AgentConversation, on_delete=models.CASCADE, related_name="actions")
    tool = models.CharField(max_length=100)
    arguments = models.JSONField(default=dict)
    # One plain sentence shown on the confirm card ("Create project "X"").
    summary = models.CharField(max_length=300, blank=True)
    # Optional, for tools whose arguments only carry ids: what the change will do in words, computed
    # when it is proposed (list of {change, label, type?, detail?}). Shown on the confirm card.
    preview = models.JSONField(null=True, blank=True)
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default="pending")
    result = models.JSONField(null=True, blank=True)
    error = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    resolved_at = models.DateTimeField(null=True, blank=True)
    expires_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]


class AgentUsage(models.Model):
    """One row per model call. total_tokens includes hidden thinking tokens, so cost uses it."""

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="agent_usage")
    conversation = models.ForeignKey(
        AgentConversation, on_delete=models.SET_NULL, null=True, blank=True, related_name="usage"
    )
    model = models.CharField(max_length=100, blank=True)
    prompt_tokens = models.PositiveIntegerField(default=0)
    completion_tokens = models.PositiveIntegerField(default=0)
    total_tokens = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]


class AgentStreamSlot(models.Model):
    """Holds a user's single active stream. One-to-one makes the limit a database guarantee.
    The cache is per-process, so it can't enforce this across gunicorn workers."""

    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="agent_stream_slot")
    started_at = models.DateTimeField(auto_now_add=True)
    heartbeat_at = models.DateTimeField(auto_now_add=True)
