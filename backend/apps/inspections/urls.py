from django.urls import path
from .views import (
    StartInspectionView,
    RecordMeasurementView,
    CompleteInspectionView,
    SessionDetailView,
    PendingReviewView,
    ApproveRejectView,
    SessionListView,
    RejectionsListView,
    SupervisorOverrideView,
    HourlyStatusView,
)

urlpatterns = [
    # Supervisor flow
    path('pending/',                        PendingReviewView.as_view(),      name='pending-review'),
    path('<str:session_id>/supervisor-override/', SupervisorOverrideView.as_view(), name='supervisor-override'),
    path('<str:session_id>/hourly-status/', HourlyStatusView.as_view(),      name='hourly-status'),

    # Operator flow
    path('rejections/',                     RejectionsListView.as_view(),     name='rejections-list'),
    path('start/',                          StartInspectionView.as_view(),    name='inspection-start'),
    path('<str:session_id>/measure/',       RecordMeasurementView.as_view(),  name='record-measurement'),
    path('<str:session_id>/complete/',      CompleteInspectionView.as_view(), name='inspection-complete'),
    path('<str:session_id>/review/',        ApproveRejectView.as_view(),      name='approve-reject'),

    # Session detail (full MongoDB document) — wildcard route must be last
    path('<str:session_id>/',              SessionDetailView.as_view(),      name='session-detail'),

    # Session list
    path('',                               SessionListView.as_view(),        name='session-list'),
]
