from django.db import migrations, models
import django.db.models.deletion
import uuid


class Migration(migrations.Migration):

    dependencies = [
        ('project', '0002_projectclientmembership'),
    ]

    operations = [
        migrations.CreateModel(
            name='DeliverableLink',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('url', models.URLField(max_length=2048)),
                ('added_at', models.DateTimeField(auto_now_add=True)),
                ('deliverable', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='links',
                    to='project.deliverable',
                )),
            ],
        ),
    ]
