from django.urls import path
from .views import (
    InspectionReportView,
    OOCTrendView,
    MachinePerformanceView,
    OperatorStatsView,
    ParameterOOCRateView,
)

urlpatterns = [
    path('report/',                              InspectionReportView.as_view(),   name='inspection-report'),
    path('ooc-trend/',                           OOCTrendView.as_view(),           name='ooc-trend'),
    path('machine/<int:machine_id>/performance/', MachinePerformanceView.as_view(), name='machine-performance'),
    path('operator/<int:operator_id>/stats/',    OperatorStatsView.as_view(),      name='operator-stats'),
    path('parameters/ooc-rate/',                 ParameterOOCRateView.as_view(),   name='parameter-ooc-rate'),
]
