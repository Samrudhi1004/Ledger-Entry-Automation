import os

path = 'backend/apps/parts/views.py'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace(
    "from rest_framework.permissions import IsAuthenticated",
    "from rest_framework.permissions import IsAuthenticated, IsAdminUser"
)

content = content.replace(
    """class AllParameterListView(generics.ListAPIView):
    \"\"\"GET /api/parts/parameters/all/\"\"\"
    from .serializers import GlobalInspectionParameterSerializer
    serializer_class = GlobalInspectionParameterSerializer
    permission_classes = [IsAuthenticated]
    queryset = InspectionParameter.objects.select_related('template__part__machine', 'template__created_by').all().order_by('-id')""",
    """class AllParameterListView(generics.ListAPIView):
    \"\"\"GET /api/parts/parameters/all/\"\"\"
    from .serializers import GlobalInspectionParameterSerializer
    serializer_class = GlobalInspectionParameterSerializer
    permission_classes = [IsAdminUser]
    pagination_class = None
    queryset = InspectionParameter.objects.select_related('template__part__machine', 'template__created_by').all().order_by('-id')"""
)

content = content.replace(
    """class AllProcessParameterListView(generics.ListAPIView):
    \"\"\"GET /api/parts/process-parameters/all/\"\"\"
    from .serializers import GlobalProcessParameterSerializer
    serializer_class = GlobalProcessParameterSerializer
    permission_classes = [IsAuthenticated]
    queryset = ProcessParameter.objects.select_related('template__part__machine', 'template__created_by').all().order_by('-id')""",
    """class AllProcessParameterListView(generics.ListAPIView):
    \"\"\"GET /api/parts/process-parameters/all/\"\"\"
    from .serializers import GlobalProcessParameterSerializer
    serializer_class = GlobalProcessParameterSerializer
    permission_classes = [IsAdminUser]
    pagination_class = None
    queryset = ProcessParameter.objects.select_related('template__part__machine', 'template__created_by').all().order_by('-id')"""
)

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)
print('Fixed views.py')
