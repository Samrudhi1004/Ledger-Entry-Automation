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
        fields = ['id', 'factory', 'factory_name', 'name', 'code', 'is_active', 'machine_count', 'created_at']


class MachineSerializer(serializers.ModelSerializer):
    plant_name   = serializers.CharField(source='plant.name', read_only=True)
    factory_name = serializers.CharField(source='plant.factory.name', read_only=True)

    class Meta:
        model  = Machine
        fields = [
            'id', 'plant', 'plant_name', 'factory_name',
            'name', 'machine_code', 'machine_type',
            'manufacturer', 'model_number', 'status',
            'qr_code', 'is_active', 'created_at',
        ]


class MachineListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for dropdowns on the Flutter app."""
    class Meta:
        model  = Machine
        fields = ['id', 'machine_code', 'name', 'status', 'qr_code']
