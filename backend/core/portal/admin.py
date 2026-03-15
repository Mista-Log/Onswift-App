from django.contrib import admin
from .models import PortalMessage


@admin.register(PortalMessage)
class PortalMessageAdmin(admin.ModelAdmin):
    list_display = ["project", "sender", "content_preview", "is_read", "created_at"]
    list_filter = ["is_read", "created_at"]
    search_fields = ["content", "sender__email"]

    def content_preview(self, obj):
        return obj.content[:80]
    content_preview.short_description = "Content"
