from django.contrib import admin
from .models import OnboardingTemplate, OnboardingInstance


@admin.register(OnboardingTemplate)
class OnboardingTemplateAdmin(admin.ModelAdmin):
    list_display = ["title", "creator", "created_at"]
    list_filter = ["created_at"]
    search_fields = ["title", "creator__email"]


@admin.register(OnboardingInstance)
class OnboardingInstanceAdmin(admin.ModelAdmin):
    list_display = ["slug", "template", "status", "client", "created_at"]
    list_filter = ["status", "created_at"]
    search_fields = ["slug", "client__email"]
    readonly_fields = ["slug"]
