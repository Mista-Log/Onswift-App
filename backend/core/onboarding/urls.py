"""Onboarding URL configuration."""
from django.urls import path
from .views import (
    OnboardingTemplateListCreateView,
    OnboardingTemplateDetailView,
    OnboardingInstanceListView,
    OnboardingInstanceCreateView,
    OnboardingInstanceDetailView,
    OnboardingPublicView,
    ClientOnboardingSubmitView,
)

urlpatterns = [
    # Creator endpoints (authenticated, creator role)
    path("templates/", OnboardingTemplateListCreateView.as_view(), name="onboarding-template-list-create"),
    path("templates/<uuid:pk>/", OnboardingTemplateDetailView.as_view(), name="onboarding-template-detail"),
    path("instances/", OnboardingInstanceListView.as_view(), name="onboarding-instance-list"),
    path("instances/create/", OnboardingInstanceCreateView.as_view(), name="onboarding-instance-create"),
    path("instances/<uuid:pk>/", OnboardingInstanceDetailView.as_view(), name="onboarding-instance-detail"),

    # Public client-facing endpoints
    path("onboard/<str:slug>/", OnboardingPublicView.as_view(), name="onboarding-public"),
    path("onboard/<str:slug>/submit/", ClientOnboardingSubmitView.as_view(), name="onboarding-submit"),
]
