from django.contrib import admin
from .models import Factory, Plant, Machine


@admin.register(Factory)
class FactoryAdmin(admin.ModelAdmin):
    list_display  = ('name', 'code', 'location', 'is_active')
    search_fields = ('name', 'code')
    list_filter   = ('is_active',)


@admin.register(Plant)
class PlantAdmin(admin.ModelAdmin):
    list_display  = ('name', 'code', 'factory', 'is_active')
    search_fields = ('name', 'code')
    list_filter   = ('factory', 'is_active')


@admin.register(Machine)
class MachineAdmin(admin.ModelAdmin):
    list_display  = ('machine_code', 'name', 'plant', 'machine_type', 'status', 'is_active')
    search_fields = ('machine_code', 'name', 'qr_code')
    list_filter   = ('status', 'plant__factory', 'is_active')
    ordering      = ('machine_code',)
