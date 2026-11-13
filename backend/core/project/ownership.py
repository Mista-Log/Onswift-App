"""Who may see or change a project, now that a talent can own projects too.

Three kinds of project reach a user:
  * their own          (project.creator is the user, whatever their role)
  * assigned to them   (a talent with a task in somebody else's project; unchanged)
  * shared with them   (a creator seeing a project one of their team members owns and switched to
                        "shared"; read-only)

"Their team" means an accepted notification.HireRequest, the same rule used everywhere else.
"""
from django.db.models import Q

from .models import Project


def is_owner(user, project):
    return project.creator_id == user.id


def shared_with_creator(creator):
    """Projects owned by the creator's team members that those members chose to share."""
    return Project.objects.filter(
        shared_with_creators=True,
        creator__role="talent",
        creator__received_hire_requests__creator=creator,
        creator__received_hire_requests__status="accepted",
    ).distinct()


def creator_can_view(creator, project):
    return shared_with_creator(creator).filter(pk=project.pk).exists()


def visible_to_talent(user):
    """A talent's own projects plus the ones they are assigned work in."""
    return Project.objects.filter(Q(creator=user) | Q(tasks__assignees=user)).distinct()
