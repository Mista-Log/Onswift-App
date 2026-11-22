"""Encrypts admins' SMTP passwords at rest. Key: CAMPAIGN_CREDS_KEY (a Fernet key)."""
import os

from cryptography.fernet import Fernet, InvalidToken
from django.core.exceptions import ImproperlyConfigured


def _fernet():
    key = os.environ.get("CAMPAIGN_CREDS_KEY", "").strip()
    if not key:
        raise ImproperlyConfigured("CAMPAIGN_CREDS_KEY is not set on the server.")
    return Fernet(key.encode())


def encrypt(plaintext):
    return _fernet().encrypt(plaintext.encode()).decode()


def decrypt(token):
    try:
        return _fernet().decrypt(token.encode()).decode()
    except InvalidToken as e:
        raise ImproperlyConfigured("The saved SMTP password can't be decrypted. Re-enter it.") from e
