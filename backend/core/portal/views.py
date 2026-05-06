"""
Portal views — Client Portal endpoints.
All endpoints enforce: authenticated + CLIENT role + resource ownership.
"""
from rest_framework.views import APIView
from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from django.utils import timezone
from django.contrib.auth import get_user_model

from project.models import Project, ProjectClientMembership
from .models import PortalMessage, ClientInvite
from .permissions import IsClientRole, IsProjectClient, IsCreatorOrProjectClient, get_client_project_ids
from .serializers import (
    PortalProjectSerializer,
    PortalProjectListSerializer,
    PortalMessageSerializer,
    PortalMessageCreateSerializer,
    ClientInviteSerializer,
    ClientInviteCreateSerializer,
    ClientInviteDetailSerializer,
    ClientInviteAcceptSerializer,
)


# ── Creator Endpoints ─────────────────────────────────────────────────

class ClientHistoryView(APIView):
    """
    GET /api/v5/clients/history/
    Returns all clients the creator has worked with (aggregated project data).
    Only accessible to creators.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        if request.user.role != "creator":
            return Response(
                {"error": "Only creators can access client history"},
                status=status.HTTP_403_FORBIDDEN,
            )

        # Get all clients this creator has worked with
        clients = request.user.projects.values_list(
            "client_memberships__client", flat=True
        ).distinct()

        # Aggregate data for each client
        client_data = []
        User = get_user_model()
        
        for client_id in clients:
            try:
                client = User.objects.get(id=client_id)
            except User.DoesNotExist:
                continue

            # Get memberships for this client
            memberships = ProjectClientMembership.objects.filter(
                client=client,
                project__creator=request.user,
            )

            total_projects = memberships.count()
            active_projects = memberships.filter(status="active").count()
            completed_projects = memberships.filter(status="completed").count()
            on_hold_projects = memberships.filter(status="on_hold").count()

            # Get most recent activity
            try:
                latest_membership = memberships.latest("added_at")
                last_activity = latest_membership.added_at
            except ProjectClientMembership.DoesNotExist:
                last_activity = None

            client_data.append({
                "id": str(client.id),
                "client_name": client.full_name,
                "client_email": client.email,
                "total_projects": total_projects,
                "active_projects": active_projects,
                "completed_projects": completed_projects,
                "on_hold_projects": on_hold_projects,
                "last_activity": last_activity,
            })

        # Sort by last activity (most recent first)
        client_data.sort(
            key=lambda x: x["last_activity"] if x["last_activity"] else timezone.now(),
            reverse=True
        )

        return Response({
            "clients": client_data,
            "count": len(client_data),
        })


# ── Project Endpoints ─────────────────────────────────────────────────

class PortalProjectListView(APIView):
    """
    GET /api/v5/projects/
    Returns all projects the client is associated with via ProjectClientMembership.
    If only one project, frontend should redirect directly to it.
    """
    permission_classes = [permissions.IsAuthenticated, IsClientRole]

    def get(self, request):
        project_ids = get_client_project_ids(request.user)
        projects = list(
            Project.objects.filter(id__in=project_ids).select_related("creator")
        )
        serializer = PortalProjectListSerializer(projects, many=True)

        return Response({
            "projects": serializer.data,
            "count": len(projects),
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


# ── Invite Endpoints ─────────────────────────────────────────────────

class ClientInviteCreateView(APIView):
    """
    GET /api/v5/projects/<project_id>/invites/
    List all invites for a project (creator only).
    
    POST /api/v5/projects/<project_id>/invites/
    Creator generates an invite link for a client with a customized onboarding form.
    Only the project creator can create invites.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, project_id):
        try:
            project = Project.objects.get(id=project_id)
        except Project.DoesNotExist:
            return Response(
                {"error": "Project not found"},
                status=status.HTTP_404_NOT_FOUND,
            )

        # Verify request user is the creator
        if project.creator != request.user:
            return Response(
                {"error": "Only the project creator can view invites"},
                status=status.HTTP_403_FORBIDDEN,
            )

        invites = ClientInvite.objects.filter(project=project).order_by("-created_at")
        serializer = ClientInviteSerializer(invites, many=True)

        return Response({
            "invites": serializer.data,
            "count": invites.count(),
        })

    def post(self, request, project_id):
        try:
            project = Project.objects.get(id=project_id)
        except Project.DoesNotExist:
            return Response(
                {"error": "Project not found"},
                status=status.HTTP_404_NOT_FOUND,
            )

        # Verify request user is the creator
        if project.creator != request.user:
            return Response(
                {"error": "Only the project creator can generate invites"},
                status=status.HTTP_403_FORBIDDEN,
            )

        serializer = ClientInviteCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        data = serializer.validated_data

        # Resolve template if it's just an ID, or use a default if none provided
        onboarding_form = data.get("onboarding_form")
        if not onboarding_form:
            # No form provided - use a simple default form
            onboarding_form = {
                "questions": [
                    {
                        "id": "name",
                        "type": "text",
                        "label": "Full Name",
                        "required": True,
                    },
                    {
                        "id": "email",
                        "type": "email",
                        "label": "Email Address",
                        "required": True,
                    },
                    {
                        "id": "role",
                        "type": "text",
                        "label": "Your Role",
                        "required": False,
                    },
                ]
            }
        elif isinstance(onboarding_form, dict) and "id" in onboarding_form and "questions" not in onboarding_form:
            # It's a template ID - resolve it
            from .templates import get_template
            template_id = onboarding_form["id"]
            template = get_template(template_id)
            onboarding_form = template  # Get full template with questions

        # Check if invite already exists for this email + project
        existing = ClientInvite.objects.filter(
            project=project,
            client_email=data["client_email"],
        ).first()

        if existing and existing.is_valid():
            return Response(
                {
                    "error": "Invite already exists for this client",
                    "token": existing.token,
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Create the invite
        invite = ClientInvite.generate_invite(
            project=project,
            creator=request.user,
            client_email=data["client_email"],
            onboarding_form=onboarding_form,
            expires_in_days=data.get("expires_in_days", 30),
        )

        return Response(
            ClientInviteSerializer(invite).data,
            status=status.HTTP_201_CREATED,
        )


class ClientInviteDetailView(APIView):
    """
    GET /api/v5/invites/<token>/
    Fetch invite details to display onboarding form to client.
    No authentication required (public endpoint, token-based access).
    """
    permission_classes = []

    def get(self, request, token):
        try:
            invite = ClientInvite.objects.get(token=token)
        except ClientInvite.DoesNotExist:
            return Response(
                {"error": "Invite not found"},
                status=status.HTTP_404_NOT_FOUND,
            )

        # Check if invite is expired
        if invite.is_expired():
            return Response(
                {"error": "Invite has expired"},
                status=status.HTTP_410_GONE,
            )

        # Check if already accepted
        if invite.accepted_at is not None:
            return Response(
                {"error": "Invite has already been accepted"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        return Response(ClientInviteDetailSerializer(invite).data)


class ClientInviteAcceptView(APIView):
    """
    POST /api/v5/invites/<token>/accept/
    Client accepts invite, submits onboarding form responses.
    Creates/links user to project via OnboardingInstance.
    Token-based access (no authentication required initially).
    """
    permission_classes = []

    def post(self, request, token):
        try:
            invite = ClientInvite.objects.get(token=token)
        except ClientInvite.DoesNotExist:
            return Response(
                {"error": "Invite not found"},
                status=status.HTTP_404_NOT_FOUND,
            )

        # Check if invite is expired
        if invite.is_expired():
            return Response(
                {"error": "Invite has expired"},
                status=status.HTTP_410_GONE,
            )

        # Check if already accepted
        if invite.accepted_at is not None:
            return Response(
                {"error": "Invite has already been accepted"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        serializer = ClientInviteAcceptSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        responses = serializer.validated_data["responses"]

        # Update invite with responses and acceptance timestamp
        invite.responses = responses
        invite.accepted_at = timezone.now()
        invite.save()

        # Check if client already exists
        User = get_user_model()
        try:
            client = User.objects.get(email=invite.client_email)
            # Client exists - create project membership and onboarding instance
            from onboarding.models import OnboardingInstance
            
            # Create OnboardingInstance for compatibility
            onboarding_instance, created = OnboardingInstance.objects.get_or_create(
                client=client,
                project=invite.project,
                defaults={
                    "status": "COMPLETED",
                },
            )

            # Create ProjectClientMembership
            membership, membership_created = ProjectClientMembership.objects.get_or_create(
                client=client,
                project=invite.project,
                defaults={
                    "status": "active",
                },
            )
            
            # If membership existed but was archived/completed, reactivate it
            if not membership_created and membership.status in ["archived", "completed"]:
                membership.status = "active"
                membership.save()

            return Response(
                {
                    "message": "Invite accepted. You can now access the project.",
                    "action": "redirect",
                    "project_id": str(invite.project.id),
                },
                status=status.HTTP_200_OK,
            )
        except User.DoesNotExist:
            # Client doesn't exist yet - redirect to signup
            return Response(
                {
                    "message": "Invite accepted. Please sign up to continue.",
                    "action": "signup",
                    "email": invite.client_email,
                    "project_id": str(invite.project.id),
                },
                status=status.HTTP_200_OK,
            )


class ClientInviteDeleteView(APIView):
    """
    DELETE /api/v5/projects/<project_id>/invites/<invite_id>/
    Creator deletes an invite for their project.
    Only the project creator can delete invites.
    """
    permission_classes = [permissions.IsAuthenticated]

    def delete(self, request, project_id, invite_id):
        try:
            project = Project.objects.get(id=project_id)
        except Project.DoesNotExist:
            return Response(
                {"error": "Project not found"},
                status=status.HTTP_404_NOT_FOUND,
            )

        # Verify request user is the creator
        if project.creator != request.user:
            return Response(
                {"error": "Only the project creator can delete invites"},
                status=status.HTTP_403_FORBIDDEN,
            )

        try:
            invite = ClientInvite.objects.get(id=invite_id, project=project)
        except ClientInvite.DoesNotExist:
            return Response(
                {"error": "Invite not found"},
                status=status.HTTP_404_NOT_FOUND,
            )

        email = invite.client_email
        invite.delete()

        return Response(
            {
                "message": f"Invite for {email} has been deleted",
                "deleted_id": str(invite_id),
            },
            status=status.HTTP_200_OK,
        )


class ClientDirectAddView(APIView):
    """
    POST /api/v5/projects/<project_id>/add-client/
    Creator directly adds an already-onboarded client to a project.
    No invite token/link is generated - client is added immediately.
    Client receives a notification that they've been added.
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, project_id):
        try:
            project = Project.objects.get(id=project_id)
        except Project.DoesNotExist:
            return Response(
                {"error": "Project not found"},
                status=status.HTTP_404_NOT_FOUND,
            )

        # Verify request user is the creator
        if project.creator != request.user:
            return Response(
                {"error": "Only the project creator can add clients"},
                status=status.HTTP_403_FORBIDDEN,
            )

        # Get client ID from request body
        client_id = request.data.get("client_id")
        if not client_id:
            return Response(
                {"error": "client_id is required"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Get the client user
        User = get_user_model()
        try:
            client = User.objects.get(id=client_id, role="client")
        except User.DoesNotExist:
            return Response(
                {"error": "Client not found"},
                status=status.HTTP_404_NOT_FOUND,
            )

        # Check if client is already part of this project
        existing_membership = ProjectClientMembership.objects.filter(
            client=client,
            project=project,
        ).first()

        if existing_membership:
            if existing_membership.status == "active":
                return Response(
                    {"error": "Client is already part of this project"},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            else:
                # Reactivate archived or completed membership
                existing_membership.status = "active"
                existing_membership.save()
                return Response(
                    {
                        "message": f"Client {client.full_name} has been reactivated on the project",
                        "client": {
                            "id": str(client.id),
                            "email": client.email,
                            "full_name": client.full_name,
                        },
                    },
                    status=status.HTTP_200_OK,
                )

        # Create the membership
        membership = ProjectClientMembership.objects.create(
            client=client,
            project=project,
            status="active",
        )

        # Send notification to client
        from notification.services import create_notification
        
        create_notification(
            user=client,
            title="Added to Project",
            message=f"You've been added to the project '{project.name}'",
            notification_type="project_added",
            related_project=project,
        )

        return Response(
            {
                "message": f"Client {client.full_name} has been added to the project",
                "client": {
                    "id": str(client.id),
                    "email": client.email,
                    "full_name": client.full_name,
                },
            },
            status=status.HTTP_201_CREATED,
        )

