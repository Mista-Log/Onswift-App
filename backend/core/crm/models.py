import uuid
from django.db import models
from django.conf import settings


class CRMSheet(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="crm_sheets",
    )
    name = models.CharField(max_length=255)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return self.name


class CRMColumn(models.Model):
    FIELD_TYPE_CHOICES = [
        ("text", "Text"),
        ("email", "Email"),
        ("phone", "Phone"),
        ("url", "URL"),
        ("number", "Number"),
        ("date", "Date"),
        ("single_select", "Single Select"),
        ("multi_select", "Multi Select"),
        ("checkbox", "Checkbox"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    sheet = models.ForeignKey(CRMSheet, on_delete=models.CASCADE, related_name="columns")
    name = models.CharField(max_length=255)
    field_type = models.CharField(max_length=20, choices=FIELD_TYPE_CHOICES, default="text")
    options = models.JSONField(default=list, blank=True)
    order = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["order", "created_at"]

    def __str__(self):
        return f"{self.sheet.name} / {self.name}"


class CRMRow(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    sheet = models.ForeignKey(CRMSheet, on_delete=models.CASCADE, related_name="rows")
    values = models.JSONField(default=dict)
    order = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["order", "created_at"]

    def __str__(self):
        return f"Row {self.id} — {self.sheet.name}"


class CRMAccess(models.Model):
    ROLE_CHOICES = [
        ("viewer", "Viewer"),
        ("editor", "Editor"),
        ("admin", "Admin"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    sheet = models.ForeignKey(CRMSheet, on_delete=models.CASCADE, related_name="access_list")
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="crm_access",
    )
    role = models.CharField(max_length=10, choices=ROLE_CHOICES, default="viewer")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ["sheet", "user"]
        ordering = ["created_at"]

    def __str__(self):
        return f"{self.user} → {self.sheet.name} ({self.role})"
