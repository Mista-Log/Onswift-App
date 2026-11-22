from django.urls import path

from . import views

urlpatterns = [
    path("me/", views.MeView.as_view()),
    path("senders/me/", views.SenderMeView.as_view()),
    path("senders/me/verify/", views.SenderVerifyView.as_view()),
    path("campaigns/", views.CampaignListView.as_view()),
    path("campaigns/send-due/", views.SendDueView.as_view()),
    path("campaigns/<int:pk>/", views.CampaignDetailView.as_view()),
    path("campaigns/<int:pk>/recipients/", views.CampaignRecipientsView.as_view()),
    path("campaigns/<int:pk>/recipients/csv/", views.CampaignCsvView.as_view()),
    path("campaigns/<int:pk>/recipients/users/", views.CampaignUsersView.as_view()),
    path("campaigns/<int:pk>/recipients/clear-pending/", views.CampaignClearPendingView.as_view()),
    path("campaigns/<int:pk>/recipients/retry-failed/", views.CampaignRetryFailedView.as_view()),
    path("campaigns/<int:pk>/recipients/<int:rid>/", views.CampaignRecipientDeleteView.as_view()),
    path("campaigns/<int:pk>/preview/", views.CampaignPreviewView.as_view()),
    path("campaigns/<int:pk>/test/", views.CampaignTestView.as_view()),
    path("campaigns/<int:pk>/start/", views.CampaignStartView.as_view()),
    path("campaigns/<int:pk>/pause/", views.CampaignPauseView.as_view()),
    path("suppressions/", views.SuppressionListView.as_view()),
    path("suppressions/<int:sid>/", views.SuppressionDeleteView.as_view()),
    path("unsubscribe/<str:token>/", views.unsubscribe_view),
]
