"""Read tool for the user's notifications.

Scoping mirrors notification.views.NotificationListView: `request.user.notifications`. The filter
comes from `user`, never from model arguments. Titles and messages can carry other people's text
(a client's message, a task name), so they are clipped like every free-text field and, like all
tool output, treated by the runner as data rather than instructions.
"""
from .base import MAX_ROWS, Tool, clip, limited, register


def list_notifications(user, args):
    notifications = user.notifications.all()  # newest first (Notification.Meta.ordering)
    if args.get("unread_only"):
        notifications = notifications.filter(is_read=False)
    unread_count = user.notifications.filter(is_read=False).count()
    rows = [
        {
            "id": str(n.id),
            "title": clip(n.title),
            "message": clip(n.message),
            "type": n.notification_type,
            "is_read": n.is_read,
            "link": n.link,
            "created_at": n.created_at.isoformat(),
        }
        for n in notifications[: MAX_ROWS + 1]
    ]
    return {**limited(rows), "unread_count": unread_count}


register(Tool(
    name="list_notifications",
    description=(
        "List the user's notifications, newest first, with the total unread count. "
        "Set unread_only=true to see only unread ones."
    ),
    parameters={
        "type": "object",
        "properties": {"unread_only": {"type": "boolean"}},
    },
    run=list_notifications,
))
