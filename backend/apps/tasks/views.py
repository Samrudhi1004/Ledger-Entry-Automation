from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.db.models import Q
from django.core.mail import send_mail
from django.conf import settings
import threading
from .models import Task
from .serializers import TaskSerializer, TaskCreateSerializer

class TaskViewSet(viewsets.ModelViewSet):
    serializer_class = TaskSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if user.is_admin_user:
            return Task.objects.all()
        # For non-admins, return tasks they allocated or tasks allocated to them
        return Task.objects.filter(Q(allocated_by=user) | Q(allocated_to=user)).distinct()

    def create(self, request, *args, **kwargs):
        user = request.user
        # Operators cannot allocate tasks
        if user.is_operator:
            return Response({"detail": "Operators are not allowed to allocate tasks."}, status=status.HTTP_403_FORBIDDEN)
        
        serializer = TaskCreateSerializer(data=request.data)
        if serializer.is_valid():
            task = serializer.save(allocated_by=user)
            
            # Send email notification in background
            if task.allocated_to and task.allocated_to.email:
                def send_task_email():
                    from django.utils.html import escape
                    safe_title = escape(task.title)
                    safe_description = escape(task.description)
                    
                    subject = f"New Task Allocated: {task.title}"
                    message = f"Hi {task.allocated_to.first_name or 'User'},\n\nA new task '{task.title}' has been assigned to you by {user.first_name} {user.last_name}.\n\nDescription: {task.description}\nDeadline: {task.deadline}"
                    html_message = f"""
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden;">
                        <div style="background-color: #2563eb; padding: 24px; text-align: center;">
                            <h1 style="color: white; margin: 0; font-size: 24px; font-weight: 600;">New Task Allocated</h1>
                        </div>
                        <div style="padding: 32px 24px; background-color: #ffffff; color: #374151;">
                            <p style="font-size: 16px; margin-top: 0;">Hi <strong>{task.allocated_to.first_name or 'User'}</strong>,</p>
                            <p style="font-size: 16px; line-height: 1.5; margin-bottom: 24px;">
                                A new task has been assigned to you by <strong>{user.first_name} {user.last_name}</strong>.
                            </p>
                            <div style="background-color: #f3f4f6; padding: 16px; border-radius: 6px; margin-bottom: 24px;">
                                <h3 style="margin-top: 0; color: #111827;">{safe_title}</h3>
                                <p style="font-size: 14px; margin-bottom: 8px;"><strong>Description:</strong> {safe_description}</p>
                                <p style="font-size: 14px; margin-bottom: 0; color: #dc2626;"><strong>Deadline:</strong> {task.deadline}</p>
                            </div>
                            <p style="font-size: 14px; color: #6b7280; margin-bottom: 0;">
                                Please check your dashboard to accept and manage this task.
                            </p>
                        </div>
                    </div>
                    """
                    from_email = getattr(settings, 'DEFAULT_FROM_EMAIL', 'noreply@example.com')
                    try:
                        send_mail(subject, message, from_email, [task.allocated_to.email], fail_silently=True, html_message=html_message)
                    except Exception:
                        pass
                
                threading.Thread(target=send_task_email).start()

            return Response(TaskSerializer(task).data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'])
    def accept(self, request, pk=None):
        task = self.get_object()
        if task.allocated_to != request.user:
            return Response({"detail": "You can only accept tasks assigned to you."}, status=status.HTTP_403_FORBIDDEN)
        
        if task.status not in (Task.Status.PENDING,):
            return Response({"detail": "Only pending tasks can be accepted."}, status=status.HTTP_400_BAD_REQUEST)
        
        task.status = Task.Status.ACCEPTED
        task.save()
        return Response(TaskSerializer(task).data)

    @action(detail=True, methods=['post'])
    def complete(self, request, pk=None):
        task = self.get_object()
        if task.allocated_to != request.user:
            return Response({"detail": "You can only complete tasks assigned to you."}, status=status.HTTP_403_FORBIDDEN)

        if task.status not in (Task.Status.ACCEPTED, Task.Status.PENDING):
            return Response({"detail": "Only accepted or pending tasks can be marked as complete."}, status=status.HTTP_400_BAD_REQUEST)

        task.status = Task.Status.COMPLETED
        task.save()
        return Response(TaskSerializer(task).data)

    @action(detail=True, methods=['post'])
    def flag_issue(self, request, pk=None):
        task = self.get_object()
        if task.allocated_to != request.user:
            return Response({"detail": "You can only flag issues for tasks assigned to you."}, status=status.HTTP_403_FORBIDDEN)
        
        if task.status in (Task.Status.COMPLETED, Task.Status.CANCELLED):
            return Response({"detail": "Cannot flag an issue on a completed or cancelled task."}, status=status.HTTP_400_BAD_REQUEST)
        
        issue_desc = request.data.get('issue_description')
        if not issue_desc:
            return Response({"detail": "Issue description is required."}, status=status.HTTP_400_BAD_REQUEST)

        task.status = Task.Status.FLAGGED_ISSUE
        task.issue_description = issue_desc
        task.save()
        # Note: WebSocket/Push notification logic can be triggered here.
        return Response(TaskSerializer(task).data)

    @action(detail=True, methods=['post'])
    def resolve_issue(self, request, pk=None):
        task = self.get_object()
        if task.allocated_by != request.user and not request.user.is_admin_user:
            return Response({"detail": "Only the allocator or admin can resolve this issue."}, status=status.HTTP_403_FORBIDDEN)
        
        if task.status != Task.Status.FLAGGED_ISSUE:
            return Response({"detail": "Task is not flagged with an issue."}, status=status.HTTP_400_BAD_REQUEST)
        
        action_type = request.data.get('action', 'reopen')
        
        if action_type == 'cancel':
            task.status = Task.Status.CANCELLED
            task.issue_description = None
        else:
            task.status = Task.Status.ACCEPTED
            task.issue_description = None
            if action_type == 'extend':
                new_deadline = request.data.get('new_deadline')
                if new_deadline:
                    task.deadline = new_deadline
            
            instructions = request.data.get('instructions')
            if instructions and instructions.strip():
                task.description = f"{task.description}\n\n[Update]: {instructions.strip()}"

        task.save()
        return Response(TaskSerializer(task).data)
