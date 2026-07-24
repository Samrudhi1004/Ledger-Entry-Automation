from rest_framework import serializers
from .models import Part, InspectionTemplate, InspectionParameter


class InspectionParameterSerializer(serializers.ModelSerializer):
    tolerance_range = serializers.ReadOnlyField()

    class Meta:
        model  = InspectionParameter
        fields = [
            'id', 'parameter_code', 'parameter_name', 'unit',
            'nominal_value', 'upper_tolerance', 'lower_tolerance',
            'upper_limit', 'lower_limit',
            'measurement_type', 'is_critical', 'sequence_order',
            'voice_prompt', 'tolerance_range',
        ]
        read_only_fields = ['upper_limit', 'lower_limit']


class InspectionTemplateSerializer(serializers.ModelSerializer):
    parameters   = InspectionParameterSerializer(many=True, read_only=True)
    part_number  = serializers.CharField(source='part.part_number', read_only=True)
    part_name    = serializers.CharField(source='part.part_name', read_only=True)
    created_by_name = serializers.CharField(source='created_by.get_full_name', read_only=True)

    class Meta:
        model  = InspectionTemplate
        fields = [
            'id', 'part', 'part_number', 'part_name',
            'inspection_type', 'version', 'is_active',
            'created_by', 'created_by_name', 'created_at',
            'parameters',
        ]
        read_only_fields = ['version', 'created_at']


class InspectionTemplateListSerializer(serializers.ModelSerializer):
    """Lightweight — for listing templates without parameter details."""
    part_number = serializers.CharField(source='part.part_number', read_only=True)
    parameter_count = serializers.IntegerField(source='parameters.count', read_only=True)

    class Meta:
        model  = InspectionTemplate
        fields = ['id', 'part_number', 'inspection_type', 'version', 'is_active', 'parameter_count']


class PartSerializer(serializers.ModelSerializer):
    machine_name = serializers.CharField(source='machine.name', read_only=True)
    machine_code = serializers.CharField(source='machine.machine_code', read_only=True)
    created_by_name = serializers.CharField(source='created_by.get_full_name', read_only=True)
    templates    = InspectionTemplateListSerializer(many=True, read_only=True)

    class Meta:
        model  = Part
        fields = [
            'id', 'part_number', 'part_name', 'description',
            'drawing_number', 'revision',
            'machine', 'machine_name', 'machine_code',
            'is_active', 'created_by', 'created_by_name',
            'created_at', 'templates',
        ]
        read_only_fields = ['created_at']


class PartListSerializer(serializers.ModelSerializer):
    """Lightweight — for dropdowns on Flutter."""
    machine_code = serializers.CharField(source='machine.machine_code', read_only=True)

    class Meta:
        model  = Part
        fields = ['id', 'part_number', 'part_name', 'machine_code', 'revision']
