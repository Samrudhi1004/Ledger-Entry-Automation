from django.utils import timezone
from rest_framework import serializers

from .models import CalibrationEquipment


class CalibrationEquipmentSerializer(serializers.ModelSerializer):
    days_remaining = serializers.IntegerField(read_only=True, allow_null=True)
    status = serializers.CharField(source='calibration_status', read_only=True)

    class Meta:
        model = CalibrationEquipment
        fields = [
            'id', 'equipment_id', 'equipment_name', 'equipment_type',
            'serial_number', 'department', 'location',
            'calibration_frequency_days', 'last_calibration_date',
            'next_calibration_date', 'days_remaining', 'status', 'remarks',
            'is_failed', 'failed_date', 'failure_remark',
            'created_at', 'updated_at',
        ]
        read_only_fields = [
            'is_failed', 'failed_date', 'failure_remark',
            'created_at', 'updated_at',
        ]

    def validate(self, attrs):
        last_date = attrs.get('last_calibration_date', getattr(self.instance, 'last_calibration_date', None))
        next_date = attrs.get('next_calibration_date', getattr(self.instance, 'next_calibration_date', None))
        if last_date and next_date and next_date <= last_date:
            raise serializers.ValidationError({
                'next_calibration_date': 'Next calibration date must be after the last calibration date.'
            })
        return attrs


class MarkEquipmentFailedSerializer(serializers.Serializer):
    failed_date = serializers.DateField(required=False, default=timezone.localdate)
    failure_remark = serializers.CharField(required=False, allow_blank=True, default='')

    def validate_failed_date(self, value):
        if value > timezone.localdate():
            raise serializers.ValidationError('Failed date cannot be in the future.')
        return value


class MarkEquipmentPassedSerializer(serializers.Serializer):
    passed_date = serializers.DateField(required=False, default=timezone.localdate)

    def validate_passed_date(self, value):
        if value > timezone.localdate():
            raise serializers.ValidationError('Passed date cannot be in the future.')
        return value
