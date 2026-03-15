"""
Portal permissions — Client scope enforcement.
Every /api/v5/* route must verify:
  1. Valid session token (handled by IsAuthenticated)
  2. User role == CLIENT
  3. Requested resource belongs to this client
"""
from rest_framework.permissions import BasePermission


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
    Checks onboarding instances where client_id matches the authenticated user.
    """
    message = "You do not have access to this project."

    def has_permission(self, request, view):
        if not request.user.is_authenticated or request.user.role != "client":
            return False

        project_id = view.kwargs.get("project_id")
        if not project_id:
            return True  # List endpoints handle filtering

        from onboarding.models import OnboardingInstance
        return OnboardingInstance.objects.filter(
            client=request.user,
            project_id=project_id,
            status="COMPLETED",
        ).exists() or self._check_direct_assignment(request.user, project_id)

    def _check_direct_assignment(self, user, project_id):
        """Fallback: check if client has portal messages in this project."""
        from portal.models import PortalMessage
        return PortalMessage.objects.filter(
            project_id=project_id,
            sender=user,
        ).exists()


class IsCreatorOrProjectClient(BasePermission):
    """
    Allow both Creator (project owner) and Client (onboarded to project).
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
            from onboarding.models import OnboardingInstance
            return OnboardingInstance.objects.filter(
                client=user,
                project_id=project_id,
                status="COMPLETED",
            ).exists()

        return False
