import calendar
import random
from datetime import date
from django.core.management.base import BaseCommand
from django.db import transaction

from apps.machines.models import Machine
from apps.parts.models import Part
from apps.users.models import User
from apps.inspections.models import DailyProductionReport, DowntimeReport


class Command(BaseCommand):
    help = "Seeds random DailyProductionReport and DowntimeReport data for a given machine and month to test OEE."

    def add_arguments(self, parser):
        parser.add_argument('--machine', type=str, required=True, help="Machine code (e.g. VMC-19)")
        parser.add_argument('--month', type=int, required=True, help="Month (1-12)")
        parser.add_argument('--year', type=int, required=True, help="Year (e.g. 2026)")

    def handle(self, *args, **options):
        machine_code = options['machine']
        month = options['month']
        year = options['year']

        try:
            machine = Machine.objects.get(machine_code=machine_code)
        except Machine.DoesNotExist:
            self.stderr.write(self.style.ERROR(f"Machine '{machine_code}' does not exist."))
            return

        part = Part.objects.first()
        if not part:
            self.stderr.write(self.style.ERROR("No parts exist in the database to link to production reports."))
            return

        operator = User.objects.filter(role='operator').first() or User.objects.first()
        if not operator:
            self.stderr.write(self.style.ERROR("No users found to act as operator."))
            return

        # Figure out the shifts for this machine
        total_shifts_per_day = 3
        if machine.plant:
            if hasattr(machine.plant, 'factory') and machine.plant.factory and machine.plant.factory.total_shifts_per_day:
                total_shifts_per_day = machine.plant.factory.total_shifts_per_day
            elif machine.plant.shift_duration_hours and machine.plant.shift_duration_hours > 0:
                total_shifts_per_day = 24 // machine.plant.shift_duration_hours

        shifts_list = ['I', 'II', 'III', 'IV'][:total_shifts_per_day]

        num_days = calendar.monthrange(year, month)[1]

        self.stdout.write(f"Seeding data for {machine_code} - {month}/{year} ({num_days} days, {total_shifts_per_day} shifts/day)")

        with transaction.atomic():
            # Clear old test data for this machine/month to prevent duplicates
            DailyProductionReport.objects.filter(
                machine=machine, date__year=year, date__month=month
            ).delete()

            created_reports = 0

            for day in range(1, num_days + 1):
                report_date = date(year, month, day)
                
                # Optionally skip Sundays to be realistic? Let's skip Sundays randomly or entirely.
                if report_date.weekday() == 6:  # Sunday
                    # Let's say factory is closed on Sundays 80% of the time
                    if random.random() < 0.8:
                        continue

                for shift in shifts_list:
                    # Skip shift completely with 10% chance
                    if random.random() < 0.1:
                        continue

                    jobs_completed = random.randint(80, 150)
                    incorrect_jobs = random.randint(0, min(5, jobs_completed))

                    # Seed Rejections (CR, MR, RW) if there are incorrect jobs
                    cr_count = 0
                    mr_count = 0
                    rw_count = 0
                    if incorrect_jobs > 0:
                        cr_count = random.randint(0, incorrect_jobs)
                        mr_count = random.randint(0, incorrect_jobs - cr_count)
                        rw_count = incorrect_jobs - cr_count - mr_count

                    report = DailyProductionReport.objects.create(
                        machine=machine,
                        part=part,
                        operator=operator,
                        date=report_date,
                        shift=shift,
                        status=DailyProductionReport.Status.SUBMITTED,
                        production_target=150,
                        jobs_completed=jobs_completed,
                        correct_jobs=jobs_completed - incorrect_jobs,
                        incorrect_jobs=incorrect_jobs,
                        cr_count=cr_count,
                        mr_count=mr_count,
                        rw_count=rw_count
                    )

                    # 80% chance to have some downtime so it shows up in reports
                    if random.random() < 0.8:
                        st = random.randint(0, 15) if random.random() < 0.6 else 0
                        nl = random.randint(0, 10) if random.random() < 0.5 else 0
                        no = random.randint(0, 10) if random.random() < 0.5 else 0
                        um = random.randint(5, 30) if random.random() < 0.4 else 0  # Machine Maintenance
                        ow = random.randint(0, 5) if random.random() < 0.5 else 0
                        pf = random.randint(10, 45) if random.random() < 0.3 else 0
                        tc = random.randint(5, 20) if random.random() < 0.3 else 0  # Tool Change
                        tp = random.randint(5, 15) if random.random() < 0.2 else 0  # Tool Problem
                        rw = random.randint(5, 15) if random.random() < 0.2 else 0  # Rework downtime
                        
                        if any([st, nl, no, um, ow, pf, tc, tp, rw]):
                            total = st + nl + no + um + ow + pf + tc + tp + rw
                            DowntimeReport.objects.filter(production_report=report).update(
                                setting=st,
                                no_load=nl,
                                no_operator=no,
                                um=um,
                                inspection_wait=ow,
                                power_off=pf,
                                tool_change=tc,
                                tool_problem=tp,
                                rework=rw,
                                total_downtime=total,
                                remarks="Test downtime"
                            )
                    
                    created_reports += 1

        self.stdout.write(self.style.SUCCESS(f"Successfully generated {created_reports} production reports!"))
