"""Docs: a read tool (search_docs) and the plain-text <-> editor-block helpers create_doc uses.

Scoping mirrors docs.views.DocListCreateView: docs the user owns plus docs shared with them. Doc
content is BlockNote blocks (what the editor saves as `editor.document`). The Agent only ever
writes plain paragraphs, headings and bullets, and reads text back out of any block shape.
"""
import uuid

from django.db.models import Q
from docs.models import Doc, DocAccess

from .base import MAX_ROWS, MAX_TEXT, Tool, ToolError, clip, limited, register

MAX_BLOCKS = 200  # lines a created doc may have
MAX_CANDIDATES = 100  # rows pulled from the database before the text is checked in Python
SNIPPET_RADIUS = 120

_BASE_PROPS = {"textColor": "default", "backgroundColor": "default", "textAlignment": "left"}


def _block(kind, text, extra_props=None):
    return {
        "id": str(uuid.uuid4()),
        "type": kind,
        "props": {**_BASE_PROPS, **(extra_props or {})},
        "content": [{"type": "text", "text": text, "styles": {}}],
        "children": [],
    }


def text_to_blocks(text):
    """Plain text to editor blocks. '# ', '## ', '### ' start headings and '- ' / '* ' bullets;
    everything else is a paragraph. Blank lines are dropped. Nothing here is ever HTML."""
    blocks = []
    for line in (text or "").replace("\r\n", "\n").split("\n"):
        line = line.strip()
        if not line:
            continue
        for marker, level in (("### ", 3), ("## ", 2), ("# ", 1)):
            if line.startswith(marker) and line[len(marker):].strip():
                blocks.append(_block("heading", line[len(marker):].strip(), {"level": level}))
                break
        else:
            if line[:2] in ("- ", "* ") and line[2:].strip():
                blocks.append(_block("bulletListItem", line[2:].strip()))
            else:
                blocks.append(_block("paragraph", line))
        if len(blocks) > MAX_BLOCKS:
            raise ToolError(f"That is too long for one doc (over {MAX_BLOCKS} lines). Split it up.")
    return blocks


def _inline_text(item):
    if not isinstance(item, dict):
        return ""
    if item.get("type") == "text":
        return str(item.get("text", ""))
    if item.get("type") == "link" and isinstance(item.get("content"), list):
        return "".join(_inline_text(part) for part in item["content"])
    return ""


def blocks_to_text(blocks):
    """Plain text out of any BlockNote content. Tables, images and unknown shapes are skipped."""
    if not isinstance(blocks, list):
        return ""
    lines = []
    for block in blocks:
        if not isinstance(block, dict):
            continue
        content = block.get("content")
        if isinstance(content, list):
            lines.append("".join(_inline_text(item) for item in content))
        elif isinstance(content, str):
            lines.append(content)
        lines.append(blocks_to_text(block.get("children")))
    return "\n".join(line for line in lines if line)


def _snippet(text, query):
    flat = " ".join(text.split())
    if not flat:
        return ""
    at = flat.lower().find(query.lower()) if query else -1
    if at < 0:
        return clip(flat)
    start = max(0, at - SNIPPET_RADIUS)
    piece = flat[start : at + len(query) + SNIPPET_RADIUS]
    return clip(("…" if start else "") + piece + ("…" if start + len(piece) < len(flat) else ""))


def search_docs(user, args):
    shared = DocAccess.objects.filter(user=user).values_list("doc_id", flat=True)
    docs = Doc.objects.filter(Q(owner=user) | Q(id__in=shared)).select_related("project")
    query = (args.get("query") or "").strip()
    if query:
        # The database narrows by the raw JSON text, which also contains structure words, so the
        # real match is re-checked against the doc's text below.
        docs = docs.filter(Q(title__icontains=query) | Q(content__icontains=query))
    rows = []
    for doc in docs.order_by("-updated_at")[:MAX_CANDIDATES]:
        text = blocks_to_text(doc.content)
        if query and query.lower() not in doc.title.lower() and query.lower() not in text.lower():
            continue
        own_project = doc.project if doc.project_id and doc.project.creator_id == user.id else None
        rows.append({
            "id": str(doc.id),
            "title": clip(doc.title),
            "snippet": _snippet(text, query),
            "project": clip(own_project.name) if own_project else None,
            "shared_with_me": doc.owner_id != user.id,
            "updated_at": doc.updated_at.isoformat(),
            "link": f"/docs/{doc.id}",
        })
        if len(rows) > MAX_ROWS:
            break
    return limited(rows)


register(Tool(
    name="search_docs",
    description=(
        "Search the user's docs (their own and ones shared with them) by title or text. "
        "Leave query empty to list the most recently updated docs. Returns a short snippet, not the whole doc."
    ),
    parameters={
        "type": "object",
        "properties": {"query": {"type": "string", "maxLength": MAX_TEXT}},
    },
    run=search_docs,
))
