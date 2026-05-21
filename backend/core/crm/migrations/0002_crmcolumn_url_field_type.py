from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("crm", "0001_initial"),
    ]

    operations = [
        migrations.AlterField(
            model_name="crmcolumn",
            name="field_type",
            field=models.CharField(
                choices=[
                    ("text", "Text"),
                    ("email", "Email"),
                    ("phone", "Phone"),
                    ("url", "URL"),
                    ("number", "Number"),
                    ("date", "Date"),
                    ("single_select", "Single Select"),
                    ("multi_select", "Multi Select"),
                    ("checkbox", "Checkbox"),
                ],
                default="text",
                max_length=20,
            ),
        ),
    ]
