"""Read tool: a compact workspace summary.

This does not call or copy the dashboard's analytics view (that logic lives inside a view and is
shaped for charts). It answers "how am I doing?" with a few plainly defined counts, all scoped to the
creator's own projects, so the numbers can be explained in one sentence each:

  - overdue: tasks with a deadline before today that are not completed
  - due_next_7_days: not completed, deadline from today through 7 days ahead
  - approved_in_range: deliverables approved (last updated as approved) within the range
  - awaiting_review: deliverables currently pending review
  - new_clients_in_range: clients whose first project with this creator began within the range
"""
from datetime import timedelta

from django.db.models import Count, Min
from django.utils import timezone
from project.models import Deliverable, Project, ProjectClientMembership, Task

from .base import Tool, register

RANGE_DAYS = {"7d": 7, "30d": 30, "3m": 90, "12m": 365}
DEFAULT_RANGE = "30d"


def _by_status(queryset, model):
    counts = {value: 0 for value, _label in model._meta.get_field("status").choices}
    for row in queryset.values("status").annotate(n=Count("id")):
        counts[row["status"]] = row["n"]
    return counts


def get_analytics(user, args):
    selected = args.get("range", DEFAULT_RANGE)
    start = timezone.now() - timedelta(days=RANGE_DAYS[selected])
    today = timezone.localdate()

    projects = Project.objects.filter(creator=user)
    tasks = Task.objects.filter(project__creator=user)
    open_tasks = tasks.exclude(status="completed")
    deliverables = Deliverable.objects.filter(task__project__creator=user)

    first_joins = (
        ProjectClientMembership.objects.filter(project__creator=user)
        .values("client")
        .annotate(first=Min("added_at"))
    )
    new_clients = sum(1 for row in first_joins if row["first"] and row["first"] >= start)

    return {
        "range": selected,
        "projects": {"total": projects.count(), "by_status": _by_status(projects, Project)},
        "tasks": {
            "total": tasks.count(),
            "by_status": _by_status(tasks, Task),
            "overdue": open_tasks.filter(deadline__lt=today).count(),
            "due_next_7_days": open_tasks.filter(deadline__gte=today, deadline__lte=today + timedelta(days=7)).count(),
        },
        "deliverables": {
            "approved_in_range": deliverables.filter(status="approved", updated_at__gte=start).count(),
            "awaiting_review": deliverables.filter(status="pending").count(),
        },
        "new_clients_in_range": new_clients,
    }


register(Tool(
    name="get_analytics",
    description=(
        "A summary of how the user's workspace is doing: projects and tasks by status, overdue tasks, "
        "tasks due in the next 7 days, deliverables approved in a period and awaiting review, and new clients. "
        "range is one of 7d, 30d (default), 3m, 12m."
    ),
    parameters={
        "type": "object",
        "properties": {"range": {"type": "string", "enum": list(RANGE_DAYS)}},
    },
    run=get_analytics,
))
