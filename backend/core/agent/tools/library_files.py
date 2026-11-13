"""Read tool for the document library (uploaded files).

Scoping mirrors library.views for a creator: `Document.objects.filter(creator=user, is_deleted=False)`.
Only file details are returned, never the file's URL or contents: the Agent can say what exists and
where, and the user opens it themselves.
"""
from django.db.models import Q
from library.models import Document

from .base import MAX_ROWS, MAX_TEXT, Tool, clip, limited, register

MAX_TAGS = 10


def search_library(user, args):
    files = Document.objects.filter(creator=user, is_deleted=False).select_related("folder")
    query = (args.get("query") or "").strip()
    if query:
        files = files.filter(Q(name__icontains=query) | Q(tags__icontains=query))
    rows = [
        {
            "id": str(f.id),
            "name": clip(f.name),
            "file_type": f.file_type,
            "size_kb": round(f.size_kb or 0, 1),
            "tags": [clip(str(t)) for t in (f.tags if isinstance(f.tags, list) else [])][:MAX_TAGS],
            "folder": clip(f.folder.name) if f.folder_id else None,
            "is_favorite": f.is_favorite,
            "updated_at": f.updated_at.isoformat(),
        }
        for f in files.order_by("-updated_at")[: MAX_ROWS + 1]
    ]
    return limited(rows)


register(Tool(
    name="search_library",
    description=(
        "Search the user's uploaded files in the document library by name or tag. "
        "Leave query empty to list the most recently updated files. Returns file details only, not contents."
    ),
    parameters={
        "type": "object",
        "properties": {"query": {"type": "string", "maxLength": MAX_TEXT}},
    },
    run=search_library,
))
