from django.core.management.base import BaseCommand
from apps.inspections.models import SetupApproval  # type: ignore
from apps.parts.models import InspectionTemplate   # type: ignore
from apps.machines.models import Machine           # type: ignore
from django.contrib.auth import get_user_model
from django.utils import timezone

User = get_user_model()

class Command(BaseCommand):
    help = 'Seeds a dummy Setup Approval session for testing the live F02 view across past days'

    def handle(self, *args, **options):
        # 1. Grab all machines and one template
        machines = Machine.objects.all()
        template = InspectionTemplate.objects.filter(inspection_type='F02').first()
        if not template:
            template = InspectionTemplate.objects.first()
        
        inspector = User.objects.first()

        if not machines.exists() or not template:
            self.stdout.write(self.style.ERROR('No machines or templates found to seed setup approval!'))
            return

        # 3. Create the mock documents
        part_number = template.part.part_number if hasattr(template, 'part') and template.part else 'TEST-PART-01'
        
        # Clear existing approvals so we don't have a giant mess of same-date records
        SetupApproval.objects.all().delete()
        
        for machine in machines:
            for day_offset in [0, 1, 2, 3, 4]:
                target_date = timezone.now() - timezone.timedelta(days=day_offset)
                
                # Dynamically mock entries based on the template's actual parameters and vary by day
                entries = []
                for pp in template.process_parameters.all():
                    entries.append({
                        "parameter_code": pp.parameter_code,
                        "parameter_name": pp.parameter_name,
                        "trial_1": str(1200 + day_offset),
                        "trial_2": str(1205 + day_offset),
                        "trial_3": str(1200 + day_offset),
                    })
                    
                for p in template.parameters.all():
                    entries.append({
                        "parameter_code": p.parameter_code,
                        "parameter_name": p.parameter_name,
                        "trial_1": f"10.0{5 + day_offset}",
                        "trial_2": f"10.0{2 + day_offset}",
                        "trial_3": f"10.0{0 + day_offset}",
                    })

                # Alternate shifts and inspectors for realistic dummy data
                shifts = ['I', 'II', 'III']
                inspectors = ['Samruddhi Bartakke', 'Amit Kumar', 'Priya Singh']
                
                shift_val = shifts[day_offset % 3]
                insp_name = inspectors[day_offset % 3]

                setup = SetupApproval.objects.create(
                    template=template,
                    machine=machine,
                    part_number=part_number,
                    shift=shift_val,
                    inspector=inspector,
                    inspector_name=insp_name,
                    status='FINALIZED PASSED',
                    process_param_entries=entries,
                )
                # Force update the submitted_at to bypass auto_now_add
                SetupApproval.objects.filter(id=setup.id).update(submitted_at=target_date)
                
            self.stdout.write(self.style.SUCCESS(f'Created Setup Approvals for Machine: {machine.machine_code} (Past 5 days)'))
