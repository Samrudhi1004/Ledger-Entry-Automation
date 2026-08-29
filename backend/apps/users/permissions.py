"""
Role-based permission classes for the inspection system.
"""

from rest_framework.permissions import BasePermission
from .models import User


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
