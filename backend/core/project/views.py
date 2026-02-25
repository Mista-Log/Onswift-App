from rest_framework import generics, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from .models import Project, Task, ProjectSample, Deliverable, Message, Conversation, Group, GroupMembership, GroupMessage, GroupMessageReadStatus
from .models import GoogleCalendarToken, CalendarSyncedTask
from .serializers import (
    ProjectSerializer, TaskSerializer, ProjectSampleSerializer,
    DeliverableSerializer, DeliverableCreateSerializer, DeliverableReviewSerializer,
    MessageSerializer, ConversationSerializer,
    GroupSerializer, GroupCreateSerializer, GroupUpdateSerializer,
    GroupMemberSerializer, GroupMessageSerializer, GroupMessageCreateSerializer,
    GroupAddMembersSerializer,
    GoogleCalendarStatusSerializer, GoogleCalendarConnectSerializer,
    TaskSyncSerializer, CalendarSyncedTaskSerializer,
)
from .permissions import IsCreator
from rest_framework import permissions
from django.db.models import Q
from . import google_calendar

# Project Views
class ProjectListCreateView(generics.ListCreateAPIView):
    serializer_class = ProjectSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if user.role == "creator":
            # Creators see their own projects
            return Project.objects.filter(creator=user)
        else:
            # Talents see projects where they are assigned to tasks
            return Project.objects.filter(tasks__assignee=user).distinct()

    def perform_create(self, serializer):
        # Automatically assign creator
        serializer.save(creator=self.request.user)



class ProjectDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = ProjectSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if user.role == "creator":
            return Project.objects.filter(creator=user)
        else:
            # Talents can view projects where they have assigned tasks
            return Project.objects.filter(tasks__assignee=user).distinct()

    def check_permissions(self, request):
        super().check_permissions(request)
        # Only creators can update/delete
        if request.method in ['PUT', 'PATCH', 'DELETE']:
            if request.user.role != "creator":
                from rest_framework.exceptions import PermissionDenied
                raise PermissionDenied("Only creators can modify projects.")


# Task Views
class TaskListCreateView(generics.ListCreateAPIView):
    serializer_class = TaskSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        project_id = self.kwargs["project_id"]

        if user.role == "creator":
            # Creators see all tasks for their projects
            try:
                project = Project.objects.get(id=project_id, creator=user)
                return project.tasks.all()
            except Project.DoesNotExist:
                return Task.objects.none()
        else:
            # Talents see only tasks assigned to them in this project
            return Task.objects.filter(
                project_id=project_id,
                assignee=user
            )

    def perform_create(self, serializer):
        user = self.request.user
        # Only creators can create tasks
        if user.role != "creator":
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied("Only creators can create tasks.")

        try:
            project = Project.objects.get(
                id=self.kwargs["project_id"],
                creator=user
            )
            serializer.save(project=project)
        except Project.DoesNotExist:
            from rest_framework.exceptions import NotFound
            raise NotFound("Project not found.")



class TaskDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = TaskSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if user.role == "creator":
            # Creators can access tasks in their projects
            return Task.objects.filter(project__creator=user)
        else:
            # Talents can only access tasks assigned to them
            return Task.objects.filter(assignee=user)

    def check_permissions(self, request):
        super().check_permissions(request)
        # Only creators can delete tasks
        if request.method == 'DELETE':
            if request.user.role != "creator":
                from rest_framework.exceptions import PermissionDenied
                raise PermissionDenied("Only creators can delete tasks.")


class ProjectSampleListCreateView(generics.ListCreateAPIView):
    serializer_class = ProjectSampleSerializer
    permission_classes = [IsAuthenticated, IsCreator]

    def get_queryset(self):
        project_id = self.kwargs["project_id"]
        return ProjectSample.objects.filter(project_id=project_id)

    def perform_create(self, serializer):
        project = Project.objects.get(id=self.kwargs["project_id"])
        serializer.save(project=project)


class ProjectSampleDeleteView(generics.DestroyAPIView):
    serializer_class = ProjectSampleSerializer
    permission_classes = [IsAuthenticated, IsCreator]
    queryset = ProjectSample.objects.all()


# Talent Tasks View - Get all tasks assigned to current talent
class TalentTasksListView(generics.ListAPIView):
    serializer_class = TaskSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        return Task.objects.filter(assignee=user).select_related('project')


# Deliverable Views
class DeliverableListCreateView(generics.ListCreateAPIView):
    permission_classes = [IsAuthenticated]

    def get_serializer_class(self):
        if self.request.method == 'POST':
            return DeliverableCreateSerializer
        return DeliverableSerializer

    def get_queryset(self):
        user = self.request.user
        if user.role == "creator":
            # Creators see deliverables for their projects
            return Deliverable.objects.filter(task__project__creator=user)
        else:
            # Talents see their own deliverables
            return Deliverable.objects.filter(submitted_by=user)


class DeliverableDetailView(generics.RetrieveAPIView):
    serializer_class = DeliverableSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if user.role == "creator":
            return Deliverable.objects.filter(task__project__creator=user)
        else:
            return Deliverable.objects.filter(submitted_by=user)


class DeliverableReviewView(generics.UpdateAPIView):
    """Creator can approve or request revision on deliverables"""
    serializer_class = DeliverableReviewSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if user.role != "creator":
            return Deliverable.objects.none()
        return Deliverable.objects.filter(task__project__creator=user)


# Conversation Views
class ConversationListView(generics.ListAPIView):
    serializer_class = ConversationSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Conversation.objects.filter(participants=self.request.user)


class ConversationCreateView(APIView):
    """Get or create a conversation with another user"""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        other_user_id = request.data.get("user_id")
        if not other_user_id:
            return Response({"error": "user_id is required"}, status=status.HTTP_400_BAD_REQUEST)

        from account.models import User
        try:
            other_user = User.objects.get(id=other_user_id)
        except User.DoesNotExist:
            return Response({"error": "User not found"}, status=status.HTTP_404_NOT_FOUND)

        # Check if conversation already exists
        conversation = Conversation.objects.filter(
            participants=request.user
        ).filter(
            participants=other_user
        ).first()

        if not conversation:
            conversation = Conversation.objects.create()
            conversation.participants.add(request.user, other_user)

        serializer = ConversationSerializer(conversation, context={"request": request})
        return Response(serializer.data)


# Message Views
class MessageListView(generics.ListAPIView):
    serializer_class = MessageSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        conversation_id = self.kwargs.get("conversation_id")
        user = self.request.user

        # Verify user is part of conversation
        try:
            conversation = Conversation.objects.get(id=conversation_id, participants=user)
        except Conversation.DoesNotExist:
            return Message.objects.none()

        # Get messages between the two participants
        other_user = conversation.participants.exclude(id=user.id).first()
        if not other_user:
            return Message.objects.none()

        return Message.objects.filter(
            Q(sender=user, recipient=other_user) |
            Q(sender=other_user, recipient=user)
        ).order_by("created_at")


class MessageCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, conversation_id):
        user = request.user
        content = request.data.get("content")

        if not content:
            return Response({"error": "content is required"}, status=status.HTTP_400_BAD_REQUEST)

        # Verify user is part of conversation
        try:
            conversation = Conversation.objects.get(id=conversation_id, participants=user)
        except Conversation.DoesNotExist:
            return Response({"error": "Conversation not found"}, status=status.HTTP_404_NOT_FOUND)

        other_user = conversation.participants.exclude(id=user.id).first()
        if not other_user:
            return Response({"error": "Invalid conversation"}, status=status.HTTP_400_BAD_REQUEST)

        # Create message
        message = Message.objects.create(
            sender=user,
            recipient=other_user,
            content=content
        )

        # Update conversation
        conversation.last_message = message
        conversation.save()

        # Notify recipient
        from notification.services import create_notification
        create_notification(
            user=other_user,
            title="New Message",
            message=f"{user.full_name} sent you a message.",
            notification_type="system",
        )

        serializer = MessageSerializer(message, context={"request": request})
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class MessageMarkReadView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, conversation_id):
        user = request.user

        try:
            conversation = Conversation.objects.get(id=conversation_id, participants=user)
        except Conversation.DoesNotExist:
            return Response({"error": "Conversation not found"}, status=status.HTTP_404_NOT_FOUND)

        # Mark all messages from other user as read
        other_user = conversation.participants.exclude(id=user.id).first()
        Message.objects.filter(
            sender=other_user,
            recipient=user,
            is_read=False
        ).update(is_read=True)

        return Response({"status": "ok"})


# ============================================
# Group Chat Views
# ============================================

class GroupListCreateView(generics.ListCreateAPIView):
    """List user's groups or create a new group"""
    permission_classes = [IsAuthenticated]

    def get_serializer_class(self):
        if self.request.method == 'POST':
            return GroupCreateSerializer
        return GroupSerializer

    def get_queryset(self):
        user = self.request.user
        return Group.objects.filter(memberships__user=user).distinct()


class GroupDetailView(generics.RetrieveUpdateDestroyAPIView):
    """Get, update, or delete a group"""
    permission_classes = [IsAuthenticated]

    def get_serializer_class(self):
        if self.request.method in ['PUT', 'PATCH']:
            return GroupUpdateSerializer
        return GroupSerializer

    def get_queryset(self):
        user = self.request.user
        return Group.objects.filter(memberships__user=user)

    def check_object_permissions(self, request, obj):
        super().check_object_permissions(request, obj)
        # Only admins can update/delete
        if request.method in ['PUT', 'PATCH', 'DELETE']:
            try:
                membership = obj.memberships.get(user=request.user)
                if membership.role != "admin":
                    from rest_framework.exceptions import PermissionDenied
                    raise PermissionDenied("Only group admins can modify the group.")
            except GroupMembership.DoesNotExist:
                from rest_framework.exceptions import PermissionDenied
                raise PermissionDenied("You are not a member of this group.")


class GroupMembersView(APIView):
    """List members or add members to a group"""
    permission_classes = [IsAuthenticated]

    def get(self, request, group_id):
        """List group members"""
        try:
            group = Group.objects.get(id=group_id, memberships__user=request.user)
        except Group.DoesNotExist:
            return Response({"error": "Group not found"}, status=status.HTTP_404_NOT_FOUND)

        memberships = group.memberships.select_related('user')
        serializer = GroupMemberSerializer(memberships, many=True, context={"request": request})
        return Response(serializer.data)

    def post(self, request, group_id):
        """Add members to a group"""
        try:
            group = Group.objects.get(id=group_id)
            membership = group.memberships.get(user=request.user)
            if membership.role != "admin":
                return Response({"error": "Only admins can add members"}, status=status.HTTP_403_FORBIDDEN)
        except Group.DoesNotExist:
            return Response({"error": "Group not found"}, status=status.HTTP_404_NOT_FOUND)
        except GroupMembership.DoesNotExist:
            return Response({"error": "You are not a member of this group"}, status=status.HTTP_403_FORBIDDEN)

        serializer = GroupAddMembersSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        from account.models import User
        added = []
        for member_id in serializer.validated_data['member_ids']:
            try:
                user = User.objects.get(id=member_id)
                # Check if already a member
                if not group.memberships.filter(user=user).exists():
                    GroupMembership.objects.create(
                        group=group,
                        user=user,
                        role="member"
                    )
                    added.append(str(member_id))
            except User.DoesNotExist:
                continue

        return Response({"added": added}, status=status.HTTP_201_CREATED)


class GroupRemoveMemberView(APIView):
    """Remove a member from a group"""
    permission_classes = [IsAuthenticated]

    def delete(self, request, group_id, user_id):
        try:
            group = Group.objects.get(id=group_id)
            requester_membership = group.memberships.get(user=request.user)
        except Group.DoesNotExist:
            return Response({"error": "Group not found"}, status=status.HTTP_404_NOT_FOUND)
        except GroupMembership.DoesNotExist:
            return Response({"error": "You are not a member of this group"}, status=status.HTTP_403_FORBIDDEN)

        # Only admins can remove others, but anyone can leave
        if str(request.user.id) != str(user_id) and requester_membership.role != "admin":
            return Response({"error": "Only admins can remove other members"}, status=status.HTTP_403_FORBIDDEN)

        try:
            membership_to_remove = group.memberships.get(user_id=user_id)
            
            # Prevent removing the last admin
            if membership_to_remove.role == "admin":
                admin_count = group.memberships.filter(role="admin").count()
                if admin_count <= 1:
                    return Response(
                        {"error": "Cannot remove the last admin. Promote another member first."},
                        status=status.HTTP_400_BAD_REQUEST
                    )
            
            membership_to_remove.delete()
            return Response({"status": "removed"}, status=status.HTTP_200_OK)
        except GroupMembership.DoesNotExist:
            return Response({"error": "User is not a member of this group"}, status=status.HTTP_404_NOT_FOUND)


class GroupLeaveView(APIView):
    """Leave a group"""
    permission_classes = [IsAuthenticated]

    def post(self, request, group_id):
        try:
            group = Group.objects.get(id=group_id)
            membership = group.memberships.get(user=request.user)
        except Group.DoesNotExist:
            return Response({"error": "Group not found"}, status=status.HTTP_404_NOT_FOUND)
        except GroupMembership.DoesNotExist:
            return Response({"error": "You are not a member of this group"}, status=status.HTTP_404_NOT_FOUND)

        # Prevent last admin from leaving
        if membership.role == "admin":
            admin_count = group.memberships.filter(role="admin").count()
            if admin_count <= 1 and group.memberships.count() > 1:
                return Response(
                    {"error": "You are the last admin. Promote another member first."},
                    status=status.HTTP_400_BAD_REQUEST
                )

        membership.delete()

        # If no members left, delete the group
        if group.memberships.count() == 0:
            group.delete()

        return Response({"status": "left"})


class GroupMessagesView(generics.ListAPIView):
    """List messages in a group"""
    serializer_class = GroupMessageSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        group_id = self.kwargs.get('group_id')
        user = self.request.user

        # Verify user is a member
        try:
            Group.objects.get(id=group_id, memberships__user=user)
        except Group.DoesNotExist:
            return GroupMessage.objects.none()

        return GroupMessage.objects.filter(group_id=group_id).order_by('created_at')


class GroupMessageCreateView(APIView):
    """Send a message to a group"""
    permission_classes = [IsAuthenticated]

    def post(self, request, group_id):
        user = request.user
        content = request.data.get('content')
        mention_ids = request.data.get('mention_ids', [])

        if not content:
            return Response({"error": "content is required"}, status=status.HTTP_400_BAD_REQUEST)

        # Verify user is a member
        try:
            group = Group.objects.get(id=group_id, memberships__user=user)
        except Group.DoesNotExist:
            return Response({"error": "Group not found"}, status=status.HTTP_404_NOT_FOUND)

        serializer = GroupMessageCreateSerializer(
            data={'content': content, 'mention_ids': mention_ids},
            context={'request': request, 'group': group}
        )

        if serializer.is_valid():
            message = serializer.save()
            return Response(
                GroupMessageSerializer(message, context={'request': request}).data,
                status=status.HTTP_201_CREATED
            )
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class GroupMessagesMarkReadView(APIView):
    """Mark all messages in a group as read"""
    permission_classes = [IsAuthenticated]

    def post(self, request, group_id):
        user = request.user

        try:
            group = Group.objects.get(id=group_id, memberships__user=user)
        except Group.DoesNotExist:
            return Response({"error": "Group not found"}, status=status.HTTP_404_NOT_FOUND)

        # Get all unread messages
        unread_messages = group.messages.exclude(
            read_statuses__user=user
        )

        # Create read status for each
        for message in unread_messages:
            GroupMessageReadStatus.objects.get_or_create(
                message=message,
                user=user
            )

        return Response({"status": "ok"})


class AvailableMembersView(APIView):
    """Get available team members that can be added to a group"""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user

        if user.role != 'creator':
            return Response({"error": "Only creators can access this endpoint"}, status=status.HTTP_403_FORBIDDEN)

        # Get accepted team members from HireRequest
        from notification.models import HireRequest
        
        accepted_hires = HireRequest.objects.filter(
            creator=user,
            status="accepted"
        ).select_related('talent', 'talent__talentprofile')

        members = []
        for hire in accepted_hires:
            talent = hire.talent
            avatar = None
            try:
                if talent.talentprofile.avatar:
                    avatar = request.build_absolute_uri(talent.talentprofile.avatar.url)
            except AttributeError:
                pass

            role = "Talent"
            try:
                role = talent.talentprofile.professional_title or "Talent"
            except AttributeError:
                pass

            members.append({
                'userId': str(talent.id),
                'name': talent.full_name,
                'email': talent.email,
                'role': role,
                'avatar': avatar,
            })

        return Response(members)


# Google Calendar Views
class GoogleCalendarStatusView(APIView):
    """Check if user has connected Google Calendar"""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        try:
            GoogleCalendarToken.objects.get(user=request.user)
            synced_count = CalendarSyncedTask.objects.filter(user=request.user).count()
            return Response({
                'is_connected': True,
                'synced_tasks_count': synced_count,
            })
        except GoogleCalendarToken.DoesNotExist:
            return Response({
                'is_connected': False,
                'synced_tasks_count': 0,
            })


class GoogleCalendarConnectView(generics.CreateAPIView):
    """Store Google OAuth tokens after frontend OAuth flow"""
    permission_classes = [IsAuthenticated]
    serializer_class = GoogleCalendarConnectSerializer

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response({
            'message': 'Google Calendar connected successfully',
            'is_connected': True
        }, status=status.HTTP_201_CREATED)


class GoogleCalendarDisconnectView(APIView):
    """Disconnect Google Calendar"""
    permission_classes = [IsAuthenticated]

    def delete(self, request, *args, **kwargs):
        GoogleCalendarToken.objects.filter(user=request.user).delete()
        CalendarSyncedTask.objects.filter(user=request.user).delete()
        return Response({
            'message': 'Google Calendar disconnected',
            'is_connected': False
        }, status=status.HTTP_200_OK)


class SyncTaskToCalendarView(APIView):
    """Sync a single task to Google Calendar"""
    permission_classes = [IsAuthenticated]

    def post(self, request, *args, **kwargs):
        serializer = TaskSyncSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        task_id = serializer.validated_data['task_id']
        task = Task.objects.get(id=task_id)
        
        event_id = google_calendar.create_calendar_event(request.user, task)
        
        if event_id:
            return Response({
                'message': 'Task synced to Google Calendar',
                'google_event_id': event_id
            }, status=status.HTTP_201_CREATED)
        else:
            return Response({
                'error': 'Failed to sync task. Make sure Google Calendar is connected and the task has a deadline.'
            }, status=status.HTTP_400_BAD_REQUEST)


class UnsyncTaskFromCalendarView(APIView):
    """Remove a task from Google Calendar"""
    permission_classes = [IsAuthenticated]

    def delete(self, request, task_id, *args, **kwargs):
        try:
            task = Task.objects.get(id=task_id)
            success = google_calendar.delete_calendar_event(request.user, task)
            
            if success:
                return Response({
                    'message': 'Task removed from Google Calendar'
                }, status=status.HTTP_200_OK)
            else:
                return Response({
                    'error': 'Failed to remove task from calendar'
                }, status=status.HTTP_400_BAD_REQUEST)
        except Task.DoesNotExist:
            return Response({
                'error': 'Task not found'
            }, status=status.HTTP_404_NOT_FOUND)


class SyncAllTasksView(APIView):
    """Sync all tasks to Google Calendar"""
    permission_classes = [IsAuthenticated]

    def post(self, request, *args, **kwargs):
        result = google_calendar.sync_all_tasks(request.user)
        
        if 'error' in result:
            return Response(result, status=status.HTTP_400_BAD_REQUEST)
        
        return Response({
            'message': f"Synced {result['success']} tasks, {result['failed']} failed",
            **result
        }, status=status.HTTP_200_OK)


class SyncedTasksListView(generics.ListAPIView):
    """List all synced tasks for the current user"""
    permission_classes = [IsAuthenticated]
    serializer_class = CalendarSyncedTaskSerializer

    def get_queryset(self):
        return CalendarSyncedTask.objects.filter(user=self.request.user)
