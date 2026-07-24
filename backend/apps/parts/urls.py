from django.urls import path
from .views import (
    PartListCreateView, PartDetailView,
    TemplateListCreateView, ActiveTemplateView,
    ParameterListCreateView, ParameterDetailView,
)

urlpatterns = [
    # Parts
    path('',                                         PartListCreateView.as_view(),    name='part-list'),
    path('<str:part_number>/',                        PartDetailView.as_view(),        name='part-detail'),

    # Templates for a part
    path('<str:part_number>/templates/',              TemplateListCreateView.as_view(), name='template-list'),

    # Active template for Flutter (pre-inspection load)
    path('<str:part_number>/template/<str:inspection_type>/', ActiveTemplateView.as_view(), name='active-template'),

    # Parameters inside a template
    path('templates/<int:template_id>/parameters/',  ParameterListCreateView.as_view(), name='parameter-list'),
    path('parameters/<int:pk>/',                     ParameterDetailView.as_view(),     name='parameter-detail'),
]
