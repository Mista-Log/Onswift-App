from rest_framework import generics, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from .models import Project, Task, ProjectSample, Deliverable, Message, Conversation
from .serializers import (
    ProjectSerializer, TaskSerializer, ProjectSampleSerializer,
    DeliverableSerializer, DeliverableCreateSerializer, DeliverableReviewSerializer,
    MessageSerializer, ConversationSerializer
)
from .permissions import IsCreator
from rest_framework import permissions
from django.db.models import Q

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
