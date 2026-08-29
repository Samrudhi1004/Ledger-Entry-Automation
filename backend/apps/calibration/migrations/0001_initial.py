from django.db import migrations, models


class Migration(migrations.Migration):
    initial = True

    dependencies = []

    operations = [
        migrations.CreateModel(
            name='CalibrationEquipment',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('equipment_id', models.CharField(max_length=50, unique=True)),
                ('equipment_name', models.CharField(max_length=150)),
                ('equipment_type', models.CharField(max_length=100)),
                ('serial_number', models.CharField(max_length=100, unique=True)),
                ('department', models.CharField(max_length=100)),
                ('location', models.CharField(max_length=150)),
                ('calibration_frequency_days', models.PositiveIntegerField()),
                ('last_calibration_date', models.DateField()),
                ('next_calibration_date', models.DateField(db_index=True)),
                ('remarks', models.TextField(blank=True)),
                ('is_failed', models.BooleanField(db_index=True, default=False)),
                ('failed_date', models.DateField(blank=True, null=True)),
                ('failure_remark', models.TextField(blank=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
            ],
            options={
                'db_table': 'calibration_equipment',
                'ordering': ['next_calibration_date', 'equipment_id'],
            },
        ),
    ]

