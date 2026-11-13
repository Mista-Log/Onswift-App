"""Read tools for a creator's clients.

Scoping mirrors portal.views.ClientHistoryView: a creator's clients are the people attached to the
creator's own projects through ProjectClientMembership (`project__creator=user`). Email addresses
are deliberately left out: the Agent does not need them to answer "who are my clients?", and each
field returned is sent on to the model provider.
"""
from collections import Counter

from project.models import ProjectClientMembership

from .base import Tool, ToolError, clip, limited, parse_uuid, register


def _memberships(user):
    return ProjectClientMembership.objects.filter(project__creator=user).select_related("client", "project")


def _name(client):
    return clip(client.full_name) or "Unnamed client"


def list_clients(user, args):
    clients = {}
    # Newest membership first, so the first row seen for a client carries their last activity.
    for m in _memberships(user).order_by("-added_at"):
        row = clients.get(m.client_id)
        if row is None:
            row = clients[m.client_id] = {
                "id": str(m.client_id),
                "name": _name(m.client),
                "total_projects": 0,
                "by_status": Counter(),
                "last_activity": m.added_at.isoformat(),
            }
        row["total_projects"] += 1
        row["by_status"][m.status] += 1
    rows = [{**r, "by_status": dict(r["by_status"])} for r in clients.values()]
    return limited(rows)


def get_client(user, args):
    client_id = parse_uuid(args["client_id"], "Client")
    memberships = list(_memberships(user).filter(client_id=client_id).order_by("-added_at"))
    if not memberships:  # nonexistent and not-your-client are deliberately the same answer
        raise ToolError("Client not found.")
    result = limited(
        {
            "project_id": str(m.project_id),
            "project_name": m.project.name,
            "project_status": m.project.status,
            "client_status": m.status,
        }
        for m in memberships
    )
    return {"id": str(client_id), "name": _name(memberships[0].client), "projects": result}


register(Tool(
    name="list_clients",
    description=(
        "List the user's clients (people attached to the user's projects) with how many projects each "
        "has, a count by status, and when they were last added to a project. Most recent first."
    ),
    parameters={"type": "object", "properties": {}},
    run=list_clients,
))

register(Tool(
    name="get_client",
    description="Get one client by id (from list_clients) with the projects they are attached to.",
    parameters={
        "type": "object",
        "properties": {"client_id": {"type": "string"}},
        "required": ["client_id"],
    },
    run=get_client,
))
