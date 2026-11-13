"""Read tools for projects, tasks and deadlines.

Scoping mirrors the creator branch of the existing views (project.views.ProjectListCreateView,
TaskListCreateView and project.deadlines.DeadlineListView): a creator sees their own projects and
the tasks inside them. The filter is applied here, from `user`, never from model arguments.
"""
import datetime as dt
from collections import Counter

from django.utils import timezone

from project.models import PersonalTask, Project, Task

from .base import MAX_ROWS, Tool, ToolError, clip, limited, parse_uuid, register

PROJECT_STATUSES = [s for s, _ in Project.STATUS_CHOICES]
TASK_STATUSES = [s for s, _ in Task.STATUS_CHOICES]


def _projects(user):
    return Project.objects.filter(creator=user)


def _tasks(user):
    return Task.objects.filter(project__creator=user)


def _assignee_names(task):
    return [a.full_name or a.email for a in task.assignees.all()]


def _task_row(task, today):
    return {
        "id": str(task.id),
        "name": task.name,
        "project_id": str(task.project_id),
        "project_name": task.project.name,
        "status": task.status,
        "priority": task.priority,
        "deadline": task.deadline.isoformat() if task.deadline else None,
        "overdue": bool(task.deadline and task.deadline < today and task.status != "completed"),
        "assignees": _assignee_names(task),
    }


def list_projects(user, args):
    projects = _projects(user).order_by("-created_at")
    if "status" in args:
        projects = projects.filter(status=args["status"])
    rows = [
        {
            "id": str(p.id),
            "name": p.name,
            "status": p.status,
            "due_date": p.due_date.isoformat() if p.due_date else None,
            "task_count": p.tasks.count(),
        }
        for p in projects[: MAX_ROWS + 1]
    ]
    return limited(rows)


def get_project(user, args):
    project_id = parse_uuid(args["project_id"], "Project")
    project = _projects(user).filter(id=project_id).first()
    if project is None:  # nonexistent and not-yours are deliberately the same answer
        raise ToolError("Project not found.")
    return {
        "id": str(project.id),
        "name": project.name,
        "description": clip(project.description),
        "status": project.status,
        "due_date": project.due_date.isoformat() if project.due_date else None,
        "tasks_by_status": dict(Counter(project.tasks.values_list("status", flat=True))),
    }


def list_tasks(user, args):
    today = timezone.localdate()
    tasks = _tasks(user).select_related("project").prefetch_related("assignees")
    if "project_id" in args:
        tasks = tasks.filter(project_id=parse_uuid(args["project_id"], "Project"))
    if "status" in args:
        tasks = tasks.filter(status=args["status"])
    if args.get("overdue"):
        tasks = tasks.filter(deadline__lt=today).exclude(status="completed")
    tasks = tasks.order_by("deadline", "created_at")
    return limited([_task_row(t, today) for t in tasks[: MAX_ROWS + 1]])


def list_deadlines(user, args):
    today = timezone.localdate()
    horizon = today + dt.timedelta(days=args.get("days", 14))
    tasks = (
        _tasks(user)
        .filter(deadline__isnull=False, deadline__lte=horizon)
        .exclude(status="completed")
        .select_related("project")
        .prefetch_related("assignees")
    )
    rows = [{**_task_row(t, today), "is_personal": False} for t in tasks]
    personal = PersonalTask.objects.filter(
        owner=user, deadline__isnull=False, deadline__lte=horizon
    ).exclude(status="completed")
    rows += [
        {
            "id": str(t.id),
            "name": t.name,
            "project_id": None,
            "project_name": "Personal",
            "status": t.status,
            "priority": None,
            "deadline": t.deadline.isoformat(),
            "overdue": t.deadline < today,
            "assignees": [],
            "is_personal": True,
        }
        for t in personal
    ]
    rows.sort(key=lambda r: r["deadline"])
    return limited(rows)


def list_team(user, args):
    # Same rule as the Team page (CreatorTeamListView): talents who accepted this creator's invite.
    # Only what's needed to pick an assignee; no emails.
    from notification.models import HireRequest

    hires = HireRequest.objects.filter(creator=user, status="accepted").select_related("talent")
    rows = [{"id": str(h.talent_id), "name": h.talent.full_name or h.talent.email} for h in hires[: MAX_ROWS + 1]]
    return limited(rows)


register(Tool(
    name="list_team",
    description=(
        "List the people on the user's team (id and name). Use it to find the id of a teammate such as "
        "'LeRo' before assigning them a task with create_task's assignee_ids."
    ),
    parameters={"type": "object", "properties": {}},
    run=list_team,
))

register(Tool(
    name="list_projects",
    description="List the user's projects with status, due date and task count. Optionally filter by status.",
    parameters={
        "type": "object",
        "properties": {"status": {"type": "string", "enum": PROJECT_STATUSES}},
    },
    run=list_projects,
))

register(Tool(
    name="get_project",
    description="Get one project by id: description, status, due date and a count of its tasks by status.",
    parameters={
        "type": "object",
        "properties": {"project_id": {"type": "string"}},
        "required": ["project_id"],
    },
    run=get_project,
))

register(Tool(
    name="list_tasks",
    description=(
        "List tasks in the user's projects, ordered by deadline. Filter by project_id, status, or "
        "overdue=true for tasks past their deadline and not completed."
    ),
    parameters={
        "type": "object",
        "properties": {
            "project_id": {"type": "string"},
            "status": {"type": "string", "enum": TASK_STATUSES},
            "overdue": {"type": "boolean"},
        },
    },
    run=list_tasks,
))

register(Tool(
    name="list_deadlines",
    description=(
        "List unfinished tasks (including the user's personal tasks) whose deadline is within the next "
        "`days` days, earliest first. Overdue items are included and flagged overdue=true."
    ),
    parameters={
        "type": "object",
        "properties": {"days": {"type": "integer", "minimum": 0, "maximum": 365}},
    },
    run=list_deadlines,
))
