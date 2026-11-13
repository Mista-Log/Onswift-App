import hashlib

from rest_framework.throttling import SimpleRateThrottle


class LoginEmailThrottle(SimpleRateThrottle):
    """Limits login attempts per target email, so a botnet rotating IPs can't
    hammer one account. Scope rate lives in REST_FRAMEWORK in settings.py."""

    scope = "login_email"

    def get_cache_key(self, request, view):
        email = str(request.data.get("email", "")).strip().lower()
        if not email:
            return None
        ident = hashlib.sha256(email.encode()).hexdigest()
        return self.cache_format % {"scope": self.scope, "ident": ident}
