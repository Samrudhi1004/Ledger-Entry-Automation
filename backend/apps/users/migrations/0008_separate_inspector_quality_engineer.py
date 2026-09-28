from django.db import migrations


def separate_roles(apps, schema_editor):
    AccessRole = apps.get_model('users', 'AccessRole')

    quality_engineer = AccessRole.objects.filter(slug='quality_engineer').first()
    if quality_engineer:
        quality_engineer.name = 'Quality Engineer'
        quality_engineer.save(update_fields=['name'])

    # Inspectors use the mobile first-piece/JH workflow.  Quality Engineer
    # keeps the existing laptop quality setup, analytics, and management access.
    AccessRole.objects.update_or_create(
        slug='inspector',
        defaults={
            'name': 'Inspector',
            'permissions': sorted({
                'production.jh.view',
                'production.jh.submit',
                'quality.inspections.record',
                'quality.reports.view',
                'quality.setup.view',
                'tasks.view',
            }),
            'is_system': True,
        },
    )


class Migration(migrations.Migration):
    dependencies = [('users', '0007_seed_access_roles')]
    operations = [migrations.RunPython(separate_roles, migrations.RunPython.noop)]
