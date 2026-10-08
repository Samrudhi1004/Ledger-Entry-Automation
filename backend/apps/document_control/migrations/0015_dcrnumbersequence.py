import re

from django.db import migrations, models


def seed_dcr_sequences(apps, schema_editor):
    dcr_models = (
        apps.get_model('document_control', 'DocumentChangeRequest'),
        apps.get_model('parts', 'TemplateChangeRequest'),
    )
    sequence_model = apps.get_model('document_control', 'DCRNumberSequence')
    highest = {}
    for model in dcr_models:
        for number in model.objects.values_list('dcr_number', flat=True):
            match = re.match(r'^(DCR(?:-PARAM)?-\d{4}-)(\d+)$', number or '')
            if match:
                prefix, suffix = match.groups()
                highest[prefix] = max(highest.get(prefix, 0), int(suffix))
    for prefix, current in highest.items():
        sequence_model.objects.update_or_create(
            prefix=prefix,
            defaults={'next_value': current + 1},
        )


class Migration(migrations.Migration):

    dependencies = [
        ('document_control', '0009_documentuserpermission'),
        ('parts', '0014_controlplandocument_approval_comments_and_more'),
    ]

    operations = [
        migrations.CreateModel(
            name='DCRNumberSequence',
            fields=[
                (
                    'id',
                    models.BigAutoField(
                        auto_created=True,
                        primary_key=True,
                        serialize=False,
                        verbose_name='ID',
                    ),
                ),
                ('prefix', models.CharField(max_length=50, unique=True)),
                ('next_value', models.PositiveIntegerField(default=1)),
            ],
            options={
                'db_table': 'dcr_number_sequences',
            },
        ),
        migrations.RunPython(seed_dcr_sequences, migrations.RunPython.noop),
    ]
