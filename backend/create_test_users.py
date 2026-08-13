import os
import sys
import django

sys.path.append(os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
django.setup()

from apps.users.models import User

def create_users():
    users_data = [
        # 1 Supervisor (Static)
        {
            "username": "supervisor",
            "password": "supervisor123",
            "role": User.Role.SUPERVISOR,
            "employee_id": "EMP-SUP-01",
            "first_name": "Michael",
            "last_name": "Supervisor",
            "email": "supervisor@mantri.com",
        },
        # Admin
        {
            "username": "admin",
            "password": "admin123",
            "role": User.Role.ADMIN,
            "employee_id": "EMP-ADMIN-01",
            "first_name": "Admin",
            "last_name": "Liha",
            "email": "admin@mantri.com",
        },
        # 1 Operator
        {
            "username": "operator",
            "password": "operator123",
            "role": User.Role.OPERATOR,
            "employee_id": "EMP-OP-01",
            "first_name": "John",
            "last_name": "Operator",
            "email": "operator@mantri.com",
        },
        # 1 Inspector
        {
            "username": "inspector",
            "password": "inspector123",
            "role": User.Role.QUALITY_ENGINEER,
            "employee_id": "EMP-INS-01",
            "first_name": "Sarah",
            "last_name": "Inspector",
            "email": "inspector@mantri.com",
        },
    ]

    for u in users_data:
        user = User.objects.filter(username=u["username"]).first()
        if not user:
            user = User.objects.filter(employee_id=u["employee_id"]).first()

        if not user:
            user = User(username=u["username"], employee_id=u["employee_id"])

        user.username = u["username"]
        user.employee_id = u["employee_id"]
        user.role = u["role"]
        user.first_name = u["first_name"]
        user.last_name = u["last_name"]
        user.email = u["email"]
        user.is_staff = True if u["role"] in [User.Role.ADMIN, User.Role.SUPERVISOR] else False
        user.is_superuser = True if u["role"] == User.Role.ADMIN else False
        user.set_password(u["password"])
        user.save()
        print(f"Updated/Created user: {user.username} (Role: {user.role}, Password: {u['password']})")

if __name__ == "__main__":
    create_users()
