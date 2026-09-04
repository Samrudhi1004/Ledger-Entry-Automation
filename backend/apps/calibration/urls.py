from django.urls import path

from .views import (
    CalibrationSummaryView,
    CalibrationPlanView,
    CalibrationPlanEntryDetailView,
    CalibrationReportDownloadView,
    EquipmentDetailView,
    EquipmentListCreateView,
    EquipmentHistoryView,
    MarkEquipmentFailedView,
    MarkEquipmentPassedView,
)


urlpatterns = [
    path('equipment/', EquipmentListCreateView.as_view(), name='calibration-equipment-list'),
    path('equipment/<int:pk>/', EquipmentDetailView.as_view(), name='calibration-equipment-detail'),
    path('equipment/<int:pk>/history/', EquipmentHistoryView.as_view(), name='calibration-equipment-history'),
    path(
        'equipment/<int:pk>/mark-failed/',
        MarkEquipmentFailedView.as_view(),
        name='calibration-equipment-mark-failed',
    ),
    path(
        'equipment/<int:pk>/mark-passed/',
        MarkEquipmentPassedView.as_view(),
        name='calibration-equipment-mark-passed',
    ),
    path('summary/', CalibrationSummaryView.as_view(), name='calibration-summary'),
    path('plan/', CalibrationPlanView.as_view(), name='calibration-plan'),
    path('plan/<int:pk>/', CalibrationPlanEntryDetailView.as_view(), name='calibration-plan-detail'),
    path('records/<int:pk>/report/', CalibrationReportDownloadView.as_view(), name='calibration-report-download'),
]
