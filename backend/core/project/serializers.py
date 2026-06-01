from rest_framework import serializers
from .models import Project, Task, Deliverable, DeliverableFile, DeliverableLink, Message, Conversation
from .models import ProjectSample, TeamMember, Group, GroupMembership, GroupMessage, GroupMessageReadStatus
from .models import GoogleCalendarToken, CalendarSyncedTask, ProjectClientMembership
from .models import TaskComment, TaskAttachment, TaskChecklist, TaskChecklistItem
from django.conf import settings

class TaskSerializer(serializers.ModelSerializer):
    assignee_name = serializers.CharField(source="assignee.full_name", read_only=True)

    class Meta:
        model = Task
        fields = ["id", "project", "name", "description", "assignee", "assignee_name", "status", "priority", "deadline", "created_at"]
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

class TaskCommentSerializer(serializers.ModelSerializer):
    author_name = serializers.CharField(source="author.full_name", read_only=True)
    author_role = serializers.CharField(source="author.role", read_only=True)
    author_avatar = serializers.SerializerMethodField()

    class Meta:
        model = TaskComment
        fields = ["id", "author", "author_name", "author_role", "author_avatar", "content", "created_at"]
        read_only_fields = ["id", "author", "author_name", "author_role", "author_avatar", "created_at"]

    def get_author_avatar(self, obj):
        if obj.author.profile_picture:
            try:
                return obj.author.profile_picture.url
            except Exception:
                return None
        return None


class TaskAttachmentSerializer(serializers.ModelSerializer):
    uploaded_by_name = serializers.CharField(source="uploaded_by.full_name", read_only=True)
    file_url = serializers.SerializerMethodField()

    class Meta:
        model = TaskAttachment
        fields = ["id", "uploaded_by", "uploaded_by_name", "name", "file", "file_url", "url", "created_at"]
        read_only_fields = ["id", "uploaded_by", "uploaded_by_name", "file_url", "created_at"]

    def get_file_url(self, obj):
        if obj.file:
            try:
                request = self.context.get("request")
                return request.build_absolute_uri(obj.file.url) if request else obj.file.url
            except Exception:
                return None
        return None


class TaskChecklistItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = TaskChecklistItem
        fields = ["id", "content", "is_checked", "order", "created_at"]
        read_only_fields = ["id", "created_at"]


class TaskChecklistSerializer(serializers.ModelSerializer):
    items = TaskChecklistItemSerializer(many=True, read_only=True)
    progress = serializers.SerializerMethodField()

    class Meta:
        model = TaskChecklist
        fields = ["id", "title", "items", "progress", "created_at"]
        read_only_fields = ["id", "created_at"]

    def get_progress(self, obj):
        items = obj.items.all()
        total = items.count()
        if total == 0:
            return 0
        checked = items.filter(is_checked=True).count()
        return round((checked / total) * 100)


class TaskDetailSerializer(TaskSerializer):
    comments = TaskCommentSerializer(many=True, read_only=True)
    attachments = TaskAttachmentSerializer(many=True, read_only=True)
    checklists = TaskChecklistSerializer(many=True, read_only=True)
    assignee_avatar = serializers.SerializerMethodField()

    class Meta(TaskSerializer.Meta):
        fields = list(TaskSerializer.Meta.fields) + ["comments", "attachments", "checklists", "assignee_avatar"]

    def get_assignee_avatar(self, obj):
        if obj.assignee and obj.assignee.profile_picture:
            try:
                return obj.assignee.profile_picture.url
            except Exception:
                return None
        return None


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


class DeliverableLinkSerializer(serializers.ModelSerializer):
    class Meta:
        model = DeliverableLink
        fields = ["id", "url"]


class DeliverableSerializer(serializers.ModelSerializer):
    files = DeliverableFileSerializer(many=True, read_only=True)
    links = DeliverableLinkSerializer(many=True, read_only=True)
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
            "status", "feedback", "revision_count", "files", "links", "created_at", "updated_at"
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
    class Meta:
        model = Deliverable
        fields = ["task", "title", "description"]

    def create(self, validated_data):
        user = self.context["request"].user
        deliverable = Deliverable.objects.create(submitted_by=user, **validated_data)

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

        # Auto-complete the task when approved; revert it when unapproved
        if new_status == "approved":
            task = instance.task
            task.status = "completed"
            task.save(update_fields=["status"])
        elif new_status == "pending" and old_status == "approved":
            task = instance.task
            if task.status == "completed":
                task.status = "in-progress"
                task.save(update_fields=["status"])

        # Notify the talent
        from notification.services import create_notification
        if new_status == "approved":
            title = "Deliverable Approved"
            message = f"Your deliverable '{instance.title}' has been approved!"
        elif new_status == "revision":
            title = "Revision Requested"
            message = f"Revision requested for '{instance.title}': {instance.feedback or 'No feedback provided'}"
        elif new_status == "pending" and old_status == "approved":
            title = "Approval Reversed"
            message = f"The approval for '{instance.title}' has been reversed and is back under review."
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


# ============================================
# Group Chat Serializers
# ============================================

class GroupMemberSerializer(serializers.ModelSerializer):
    """Serializer for group members"""
    user_id = serializers.CharField(source='user.id', read_only=True)
    name = serializers.CharField(source='user.full_name', read_only=True)
    email = serializers.EmailField(source='user.email', read_only=True)
    avatar = serializers.SerializerMethodField()
    is_admin = serializers.SerializerMethodField()

    class Meta:
        model = GroupMembership
        fields = ['id', 'user_id', 'name', 'email', 'avatar', 'role', 'is_admin', 'joined_at']

    def get_avatar(self, obj):
        request = self.context.get('request')
        try:
            if obj.user.role == "creator" and obj.user.creatorprofile.avatar and request:
                return request.build_absolute_uri(obj.user.creatorprofile.avatar.url)
            elif obj.user.role == "talent" and obj.user.talentprofile.avatar and request:
                return request.build_absolute_uri(obj.user.talentprofile.avatar.url)
        except AttributeError:
            pass
        return None

    def get_is_admin(self, obj):
        return obj.role == "admin"


class GroupMessageSerializer(serializers.ModelSerializer):
    """Serializer for group messages"""
    sender_id = serializers.CharField(source='sender.id', read_only=True)
    sender_name = serializers.CharField(source='sender.full_name', read_only=True)
    sender_avatar = serializers.SerializerMethodField()
    is_mine = serializers.SerializerMethodField()
    read_by = serializers.SerializerMethodField()
    mentioned_users = serializers.SerializerMethodField()

    class Meta:
        model = GroupMessage
        fields = [
            'id', 'group', 'sender_id', 'sender_name', 'sender_avatar',
            'content', 'is_mine', 'read_by', 'mentioned_users', 'created_at'
        ]
        read_only_fields = ['sender', 'created_at']

    def get_sender_avatar(self, obj):
        request = self.context.get('request')
        try:
            if obj.sender.role == "creator" and obj.sender.creatorprofile.avatar and request:
                return request.build_absolute_uri(obj.sender.creatorprofile.avatar.url)
            elif obj.sender.role == "talent" and obj.sender.talentprofile.avatar and request:
                return request.build_absolute_uri(obj.sender.talentprofile.avatar.url)
        except AttributeError:
            pass
        return None

    def get_is_mine(self, obj):
        request = self.context.get('request')
        if request and request.user:
            return str(obj.sender.id) == str(request.user.id)
        return False

    def get_read_by(self, obj):
        """Get list of users who have read this message"""
        return list(obj.read_statuses.values_list('user__full_name', flat=True))

    def get_mentioned_users(self, obj):
        """Get list of mentioned user IDs"""
        return [str(user.id) for user in obj.mentions.all()]


class GroupSerializer(serializers.ModelSerializer):
    """Serializer for listing groups"""
    members = GroupMemberSerializer(source='memberships', many=True, read_only=True)
    member_count = serializers.SerializerMethodField()
    last_message = serializers.SerializerMethodField()
    unread_count = serializers.SerializerMethodField()
    is_admin = serializers.SerializerMethodField()
    avatar_url = serializers.SerializerMethodField()

    class Meta:
        model = Group
        fields = [
            'id', 'name', 'description', 'avatar_url', 'creator',
            'members', 'member_count', 'last_message', 'unread_count',
            'is_admin', 'created_at', 'updated_at'
        ]
        read_only_fields = ['creator', 'created_at', 'updated_at']

    def get_member_count(self, obj):
        return obj.memberships.count()

    def get_last_message(self, obj):
        last_msg = obj.messages.order_by('-created_at').first()
        if last_msg:
            return {
                'content': last_msg.content,
                'sender_name': last_msg.sender.full_name,
                'timestamp': last_msg.created_at,
            }
        return None

    def get_unread_count(self, obj):
        request = self.context.get('request')
        if not request or not request.user:
            return 0

        # Count messages not read by this user
        total_messages = obj.messages.count()
        read_messages = GroupMessageReadStatus.objects.filter(
            message__group=obj,
            user=request.user
        ).count()
        return total_messages - read_messages

    def get_is_admin(self, obj):
        request = self.context.get('request')
        if not request or not request.user:
            return False
        try:
            membership = obj.memberships.get(user=request.user)
            return membership.role == "admin"
        except GroupMembership.DoesNotExist:
            return False

    def get_avatar_url(self, obj):
        request = self.context.get('request')
        if obj.avatar and request:
            return request.build_absolute_uri(obj.avatar.url)
        return None


class GroupCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating a group"""
    member_ids = serializers.ListField(
        child=serializers.UUIDField(),
        write_only=True,
        required=True
    )

    class Meta:
        model = Group
        fields = ['name', 'description', 'avatar', 'member_ids']

    def validate(self, attrs):
        request = self.context.get('request')
        if request and request.user.role != 'creator':
            raise serializers.ValidationError("Only creators can create groups.")
        
        member_ids = attrs.get('member_ids', [])
        if len(member_ids) == 0:
            raise serializers.ValidationError("At least one member is required.")
        
        return attrs

    def create(self, validated_data):
        member_ids = validated_data.pop('member_ids', [])
        creator = self.context['request'].user

        # Create the group
        group = Group.objects.create(creator=creator, **validated_data)

        # Add creator as admin
        GroupMembership.objects.create(
            group=group,
            user=creator,
            role="admin"
        )

        # Add members
        from account.models import User
        for member_id in member_ids:
            try:
                user = User.objects.get(id=member_id)
                GroupMembership.objects.create(
                    group=group,
                    user=user,
                    role="member"
                )
            except User.DoesNotExist:
                continue

        return group


class GroupUpdateSerializer(serializers.ModelSerializer):
    """Serializer for updating a group"""
    class Meta:
        model = Group
        fields = ['name', 'description', 'avatar']


class GroupAddMembersSerializer(serializers.Serializer):
    """Serializer for adding members to a group"""
    member_ids = serializers.ListField(
        child=serializers.UUIDField(),
        required=True
    )

    def validate_member_ids(self, value):
        if len(value) == 0:
            raise serializers.ValidationError("At least one member ID is required.")
        return value


class GroupMessageCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating a group message"""
    mention_ids = serializers.ListField(
        child=serializers.UUIDField(),
        write_only=True,
        required=False,
        default=[]
    )

    class Meta:
        model = GroupMessage
        fields = ['content', 'mention_ids']

    def create(self, validated_data):
        mention_ids = validated_data.pop('mention_ids', [])
        sender = self.context['request'].user
        group = self.context['group']

        message = GroupMessage.objects.create(
            group=group,
            sender=sender,
            **validated_data
        )

        # Add mentions and send notifications
        if mention_ids:
            from account.models import User
            from notification.services import create_notification
            
            for mention_id in mention_ids:
                try:
                    mentioned_user = User.objects.get(id=mention_id)
                    # Only mention if user is a member of the group
                    if group.memberships.filter(user=mentioned_user).exists():
                        message.mentions.add(mentioned_user)
                        
                        # Send notification to mentioned user (skip sender)
                        if str(mentioned_user.id) != str(sender.id):
                            create_notification(
                                user=mentioned_user,
                                title="You were mentioned",
                                message=f"{sender.full_name} mentioned you in {group.name}: \"{validated_data['content'][:50]}...\"",
                                notification_type="system",
                            )
                except User.DoesNotExist:
                    continue

        # Mark as read by sender
        GroupMessageReadStatus.objects.create(
            message=message,
            user=sender
        )

        # Update group's updated_at
        group.save()

        return message


# Google Calendar Serializers
class GoogleCalendarStatusSerializer(serializers.Serializer):
    """Serializer for Google Calendar connection status"""
    is_connected = serializers.BooleanField()
    synced_tasks_count = serializers.IntegerField()


class GoogleCalendarConnectSerializer(serializers.Serializer):
    """Serializer for storing Google OAuth tokens"""
    access_token = serializers.CharField()
    refresh_token = serializers.CharField(required=False, allow_null=True)
    expires_in = serializers.IntegerField(required=False)
    scope = serializers.CharField(required=False)

    def create(self, validated_data):
        user = self.context['request'].user
        from datetime import timedelta
        from django.utils import timezone
        
        expiry = None
        if validated_data.get('expires_in'):
            expiry = timezone.now() + timedelta(seconds=validated_data['expires_in'])
        
        scopes = validated_data.get('scope', '').split() if validated_data.get('scope') else []
        
        token, created = GoogleCalendarToken.objects.update_or_create(
            user=user,
            defaults={
                'access_token': validated_data['access_token'],
                'refresh_token': validated_data.get('refresh_token'),
                'client_id': getattr(settings, 'GOOGLE_CLIENT_ID', ''),
                'client_secret': getattr(settings, 'GOOGLE_CLIENT_SECRET', ''),
                'scopes': scopes,
                'expiry': expiry,
            }
        )
        return token


class TaskSyncSerializer(serializers.Serializer):
    """Serializer for syncing a task to Google Calendar"""
    task_id = serializers.UUIDField()
    
    def validate_task_id(self, value):
        try:
            Task.objects.get(id=value)
        except Task.DoesNotExist:
            raise serializers.ValidationError("Task not found")
        return value


class CalendarSyncedTaskSerializer(serializers.ModelSerializer):
    """Serializer for synced task info"""
    task_name = serializers.CharField(source='task.name', read_only=True)
    project_name = serializers.CharField(source='task.project.name', read_only=True)
    deadline = serializers.DateField(source='task.deadline', read_only=True)

    class Meta:
        model = CalendarSyncedTask
        fields = ['id', 'task_name', 'project_name', 'deadline', 'google_event_id', 'synced_at']


# ProjectClientMembership Serializers
class ProjectClientMembershipSerializer(serializers.ModelSerializer):
    """Serializer for ProjectClientMembership - links clients to projects"""
    client_name = serializers.CharField(source="client.full_name", read_only=True)
    client_email = serializers.CharField(source="client.email", read_only=True)
    project_name = serializers.CharField(source="project.name", read_only=True)
    
    class Meta:
        model = ProjectClientMembership
        fields = [
            "id",
            "project",
            "project_name",
            "client",
            "client_name",
            "client_email",
            "status",
            "added_at",
            "completed_at",
            "archived_at",
        ]
        read_only_fields = ["id", "added_at", "completed_at", "archived_at"]


class ProjectClientMembershipCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating ProjectClientMembership"""
    class Meta:
        model = ProjectClientMembership
        fields = ["project", "client"]

    def validate(self, data):
        # Ensure no duplicate membership
        existing = ProjectClientMembership.objects.filter(
            project=data["project"],
            client=data["client"]
        ).exists()
        if existing:
            raise serializers.ValidationError("This client is already added to this project.")
        return data


class ClientHistorySerializer(serializers.Serializer):
    """Serializer for client history - aggregates client and project data"""
    client_id = serializers.UUIDField()
    client_name = serializers.CharField()
    client_email = serializers.CharField()
    total_projects = serializers.IntegerField()
    active_projects = serializers.IntegerField()
    completed_projects = serializers.IntegerField()
    status = serializers.CharField()
    last_activity = serializers.DateTimeField()

