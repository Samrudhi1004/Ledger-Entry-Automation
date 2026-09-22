from django.urls import path, include
from rest_framework.routers import SimpleRouter
from .views import (
    PartListCreateView, PartDetailView,
    TemplateListCreateView, TemplateDetailView, TemplatePublishView, ActiveTemplateView,
    TemplateSubmitReviewView, TemplateReviewActionView, TemplateApproveActionView,
    TemplateChangeRequestListCreateView, TemplateChangeRequestReviewView, TemplateChangeRequestApproveView,
    ParameterListCreateView, ParameterDetailView, AllParameterListView,
    ProcessParameterListCreateView, ProcessParameterDetailView, AllProcessParameterListView,
    DrawingViewSet, ControlPlanViewSet
)

router = SimpleRouter()
router.register(r'drawings', DrawingViewSet, basename='drawing')
router.register(r'control-plans', ControlPlanViewSet, basename='control-plan')

urlpatterns = [
    # 1. Base Parts List
    path('',                                         PartListCreateView.as_view(),    name='part-list'),

    # Router endpoints
    path('', include(router.urls)),

    # 2. Fixed routes for Templates & Parameters (MUST COME BEFORE <path:part_number> catch-alls)
    path('templates/<int:pk>/publish/',              TemplatePublishView.as_view(),        name='template-publish'),
    path('templates/<int:pk>/submit-review/',        TemplateSubmitReviewView.as_view(),   name='template-submit-review'),
    path('templates/<int:pk>/review/',               TemplateReviewActionView.as_view(),   name='template-review'),
    path('templates/<int:pk>/approve/',              TemplateApproveActionView.as_view(),  name='template-approve'),
    path('templates/<int:template_id>/change-requests/', TemplateChangeRequestListCreateView.as_view(), name='template-dcr-list-create'),
    path('change-requests/<int:pk>/review/',         TemplateChangeRequestReviewView.as_view(), name='template-dcr-review'),
    path('change-requests/<int:pk>/approve/',        TemplateChangeRequestApproveView.as_view(), name='template-dcr-approve'),
    path('templates/<int:pk>/',                      TemplateDetailView.as_view(),         name='template-detail'),
    path('parameters/all/',                          AllParameterListView.as_view(),    name='parameter-all'),
    path('templates/<int:template_id>/parameters/',  ParameterListCreateView.as_view(), name='parameter-list'),
    path('parameters/<int:pk>/',                     ParameterDetailView.as_view(),     name='parameter-detail'),

    # Process Parameters (Setup Approval Only)
    path('process-parameters/all/',                          AllProcessParameterListView.as_view(), name='process-parameter-all'),
    path('templates/<int:template_id>/process-parameters/', ProcessParameterListCreateView.as_view(), name='process-parameter-list'),
    path('process-parameters/<int:pk>/',                     ProcessParameterDetailView.as_view(),     name='process-parameter-detail'),

    # 3. Dynamic Part Routes by part_number (Greedy <path:...> catch-alls must be last)
    path('<path:part_number>/templates/',             TemplateListCreateView.as_view(), name='template-list'),
    path('<path:part_number>/template/<str:inspection_type>/', ActiveTemplateView.as_view(), name='active-template'),
    path('<path:part_number>/',                       PartDetailView.as_view(),        name='part-detail'),
]

