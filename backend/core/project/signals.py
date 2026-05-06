"""
Project signals — Handle project completion workflow.
When all tasks are completed, update ProjectClientMembership status.
"""
from django.db.models.signals import post_save
from django.dispatch import receiver
from django.db.models import Q
from .models import Task, Project, ProjectClientMembership


@receiver(post_save, sender=Task)
def update_project_membership_on_task_completion(sender, instance, created, **kwargs):
    """
    When a task is completed, check if all tasks in its project are done.
    If so, mark the ProjectClientMembership as "completed".
    """
    if not instance.project:
        return

    # Check if all tasks in the project are completed
    project = instance.project
    incomplete_tasks = project.tasks.exclude(status="completed").count()

    if incomplete_tasks == 0 and project.tasks.count() > 0:
        # All tasks are completed - update memberships to completed
        ProjectClientMembership.objects.filter(
            project=project,
            status__in=["active", "on_hold"]  # Only update active or on-hold
        ).update(status="completed")


@receiver(post_save, sender=Project)
def handle_project_status_change(sender, instance, created, **kwargs):
    """
    When a project status changes to "completed", mark all client memberships as completed.
    """
    if instance.status == "completed":
        ProjectClientMembership.objects.filter(
            project=instance,
            status__in=["active", "on_hold"]
        ).update(status="completed")
