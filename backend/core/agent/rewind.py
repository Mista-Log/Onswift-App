"""Retry and edit: redo the latest turn of a conversation.

A "turn" is the newest user message and everything after it (the Agent's tool calls, its reply and
the changes it proposed). Redoing a turn removes it and runs the (same or edited) message again.

The rule that keeps this safe: a change the user already confirmed cannot be undone, so a turn that
contains one is never redone. Cards still waiting for an answer are marked superseded, the same
status used when a newer proposal replaces an older one.
"""
from django.db import transaction
from django.utils import timezone

# A change in one of these states has happened (or is happening right now).
LOCKING_STATUSES = ("confirmed", "executed")


class NothingToRedo(Exception):
    """The conversation has no user message yet."""


class TurnHasChanges(Exception):
    """The latest turn contains a change the user already confirmed."""


def latest_user_message(conversation):
    return conversation.messages.filter(role="user").order_by("-position").first()


def _turn_actions(conversation, user_message):
    return conversation.actions.filter(created_at__gte=user_message.created_at)


def check_redoable(conversation):
    """Raises NothingToRedo / TurnHasChanges, otherwise returns the message that would be replaced.
    Read-only, so it can run before anything is committed to."""
    message = latest_user_message(conversation)
    if message is None:
        raise NothingToRedo()
    if _turn_actions(conversation, message).filter(status__in=LOCKING_STATUSES).exists():
        raise TurnHasChanges()
    return message


def rewind_latest_turn(conversation):
    """Removes the latest turn. Checks again inside the transaction, because time has passed since
    check_redoable (a card could have been confirmed in between)."""
    with transaction.atomic():
        message = check_redoable(conversation)
        _turn_actions(conversation, message).filter(status="pending").update(
            status="superseded", resolved_at=timezone.now()
        )
        conversation.messages.filter(position__gte=message.position).delete()
        if not conversation.messages.filter(role="user").exists():
            # The first message is being replaced: let the new one title the conversation.
            conversation.title = ""
            conversation.save(update_fields=["title"])
