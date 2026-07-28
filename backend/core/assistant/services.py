"""
assistant.services, the scripted "OnSwift Assistant" facade.

The assistant is a service-account User (inactive, unusable password — it can
never log in) that sends direct messages through the existing Message /
Conversation models. Hook sites wrap these calls in try/except so an assistant
failure can never break signup, notifications, or messaging.
"""
import logging
from datetime import datetime, time, timedelta

from django.conf import settings
from django.core.cache import cache
from django.utils import timezone

logger = logging.getLogger(__name__)

ASSISTANT_FULL_NAME = "OnSwift AI"

SWEEP_CACHE_KEY = "assistant:deadline_sweep"
SWEEP_INTERVAL_SECONDS = 300
NUDGE_WINDOW = timedelta(hours=2)
REPLY_RELAY_WINDOW = timedelta(hours=24)


def get_assistant_user():
    from account.models import User

    email = getattr(settings, "ASSISTANT_EMAIL", "assistant@onswift.org")
    user, created = User.objects.get_or_create(
        email=email,
        defaults={
            "full_name": ASSISTANT_FULL_NAME,
            # Internal identifier — NOT the display name (that's full_name).
            # Must stay exactly "assistant": the column is max_length=10, and
            # Messages.tsx + MessageCreateView branch on this exact string.
            "role": "assistant",
            "is_active": False,
        },
    )
    if created:
        user.set_unusable_password()
        user.save(update_fields=["password"])
    elif user.full_name != ASSISTANT_FULL_NAME:
        # get_or_create only applies defaults on creation — keep an existing
        # row's display name in sync when ASSISTANT_FULL_NAME is renamed.
        user.full_name = ASSISTANT_FULL_NAME
        user.save(update_fields=["full_name"])
    return user


def send_assistant_message(recipient, content, *, link=None, notify=False):
    """Create a direct Message from the assistant and keep the Conversation fresh."""
    from project.models import Conversation, Message

    assistant = get_assistant_user()
    message = Message.objects.create(sender=assistant, recipient=recipient, content=content)

    conversation = (
        Conversation.objects.filter(participants=assistant)
        .filter(participants=recipient)
        .first()
    )
    if conversation is None:
        conversation = Conversation.objects.create()
        conversation.participants.add(assistant, recipient)
    conversation.last_message = message
    conversation.save()

    if notify:
        from notification.services import create_notification

        create_notification(
            user=recipient,
            title=ASSISTANT_FULL_NAME,
            message=content,
            link=link or "/messages",
        )
    return message


# ── Welcome messages ─────────────────────────────────────────────────────────

def _first_name(user):
    return (user.full_name or "").strip().split(" ")[0] or "there"


def send_signup_welcome(user):
    """Welcome a newly signed-up creator or talent. Never raises."""
    try:
        if user.role == "creator":
            content = (
                f"Welcome to OnSwift, {_first_name(user)}! Congratulations on setting up "
                "your creator workspace. From here you can create projects, invite talent "
                "to your team, and onboard clients. I'll keep you posted right here "
                "whenever something needs your attention."
            )
        else:
            content = (
                f"Welcome to OnSwift, {_first_name(user)}! Congratulations on joining as "
                "talent. Once you're on a creator's team, your assigned tasks, deadlines "
                "and updates will show up here. I'll nudge you when something needs doing."
            )
        send_assistant_message(user, content)
    except Exception:
        logger.exception("Assistant signup welcome failed for %s", user.pk)


def send_team_join_congrats(user, creator):
    """Congratulate a talent who just joined a creator's team. Never raises."""
    try:
        send_assistant_message(
            user,
            f"Congratulations {_first_name(user)}, you've joined "
            f"{creator.full_name}'s team on OnSwift! You'll see your assigned tasks on "
            "your dashboard, and I'll message you here about deadlines and updates.",
        )
    except Exception:
        logger.exception("Assistant team-join congrats failed for %s", user.pk)


# ── Deadline sweep ───────────────────────────────────────────────────────────

def _effective_deadline(task):
    naive = datetime.combine(task.deadline, task.task_time or time(23, 59, 59))
    return timezone.make_aware(naive, timezone.get_current_timezone())


def maybe_sweep_deadlines():
    """Throttled entry point, piggybacked on the notification poll.

    The cache gate is per-process (locmem) — correctness against duplicate
    nudges comes from AssistantNudge's unique (task, user) constraint.
    """
    if not cache.add(SWEEP_CACHE_KEY, "1", SWEEP_INTERVAL_SECONDS):
        return
    sweep_deadlines()


def sweep_deadlines():
    from project.models import Task

    from .models import AssistantNudge

    now = timezone.now()
    window_end = now + NUDGE_WINDOW
    candidates = (
        Task.objects.exclude(status="completed")
        .filter(deadline__in={now.date(), window_end.date()})
        .select_related("project")
        .prefetch_related("assignees")
    )
    for task in candidates:
        due = _effective_deadline(task)
        if not (now <= due <= window_end):
            continue
        for user in task.assignees.all():
            _, created = AssistantNudge.objects.get_or_create(task=task, user=user)
            if created:
                send_assistant_message(
                    user,
                    f"You have '{task.name}' that hasn't been completed and it's due in "
                    "less than 2 hours. What's causing the hold up?",
                    notify=True,
                )


# ── Replies to the assistant ─────────────────────────────────────────────────

def handle_message_to_assistant(*, sender, content):
    """Relay a nudge reply to the task's creator, then acknowledge the sender."""
    from .models import AssistantNudge

    nudge = (
        AssistantNudge.objects.filter(
            user=sender, sent_at__gte=timezone.now() - REPLY_RELAY_WINDOW
        )
        .select_related("task__project__creator")
        .order_by("-sent_at")
        .first()
    )
    if nudge is not None:
        creator = nudge.task.project.creator
        send_assistant_message(
            creator,
            f"Concerning '{nudge.task.name}', {sender.full_name} said: \"{content}\"",
            notify=True,
        )
        ack = f"Thanks. I've passed your update along to {creator.full_name}."
    else:
        ack = (
            f"Thanks for your message! I'm {ASSISTANT_FULL_NAME}. I share task, deadline "
            "and team updates with you here. This chat isn't monitored by a person, so "
            "for anything else please message your team directly."
        )
    send_assistant_message(sender, ack)
