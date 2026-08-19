from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView
from .views import (
    LoginView,
    LogoutView,
    RegisterView,
    ProfileView,
    ChangePasswordView,
    UserListView,
    UserDetailView,
)

urlpatterns = [
    # Auth
    path('login/',           LoginView.as_view(),          name='user-login'),
    path('logout/',          LogoutView.as_view(),         name='user-logout'),
    path('token/refresh/',   TokenRefreshView.as_view(),   name='token-refresh'),
    path('refresh/',         TokenRefreshView.as_view(),   name='auth-refresh'),

    # Registration (Admin only)
    path('register/',        RegisterView.as_view(),       name='user-register'),

    # Own profile
    path('me/',              ProfileView.as_view(),        name='user-profile'),
    path('change-password/', ChangePasswordView.as_view(), name='change-password'),

    # Admin: user management
    path('',                 UserListView.as_view(),       name='user-list'),
    path('<int:pk>/',        UserDetailView.as_view(),     name='user-detail'),
]
