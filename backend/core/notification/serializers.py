from rest_framework import serializers
from .models import HireRequest, Notification, InviteToken
from .services import create_notification
from django.utils import timezone
from django.conf import settings
from account.models import User


class HireRequestCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = HireRequest
        fields = ["talent", "message"]

    def validate(self, attrs):
        request = self.context["request"]
        if request.user.role != "creator":
            raise serializers.ValidationError("Only creators can send hire requests.")
        if attrs["talent"].role != "talent":
            raise serializers.ValidationError("You can only hire talents.")
        return attrs

    def create(self, validated_data):
        creator = self.context["request"].user
        hire_request = HireRequest.objects.create(
            creator=creator,
            **validated_data
        )

        # Notify talent
        create_notification(
            user=hire_request.talent,
            title="New Hire Request",
            message=f"{creator.full_name} wants to hire you.",
            notification_type="hire",
            hire_request=hire_request,
        )

        return hire_request


class HireRequestSerializer(serializers.ModelSerializer):
    class Meta:
        model = HireRequest
        fields = "__all__" 


class HireRequestRespondSerializer(serializers.ModelSerializer):
    class Meta:
        model = HireRequest
        fields = ["status"]

    def validate_status(self, value):
        if value not in ["accepted", "rejected"]:
            raise serializers.ValidationError("Invalid status")
        return value

    def update(self, instance, validated_data):
        instance.status = validated_data["status"]
        instance.responded_at = timezone.now()
        instance.save()

        # Notify creator
        create_notification(
            user=instance.creator,
            title="Hire Request Update",
            message=f"{instance.talent.full_name} {instance.status} your hire request.",
            notification_type="hire",
            hire_request=instance,
        )

        return instance

class NotificationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Notification
        fields = "__all__"


class TeamMemberSerializer(serializers.ModelSerializer):
    """Serializer for displaying hired team members"""
    # id = HireRequest ID (for removal operations)
    # user_id = Talent's user ID (for starting conversations)
    user_id = serializers.CharField(source='talent.id', read_only=True)
    name = serializers.CharField(source='talent.full_name', read_only=True)
    email = serializers.EmailField(source='talent.email', read_only=True)
    role = serializers.SerializerMethodField()
    avatar = serializers.SerializerMethodField()
    skills = serializers.SerializerMethodField()

    class Meta:
        model = HireRequest
        fields = ['id', 'user_id', 'name', 'email', 'role', 'avatar', 'skills', 'created_at']

    def get_role(self, obj):
        """Get the talent's professional title"""
        try:
            return obj.talent.talentprofile.professional_title
        except AttributeError:
            return "Talent"

    def get_avatar(self, obj):
        """Get talent avatar URL"""
        try:
            if obj.talent.talentprofile.avatar:
                request = self.context.get('request')
                if request:
                    return request.build_absolute_uri(obj.talent.talentprofile.avatar.url)
            return None
        except AttributeError:
            return None

    def get_skills(self, obj):
        """Get talent skills"""
        try:
            return obj.talent.talentprofile.skills
        except AttributeError:
            return []


class InviteTokenCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating invite tokens"""
    invite_url = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = InviteToken
        fields = ['token', 'invited_email', 'expires_at', 'created_at', 'invite_url']
        read_only_fields = ['token', 'expires_at', 'created_at', 'invite_url']

    def validate(self, attrs):
        request = self.context.get('request')
        if request and request.user.role != 'creator':
            raise serializers.ValidationError("Only creators can generate invite links.")
        return attrs

    def create(self, validated_data):
        creator = self.context['request'].user
        invite = InviteToken.objects.create(
            creator=creator,
            **validated_data
        )
        return invite

    def get_invite_url(self, obj):
        """Generate the full invite URL"""
        # Use FRONTEND_URL from settings, fallback to localhost:8080 for local dev
        frontend_url = settings.FRONTEND_URL or 'http://localhost:8080'
        frontend_url = frontend_url.rstrip('/')
        return f"{frontend_url}/signup/talent?invite={obj.token}"


class InviteTokenValidateSerializer(serializers.ModelSerializer):
    """Serializer for validating invite tokens"""
    creator_name = serializers.CharField(source='creator.full_name', read_only=True)
    creator_company = serializers.SerializerMethodField()
    is_valid = serializers.SerializerMethodField()

    class Meta:
        model = InviteToken
        fields = ['token', 'creator_name', 'creator_company', 'is_valid', 'is_used', 'expires_at']

    def get_creator_company(self, obj):
        """Get creator's company name"""
        try:
            return obj.creator.creatorprofile.company_name
        except AttributeError:
            return None

    def get_is_valid(self, obj):
        """Check if invite is valid"""
        return obj.is_valid()