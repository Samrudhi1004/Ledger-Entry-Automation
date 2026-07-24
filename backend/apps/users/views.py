"""
Views for the users app — auth, profile, user management.
"""

from rest_framework import generics, status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework_simplejwt.views import TokenObtainPairView
from rest_framework_simplejwt.tokens import RefreshToken

from .models import User
from .serializers import (
    CustomTokenObtainPairSerializer,
    UserRegistrationSerializer,
    UserProfileSerializer,
    UserListSerializer,
    ChangePasswordSerializer,
)
from .permissions import IsAdminUser


# ─── Login (JWT) ──────────────────────────────────────────────────────────
class LoginView(TokenObtainPairView):
    """
    POST /api/users/login/
    Returns access + refresh JWT tokens with embedded role info.
    """
    permission_classes = [AllowAny]
    serializer_class   = CustomTokenObtainPairSerializer


# ─── Logout ───────────────────────────────────────────────────────────────
class LogoutView(APIView):
    """
    POST /api/users/logout/
    Blacklists the refresh token to invalidate the session.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        refresh_token = request.data.get('refresh')
        if not refresh_token:
            return Response(
                {'error': 'Refresh token is required.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            token = RefreshToken(refresh_token)
            token.blacklist()
            return Response({'message': 'Logged out successfully.'}, status=status.HTTP_200_OK)
        except Exception:
            return Response(
                {'error': 'Invalid or expired token.'},
                status=status.HTTP_400_BAD_REQUEST,
            )


# ─── Register ─────────────────────────────────────────────────────────────
class RegisterView(generics.CreateAPIView):
    """
    POST /api/users/register/
    Admin-only: create a new user account.
    """
    serializer_class   = UserRegistrationSerializer
    permission_classes = [IsAdminUser]


# ─── My Profile ───────────────────────────────────────────────────────────
class ProfileView(generics.RetrieveUpdateAPIView):
    """
    GET  /api/users/me/   → view own profile
    PUT  /api/users/me/   → update own profile
    PATCH /api/users/me/  → partial update
    """
    serializer_class   = UserProfileSerializer
    permission_classes = [IsAuthenticated]

    def get_object(self):
        return self.request.user


# ─── Change Password ──────────────────────────────────────────────────────
class ChangePasswordView(APIView):
    """POST /api/users/change-password/"""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = ChangePasswordSerializer(data=request.data, context={'request': request})
        if serializer.is_valid():
            serializer.save()
            return Response({'message': 'Password changed successfully.'})
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


# ─── User List (Admin) ────────────────────────────────────────────────────
class UserListView(generics.ListAPIView):
    """
    GET /api/users/                   → list all users
    GET /api/users/?role=operator     → filter by role
    GET /api/users/?plant=3           → filter by plant
    """
    serializer_class   = UserListSerializer
    permission_classes = [IsAdminUser]

    def get_queryset(self):
        qs = User.objects.select_related('plant').all()
        role  = self.request.query_params.get('role')
        plant = self.request.query_params.get('plant')
        if role:
            qs = qs.filter(role=role)
        if plant:
            qs = qs.filter(plant_id=plant)
        return qs


# ─── User Detail (Admin) ──────────────────────────────────────────────────
class UserDetailView(generics.RetrieveUpdateDestroyAPIView):
    """GET/PUT/DELETE /api/users/<id>/"""
    serializer_class   = UserProfileSerializer
    permission_classes = [IsAdminUser]
    queryset           = User.objects.all()
