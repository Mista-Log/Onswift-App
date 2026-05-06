"""Portal URL configuration."""
from django.urls import path
from .views import (
    PortalProjectListView,
    PortalProjectDetailView,
    PortalMessageListView,
    PortalMessageCreateView,
    PortalMessageMarkReadView,
    PortalUnreadCountView,
    ClientInviteCreateView,
    ClientInviteDetailView,
    ClientInviteAcceptView,
    ClientInviteDeleteView,
    ClientDirectAddView,
    ClientHistoryView,
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

    # Invite endpoints
    path("projects/<uuid:project_id>/invites/", ClientInviteCreateView.as_view(), name="portal-invite-create"),
    path("projects/<uuid:project_id>/invites/<uuid:invite_id>/", ClientInviteDeleteView.as_view(), name="portal-invite-delete"),
    path("projects/<uuid:project_id>/add-client/", ClientDirectAddView.as_view(), name="portal-add-client"),
    path("invites/<str:token>/", ClientInviteDetailView.as_view(), name="portal-invite-detail"),
    path("invites/<str:token>/accept/", ClientInviteAcceptView.as_view(), name="portal-invite-accept"),

    # Creator endpoints
    path("clients/history/", ClientHistoryView.as_view(), name="client-history"),
]
