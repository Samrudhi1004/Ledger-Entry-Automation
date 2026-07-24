from django.urls import path
from .views import LiveStatusView, ShiftSummaryView

urlpatterns = [
    path('live/',          LiveStatusView.as_view(),   name='dashboard-live'),
    path('shift-summary/', ShiftSummaryView.as_view(), name='shift-summary'),
]
