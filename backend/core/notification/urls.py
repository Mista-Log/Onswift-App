# notifications/urls.py
from django.urls import path
from .views import (
    HireRequestCreateView,
    ReceivedHireRequestListView,
    HireRequestRespondView,
    CreatorTeamListView,
    NotificationListView,
    NotificationReadView,
    InviteTokenCreateView,
    InviteTokenValidateView,
)

urlpatterns = [
    path("hire-requests/", HireRequestCreateView.as_view()),
    path("hire-requests/received/", ReceivedHireRequestListView.as_view()),
    path("hire-requests/<uuid:pk>/respond/", HireRequestRespondView.as_view()),
    path("team/", CreatorTeamListView.as_view()),  # Get creator's accepted team members

    path("notifications/", NotificationListView.as_view()),
    path('notifications/<uuid:pk>/read/', NotificationReadView.as_view()),

    # Invite system
    path("invites/generate/", InviteTokenCreateView.as_view()),  # Generate invite token
    path("invites/validate/<str:token>/", InviteTokenValidateView.as_view()),  # Validate token

]
