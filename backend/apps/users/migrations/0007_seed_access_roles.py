from django.db import migrations


def seed_roles(apps, schema_editor):
    Role = apps.get_model('users', 'AccessRole')
    groups = {
        'production': ['production.daily.view', 'production.daily.manage', 'production.downtime.view',
                       'production.downtime.manage', 'production.jh.view', 'production.jh.submit', 'production.jh.manage'],
        'quality': ['quality.live.view', 'quality.reports.view', 'quality.setup.view', 'quality.analytics.view',
                    'quality.inspections.review', 'quality.inspections.record', 'quality.machines.manage', 'quality.parts.manage',
                    'quality.templates.manage', 'quality.parameters.manage', 'calibration.view', 'calibration.manage'],
        'tasks': ['tasks.view', 'tasks.allocate', 'tasks.view_all', 'tasks.manage_all'],
        'messages': ['messages.use'],
        'document': ['document.view', 'document.view_unapproved', 'document.upload', 'document.approve',
                     'document.dcr.view', 'document.dcr.create', 'document.dcr.review', 'document.dcr.approve'],
        'development': ['development.parameters.view', 'development.parameters.manage',
                        'development.drawings.view', 'development.drawings.manage',
                        'development.control_plans.view', 'development.control_plans.manage'],
        'users': ['users.view', 'users.create', 'users.manage', 'roles.manage'],
        'other': ['purchase.view', 'store.view', 'maintenance.view', 'marketing.view',
                  'support.create', 'support.manage'],
    }
    all_permissions = set().union(*groups.values())
    production_view = {'production.daily.view', 'production.downtime.view'}
    quality_view = {'quality.live.view', 'quality.reports.view', 'quality.setup.view'}
    document_work = {'document.view_unapproved', 'document.upload', 'document.dcr.view', 'document.dcr.create'}
    defaults = {
        'admin': ('Admin', all_permissions),
        'supervisor': ('Supervisor', production_view | quality_view | document_work | {
            'production.jh.view', 'production.jh.manage', 'production.daily.manage',
            'production.downtime.manage', 'quality.analytics.view', 'quality.inspections.review',
            'quality.inspections.record',
            'quality.machines.manage', 'quality.parts.manage', 'quality.templates.manage',
            'quality.parameters.manage', 'tasks.view', 'tasks.allocate',
            'development.parameters.view', 'development.parameters.manage', 'document.dcr.review',
        }),
        'quality_engineer': ('Inspector', production_view | quality_view | {
            'quality.analytics.view', 'quality.inspections.record', 'quality.parts.manage', 'quality.templates.manage',
            'quality.parameters.manage', 'tasks.view', 'tasks.allocate',
        }),
        'calibrator': ('Calibrator', document_work | {'calibration.view', 'calibration.manage', 'document.dcr.review'}),
        'operator': ('Operator', production_view | {
            'production.daily.manage', 'production.downtime.manage', 'production.jh.view',
            'production.jh.submit', 'quality.inspections.record', 'quality.live.view',
            'quality.reports.view', 'tasks.view',
        }),
    }
    for slug, (name, permissions) in defaults.items():
        Role.objects.get_or_create(slug=slug, defaults={
            'name': name, 'permissions': sorted(permissions), 'is_system': True,
        })


class Migration(migrations.Migration):
    dependencies = [('users', '0006_accessrole_user_access_denials_user_access_grants_and_more')]
    operations = [migrations.RunPython(seed_roles, migrations.RunPython.noop)]
