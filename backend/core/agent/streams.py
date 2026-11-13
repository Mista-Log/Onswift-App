"""Streaming limits and the SSE body for the Agent endpoint.

Why the database and not the cache: the cache is per-process, so with several gunicorn workers it
can't enforce "one active stream per user". AgentStreamSlot is one-to-one with the user, so the
database itself refuses a second row.
"""
import json
import logging
import threading
import time
from datetime import timedelta

from django.conf import settings
from django.db import IntegrityError, transaction
from django.utils import timezone

from .models import AgentStreamSlot
from .runner import run_turn

logger = logging.getLogger(__name__)

HEARTBEAT_EVERY = 10  # seconds between slot heartbeats while streaming
STALE_GRACE_S = 30  # a slot older than timeout + grace belongs to a crashed stream

_lock = threading.Lock()
_active = 0  # streams running in this process; capped so agent traffic can't starve other requests


def acquire(user):
    """Take the user's stream slot. Returns None on success, else why not:
    'server_busy' (this process is at its cap) or 'in_progress' (the user already has a stream)."""
    global _active
    with _lock:
        if _active >= settings.AGENT_MAX_CONCURRENT_STREAMS:
            return "server_busy"
        _active += 1
    try:
        stale = timezone.now() - timedelta(seconds=settings.AGENT_STREAM_TIMEOUT_S + STALE_GRACE_S)
        AgentStreamSlot.objects.filter(user=user, heartbeat_at__lt=stale).delete()
        try:
            with transaction.atomic():
                AgentStreamSlot.objects.create(user=user)
        except IntegrityError:
            _decrement()
            return "in_progress"
    except Exception:
        _decrement()
        raise
    return None


def release(user):
    AgentStreamSlot.objects.filter(user=user).delete()
    _decrement()


def _decrement():
    global _active
    with _lock:
        _active = max(0, _active - 1)


def frame(event):
    return f"event: {event['type']}\ndata: {json.dumps(event)}\n\n"


class AgentStream:
    """The streaming response body. Holds the user's slot until closed.

    It is a class, not a bare generator, because Django calls close() on it when the client goes
    away, and closing a generator that never started does not run its `finally`. close() here is
    idempotent and always frees the slot."""

    def __init__(self, user, conversation, content, provider, page_note=None):
        self.user = user
        self.conversation = conversation
        self.content = content
        self.provider = provider
        self.page_note = page_note
        self._released = False

    def __iter__(self):
        started = beat = time.monotonic()
        try:
            for event in run_turn(self.conversation, self.content, self.provider, page_note=self.page_note):
                yield frame(event)
                if event["type"] in ("done", "error"):
                    continue
                now = time.monotonic()
                # Checked between events: a model call stuck mid-read is bounded by the provider's
                # read timeout instead, so the true worst case is timeout + read timeout.
                if now - started > settings.AGENT_STREAM_TIMEOUT_S:
                    yield frame({"type": "error", "code": "timeout", "message": "That took too long. Please try again."})
                    return
                if now - beat > HEARTBEAT_EVERY:
                    AgentStreamSlot.objects.filter(user=self.user).update(heartbeat_at=timezone.now())
                    beat = now
        except Exception:
            logger.exception("Agent stream crashed")
            yield frame({"type": "error", "code": "unavailable", "message": "The Agent is unavailable right now. Please try again later."})
        finally:
            self.close()

    def close(self):
        if not self._released:
            self._released = True
            release(self.user)
