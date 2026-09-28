from pathlib import Path
from rest_framework import serializers
from .models import Task, TaskAttachment
from apps.users.models import User


class UserBasicSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'username', 'first_name', 'last_name', 'role', 'employee_id']


class TaskAttachmentSerializer(serializers.ModelSerializer):
    url = serializers.SerializerMethodField()

    def get_url(self, obj):
        request = self.context.get('request')
        return request.build_absolute_uri(obj.file.url) if request else obj.file.url

    class Meta:
        model = TaskAttachment
        fields = ['id', 'file_name', 'content_type', 'file_size', 'uploaded_at', 'url']


class TaskSerializer(serializers.ModelSerializer):
    allocated_by = UserBasicSerializer(read_only=True)
    allocated_to = UserBasicSerializer(read_only=True)
    attachments = TaskAttachmentSerializer(many=True, read_only=True)

    class Meta:
        model = Task
        fields = '__all__'


class TaskCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Task
        fields = ['title', 'description', 'allocated_to', 'deadline']


class TaskCompleteSerializer(serializers.Serializer):
    files = serializers.ListField(
        child=serializers.FileField(),
        required=False,
        allow_empty=True,
    )

    def validate_files(self, value):
        allowed_extensions = {'.jpg', '.jpeg', '.png', '.pdf', '.mp4', '.mov', '.docx', '.xlsx'}
        max_size = 20 * 1024 * 1024  # 20 MB per file

        for f in value:
            ext = Path(f.name).suffix.lower()
            if ext not in allowed_extensions:
                raise serializers.ValidationError(
                    f"'{f.name}': unsupported file type. Allowed: images, PDF, video, Word, Excel."
                )
            if f.size > max_size:
                raise serializers.ValidationError(f"'{f.name}' exceeds the 20 MB limit.")
        return value
