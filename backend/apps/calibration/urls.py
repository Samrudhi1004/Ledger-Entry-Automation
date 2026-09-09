from django.urls import path

from .views import (
    CalibrationHistoryPdfView,
    CalibrationSummaryView,
    CalibrationPlanView,
    CalibrationPlanPdfView,
    CalibrationPlanEntryDetailView,
    CalibrationReportDownloadView,
    EquipmentDetailView,
    EquipmentListCreateView,
    EquipmentHistoryView,
    RecordCalibrationResultView,
    SetCalibrationDispositionView,
)


urlpatterns = [
    path('equipment/', EquipmentListCreateView.as_view(), name='calibration-equipment-list'),
    path('equipment/<int:pk>/', EquipmentDetailView.as_view(), name='calibration-equipment-detail'),
    path('equipment/<int:pk>/history/', EquipmentHistoryView.as_view(), name='calibration-equipment-history'),
    path('equipment/<int:pk>/history/pdf/', CalibrationHistoryPdfView.as_view(), name='calibration-equipment-history-pdf'),
    path('equipment/<int:pk>/record-result/', RecordCalibrationResultView.as_view(), name='calibration-equipment-record-result'),
    path('equipment/<int:pk>/disposition/', SetCalibrationDispositionView.as_view(), name='calibration-equipment-disposition'),
    path('summary/', CalibrationSummaryView.as_view(), name='calibration-summary'),
    path('plan/', CalibrationPlanView.as_view(), name='calibration-plan'),
    path('plan/pdf/', CalibrationPlanPdfView.as_view(), name='calibration-plan-pdf'),
    path('plan/<int:pk>/', CalibrationPlanEntryDetailView.as_view(), name='calibration-plan-detail'),
    path('records/<int:pk>/report/', CalibrationReportDownloadView.as_view(), name='calibration-report-download'),
]
