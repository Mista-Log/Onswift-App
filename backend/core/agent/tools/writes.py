"""Write tools: create_project, create_task, create_tasks, update_task.

These never run on the model's say-so. The model can only PROPOSE them (see agent.actions); the
user confirms; then `run` executes. `prepare` runs at both moments, against the user's current data.

Each change goes through the same serializers the screens use, so the Agent cannot bypass a rule
the normal UI enforces. Deliberately not here yet:
  - completing a task or project (it has approval flows and notifications; that stays a human act),
  - deleting anything.
"""
from docs.models import Doc
from project.models import Project, Task
from project.serializers import ProjectSerializer, TaskSerializer

from .base import ALLOW_DUPLICATE, Tool, ToolError, clip, needs, parse_uuid, refuse_duplicate, register
from .workspace_docs import text_to_blocks

PRIORITIES = [p for p, _ in Task.PRIORITY_CHOICES]
EDITABLE_STATUSES = ["planning", "in-progress"]  # "completed" is intentionally absent


def _valid(serializer):
    if not serializer.is_valid():
        field, problems = next(iter(serializer.errors.items()))
        problem = problems[0] if isinstance(problems, (list, tuple)) and problems else problems
        raise ToolError(f"'{field}': {problem}")
    return serializer


def _own_project(user, project_id):
    # Same filter as TaskListCreateView for a creator. Not-yours and nonexistent look identical.
    project = Project.objects.filter(id=parse_uuid(project_id, "Project"), creator=user).first()
    if project is None:
        raise ToolError("Project not found.")
    return project


def _own_task(user, task_id):
    task = Task.objects.filter(id=parse_uuid(task_id, "Task"), project__creator=user).select_related("project").first()
    if task is None:
        raise ToolError("Task not found.")
    return task


# --- create_project ---------------------------------------------------------------------------

def _without_flag(args):
    return {k: v for k, v in args.items() if k != "allow_duplicate"}


def prepare_create_project(user, args):
    if not args.get("allow_duplicate"):
        same = Project.objects.filter(creator=user, name__iexact=args["name"].strip()).first()
        if same:
            refuse_duplicate(
                "project", same.name, same.id,
                "The Agent cannot edit a project yet: tell the user it exists and offer the link /projects/" + str(same.id) + ".",
            )
    _valid(ProjectSerializer(data=_without_flag(args)))
    summary = f'Create the project "{clip(args["name"])}"'
    if args.get("due_date"):
        summary += f", due {args['due_date']}"
    return summary


def run_create_project(user, args):
    project = _valid(ProjectSerializer(data=_without_flag(args))).save(creator=user)
    return {"id": str(project.id), "name": project.name, "link": f"/projects/{project.id}"}


# --- create_task ------------------------------------------------------------------------------

def _team_assignees(user, ids):
    """The people named, only if each is the user themself or an accepted member of their own team.
    Anyone else (another creator's talent, a client, a made-up id) reads as 'not found'."""
    import uuid as _uuid

    wanted = []
    for raw in ids or []:
        try:
            wanted.append(_uuid.UUID(str(raw)))
        except ValueError:
            raise ToolError("Assignee not found on your team.") from None
    if not wanted:
        return []
    from notification.models import HireRequest

    hires = HireRequest.objects.filter(creator=user, status="accepted", talent_id__in=wanted).select_related("talent")
    found = {h.talent_id: h.talent for h in hires}
    if user.id in wanted:
        found[user.id] = user  # the user can always give a task to themself
    if len(found) != len(set(wanted)):
        raise ToolError("Assignee not found on your team. Use list_team to see who can be assigned.")
    return [found[w] for w in dict.fromkeys(wanted)]


def _task_fields(args, assignees=()):
    fields = {k: v for k, v in args.items() if k not in ("project_id", "assignee_ids")}
    if assignees:
        fields["assignees"] = [str(a.id) for a in assignees]
    return fields


def prepare_create_task(user, args):
    project = _own_project(user, args["project_id"])
    assignees = _team_assignees(user, args.get("assignee_ids"))
    _valid(TaskSerializer(data=_task_fields(args, assignees)))
    summary = f'Add the task "{clip(args["name"])}" to "{clip(project.name)}"'
    if args.get("deadline"):
        summary += f", due {args['deadline']}"
    if assignees:
        summary += ", assigned to " + ", ".join(
            "you" if a.id == user.id else clip(a.full_name or a.email) for a in assignees
        )
    return summary


def run_create_task(user, args):
    from types import SimpleNamespace

    project = _own_project(user, args["project_id"])
    assignees = _team_assignees(user, args.get("assignee_ids"))
    # The serializer reads request.user to skip notifying someone about a task they gave themself.
    acting_as = {"request": SimpleNamespace(user=user)}
    task = _valid(TaskSerializer(data=_task_fields(args, assignees), context=acting_as)).save(project=project)
    return {"id": str(task.id), "name": task.name, "project_id": str(project.id), "link": f"/projects/{project.id}"}


# --- create_tasks (several tasks, one card) ---------------------------------------------------

MAX_BATCH = 20


def _batch(user, args):
    """The project and, per task, its serializer-ready fields and assignees. A bad task names its
    position so the model can fix just that one."""
    project = _own_project(user, args["project_id"])
    checked = []
    for position, item in enumerate(args["tasks"], start=1):
        try:
            assignees = _team_assignees(user, item.get("assignee_ids"))
            fields = _task_fields(item, assignees)
            _valid(TaskSerializer(data=fields))
        except ToolError as error:
            raise ToolError(f'Task {position} ("{clip(item.get("name", ""))}"): {error}') from None
        checked.append((item, fields, assignees))
    return project, checked


def prepare_create_tasks(user, args):
    project, checked = _batch(user, args)
    count = len(checked)
    return f'Add {count} task{"" if count == 1 else "s"} to "{clip(project.name)}"'


def preview_create_tasks(user, args):
    _project, checked = _batch(user, args)
    rows = []
    for item, _fields, assignees in checked:
        details = []
        if item.get("deadline"):
            details.append(f"due {item['deadline']}")
        if item.get("priority"):
            details.append(f"{item['priority']} priority")
        if assignees:
            details.append("assigned to " + ", ".join(
                "you" if a.id == user.id else clip(a.full_name or a.email) for a in assignees
            ))
        if item.get("description"):
            details.append(clip(item["description"]))
        rows.append({"change": "Add", "label": clip(item["name"]), "detail": " · ".join(details)})
    return rows


def run_create_tasks(user, args):
    """All or nothing: confirm() runs this inside a savepoint, so one failure leaves no tasks behind."""
    from types import SimpleNamespace

    project, checked = _batch(user, args)
    acting_as = {"request": SimpleNamespace(user=user)}
    made = [
        _valid(TaskSerializer(data=fields, context=acting_as)).save(project=project)
        for _item, fields, _assignees in checked
    ]
    return {
        "id": str(project.id),
        "name": project.name,
        "project_id": str(project.id),
        "link": f"/projects/{project.id}",
        "tasks": [{"id": str(t.id), "name": t.name} for t in made],
    }


# --- update_task ------------------------------------------------------------------------------

_PEOPLE = ("assignee_ids", "unassign_ids")


def _changes(args):
    return {k: v for k, v in args.items() if k != "task_id" and k not in _PEOPLE}


def _who(user, people):
    return ", ".join("you" if p.id == user.id else clip(p.full_name or p.email) for p in people)


def _people_changes(user, task, args):
    """Who to add and who to take off. Adding keeps everyone already on the task; it never replaces
    the list. Added people must be on the user's team (as for create_task); removed people only have
    to be on the task now, so someone who has left the team can still be taken off."""
    current = list(task.assignees.all())
    current_ids = {p.id for p in current}
    add = [p for p in _team_assignees(user, args.get("assignee_ids")) if p.id not in current_ids]
    remove = []
    for raw in args.get("unassign_ids") or []:
        match = next((p for p in current if str(p.id) == str(raw)), None)
        if match is None:
            raise ToolError("That person is not assigned to this task. Use get_project or list_tasks to see who is.")
        remove.append(match)
    keep = [p for p in current if p not in remove]
    return add, remove, keep + add


def _update_data(user, task, args):
    changes = _changes(args)
    add, remove, after = _people_changes(user, task, args)
    if add or remove:
        changes["assignees"] = [str(p.id) for p in after]
    return changes, add, remove


def prepare_update_task(user, args):
    if not _changes(args) and not any(args.get(k) for k in _PEOPLE):
        raise ToolError("Nothing to change: give at least one field to update.")
    task = _own_task(user, args["task_id"])
    if task.status == "completed":
        raise ToolError("That task is already completed, so the Agent will not change it.")
    changes, add, remove = _update_data(user, task, args)
    if not changes:
        raise ToolError("Nothing to change: everyone named is already assigned to that task.")
    _valid(TaskSerializer(task, data=changes, partial=True))
    parts = [f"set {field} to {value}" for field, value in changes.items() if field != "assignees"]
    if add:
        parts.append("assign " + _who(user, add))
    if remove:
        parts.append("unassign " + _who(user, remove))
    return f'Update the task "{clip(task.name)}": ' + ", ".join(parts)


def run_update_task(user, args):
    task = _own_task(user, args["task_id"])
    if task.status == "completed":
        raise ToolError("That task is already completed, so the Agent will not change it.")
    changes, _add, _remove = _update_data(user, task, args)
    if not changes:
        raise ToolError("Nothing to change: everyone named is already assigned to that task.")
    task = _valid(TaskSerializer(task, data=changes, partial=True)).save()
    return {"id": str(task.id), "name": task.name, "project_id": str(task.project_id), "link": f"/projects/{task.project_id}"}


# --- registration -----------------------------------------------------------------------------

_NEEDS_CONFIRMATION = "This only PROPOSES the change; nothing happens until the user confirms it on the card shown to them."

register(Tool(
    name="create_project",
    description=(
        "Propose creating a new project. "
        + needs(["the project name", "its deadline"], optional=["a description"])
        + " Always ask for the deadline, and call it the deadline when you ask (for example: 'What's the deadline?'). "
        f"{_NEEDS_CONFIRMATION}"
    ),
    parameters={
        "type": "object",
        "properties": {
            "name": {"type": "string", "maxLength": 255},
            "description": {"type": "string", "maxLength": 2000},
            "due_date": {
                "type": "string",
                "description": "The project's deadline, YYYY-MM-DD. Work out dates like 'next Friday' from today's date.",
            },
            "allow_duplicate": ALLOW_DUPLICATE,
        },
        "required": ["name", "due_date"],
    },
    run=run_create_project,
    prepare=prepare_create_project,
    writes=True,
))

register(Tool(
    name="create_task",
    description=(
        "Propose adding a task to one of the user's projects. "
        + needs(
            ["the task name", "which project it belongs to", "a short description", "a deadline", "a priority"],
            optional=["who to assign it to"],
        )
        + " Ask for the description, deadline and priority together in ONE short message, unless the user already "
        "gave them or said to skip them or to pick for them (then leave them out or choose sensibly and say so). "
        "To assign the task, call list_team first and pass ids from it as assignee_ids; the list includes the "
        "user themself (is_you), so 'assign it to me' works. Only people on that list "
        "can be assigned, and assigning notifies teammates once the user confirms. If the user names someone who is not "
        f"on the list, say so instead of proposing. {_NEEDS_CONFIRMATION}"
    ),
    parameters={
        "type": "object",
        "properties": {
            "project_id": {"type": "string"},
            "name": {"type": "string", "maxLength": 255},
            "description": {"type": "string", "maxLength": 2000},
            "deadline": {"type": "string", "description": "YYYY-MM-DD"},
            "priority": {"type": "string", "enum": PRIORITIES},
            "assignee_ids": {
                "type": "array",
                "items": {"type": "string"},
                "maxItems": 10,
                "description": "User ids from list_team (teammates or the user themself). Nobody else can be assigned.",
            },
        },
        "required": ["project_id", "name"],
    },
    run=run_create_task,
    prepare=prepare_create_task,
    writes=True,
))

_BATCH_TASK = {
    "type": "object",
    "properties": {
        "name": {"type": "string", "maxLength": 255},
        "description": {"type": "string", "maxLength": 2000},
        "deadline": {"type": "string", "description": "YYYY-MM-DD"},
        "priority": {"type": "string", "enum": PRIORITIES},
        "assignee_ids": {
            "type": "array",
            "items": {"type": "string"},
            "maxItems": 10,
            "description": "User ids from list_team (teammates or the user themself). Nobody else can be assigned.",
        },
    },
    "required": ["name"],
}

register(Tool(
    name="create_tasks",
    description=(
        f"Propose adding 2 to {MAX_BATCH} tasks to ONE of the user's projects on a single card, so the user "
        "confirms them all at once. Use this instead of calling create_task repeatedly whenever the user gives "
        "or asks for more than one task for the same project (for example a task list to set up). "
        + needs(["the task names", "which project they belong to"], optional=["descriptions", "deadlines", "priorities", "who to assign each to"])
        + " If the user gave deadlines, priorities or descriptions, include them; otherwise leave them out. "
        "To assign tasks, call list_team first and pass ids from it as assignee_ids (the user is the row marked "
        "is_you); never assign anyone who is not on that list. The tasks are created together or not at all. "
        f"{_NEEDS_CONFIRMATION}"
    ),
    parameters={
        "type": "object",
        "properties": {
            "project_id": {"type": "string"},
            "tasks": {"type": "array", "items": _BATCH_TASK, "minItems": 1, "maxItems": MAX_BATCH},
        },
        "required": ["project_id", "tasks"],
    },
    run=run_create_tasks,
    prepare=prepare_create_tasks,
    preview=preview_create_tasks,
    writes=True,
))

register(Tool(
    name="update_task",
    description=(
        "Propose changing an existing task: its name, deadline or priority, moving it between planning and "
        "in-progress, or assigning and unassigning people. "
        + needs(["which task", "what to change about it"])
        + " To assign someone, call list_team and pass their id in assignee_ids: they are ADDED and everyone "
        "already on the task stays. To take someone off, pass their id in unassign_ids. Only people on list_team "
        "can be assigned; a newly assigned teammate is notified once the user confirms. "
        f"It cannot complete a task. {_NEEDS_CONFIRMATION}"
    ),
    parameters={
        "type": "object",
        "properties": {
            "task_id": {"type": "string"},
            "name": {"type": "string", "maxLength": 255},
            "deadline": {"type": "string", "description": "YYYY-MM-DD"},
            "priority": {"type": "string", "enum": PRIORITIES},
            "status": {"type": "string", "enum": EDITABLE_STATUSES},
            "assignee_ids": {
                "type": "array",
                "items": {"type": "string"},
                "maxItems": 10,
                "description": "People to ADD, as ids from list_team. Existing assignees stay.",
            },
            "unassign_ids": {
                "type": "array",
                "items": {"type": "string"},
                "maxItems": 10,
                "description": "People to take off the task, by id.",
            },
        },
        "required": ["task_id"],
    },
    run=run_update_task,
    prepare=prepare_update_task,
    writes=True,
))


# --- create_doc -------------------------------------------------------------------------------

def _doc_inputs(user, args):
    title = args["title"].strip()
    if not title:
        raise ToolError("'title': A doc needs a title.")
    project = _own_project(user, args["project_id"]) if args.get("project_id") else None
    return title, project, text_to_blocks(args.get("text", ""))


def prepare_create_doc(user, args):
    title, project, _blocks = _doc_inputs(user, args)
    if not args.get("allow_duplicate"):
        same = Doc.objects.filter(owner=user, title__iexact=title).first()
        if same:
            refuse_duplicate(
                "doc", same.title, same.id,
                "The Agent cannot edit a doc yet: tell the user it exists and offer the link /docs/" + str(same.id) + ".",
            )
    summary = f'Create the doc "{clip(title)}"'
    if project:
        summary += f' in "{clip(project.name)}"'
    return summary


def run_create_doc(user, args):
    title, project, blocks = _doc_inputs(user, args)
    doc = Doc.objects.create(owner=user, title=title, project=project, content=blocks)
    return {"id": str(doc.id), "name": doc.title, "link": f"/docs/{doc.id}"}


register(Tool(
    name="create_doc",
    description=(
        "Propose creating a new doc, optionally attached to one of the user's projects. text is plain text: "
        "start a line with '# ', '## ' or '### ' for a heading and '- ' for a bullet; other lines are paragraphs. "
        + needs(["the doc title", "what it should say"], optional=["a project to attach it to"])
        + f" {_NEEDS_CONFIRMATION}"
    ),
    parameters={
        "type": "object",
        "properties": {
            "title": {"type": "string", "maxLength": 255},
            "text": {"type": "string", "maxLength": 8000},
            "project_id": {"type": "string"},
            "allow_duplicate": ALLOW_DUPLICATE,
        },
        "required": ["title"],
    },
    run=run_create_doc,
    prepare=prepare_create_doc,
    writes=True,
))
