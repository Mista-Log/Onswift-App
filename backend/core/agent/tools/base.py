"""Tool registry and argument validation for the Agent.

A tool is a name, a JSON schema and `run(user, args)`. Ownership always comes from `user`
(the authenticated request user), never from the model's arguments.
"""
import uuid
from dataclasses import dataclass
from typing import Callable

MAX_ROWS = 25  # rows returned per tool call, so a large workspace can't flood the prompt
MAX_TEXT = 300  # characters of free text per field


class ToolError(Exception):
    """A recoverable problem. The message is shown to the model so it can correct itself."""


@dataclass(frozen=True)
class Tool:
    name: str
    description: str
    parameters: dict  # JSON schema for the arguments object
    run: Callable
    writes: bool = False
    # Write tools only. prepare(user, args) checks the arguments against the user's CURRENT data
    # and returns a one-sentence summary for the confirm card; it raises ToolError if the change
    # is not allowed. It is called when the change is proposed and again when it is confirmed.
    # For a write tool, `run` performs the change and is reachable only through execute_write.
    prepare: Callable | None = None
    # Write tools whose arguments only carry ids can also say, in words, what the change will do:
    # preview(user, args) returns a list of {change, label, type?, detail?} for the confirm card.
    preview: Callable | None = None


_REGISTRY = {}


def register(tool):
    _REGISTRY[tool.name] = tool
    return tool


def get_tool(name):
    return _REGISTRY.get(name)


def tool_specs():
    """The registry in OpenAI tool format, ready to pass to LLMProvider.stream(tools=...)."""
    return [
        {"type": "function", "function": {"name": t.name, "description": t.description, "parameters": t.parameters}}
        for t in _REGISTRY.values()
    ]


def run_tool(user, name, args):
    tool = _REGISTRY.get(name)
    if tool is None:
        raise ToolError(f"Unknown tool '{name}'.")
    if tool.writes:
        # The model's path never performs a write. Writes are proposed, shown to the user, and
        # only executed by execute_write from the confirm endpoint.
        raise ToolError("This tool changes data, so it can only be proposed for the user to confirm.")
    return tool.run(user, validate_args(tool.parameters, args))


def propose_tool(user, name, args):
    """Validate a write tool's arguments against the user's current data. Returns (args, summary).
    Nothing is changed."""
    tool = _REGISTRY.get(name)
    if tool is None or not tool.writes or tool.prepare is None:
        raise ToolError(f"Unknown tool '{name}'.")
    args = validate_args(tool.parameters, args)
    return args, tool.prepare(user, args)


def preview_tool(user, name, args):
    """The card preview for an already-validated proposal, or None when the tool has none."""
    tool = _REGISTRY.get(name)
    if tool is None or tool.preview is None:
        return None
    return tool.preview(user, args)


def execute_write(user, name, args):
    """Run a confirmed write. Re-validates everything first: stored arguments are not trusted just
    because they passed when proposed (the data may have changed, or the row may be tampered with)."""
    args, _summary = propose_tool(user, name, args)
    return _REGISTRY[name].run(user, args)


def validate_args(schema, args):
    if not isinstance(args, dict):
        raise ToolError("Tool arguments must be an object.")
    properties = schema.get("properties", {})
    unknown = sorted(set(args) - set(properties))
    if unknown:
        raise ToolError(f"Unexpected argument(s): {', '.join(unknown)}.")
    for key in schema.get("required", []):
        if key not in args:
            raise ToolError(f"Missing required argument '{key}'. If the user has not told you, ask them for it; do not guess.")
    for key, value in args.items():
        _check(key, value, properties[key])
    return args


def _check(key, value, spec):
    kind = spec.get("type")
    if kind == "string" and not isinstance(value, str):
        raise ToolError(f"Argument '{key}' must be a string.")
    if kind == "integer" and (isinstance(value, bool) or not isinstance(value, int)):
        raise ToolError(f"Argument '{key}' must be an integer.")
    if kind == "boolean" and not isinstance(value, bool):
        raise ToolError(f"Argument '{key}' must be true or false.")
    if "maxLength" in spec and isinstance(value, str) and len(value) > spec["maxLength"]:
        raise ToolError(f"Argument '{key}' must be at most {spec['maxLength']} characters.")
    if "enum" in spec and value not in spec["enum"]:
        raise ToolError(f"Argument '{key}' must be one of: {', '.join(spec['enum'])}.")
    if "minimum" in spec and value < spec["minimum"]:
        raise ToolError(f"Argument '{key}' must be at least {spec['minimum']}.")
    if "maximum" in spec and value > spec["maximum"]:
        raise ToolError(f"Argument '{key}' must be at most {spec['maximum']}.")
    if kind == "array":
        if not isinstance(value, list):
            raise ToolError(f"Argument '{key}' must be a list.")
        if "minItems" in spec and len(value) < spec["minItems"]:
            raise ToolError(f"Argument '{key}' needs at least {spec['minItems']} item(s).")
        if "maxItems" in spec and len(value) > spec["maxItems"]:
            raise ToolError(f"Argument '{key}' can have at most {spec['maxItems']} items.")
        for position, item in enumerate(value, start=1):
            _check(f"{key}[{position}]", item, spec.get("items", {}))
    if kind == "object":
        if not isinstance(value, dict):
            raise ToolError(f"Argument '{key}' must be an object.")
        properties = spec.get("properties", {})
        unknown = sorted(set(value) - set(properties))
        if unknown:
            raise ToolError(f"Unexpected field(s) in '{key}': {', '.join(unknown)}.")
        for required in spec.get("required", []):
            if required not in value:
                raise ToolError(f"'{key}' is missing '{required}'.")
        for name, item in value.items():
            _check(f"{key}.{name}", item, properties[name])


def needs(required, optional=()):
    """The sentence every write tool carries, so the model knows what to collect before proposing.
    `required` and `optional` are plain phrases for the user's side of the conversation."""
    text = (
        "Needs from the user: " + ", ".join(required) + ". If any of these is missing and cannot be worked out "
        "from the conversation, do not call this tool: ask the user for it, putting everything that is missing "
        "into one short question, and never invent a value."
    )
    if optional:
        text += " Optional, never ask about these: " + ", ".join(optional) + "."
    return text


def parse_uuid(value, what):
    """Bad ids and ids that aren't yours must be indistinguishable, so both say 'not found'."""
    try:
        return uuid.UUID(str(value))
    except ValueError:
        raise ToolError(f"{what} not found.") from None


ALLOW_DUPLICATE = {
    "type": "boolean",
    "description": "Set true ONLY when the user has explicitly asked for a second copy of something that already exists.",
}


def refuse_duplicate(kind, existing, existing_id, how_to_change):
    """Raised by a create tool when the user already has one with that name. The model is told to
    change the existing one, so a follow-up request never turns into a pile of copies."""
    raise ToolError(
        f'You already have a {kind} called "{clip(existing)}" (id {existing_id}). Do not create another. '
        f"{how_to_change} Only if the user explicitly asks for a second copy, call this tool again "
        "with allow_duplicate set to true."
    )


def clip(text):
    text = text or ""
    return text if len(text) <= MAX_TEXT else text[:MAX_TEXT] + "…"


def limited(rows):
    rows = list(rows)
    return {"items": rows[:MAX_ROWS], "truncated": len(rows) > MAX_ROWS}
