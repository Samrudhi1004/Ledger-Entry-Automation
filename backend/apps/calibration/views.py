from datetime import timedelta

from django.db.models import Count, Q
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import generics, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.users.permissions import IsCalibrator

from .models import CalibrationEquipment
from .serializers import (
    CalibrationEquipmentSerializer,
    MarkEquipmentFailedSerializer,
    MarkEquipmentPassedSerializer,
)


class EquipmentListCreateView(generics.ListCreateAPIView):
    queryset = CalibrationEquipment.objects.all()
    serializer_class = CalibrationEquipmentSerializer
    permission_classes = [IsCalibrator]
    pagination_class = None


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

        equipment.is_failed = True
        equipment.failed_date = serializer.validated_data['failed_date']
        equipment.failure_remark = serializer.validated_data['failure_remark']
        equipment.save(update_fields=['is_failed', 'failed_date', 'failure_remark', 'updated_at'])

        return Response(CalibrationEquipmentSerializer(equipment).data, status=status.HTTP_200_OK)


class MarkEquipmentPassedView(APIView):
    permission_classes = [IsCalibrator]

    def post(self, request, pk):
        equipment = get_object_or_404(CalibrationEquipment, pk=pk)
        serializer = MarkEquipmentPassedSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        passed_date = serializer.validated_data['passed_date']
        equipment.last_calibration_date = passed_date
        equipment.next_calibration_date = passed_date + timedelta(
            days=equipment.calibration_frequency_days
        )
        equipment.is_failed = False
        equipment.failed_date = None
        equipment.failure_remark = ''
        equipment.save(update_fields=[
            'last_calibration_date', 'next_calibration_date', 'is_failed',
            'failed_date', 'failure_remark', 'updated_at',
        ])

        return Response(CalibrationEquipmentSerializer(equipment).data, status=status.HTTP_200_OK)


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
