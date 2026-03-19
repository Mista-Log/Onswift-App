"""Portal URL configuration."""
from django.urls import path
from .views import (
    PortalProjectListView,
    PortalProjectDetailView,
    PortalMessageListView,
    PortalMessageCreateView,
    PortalMessageMarkReadView,
    PortalUnreadCountView,
)

urlpatterns = [
    # Client project endpoints
    path("projects/", PortalProjectListView.as_view(), name="portal-project-list"),
    path("projects/<uuid:project_id>/", PortalProjectDetailView.as_view(), name="portal-project-detail"),

    # Portal messaging
    path("projects/<uuid:project_id>/messages/", PortalMessageListView.as_view(), name="portal-messages"),
    path("projects/<uuid:project_id>/messages/send/", PortalMessageCreateView.as_view(), name="portal-message-send"),
    path("projects/<uuid:project_id>/messages/read/", PortalMessageMarkReadView.as_view(), name="portal-messages-read"),
    path("projects/<uuid:project_id>/messages/unread/", PortalUnreadCountView.as_view(), name="portal-messages-unread"),
]
