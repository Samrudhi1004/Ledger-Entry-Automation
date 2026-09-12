import os
import django
from datetime import date

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from apps.machines.models import Machine, Plant, Factory
from apps.parts.models import Part, InspectionTemplate
from apps.inspections.models import DailyProductionReport, DowntimeReport
from apps.users.models import User

def run_test():
    print("--- Setting up test data ---")
    
    # 1. Setup User
    operator, _ = User.objects.get_or_create(username='test_op', defaults={'role': 'operator', 'is_active': True})
    
    # 2. Setup Factory, Plant & Machine
    factory, _ = Factory.objects.get_or_create(name='Test Factory')
    plant, _ = Plant.objects.get_or_create(name='Test Plant', defaults={'shift_duration_hours': 8, 'total_break_mins': 60, 'factory': factory})
    machine, _ = Machine.objects.get_or_create(machine_code='TEST-M1', defaults={'name': 'Test Machine', 'plant': plant})
    
    # 3. Setup Part & Template (Operation)
    part, _ = Part.objects.get_or_create(part_number='TEST-PART-1', defaults={'part_name': 'Test Part', 'machine': machine})
    template, _ = InspectionTemplate.objects.get_or_create(
        part=part, 
        name='Drilling',
        defaults={'cycle_time_mins': 10, 'is_active': True}
    )
    
    # 4. Create DailyProductionReport
    # Given: Available Time = (8 * 60) - 60 = 420 mins.
    # Target = 420 / 10 = 42.
    # Let's say produced = 35.
    
    prod_report, created = DailyProductionReport.objects.get_or_create(
        machine=machine,
        part=part,
        operation='Drilling',
        date=date.today(),
        shift='I',
        operator=operator,
        defaults={
            'jobs_completed': 35,
            'correct_jobs': 35,
            'incorrect_jobs': 0
        }
    )
    
    # We force the jobs_completed if it already existed
    if not created:
        prod_report.jobs_completed = 35
        prod_report.save()

    print(f"Production Report ID: {prod_report.id}")
    print(f"Auto-Calculated Target: {prod_report.production_target} (Expected: 42)")
    assert prod_report.production_target == 42, f"Target is {prod_report.production_target}, expected 42"
    
    # 5. Check DowntimeReport
    dt_report, _ = DowntimeReport.objects.get_or_create(production_report=prod_report)
    dt_report.save() # trigger save manually to ensure it runs our logic
    
    # Target (42) - Produced (35) = 7. Expected downtime = 7 * 10 = 70 mins.
    print(f"Auto-Calculated Expected Downtime: {dt_report.expected_downtime} (Expected: 70)")
    assert dt_report.expected_downtime == 70, f"Expected downtime is {dt_report.expected_downtime}, expected 70"
    
    print("--- All tests passed successfully! ---")

if __name__ == '__main__':
    run_test()
