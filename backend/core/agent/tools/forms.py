"""Form tools: create_form, list_forms, get_form and update_form (forms and client surveys).

Like every write, create_form and update_form are only ever PROPOSED by the model (see
agent.actions); the user confirms; then `run` executes. A survey is just a form, so the same tools
cover both. The model sends plain data (title, intro, questions, small operations); this module
builds the block objects the form builder and the public fill page expect, so the model never writes
blocks or HTML itself.

Responses to a form are saved by the question's POSITION in the form, not by id. So once a form has
responses, update_form only allows changes that keep every position: adding at the end, rewording,
and changing the title or welcome message.
"""
import copy
import html
import uuid

from django.db import transaction
from django.db.models import Count
from django.utils.html import escape, strip_tags
from onboarding.models import OnboardingTemplate, StandaloneForm
from project.models import Project

from .base import ALLOW_DUPLICATE, Tool, ToolError, clip, limited, needs, parse_uuid, refuse_duplicate, register

QUESTION_TYPES = ["short_answer", "long_answer", "multiple_choice", "checkbox", "file_upload"]
MAX_QUESTIONS = 30
MIN_OPTIONS = 2
MAX_OPTIONS = 10
MAX_OPERATIONS = 10
OPERATIONS = ["add_question", "update_question", "remove_question", "move_question"]


def _question_block(position, question):
    label = question["label"].strip()
    if not label:
        raise ToolError(f"Question {position}: it needs a label (the question text).")
    kind = question["type"]
    options = [o.strip() for o in question.get("options", []) if o.strip()]

    if kind == "multiple_choice":
        if len({o.lower() for o in options}) != len(options):
            raise ToolError(f"Question {position}: its options must all be different.")
        if len(options) < MIN_OPTIONS:
            raise ToolError(f"Question {position} ('{clip(label)}'): a multiple_choice question needs at least {MIN_OPTIONS} options.")
    elif question.get("options"):
        raise ToolError(f"Question {position} ('{clip(label)}'): only multiple_choice questions take options.")

    block = {
        "id": str(uuid.uuid4()),
        "type": kind,
        "label": label,
        "required": question.get("required", True),
        "placeholder": question.get("placeholder", "").strip(),
    }
    if kind == "multiple_choice":
        block["options"] = options
    return block


def _welcome_block(intro):
    # The welcome block is the one place the form page renders HTML, so the text is escaped here and
    # only ever wrapped in plain paragraphs.
    paragraphs = "".join(f"<p>{escape(line.strip())}</p>" for line in intro.splitlines() if line.strip())
    return {"id": str(uuid.uuid4()), "type": "welcome", "label": "", "content": paragraphs, "required": False, "placeholder": ""}


def _form_inputs(args):
    title = args["title"].strip()
    if not title:
        raise ToolError("'title': A form needs a title.")
    blocks = []
    intro = args.get("intro", "").strip()
    if intro:
        blocks.append(_welcome_block(intro))
    blocks += [_question_block(i, q) for i, q in enumerate(args["questions"], start=1)]
    return title, blocks


# --- create_form ------------------------------------------------------------------------------

def prepare_create_form(user, args):
    title, blocks = _form_inputs(args)
    if not args.get("allow_duplicate"):
        same = StandaloneForm.objects.filter(creator=user, title__iexact=title).first()
        if same:
            refuse_duplicate(
                "form", same.title, same.id,
                "Look at it with get_form and change it with update_form instead of making a new one.",
            )
    count = len(args["questions"])
    return f'Create the form "{clip(title)}" with {count} question{"" if count == 1 else "s"}'


def run_create_form(user, args):
    title, blocks = _form_inputs(args)
    form = StandaloneForm.objects.create(creator=user, title=title, blocks=blocks)
    return {"id": str(form.id), "name": form.title, "link": f"/forms/{form.id}"}


# --- create_onboarding_form -------------------------------------------------------------------
# A client onboarding form is a different record from a plain form: it belongs to a project, and a
# client who fills it in gets an account and joins that project (their portal). The questions are
# built exactly like a plain form's, so the form builder and the fill page read them the same way.

def _onboarding_project(user, args):
    # Same rule as OnboardingTemplateSerializer.validate_project. Not-yours and nonexistent look identical.
    project = Project.objects.filter(id=parse_uuid(args["project_id"], "Project"), creator=user).first()
    if project is None:
        raise ToolError("Project not found. Use list_projects to find the project the client should join.")
    return project


def prepare_create_onboarding_form(user, args):
    title, blocks = _form_inputs(args)
    project = _onboarding_project(user, args)
    if not args.get("allow_duplicate"):
        same = OnboardingTemplate.objects.filter(creator=user, title__iexact=title).first()
        if same:
            refuse_duplicate(
                "client onboarding form", same.title, same.id,
                "Tell the user it exists and that they can open and edit it from the Onboarding page.",
            )
    count = len(args["questions"])
    return (
        f'Create the client onboarding form "{clip(title)}" for the project "{clip(project.name)}" '
        f'with {count} question{"" if count == 1 else "s"}'
    )


def run_create_onboarding_form(user, args):
    title, blocks = _form_inputs(args)
    project = _onboarding_project(user, args)
    form = OnboardingTemplate.objects.create(creator=user, title=title, blocks=blocks, project=project)
    return {"id": str(form.id), "name": form.title, "link": f"/onboarding/{form.id}"}


# --- reading forms ----------------------------------------------------------------------------

def _own_form(user, form_id):
    form = StandaloneForm.objects.filter(id=parse_uuid(form_id, "Form"), creator=user).first()
    if form is None:
        raise ToolError("Form not found.")
    return form


def _blocks_of(form):
    return form.blocks if isinstance(form.blocks, list) else []


def _ref(block, index):
    """A question's id. Forms made long ago can have blocks without one; they are addressed by
    position as 'legacy-<n>' and get a real id the first time update_form saves them."""
    return block.get("id") or f"legacy-{index}"


def _intro_text(blocks):
    for block in blocks:
        if block.get("type") == "welcome":
            text = strip_tags((block.get("content") or "").replace("</p>", "\n"))
            return clip("\n".join(line.strip() for line in html.unescape(text).splitlines() if line.strip()))
    return ""


def run_list_forms(user, args):
    forms = StandaloneForm.objects.filter(creator=user).annotate(n=Count("responses")).order_by("-created_at")[:26]
    return limited(
        {
            "id": str(f.id),
            "title": clip(f.title),
            "questions": sum(1 for b in _blocks_of(f) if b.get("type") != "welcome"),
            "responses": f.n,
            "is_open": f.is_open,
            "link": f"/forms/{f.id}",
        }
        for f in forms
    )


def run_get_form(user, args):
    form = _own_form(user, args["form_id"])
    questions = []
    for index, block in enumerate(_blocks_of(form)):
        if block.get("type") == "welcome":
            continue
        item = {
            "id": _ref(block, index),
            "number": len(questions) + 1,
            "label": clip(block.get("label", "")),
            "type": block.get("type"),
            "required": bool(block.get("required", True)),
        }
        if block.get("options"):
            item["options"] = [clip(str(o)) for o in block["options"]]
        if block.get("placeholder"):
            item["placeholder"] = clip(block["placeholder"])
        questions.append(item)
    return {
        "id": str(form.id),
        "title": clip(form.title),
        "intro": _intro_text(_blocks_of(form)),
        "is_open": form.is_open,
        "responses": form.responses.count(),
        "questions": questions[:60],
        "truncated": len(questions) > 60,
        "link": f"/forms/{form.id}",
    }


# --- update_form ------------------------------------------------------------------------------

_OP_FIELDS = {
    "add_question": {"label", "type", "required", "options", "placeholder", "after_question_id"},
    "update_question": {"question_id", "label", "type", "required", "options", "placeholder"},
    "remove_question": {"question_id"},
    "move_question": {"question_id", "after_question_id"},
}
_QUESTION_FIELDS = ("label", "type", "required", "options", "placeholder")


def _locked(what, hint="You can still add questions at the end, reword questions, or change the title or welcome message."):
    return ToolError(
        f"This form already has responses, and they are saved by question position, so {what} would mix up "
        f"the answers people have given. {hint}"
    )


def _apply(form, args):
    """Work out the form's new title and blocks from an update_form request, without saving.
    Returns (title, blocks, preview). Raises ToolError, in words the model can act on, for anything
    that is not allowed."""
    title = form.title
    blocks = copy.deepcopy(_blocks_of(form))
    locked = form.responses.exists()
    preview = []
    legacy = {f"legacy-{i}": b for i, b in enumerate(blocks) if not b.get("id")}

    def position(block):
        return next(i for i, b in enumerate(blocks) if b is block)

    def first_question_index():
        return 1 if blocks and blocks[0].get("type") == "welcome" else 0

    def question_count():
        return sum(1 for b in blocks if b.get("type") != "welcome")

    def find(ref, number):
        if not isinstance(ref, str) or not ref:
            raise ToolError(f"Operation {number}: question_id is required.")
        block = next((b for b in blocks if b.get("type") != "welcome" and b.get("id") == ref), None)
        block = block or legacy.get(ref)
        if block is None or not any(b is block for b in blocks) or block.get("type") == "welcome":
            raise ToolError(f"Operation {number}: there is no question with id '{ref}'. Call get_form to see the current ids.")
        return block

    def insert_at(after, number):
        if after in (None, ""):
            return len(blocks)
        if after == "start":
            return first_question_index()
        return position(find(after, number)) + 1

    def welcome_mentions(question_id):
        return bool(question_id) and any(
            f'data-id="{question_id}"' in (b.get("content") or "") for b in blocks if b.get("type") == "welcome"
        )

    if "title" in args:
        new_title = args["title"].strip()
        if not new_title:
            raise ToolError("'title': A form needs a title.")
        if new_title != title:
            title = new_title
            preview.append({"change": "Title", "label": new_title})

    if "intro" in args:
        text = args["intro"].strip()
        welcome = next((b for b in blocks if b.get("type") == "welcome"), None)
        if text:
            fresh = _welcome_block(text)
            if welcome is None:
                if locked:
                    raise _locked("adding a welcome message")
                blocks.insert(0, fresh)
            else:
                welcome["content"] = fresh["content"]
            preview.append({"change": "Welcome message", "label": clip(text)})
        elif welcome is not None:
            if locked:
                raise _locked("removing the welcome message")
            blocks[:] = [b for b in blocks if b is not welcome]
            preview.append({"change": "Welcome message", "label": "Removed"})

    for number, op in enumerate(args.get("operations", []), start=1):
        kind = op["op"]
        stray = sorted(set(op) - {"op"} - _OP_FIELDS[kind])
        if stray:
            raise ToolError(f"Operation {number} ({kind}): {', '.join(stray)} does not apply to this operation.")

        if kind == "add_question":
            for needed in ("label", "type"):
                if needed not in op:
                    raise ToolError(f"Operation {number}: add_question needs '{needed}'.")
            at = insert_at(op.get("after_question_id"), number)
            if locked and at != len(blocks):
                raise _locked("putting a question in the middle")
            if question_count() >= MAX_QUESTIONS:
                raise ToolError(f"A form can have at most {MAX_QUESTIONS} questions.")
            block = _question_block(question_count() + 1, {k: op[k] for k in _QUESTION_FIELDS if k in op})
            blocks.insert(at, block)
            preview.append({
                "change": "Add", "label": block["label"], "type": block["type"],
                "detail": " / ".join(block.get("options", [])),
            })

        elif kind == "update_question":
            block = find(op.get("question_id"), number)
            changes = {k: op[k] for k in _QUESTION_FIELDS if k in op}
            if not changes:
                raise ToolError(f"Operation {number}: update_question needs at least one thing to change.")
            old_label = block.get("label", "")
            if "type" in changes and changes["type"] != block.get("type") and locked:
                raise _locked("changing a question's type")
            merged = {
                "label": old_label,
                "type": block.get("type"),
                "required": block.get("required", True),
                "placeholder": block.get("placeholder", ""),
            }
            if block.get("type") == "multiple_choice":
                merged["options"] = list(block.get("options") or [])
            merged.update(changes)
            if merged["type"] != "multiple_choice" and "options" not in changes:
                merged.pop("options", None)
            if locked and block.get("type") == "multiple_choice" and "options" in changes:
                old = [str(o).strip() for o in block.get("options") or []]
                new = [o.strip() for o in changes["options"] if o.strip()]
                if new[: len(old)] != old:
                    raise _locked("removing, renaming or reordering choices", "You can add new choices at the end.")
            index = position(block)
            fresh = _question_block(sum(1 for b in blocks[:index] if b.get("type") != "welcome") + 1, merged)
            fresh["id"] = block.get("id") or fresh["id"]
            for key, value in block.items():
                if key != "options":  # options belong to the new type, never carried over from the old one
                    fresh.setdefault(key, value)
            blocks[index] = fresh
            for key, held in list(legacy.items()):
                if held is block:
                    legacy[key] = fresh
            detail = []
            if "label" in changes and changes["label"].strip() != old_label:
                detail.append(f"now \"{clip(changes['label'].strip())}\"")
            if "required" in changes:
                detail.append("required" if changes["required"] else "optional")
            if "type" in changes and changes["type"] != block.get("type"):
                detail.append(f"type {changes['type'].replace('_', ' ')}")
            if "options" in changes:
                detail.append("choices: " + " / ".join(fresh.get("options", [])))
            if "placeholder" in changes:
                detail.append("placeholder changed")
            preview.append({"change": "Change", "label": old_label, "detail": "; ".join(detail)})

        elif kind == "remove_question":
            block = find(op.get("question_id"), number)
            if locked:
                raise _locked("removing a question")
            if question_count() <= 1:
                raise ToolError("A form needs at least one question, so the last one cannot be removed.")
            if welcome_mentions(block.get("id")):
                raise ToolError(
                    f"The welcome message refers to the question '{clip(block.get('label', ''))}'. "
                    "Change the welcome message first, or keep that question."
                )
            blocks[:] = [b for b in blocks if b is not block]
            preview.append({"change": "Remove", "label": block.get("label", "")})

        else:  # move_question
            block = find(op.get("question_id"), number)
            if locked:
                raise _locked("reordering questions")
            if "after_question_id" not in op:
                raise ToolError(f"Operation {number}: move_question needs 'after_question_id' (a question id, or 'start').")
            after = op["after_question_id"]
            target = None if after == "start" else find(after, number)
            if target is block:
                raise ToolError(f"Operation {number}: a question cannot be moved after itself.")
            blocks[:] = [b for b in blocks if b is not block]
            blocks.insert(first_question_index() if target is None else position(target) + 1, block)
            preview.append({
                "change": "Move", "label": block.get("label", ""),
                "detail": "to the start" if target is None else f"after \"{clip(target.get('label', ''))}\"",
            })

    if not preview:
        raise ToolError("Nothing to change: give a new title, a new welcome message, or at least one operation that changes something.")
    if question_count() < 1:
        raise ToolError("A form needs at least one question.")
    return title, blocks, preview


def _summary(form, args):
    operations = args.get("operations", [])
    parts = []
    for kind, verb in (("add_question", "add"), ("update_question", "change"), ("remove_question", "remove"), ("move_question", "move")):
        count = sum(1 for o in operations if o["op"] == kind)
        if count:
            parts.append(f"{verb} {count} question{'' if count == 1 else 's'}")
    if "title" in args:
        parts.append("rename it")
    if "intro" in args:
        parts.append("update the welcome message")
    return f'Change the form "{clip(form.title)}": ' + ", ".join(parts)


def _requested(args):
    if not any(key in args for key in ("title", "intro", "operations")):
        raise ToolError("Nothing to change: give a new title, a new welcome message, or at least one operation.")


def prepare_update_form(user, args):
    _requested(args)
    form = _own_form(user, args["form_id"])
    _apply(form, args)
    return _summary(form, args)


def preview_update_form(user, args):
    return _apply(_own_form(user, args["form_id"]), args)[2]


def run_update_form(user, args):
    _requested(args)
    with transaction.atomic():
        form = StandaloneForm.objects.select_for_update().filter(id=parse_uuid(args["form_id"], "Form"), creator=user).first()
        if form is None:
            raise ToolError("Form not found.")
        title, blocks, _preview = _apply(form, args)
        for block in blocks:
            if not block.get("id"):
                block["id"] = str(uuid.uuid4())
        form.title = title
        form.blocks = blocks
        form.save(update_fields=["title", "blocks", "updated_at"])
    return {"id": str(form.id), "name": form.title, "link": f"/forms/{form.id}"}


# --- registration -----------------------------------------------------------------------------

_CONFIRM = "This only PROPOSES the change; nothing happens until the user confirms it on the card shown to them."

register(Tool(
    name="create_form",
    description=(
        "Propose creating a NEW form or client survey with the given questions. Use it for questionnaires, "
        "intake or feedback forms and surveys. If the user wants to change a form that already exists (including "
        "one made earlier in this conversation), do NOT use this: use update_form. "
        "Question types: short_answer, long_answer, multiple_choice "
        "(needs 2 or more options; for a rating use options such as '1 - Poor' up to '5 - Excellent'), "
        "checkbox (a single tick box, e.g. 'I agree'; if required it must be ticked) and file_upload. "
        + needs(
            ["what the form is for and who will fill it in (enough to write a title and the questions)"],
            optional=["a welcome message", "placeholder text", "which questions are required"],
        )
        + " intro is a plain-text welcome message shown first. Write plain text only, never HTML. "
        "Once created, anyone with the form's link can respond, and the user shares that link from the form's page. "
        + _CONFIRM
    ),
    parameters={
        "type": "object",
        "properties": {
            "title": {"type": "string", "maxLength": 255},
            "intro": {"type": "string", "maxLength": 1000},
            "questions": {
                "type": "array",
                "minItems": 1,
                "maxItems": MAX_QUESTIONS,
                "items": {
                    "type": "object",
                    "properties": {
                        "label": {"type": "string", "maxLength": 300},
                        "type": {"type": "string", "enum": QUESTION_TYPES},
                        "required": {"type": "boolean"},
                        "options": {"type": "array", "maxItems": MAX_OPTIONS, "items": {"type": "string", "maxLength": 100}},
                        "placeholder": {"type": "string", "maxLength": 200},
                    },
                    "required": ["label", "type"],
                },
            },
            "allow_duplicate": ALLOW_DUPLICATE,
        },
        "required": ["title", "questions"],
    },
    run=run_create_form,
    prepare=prepare_create_form,
    writes=True,
))

register(Tool(
    name="create_onboarding_form",
    description=(
        "Propose creating a CLIENT ONBOARDING FORM: the form a new client fills in to get their client portal. "
        "Use this, not create_form, whenever the user wants to onboard a client, set up or create a client portal, "
        "or give a client access to a project. It is always tied to one of the user's projects: a client who "
        "fills it in gets an account and joins that project, which is what they see in their portal. "
        "create_form is only for surveys and general forms that give nobody access. "
        "The project must already exist: find it with list_projects (or use the project the user is viewing, or "
        "one made in this conversation). If it does not exist yet, propose create_project first and wait for the "
        "user to confirm it before proposing this. Question types are the same as create_form. "
        + needs(
            ["which project the client should join", "what to ask the client (enough to write a title and the questions)"],
            optional=["a welcome message", "placeholder text", "which questions are required"],
        )
        + " intro is a plain-text welcome message shown first. Write plain text only, never HTML. "
        "This creates the form only. You cannot generate or send the client's link: after confirming, the user "
        "opens the form and generates a link there, one link per client. Tell them that. "
        "update_form cannot change an onboarding form; the user edits it on its page. "
        + _CONFIRM
    ),
    parameters={
        "type": "object",
        "properties": {
            "project_id": {"type": "string", "description": "The id of the user's project the client will join."},
            "title": {"type": "string", "maxLength": 255},
            "intro": {"type": "string", "maxLength": 1000},
            "questions": {
                "type": "array",
                "minItems": 1,
                "maxItems": MAX_QUESTIONS,
                "items": {
                    "type": "object",
                    "properties": {
                        "label": {"type": "string", "maxLength": 300},
                        "type": {"type": "string", "enum": QUESTION_TYPES},
                        "required": {"type": "boolean"},
                        "options": {"type": "array", "maxItems": MAX_OPTIONS, "items": {"type": "string", "maxLength": 100}},
                        "placeholder": {"type": "string", "maxLength": 200},
                    },
                    "required": ["label", "type"],
                },
            },
            "allow_duplicate": ALLOW_DUPLICATE,
        },
        "required": ["project_id", "title", "questions"],
    },
    run=run_create_onboarding_form,
    prepare=prepare_create_onboarding_form,
    writes=True,
))

register(Tool(
    name="list_forms",
    description=(
        "List the user's forms and client surveys (newest first): id, title, number of questions, number of "
        "responses and whether it is open. Use it to find a form before changing it, or before creating one, "
        "so you never make a copy of something that exists."
    ),
    parameters={"type": "object", "properties": {}},
    run=run_list_forms,
))

register(Tool(
    name="get_form",
    description=(
        "Read one form: title, welcome message, every question (with its id, type, whether it is required and its "
        "choices), and how many responses it has. Call it before update_form to get the question ids."
    ),
    parameters={"type": "object", "properties": {"form_id": {"type": "string"}}, "required": ["form_id"]},
    run=run_get_form,
))

register(Tool(
    name="update_form",
    description=(
        "Propose changes to an EXISTING form or client survey: rename it, change its welcome message, add, reword, "
        "remove or move questions. Use this, not create_form, whenever the user wants something added to or changed "
        "in a form that already exists. Call get_form first for the question ids. Each operation has an 'op': "
        "add_question (label and type, optional options/required/placeholder, and after_question_id to place it; "
        "leave it out to add at the end, or use 'start'), update_question (question_id plus what to change), "
        "remove_question (question_id), move_question (question_id and after_question_id, or 'start'). "
        "If the form already has responses, only adding at the end, rewording, new choices at the end, the title and "
        "the welcome message are allowed; the tool will say so if something is not. "
        + needs(["which form", "what to change"])
        + " "
        + _CONFIRM
    ),
    parameters={
        "type": "object",
        "properties": {
            "form_id": {"type": "string"},
            "title": {"type": "string", "maxLength": 255},
            "intro": {"type": "string", "maxLength": 1000, "description": "The new plain-text welcome message. Empty removes it."},
            "operations": {
                "type": "array",
                "minItems": 1,
                "maxItems": MAX_OPERATIONS,
                "items": {
                    "type": "object",
                    "properties": {
                        "op": {"type": "string", "enum": OPERATIONS},
                        "question_id": {"type": "string"},
                        "after_question_id": {"type": "string", "description": "A question id, or 'start'."},
                        "label": {"type": "string", "maxLength": 300},
                        "type": {"type": "string", "enum": QUESTION_TYPES},
                        "required": {"type": "boolean"},
                        "options": {"type": "array", "maxItems": MAX_OPTIONS, "items": {"type": "string", "maxLength": 100}},
                        "placeholder": {"type": "string", "maxLength": 200},
                    },
                    "required": ["op"],
                },
            },
        },
        "required": ["form_id"],
    },
    run=run_update_form,
    prepare=prepare_update_form,
    preview=preview_update_form,
    writes=True,
))
