from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('project', '0005_priority_checklists'),
    ]

    operations = [
        migrations.AddField(
            model_name='task',
            name='task_time',
            field=models.TimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='task',
            name='recurrence_type',
            field=models.CharField(
                blank=True,
                choices=[('daily', 'Daily'), ('weekly', 'Weekly'), ('monthly', 'Monthly'), ('custom', 'Custom')],
                max_length=10,
                null=True,
            ),
        ),
        migrations.AddField(
            model_name='task',
            name='recurrence_days',
            field=models.PositiveIntegerField(blank=True, null=True),
        ),
    ]
