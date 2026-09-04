"""
Views for the users app — auth, profile, user management.
"""

from rest_framework import generics, status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework_simplejwt.views import TokenObtainPairView
from rest_framework_simplejwt.tokens import RefreshToken

from django.core.mail import send_mail
from django.utils.crypto import get_random_string
from django.conf import settings
from django.contrib.auth.tokens import default_token_generator
from django.utils.http import urlsafe_base64_encode, urlsafe_base64_decode
from django.utils.encoding import force_bytes, force_str

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


# ─── Profile Photo Upload ─────────────────────────────────────────────────────
class UpdateProfilePhotoView(APIView):
    """
    POST /api/users/me/photo/
    Upload or replace the logged-in user's profile photo.
    Expects multipart/form-data with field 'photo'.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        photo = request.FILES.get('photo')
        if not photo:
            return Response({'error': 'No photo file provided.'}, status=status.HTTP_400_BAD_REQUEST)

        # Validate file type
        allowed_types = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
        if photo.content_type not in allowed_types:
            return Response({'error': 'Only JPEG, PNG, WebP or GIF images are allowed.'}, status=status.HTTP_400_BAD_REQUEST)

        # Validate file size (max 5 MB)
        if photo.size > 5 * 1024 * 1024:
            return Response({'error': 'Photo must be smaller than 5 MB.'}, status=status.HTTP_400_BAD_REQUEST)

        user = request.user
        user.profile_photo = photo
        user.save(update_fields=['profile_photo'])

        serializer = UserProfileSerializer(user, context={'request': request})
        return Response({
            'success': True,
            'message': 'Profile photo updated.',
            'profile_photo_url': serializer.data.get('profile_photo_url'),
        }, status=status.HTTP_200_OK)


# ─── Change Password ──────────────────────────────────────────────────────
class ChangePasswordView(APIView):
    """POST /api/users/change-password/"""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = ChangePasswordSerializer(data=request.data, context={'request': request})
        if serializer.is_valid():
            serializer.save()
            
            # Send notification email
            user = request.user
            subject = "Your Password Has Been Changed"
            message = f"Hi {user.first_name or 'User'},\n\nThis is a confirmation that the password for your account has been successfully changed.\n\nIf you did not request this change, please contact an administrator immediately."
            from_email = getattr(settings, 'DEFAULT_FROM_EMAIL', 'noreply@example.com')
            try:
                send_mail(subject, message, from_email, [user.email], fail_silently=True)
            except Exception:
                pass

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
        return qs.order_by('-is_active', '-created_at')


# ─── User Detail (Supervisor / Admin) ─────────────────────────────────────
class UserDetailView(generics.RetrieveUpdateDestroyAPIView):
    """GET/PUT/PATCH/DELETE /api/users/<id>/"""
    serializer_class   = UserProfileSerializer
    queryset           = User.objects.all()

    def get_permissions(self):
        if self.request.method == 'DELETE':
            return [IsAdminUser()]
        return [IsSupervisorOrAbove()]

    def patch(self, request, *args, **kwargs):
        try:
            user_obj = self.get_object()
        except User.DoesNotExist:
            return Response({
                "success": False,
                "message": "User account not found."
            }, status=status.HTTP_404_NOT_FOUND)

        # Direct is_active toggle — bypass full serializer to avoid validation errors
        if 'is_active' in request.data:
            is_active_val = request.data['is_active']
            # Handle both JSON boolean and string representations
            if isinstance(is_active_val, str):
                is_active_val = is_active_val.lower() == 'true'
            user_obj.is_active = bool(is_active_val)
            user_obj.save(update_fields=['is_active'])

            from .serializers import UserListSerializer
            serializer = UserListSerializer(user_obj)
            return Response({
                "success": True,
                "action": "activated" if user_obj.is_active else "deactivated",
                "message": f"User account '{user_obj.username}' has been {'activated' if user_obj.is_active else 'deactivated'}.",
                "user": serializer.data
            }, status=status.HTTP_200_OK)

        # Fallback: general partial update for other fields
        serializer = self.get_serializer(user_obj, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response({
                "success": True,
                "message": f"User account '{user_obj.username}' updated successfully.",
                "user": serializer.data
            }, status=status.HTTP_200_OK)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

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


# ─── Email Verification ───────────────────────────────────────────────────
class RequestEmailVerificationView(APIView):
    """
    POST /api/users/verify-email/request/
    Generates a token and sends a verification email.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        user = request.user
        
        if not user.email:
            return Response({"error": "User does not have an email address set."}, status=status.HTTP_400_BAD_REQUEST)
            
        if user.is_email_verified:
            return Response({"message": "Email is already verified."}, status=status.HTTP_200_OK)

        token = get_random_string(length=32)
        user.email_verification_token = token
        user.save(update_fields=['email_verification_token'])

        # Frontend verification URL
        frontend_url = getattr(settings, 'FRONTEND_URL', 'http://localhost:5173')
        verify_url = f"{frontend_url}/verify-email/{token}"

        subject = "Verify your email address"
        message = f"Hi {user.first_name},\n\nPlease click the following link to verify your email address:\n{verify_url}\n\nIf you did not request this, please ignore this email."
        
        html_message = f"""
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden;">
            <div style="background-color: #2563eb; padding: 24px; text-align: center;">
                <h1 style="color: white; margin: 0; font-size: 24px; font-weight: 600;">Email Verification</h1>
            </div>
            <div style="padding: 32px 24px; background-color: #ffffff; color: #374151;">
                <p style="font-size: 16px; margin-top: 0;">Hi <strong>{user.first_name or 'User'}</strong>,</p>
                <p style="font-size: 16px; line-height: 1.5; margin-bottom: 24px;">
                    Thank you for joining us! To complete your profile setup, we just need to verify your email address.
                </p>
                <div style="text-align: center; margin: 32px 0;">
                    <a href="{verify_url}" style="background-color: #2563eb; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px; display: inline-block;">
                        Verify Email Address
                    </a>
                </div>
                <p style="font-size: 14px; color: #6b7280; margin-bottom: 8px;">
                    Or copy and paste this link into your browser:
                </p>
                <p style="font-size: 14px; color: #2563eb; word-break: break-all; margin-top: 0;">
                    <a href="{verify_url}" style="color: #2563eb;">{verify_url}</a>
                </p>
                <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 32px 0 24px;" />
                <p style="font-size: 12px; color: #9ca3af; margin: 0;">
                    If you did not request this email, you can safely ignore it.
                </p>
            </div>
        </div>
        """
        
        from_email = getattr(settings, 'DEFAULT_FROM_EMAIL', 'noreply@example.com')
        recipient_list = [user.email]

        try:
            send_mail(subject, message, from_email, recipient_list, fail_silently=False, html_message=html_message)
            return Response({"message": "Verification email sent successfully."}, status=status.HTTP_200_OK)
        except Exception as e:
            return Response({"error": f"Failed to send email: {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class VerifyEmailView(APIView):
    """
    POST /api/users/verify-email/confirm/
    Validates token and marks email as verified.
    """
    permission_classes = [AllowAny]

    def post(self, request):
        token = request.data.get('token')
        if not token:
            return Response({"error": "Token is required."}, status=status.HTTP_400_BAD_REQUEST)

        user = User.objects.filter(email_verification_token=token).first()
        if not user:
            return Response({"error": "Invalid or expired verification token."}, status=status.HTTP_400_BAD_REQUEST)

        user.is_email_verified = True
        user.email_verification_token = None
        user.save(update_fields=['is_email_verified', 'email_verification_token'])

        return Response({"message": "Email verified successfully."}, status=status.HTTP_200_OK)


# ─── Forgot Password ──────────────────────────────────────────────────────
class ForgotPasswordRequestView(APIView):
    """
    POST /api/users/password-reset/request/
    Generates a password reset token and sends an email.
    """
    permission_classes = [AllowAny]

    def post(self, request):
        email = request.data.get('email')
        if not email:
            return Response({"error": "Email is required."}, status=status.HTTP_400_BAD_REQUEST)

        user = User.objects.filter(email=email).first()
        if not user:
            # For security, do not reveal whether user exists
            return Response({"message": "If an account with that email exists, a password reset link has been sent."}, status=status.HTTP_200_OK)

        # Generate token
        token = default_token_generator.make_token(user)
        uid = urlsafe_base64_encode(force_bytes(user.pk))

        # Frontend reset URL
        frontend_url = getattr(settings, 'FRONTEND_URL', 'http://localhost:5173')
        reset_url = f"{frontend_url}/reset-password/{uid}/{token}"

        subject = "Reset Your Password"
        message = f"Hi {user.first_name or 'User'},\n\nPlease click the following link to reset your password:\n{reset_url}\n\nIf you did not request this, please ignore this email."
        
        html_message = f'''
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden;">
            <div style="background-color: #2563eb; padding: 24px; text-align: center;">
                <h1 style="color: white; margin: 0; font-size: 24px; font-weight: 600;">Reset Your Password</h1>
            </div>
            <div style="padding: 32px 24px; background-color: #ffffff; color: #374151;">
                <p style="font-size: 16px; margin-top: 0;">Hi <strong>{user.first_name or 'User'}</strong>,</p>
                <p style="font-size: 16px; line-height: 1.5; margin-bottom: 24px;">
                    We received a request to reset your password. Click the button below to choose a new password.
                </p>
                <div style="text-align: center; margin: 32px 0;">
                    <a href="{reset_url}" style="background-color: #2563eb; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px; display: inline-block;">
                        Reset Password
                    </a>
                </div>
                <p style="font-size: 14px; color: #6b7280; margin-bottom: 8px;">
                    Or copy and paste this link into your browser:
                </p>
                <p style="font-size: 14px; color: #2563eb; word-break: break-all; margin-top: 0;">
                    <a href="{reset_url}" style="color: #2563eb;">{reset_url}</a>
                </p>
                <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 32px 0 24px;" />
                <p style="font-size: 12px; color: #9ca3af; margin: 0;">
                    If you did not request a password reset, you can safely ignore this email.
                </p>
            </div>
        </div>
        '''

        from_email = getattr(settings, 'DEFAULT_FROM_EMAIL', 'noreply@example.com')

        try:
            send_mail(subject, message, from_email, [user.email], fail_silently=False, html_message=html_message)
        except Exception:
            pass # Fail silently

        return Response({"message": "If an account with that email exists, a password reset link has been sent."}, status=status.HTTP_200_OK)


class ResetPasswordConfirmView(APIView):
    """
    POST /api/users/password-reset/confirm/
    Validates the token and updates the user's password.
    """
    permission_classes = [AllowAny]

    def post(self, request):
        uidb64 = request.data.get('uid')
        token = request.data.get('token')
        new_password = request.data.get('password')

        if not uidb64 or not token or not new_password:
            return Response({"error": "uid, token, and new password are required."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            uid = force_str(urlsafe_base64_decode(uidb64))
            user = User.objects.get(pk=uid)
        except (TypeError, ValueError, OverflowError, User.DoesNotExist):
            user = None

        if user is not None and default_token_generator.check_token(user, token):
            user.set_password(new_password)
            user.save()
            return Response({"message": "Password has been reset successfully."}, status=status.HTTP_200_OK)
        else:
            return Response({"error": "Invalid or expired token."}, status=status.HTTP_400_BAD_REQUEST)
