from django.urls import path

from . import views

urlpatterns = [
    path("conversations/", views.ConversationListCreateView.as_view(), name="agent-conversations"),
    path("conversations/<uuid:pk>/", views.ConversationDetailView.as_view(), name="agent-conversation-detail"),
    path("conversations/<uuid:pk>/messages/", views.MessageCreateView.as_view(), name="agent-message-create"),
    path("messages/<uuid:pk>/rating/", views.MessageRatingView.as_view(), name="agent-message-rating"),
    path("actions/<uuid:pk>/confirm/", views.ActionConfirmView.as_view(), name="agent-action-confirm"),
    path("actions/<uuid:pk>/reject/", views.ActionRejectView.as_view(), name="agent-action-reject"),
]
