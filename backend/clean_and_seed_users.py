import os
import sys
import django

sys.path.append(os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
django.setup()

from apps.users.models import User
from apps.inspections.models import InspectionSession, DailyProductionReport

ALLOWED_USERNAMES = ["admin", "supervisor", "calibrator", "inspector", "operator"]

ACCOUNTS = [
    {
        "username": "admin",
        "password": "admin123",
        "role": User.Role.ADMIN,
        "employee_id": "EMP-ADMIN-01",
        "first_name": "Admin",
        "last_name": "User",
        "email": "admin@mantrimetallics.com",
        "is_staff": True,
        "is_superuser": True,
    },
    {
        "username": "supervisor",
        "password": "supervisor123",
        "role": User.Role.SUPERVISOR,
        "employee_id": "EMP-SUP-01",
        "first_name": "Plant",
        "last_name": "Supervisor",
        "email": "supervisor@mantrimetallics.com",
        "is_staff": True,
        "is_superuser": False,
    },
    {
        "username": "calibrator",
        "password": "calibrator123",
        "role": User.Role.CALIBRATOR,
        "employee_id": "EMP-CAL-01",
        "first_name": "Gauge",
        "last_name": "Calibrator",
        "email": "calibrator@mantrimetallics.com",
        "is_staff": False,
        "is_superuser": False,
    },
    {
        "username": "inspector",
        "password": "inspector123",
        "role": User.Role.QUALITY_ENGINEER,
        "employee_id": "EMP-INS-01",
        "first_name": "Quality",
        "last_name": "Inspector",
        "email": "inspector@mantrimetallics.com",
        "is_staff": False,
        "is_superuser": False,
    },
    {
        "username": "operator",
        "password": "operator123",
        "role": User.Role.OPERATOR,
        "employee_id": "EMP-OP-01",
        "first_name": "Machine",
        "last_name": "Operator",
        "email": "operator@mantrimetallics.com",
        "is_staff": False,
        "is_superuser": False,
    },
]

def cleanup_and_seed():
    target_users = {}
    for acc in ACCOUNTS:
        user, created = User.objects.get_or_create(username=acc["username"])
        user.employee_id = acc["employee_id"]
        user.role = acc["role"]
        user.first_name = acc["first_name"]
        user.last_name = acc["last_name"]
        user.email = acc["email"]
        user.is_active = True
        user.is_staff = acc["is_staff"]
        user.is_superuser = acc["is_superuser"]
        user.set_password(acc["password"])
        user.save()
        target_users[acc["username"]] = user

        action = "Created" if created else "Updated/Reset"
        print(f"[{action}] Username: {user.username} | Role: {user.role} | Password: {acc['password']}")

    op_user = target_users["operator"]
    ins_user = target_users["inspector"]
    sup_user = target_users["supervisor"]

    extra_users = User.objects.exclude(username__in=ALLOWED_USERNAMES)
    for extra in extra_users:
        # Re-assign InspectionSession references
        InspectionSession.objects.filter(operator=extra).update(operator=op_user)
        InspectionSession.objects.filter(finalized_by=extra).update(finalized_by=ins_user)
        InspectionSession.objects.filter(supervisor=extra).update(supervisor=sup_user)
        
        # Re-assign DailyProductionReport references
        DailyProductionReport.objects.filter(operator=extra).update(operator=op_user)

    # Now safely delete extra users
    deleted_count, _ = extra_users.delete()
    print(f"\nSUCCESS: Cleaned up {deleted_count} extraneous user accounts from database.")
    print("Database now contains ONLY the 5 required standard user accounts!")

if __name__ == "__main__":
    cleanup_and_seed()
