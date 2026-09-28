from django.db import migrations


def add_setup_read_permission(apps, schema_editor):
    AccessRole = apps.get_model('users', 'AccessRole')
    role = AccessRole.objects.filter(slug='inspector').first()
    if role:
        role.permissions = sorted(set(role.permissions or []) | {'quality.setup.view'})
        role.save(update_fields=['permissions'])


class Migration(migrations.Migration):
    dependencies = [('users', '0008_separate_inspector_quality_engineer')]
    operations = [migrations.RunPython(add_setup_read_permission, migrations.RunPython.noop)]
