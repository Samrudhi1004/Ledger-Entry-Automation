from django.contrib import admin
from .models import Part, InspectionTemplate, InspectionParameter


class InspectionParameterInline(admin.TabularInline):
    model  = InspectionParameter
    extra  = 1
    fields = (
        'sequence_order', 'parameter_code', 'parameter_name', 'unit',
        'nominal_value', 'upper_tolerance', 'lower_tolerance',
        'measurement_type', 'is_critical',
    )
    ordering = ('sequence_order',)


@admin.register(Part)
class PartAdmin(admin.ModelAdmin):
    list_display  = ('part_number', 'part_name', 'machine', 'revision', 'is_active')
    search_fields = ('part_number', 'part_name', 'drawing_number')
    list_filter   = ('machine__plant__factory', 'is_active')


@admin.register(InspectionTemplate)
class InspectionTemplateAdmin(admin.ModelAdmin):
    list_display  = ('__str__', 'inspection_type', 'version', 'is_active', 'created_by')
    list_filter   = ('inspection_type', 'is_active')
    search_fields = ('part__part_number', 'part__part_name')
    inlines       = [InspectionParameterInline]


@admin.register(InspectionParameter)
class InspectionParameterAdmin(admin.ModelAdmin):
    list_display  = ('parameter_code', 'parameter_name', 'nominal_value', 'unit', 'is_critical')
    list_filter   = ('measurement_type', 'is_critical')
    search_fields = ('parameter_code', 'parameter_name')
