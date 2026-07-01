"""
Onboarding serializers — request/response schemas for DRF views.
"""
from rest_framework import serializers
from django.utils import timezone
from .models import OnboardingTemplate, OnboardingInstance, OnboardingUpload


# ── Template Serializers ──────────────────────────────────────────────

class OnboardingTemplateSerializer(serializers.ModelSerializer):
    """Full template representation for CRUD."""

    class Meta:
        model = OnboardingTemplate
        fields = [
            "id", "creator", "title", "blocks",
            "created_at", "updated_at",
        ]
        read_only_fields = ["id", "creator", "created_at", "updated_at"]


class OnboardingTemplateListSerializer(serializers.ModelSerializer):
    """Lightweight list representation (no blocks payload)."""
    instance_count = serializers.SerializerMethodField()

    class Meta:
        model = OnboardingTemplate
        fields = ["id", "title", "instance_count", "created_at", "updated_at"]

    def get_instance_count(self, obj):
        return obj.instances.count()


# ── Instance Serializers ──────────────────────────────────────────────

class OnboardingInstanceSerializer(serializers.ModelSerializer):
    """Full instance representation for creator dashboard."""
    template_title = serializers.CharField(source="template.title", read_only=True)
    client_name = serializers.CharField(source="client.full_name", read_only=True, default=None)
    client_email = serializers.CharField(source="client.email", read_only=True, default=None)
    url = serializers.SerializerMethodField()
    is_expired = serializers.BooleanField(read_only=True)

    class Meta:
        model = OnboardingInstance
        fields = [
            "id", "template", "template_title", "slug", "url",
            "client", "client_name", "client_email",
            "project", "status", "is_expired",
            "expires_at", "completed_at", "responses",
            "created_at",
        ]
        read_only_fields = [
            "id", "slug", "client", "client_name", "client_email",
            "status", "completed_at", "responses", "created_at",
        ]

    def get_url(self, obj):
        """Build the public onboarding URL using the frontend origin."""
        from django.conf import settings
        frontend_url = (getattr(settings, "FRONTEND_URL", None) or "http://localhost:8080").rstrip("/")
        return f"{frontend_url}/onboard/{obj.slug}"


class OnboardingInstanceCreateSerializer(serializers.Serializer):
    """Input schema for creating a new onboarding link."""
    template_id = serializers.UUIDField()
    expires_at = serializers.DateTimeField(required=False, allow_null=True)

    def validate_template_id(self, value):
        user = self.context["request"].user
        try:
            template = OnboardingTemplate.objects.get(id=value, creator=user)
        except OnboardingTemplate.DoesNotExist:
            raise serializers.ValidationError("Template not found or not owned by you.")
        return value


# ── Client-facing Serializers ──────────────────────────────────────────

class OnboardingPublicSerializer(serializers.Serializer):
    """Public view of an onboarding form (no sensitive data)."""
    slug = serializers.CharField()
    title = serializers.CharField()
    blocks = serializers.JSONField()
    creator_name = serializers.CharField()
    creator_company = serializers.CharField(required=False, allow_null=True)
    is_expired = serializers.BooleanField()
    status = serializers.CharField()


class ClientSubmissionSerializer(serializers.ModelSerializer):
    """Client-facing view of their own completed onboarding submissions."""
    form_title = serializers.CharField(source="template.title", read_only=True)
    creator_name = serializers.SerializerMethodField()
    creator_company = serializers.SerializerMethodField()
    submitted_at = serializers.SerializerMethodField()
    blocks = serializers.JSONField(source="template.blocks", read_only=True)

    class Meta:
        model = OnboardingInstance
        fields = ["id", "form_title", "creator_name", "creator_company", "submitted_at", "blocks", "responses"]

    def get_creator_name(self, obj):
        if obj.template and obj.template.creator:
            return obj.template.creator.full_name or obj.template.creator.email
        return None

    def get_creator_company(self, obj):
        if obj.template and obj.template.creator:
            try:
                return obj.template.creator.creatorprofile.company_name or None
            except Exception:
                return None
        return None

    def get_submitted_at(self, obj):
        dt = obj.completed_at or obj.created_at
        return dt.isoformat() if dt else None


class CreatorClientSubmissionSerializer(serializers.ModelSerializer):
    """Creator-facing view of a single client's completed onboarding submission."""
    form_title = serializers.CharField(source="template.title", read_only=True)
    client_name = serializers.CharField(source="client.full_name", read_only=True, default=None)
    client_email = serializers.CharField(source="client.email", read_only=True, default=None)
    submitted_at = serializers.SerializerMethodField()
    blocks = serializers.JSONField(source="template.blocks", read_only=True)

    class Meta:
        model = OnboardingInstance
        fields = [
            "id", "form_title", "client_name", "client_email",
            "submitted_at", "blocks", "responses",
        ]

    def get_submitted_at(self, obj):
        dt = obj.completed_at or obj.created_at
        return dt.isoformat() if dt else None


class OnboardingUploadSerializer(serializers.ModelSerializer):
    """Represents a client-uploaded onboarding file — exposes its stored URL."""
    url = serializers.SerializerMethodField()
    name = serializers.CharField(source="original_name", read_only=True)

    class Meta:
        model = OnboardingUpload
        fields = ["id", "url", "name", "block_index", "uploaded_at"]

    def get_url(self, obj):
        if not obj.file:
            return None
        url = obj.file.url
        request = self.context.get("request")
        if request is not None and url and url.startswith("/"):
            return request.build_absolute_uri(url)
        return url


class ClientSignupSerializer(serializers.Serializer):
    """Input schema for client signup + form submission via onboarding link."""
    full_name = serializers.CharField(max_length=255)
    email = serializers.EmailField()
    password = serializers.CharField(min_length=8, write_only=True)
    responses = serializers.JSONField(help_text="Array of {block_index, value} response objects")

    def validate_email(self, value):
        from account.models import User
        if User.objects.filter(email=value).exists():
            raise serializers.ValidationError("An account with this email already exists.")
        return value
