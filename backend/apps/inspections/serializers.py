from rest_framework import serializers
from .models import InspectionSession


class StartInspectionSerializer(serializers.Serializer):
    part_number     = serializers.CharField()
    machine_id      = serializers.IntegerField()
    template_id     = serializers.IntegerField(required=False)
    inspection_type = serializers.CharField(required=False, default='first_piece')
    shift           = serializers.ChoiceField(choices=['A', 'B', 'C'], default='A')


class RecordMeasurementSerializer(serializers.Serializer):
    parameter_code  = serializers.CharField()
    measured_value  = serializers.FloatField()
    voice_raw_text  = serializers.CharField(required=False, default='')
    method          = serializers.ChoiceField(choices=['voice', 'manual'], default='voice')


class ReviewSerializer(serializers.Serializer):
    action = serializers.ChoiceField(choices=['approve', 'reject'])
    remark = serializers.CharField(required=False, allow_blank=True, default='')


class InspectionSessionSerializer(serializers.ModelSerializer):
    part_number  = serializers.CharField(source='part.part_number', read_only=True)
    part_name    = serializers.CharField(source='part.part_name', read_only=True)
    machine_code = serializers.CharField(source='machine.machine_code', read_only=True)
    operator_name   = serializers.CharField(source='operator.get_full_name', read_only=True)
    supervisor_name = serializers.CharField(source='supervisor.get_full_name', read_only=True)
    progress_percent = serializers.IntegerField(read_only=True)

    class Meta:
        model  = InspectionSession
        fields = [
            'session_id', 'part_number', 'part_name', 'machine_code',
            'operator_name', 'supervisor_name',
            'inspection_type', 'shift', 'status',
            'total_parameters', 'recorded_count', 'progress_percent',
            'has_ooc', 'has_critical_fail',
            'started_at', 'completed_at', 'reviewed_at',
            'supervisor_remark',
        ]
