import os
import sys
import django
from datetime import date

# Initialize Django environment
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from apps.users.models import User
from apps.machines.models import Machine
from apps.parts.models import Part
from apps.inspections.models import DailyProductionReport, DowntimeReport

def create_fresh_pending_downtime_test():
    today_date = date.today()
    print(f"=== Creating Fresh Test Production Entry for Today ({today_date}) [Shift B] ===")

    operator = User.objects.filter(role='operator').first() or User.objects.first()
    machine = Machine.objects.filter(machine_code='VMC-01').first() or Machine.objects.first()
    part = Part.objects.first()

    if not machine or not part:
        print("[ERROR] Machine or Part not found.")
        return

    # 1. Create Daily Production Report for Today (Shift B)
    prod_report, created = DailyProductionReport.objects.get_or_create(
        date=today_date,
        shift='B',
        machine=machine,
        defaults={
            'part': part,
            'operator': operator,
            'operation': 'OP-20 Milling',
            'production_target': 400,
            'jobs_completed': 380,
            'correct_jobs': 370,
            'incorrect_jobs': 10,
            'cr_count': 4,
            'mr_count': 3,
            'rw_count': 3,
            'status': 'SUBMITTED',
            'remarks': 'Testing Shift B Downtime Entry'
        }
    )
    if not created:
        prod_report.status = 'SUBMITTED'
        prod_report.save()

    print(f"[OK] Production Report created for Machine {machine.machine_code} (Shift B) on {today_date}")

    # 2. Reset Downtime Report to PENDING with 0 values for interactive UI test
    downtime_obj, d_created = DowntimeReport.objects.get_or_create(
        production_report=prod_report,
        defaults={
            'no_load': 0,
            'no_operator': 0,
            'um': 0,
            'setting': 0,
            'inspection_wait': 0,
            'tool_change': 0,
            'power_off': 0,
            'rework': 0,
            'tool_problem': 0,
            'remarks': '',
            'status': DowntimeReport.Status.PENDING,
            'created_by': operator
        }
    )

    if not d_created:
        downtime_obj.no_load = 0
        downtime_obj.no_operator = 0
        downtime_obj.setting = 0
        downtime_obj.inspection_wait = 0
        downtime_obj.tool_change = 0
        downtime_obj.power_off = 0
        downtime_obj.rework = 0
        downtime_obj.tool_problem = 0
        downtime_obj.remarks = ''
        downtime_obj.status = DowntimeReport.Status.PENDING
        downtime_obj.save()

    print(f"[OK] Downtime Report reset to PENDING status for interactive browser testing!")
    print("\n[READY TO TEST IN BROWSER]")
    print(f"1. Open http://localhost:5173/reports/downtime")
    print(f"2. Select Date: {today_date} and Shift: Shift B")
    print(f"3. Type downtime numbers for Machine VMC-01")
    print(f"4. Click 'SUBMIT DOWNTIME REPORT'")
    print(f"5. Verify: Row locks to 'Submitted', no double save popups, and auto-switches to Date-Wise History!")

if __name__ == '__main__':
    create_fresh_pending_downtime_test()
