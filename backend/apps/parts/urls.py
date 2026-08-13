from django.urls import path
from .views import (
    PartListCreateView, PartDetailView,
    TemplateListCreateView, TemplateDetailView, TemplatePublishView, ActiveTemplateView,
    ParameterListCreateView, ParameterDetailView,
    ProcessParameterListCreateView, ProcessParameterDetailView,
)

urlpatterns = [
    # 1. Base Parts List
    path('',                                         PartListCreateView.as_view(),    name='part-list'),

    # 2. Fixed routes for Templates & Parameters (MUST COME BEFORE <path:part_number> catch-alls)
    path('templates/<int:pk>/publish/',              TemplatePublishView.as_view(),    name='template-publish'),
    path('templates/<int:pk>/',                       TemplateDetailView.as_view(),     name='template-detail'),
    path('templates/<int:template_id>/parameters/',  ParameterListCreateView.as_view(), name='parameter-list'),
    path('parameters/<int:pk>/',                     ParameterDetailView.as_view(),     name='parameter-detail'),

    # Process Parameters (Setup Approval Only)
    path('templates/<int:template_id>/process-parameters/', ProcessParameterListCreateView.as_view(), name='process-parameter-list'),
    path('process-parameters/<int:pk>/',                     ProcessParameterDetailView.as_view(),     name='process-parameter-detail'),

    # 3. Dynamic Part Routes by part_number (Greedy <path:...> catch-alls must be last)
    path('<path:part_number>/templates/',             TemplateListCreateView.as_view(), name='template-list'),
    path('<path:part_number>/template/<str:inspection_type>/', ActiveTemplateView.as_view(), name='active-template'),
    path('<path:part_number>/',                       PartDetailView.as_view(),        name='part-detail'),
]
