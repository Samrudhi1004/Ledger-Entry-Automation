from rest_framework import serializers
from .models import Factory, Plant, Machine


class FactorySerializer(serializers.ModelSerializer):
    plant_count = serializers.IntegerField(source='plants.count', read_only=True)

    class Meta:
        model  = Factory
        fields = ['id', 'name', 'code', 'location', 'is_active', 'plant_count', 'created_at']


class PlantSerializer(serializers.ModelSerializer):
    factory_name   = serializers.CharField(source='factory.name', read_only=True)
    machine_count  = serializers.IntegerField(source='machines.count', read_only=True)

    class Meta:
        model  = Plant
        fields = ['id', 'factory', 'factory_name', 'name', 'code', 'shift_duration_hours', 'total_break_mins', 'is_active', 'machine_count', 'created_at']


class MachineSerializer(serializers.ModelSerializer):
    plant = serializers.PrimaryKeyRelatedField(queryset=Plant.objects.all(), required=False, allow_null=True)
    plant_name   = serializers.SerializerMethodField()
    factory_name = serializers.SerializerMethodField()
    shift_duration_hours = serializers.IntegerField(source='plant.shift_duration_hours', read_only=True)
    total_break_mins = serializers.IntegerField(source='plant.total_break_mins', read_only=True)

    class Meta:
        model  = Machine
        fields = [
            'id', 'plant', 'plant_name', 'factory_name',
            'name', 'machine_code', 'machine_type',
            'manufacturer', 'model_number', 'status',
            'qr_code', 'is_active', 'created_at',
            'shift_duration_hours', 'total_break_mins',
        ]

    def get_plant_name(self, obj):
        return obj.plant.name if obj.plant else None

    def get_factory_name(self, obj):
        return obj.plant.factory.name if (obj.plant and obj.plant.factory) else None

    def create(self, validated_data):
        if not validated_data.get('plant'):
            default_plant = Plant.objects.first()
            if default_plant:
                validated_data['plant'] = default_plant
        return super().create(validated_data)


class MachineListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for dropdowns on the Flutter app."""
    class Meta:
        model  = Machine
        fields = ['id', 'machine_code', 'name', 'status', 'qr_code']
