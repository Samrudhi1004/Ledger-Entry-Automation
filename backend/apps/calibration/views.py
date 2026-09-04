from datetime import timedelta
from pathlib import Path

from django.db import transaction
from django.http import HttpResponse
from django.db.models import Count, Q
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.utils.http import content_disposition_header
from rest_framework import generics, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.users.permissions import IsCalibrator

from .models import CalibrationEquipment, CalibrationPlanEntry, CalibrationRecord
from .serializers import (
    CalibrationEquipmentSerializer,
    CalibrationPlanEntrySerializer,
    CalibrationRecordSerializer,
    MarkEquipmentFailedSerializer,
    MarkEquipmentPassedSerializer,
)


class EquipmentListCreateView(generics.ListCreateAPIView):
    queryset = CalibrationEquipment.objects.all()
    serializer_class = CalibrationEquipmentSerializer
    permission_classes = [IsCalibrator]
    pagination_class = None

    @transaction.atomic
    def perform_create(self, serializer):
        equipment = serializer.save()
        CalibrationPlanEntry.objects.get_or_create(
            equipment=equipment,
            planned_date=equipment.next_calibration_date,
        )


class EquipmentDetailView(generics.RetrieveUpdateAPIView):
    queryset = CalibrationEquipment.objects.all()
    serializer_class = CalibrationEquipmentSerializer
    permission_classes = [IsCalibrator]


class MarkEquipmentFailedView(APIView):
    permission_classes = [IsCalibrator]

    def post(self, request, pk):
        equipment = get_object_or_404(CalibrationEquipment, pk=pk)
        serializer = MarkEquipmentFailedSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        data = serializer.validated_data
        with transaction.atomic():
            CalibrationRecord.objects.create(
                equipment=equipment,
                planned_date=equipment.next_calibration_date,
                calibration_date=data['failed_date'],
                result=CalibrationRecord.Result.FAILED,
                calibration_agency=data['calibration_agency'],
                report_number=data['report_number'],
                certificate_number=data['certificate_number'],
                traceability_certificate_number=data['traceability_certificate_number'],
                specified_size=data['specified_size'],
                calibration_details=data['calibration_details'],
                remarks=data['remarks'] or data['failure_remark'],
                recorded_by=request.user,
            )
            equipment.is_failed = True
            equipment.failed_date = data['failed_date']
            equipment.failure_remark = data['failure_remark']
            equipment.save(update_fields=['is_failed', 'failed_date', 'failure_remark', 'updated_at'])

        return Response(CalibrationEquipmentSerializer(equipment).data, status=status.HTTP_200_OK)


class MarkEquipmentPassedView(APIView):
    permission_classes = [IsCalibrator]

    def post(self, request, pk):
        equipment = get_object_or_404(CalibrationEquipment, pk=pk)
        serializer = MarkEquipmentPassedSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        data = serializer.validated_data
        passed_date = data['passed_date']
        report_file = data.pop('report_file', None)
        next_due_date = passed_date + timedelta(
            days=equipment.calibration_frequency_days
        )
        with transaction.atomic():
            CalibrationRecord.objects.create(
                equipment=equipment,
                planned_date=equipment.next_calibration_date,
                calibration_date=passed_date,
                result=CalibrationRecord.Result.PASSED,
                calibration_agency=data['calibration_agency'],
                report_number=data['report_number'],
                certificate_number=data['certificate_number'],
                traceability_certificate_number=data['traceability_certificate_number'],
                specified_size=data['specified_size'],
                calibration_details=data['calibration_details'],
                next_due_date=next_due_date,
                remarks=data['remarks'],
                report_file=report_file.read() if report_file else None,
                report_file_name=Path(report_file.name).name if report_file else '',
                report_content_type=report_file.content_type if report_file else '',
                report_file_size=report_file.size if report_file else None,
                recorded_by=request.user,
            )
            equipment.last_calibration_date = passed_date
            equipment.next_calibration_date = next_due_date
            equipment.is_failed = False
            equipment.failed_date = None
            equipment.failure_remark = ''
            equipment.save(update_fields=[
                'last_calibration_date', 'next_calibration_date', 'is_failed',
                'failed_date', 'failure_remark', 'updated_at',
            ])
            CalibrationPlanEntry.objects.get_or_create(
                equipment=equipment,
                planned_date=next_due_date,
            )

        return Response(CalibrationEquipmentSerializer(equipment).data, status=status.HTTP_200_OK)


class EquipmentHistoryView(APIView):
    permission_classes = [IsCalibrator]

    def get(self, request, pk):
        equipment = get_object_or_404(CalibrationEquipment, pk=pk)
        return Response({
            'equipment': CalibrationEquipmentSerializer(equipment).data,
            'records': CalibrationRecordSerializer(
                equipment.calibration_records.select_related('recorded_by').defer('report_file'), many=True
            ).data,
        })


class CalibrationReportDownloadView(APIView):
    permission_classes = [IsCalibrator]

    def get(self, request, pk):
        record = get_object_or_404(CalibrationRecord, pk=pk)
        if not record.report_file:
            return Response({'detail': 'No report is attached.'}, status=status.HTTP_404_NOT_FOUND)
        response = HttpResponse(bytes(record.report_file), content_type=record.report_content_type)
        response['Content-Disposition'] = content_disposition_header(True, record.report_file_name)
        response['X-Content-Type-Options'] = 'nosniff'
        return response


class CalibrationPlanView(APIView):
    permission_classes = [IsCalibrator]

    def get(self, request):
        try:
            year = int(request.query_params.get('year', timezone.localdate().year))
        except (TypeError, ValueError):
            return Response({'year': ['Enter a valid year.']}, status=status.HTTP_400_BAD_REQUEST)
        if not 2000 <= year <= 2100:
            return Response({'year': ['Year must be between 2000 and 2100.']}, status=status.HTTP_400_BAD_REQUEST)

        entries = list(CalibrationPlanEntry.objects.select_related('equipment').filter(
            planned_date__year=year
        ))
        equipment_ids = {entry.equipment_id for entry in entries}
        records_by_equipment = {}
        for record in CalibrationRecord.objects.defer('report_file').filter(
            Q(planned_date__year=year) | Q(calibration_date__year=year),
            equipment_id__in=equipment_ids,
        ):
            records_by_equipment.setdefault(record.equipment_id, []).append(record)

        rows = []
        used_record_ids = set()
        for entry in entries:
            candidates = [
                item for item in records_by_equipment.get(entry.equipment_id, [])
                if item.pk not in used_record_ids
            ]
            record = min(
                candidates,
                key=lambda item: abs((item.calibration_date - entry.planned_date).days),
                default=None,
            )
            if record:
                used_record_ids.add(record.pk)
            rows.append({
                'id': entry.pk,
                'key': f'plan-{entry.pk}',
                'equipment_pk': entry.equipment_id,
                'equipment_id': entry.equipment.equipment_id,
                'equipment_name': entry.equipment.equipment_name,
                'serial_number': entry.equipment.serial_number,
                'planned_date': entry.planned_date,
                'actual_date': record.calibration_date if record else None,
                'result': record.get_result_display() if record else 'Planned',
                'certificate_number': record.certificate_number if record else '',
                'remarks': ' · '.join(filter(None, [
                    entry.remarks,
                    record.remarks if record else '',
                ])),
            })
        return Response({'year': year, 'rows': rows})

    def post(self, request):
        serializer = CalibrationPlanEntrySerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        entry = serializer.save()
        return Response(
            CalibrationPlanEntrySerializer(entry).data,
            status=status.HTTP_201_CREATED,
        )


class CalibrationPlanEntryDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = CalibrationPlanEntry.objects.select_related('equipment')
    serializer_class = CalibrationPlanEntrySerializer
    permission_classes = [IsCalibrator]


class CalibrationSummaryView(APIView):
    permission_classes = [IsCalibrator]

    def get(self, request):
        today = timezone.localdate()
        in_seven_days = today + timedelta(days=7)
        in_thirty_days = today + timedelta(days=30)
        active = Q(is_failed=False)

        summary = CalibrationEquipment.objects.aggregate(
            total_equipment=Count('id'),
            valid_equipment=Count('id', filter=active & Q(next_calibration_date__gt=in_thirty_days)),
            due_within_30_days=Count(
                'id', filter=active & Q(next_calibration_date__range=(today, in_thirty_days))
            ),
            due_within_7_days=Count(
                'id', filter=active & Q(next_calibration_date__range=(today, in_seven_days))
            ),
            overdue_equipment=Count('id', filter=active & Q(next_calibration_date__lt=today)),
            failed_equipment=Count('id', filter=Q(is_failed=True)),
        )
        return Response(summary)
