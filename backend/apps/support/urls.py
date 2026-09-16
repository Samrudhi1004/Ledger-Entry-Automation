from django.urls import path
from .views import BugReportListCreateView

urlpatterns = [
    path('bug-reports/', BugReportListCreateView.as_view(), name='bug-reports-list-create'),
]
