from django.db import models
from django.conf import settings
import uuid


class Project(models.Model):
    STATUS_CHOICES = (
        ("pending", "Pending"),
        ("in-progress", "In Progress"),
        ("completed", "Completed"),
    )

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    creator = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="projects"
    )
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True, null=True)
    due_date = models.DateField(blank=True, null=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="pending")
    task_count = models.PositiveIntegerField(default=0)
    completed_tasks = models.PositiveIntegerField(default=0)

    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name


class TeamMember(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    project = models.ForeignKey(
        Project,
        on_delete=models.CASCADE,
        related_name="team_members"
    )
    name = models.CharField(max_length=100)
    avatar = models.URLField()

    def __str__(self):
        return self.name


class Task(models.Model):
    STATUS_CHOICES = [
        ("planning", "Planning"),
        ("in-progress", "In Progress"),
        ("completed", "Completed"),
    ]

    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name="tasks")
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True, null=True)
    assignee = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="planning")
    deadline = models.DateField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name


class ProjectSample(models.Model):
    SAMPLE_TYPE_CHOICES = [
        ("file", "File"),
        ("link", "Link"),
    ]

    project = models.ForeignKey(
        "Project",
        on_delete=models.CASCADE,
        related_name="samples"
    )
    name = models.CharField(max_length=255)
    type = models.CharField(max_length=10, choices=SAMPLE_TYPE_CHOICES)
    file = models.FileField(upload_to="project_samples/", null=True, blank=True)
    url = models.URLField(null=True, blank=True)
    description = models.TextField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)

    def clean(self):
        """
        Ensure file exists for file type and url exists for link type
        """
        if self.type == "file" and not self.file:
            raise ValueError("File is required for file sample type")
        if self.type == "link" and not self.url:
            raise ValueError("URL is required for link sample type")

    def __str__(self):
        return self.name
