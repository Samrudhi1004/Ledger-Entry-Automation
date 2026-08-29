from django.core.validators import MinValueValidator
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('calibration', '0001_initial'),
    ]

    operations = [
        migrations.AlterField(
            model_name='calibrationequipment',
            name='calibration_frequency_days',
            field=models.PositiveIntegerField(validators=[MinValueValidator(1)]),
        ),
    ]
