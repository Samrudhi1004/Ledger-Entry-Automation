from pathlib import Path

from django.utils import timezone
from rest_framework import serializers

from .models import CalibrationEquipment, CalibrationPlanEntry, CalibrationRecord


class CalibrationEquipmentSerializer(serializers.ModelSerializer):
    days_remaining = serializers.IntegerField(read_only=True, allow_null=True)
    status = serializers.CharField(source='calibration_status', read_only=True)

    class Meta:
        model = CalibrationEquipment
        fields = [
            'id', 'equipment_id', 'equipment_name', 'equipment_type',
            'serial_number', 'manufacturer', 'model_number', 'range_size',
            'least_count', 'acceptable_error', 'acceptance_criteria',
            'history_card_number', 'department', 'location',
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
    calibration_agency = serializers.CharField(required=False, allow_blank=True, default='')
    report_number = serializers.CharField(required=False, allow_blank=True, default='')
    certificate_number = serializers.CharField(required=False, allow_blank=True, default='')
    traceability_certificate_number = serializers.CharField(required=False, allow_blank=True, default='')
    specified_size = serializers.CharField(required=False, allow_blank=True, default='')
    calibration_details = serializers.CharField(required=False, allow_blank=True, default='')
    remarks = serializers.CharField(required=False, allow_blank=True, default='')

    def validate_failed_date(self, value):
        if value > timezone.localdate():
            raise serializers.ValidationError('Failed date cannot be in the future.')
        return value


class MarkEquipmentPassedSerializer(serializers.Serializer):
    passed_date = serializers.DateField(required=False, default=timezone.localdate)
    calibration_agency = serializers.CharField(required=False, allow_blank=True, default='')
    report_number = serializers.CharField(required=False, allow_blank=True, default='')
    certificate_number = serializers.CharField(required=False, allow_blank=True, default='')
    traceability_certificate_number = serializers.CharField(required=False, allow_blank=True, default='')
    specified_size = serializers.CharField(required=False, allow_blank=True, default='')
    calibration_details = serializers.CharField(required=False, allow_blank=True, default='')
    remarks = serializers.CharField(required=False, allow_blank=True, default='')
    report_file = serializers.FileField(required=False, write_only=True)

    def validate_passed_date(self, value):
        if value > timezone.localdate():
            raise serializers.ValidationError('Passed date cannot be in the future.')
        return value

    def validate_report_file(self, value):
        allowed_types = {
            '.pdf': 'application/pdf',
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.png': 'image/png',
        }
        signatures = {
            '.pdf': b'%PDF-',
            '.jpg': b'\xff\xd8\xff',
            '.jpeg': b'\xff\xd8\xff',
            '.png': b'\x89PNG\r\n\x1a\n',
        }
        extension = Path(value.name).suffix.lower()
        header = value.read(8)
        value.seek(0)
        if (
            extension not in allowed_types
            or value.content_type != allowed_types[extension]
            or not header.startswith(signatures[extension])
        ):
            raise serializers.ValidationError('Upload a PDF, JPG, or PNG calibration report.')
        if value.size > 10 * 1024 * 1024:
            raise serializers.ValidationError('Calibration report must be 10 MB or smaller.')
        return value


class CalibrationRecordSerializer(serializers.ModelSerializer):
    recorded_by_name = serializers.CharField(source='recorded_by.username', read_only=True)
    has_report = serializers.SerializerMethodField()

    def get_has_report(self, obj):
        return obj.report_file_size is not None

    class Meta:
        model = CalibrationRecord
        fields = [
            'id', 'planned_date', 'calibration_date', 'result',
            'calibration_agency', 'report_number', 'certificate_number',
            'traceability_certificate_number', 'specified_size',
            'calibration_details', 'next_due_date', 'remarks',
            'has_report', 'report_file_name', 'report_file_size',
            'recorded_by_name', 'created_at',
        ]


class CalibrationPlanEntrySerializer(serializers.ModelSerializer):
    equipment_id = serializers.CharField(source='equipment.equipment_id', read_only=True)
    equipment_name = serializers.CharField(source='equipment.equipment_name', read_only=True)
    serial_number = serializers.CharField(source='equipment.serial_number', read_only=True)

    class Meta:
        model = CalibrationPlanEntry
        fields = [
            'id', 'equipment', 'equipment_id', 'equipment_name',
            'serial_number', 'planned_date', 'remarks',
        ]

    def validate(self, attrs):
        equipment = attrs.get('equipment', getattr(self.instance, 'equipment', None))
        planned_date = attrs.get('planned_date', getattr(self.instance, 'planned_date', None))
        if equipment and planned_date:
            if not 2000 <= planned_date.year <= 2100:
                raise serializers.ValidationError({
                    'planned_date': 'Plan year must be between 2000 and 2100.'
                })
            existing = CalibrationPlanEntry.objects.filter(
                equipment=equipment,
                planned_date=planned_date,
            )
            if self.instance:
                existing = existing.exclude(pk=self.instance.pk)
            if existing.exists():
                raise serializers.ValidationError({
                    'equipment': 'This equipment is already planned for that date.'
                })
        return attrs
