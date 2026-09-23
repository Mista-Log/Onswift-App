"""
Library serializers — request/response schemas for Document Library views.
"""
from rest_framework import serializers
from django.contrib.auth import get_user_model
from .models import Folder, Document, DocumentVersion, DocumentActivity, DocumentShareLink, FolderAccess

User = get_user_model()


# ── Folder Serializers ────────────────────────────────────────────────

class FolderSerializer(serializers.ModelSerializer):
    """Full folder representation."""
    document_count = serializers.SerializerMethodField()
    subfolder_count = serializers.SerializerMethodField()
    doc_count = serializers.SerializerMethodField()
    crm_count = serializers.SerializerMethodField()

    class Meta:
        model = Folder
        fields = [
            "id", "creator", "parent_folder", "name",
            "folder_type", "client",
            "document_count", "subfolder_count", "doc_count", "crm_count",
            "created_at",
        ]
        read_only_fields = ["id", "creator", "created_at"]

    def get_document_count(self, obj):
        return obj.documents.filter(is_deleted=False).count()

    def get_subfolder_count(self, obj):
        return obj.subfolders.count()

    def get_doc_count(self, obj):
        from docs.models import Doc
        return Doc.objects.filter(folder=obj).count()

    def get_crm_count(self, obj):
        from crm.models import CRMSheet
        return CRMSheet.objects.filter(folder=obj).count()


class FolderCreateSerializer(serializers.Serializer):
    """Input schema for creating a folder."""
    name = serializers.CharField(max_length=255)
    parent_folder_id = serializers.UUIDField(required=False, allow_null=True)
    folder_type = serializers.ChoiceField(
        choices=["CLIENT", "TEMPLATE", "INTERNAL"],
        default="INTERNAL",
    )
    client_id = serializers.UUIDField(required=False, allow_null=True)


class FolderRenameSerializer(serializers.Serializer):
    """Input schema for renaming (and optionally moving) a folder."""
    name = serializers.CharField(max_length=255)
    parent_folder_id = serializers.UUIDField(required=False, allow_null=True)


# ── Folder Access (sharing) Serializers ───────────────────────────────

class FolderAccessUserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ["id", "email", "full_name"]


class FolderAccessSerializer(serializers.ModelSerializer):
    user = FolderAccessUserSerializer(read_only=True)

    class Meta:
        model = FolderAccess
        fields = ["id", "user", "role", "created_at"]


# ── Document Serializers ──────────────────────────────────────────────

class DocumentSerializer(serializers.ModelSerializer):
    """Full document representation."""
    folder_name = serializers.CharField(source="folder.name", read_only=True, default=None)

    class Meta:
        model = Document
        fields = [
            "id", "creator", "client", "folder", "folder_name",
            "name", "file", "file_type", "size_kb",
            "tags", "color_label", "is_locked", "is_favorite",
            "is_deleted", "deleted_at",
            "version", "created_at", "updated_at",
        ]
        read_only_fields = [
            "id", "creator", "file_type", "size_kb",
            "version", "created_at", "updated_at",
        ]


class DocumentUploadSerializer(serializers.Serializer):
    """Input schema for uploading a file."""
    file = serializers.FileField()
    folder_id = serializers.UUIDField(required=False, allow_null=True)
    tags = serializers.JSONField(required=False, default=list)
    color_label = serializers.CharField(max_length=50, required=False, allow_blank=True)


class DocumentUpdateSerializer(serializers.Serializer):
    """Input schema for updating document metadata."""
    name = serializers.CharField(max_length=255, required=False)
    tags = serializers.JSONField(required=False)
    color_label = serializers.CharField(max_length=50, required=False, allow_null=True, allow_blank=True)
    is_locked = serializers.BooleanField(required=False)
    is_favorite = serializers.BooleanField(required=False)
    folder_id = serializers.UUIDField(required=False, allow_null=True)
    created_at = serializers.DateTimeField(required=False, help_text="Manually overridable date")


class DocumentReuploadSerializer(serializers.Serializer):
    """Input schema for re-uploading a new version of a file."""
    file = serializers.FileField()


# ── Version Serializer ────────────────────────────────────────────────

class DocumentVersionSerializer(serializers.ModelSerializer):
    """Version history entry."""
    uploaded_by_name = serializers.CharField(source="uploaded_by.full_name", read_only=True, default=None)

    class Meta:
        model = DocumentVersion
        fields = [
            "id", "document", "version_number",
            "file", "file_type", "size_kb",
            "uploaded_by", "uploaded_by_name",
            "created_at",
        ]


# ── Activity Serializer ──────────────────────────────────────────────

class DocumentActivitySerializer(serializers.ModelSerializer):
    """Activity log entry."""
    actor_name = serializers.CharField(source="actor.full_name", read_only=True)

    class Meta:
        model = DocumentActivity
        fields = [
            "id", "document", "actor", "actor_name",
            "actor_role", "action", "timestamp",
        ]


# ── Share Link Serializers ────────────────────────────────────────────

class DocumentShareLinkSerializer(serializers.ModelSerializer):
    """Share link representation."""
    url = serializers.SerializerMethodField()
    is_expired = serializers.BooleanField(read_only=True)

    class Meta:
        model = DocumentShareLink
        fields = [
            "id", "document", "slug", "url",
            "permission", "is_expired",
            "expires_at", "created_at",
        ]
        read_only_fields = ["id", "slug", "created_at"]

    def get_url(self, obj):
        request = self.context.get("request")
        if request:
            return request.build_absolute_uri(f"/shared/{obj.slug}")
        return f"/shared/{obj.slug}"


class DocumentShareLinkCreateSerializer(serializers.Serializer):
    """Input schema for creating a share link."""
    permission = serializers.ChoiceField(choices=["VIEW", "EDIT"], default="VIEW")
    expires_at = serializers.DateTimeField()


# ── Search Serializer ─────────────────────────────────────────────────

class DocumentSearchSerializer(serializers.Serializer):
    """Search result item."""
    id = serializers.UUIDField()
    name = serializers.CharField()
    file = serializers.FileField()
    file_type = serializers.CharField()
    folder_name = serializers.CharField()
    tags = serializers.JSONField()
    color_label = serializers.CharField(allow_null=True)
    updated_at = serializers.DateTimeField()
