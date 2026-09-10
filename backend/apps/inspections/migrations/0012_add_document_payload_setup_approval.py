# Generated 2026-09-08 — MongoDB → PostgreSQL migration: Step 1 models

import django.db.models.deletion
import uuid
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('inspections', '0011_alter_dailyproductionreport_created_at_and_more'),
        ('machines', '0001_initial'),
        ('parts', '0001_initial'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        # ── 1. Add document_payload JSONB column to InspectionSession ────────
        migrations.AddField(
            model_name='inspectionsession',
            name='document_payload',
            field=models.JSONField(
                default=dict,
                help_text=(
                    'Full inspection document: measurements[], parameter_summary[], '
                    'process_parameter_summary[], process_param_entries[], etc. '
                    'Replaces the MongoDB inspection_records document.'
                ),
            ),
        ),

        # ── 2. Create SetupApproval table ────────────────────────────────────
        migrations.CreateModel(
            name='SetupApproval',
            fields=[
                ('id', models.UUIDField(
                    default=uuid.uuid4,
                    editable=False,
                    primary_key=True,
                    serialize=False,
                )),
                ('part_number', models.CharField(blank=True, max_length=100)),
                ('inspector_name', models.CharField(blank=True, max_length=255)),
                ('process_param_entries', models.JSONField(default=list)),
                ('status', models.CharField(default='submitted', max_length=50)),
                ('submitted_at', models.DateTimeField(auto_now_add=True)),
                ('template', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='setup_approvals',
                    to='parts.inspectiontemplate',
                )),
                ('machine', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='setup_approvals',
                    to='machines.machine',
                )),
                ('inspector', models.ForeignKey(
                    blank=True,
                    null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name='setup_approvals',
                    to=settings.AUTH_USER_MODEL,
                )),
            ],
            options={
                'db_table': 'inspection_setup_approvals',
                'ordering': ['-submitted_at'],
            },
        ),

        # ── 3. Index on (template, machine, submitted_at) ────────────────────
        migrations.AddIndex(
            model_name='setupapproval',
            index=models.Index(
                fields=['template', 'machine', 'submitted_at'],
                name='setup_appr_templat_machine_idx',
            ),
        ),
    ]
