from rest_framework import serializers
from .models import Task
from apps.users.models import User

class UserBasicSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'username', 'first_name', 'last_name', 'role', 'employee_id']

class TaskSerializer(serializers.ModelSerializer):
    allocated_by = UserBasicSerializer(read_only=True)
    allocated_to = UserBasicSerializer(read_only=True)

    class Meta:
        model = Task
        fields = '__all__'

class TaskCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Task
        fields = ['title', 'description', 'allocated_to', 'deadline']
