from django.urls import path
from .views import SignupView, LoginView, UpdateProfileView
from rest_framework_simplejwt.views import TokenRefreshView
from django.conf import settings
from django.conf.urls.static import static

urlpatterns = [
    path("auth/signup/", SignupView.as_view(), name="signup"),
    path("auth/login/", LoginView.as_view(), name="login"),
    path("auth/profile/", UpdateProfileView.as_view(), name="update-profile"),
    path("auth/token/refresh/", TokenRefreshView.as_view()),
]


urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
