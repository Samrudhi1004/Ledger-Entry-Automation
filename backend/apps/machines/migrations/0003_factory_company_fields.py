# Migration for Factory company detail fields

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('machines', '0002_alter_machine_plant'),
    ]

    operations = [
        migrations.AddField(
            model_name='factory',
            name='address',
            field=models.TextField(blank=True, default=''),
        ),
        migrations.AddField(
            model_name='factory',
            name='contact_email',
            field=models.EmailField(blank=True, default='', max_length=254),
        ),
        migrations.AddField(
            model_name='factory',
            name='gstin',
            field=models.CharField(blank=True, default='', max_length=30),
        ),
        migrations.AddField(
            model_name='factory',
            name='industry_type',
            field=models.CharField(blank=True, default='Precision Component Manufacturing', max_length=100),
        ),
        migrations.AddField(
            model_name='factory',
            name='phone',
            field=models.CharField(blank=True, default='', max_length=30),
        ),
    ]
