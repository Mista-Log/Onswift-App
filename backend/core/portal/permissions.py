"""
Portal permissions — Client scope enforcement.
Every /api/v5/* route must verify:
  1. Valid session token (handled by IsAuthenticated)
  2. User role == CLIENT
  3. Requested resource belongs to this client
"""
from rest_framework.permissions import BasePermission


def get_client_project_ids(user):
    """Return project IDs a client can access via membership or completed onboarding."""
    if not user.is_authenticated or user.role != "client":
        return set()

    from onboarding.models import OnboardingInstance
    from project.models import ProjectClientMembership

    membership_project_ids = set(
        ProjectClientMembership.objects.filter(
            client=user,
            status__in=["active", "on_hold"],
        ).values_list("project_id", flat=True)
    )

    onboarding_project_ids = set(
        OnboardingInstance.objects.filter(
            client=user,
            status="COMPLETED",
            project__isnull=False,
        ).values_list("project_id", flat=True)
    )

    return membership_project_ids | onboarding_project_ids


class IsClientRole(BasePermission):
    """
    Only allow users with role='client'.
    Applied to ALL portal endpoints — no exceptions.
    """
    message = "Access denied. Portal is only available to client accounts."

    def has_permission(self, request, view):
        return (
            request.user.is_authenticated
            and request.user.role == "client"
        )


class IsProjectClient(BasePermission):
    """
    Verify that the requested project belongs to this client.
    Checks ProjectClientMembership where client_id matches the authenticated user.
    """
    message = "You do not have access to this project."

    def has_permission(self, request, view):
        if not request.user.is_authenticated or request.user.role != "client":
            return False

        project_id = view.kwargs.get("project_id")
        if not project_id:
            return True  # List endpoints handle filtering

        return project_id in get_client_project_ids(request.user)


class IsCreatorOrProjectClient(BasePermission):
    """
    Allow both Creator (project owner) and Client (with ProjectClientMembership).
    Used for messaging endpoints where both parties need access.
    """
    message = "You do not have access to this project."

    def has_permission(self, request, view):
        if not request.user.is_authenticated:
            return False

        project_id = view.kwargs.get("project_id")
        if not project_id:
            return True

        user = request.user

        if user.role == "creator":
            from project.models import Project
            return Project.objects.filter(id=project_id, creator=user).exists()

        if user.role == "client":
            return project_id in get_client_project_ids(user)

        return False
