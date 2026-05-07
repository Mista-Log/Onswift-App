from django.contrib import admin
from .models import Folder, Document, DocumentVersion, DocumentActivity, DocumentShareLink


@admin.register(Folder)
class FolderAdmin(admin.ModelAdmin):
    list_display = ["name", "folder_type", "creator", "parent_folder", "created_at"]
    list_filter = ["folder_type", "created_at"]
    search_fields = ["name", "creator__email"]


@admin.register(Document)
class DocumentAdmin(admin.ModelAdmin):
    list_display = ["name", "file_type", "version", "creator", "folder", "is_locked", "is_deleted", "updated_at"]
    list_filter = ["file_type", "is_locked", "is_deleted", "created_at"]
    search_fields = ["name", "creator__email"]


@admin.register(DocumentVersion)
class DocumentVersionAdmin(admin.ModelAdmin):
    list_display = ["document", "version_number", "uploaded_by", "created_at"]
    list_filter = ["created_at"]


@admin.register(DocumentActivity)
class DocumentActivityAdmin(admin.ModelAdmin):
    list_display = ["document", "actor", "action", "timestamp"]
    list_filter = ["action", "timestamp"]
    search_fields = ["document__name", "actor__email"]


@admin.register(DocumentShareLink)
class DocumentShareLinkAdmin(admin.ModelAdmin):
    list_display = ["document", "slug", "permission", "expires_at", "created_at"]
    list_filter = ["permission", "created_at"]
    search_fields = ["slug", "document__name"]
    readonly_fields = ["slug"]
