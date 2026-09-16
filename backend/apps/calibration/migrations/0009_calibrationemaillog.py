from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [('calibration', '0008_backfill_history_card_numbers')]

    operations = [
        migrations.CreateModel(
            name='CalibrationEmailLog',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('key', models.CharField(max_length=180, unique=True)),
                ('sent_at', models.DateTimeField(auto_now_add=True)),
            ],
            options={'db_table': 'calibration_email_logs'},
        ),
    ]
