from django.contrib import admin
from django.utils.html import format_html
from .models import PortalMessage, ClientInvite


@admin.register(PortalMessage)
class PortalMessageAdmin(admin.ModelAdmin):
    list_display = ["project", "sender", "content_preview", "is_read", "created_at"]
    list_filter = ["is_read", "created_at"]
    search_fields = ["content", "sender__email"]

    def content_preview(self, obj):
        return obj.content[:80]
    content_preview.short_description = "Content"


@admin.register(ClientInvite)
class ClientInviteAdmin(admin.ModelAdmin):
    list_display = [
        "client_email",
        "project",
        "creator",
        "status_badge",
        "created_at",
        "expires_at",
        "accepted_at",
    ]
    list_filter = ["created_at", "expires_at", "accepted_at", "project"]
    search_fields = ["client_email", "project__name", "creator__email"]
    readonly_fields = ["token", "created_at", "id", "onboarding_form_preview", "responses_preview"]
    fieldsets = (
        ("Invite Info", {
            "fields": ("id", "token", "client_email", "project", "creator")
        }),
        ("Form", {
            "fields": ("onboarding_form_preview",),
            "classes": ("collapse",),
        }),
        ("Responses", {
            "fields": ("responses_preview",),
            "classes": ("collapse",),
        }),
        ("Timeline", {
            "fields": ("created_at", "expires_at", "accepted_at"),
        }),
    )
    
    def status_badge(self, obj):
        if obj.accepted_at:
            return format_html('<span style="color: green; font-weight: bold;">✓ Accepted</span>')
        elif obj.is_expired():
            return format_html('<span style="color: red; font-weight: bold;">✗ Expired</span>')
        else:
            return format_html('<span style="color: blue; font-weight: bold;">⧖ Pending</span>')
    status_badge.short_description = "Status"
    
    def onboarding_form_preview(self, obj):
        if not obj.onboarding_form:
            return "No form"
        import json
        return format_html("<pre>{}</pre>", json.dumps(obj.onboarding_form, indent=2))
    onboarding_form_preview.short_description = "Onboarding Form"
    
    def responses_preview(self, obj):
        if not obj.responses:
            return "No responses yet"
        import json
        return format_html("<pre>{}</pre>", json.dumps(obj.responses, indent=2))
    responses_preview.short_description = "Client Responses"
    
    actions = ["delete_selected"]
