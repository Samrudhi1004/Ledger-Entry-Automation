from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView
from .views import (
    LoginView,
    LogoutView,
    RegisterView,
    ProfileView,
    UpdateProfilePhotoView,
    ChangePasswordView,
    UserListView,
    UserDetailView,
    RequestEmailVerificationView,
    VerifyEmailView,
    ForgotPasswordRequestView,
    ResetPasswordConfirmView,
)

urlpatterns = [
    # Auth
    path('login/',           LoginView.as_view(),          name='user-login'),
    path('logout/',          LogoutView.as_view(),         name='user-logout'),
    path('token/refresh/',   TokenRefreshView.as_view(),   name='token-refresh'),
    path('refresh/',         TokenRefreshView.as_view(),   name='auth-refresh'),

    # Registration (Admin only)
    path('register/',        RegisterView.as_view(),       name='user-register'),

    path('me/',              ProfileView.as_view(),             name='user-profile'),
    path('me/photo/',        UpdateProfilePhotoView.as_view(),  name='user-profile-photo'),
    path('change-password/', ChangePasswordView.as_view(),      name='change-password'),

    # Email Verification
    path('verify-email/request/', RequestEmailVerificationView.as_view(), name='verify-email-request'),
    path('verify-email/confirm/', VerifyEmailView.as_view(), name='verify-email-confirm'),

    # Password Reset
    path('password-reset/request/', ForgotPasswordRequestView.as_view(), name='password-reset-request'),
    path('password-reset/confirm/', ResetPasswordConfirmView.as_view(), name='password-reset-confirm'),

    # Admin: user management
    path('',                 UserListView.as_view(),       name='user-list'),
    path('<int:pk>/',        UserDetailView.as_view(),     name='user-detail'),
]
