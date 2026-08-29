from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('users', '0002_alter_user_role'),
    ]

    operations = [
        migrations.AlterField(
            model_name='user',
            name='role',
            field=models.CharField(
                choices=[
                    ('operator', 'Operator'),
                    ('supervisor', 'Supervisor'),
                    ('quality_engineer', 'Inspector'),
                    ('calibrator', 'Calibrator'),
                    ('admin', 'Admin'),
                ],
                default='operator',
                max_length=20,
            ),
        ),
    ]
