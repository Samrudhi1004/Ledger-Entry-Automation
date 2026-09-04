from rest_framework import serializers
from .models import InspectionSession, DailyProductionReport, DowntimeReport


class StartInspectionSerializer(serializers.Serializer):
    part_number       = serializers.CharField()
    machine_id        = serializers.IntegerField()
    template_id       = serializers.IntegerField(required=False)
    inspection_type   = serializers.CharField(required=False, default='first_piece')
    shift             = serializers.ChoiceField(choices=['A', 'B', 'C'], default='A')
    trial_number      = serializers.IntegerField(required=False, default=1)
    hourly_slot       = serializers.IntegerField(required=False, default=1)
    parent_session_id = serializers.CharField(required=False, allow_null=True, allow_blank=True)


class RecordMeasurementSerializer(serializers.Serializer):
    parameter_code  = serializers.CharField()
    measured_value  = serializers.FloatField(required=False, allow_null=True)
    voice_raw_text  = serializers.CharField(required=False, allow_blank=True, default='')
    method          = serializers.CharField(required=False, default='voice')
    hourly_slot     = serializers.IntegerField(required=False, allow_null=True, default=None)
    inspection_type = serializers.CharField(required=False, allow_null=True, allow_blank=True, default=None)
    idempotency_key = serializers.CharField(required=False, allow_null=True, allow_blank=True, default=None)


class SingleMeasurementSerializer(serializers.Serializer):
    """One field entry within a batch-measure submission."""
    parameter_code = serializers.CharField()
    measured_value = serializers.FloatField(required=False, allow_null=True)
    voice_raw_text = serializers.CharField(required=False, allow_blank=True, default='')
    method         = serializers.CharField(required=False, default='form')


class BatchMeasureSerializer(serializers.Serializer):
    """
    Accepts all measurements for one physical piece in a single POST.

    The inspector fills every parameter on the form screen and taps
    'Submit Piece' — this serializer validates the entire payload before
    the view hands it off to InspectionService for field-level validation.
    """
    measurements = SingleMeasurementSerializer(many=True)


class ReviewSerializer(serializers.Serializer):
    action              = serializers.ChoiceField(choices=['approve', 'reject'])
    remark              = serializers.CharField(required=False, allow_blank=True, default='')
    rejected_parameters = serializers.ListField(
        child=serializers.CharField(),
        required=False,
        default=list,
    )


class InspectionSessionSerializer(serializers.ModelSerializer):
    part_number  = serializers.CharField(source='part.part_number', read_only=True)
    part_name    = serializers.CharField(source='part.part_name', read_only=True)
    machine_code = serializers.CharField(source='machine.machine_code', read_only=True)
    operator_name   = serializers.SerializerMethodField()
    supervisor_name = serializers.SerializerMethodField()
    inspector_name  = serializers.SerializerMethodField()
    template_id     = serializers.SerializerMethodField()
    template_name   = serializers.SerializerMethodField()
    template_version = serializers.SerializerMethodField()
    progress_percent = serializers.IntegerField(read_only=True)
    hourly_slot     = serializers.IntegerField(source='hourly_unlocked_slot', read_only=True)
    rejected_parameters = serializers.SerializerMethodField()
    shift_duration_hours = serializers.IntegerField(source='machine.plant.shift_duration_hours', read_only=True)
    total_break_mins = serializers.IntegerField(source='machine.plant.total_break_mins', read_only=True)

    class Meta:
        model  = InspectionSession
        fields = [
            'session_id', 'part_number', 'part_name', 'machine_code',
            'operator_name', 'supervisor_name', 'inspector_name',
            'template_id', 'template_name', 'template_version',
            'inspection_type', 'shift', 'status', 'shift_duration_hours', 'total_break_mins',
            'trial_number', 'hourly_unlocked_slot', 'hourly_slot', 'parent_session', 'rejection_reason',
            'total_parameters', 'recorded_count', 'progress_percent',
            'has_ooc', 'has_critical_fail', 'is_setup_approved', 'is_first_piece_finalized',
            'started_at', 'completed_at', 'reviewed_at', 'finalized_at',
            'supervisor_remark', 'rejected_parameters',
        ]

    def get_operator_name(self, obj):
        if obj.operator:
            name = obj.operator.get_full_name().strip()
            return name if name else obj.operator.username
        return '—'

    def get_supervisor_name(self, obj):
        if obj.supervisor:
            name = obj.supervisor.get_full_name().strip()
            return name if name else obj.supervisor.username
        return '—'

    def get_template_id(self, obj):
        if obj.template_id:
            return obj.template_id
        return getattr(obj, 'template_id', None)

    def get_template_name(self, obj):
        if obj.template and obj.template.name and obj.template.name.strip():
            return obj.template.name.strip()
        val = getattr(obj, 'template_name', None)
        if val and str(val).strip():
            return str(val).strip()
        try:
            from apps.parts.models import InspectionTemplate
            t = InspectionTemplate.objects.filter(
                part=obj.part,
                inspection_type=obj.inspection_type,
                is_active=True,
            ).order_by('-version').first()
            if t and t.name and t.name.strip():
                return t.name.strip()
        except Exception:
            pass
        return None

    def get_template_version(self, obj):
        if obj.template:
            return obj.template.version
        return getattr(obj, 'template_version', None)

    def get_inspector_name(self, obj):
        if obj.finalized_by:
            name = obj.finalized_by.get_full_name().strip()
            return name if name else obj.finalized_by.username
        elif obj.supervisor:
            name = obj.supervisor.get_full_name().strip()
            return name if name else obj.supervisor.username
        return 'Inspector'

    def get_rejected_parameters(self, obj):
        from .services import InspectionService
        doc = InspectionService().get_session_document(str(obj.session_id))
        if doc:
            rej = doc.get('rejected_parameters', [])
            if rej and len(rej) > 0:
                return rej
            measurements = doc.get('measurements', [])
            if measurements:
                latest_trial = max(m.get('trial_number', 1) for m in measurements)
                return list(set([
                    m['parameter_code'] for m in measurements
                    if m.get('trial_number', 1) == latest_trial and m.get('status') == 'out_of_spec'
                ]))
        return []


class DailyProductionReportSerializer(serializers.ModelSerializer):
    machine_code = serializers.CharField(source='machine.machine_code', read_only=True)
    machine_name = serializers.CharField(source='machine.name', read_only=True)
    part_number  = serializers.CharField(source='part.part_number', read_only=True)
    part_name    = serializers.CharField(source='part.part_name', read_only=True)
    operator_name = serializers.SerializerMethodField()

    class Meta:
        model = DailyProductionReport
        fields = [
            'id', 'report_id', 'date', 'machine', 'machine_code', 'machine_name',
            'part', 'part_number', 'part_name', 'operation', 'shift',
            'operator', 'operator_name',
            'production_target', 'jobs_completed', 'correct_jobs', 'incorrect_jobs',
            'cr_count', 'mr_count', 'rw_count', 'remarks',
            'achievement_percentage', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'report_id', 'achievement_percentage', 'created_at', 'updated_at']
        extra_kwargs = {'operator': {'required': False, 'allow_null': True}}

    def get_operator_name(self, obj):
        if obj.operator:
            name = obj.operator.get_full_name().strip()
            return name if name else obj.operator.username
        return '—'

    def validate(self, attrs):
        jobs_completed = attrs.get('jobs_completed', 0)
        correct_jobs = attrs.get('correct_jobs', 0)
        incorrect_jobs = attrs.get('incorrect_jobs', 0)
        cr_count = attrs.get('cr_count', 0)
        mr_count = attrs.get('mr_count', 0)
        rw_count = attrs.get('rw_count', 0)

        # Validation Rule 1: Jobs Completed = Correct Jobs + Incorrect Jobs
        if jobs_completed != (correct_jobs + incorrect_jobs):
            raise serializers.ValidationError({
                "jobs_completed": f"Jobs Completed ({jobs_completed}) must equal Correct Jobs ({correct_jobs}) + Incorrect Jobs ({incorrect_jobs})."
            })

        # Validation Rule 2: Incorrect Jobs = CR + MR + RW
        if incorrect_jobs != (cr_count + mr_count + rw_count):
            raise serializers.ValidationError({
                "incorrect_jobs": f"Incorrect Jobs ({incorrect_jobs}) must equal CR ({cr_count}) + MR ({mr_count}) + RW ({rw_count})."
            })

        return attrs


class DowntimeReportSerializer(serializers.ModelSerializer):
    production_report_id = serializers.IntegerField(source='production_report.id', read_only=True)
    date = serializers.DateField(source='production_report.date', read_only=True)
    shift = serializers.CharField(source='production_report.shift', read_only=True)
    machine = serializers.CharField(source='production_report.machine.machine_code', read_only=True)
    machine_code = serializers.CharField(source='production_report.machine.machine_code', read_only=True)
    machine_name = serializers.CharField(source='production_report.machine.name', read_only=True)
    operator = serializers.SerializerMethodField()
    operator_name = serializers.SerializerMethodField()
    target = serializers.IntegerField(source='production_report.production_target', read_only=True)
    produced = serializers.IntegerField(source='production_report.jobs_completed', read_only=True)
    accepted_actual = serializers.IntegerField(source='production_report.correct_jobs', read_only=True)
    cr = serializers.IntegerField(source='production_report.cr_count', read_only=True)
    mr = serializers.IntegerField(source='production_report.mr_count', read_only=True)
    rw = serializers.IntegerField(source='production_report.rw_count', read_only=True)
    cycle_time_mins = serializers.SerializerMethodField()

    class Meta:
        model = DowntimeReport
        fields = [
            'id', 'report_id', 'production_report', 'production_report_id',
            'date', 'shift', 'machine', 'machine_code', 'machine_name',
            'operator', 'operator_name',
            'target', 'produced', 'accepted_actual', 'cr', 'mr', 'rw',
            'no_load', 'no_operator', 'um', 'setting', 'inspection_wait',
            'tool_change', 'power_off', 'rework', 'tool_problem',
            'total_downtime', 'expected_downtime', 'remarks', 'status', 'cycle_time_mins',
            'created_by', 'created_at', 'updated_at', 'completed_at'
        ]
        read_only_fields = [
            'id', 'report_id', 'total_downtime', 'created_at', 'updated_at', 'completed_at'
        ]

    def get_operator(self, obj):
        if obj.production_report and obj.production_report.operator:
            name = obj.production_report.operator.get_full_name().strip()
            return name if name else obj.production_report.operator.username
        return '—'

    def get_operator_name(self, obj):
        return self.get_operator(obj)

    def get_cycle_time_mins(self, obj):
        from apps.parts.models import InspectionTemplate
        prod = obj.production_report
        if not prod:
            return 0.0
        template = InspectionTemplate.objects.filter(
            machine=prod.machine,
            part=prod.part,
            part_operation_name=prod.operation
        ).first()
        if not template:
            template = InspectionTemplate.objects.filter(
                machine=prod.machine,
                part=prod.part
            ).first()
        if template:
            return float(template.cycle_time_mins)
        return 0.0

    def validate(self, attrs):
        fields = [
            'no_load', 'no_operator', 'um', 'setting',
            'inspection_wait', 'tool_change', 'power_off',
            'rework', 'tool_problem'
        ]
        for field in fields:
            val = attrs.get(field)
            if val is not None:
                if not isinstance(val, int) or val < 0:
                    raise serializers.ValidationError({
                        field: f"{field} must be a non-negative integer."
                    })
        return attrs


