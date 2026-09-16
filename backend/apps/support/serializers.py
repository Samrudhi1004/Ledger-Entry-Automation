from rest_framework import serializers
from .models import BugReport

class BugReportSerializer(serializers.ModelSerializer):
    user = serializers.ReadOnlyField(source='user.username')
    user_email = serializers.ReadOnlyField(source='user.email')
    
    class Meta:
        model = BugReport
        fields = ['id', 'user', 'user_email', 'message', 'screenshot', 'status', 'created_at']
        read_only_fields = ['id', 'status', 'created_at']
