import logging

from django.core.exceptions import ImproperlyConfigured
from django.http import StreamingHttpResponse
from rest_framework import status
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from .actions import ActionNotFound, confirm, describe, reject
from .models import AgentConversation, AgentMessage
from .page_context import page_note
from .permissions import HasAgentAccess
from .providers.factory import get_llm_provider
from .rewind import NothingToRedo, TurnHasChanges, check_redoable, rewind_latest_turn
from .streams import AgentStream, acquire, release

logger = logging.getLogger(__name__)

MAX_CONTENT = 4000
LIST_LIMIT = 50


def _summary(conversation):
    return {
        "id": str(conversation.id),
        "title": conversation.title,
        "created_at": conversation.created_at.isoformat(),
        "updated_at": conversation.updated_at.isoformat(),
    }


def _own_conversation(request, pk):
    # Filtered by the caller: another user's id is indistinguishable from a missing one.
    return AgentConversation.objects.filter(user=request.user, id=pk).first()


class ConversationListCreateView(APIView):
    permission_classes = [HasAgentAccess]

    def get(self, request):
        # A conversation gets its title from its first message, so an empty title means nothing was ever
        # said (the first send failed). Those would only show up as blank rows in the history list.
        conversations = AgentConversation.objects.filter(user=request.user).exclude(title="")[:LIST_LIMIT]
        return Response([_summary(c) for c in conversations])

    def post(self, request):
        conversation = AgentConversation.objects.create(user=request.user)
        return Response(_summary(conversation), status=status.HTTP_201_CREATED)


class ConversationDetailView(APIView):
    permission_classes = [HasAgentAccess]

    def get(self, request, pk):
        conversation = _own_conversation(request, pk)
        if conversation is None:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)
        # Tool calls and tool results are plumbing; the UI only needs what was said.
        visible = conversation.messages.filter(role__in=["user", "assistant"]).exclude(content="")
        return Response({
            **_summary(conversation),
            "messages": [
                {
                    "id": str(m.id), "role": m.role, "content": m.content,
                    "rating": m.rating, "created_at": m.created_at.isoformat(),
                }
                for m in visible
            ],
            # So a reload still shows pending cards (and what happened to the finished ones).
            "actions": [describe(a) for a in conversation.actions.order_by("created_at")],
        })


class ActionResolveView(APIView):
    """Confirm or reject a proposed change. The lookup is by (request.user, id), so another user's
    action id gets the same 404 as one that doesn't exist and nothing about it is revealed."""

    permission_classes = [HasAgentAccess]
    resolve = None  # set by the subclasses

    def post(self, request, pk):
        try:
            outcome = type(self).resolve(request.user, pk)
        except ActionNotFound:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)
        return Response(outcome.payload, status=outcome.http_status)


class ActionConfirmView(ActionResolveView):
    resolve = staticmethod(confirm)


class ActionRejectView(ActionResolveView):
    resolve = staticmethod(reject)


def _cannot_redo(error):
    if isinstance(error, TurnHasChanges):
        return Response(
            {"code": "turn_has_changes", "detail": "You already confirmed a change in this reply, so it can't be redone."},
            status=status.HTTP_409_CONFLICT,
        )
    return Response({"detail": "There is nothing to redo yet."}, status=status.HTTP_400_BAD_REQUEST)


class MessageRatingView(APIView):
    """Thumbs up (1), thumbs down (-1) or clear (0) on one of the Agent's replies. Looked up by
    (request.user, id), so another user's message id is a plain 404, same as one that doesn't exist."""

    permission_classes = [HasAgentAccess]

    def post(self, request, pk):
        rating = request.data.get("rating")
        # `type(...) is int` rather than isinstance: True == 1 must not count as a thumbs up.
        if type(rating) is not int or rating not in (-1, 0, 1):
            return Response({"detail": "Rating must be 1, -1 or 0."}, status=status.HTTP_400_BAD_REQUEST)
        message = AgentMessage.objects.filter(id=pk, conversation__user=request.user, role="assistant").first()
        if message is None:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)
        message.rating = rating
        message.save(update_fields=["rating"])
        return Response({"id": str(message.id), "rating": message.rating})


class MessageCreateView(APIView):
    permission_classes = [HasAgentAccess]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "agent_message"

    def post(self, request, pk):
        conversation = _own_conversation(request, pk)
        if conversation is None:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)

        content = request.data.get("content")
        if not isinstance(content, str) or not content.strip():
            return Response({"detail": "Write a message first."}, status=status.HTTP_400_BAD_REQUEST)
        if len(content) > MAX_CONTENT:
            return Response(
                {"detail": f"Messages can be up to {MAX_CONTENT} characters."}, status=status.HTTP_400_BAD_REQUEST
            )

        try:
            provider = get_llm_provider()
        except ImproperlyConfigured:
            logger.error("Agent is not configured (AGENT_LLM_API_KEY missing)")
            return Response(
                {"code": "unavailable", "detail": "The Agent is unavailable right now."},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        note = page_note(request.user, request.data.get("context"))

        # Retry / edit: `replace_last` redoes the newest turn instead of adding a new one. Checked here
        # without changing anything, so a refusal leaves the conversation exactly as it was.
        replace_last = request.data.get("replace_last") is True
        if replace_last:
            try:
                check_redoable(conversation)
            except (NothingToRedo, TurnHasChanges) as error:
                return _cannot_redo(error)

        # Last, so nothing after it can fail and strand the slot.
        refused = acquire(request.user)
        if refused == "in_progress":
            return Response(
                {"code": "stream_in_progress", "detail": "A response is already in progress."},
                status=status.HTTP_429_TOO_MANY_REQUESTS,
            )
        if refused:
            return Response(
                {"code": "server_busy", "detail": "The Agent is busy right now. Try again in a minute."},
                status=status.HTTP_429_TOO_MANY_REQUESTS,
            )

        if replace_last:
            # Only now, with the slot held, is the old turn removed. Checks again inside: a card could
            # have been confirmed since the check above.
            try:
                rewind_latest_turn(conversation)
            except (NothingToRedo, TurnHasChanges) as error:
                release(request.user)
                return _cannot_redo(error)
            except Exception:
                release(request.user)
                raise

        response = StreamingHttpResponse(
            AgentStream(request.user, conversation, content.strip(), provider, note),
            content_type="text/event-stream",
        )
        response["Cache-Control"] = "no-cache"
        response["X-Accel-Buffering"] = "no"  # stop reverse proxies from buffering the stream
        return response
