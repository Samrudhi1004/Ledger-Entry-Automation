from django.urls import path
from .views import (
    FactoryListCreateView, FactoryDetailView,
    PlantListCreateView, PlantDetailView,
    MachineListCreateView, MachineDetailView,
    MachineByQRView,
)

urlpatterns = [
    # Factories
    path('factories/',          FactoryListCreateView.as_view(), name='factory-list'),
    path('factories/<int:pk>/', FactoryDetailView.as_view(),     name='factory-detail'),

    # Plants
    path('plants/',             PlantListCreateView.as_view(),   name='plant-list'),
    path('plants/<int:pk>/',    PlantDetailView.as_view(),       name='plant-detail'),

    # Machines
    path('',                    MachineListCreateView.as_view(), name='machine-list'),
    path('<int:pk>/',           MachineDetailView.as_view(),     name='machine-detail'),
    path('scan/<str:qr_code>/', MachineByQRView.as_view(),      name='machine-by-qr'),
]
