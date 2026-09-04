"""
Serializers for the users app.
"""

from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from django.contrib.auth.password_validation import validate_password
from .models import User


# ─── JWT Custom Claims ─────────────────────────────────────────────────────
class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    """Adds role, employee_id and full_name to the JWT payload."""

    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        token['role']        = user.role
        token['employee_id'] = user.employee_id
        token['full_name']   = user.get_full_name()
        token['plant_id']    = user.plant_id
        return token

    def validate(self, attrs):
        username = attrs.get(self.username_field, '')
        if username:
            user_obj = User.objects.filter(username__iexact=username).first()
            if user_obj:
                attrs[self.username_field] = user_obj.username

        data = super().validate(attrs)
        # Append extra user info to the login response
        data['user'] = {
            'id':          self.user.id,
            'username':    self.user.username,
            'email':       self.user.email,
            'is_email_verified': self.user.is_email_verified,
            'full_name':   self.user.get_full_name(),
            'role':        self.user.role,
            'employee_id': self.user.employee_id,
            'plant_id':    self.user.plant_id,
        }
        return data


# ─── Registration ──────────────────────────────────────────────────────────
class UserRegistrationSerializer(serializers.ModelSerializer):
    password  = serializers.CharField(write_only=True)
    password2 = serializers.CharField(write_only=True, label='Confirm Password')

    class Meta:
        model  = User
        fields = [
            'username', 'email', 'first_name', 'last_name',
            'employee_id', 'role', 'phone', 'plant',
            'password', 'password2',
        ]

    def validate(self, attrs):
        if attrs['password'] != attrs['password2']:
            raise serializers.ValidationError({'password': 'Passwords do not match.'})
        return attrs

    def create(self, validated_data):
        validated_data.pop('password2')
        password = validated_data.pop('password')
        user = User(**validated_data)
        user.set_password(password)
        user.save()
        return user


# ─── Profile ───────────────────────────────────────────────────────────────
class UserProfileSerializer(serializers.ModelSerializer):
    plant_name        = serializers.CharField(source='plant.name', read_only=True)
    profile_photo_url = serializers.SerializerMethodField()

    def get_profile_photo_url(self, obj):
        request = self.context.get('request')
        if obj.profile_photo and hasattr(obj.profile_photo, 'url'):
            return request.build_absolute_uri(obj.profile_photo.url) if request else obj.profile_photo.url
        return None

    class Meta:
        model  = User
        fields = [
            'id', 'username', 'email', 'is_email_verified', 'first_name', 'last_name',
            'employee_id', 'role', 'phone', 'plant', 'plant_name',
            'profile_photo', 'profile_photo_url', 'is_active', 'date_joined', 'created_at',
        ]
        read_only_fields = ['id', 'username', 'date_joined', 'created_at', 'is_email_verified']

    def update(self, instance, validated_data):
        new_email = validated_data.get('email', instance.email)
        if new_email != instance.email:
            instance.is_email_verified = False
            instance.email_verification_token = None
        return super().update(instance, validated_data)


# ─── User List (Admin view) ────────────────────────────────────────────────
class UserListSerializer(serializers.ModelSerializer):
    plant_name = serializers.CharField(source='plant.name', read_only=True)

    class Meta:
        model  = User
        fields = [
            'id', 'username', 'email', 'is_email_verified', 'phone', 'full_name', 'employee_id',
            'role', 'plant_name', 'is_active', 'created_at',
        ]

    full_name = serializers.SerializerMethodField()

    def get_full_name(self, obj):
        return obj.get_full_name()


# ─── Change Password ───────────────────────────────────────────────────────
class ChangePasswordSerializer(serializers.Serializer):
    old_password = serializers.CharField(write_only=True)
    new_password = serializers.CharField(write_only=True, validators=[validate_password])

    def validate_old_password(self, value):
        user = self.context['request'].user
        if not user.check_password(value):
            raise serializers.ValidationError('Old password is incorrect.')
        return value

    def save(self, **kwargs):
        user = self.context['request'].user
        user.set_password(self.validated_data['new_password'])
        user.save()
        return user
