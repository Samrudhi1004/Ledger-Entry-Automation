from django.urls import path, include
from rest_framework.routers import SimpleRouter
from .views import (
    StartInspectionView,
    RecordMeasurementView,
    BatchMeasureView,
    CompleteInspectionView,
    SessionDetailView,
    PendingReviewView,
    ApproveRejectView,
    SessionListView,
    RejectionsListView,
    SupervisorOverrideView,
    HourlyStatusView,
    SetupStatusView,
    ClearHistoryView,
    FinalizeFirstPieceView,
    FirstPiecePDFView,
    FirstPieceStatusView,
    SetupApprovalView,
    DailyProductionReportViewSet,
)

router = SimpleRouter()
router.register('daily-production-reports', DailyProductionReportViewSet, basename='daily-production-report')

urlpatterns = [
    # Main session list
    path('', SessionListView.as_view(), name='session-list'),

    # Daily Production Reports router
    path('', include(router.urls)),

    # Inspector & Setup flow
    path('first-piece-status/',             FirstPieceStatusView.as_view(),   name='first-piece-status'),
    path('<str:session_id>/finalize/',      FinalizeFirstPieceView.as_view(), name='finalize-first-piece'),
    path('<str:session_id>/pdf/',           FirstPiecePDFView.as_view(),      name='first-piece-pdf'),

    # Supervisor flow
    path('pending/',                        PendingReviewView.as_view(),      name='pending-review'),
    path('clear-history/',                  ClearHistoryView.as_view(),       name='clear-history'),
    path('<str:session_id>/supervisor-override/', SupervisorOverrideView.as_view(), name='supervisor-override'),
    path('<str:session_id>/hourly-status/', HourlyStatusView.as_view(),      name='hourly-status'),

    # Operator flow
    path('setup-status/',                   SetupStatusView.as_view(),        name='setup-status'),
    path('setup-approval/',                 SetupApprovalView.as_view(),      name='setup-approval'),
    path('rejections/',                     RejectionsListView.as_view(),     name='rejections-list'),
    path('start/',                          StartInspectionView.as_view(),    name='inspection-start'),
    path('<str:session_id>/measure/',       RecordMeasurementView.as_view(),  name='record-measurement'),
    path('<str:session_id>/complete/',      CompleteInspectionView.as_view(), name='inspection-complete'),
    path('<str:session_id>/review/',        ApproveRejectView.as_view(),      name='approve-reject'),

    # Session detail (full MongoDB document) — wildcard route must be last
    path('<str:session_id>/batch-measure/', BatchMeasureView.as_view(),      name='batch-measure'),
    path('<str:session_id>/',              SessionDetailView.as_view(),      name='session-detail'),
]


