from django.db import migrations


COMMON_ACCESS = {
    'messages.use',
    'document.view', 'document.view_unapproved', 'document.upload',
    'document.approve', 'document.dcr.view', 'document.dcr.create',
    'document.dcr.review', 'document.dcr.approve',
    'tasks.view', 'tasks.allocate', 'tasks.view_all', 'tasks.manage_all',
    'support.create', 'support.manage',
}


def add_common_access_to_roles(apps, schema_editor):
    AccessRole = apps.get_model('users', 'AccessRole')
    for role in AccessRole.objects.all():
        role.permissions = sorted(set(role.permissions or ()) | COMMON_ACCESS)
        role.save(update_fields=['permissions'])


class Migration(migrations.Migration):
    dependencies = [('users', '0009_inspector_setup_read')]
    operations = [migrations.RunPython(add_common_access_to_roles, migrations.RunPython.noop)]
