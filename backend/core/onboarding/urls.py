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
    ClientMySubmissionsView,
    CreatorClientSubmissionsView,
    OnboardingFileUploadView,
    StandaloneFormListCreateView,
    StandaloneFormDetailView,
    StandaloneFormPublicView,
    StandaloneFormSubmitView,
    StandaloneFormUploadView,
    StandaloneFormResponseListView,
    StandaloneFormResponseDetailView,
)

urlpatterns = [
    # Creator endpoints (authenticated, creator role)
    path("templates/", OnboardingTemplateListCreateView.as_view(), name="onboarding-template-list-create"),
    path("templates/<uuid:pk>/", OnboardingTemplateDetailView.as_view(), name="onboarding-template-detail"),
    path("instances/", OnboardingInstanceListView.as_view(), name="onboarding-instance-list"),
    path("instances/create/", OnboardingInstanceCreateView.as_view(), name="onboarding-instance-create"),
    path("instances/<uuid:pk>/", OnboardingInstanceDetailView.as_view(), name="onboarding-instance-detail"),
    path("clients/<uuid:client_id>/submissions/", CreatorClientSubmissionsView.as_view(), name="creator-client-submissions"),

    # Public client-facing endpoints
    path("onboard/<str:slug>/", OnboardingPublicView.as_view(), name="onboarding-public"),
    path("onboard/<str:slug>/submit/", ClientOnboardingSubmitView.as_view(), name="onboarding-submit"),
    path("onboard/<str:slug>/upload/", OnboardingFileUploadView.as_view(), name="onboarding-upload"),

    # Client dashboard
    path("my-submissions/", ClientMySubmissionsView.as_view(), name="my-submissions"),

    # Standalone forms — plain, project/client-independent forms (creator endpoints)
    path("forms/", StandaloneFormListCreateView.as_view(), name="standalone-form-list-create"),
    path("forms/<uuid:pk>/", StandaloneFormDetailView.as_view(), name="standalone-form-detail"),
    path("forms/<uuid:form_id>/responses/", StandaloneFormResponseListView.as_view(), name="standalone-form-response-list"),
    path("forms/<uuid:form_id>/responses/<uuid:pk>/", StandaloneFormResponseDetailView.as_view(), name="standalone-form-response-detail"),

    # Standalone forms — public endpoints
    path("f/<str:slug>/", StandaloneFormPublicView.as_view(), name="standalone-form-public"),
    path("f/<str:slug>/submit/", StandaloneFormSubmitView.as_view(), name="standalone-form-submit"),
    path("f/<str:slug>/upload/", StandaloneFormUploadView.as_view(), name="standalone-form-upload"),
]
