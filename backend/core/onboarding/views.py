"""
Onboarding views — Creator form builder, link management, and client-facing onboarding flow.
"""
from rest_framework.views import APIView
from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken
from django.utils import timezone
from django.db import transaction

from .models import OnboardingTemplate, OnboardingInstance
from .serializers import (
    OnboardingTemplateSerializer,
    OnboardingTemplateListSerializer,
    OnboardingInstanceSerializer,
    OnboardingInstanceCreateSerializer,
    OnboardingPublicSerializer,
    ClientSignupSerializer,
)


class IsCreatorRole(permissions.BasePermission):
    """Only allow users with role='creator'."""
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.role == "creator"


# ── Template CRUD (Creator only) ─────────────────────────────────────

class OnboardingTemplateListCreateView(generics.ListCreateAPIView):
    """
    GET  — List all templates owned by the creator.
    POST — Create a new onboarding template.
    """
    permission_classes = [permissions.IsAuthenticated, IsCreatorRole]

    def get_serializer_class(self):
        if self.request.method == "GET":
            return OnboardingTemplateListSerializer
        return OnboardingTemplateSerializer

    def get_queryset(self):
        return OnboardingTemplate.objects.filter(creator=self.request.user)

    def perform_create(self, serializer):
        serializer.save(creator=self.request.user)


class OnboardingTemplateDetailView(generics.RetrieveUpdateDestroyAPIView):
    """
    GET    — Retrieve full template detail (includes blocks).
    PATCH  — Update template title/blocks.
    DELETE — Delete template and all associated instances.
    """
    serializer_class = OnboardingTemplateSerializer
    permission_classes = [permissions.IsAuthenticated, IsCreatorRole]

    def get_queryset(self):
        return OnboardingTemplate.objects.filter(creator=self.request.user)


# ── Instance Management (Creator only) ───────────────────────────────

class OnboardingInstanceListView(generics.ListAPIView):
    """
    GET — List all onboarding instances for the creator, optionally filtered by template.
    Query params: ?template_id=<uuid>&status=<SENT|OPENED|COMPLETED>
    """
    serializer_class = OnboardingInstanceSerializer
    permission_classes = [permissions.IsAuthenticated, IsCreatorRole]

    def get_queryset(self):
        qs = OnboardingInstance.objects.filter(
            template__creator=self.request.user
        ).select_related("template", "client", "project")

        template_id = self.request.query_params.get("template_id")
        if template_id:
            qs = qs.filter(template_id=template_id)

        status_filter = self.request.query_params.get("status")
        if status_filter:
            qs = qs.filter(status=status_filter.upper())

        return qs


class OnboardingInstanceCreateView(APIView):
    """
    POST — Generate a new onboarding link for a template.
    Input: { template_id, expires_at? }
    Output: { slug, url, status, created_at }
    """
    permission_classes = [permissions.IsAuthenticated, IsCreatorRole]

    def post(self, request):
        serializer = OnboardingInstanceCreateSerializer(
            data=request.data, context={"request": request}
        )
        serializer.is_valid(raise_exception=True)

        template = OnboardingTemplate.objects.get(
            id=serializer.validated_data["template_id"],
            creator=request.user,
        )

        instance = OnboardingInstance.objects.create(
            template=template,
            expires_at=serializer.validated_data.get("expires_at"),
        )

        # Notify creator that link was generated
        from notification.services import create_notification
        create_notification(
            user=request.user,
            title="Onboarding Link Sent",
            message=f"A new onboarding link was generated for \"{template.title}\".",
            notification_type="system",
        )

        return Response(
            OnboardingInstanceSerializer(instance, context={"request": request}).data,
            status=status.HTTP_201_CREATED,
        )


class OnboardingInstanceDetailView(generics.RetrieveAPIView):
    """
    GET — Retrieve a single onboarding instance's full details.
    """
    serializer_class = OnboardingInstanceSerializer
    permission_classes = [permissions.IsAuthenticated, IsCreatorRole]

    def get_queryset(self):
        return OnboardingInstance.objects.filter(
            template__creator=self.request.user
        ).select_related("template", "client", "project")


# ── Public / Client-facing Endpoints ─────────────────────────────────

class OnboardingPublicView(APIView):
    """
    GET /api/v4/onboard/<slug>/
    Public endpoint — returns the onboarding form for the given slug.
    Also marks status as OPENED if currently SENT.
    """
    permission_classes = [permissions.AllowAny]

    def get(self, request, slug):
        try:
            instance = OnboardingInstance.objects.select_related(
                "template", "template__creator"
            ).get(slug=slug)
        except OnboardingInstance.DoesNotExist:
            return Response(
                {"error": "Onboarding link not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        # Check expiry
        if instance.is_expired:
            return Response(
                {"error": "This onboarding link has expired.", "is_expired": True},
                status=status.HTTP_410_GONE,
            )

        # Check already completed
        if instance.status == "COMPLETED":
            return Response(
                {"error": "This onboarding form has already been completed.", "status": "COMPLETED"},
                status=status.HTTP_409_CONFLICT,
            )

        # Mark as OPENED
        if instance.status == "SENT":
            instance.status = "OPENED"
            instance.save(update_fields=["status"])

            # Notify creator that the client opened the link
            from notification.services import create_notification
            create_notification(
                user=creator,
                title="Onboarding Link Opened",
                message=f"Someone opened the onboarding link for \"{instance.template.title}\".",
                notification_type="system",
            )

        creator = instance.template.creator
        creator_profile = getattr(creator, "creatorprofile", None)

        data = OnboardingPublicSerializer({
            "slug": instance.slug,
            "title": instance.template.title,
            "blocks": instance.template.blocks,
            "creator_name": creator.full_name or creator.email,
            "creator_company": getattr(creator_profile, "company_name", None) if creator_profile else None,
            "is_expired": instance.is_expired,
            "status": instance.status,
        }).data

        return Response(data)


class ClientOnboardingSubmitView(APIView):
    """
    POST /api/v4/onboard/<slug>/submit/
    Client signs up + submits form responses.
    Atomic: creates User, updates instance, auto-files responses to Document Library.
    """
    permission_classes = [permissions.AllowAny]

    def post(self, request, slug):
        try:
            instance = OnboardingInstance.objects.select_related(
                "template", "template__creator"
            ).get(slug=slug)
        except OnboardingInstance.DoesNotExist:
            return Response(
                {"error": "Onboarding link not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        if instance.is_expired:
            return Response(
                {"error": "This onboarding link has expired."},
                status=status.HTTP_410_GONE,
            )

        if instance.status == "COMPLETED":
            return Response(
                {"error": "This onboarding form has already been completed."},
                status=status.HTTP_409_CONFLICT,
            )

        serializer = ClientSignupSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        data = serializer.validated_data
        creator = instance.template.creator

        try:
            with transaction.atomic():
                # 1. Create CLIENT user
                from account.models import User
                client_user = User.objects.create_user(
                    email=data["email"],
                    full_name=data["full_name"],
                    password=data["password"],
                    role="client",
                )

                # 2. Update onboarding instance
                instance.client = client_user
                instance.status = "COMPLETED"
                instance.completed_at = timezone.now()
                instance.responses = data["responses"]
                instance.save(update_fields=[
                    "client", "status", "completed_at", "responses"
                ])

                # 3. Auto-file responses into Document Library
                self._auto_file_responses(creator, client_user, instance)

                # 4. Create notification for creator
                from notification.services import create_notification
                create_notification(
                    user=creator,
                    title="New Client Onboarded",
                    message=f"{client_user.full_name} completed the onboarding form \"{instance.template.title}\".",
                    notification_type="system",
                )

            # Generate JWT tokens for the new client
            refresh = RefreshToken.for_user(client_user)

            return Response({
                "message": "Onboarding completed successfully",
                "access": str(refresh.access_token),
                "refresh": str(refresh),
                "user": {
                    "id": str(client_user.id),
                    "email": client_user.email,
                    "full_name": client_user.full_name,
                    "role": client_user.role,
                },
            }, status=status.HTTP_201_CREATED)

        except Exception as e:
            return Response(
                {"error": f"Failed to complete onboarding: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

    def _auto_file_responses(self, creator, client_user, instance):
        """
        Auto-file onboarding responses into the Document Library.
        Creates client folder structure if it doesn't exist.
        This runs within the outer transaction — if it fails, the entire
        onboarding is rolled back (atomicity guaranteed).
        """
        try:
            from library.models import Folder, Document
            import json

            # Get or create client root folder
            client_folder, _ = Folder.objects.get_or_create(
                creator=creator,
                client=client_user,
                folder_type="CLIENT",
                parent_folder=None,
                defaults={"name": client_user.full_name or client_user.email},
            )

            # Get or create Onboarding Responses subfolder
            responses_folder, _ = Folder.objects.get_or_create(
                creator=creator,
                parent_folder=client_folder,
                name="Onboarding Responses",
                defaults={
                    "folder_type": "CLIENT",
                    "client": client_user,
                },
            )

            # Create a structured JSON document from the responses
            response_content = json.dumps({
                "template_title": instance.template.title,
                "completed_at": str(instance.completed_at),
                "client_name": client_user.full_name,
                "client_email": client_user.email,
                "responses": instance.responses,
            }, indent=2)

            # Save as a JSON file
            from django.core.files.base import ContentFile
            file_name = f"onboarding_{instance.slug}.json"
            content_file = ContentFile(response_content.encode("utf-8"), name=file_name)

            Document.objects.create(
                creator=creator,
                client=client_user,
                folder=responses_folder,
                name=file_name,
                file=content_file,
                file_type="application/json",
                size_kb=len(response_content) / 1024,
                tags=["onboarding", "auto-filed"],
            )
        except ImportError:
            # Library app not yet migrated — skip auto-filing silently
            pass
