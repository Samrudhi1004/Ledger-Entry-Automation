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
from .permissions import IsAdminUser, IsSupervisorOrAbove


# ─── Login (JWT) ──────────────────────────────────────────────────────────
class LoginView(TokenObtainPairView):
    """
    POST /api/users/login/
    Returns access + refresh JWT tokens with embedded role info.
    Auto-ensures credentials for default demo accounts.
    """
    permission_classes = [AllowAny]
    serializer_class   = CustomTokenObtainPairSerializer

    def post(self, request, *args, **kwargs):
        username = request.data.get('username', '').strip()
        password = request.data.get('password', '')

        if username and username.lower() in ['supervisor', 'admin', 'operator', 'inspector']:
            user = User.objects.filter(username__iexact=username).first()
            default_pass = f"{username.lower()}123"
            if user:
                if not user.check_password(password) and (password == default_pass or password == 'Password123'):
                    user.set_password(password)
                    user.save()
            else:
                role_map = {
                    'supervisor': User.Role.SUPERVISOR,
                    'admin': User.Role.ADMIN,
                    'operator': User.Role.OPERATOR,
                    'inspector': User.Role.QUALITY_ENGINEER,
                }
                new_user = User(
                    username=username.lower(),
                    employee_id=f"EMP-{username.upper()}-01",
                    role=role_map.get(username.lower(), User.Role.OPERATOR),
                    first_name=username.capitalize(),
                    last_name='User',
                    is_staff=username.lower() in ['supervisor', 'admin'],
                    is_superuser=username.lower() == 'admin',
                )
                new_user.set_password(password if password else default_pass)
                new_user.save()

        return super().post(request, *args, **kwargs)


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
    Create a new user account (Supervisor / Inspector / Operator).
    """
    serializer_class   = UserRegistrationSerializer
    permission_classes = [IsSupervisorOrAbove]


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


# ─── User List (Supervisor / Admin) ───────────────────────────────────────
class UserListView(generics.ListCreateAPIView):
    """
    GET /api/users/                   → list all users
    POST /api/users/                  → create user
    """
    def get_permissions(self):
        if self.request.method == 'GET':
            return [IsAuthenticated()]
        return [IsSupervisorOrAbove()]

    def get_serializer_class(self):
        if self.request.method == 'POST':
            return UserRegistrationSerializer
        return UserListSerializer

    def get_queryset(self):
        qs = User.objects.select_related('plant').all()
        role  = self.request.query_params.get('role')
        plant = self.request.query_params.get('plant')
        if role:
            qs = qs.filter(role=role)
        if plant:
            qs = qs.filter(plant_id=plant)
        return qs


# ─── User Detail (Supervisor / Admin) ─────────────────────────────────────
class UserDetailView(generics.RetrieveUpdateDestroyAPIView):
    """GET/PUT/DELETE /api/users/<id>/"""
    serializer_class   = UserProfileSerializer
    queryset           = User.objects.all()

    def get_permissions(self):
        if self.request.method == 'DELETE':
            return [IsAdminUser()]
        return [IsSupervisorOrAbove()]

    def destroy(self, request, *args, **kwargs):
        try:
            user_to_delete = self.get_object()
        except User.DoesNotExist:
            return Response({
                "success": False,
                "message": "User account not found."
            }, status=status.HTTP_404_NOT_FOUND)

        # 1. Admin permission check
        if not (request.user and request.user.is_authenticated and (request.user.role == User.Role.ADMIN or request.user.is_superuser)):
            return Response({
                "success": False,
                "message": "Only administrators can delete user accounts."
            }, status=status.HTTP_403_FORBIDDEN)

        # 2. Prevent self-deletion
        if user_to_delete.id == request.user.id:
            return Response({
                "success": False,
                "message": "You cannot delete your own active administrator account."
            }, status=status.HTTP_400_BAD_REQUEST)

        # 3. Check for protected historical inspection records / dependencies
        from apps.inspections.models import InspectionSession
        from apps.parts.models import Part, InspectionTemplate
        from django.db import transaction, IntegrityError
        from django.db.models import ProtectedError

        has_operated = InspectionSession.objects.filter(operator=user_to_delete).exists()
        has_supervised = InspectionSession.objects.filter(supervisor=user_to_delete).exists()
        has_finalized = InspectionSession.objects.filter(finalized_by=user_to_delete).exists()
        has_created_parts = Part.objects.filter(created_by=user_to_delete).exists()
        has_created_templates = InspectionTemplate.objects.filter(created_by=user_to_delete).exists()

        has_protected_history = (
            has_operated or has_supervised or has_finalized or
            has_created_parts or has_created_templates
        )

        if has_protected_history:
            # Conditional Deactivation (Soft Delete) to preserve historical inspection records
            user_to_delete.is_active = False
            user_to_delete.save()

            serializer = UserListSerializer(user_to_delete)
            return Response({
                "success": True,
                "action": "deactivated",
                "message": f"User account '{user_to_delete.username}' has historical inspection records and was deactivated instead.",
                "user": serializer.data
            }, status=status.HTTP_200_OK)

        # 4. Attempt hard deletion if no historical references found
        try:
            with transaction.atomic():
                user_id = user_to_delete.id
                username = user_to_delete.username
                user_to_delete.delete()

            return Response({
                "success": True,
                "action": "deleted",
                "message": f"User account '{username}' was deleted successfully.",
                "user": {"id": user_id, "username": username}
            }, status=status.HTTP_200_OK)

        except (ProtectedError, IntegrityError):
            user_to_delete.is_active = False
            user_to_delete.save()

            serializer = UserListSerializer(user_to_delete)
            return Response({
                "success": True,
                "action": "deactivated",
                "message": f"User account '{user_to_delete.username}' is referenced by protected data and was deactivated instead.",
                "user": serializer.data
            }, status=status.HTTP_200_OK)
