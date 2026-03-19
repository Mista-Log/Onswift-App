"""Portal tests — Client scope enforcement on portal API routes."""
from django.test import TestCase, RequestFactory
from rest_framework.test import APIClient
from account.models import User
from project.models import Project
from onboarding.models import OnboardingTemplate, OnboardingInstance
from portal.permissions import IsClientRole, IsProjectClient


class ClientScopeEnforcementTest(TestCase):
    """
    Test that portal endpoints enforce strict client scoping.
    No CLIENT session must ever be able to retrieve data belonging
    to another client or see any creator-internal data.
    """

    def setUp(self):
        self.api = APIClient()

        # Create users
        self.creator = User.objects.create_user(
            email="creator@test.com",
            full_name="Creator",
            password="testpass123",
            role="creator",
        )
        self.client_a = User.objects.create_user(
            email="client_a@test.com",
            full_name="Client A",
            password="testpass123",
            role="client",
        )
        self.client_b = User.objects.create_user(
            email="client_b@test.com",
            full_name="Client B",
            password="testpass123",
            role="client",
        )
        self.talent = User.objects.create_user(
            email="talent@test.com",
            full_name="Talent",
            password="testpass123",
            role="talent",
        )

        # Create projects
        self.project_a = Project.objects.create(
            creator=self.creator,
            name="Project A",
        )
        self.project_b = Project.objects.create(
            creator=self.creator,
            name="Project B",
        )

        # Create onboarding links
        template = OnboardingTemplate.objects.create(
            creator=self.creator,
            title="Test",
            blocks=[],
        )
        OnboardingInstance.objects.create(
            template=template,
            client=self.client_a,
            project=self.project_a,
            status="COMPLETED",
        )
        OnboardingInstance.objects.create(
            template=template,
            client=self.client_b,
            project=self.project_b,
            status="COMPLETED",
        )

    def test_creator_cannot_access_portal(self):
        """Creator role users are blocked from portal endpoints."""
        self.api.force_authenticate(self.creator)
        response = self.api.get("/api/v5/projects/")
        self.assertEqual(response.status_code, 403)

    def test_talent_cannot_access_portal(self):
        """Talent role users are blocked from portal endpoints."""
        self.api.force_authenticate(self.talent)
        response = self.api.get("/api/v5/projects/")
        self.assertEqual(response.status_code, 403)

    def test_client_sees_own_projects_only(self):
        """Client A should only see Project A, not Project B."""
        self.api.force_authenticate(self.client_a)
        response = self.api.get("/api/v5/projects/")
        self.assertEqual(response.status_code, 200)

        project_ids = [p["id"] for p in response.data["projects"]]
        self.assertIn(str(self.project_a.id), project_ids)
        self.assertNotIn(str(self.project_b.id), project_ids)

    def test_client_cannot_access_other_client_project(self):
        """Client A must be blocked from accessing Project B."""
        self.api.force_authenticate(self.client_a)
        response = self.api.get(f"/api/v5/projects/{self.project_b.id}/")
        self.assertEqual(response.status_code, 403)

    def test_unauthenticated_blocked(self):
        """Unauthenticated requests are blocked."""
        response = self.api.get("/api/v5/projects/")
        self.assertEqual(response.status_code, 401)
