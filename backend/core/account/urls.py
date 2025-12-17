from django.urls import path
from .views import SignupView, LoginView, UpdateProfileView, UserDetailView
from rest_framework_simplejwt.views import TokenRefreshView
from django.conf import settings
from django.conf.urls.static import static
from django.conf import settings
from django.conf.urls.static import static

urlpatterns = [
    path("auth/signup/", SignupView.as_view(), name="signup"),
    path("auth/login/", LoginView.as_view(), name="login"),
    path("auth/profile/", UpdateProfileView.as_view(), name="update-profile"),
    path("auth/user/", UserDetailView.as_view(), name="user-detail"),
    path("auth/token/refresh/", TokenRefreshView.as_view()),
]




