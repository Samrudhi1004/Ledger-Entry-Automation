from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("messaging", "0002_messagereaction"),
    ]

    operations = [
        migrations.AddField(
            model_name="conversation",
            name="pinned_messages",
            field=models.ManyToManyField(
                blank=True,
                related_name="pinned_in_conversations",
                to="messaging.message",
            ),
        ),
    ]
