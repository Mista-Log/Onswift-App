from django.urls import path
from .views import SignupView, LoginView
from rest_framework_simplejwt.views import TokenRefreshView

urlpatterns = [
    path("auth/signup/", SignupView.as_view(), name="signup"),
    path("auth/login/", LoginView.as_view(), name="login"),
]
