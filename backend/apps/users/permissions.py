"""
Role-based permission classes for the inspection system.
"""

from rest_framework.permissions import BasePermission
from .models import User


class HasAccess(BasePermission):
    """Check a named action against the user's current database role."""

    def __init__(self, key=None):
        self.key = key

    def has_permission(self, request, view):
        key = self.key or getattr(view, 'access_key', None)
        if isinstance(key, dict):
            key = key.get(request.method)
        if not (key and request.user and request.user.is_authenticated):
            return False
        if isinstance(key, (tuple, list, set)):
            return any(request.user.has_access(item) for item in key)
        return request.user.has_access(key)


class IsOperator(BasePermission):
    """Allow access to operators only."""
    message = 'Only operators can perform this action.'

    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated
                    and request.user.role == User.Role.OPERATOR)


class IsSupervisor(BasePermission):
    """Allow access to supervisors only."""
    message = 'Only supervisors can perform this action.'

    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated
                    and request.user.role == User.Role.SUPERVISOR)


class IsQualityEngineer(BasePermission):
    """Allow access to quality engineers only."""
    message = 'Only quality engineers can perform this action.'

    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated
                    and request.user.role == User.Role.QUALITY_ENGINEER)


class IsInspector(BasePermission):
    """Allow mobile first-piece inspectors only."""
    message = 'Only inspectors can perform this action.'

    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated
                    and request.user.role == User.Role.INSPECTOR)


class IsCalibrator(BasePermission):
    """Allow access to calibrators only."""
    message = 'Only calibrators can perform this action.'

    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated
                    and request.user.role == User.Role.CALIBRATOR)


class IsAdminUser(BasePermission):
    """Allow access to admins only."""
    message = 'Only admins can perform this action.'

    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated
                    and request.user.role == User.Role.ADMIN)


class IsSupervisorOrAbove(BasePermission):
    """Allow supervisors, quality engineers and admins."""
    message = 'Supervisor or higher role required.'

    def has_permission(self, request, view):
        allowed = {User.Role.SUPERVISOR, User.Role.QUALITY_ENGINEER, User.Role.ADMIN}
        return bool(request.user and request.user.is_authenticated
                    and request.user.role in allowed)


class IsOperatorOrSupervisor(BasePermission):
    """Allow operators and supervisors."""
    def has_permission(self, request, view):
        allowed = {User.Role.OPERATOR, User.Role.SUPERVISOR}
        return bool(request.user and request.user.is_authenticated
                    and request.user.role in allowed)


class IsCalibratorOrAdmin(BasePermission):
    """Keep calibration reads and writes separate for configurable roles."""
    message = 'Calibration access required.'

    def has_permission(self, request, view):
        key = 'calibration.view' if request.method in ('GET', 'HEAD', 'OPTIONS') else 'calibration.manage'
        return bool(request.user and request.user.is_authenticated and request.user.has_access(key))


