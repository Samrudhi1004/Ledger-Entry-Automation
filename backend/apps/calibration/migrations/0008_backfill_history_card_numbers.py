from django.db import migrations


def backfill_history_card_numbers(apps, schema_editor):
    Equipment = apps.get_model('calibration', 'CalibrationEquipment')
    for equipment in Equipment.objects.filter(history_card_number='').only('id', 'equipment_id'):
        equipment.history_card_number = f'HC-{equipment.equipment_id}'
        equipment.save(update_fields=['history_card_number'])


class Migration(migrations.Migration):
    dependencies = [
        ('calibration', '0007_calibration_workflow'),
    ]

    operations = [
        migrations.RunPython(backfill_history_card_numbers, migrations.RunPython.noop),
    ]
