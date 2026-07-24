from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from .models import User


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    list_display  = ('username', 'employee_id', 'get_full_name', 'role', 'plant', 'is_active')
    list_filter   = ('role', 'plant', 'is_active')
    search_fields = ('username', 'email', 'employee_id', 'first_name', 'last_name')
    ordering      = ('-created_at',)

    fieldsets = BaseUserAdmin.fieldsets + (
        ('Inspection System', {
            'fields': ('role', 'employee_id', 'phone', 'plant', 'profile_photo'),
        }),
    )

    add_fieldsets = BaseUserAdmin.add_fieldsets + (
        ('Inspection System', {
            'fields': ('role', 'employee_id', 'phone', 'plant'),
        }),
    )
