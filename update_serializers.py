import os

path = 'backend/apps/parts/serializers.py'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace(
    "created_by_name = serializers.CharField(source='template.created_by.get_full_name', read_only=True)",
    "created_by_name = serializers.CharField(source='template.created_by.get_full_name', read_only=True)\n    created_at = serializers.DateTimeField(source='template.created_at', read_only=True, format='%d %b %Y, %I:%M %p')"
)

content = content.replace(
    "fields = InspectionParameterSerializer.Meta.fields + ['template_name', 'part_number', 'machine_code', 'created_by_name']",
    "fields = InspectionParameterSerializer.Meta.fields + ['template_name', 'part_number', 'machine_code', 'created_by_name', 'created_at']"
)
content = content.replace(
    "fields = ProcessParameterSerializer.Meta.fields + ['template_name', 'part_number', 'machine_code', 'created_by_name']",
    "fields = ProcessParameterSerializer.Meta.fields + ['template_name', 'part_number', 'machine_code', 'created_by_name', 'created_at']"
)

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)
print('Updated serializers.py')
