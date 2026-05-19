from django.urls import path
from .views import SignupView, LoginView, UpdateProfileView, UserDetailView
from .views import UserSettingsView, AccountStatsView, UpdateBasicProfileView, DeleteAccountView
from rest_framework_simplejwt.views import TokenRefreshView
from django.conf import settings
from django.conf.urls.static import static
from django.conf import settings
from django.conf.urls.static import static

from .views import (
    PasswordResetRequestView,
    PasswordResetConfirmView,
    TalentProfileListView,
    GoogleAuthView,
)


urlpatterns = [
    path("auth/signup/", SignupView.as_view(), name="signup"),
    path("auth/login/", LoginView.as_view(), name="login"),
    path("auth/profile/", UpdateProfileView.as_view(), name="update-profile"),
    path("auth/user/", UserDetailView.as_view(), name="user-detail"),
    path("auth/token/refresh/", TokenRefreshView.as_view()),
    path("user/talentprofile/", TalentProfileListView.as_view(), name="talent-profiles"),

    path("auth/google/", GoogleAuthView.as_view(), name="google-auth"),

    # Settings endpoints
    path("settings/", UserSettingsView.as_view(), name="user-settings"),
    path("settings/profile/", UpdateBasicProfileView.as_view(), name="update-basic-profile"),
    path("account/stats/", AccountStatsView.as_view(), name="account-stats"),
    path("account/delete/", DeleteAccountView.as_view(), name="delete-account"),

    path("password-reset/", PasswordResetRequestView.as_view()),
    path("password-reset-confirm/", PasswordResetConfirmView.as_view()),

]


