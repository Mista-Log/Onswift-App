from rest_framework import serializers
from .models import Project, Task, Deliverable, DeliverableFile, Message, Conversation
from .models import ProjectSample, TeamMember

class TaskSerializer(serializers.ModelSerializer):
    assignee_name = serializers.CharField(source="assignee.full_name", read_only=True)

    class Meta:
        model = Task
        fields = ["id", "project", "name", "description", "assignee", "assignee_name", "status", "deadline", "created_at"]
        read_only_fields = ["project", "created_at"]

    def create(self, validated_data):
        task = super().create(validated_data)
        # Create notification if task is assigned to someone
        if task.assignee:
            self._notify_assignee(task, is_new=True)
        return task

    def update(self, instance, validated_data):
        old_assignee = instance.assignee
        new_assignee = validated_data.get('assignee', old_assignee)

        task = super().update(instance, validated_data)

        # Notify if assignee changed
        if new_assignee and new_assignee != old_assignee:
            self._notify_assignee(task, is_new=False)

        return task

    def _notify_assignee(self, task, is_new=True):
        """Send notification to the task assignee"""
        from notification.services import create_notification

        project_name = task.project.name
        creator_name = task.project.creator.full_name

        if is_new:
            title = "New Task Assigned"
            message = f"{creator_name} assigned you to '{task.name}' in project '{project_name}'."
        else:
            title = "Task Reassigned"
            message = f"You've been assigned to '{task.name}' in project '{project_name}'."

        create_notification(
            user=task.assignee,
            title=title,
            message=message,
            notification_type="system",
        )

class TeamMemberSerializer(serializers.ModelSerializer):
    class Meta:
        model = TeamMember
        fields = ("id", "name", "avatar")

class ProjectSerializer(serializers.ModelSerializer):
    teamMembers = TeamMemberSerializer(
        many=True,
        source="team_members",
        required=False
    )
    creator = serializers.ReadOnlyField(source="creator.id")

    task_count = serializers.SerializerMethodField()
    completed_tasks = serializers.SerializerMethodField()
    progress = serializers.SerializerMethodField()

    class Meta:
        model = Project
        fields = (
            "id",
            "creator",
            "name",
            "description",
            "due_date",
            "status",
            "teamMembers",
            "task_count",
            "completed_tasks",
            "progress",
            "created_at",
        )

    def create(self, validated_data):
        team_members_data = validated_data.pop("team_members", [])
        project = Project.objects.create(**validated_data)

        for member in team_members_data:
            TeamMember.objects.create(project=project, **member)

        return project
    
    def get_task_count(self, obj):
        return obj.tasks.count()

    def get_completed_tasks(self, obj):
        return obj.tasks.filter(status="completed").count()

    def get_progress(self, obj):
        total = obj.tasks.count()
        if total == 0:
            return 0
        completed = obj.tasks.filter(status="completed").count()
        return int((completed / total) * 100)


class ProjectSampleSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProjectSample
        fields = [
            "id",
            "project",
            "name",
            "type",
            "file",
            "url",
            "description",
            "created_at",
        ]
        read_only_fields = ["project", "created_at"]


class DeliverableFileSerializer(serializers.ModelSerializer):
    url = serializers.SerializerMethodField()

    class Meta:
        model = DeliverableFile
        fields = ["id", "name", "url", "size", "file_type", "uploaded_at"]

    def get_url(self, obj):
        request = self.context.get("request")
        if obj.file and request:
            return request.build_absolute_uri(obj.file.url)
        return None


class DeliverableSerializer(serializers.ModelSerializer):
    files = DeliverableFileSerializer(many=True, read_only=True)
    submitted_by_name = serializers.CharField(source="submitted_by.full_name", read_only=True)
    submitted_by_avatar = serializers.SerializerMethodField()
    project_id = serializers.CharField(source="task.project.id", read_only=True)
    project_name = serializers.CharField(source="task.project.name", read_only=True)
    task_name = serializers.CharField(source="task.name", read_only=True)

    class Meta:
        model = Deliverable
        fields = [
            "id", "task", "title", "description", "submitted_by", "submitted_by_name",
            "submitted_by_avatar", "project_id", "project_name", "task_name",
            "status", "feedback", "revision_count", "files", "created_at", "updated_at"
        ]
        read_only_fields = ["submitted_by", "revision_count", "created_at", "updated_at"]

    def get_submitted_by_avatar(self, obj):
        request = self.context.get("request")
        try:
            if obj.submitted_by.talentprofile.avatar and request:
                return request.build_absolute_uri(obj.submitted_by.talentprofile.avatar.url)
        except AttributeError:
            pass
        return None


class DeliverableCreateSerializer(serializers.ModelSerializer):
    files = serializers.ListField(
        child=serializers.FileField(),
        write_only=True,
        required=False
    )

    class Meta:
        model = Deliverable
        fields = ["task", "title", "description", "files"]

    def create(self, validated_data):
        files_data = validated_data.pop("files", [])
        user = self.context["request"].user
        deliverable = Deliverable.objects.create(submitted_by=user, **validated_data)

        for file in files_data:
            DeliverableFile.objects.create(
                deliverable=deliverable,
                file=file,
                name=file.name,
                size=file.size,
                file_type=file.content_type
            )

        # Notify the project creator
        from notification.services import create_notification
        create_notification(
            user=deliverable.task.project.creator,
            title="New Deliverable Submitted",
            message=f"{user.full_name} submitted '{deliverable.title}' for task '{deliverable.task.name}'.",
            notification_type="system",
        )

        return deliverable


class DeliverableReviewSerializer(serializers.ModelSerializer):
    class Meta:
        model = Deliverable
        fields = ["status", "feedback"]

    def update(self, instance, validated_data):
        old_status = instance.status
        new_status = validated_data.get("status", old_status)

        if new_status == "revision" and old_status != "revision":
            instance.revision_count += 1

        instance = super().update(instance, validated_data)

        # Notify the talent
        from notification.services import create_notification
        if new_status == "approved":
            title = "Deliverable Approved"
            message = f"Your deliverable '{instance.title}' has been approved!"
        elif new_status == "revision":
            title = "Revision Requested"
            message = f"Revision requested for '{instance.title}': {instance.feedback or 'No feedback provided'}"
        else:
            return instance

        create_notification(
            user=instance.submitted_by,
            title=title,
            message=message,
            notification_type="system",
        )

        return instance


class MessageSerializer(serializers.ModelSerializer):
    sender_name = serializers.CharField(source="sender.full_name", read_only=True)
    sender_avatar = serializers.SerializerMethodField()

    class Meta:
        model = Message
        fields = ["id", "sender", "sender_name", "sender_avatar", "recipient", "content", "is_read", "created_at"]
        read_only_fields = ["sender", "is_read", "created_at"]

    def get_sender_avatar(self, obj):
        request = self.context.get("request")
        try:
            if obj.sender.role == "creator" and obj.sender.creatorprofile.avatar and request:
                return request.build_absolute_uri(obj.sender.creatorprofile.avatar.url)
            elif obj.sender.role == "talent" and obj.sender.talentprofile.avatar and request:
                return request.build_absolute_uri(obj.sender.talentprofile.avatar.url)
        except AttributeError:
            pass
        return None


class ConversationSerializer(serializers.ModelSerializer):
    other_user = serializers.SerializerMethodField()
    last_message_content = serializers.CharField(source="last_message.content", read_only=True)
    last_message_time = serializers.DateTimeField(source="last_message.created_at", read_only=True)
    unread_count = serializers.SerializerMethodField()

    class Meta:
        model = Conversation
        fields = ["id", "other_user", "last_message_content", "last_message_time", "unread_count", "updated_at"]

    def get_other_user(self, obj):
        request = self.context.get("request")
        user = request.user if request else None
        if not user:
            return None

        other = obj.participants.exclude(id=user.id).first()
        if not other:
            return None

        avatar = None
        try:
            if other.role == "creator" and other.creatorprofile.avatar:
                avatar = request.build_absolute_uri(other.creatorprofile.avatar.url)
            elif other.role == "talent" and other.talentprofile.avatar:
                avatar = request.build_absolute_uri(other.talentprofile.avatar.url)
        except AttributeError:
            pass

        company = None
        try:
            if other.role == "creator":
                company = other.creatorprofile.company_name
        except AttributeError:
            pass

        return {
            "id": str(other.id),
            "name": other.full_name,
            "avatar": avatar,
            "company": company,
            "role": other.role,
        }

    def get_unread_count(self, obj):
        request = self.context.get("request")
        user = request.user if request else None
        if not user:
            return 0

        return Message.objects.filter(
            sender__in=obj.participants.exclude(id=user.id),
            recipient=user,
            is_read=False
        ).count()

