from rest_framework import permissions


class HasAgentAccess(permissions.BasePermission):
    """Agent is for verified creators. This is the single seam the paywall extends later.

    Verification is also enforced in VerifiedJWTAuthentication; it is repeated here so the
    permission is correct on its own."""

    def has_permission(self, request, view):
        from account.otp import is_email_verified

        user = request.user
        return bool(
            user
            and user.is_authenticated
            and user.role == "creator"
            and is_email_verified(user)
        )
