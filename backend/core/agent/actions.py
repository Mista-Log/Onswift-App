"""Proposed writes: propose, confirm, reject.

The model can only create a PENDING AgentAction. Executing happens in confirm(), which:
  - finds the action by (user, id), so another user's id is indistinguishable from a missing one,
  - locks the row, so a double click cannot execute twice,
  - refuses anything that is not pending (and answers a repeat confirm with the stored result),
  - refuses expired actions,
  - re-validates the stored arguments against the user's CURRENT data before running.
"""
import logging
from dataclasses import dataclass
from datetime import timedelta

from django.db import transaction
from django.utils import timezone

from .models import AgentAction
from .tools.base import ToolError, execute_write, get_tool, preview_tool, propose_tool

logger = logging.getLogger(__name__)

ACTION_TTL = timedelta(minutes=15)
PENDING_LIMIT = 10  # unconfirmed proposals per user, so a looping model can't pile up cards


class ActionNotFound(Exception):
    """No such action for this user. Raised for another user's id too, on purpose."""


@dataclass
class Outcome:
    http_status: int
    payload: dict


def describe(action):
    return {
        "id": str(action.id),
        "tool": action.tool,
        "summary": action.summary,
        "arguments": action.arguments,
        "preview": action.preview,
        "status": action.status,
        "result": action.result,
        "error": action.error,
        "expires_at": action.expires_at.isoformat() if action.expires_at else None,
    }


def _name_of(arguments):
    """What a create_* proposal is called, normalised, so a re-proposal of the same thing can be spotted."""
    value = arguments.get("title") or arguments.get("name") or ""
    return value.strip().lower() if isinstance(value, str) else ""


def _replaced_by(user, conversation, name, args):
    """Older pending create_* proposals in this chat for the same thing (same tool, same name). The model
    often proposes again after a tweak; the older card is then stale and must not be confirmable.
    Edits (update_*) are never replaced: two edits to one form are independent."""
    if not name.startswith("create_") or not _name_of(args):
        return []
    older = AgentAction.objects.filter(user=user, conversation=conversation, tool=name, status="pending")
    return [a for a in older if _name_of(a.arguments) == _name_of(args)]


def propose(conversation, name, args):
    """Validate a write against the user's current data and record it as pending. Changes nothing else
    except marking an older pending proposal for the same thing as superseded."""
    user = conversation.user
    args, summary = propose_tool(user, name, args)
    preview = preview_tool(user, name, args)
    replaced = _replaced_by(user, conversation, name, args)
    waiting = AgentAction.objects.filter(user=user, status="pending", expires_at__gt=timezone.now()).count()
    if waiting - len(replaced) >= PENDING_LIMIT:
        raise ToolError(
            "There are already too many changes waiting for the user to confirm. "
            "Ask them to confirm or reject those first."
        )
    action = AgentAction.objects.create(
        user=user,
        conversation=conversation,
        tool=name,
        arguments=args,
        summary=summary[:300],
        preview=preview,
        expires_at=timezone.now() + ACTION_TTL,
    )
    for old in replaced:
        _finish(old, "superseded")
    action.superseded = replaced  # for the stream, which tells the browser to update those cards
    return action


def _lock(user, action_id):
    return AgentAction.objects.select_for_update().filter(user=user, id=action_id).first()


def _finish(action, status, *, result=None, error=""):
    action.status = status
    action.result = result
    action.error = error
    action.resolved_at = timezone.now()
    action.save(update_fields=["status", "result", "error", "resolved_at"])


def confirm(user, action_id):
    with transaction.atomic():
        action = _lock(user, action_id)
        if action is None:
            raise ActionNotFound
        if action.status == "executed":  # a repeat click: report the result, do not run it again
            return Outcome(200, describe(action))
        if action.status != "pending":
            return Outcome(409, describe(action))
        if action.expires_at and action.expires_at <= timezone.now():
            _finish(action, "expired")
            return Outcome(410, describe(action))

        tool = get_tool(action.tool)
        if tool is None or not tool.writes:  # a tampered row must not name a read tool or an unknown one
            _finish(action, "failed", error="That change is no longer available.")
            return Outcome(422, describe(action))
        try:
            # Re-validation happens inside execute_write; the savepoint below keeps a failed write
            # from leaving a half-made change behind while still letting us record the failure.
            with transaction.atomic():
                result = execute_write(user, action.tool, action.arguments)
        except ToolError as error:
            _finish(action, "failed", error=str(error))
            return Outcome(422, describe(action))
        except Exception:
            logger.exception("Agent action %s crashed", action.id)
            _finish(action, "failed", error="That change could not be made.")
            return Outcome(500, describe(action))

        _finish(action, "executed", result=result)
        return Outcome(200, describe(action))


def reject(user, action_id):
    with transaction.atomic():
        action = _lock(user, action_id)
        if action is None:
            raise ActionNotFound
        if action.status == "rejected":
            return Outcome(200, describe(action))
        if action.status != "pending":
            return Outcome(409, describe(action))
        _finish(action, "rejected")
        return Outcome(200, describe(action))
