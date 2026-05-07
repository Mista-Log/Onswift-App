"""
Onboarding serializers — request/response schemas for DRF views.
"""
from rest_framework import serializers
from django.utils import timezone
from .models import OnboardingTemplate, OnboardingInstance


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
