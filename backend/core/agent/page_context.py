"""Page-aware context for the Agent.

The route and ids the browser sends are hints, never authority. Each one is resolved through the
same user-scoped queryset a tool would use, and silently dropped if the user can't see it, so a
guessed or foreign id looks exactly like a missing one and nothing from it reaches the prompt.
"""
import uuid

from onboarding.models import StandaloneForm
from project.models import Project

from .tools.base import clip


def _uuid(value):
    if not isinstance(value, str):
        return None
    try:
        return uuid.UUID(value)
    except ValueError:
        return None


def page_note(user, context):
    if not isinstance(context, dict):
        return None
    notes = []
    project_id = _uuid(context.get("project_id"))
    project = Project.objects.filter(id=project_id, creator=user).first() if project_id else None
    if project is not None:
        notes.append(
            f'The user is currently viewing the project "{clip(project.name)}" (id {project.id}). '
            'Use it when they say "this project".'
        )
    form_id = _uuid(context.get("form_id"))
    form = StandaloneForm.objects.filter(id=form_id, creator=user).first() if form_id else None
    if form is not None:
        notes.append(
            f'The user is currently viewing the form "{clip(form.title)}" (id {form.id}). '
            'Use it when they say "this form"; to change it, use update_form.'
        )
    return "\n".join(notes) or None
