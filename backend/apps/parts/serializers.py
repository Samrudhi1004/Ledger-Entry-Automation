from rest_framework import serializers
from .models import (
    Part, InspectionTemplate, InspectionParameter, ProcessParameter,
    DrawingDocument, DrawingVersion, ControlPlanDocument, ControlPlanVersion
)


class ProcessParameterSerializer(serializers.ModelSerializer):
    class Meta:
        model  = ProcessParameter
        fields = [
            'id', 'template', 'parameter_code', 'parameter_name', 'description',
            'data_type', 'measurement_type', 'unit', 'specification',
            'nominal_value', 'upper_tolerance', 'lower_tolerance',
            'upper_limit', 'lower_limit',
            'is_required', 'is_active', 'sequence_order',
        ]
        read_only_fields = ['upper_limit', 'lower_limit']



class InspectionParameterSerializer(serializers.ModelSerializer):
    tolerance_range = serializers.ReadOnlyField()

    class Meta:
        model  = InspectionParameter
        fields = [
            'id', 'parameter_code', 'parameter_name', 'unit',
            'nominal_value', 'upper_tolerance', 'lower_tolerance',
            'upper_limit', 'lower_limit',
            'measurement_type', 'is_critical', 'sequence_order',
            'measurement_technique', 'sample_size', 'control_method',
            'voice_prompt', 'tolerance_range',
        ]
        read_only_fields = ['upper_limit', 'lower_limit']


class InspectionTemplateSerializer(serializers.ModelSerializer):
    parameters         = InspectionParameterSerializer(many=True, read_only=True)
    process_parameters = ProcessParameterSerializer(many=True, read_only=True)
    part_number        = serializers.CharField(source='part.part_number', read_only=True)
    part_name          = serializers.CharField(source='part.part_name', read_only=True)
    created_by_name    = serializers.CharField(source='created_by.get_full_name', read_only=True)
    configured_parameter_count = serializers.ReadOnlyField()
    is_configuration_complete = serializers.ReadOnlyField()

    class Meta:
        model  = InspectionTemplate
        fields = [
            'id', 'name', 'part', 'part_number', 'part_name',
            'inspection_type', 'version', 'target_parameter_count',
            'configured_parameter_count', 'is_configuration_complete',
            'is_active', 'is_published', 'published_at', 'cycle_time_mins',
            'created_by', 'created_by_name', 'created_at',
            'parameters', 'process_parameters',
        ]
        read_only_fields = ['part', 'version', 'created_at', 'published_at']


class InspectionTemplateListSerializer(serializers.ModelSerializer):
    """Lightweight — for listing templates without parameter details."""
    part_number = serializers.CharField(source='part.part_number', read_only=True)
    parameter_count = serializers.IntegerField(source='parameters.count', read_only=True)
    configured_parameter_count = serializers.ReadOnlyField()
    is_configuration_complete = serializers.ReadOnlyField()

    class Meta:
        model  = InspectionTemplate
        fields = [
            'id', 'name', 'part_number', 'inspection_type', 'version', 'is_active',
            'is_published', 'published_at', 'cycle_time_mins',
            'parameter_count', 'target_parameter_count',
            'configured_parameter_count', 'is_configuration_complete'
        ]


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


class GlobalInspectionParameterSerializer(InspectionParameterSerializer):
    template_name = serializers.CharField(source='template.name', read_only=True)
    part_number = serializers.CharField(source='template.part.part_number', read_only=True)
    machine_code = serializers.CharField(source='template.part.machine.machine_code', read_only=True)
    created_by_name = serializers.CharField(source='template.created_by.get_full_name', read_only=True)
    created_at = serializers.DateTimeField(source='template.created_at', read_only=True, format='%d %b %Y, %I:%M %p')

    class Meta(InspectionParameterSerializer.Meta):
        fields = InspectionParameterSerializer.Meta.fields + ['template_name', 'part_number', 'machine_code', 'created_by_name', 'created_at']

class GlobalProcessParameterSerializer(ProcessParameterSerializer):
    template_name = serializers.CharField(source='template.name', read_only=True)
    part_number = serializers.CharField(source='template.part.part_number', read_only=True)
    machine_code = serializers.CharField(source='template.part.machine.machine_code', read_only=True)
    created_by_name = serializers.CharField(source='template.created_by.get_full_name', read_only=True)
    created_at = serializers.DateTimeField(source='template.created_at', read_only=True, format='%d %b %Y, %I:%M %p')

    class Meta(ProcessParameterSerializer.Meta):
        fields = ProcessParameterSerializer.Meta.fields + ['template_name', 'part_number', 'machine_code', 'created_by_name', 'created_at']


# ─────────────────────────────────────────────────────────────
# Drawing & Control Plan Serializers
# ─────────────────────────────────────────────────────────────

class DrawingVersionSerializer(serializers.ModelSerializer):
    uploaded_by_name = serializers.CharField(source='uploaded_by.get_full_name', read_only=True)
    file_url = serializers.SerializerMethodField()

    class Meta:
        model = DrawingVersion
        fields = [
            'id', 'drawing', 'revision_code', 'file', 'file_url',
            'file_name', 'file_size', 'change_notes',
            'uploaded_by', 'uploaded_by_name', 'uploaded_at',
        ]
        read_only_fields = ['id', 'drawing', 'file_name', 'file_size', 'uploaded_by', 'uploaded_at']

    def get_file_url(self, obj):
        request = self.context.get('request')
        if obj.file and hasattr(obj.file, 'url'):
            download_path = f"/api/parts/drawings/{obj.drawing_id}/versions/{obj.pk}/download/"
            if request is not None:
                return request.build_absolute_uri(download_path)
            return download_path
        return None


class DrawingDocumentSerializer(serializers.ModelSerializer):
    part_number = serializers.CharField(source='part.part_number', read_only=True, default=None)
    part_name = serializers.CharField(source='part.part_name', read_only=True, default=None)
    created_by_name = serializers.CharField(source='created_by.get_full_name', read_only=True)
    versions = DrawingVersionSerializer(many=True, read_only=True)
    latest_version = serializers.SerializerMethodField()

    class Meta:
        model = DrawingDocument
        fields = [
            'id', 'part', 'part_number', 'part_name',
            'drawing_number', 'title', 'description',
            'current_revision', 'created_by', 'created_by_name',
            'created_at', 'updated_at', 'versions', 'latest_version',
        ]
        read_only_fields = ['id', 'current_revision', 'created_by', 'created_at', 'updated_at']

    def get_latest_version(self, obj):
        latest = obj.versions.first()
        if latest:
            return DrawingVersionSerializer(latest, context=self.context).data
        return None


class ControlPlanVersionSerializer(serializers.ModelSerializer):
    uploaded_by_name = serializers.CharField(source='uploaded_by.get_full_name', read_only=True)
    file_url = serializers.SerializerMethodField()

    class Meta:
        model = ControlPlanVersion
        fields = [
            'id', 'control_plan', 'revision_code', 'file', 'file_url',
            'file_name', 'file_size', 'change_notes',
            'uploaded_by', 'uploaded_by_name', 'uploaded_at',
        ]
        read_only_fields = ['id', 'control_plan', 'file_name', 'file_size', 'uploaded_by', 'uploaded_at']

    def get_file_url(self, obj):
        request = self.context.get('request')
        if obj.file and hasattr(obj.file, 'url'):
            download_path = f"/api/parts/control-plans/{obj.control_plan_id}/versions/{obj.pk}/download/"
            if request is not None:
                return request.build_absolute_uri(download_path)
            return download_path
        return None


class ControlPlanDocumentSerializer(serializers.ModelSerializer):
    part_number = serializers.CharField(source='part.part_number', read_only=True, default=None)
    part_name = serializers.CharField(source='part.part_name', read_only=True, default=None)
    created_by_name = serializers.CharField(source='created_by.get_full_name', read_only=True)
    versions = ControlPlanVersionSerializer(many=True, read_only=True)
    latest_version = serializers.SerializerMethodField()

    class Meta:
        model = ControlPlanDocument
        fields = [
            'id', 'part', 'part_number', 'part_name',
            'control_plan_number', 'title', 'description',
            'current_revision', 'created_by', 'created_by_name',
            'created_at', 'updated_at', 'versions', 'latest_version',
        ]
        read_only_fields = ['id', 'current_revision', 'created_by', 'created_at', 'updated_at']

    def get_latest_version(self, obj):
        latest = obj.versions.first()
        if latest:
            return ControlPlanVersionSerializer(latest, context=self.context).data
        return None



class ProcessParameterSerializer(serializers.ModelSerializer):
    class Meta:
        model  = ProcessParameter
        fields = [
            'id', 'template', 'parameter_code', 'parameter_name', 'description',
            'data_type', 'measurement_type', 'unit', 'specification',
            'nominal_value', 'upper_tolerance', 'lower_tolerance',
            'upper_limit', 'lower_limit',
            'is_required', 'is_active', 'sequence_order',
        ]
        read_only_fields = ['upper_limit', 'lower_limit']



class InspectionParameterSerializer(serializers.ModelSerializer):
    tolerance_range = serializers.ReadOnlyField()

    class Meta:
        model  = InspectionParameter
        fields = [
            'id', 'parameter_code', 'parameter_name', 'unit',
            'nominal_value', 'upper_tolerance', 'lower_tolerance',
            'upper_limit', 'lower_limit',
            'measurement_type', 'is_critical', 'sequence_order',
            'measurement_technique', 'sample_size', 'control_method',
            'voice_prompt', 'tolerance_range',
        ]
        read_only_fields = ['upper_limit', 'lower_limit']


class InspectionTemplateSerializer(serializers.ModelSerializer):
    parameters         = InspectionParameterSerializer(many=True, read_only=True)
    process_parameters = ProcessParameterSerializer(many=True, read_only=True)
    part_number        = serializers.CharField(source='part.part_number', read_only=True)
    part_name          = serializers.CharField(source='part.part_name', read_only=True)
    created_by_name    = serializers.CharField(source='created_by.get_full_name', read_only=True)
    configured_parameter_count = serializers.ReadOnlyField()
    is_configuration_complete = serializers.ReadOnlyField()

    class Meta:
        model  = InspectionTemplate
        fields = [
            'id', 'name', 'part', 'part_number', 'part_name',
            'inspection_type', 'version', 'target_parameter_count',
            'configured_parameter_count', 'is_configuration_complete',
            'is_active', 'is_published', 'published_at', 'cycle_time_mins',
            'created_by', 'created_by_name', 'created_at',
            'parameters', 'process_parameters',
        ]
        read_only_fields = ['part', 'version', 'created_at', 'published_at']


class InspectionTemplateListSerializer(serializers.ModelSerializer):
    """Lightweight — for listing templates without parameter details."""
    part_number = serializers.CharField(source='part.part_number', read_only=True)
    parameter_count = serializers.IntegerField(source='parameters.count', read_only=True)
    configured_parameter_count = serializers.ReadOnlyField()
    is_configuration_complete = serializers.ReadOnlyField()

    class Meta:
        model  = InspectionTemplate
        fields = [
            'id', 'name', 'part_number', 'inspection_type', 'version', 'is_active',
            'is_published', 'published_at', 'cycle_time_mins',
            'parameter_count', 'target_parameter_count',
            'configured_parameter_count', 'is_configuration_complete'
        ]


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


class GlobalInspectionParameterSerializer(InspectionParameterSerializer):
    template_name = serializers.CharField(source='template.name', read_only=True)
    part_number = serializers.CharField(source='template.part.part_number', read_only=True)
    machine_code = serializers.CharField(source='template.part.machine.machine_code', read_only=True)
    created_by_name = serializers.CharField(source='template.created_by.get_full_name', read_only=True)
    created_at = serializers.DateTimeField(source='template.created_at', read_only=True, format='%d %b %Y, %I:%M %p')

    class Meta(InspectionParameterSerializer.Meta):
        fields = InspectionParameterSerializer.Meta.fields + ['template_name', 'part_number', 'machine_code', 'created_by_name', 'created_at']

class GlobalProcessParameterSerializer(ProcessParameterSerializer):
    template_name = serializers.CharField(source='template.name', read_only=True)
    part_number = serializers.CharField(source='template.part.part_number', read_only=True)
    machine_code = serializers.CharField(source='template.part.machine.machine_code', read_only=True)
    created_by_name = serializers.CharField(source='template.created_by.get_full_name', read_only=True)
    created_at = serializers.DateTimeField(source='template.created_at', read_only=True, format='%d %b %Y, %I:%M %p')

    class Meta(ProcessParameterSerializer.Meta):
        fields = ProcessParameterSerializer.Meta.fields + ['template_name', 'part_number', 'machine_code', 'created_by_name', 'created_at']
