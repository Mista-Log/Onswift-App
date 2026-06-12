from django.conf import settings
from django.db import migrations, models


def migrate_assignee_to_assignees(apps, schema_editor):
    Task = apps.get_model("project", "Task")
    for task in Task.objects.filter(assignee__isnull=False):
        task.assignees.add(task.assignee)


class Migration(migrations.Migration):

    dependencies = [
        ("project", "0006_task_recurrence"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.AddField(
            model_name="task",
            name="assignees",
            field=models.ManyToManyField(
                blank=True,
                related_name="assigned_tasks",
                to=settings.AUTH_USER_MODEL,
            ),
        ),
        migrations.RunPython(migrate_assignee_to_assignees, migrations.RunPython.noop),
        migrations.RemoveField(
            model_name="task",
            name="assignee",
        ),
    ]
