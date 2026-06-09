from django.contrib import admin
from .models import Doc


@admin.register(Doc)
class DocAdmin(admin.ModelAdmin):
    list_display = ["title", "owner", "parent", "project", "order", "updated_at"]
    list_filter = ["owner"]
    search_fields = ["title", "owner__email"]
    readonly_fields = ["id", "created_at", "updated_at"]
