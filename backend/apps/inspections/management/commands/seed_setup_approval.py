
from django.core.management.base import BaseCommand
from apps.inspections.models import SetupApproval  # type: ignore
from apps.parts.models import InspectionTemplate   # type: ignore
from apps.machines.models import Machine           # type: ignore
from django.contrib.auth import get_user_model
from django.utils import timezone

User = get_user_model()

class Command(BaseCommand):
    help = 'Seeds a dummy Setup Approval session for testing the live F02 view'

    def handle(self, *args, **options):
        # 1. Grab first machine and template
        machine = Machine.objects.first()
        template = InspectionTemplate.objects.filter(inspection_type='F02').first()
        if not template:
            template = InspectionTemplate.objects.first()
        
        inspector = User.objects.first()

        if not machine or not template:
            self.stdout.write(self.style.ERROR('No machines or templates found to seed setup approval!'))
            return

        # Clear existing approvals so we don't have a giant mess of same-date records
        SetupApproval.objects.all().delete()
        
        part_number = template.part.part_number if hasattr(template, 'part') and template.part else 'TEST-PART-01'

        for day_offset in [0, 1, 2, 3, 4]:
            target_date = timezone.now() - timezone.timedelta(days=day_offset)
            
            # Vary measurements slightly per day
            entries = [
                {"parameter_code": "PR1", "parameter_name": "SPINDLE SPEED", "trial_1": str(1200 + day_offset), "trial_2": str(1205 + day_offset), "trial_3": str(1198 + day_offset)},
                {"parameter_code": "PR2", "parameter_name": "FEED RATE", "trial_1": "0.15", "trial_2": "0.15", "trial_3": "0.16"},
                {"parameter_code": "L1", "parameter_name": "OUTER DIAMETER", "trial_1": f"12.0{1 + day_offset}", "trial_2": f"12.0{2 + day_offset}", "trial_3": f"12.0{day_offset}"},
                {"parameter_code": "L2", "parameter_name": "INNER DIAMETER", "trial_1": f"5.0{1 + day_offset}", "trial_2": f"5.00", "trial_3": f"4.9{9 - day_offset}"}
            ]

            shifts = ['I', 'II', 'III']
            inspectors = ['Samruddhi Bartakke', 'Amit Kumar', 'Priya Singh']
            
            shift_val = shifts[day_offset % 3]
            insp_name = inspectors[day_offset % 3]
            
            setup = SetupApproval.objects.create(
                template=template,
                machine=machine,
                part_number=part_number,
                inspector=inspector,
                inspector_name=insp_name,
                status='FINALIZED PASSED',
                process_param_entries=entries,
                submitted_at=target_date,
            )
            # Add shift to document manually if the model doesn't support it strictly in kwargs, actually SetupApproval schema is somewhat flexible or we can just append to extra fields. Wait, SetupApproval doesn't have a 'shift' field natively in MongoDB unless added. I will just rely on the existing schema but add shift as an attribute.
            setup.shift = shift_val
            setup.save()

        self.stdout.write(self.style.SUCCESS(f'Successfully created Setup Approval session: {setup.id}'))
        self.stdout.write(self.style.SUCCESS(f'Machine: {machine.machine_code} | Part: {part_number} | Template: {template.id}'))
        self.stdout.write(self.style.SUCCESS('You can now view this on the Admin Dashboard for today!'))
