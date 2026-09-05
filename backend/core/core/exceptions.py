import logging
from contextlib import contextmanager

import cloudinary.exceptions
from rest_framework import status
from rest_framework.exceptions import APIException

logger = logging.getLogger(__name__)


class StorageUnavailable(APIException):
    """Raised when a file can't be persisted because the storage backend
    (Cloudinary) is unreachable or rejecting requests — bad/suspended
    credentials, billing issues, or a network failure. Maps to a 503 so the
    frontend can show a friendly fallback instead of a raw 500."""
    status_code = status.HTTP_503_SERVICE_UNAVAILABLE
    default_detail = "File storage is temporarily unavailable. Please try again shortly."
    default_code = "storage_unavailable"


@contextmanager
def storage_error_guard():
    """Wrap the single call that actually writes an uploaded file to storage.
    Translates Cloudinary/network failures into StorageUnavailable (503);
    anything else (e.g. a DRF ValidationError) passes through unchanged."""
    try:
        yield
    except StorageUnavailable:
        raise
    except (cloudinary.exceptions.Error, OSError) as exc:
        logger.exception("Upload failed — storage backend unavailable")
        raise StorageUnavailable() from exc
