"""
Custom User model with role-based access control.
Roles: Operator, Supervisor, Quality Engineer, Admin
"""

from django.contrib.auth.models import AbstractUser
from django.db import models


class User(AbstractUser):

    class Role(models.TextChoices):
        OPERATOR          = 'operator',           'Operator'
        SUPERVISOR        = 'supervisor',         'Supervisor'
        QUALITY_ENGINEER  = 'quality_engineer',   'Quality Engineer'
        ADMIN             = 'admin',              'Admin'

    # Core fields
    role        = models.CharField(
        max_length=20,
        choices=Role.choices,
        default=Role.OPERATOR,
    )
    employee_id = models.CharField(max_length=50, unique=True, null=True, blank=True)
    phone       = models.CharField(max_length=15, blank=True)

    # Plant assignment (operators/supervisors belong to a plant)
    plant = models.ForeignKey(
        'machines.Plant',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='users',
    )

    # Profile
    profile_photo = models.ImageField(
        upload_to='profiles/',
        null=True,
        blank=True,
    )

    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    # Use email as the login identifier
    USERNAME_FIELD  = 'username'
    REQUIRED_FIELDS = ['email', 'employee_id']

    class Meta:
        db_table   = 'users'
        ordering   = ['-created_at']
        verbose_name = 'User'
        verbose_name_plural = 'Users'

    def __str__(self):
        return f"{self.get_full_name()} ({self.employee_id}) — {self.get_role_display()}"

    # ─── Role helpers ─────────────────────────────────────────
    @property
    def is_operator(self):
        return self.role == self.Role.OPERATOR

    @property
    def is_supervisor(self):
        return self.role == self.Role.SUPERVISOR

    @property
    def is_quality_engineer(self):
        return self.role == self.Role.QUALITY_ENGINEER

    @property
    def is_admin_user(self):
        return self.role == self.Role.ADMIN
