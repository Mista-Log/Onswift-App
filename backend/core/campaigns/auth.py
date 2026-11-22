"""
Lets the Supabase-authenticated /admin panel call Django.

The admin panel signs in with Supabase Auth, not Django JWT. We verify the Supabase
access token by asking Supabase who it belongs to (works for HS256 and JWKS projects
alike), then require that email to be listed in CAMPAIGN_ADMIN_EMAILS.
"""
import hashlib
import os

import requests
from django.core.cache import cache
from rest_framework import authentication, exceptions

CACHE_SECONDS = 60


class AdminPrincipal:
    is_authenticated = True
    is_anonymous = False

    def __init__(self, email):
        self.email = email
        self.pk = email

    def __str__(self):
        return self.email


def admin_allowlist():
    raw = os.environ.get("CAMPAIGN_ADMIN_EMAILS", "")
    return {e.strip().lower() for e in raw.split(",") if e.strip()}


def _supabase_email_for(token):
    base = os.environ.get("SUPABASE_URL", "").rstrip("/")
    anon = os.environ.get("SUPABASE_ANON_KEY", "")
    if not base or not anon:
        raise exceptions.AuthenticationFailed("Admin auth is not configured on the server.")
    key = "campaigns:sb:" + hashlib.sha256(token.encode()).hexdigest()
    email = cache.get(key)
    if email:
        return email
    try:
        r = requests.get(
            f"{base}/auth/v1/user",
            headers={"apikey": anon, "Authorization": f"Bearer {token}"},
            timeout=5,
        )
    except requests.RequestException:
        raise exceptions.AuthenticationFailed("Couldn't reach the auth service. Try again.")
    if r.status_code != 200:
        raise exceptions.AuthenticationFailed("Your admin session has expired. Sign in again.")
    email = (r.json().get("email") or "").strip().lower()
    if not email:
        raise exceptions.AuthenticationFailed("Invalid admin session.")
    cache.set(key, email, CACHE_SECONDS)
    return email


class SupabaseAdminAuthentication(authentication.BaseAuthentication):
    def authenticate(self, request):
        header = authentication.get_authorization_header(request).decode(errors="ignore")
        if not header.lower().startswith("bearer "):
            return None
        token = header[7:].strip()
        if not token:
            return None
        email = _supabase_email_for(token)
        if email not in admin_allowlist():
            raise exceptions.PermissionDenied("This account doesn't have access to email campaigns.")
        return AdminPrincipal(email), token

    def authenticate_header(self, request):
        return "Bearer"
