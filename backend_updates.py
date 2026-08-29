import os

serializers_path = 'backend/apps/parts/serializers.py'
with open(serializers_path, 'a', encoding='utf-8') as f:
    f.write('''

class GlobalInspectionParameterSerializer(InspectionParameterSerializer):
    template_name = serializers.CharField(source='template.name', read_only=True)
    part_number = serializers.CharField(source='template.part.part_number', read_only=True)
    machine_code = serializers.CharField(source='template.part.machine.machine_code', read_only=True)
    created_by_name = serializers.CharField(source='template.created_by.get_full_name', read_only=True)

    class Meta(InspectionParameterSerializer.Meta):
        fields = InspectionParameterSerializer.Meta.fields + ['template_name', 'part_number', 'machine_code', 'created_by_name']

class GlobalProcessParameterSerializer(ProcessParameterSerializer):
    template_name = serializers.CharField(source='template.name', read_only=True)
    part_number = serializers.CharField(source='template.part.part_number', read_only=True)
    machine_code = serializers.CharField(source='template.part.machine.machine_code', read_only=True)
    created_by_name = serializers.CharField(source='template.created_by.get_full_name', read_only=True)

    class Meta(ProcessParameterSerializer.Meta):
        fields = ProcessParameterSerializer.Meta.fields + ['template_name', 'part_number', 'machine_code', 'created_by_name']
''')

views_path = 'backend/apps/parts/views.py'
with open(views_path, 'a', encoding='utf-8') as f:
    f.write('''

class AllParameterListView(generics.ListAPIView):
    """GET /api/parts/parameters/all/"""
    from .serializers import GlobalInspectionParameterSerializer
    serializer_class = GlobalInspectionParameterSerializer
    permission_classes = [IsAuthenticated]
    queryset = InspectionParameter.objects.select_related('template__part__machine', 'template__created_by').all().order_by('-id')


class AllProcessParameterListView(generics.ListAPIView):
    """GET /api/parts/process-parameters/all/"""
    from .serializers import GlobalProcessParameterSerializer
    serializer_class = GlobalProcessParameterSerializer
    permission_classes = [IsAuthenticated]
    queryset = ProcessParameter.objects.select_related('template__part__machine', 'template__created_by').all().order_by('-id')
''')
print("Added global serializers and views.")
