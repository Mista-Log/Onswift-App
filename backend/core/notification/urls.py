# notifications/urls.py
from django.urls import path
from .views import (
    HireRequestCreateView,
    ReceivedHireRequestListView,
    HireRequestRespondView,
    NotificationListView,
    NotificationReadView,
)

urlpatterns = [
    path("hire-requests/", HireRequestCreateView.as_view()),
    path("hire-requests/received/", ReceivedHireRequestListView.as_view()),
    path("hire-requests/<uuid:pk>/respond/", HireRequestRespondView.as_view()),

    path("notifications/", NotificationListView.as_view()),
    path('notifications/<uuid:pk>/read/', NotificationReadView.as_view()),

]
