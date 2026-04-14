"""
Portal serializers — Response schemas for portal views.
"""
from rest_framework import serializers
from project.models import Project, Task, Deliverable, DeliverableFile
from .models import PortalMessage


class PortalDeliverableFileSerializer(serializers.ModelSerializer):
    class Meta:
        model = DeliverableFile
        fields = ["id", "name", "file", "file_type", "size", "uploaded_at"]


class PortalDeliverableSerializer(serializers.ModelSerializer):
    """Deliverable info visible to the client."""
    files = PortalDeliverableFileSerializer(many=True, read_only=True)
    submitted_by_name = serializers.CharField(source="submitted_by.full_name", read_only=True)

    class Meta:
        model = Deliverable
        fields = [
            "id", "title", "description", "status", "feedback",
            "revision_count", "files", "submitted_by_name",
            "created_at", "updated_at",
        ]


class PortalTaskSerializer(serializers.ModelSerializer):
    """Task info visible to the client."""
    deliverables = PortalDeliverableSerializer(many=True, read_only=True)
    assignee_name = serializers.CharField(source="assignee.full_name", read_only=True, default=None)

    class Meta:
        model = Task
        fields = [
            "id", "name", "description", "status",
            "assignee_name", "deadline", "deliverables",
            "created_at",
        ]


class PortalProjectSerializer(serializers.ModelSerializer):
    """Project dashboard view for clients."""
    creator_name = serializers.CharField(source="creator.full_name", read_only=True)
    tasks = PortalTaskSerializer(many=True, read_only=True)
    progress = serializers.SerializerMethodField()
    total_tasks = serializers.SerializerMethodField()
    completed_tasks = serializers.SerializerMethodField()

    class Meta:
        model = Project
        fields = [
            "id", "name", "description", "due_date", "status",
            "creator_name", "tasks", "progress",
            "total_tasks", "completed_tasks",
            "created_at",
        ]

    def get_progress(self, obj):
        total = obj.tasks.count()
        if total == 0:
            return 0
        completed = obj.tasks.filter(status="completed").count()
        return int((completed / total) * 100)

    def get_total_tasks(self, obj):
        return obj.tasks.count()

    def get_completed_tasks(self, obj):
        return obj.tasks.filter(status="completed").count()


class PortalProjectListSerializer(serializers.ModelSerializer):
    """Lightweight project info for project selector."""
    creator_name = serializers.CharField(source="creator.full_name", read_only=True)
    progress = serializers.SerializerMethodField()

    class Meta:
        model = Project
        fields = ["id", "name", "status", "due_date", "creator_name", "progress"]

    def get_progress(self, obj):
        total = obj.tasks.count()
        if total == 0:
            return 0
        completed = obj.tasks.filter(status="completed").count()
        return int((completed / total) * 100)


class PortalMessageSerializer(serializers.ModelSerializer):
    """Message representation in portal chat."""
    sender_name = serializers.CharField(source="sender.full_name", read_only=True)
    sender_role = serializers.CharField(source="sender.role", read_only=True)

    class Meta:
        model = PortalMessage
        fields = [
            "id", "project", "sender", "sender_name", "sender_role",
            "content", "file", "file_name",
            "is_read", "read_at", "thread_id",
            "created_at",
        ]
        read_only_fields = ["id", "sender", "sender_name", "sender_role", "is_read", "read_at", "created_at"]


class PortalMessageCreateSerializer(serializers.Serializer):
    """Input schema for sending a portal message."""
    content = serializers.CharField(max_length=5000)
    file = serializers.FileField(required=False, allow_null=True)
    file_name = serializers.CharField(max_length=255, required=False, allow_blank=True)
