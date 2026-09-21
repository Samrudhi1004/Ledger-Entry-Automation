import os
import django
import sys
import random
from datetime import date, timedelta

# Set up Django environment
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from apps.inspections.models import DailyProductionReport, DowntimeReport
from apps.machines.models import Machine
from apps.users.models import User
from apps.parts.models import Part

def seed_oee_data():
    print("Seeding OEE Data for BAL-01 - September 2026...")
    
    # 1. Get required foreign keys
    machine = Machine.objects.filter(machine_code="BAL-01").first()
    if not machine:
        machine = Machine.objects.first()
        if not machine:
            print("Error: No machines found in DB. Run normal seed first.")
            return

    operator = User.objects.filter(role='operator').first()
    if not operator:
        operator = User.objects.first()

    part = Part.objects.first()
    if not part:
        print("Error: No parts found in DB.")
        return
        
    print(f"Using Machine: {machine.machine_code}, Operator: {operator.username}, Part: {part.part_number}")

    # 2. Clear existing test data for Sept 2026 for this machine to avoid duplicates
    DailyProductionReport.objects.filter(
        machine=machine, 
        date__year=2026, 
        date__month=9
    ).delete()

    # 3. Create 15 days of data for September 2026
    start_date = date(2026, 9, 1)
    
    for i in range(15):
        current_date = start_date + timedelta(days=i)
        
        # Skip Sundays
        if current_date.weekday() == 6:
            continue
            
        jobs = random.randint(80, 120)
        rejections = random.randint(0, 5)
        
        # Create Production Report
        report = DailyProductionReport.objects.create(
            date=current_date,
            machine=machine,
            part=part,
            operation="Balancing",
            shift="I",
            operator=operator,
            jobs_completed=jobs,
            correct_jobs=jobs - rejections,
            incorrect_jobs=rejections,
            cr_count=rejections,
            status=DailyProductionReport.Status.SUBMITTED
        )
        
        # Update corresponding DowntimeReport (created automatically by save())
        # We fetch it and add random downtime losses
        downtime = report.downtime_report
        downtime.setting = random.randint(0, 15)
        downtime.no_load = random.randint(0, 10) if random.random() > 0.5 else 0
        downtime.power_off = random.randint(0, 20) if random.random() > 0.8 else 0
        downtime.status = DowntimeReport.Status.COMPLETED
        downtime.save()

        print(f"Created data for {current_date}: {jobs} jobs, {rejections} rejections, {downtime.setting + downtime.no_load + downtime.power_off} mins downtime.")

    print("\n✅ Successfully seeded OEE data for September 2026!")

if __name__ == '__main__':
    seed_oee_data()
