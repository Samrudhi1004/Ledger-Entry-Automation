from django.urls import path
from .views import (
    StartInspectionView,
    RecordMeasurementView,
    CompleteInspectionView,
    SessionDetailView,
    PendingReviewView,
    ApproveRejectView,
    SessionListView,
)

urlpatterns = [
    # Supervisor flow
    path('pending/',                        PendingReviewView.as_view(),      name='pending-review'),

    # Operator flow
    path('start/',                          StartInspectionView.as_view(),    name='inspection-start'),
    path('<str:session_id>/measure/',       RecordMeasurementView.as_view(),  name='record-measurement'),
    path('<str:session_id>/complete/',      CompleteInspectionView.as_view(), name='inspection-complete'),
    path('<str:session_id>/review/',        ApproveRejectView.as_view(),      name='approve-reject'),

    # Session detail (full MongoDB document) — wildcard route must be last
    path('<str:session_id>/',              SessionDetailView.as_view(),      name='session-detail'),

    # Session list
    path('',                               SessionListView.as_view(),        name='session-list'),
]
