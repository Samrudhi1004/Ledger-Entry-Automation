from django.db import migrations, models


def migrate_calibration_workflow(apps, schema_editor):
    equipment_model = apps.get_model('calibration', 'CalibrationEquipment')
    record_model = apps.get_model('calibration', 'CalibrationRecord')

    equipment_model.objects.filter(is_failed=True).update(state='rejected')
    record_model.objects.filter(result='passed').update(result='accepted')
    record_model.objects.filter(result='failed').update(result='rejected')

    for equipment in equipment_model.objects.filter(
        acceptance_criteria='', acceptable_error__gt=''
    ).iterator():
        equipment.acceptance_criteria = equipment.acceptable_error
        equipment.save(update_fields=['acceptance_criteria'])


class Migration(migrations.Migration):
    dependencies = [('calibration', '0006_calibrationplanentry_unique_equipment_calibration_plan_date')]

    operations = [
        migrations.AddField(
            model_name='calibrationequipment',
            name='state',
            field=models.CharField(
                choices=[
                    ('active', 'Active'),
                    ('rejected', 'Rejected'),
                    ('repair', 'Under Repair'),
                    ('scrapped', 'Scrapped'),
                ],
                db_index=True,
                default='active',
                max_length=12,
            ),
        ),
        migrations.AddField(
            model_name='calibrationrecord',
            name='disposition',
            field=models.CharField(
                blank=True,
                choices=[('repair', 'Under Repair'), ('scrapped', 'Scrapped')],
                max_length=10,
            ),
        ),
        migrations.AlterField(
            model_name='calibrationequipment',
            name='department',
            field=models.CharField(blank=True, default='', max_length=100),
        ),
        migrations.AlterField(
            model_name='calibrationequipment',
            name='location',
            field=models.CharField(blank=True, default='', max_length=150),
        ),
        migrations.AlterField(
            model_name='calibrationequipment',
            name='serial_number',
            field=models.CharField(blank=True, max_length=100, null=True, unique=True),
        ),
        migrations.RunPython(migrate_calibration_workflow, migrations.RunPython.noop),
        migrations.AlterField(
            model_name='calibrationrecord',
            name='result',
            field=models.CharField(
                choices=[('accepted', 'Accepted'), ('rejected', 'Rejected')],
                max_length=10,
            ),
        ),
    ]
