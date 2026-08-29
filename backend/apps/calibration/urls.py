from django.urls import path

from .views import (
    CalibrationSummaryView,
    EquipmentDetailView,
    EquipmentListCreateView,
    MarkEquipmentFailedView,
    MarkEquipmentPassedView,
)


urlpatterns = [
    path('equipment/', EquipmentListCreateView.as_view(), name='calibration-equipment-list'),
    path('equipment/<int:pk>/', EquipmentDetailView.as_view(), name='calibration-equipment-detail'),
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
]
