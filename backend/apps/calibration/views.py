from datetime import timedelta
from pathlib import Path

from django.conf import settings
from django.db import transaction
from django.http import HttpResponse
from django.db.models import Count, F, OuterRef, Q, Subquery
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.utils.http import content_disposition_header
from rest_framework import generics, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.users.permissions import IsCalibratorOrAdmin
from apps.machines.models import Factory

from .models import CalibrationEquipment, CalibrationPlanEntry, CalibrationRecord
from .pdf_generator import generate_calibration_plan_pdf, generate_history_card_pdf
from .serializers import (
    CalibrationEquipmentSerializer,
    CalibrationPlanEntrySerializer,
    CalibrationRecordSerializer,
    CalibrationDispositionSerializer,
    CalibrationResultSerializer,
)


def _equipment_queryset():
    today = timezone.localdate()
    latest = CalibrationRecord.objects.filter(
        equipment=OuterRef('pk'),
        planned_date__year=today.year,
        planned_date__lte=today,
    ).order_by(
        '-calibration_date', '-created_at'
    )
    return CalibrationEquipment.objects.annotate(
        latest_result=Subquery(latest.values('result')[:1]),
        latest_planned_date=Subquery(latest.values('planned_date')[:1]),
        latest_calibration_date=Subquery(latest.values('calibration_date')[:1]),
    )


def _company_details():
    company = Factory.objects.filter(is_active=True).order_by('id').first()
    if not company:
        return {}
    return {
        'name': company.name,
        'code': company.code,
        'address': company.address,
        'location': company.location,
        'contact_email': company.contact_email,
        'phone': company.phone,
        'gstin': company.gstin,
        'industry_type': company.industry_type,
    }


def _plan_year(request):
    try:
        year = int(request.query_params.get('year', timezone.localdate().year))
    except (TypeError, ValueError):
        return None, Response({'year': ['Enter a valid year.']}, status=status.HTTP_400_BAD_REQUEST)
    if not 2000 <= year <= 2100:
        return None, Response({'year': ['Year must be between 2000 and 2100.']}, status=status.HTTP_400_BAD_REQUEST)
    return year, None


def _calibration_plan_rows(year, search='', result='', month='', due=''):
    entries_query = CalibrationPlanEntry.objects.select_related('equipment').filter(
        planned_date__year=year
    )
    if search:
        entries_query = entries_query.filter(
            Q(equipment__equipment_id__icontains=search)
            | Q(equipment__equipment_name__icontains=search)
            | Q(equipment__equipment_type__icontains=search)
            | Q(equipment__history_card_number__icontains=search)
        )
    if str(month).isdigit() and 1 <= int(month) <= 12:
        entries_query = entries_query.filter(planned_date__month=int(month))
    entries = list(entries_query)
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
        candidates = [item for item in candidates if item.planned_date == entry.planned_date]
        record = max(candidates, key=lambda item: item.created_at, default=None)
        if record:
            used_record_ids.add(record.pk)
        rows.append({
            'id': entry.pk,
            'key': f'plan-{entry.pk}',
            'equipment_pk': entry.equipment_id,
            'equipment_id': entry.equipment.equipment_id,
            'equipment_name': entry.equipment.equipment_name,
            'planned_date': entry.planned_date,
            'actual_date': record.calibration_date if record else None,
            'result': record.get_result_display() if record else 'Planned',
            'certificate_number': record.certificate_number if record else '',
            'plan_remarks': entry.remarks,
            'record_remarks': record.remarks if record else '',
        })
    if result:
        rows = [row for row in rows if row['result'].lower() == result.lower()]
    if due:
        today = timezone.localdate()
        def matches_due_window(row):
            if row['result'].lower() != 'planned' or not row['planned_date']:
                return False
            days = (row['planned_date'] - today).days
            return {
                'overdue': days < 0,
                'today': days == 0,
                'due3': 0 < days <= 3,
                'due15': 0 < days <= 15,
                'due30': 0 < days <= 30,
            }.get(due, True)
        rows = [row for row in rows if matches_due_window(row)]
    return rows


class EquipmentListCreateView(generics.ListCreateAPIView):
    serializer_class = CalibrationEquipmentSerializer
    permission_classes = [IsCalibratorOrAdmin]
    pagination_class = None

    def get_queryset(self):
        return _equipment_queryset()

    @transaction.atomic
    def perform_create(self, serializer):
        equipment = serializer.save()
        CalibrationPlanEntry.objects.get_or_create(
            equipment=equipment,
            planned_date=equipment.next_calibration_date,
        )


class EquipmentDetailView(generics.RetrieveUpdateAPIView):
    queryset = _equipment_queryset()
    serializer_class = CalibrationEquipmentSerializer
    permission_classes = [IsCalibratorOrAdmin]


class RecordCalibrationResultView(APIView):
    permission_classes = [IsCalibratorOrAdmin]

    def post(self, request, pk):
        equipment = get_object_or_404(CalibrationEquipment, pk=pk)
        serializer = CalibrationResultSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        data = serializer.validated_data
        calibration_date = data['calibration_date']
        if calibration_date < equipment.last_calibration_date:
            return Response(
                {'calibration_date': ['Calibration date cannot be before the equipment last calibration date.']},
                status=status.HTTP_400_BAD_REQUEST,
            )
        report_file = data.pop('report_file', None)
        accepted = data['result'] == CalibrationRecord.Result.ACCEPTED
        with transaction.atomic():
            equipment = CalibrationEquipment.objects.select_for_update().get(pk=pk)
            if equipment.state == CalibrationEquipment.State.SCRAPPED:
                return Response({'detail': 'Scrapped equipment cannot be recalibrated.'}, status=status.HTTP_400_BAD_REQUEST)
            if equipment.state == CalibrationEquipment.State.REJECTED:
                return Response({'detail': 'Choose repair or scrap before recalibrating.'}, status=status.HTTP_400_BAD_REQUEST)
            if calibration_date < equipment.last_calibration_date:
                return Response(
                    {'calibration_date': ['Calibration date cannot be before the equipment last calibration date.']},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            next_due_date = (
                calibration_date + timedelta(days=equipment.calibration_frequency_days)
                if accepted else None
            )
            if next_due_date and next_due_date.year > 2100:
                return Response(
                    {'calibration_date': ['Calibration result produces a due date after 2100.']},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            planned_date = equipment.next_calibration_date
            if equipment.state == CalibrationEquipment.State.REPAIR:
                rejected_record = equipment.calibration_records.filter(
                    result=CalibrationRecord.Result.REJECTED,
                ).order_by('-created_at').first()
                if rejected_record:
                    planned_date = rejected_record.planned_date
            duplicate = CalibrationRecord.objects.filter(
                equipment=equipment,
                calibration_date=calibration_date,
                result=data['result'],
            ).first()
            if duplicate:
                return Response(
                    CalibrationEquipmentSerializer(_equipment_queryset().get(pk=equipment.pk)).data,
                    status=status.HTTP_200_OK,
                )
            CalibrationRecord.objects.create(
                equipment=equipment,
                planned_date=planned_date,
                calibration_date=calibration_date,
                result=data['result'],
                calibration_agency=data['calibration_agency'],
                certificate_number=data['certificate_number'],
                traceability_certificate_number=data['traceability_certificate_number'],
                calibration_details=data['calibration_details'],
                next_due_date=next_due_date,
                remarks=data['remarks'],
                report_file=report_file.read() if report_file else None,
                report_file_name=Path(report_file.name).name if report_file else '',
                report_content_type=report_file.content_type if report_file else '',
                report_file_size=report_file.size if report_file else None,
                recorded_by=request.user,
            )
            equipment.state = (
                CalibrationEquipment.State.ACTIVE if accepted
                else CalibrationEquipment.State.REJECTED
            )
            equipment.is_failed = not accepted
            equipment.failed_date = None if accepted else calibration_date
            equipment.failure_remark = '' if accepted else data['remarks']
            if accepted:
                equipment.last_calibration_date = calibration_date
                equipment.next_calibration_date = next_due_date
            equipment.save(update_fields=[
                'state', 'is_failed', 'failed_date', 'failure_remark',
                *(['last_calibration_date', 'next_calibration_date'] if accepted else []),
                'updated_at',
            ])
            if accepted:
                CalibrationPlanEntry.objects.get_or_create(
                    equipment=equipment,
                    planned_date=next_due_date,
                )

        equipment = _equipment_queryset().get(pk=equipment.pk)
        return Response(CalibrationEquipmentSerializer(equipment).data, status=status.HTTP_200_OK)


class SetCalibrationDispositionView(APIView):
    permission_classes = [IsCalibratorOrAdmin]

    def post(self, request, pk):
        serializer = CalibrationDispositionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        disposition = serializer.validated_data['disposition']

        with transaction.atomic():
            equipment = get_object_or_404(
                CalibrationEquipment.objects.select_for_update(), pk=pk,
            )
            if equipment.state != CalibrationEquipment.State.REJECTED:
                return Response({'detail': 'Only rejected equipment needs a disposition.'}, status=status.HTTP_400_BAD_REQUEST)
            record = equipment.calibration_records.filter(
                result=CalibrationRecord.Result.REJECTED,
                disposition='',
            ).first()
            if not record:
                return Response({'detail': 'No rejected calibration is awaiting disposition.'}, status=status.HTTP_400_BAD_REQUEST)
            record.disposition = disposition
            record.save(update_fields=['disposition'])
            equipment.state = disposition
            equipment.is_failed = True
            equipment.save(update_fields=['state', 'is_failed', 'updated_at'])

        equipment = _equipment_queryset().get(pk=equipment.pk)
        return Response(CalibrationEquipmentSerializer(equipment).data, status=status.HTTP_200_OK)


class EquipmentHistoryView(APIView):
    permission_classes = [IsCalibratorOrAdmin]

    def get(self, request, pk):
        equipment = get_object_or_404(CalibrationEquipment, pk=pk)
        return Response({
            'equipment': CalibrationEquipmentSerializer(equipment).data,
            'records': CalibrationRecordSerializer(
                equipment.calibration_records.select_related('recorded_by').defer('report_file'), many=True
            ).data,
            'company': _company_details(),
        })


class CalibrationHistoryPdfView(APIView):
    permission_classes = [IsCalibratorOrAdmin]

    def get(self, request, pk):
        equipment = get_object_or_404(CalibrationEquipment, pk=pk)
        records = list(
            equipment.calibration_records.select_related('recorded_by').defer('report_file')
        )
        response = HttpResponse(
            generate_history_card_pdf(
                equipment, records, _company_details(), settings.FRONTEND_URL,
            ),
            content_type='application/pdf',
        )
        filename = equipment.equipment_id.replace('/', '-')
        response['Content-Disposition'] = content_disposition_header(
            True, f'Gauge_History_Card_{filename}.pdf'
        )
        return response


class CalibrationReportDownloadView(APIView):
    permission_classes = [IsCalibratorOrAdmin]

    def get(self, request, pk):
        record = get_object_or_404(CalibrationRecord, pk=pk)
        if not record.report_file:
            return Response({'detail': 'No certificate or evidence is attached.'}, status=status.HTTP_404_NOT_FOUND)
        response = HttpResponse(bytes(record.report_file), content_type=record.report_content_type)
        response['Content-Disposition'] = content_disposition_header(
            request.query_params.get('download') == '1', record.report_file_name
        )
        response['X-Content-Type-Options'] = 'nosniff'
        return response


class CalibrationPlanView(APIView):
    permission_classes = [IsCalibratorOrAdmin]

    def get(self, request):
        year, error = _plan_year(request)
        if error:
            return error
        search = request.query_params.get('search', '').strip()
        result = request.query_params.get('result', '').strip()
        return Response({
            'year': year,
            'rows': _calibration_plan_rows(
                year, search, result, request.query_params.get('month', ''),
                request.query_params.get('due', ''),
            ),
            'company': _company_details(),
        })

    def post(self, request):
        serializer = CalibrationPlanEntrySerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        with transaction.atomic():
            entry = serializer.save()
            equipment = CalibrationEquipment.objects.select_for_update().get(pk=entry.equipment_id)
            if equipment.state == CalibrationEquipment.State.ACTIVE and entry.planned_date < equipment.next_calibration_date:
                equipment.next_calibration_date = entry.planned_date
                equipment.save(update_fields=['next_calibration_date', 'updated_at'])
        return Response(
            CalibrationPlanEntrySerializer(entry).data,
            status=status.HTTP_201_CREATED,
        )


class CalibrationPlanPdfView(APIView):
    permission_classes = [IsCalibratorOrAdmin]

    def get(self, request):
        year, error = _plan_year(request)
        if error:
            return error
        response = HttpResponse(
            generate_calibration_plan_pdf(
                year,
                _calibration_plan_rows(
                    year,
                    request.query_params.get('search', '').strip(),
                    request.query_params.get('result', '').strip(),
                    request.query_params.get('month', ''),
                    request.query_params.get('due', ''),
                ),
                _company_details(),
            ),
            content_type='application/pdf',
        )
        response['Content-Disposition'] = content_disposition_header(
            True, f'Calibration_Plan_{year}.pdf'
        )
        return response


class CalibrationPlanEntryDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = CalibrationPlanEntry.objects.select_related('equipment')
    serializer_class = CalibrationPlanEntrySerializer
    permission_classes = [IsCalibratorOrAdmin]

    @transaction.atomic
    def perform_update(self, serializer):
        previous_date = serializer.instance.planned_date
        entry = serializer.save()
        equipment = CalibrationEquipment.objects.select_for_update().get(pk=entry.equipment_id)
        if previous_date == equipment.next_calibration_date:
            equipment.next_calibration_date = entry.planned_date
            equipment.save(update_fields=['next_calibration_date', 'updated_at'])

    @transaction.atomic
    def perform_destroy(self, instance):
        equipment = CalibrationEquipment.objects.select_for_update().get(pk=instance.equipment_id)
        was_current = instance.planned_date == equipment.next_calibration_date
        instance.delete()
        if was_current:
            replacement = equipment.calibration_plan_entries.filter(
                planned_date__gte=timezone.localdate(),
            ).order_by('planned_date').first()
            if replacement:
                equipment.next_calibration_date = replacement.planned_date
                equipment.save(update_fields=['next_calibration_date', 'updated_at'])


class CalibrationSummaryView(APIView):
    permission_classes = [IsCalibratorOrAdmin]

    def get(self, request):
        today = timezone.localdate()
        in_seven_days = today + timedelta(days=7)
        in_thirty_days = today + timedelta(days=30)
        active = Q(state=CalibrationEquipment.State.ACTIVE)

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
            failed_equipment=Count('id', filter=Q(state=CalibrationEquipment.State.REJECTED)),
            repair_equipment=Count('id', filter=Q(state=CalibrationEquipment.State.REPAIR)),
            scrapped_equipment=Count('id', filter=Q(state=CalibrationEquipment.State.SCRAPPED)),
        )
        due_plan_equipment = CalibrationPlanEntry.objects.filter(
            planned_date__year=today.year,
            planned_date__lte=today,
        ).exclude(
            equipment__state=CalibrationEquipment.State.SCRAPPED,
        ).values('equipment_id').distinct().count()
        calibrated_on_time = CalibrationRecord.objects.filter(
            planned_date__year=today.year,
            planned_date__lte=today,
            calibration_date__lte=F('planned_date'),
            result=CalibrationRecord.Result.ACCEPTED,
        ).exclude(
            equipment__state=CalibrationEquipment.State.SCRAPPED,
        ).values('equipment_id').distinct().count()
        summary['calibrated_on_time'] = calibrated_on_time
        summary['compliance_percentage'] = round(
            calibrated_on_time * 100 / due_plan_equipment, 1
        ) if due_plan_equipment else 100.0
        return Response(summary)
