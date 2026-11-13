from rest_framework.exceptions import PermissionDenied
from rest_framework_simplejwt.authentication import JWTAuthentication

# URL names (see account/urls.py) an unverified user must still reach in order
# to become verified, read their own state, or abandon the account.
UNVERIFIED_ALLOWED_URL_NAMES = {
    "user-detail",
    "verify-otp",
    "resend-otp",
    "delete-account",
}


class EmailNotVerified(PermissionDenied):
    default_code = "email_not_verified"


class VerifiedJWTAuthentication(JWTAuthentication):
    """JWT auth that refuses unverified accounts everywhere except the
    verification endpoints. Enforcing it here (rather than via a default
    permission class) covers every view, including those that declare their
    own permission_classes."""

    def authenticate(self, request):
        result = super().authenticate(request)
        if result is None:
            return None

        from .otp import is_email_verified

        user, _token = result
        if not is_email_verified(user):
            match = getattr(request, "resolver_match", None)
            if getattr(match, "url_name", None) not in UNVERIFIED_ALLOWED_URL_NAMES:
                raise EmailNotVerified(
                    detail={
                        "detail": "Verify your email to continue.",
                        "code": "email_not_verified",
                    }
                )
        return result
