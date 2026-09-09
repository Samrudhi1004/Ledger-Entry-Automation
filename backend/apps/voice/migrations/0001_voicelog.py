# Generated 2026-09-08 — MongoDB → PostgreSQL migration: VoiceLog model

import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='VoiceLog',
            fields=[
                ('id', models.AutoField(
                    auto_created=True,
                    primary_key=True,
                    serialize=False,
                    verbose_name='ID',
                )),
                ('raw_text', models.TextField(blank=True)),
                ('parsed_value', models.CharField(blank=True, max_length=255)),
                ('file_path', models.CharField(blank=True, max_length=500)),
                ('language', models.CharField(blank=True, max_length=20)),
                ('backend', models.CharField(blank=True, max_length=50)),
                ('timestamp', models.DateTimeField(auto_now_add=True)),
                ('user', models.ForeignKey(
                    blank=True,
                    null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name='voice_logs',
                    to=settings.AUTH_USER_MODEL,
                )),
            ],
            options={
                'db_table': 'voice_logs',
                'ordering': ['-timestamp'],
            },
        ),
    ]
