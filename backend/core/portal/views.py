"""
Portal views — Client Portal endpoints.
All endpoints enforce: authenticated + CLIENT role + resource ownership.
"""
from rest_framework.views import APIView
from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from django.utils import timezone

from project.models import Project
from .models import PortalMessage
from .permissions import IsClientRole, IsProjectClient, IsCreatorOrProjectClient
from .serializers import (
    PortalProjectSerializer,
    PortalProjectListSerializer,
    PortalMessageSerializer,
    PortalMessageCreateSerializer,
)


# ── Project Endpoints ─────────────────────────────────────────────────

class PortalProjectListView(APIView):
    """
    GET /api/v5/projects/
    Returns all projects the client is associated with.
    If only one project, frontend should redirect directly to it.
    """
    permission_classes = [permissions.IsAuthenticated, IsClientRole]

    def get(self, request):
        from onboarding.models import OnboardingInstance

        # Get all projects this client is linked to via completed onboarding
        project_ids = OnboardingInstance.objects.filter(
            client=request.user,
            status="COMPLETED",
            project__isnull=False,
        ).values_list("project_id", flat=True)

        projects = Project.objects.filter(id__in=project_ids)
        serializer = PortalProjectListSerializer(projects, many=True)

        return Response({
            "projects": serializer.data,
            "count": projects.count(),
        })


class PortalProjectDetailView(APIView):
    """
    GET /api/v5/projects/<project_id>/
    Full project dashboard for the client: project info, milestones,
    deliverables, tasks, progress, and recent messages.
    """
    permission_classes = [permissions.IsAuthenticated, IsClientRole, IsProjectClient]

    def get(self, request, project_id):
        try:
            project = Project.objects.prefetch_related(
                "tasks", "tasks__deliverables", "tasks__deliverables__files"
            ).get(id=project_id)
        except Project.DoesNotExist:
            return Response(
                {"error": "Project not found"},
                status=status.HTTP_404_NOT_FOUND,
            )

        project_data = PortalProjectSerializer(project).data

        # Include recent messages (last 50)
        messages = PortalMessage.objects.filter(
            project=project,
        ).select_related("sender").order_by("-created_at")[:50]
        messages_data = PortalMessageSerializer(
            reversed(list(messages)), many=True
        ).data

        return Response({
            "project": project_data,
            "messages": messages_data,
        })


# ── Messaging Endpoints ──────────────────────────────────────────────

class PortalMessageListView(APIView):
    """
    GET /api/v5/projects/<project_id>/messages/
    Returns paginated chat history for this project.
    Query params: ?before=<message_id>&limit=50
    """
    permission_classes = [permissions.IsAuthenticated, IsCreatorOrProjectClient]

    def get(self, request, project_id):
        limit = min(int(request.query_params.get("limit", 50)), 100)

        qs = PortalMessage.objects.filter(
            project_id=project_id,
        ).select_related("sender").order_by("-created_at")

        before = request.query_params.get("before")
        if before:
            try:
                ref_msg = PortalMessage.objects.get(id=before)
                qs = qs.filter(created_at__lt=ref_msg.created_at)
            except PortalMessage.DoesNotExist:
                pass

        messages = list(qs[:limit])
        messages.reverse()  # Oldest first

        return Response({
            "messages": PortalMessageSerializer(messages, many=True).data,
            "has_more": qs.count() > limit,
        })


class PortalMessageCreateView(APIView):
    """
    POST /api/v5/projects/<project_id>/messages/send/
    Send a message in the portal chat. Supports file attachments.
    """
    permission_classes = [permissions.IsAuthenticated, IsCreatorOrProjectClient]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def post(self, request, project_id):
        serializer = PortalMessageCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        data = serializer.validated_data

        message = PortalMessage.objects.create(
            project_id=project_id,
            sender=request.user,
            content=data["content"],
            file=data.get("file"),
            file_name=data.get("file_name", ""),
        )

        # Create notification for the other party
        self._notify_recipient(request.user, project_id, message)

        return Response(
            PortalMessageSerializer(message).data,
            status=status.HTTP_201_CREATED,
        )

    def _notify_recipient(self, sender, project_id, message):
        """Send notification to the other participant in the conversation."""
        from notification.services import create_notification

        try:
            project = Project.objects.get(id=project_id)
        except Project.DoesNotExist:
            return

        if sender.role == "client":
            # Notify the creator
            recipient = project.creator
        else:
            # Notify the client
            from onboarding.models import OnboardingInstance
            instance = OnboardingInstance.objects.filter(
                project=project,
                status="COMPLETED",
                client__isnull=False,
            ).first()
            recipient = instance.client if instance else None

        if recipient:
            create_notification(
                user=recipient,
                title="New Portal Message",
                message=f"{sender.full_name}: {message.content[:100]}",
                notification_type="system",
            )


class PortalMessageMarkReadView(APIView):
    """
    POST /api/v5/projects/<project_id>/messages/read/
    Mark all unread messages in this project as read for the current user.
    """
    permission_classes = [permissions.IsAuthenticated, IsCreatorOrProjectClient]

    def post(self, request, project_id):
        updated = PortalMessage.objects.filter(
            project_id=project_id,
            is_read=False,
        ).exclude(
            sender=request.user,  # Don't mark own messages
        ).update(
            is_read=True,
            read_at=timezone.now(),
        )

        return Response({"marked_read": updated})


class PortalUnreadCountView(APIView):
    """
    GET /api/v5/projects/<project_id>/messages/unread/
    Returns count of unread messages for the current user.
    """
    permission_classes = [permissions.IsAuthenticated, IsCreatorOrProjectClient]

    def get(self, request, project_id):
        count = PortalMessage.objects.filter(
            project_id=project_id,
            is_read=False,
        ).exclude(sender=request.user).count()

        return Response({"unread_count": count})
