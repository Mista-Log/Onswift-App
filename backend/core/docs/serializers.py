from rest_framework import serializers
from django.contrib.auth import get_user_model
from .models import Doc, DocAccess

User = get_user_model()


class DocListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for sidebar tree — no content field."""
    children_count = serializers.SerializerMethodField()

    class Meta:
        model = Doc
        fields = ["id", "title", "icon", "parent", "project", "order", "children_count", "updated_at"]

    def get_children_count(self, obj):
        return obj.children.count()


class DocDetailSerializer(serializers.ModelSerializer):
    """Full serializer including BlockNote content."""
    user_role = serializers.SerializerMethodField()

    class Meta:
        model = Doc
        fields = ["id", "title", "icon", "content", "parent", "project", "order", "created_at", "updated_at", "user_role"]
        read_only_fields = ["id", "created_at", "updated_at", "user_role"]

    def get_user_role(self, obj):
        request = self.context.get("request")
        if not request or not request.user.is_authenticated:
            return "viewer"
        user = request.user
        if obj.owner_id == user.pk:
            return "owner"
        try:
            access = DocAccess.objects.get(doc=obj, user=user)
            return access.role
        except DocAccess.DoesNotExist:
            return "viewer"


class DocCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Doc
        fields = ["title", "icon", "parent", "project"]

    def validate_parent(self, value):
        if value and value.owner != self.context["request"].user:
            raise serializers.ValidationError("Parent doc not found.")
        return value


class DocAccessUserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ["id", "email", "full_name"]


class DocAccessSerializer(serializers.ModelSerializer):
    user = DocAccessUserSerializer(read_only=True)

    class Meta:
        model = DocAccess
        fields = ["id", "user", "role", "created_at"]
