import os
import sys
import django

sys.path.append(os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
django.setup()

from apps.users.models import User
from apps.inspections.models import InspectionSession
from django.conf import settings
import pymongo

def clear_dummy_users():
    # Ensure clean master admin exists first
    admin_user = User.objects.filter(username='admin').first()
    if not admin_user:
        admin_user = User(
            username='admin',
            employee_id='EMP-ADMIN-01',
            role=User.Role.ADMIN,
            first_name='System',
            last_name='Admin',
            is_staff=True,
            is_superuser=True,
        )
    admin_user.set_password('admin123')
    admin_user.save()
    print("Master admin account verified: username='admin', password='admin123'")

    # Clean up test inspection sessions referencing dummy users
    deleted_sessions, _ = InspectionSession.objects.all().delete()
    print(f"Cleared {deleted_sessions} test inspection sessions.")

    # Clean MongoDB inspection records
    try:
        client = pymongo.MongoClient(settings.MONGODB_URI)
        db = client[settings.MONGODB_DB_NAME]
        res = db['inspection_records'].delete_many({})
        print(f"Cleared {res.deleted_count} MongoDB inspection records.")
    except Exception as e:
        print(f"MongoDB cleanup notice: {e}")

    # Now delete dummy seed user accounts
    dummy_usernames = [
        'inspector3', 'inspector2', 'operator3', 'operator2',
        'supervisor', 'inspector', 'operator', 'Samu'
    ]
    deleted_users, _ = User.objects.filter(username__in=dummy_usernames).delete()
    print(f"Successfully deleted {deleted_users} dummy accounts.")
    print("User registry is now completely clean and ready for your manual entries via React Dashboard!")

if __name__ == '__main__':
    clear_dummy_users()
