from rest_framework import viewsets, status, generics
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from rest_framework.views import APIView
from django.contrib.auth import get_user_model
from django.db.models import Q, Max
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.core.cache import cache

from apps.messaging.models import Conversation, Message, MessageAttachment, MessageRead, MessageReaction
from apps.messaging.serializers import (
    ConversationSerializer,
    ConversationDetailSerializer,
    MessageSerializer,
    MessageAttachmentSerializer,
    MessageReactionSerializer,
    UserSearchSerializer
)

import cloudinary.uploader
import filetype
from io import BytesIO

User = get_user_model()

# Presence cache key prefix
PRESENCE_KEY_PREFIX = 'presence:user:'


class ConversationViewSet(viewsets.ModelViewSet):
    """
    ViewSet for managing conversations (list, create, retrieve, update, delete).
    """
    permission_classes = [IsAuthenticated]
    serializer_class = ConversationSerializer

    def get_queryset(self):
        """Return conversations where the user is a participant."""
        return Conversation.objects.filter(
            participants=self.request.user
        ).prefetch_related('participants', 'messages')

    def get_serializer_class(self):
        """Use detailed serializer for retrieve action."""
        if self.action == 'retrieve':
            return ConversationDetailSerializer
        return ConversationSerializer

    def perform_create(self, serializer):
        """Create conversation with current user as creator."""
        serializer.save()

    def perform_update(self, serializer):
        """Update conversation (check admin permissions)."""
        conversation = self.get_object()
        user = self.request.user

        # For group chats, only admin can update name/description
        if conversation.type == Conversation.Type.GROUP:
            if conversation.admin != user:
                # Only allow admin to update
                if 'name' in serializer.validated_data or 'description' in serializer.validated_data:
                    return Response(
                        {'error': 'Only group admin can update name/description'},
                        status=status.HTTP_403_FORBIDDEN
                    )

        serializer.save()

    def destroy(self, request, *args, **kwargs):
        """Leave conversation (remove self from participants)."""
        conversation = self.get_object()
        user = request.user

        # Remove user from participants
        conversation.participants.remove(user)

        # If user was admin and group still has members, transfer admin to oldest member
        if conversation.type == Conversation.Type.GROUP and conversation.admin == user:
            oldest_member = conversation.participants.order_by('id').first()
            if oldest_member:
                conversation.admin = oldest_member
                conversation.save()

        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=['post'], url_path='add-participant')
    def add_participant(self, request, pk=None):
        """Add a user to the conversation (admin-only for groups)."""
        conversation = self.get_object()
        user_id = request.data.get('user_id')

        if not user_id:
            return Response(
                {'error': 'user_id is required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Check admin permission for groups
        if conversation.type == Conversation.Type.GROUP:
            if conversation.admin != request.user:
                return Response(
                    {'error': 'Only group admin can add participants'},
                    status=status.HTTP_403_FORBIDDEN
                )

        try:
            user_to_add = User.objects.get(id=user_id)
            conversation.participants.add(user_to_add)
            return Response(
                {'message': f'{user_to_add.email} added to conversation'},
                status=status.HTTP_200_OK
            )
        except User.DoesNotExist:
            return Response(
                {'error': 'User not found'},
                status=status.HTTP_404_NOT_FOUND
            )

    @action(detail=True, methods=['post'], url_path='remove-participant')
    def remove_participant(self, request, pk=None):
        """Remove a user from the conversation (admin-only for groups)."""
        conversation = self.get_object()
        user_id = request.data.get('user_id')

        if not user_id:
            return Response(
                {'error': 'user_id is required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Check admin permission for groups
        if conversation.type == Conversation.Type.GROUP:
            if conversation.admin != request.user:
                return Response(
                    {'error': 'Only group admin can remove participants'},
                    status=status.HTTP_403_FORBIDDEN
                )

        try:
            user_to_remove = User.objects.get(id=user_id)
            conversation.participants.remove(user_to_remove)

            # If removed user was admin, transfer to oldest remaining member
            if conversation.admin == user_to_remove:
                oldest_member = conversation.participants.order_by('id').first()
                conversation.admin = oldest_member
                conversation.save()

            return Response(
                {'message': f'{user_to_remove.email} removed from conversation'},
                status=status.HTTP_200_OK
            )
        except User.DoesNotExist:
            return Response(
                {'error': 'User not found'},
                status=status.HTTP_404_NOT_FOUND
            )

    @action(detail=True, methods=['post'], url_path='transfer-admin')
    def transfer_admin(self, request, pk=None):
        """Transfer admin role to another member (admin-only)."""
        conversation = self.get_object()
        new_admin_id = request.data.get('user_id')

        if conversation.type != Conversation.Type.GROUP:
            return Response(
                {'error': 'Only group chats have admins'},
                status=status.HTTP_400_BAD_REQUEST
            )

        if conversation.admin != request.user:
            return Response(
                {'error': 'Only current admin can transfer admin role'},
                status=status.HTTP_403_FORBIDDEN
            )

        if not new_admin_id:
            return Response(
                {'error': 'user_id is required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            new_admin = User.objects.get(id=new_admin_id)

            # Check if new admin is a participant
            if not conversation.participants.filter(id=new_admin_id).exists():
                return Response(
                    {'error': 'User must be a participant to become admin'},
                    status=status.HTTP_400_BAD_REQUEST
                )

            conversation.admin = new_admin
            conversation.save()

            return Response(
                {'message': f'Admin role transferred to {new_admin.email}'},
                status=status.HTTP_200_OK
            )
        except User.DoesNotExist:
            return Response(
                {'error': 'User not found'},
                status=status.HTTP_404_NOT_FOUND
            )

    @action(detail=True, methods=['post'], url_path='pin-message')
    def pin_message(self, request, pk=None):
        """Pin or unpin a message in the conversation (max 3 pinned at a time)."""
        conversation = self.get_object()
        message_id = request.data.get('message_id')

        if not message_id:
            return Response(
                {'error': 'message_id is required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            message = Message.objects.get(id=message_id, conversation=conversation)
        except Message.DoesNotExist:
            return Response(
                {'error': 'Message not found in this conversation'},
                status=status.HTTP_404_NOT_FOUND
            )

        # Toggle: if already pinned, unpin it
        if conversation.pinned_messages.filter(id=message_id).exists():
            conversation.pinned_messages.remove(message)
            action_taken = 'unpinned'
        else:
            # Enforce max 3 pinned messages
            if conversation.pinned_messages.count() >= 3:
                return Response(
                    {'error': 'Maximum 3 messages can be pinned. Unpin one first.'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            conversation.pinned_messages.add(message)
            action_taken = 'pinned'

        # Return updated list of pinned messages
        from apps.messaging.serializers import MessageSerializer
        pinned = conversation.pinned_messages.filter(is_deleted=False).order_by('created_at')
        serializer = MessageSerializer(pinned, many=True, context={'request': request})
        return Response({
            'action': action_taken,
            'pinned_messages': serializer.data
        }, status=status.HTTP_200_OK)


class MessageViewSet(viewsets.ModelViewSet):
    """
    ViewSet for managing messages within conversations.
    """
    permission_classes = [IsAuthenticated]

    serializer_class = MessageSerializer

    def get_queryset(self):
        """Return messages from conversations where user is a participant."""
        conversation_id = self.kwargs.get('conversation_pk')
        if conversation_id:
            # Verify user is participant
            conversation = get_object_or_404(
                Conversation,
                id=conversation_id,
                participants=self.request.user
            )
            return Message.objects.filter(
                conversation=conversation,
                is_deleted=False
            ).select_related('sender').prefetch_related('attachments', 'read_by')

        return Message.objects.none()

    def list(self, request, *args, **kwargs):
        """List messages with pagination (cursor-based for infinite scroll)."""
        queryset = self.get_queryset().order_by('-created_at')

        # Simple pagination: get 50 messages
        limit = int(request.query_params.get('limit', 50))
        offset = int(request.query_params.get('offset', 0))

        messages = queryset[offset:offset + limit]
        serializer = self.get_serializer(messages, many=True)

        return Response({
            'results': serializer.data,
            'count': queryset.count(),
            'next_offset': offset + limit if len(serializer.data) == limit else None
        })

    def perform_create(self, serializer):
        """Create message with sender set to current user."""
        conversation_id = self.kwargs.get('conversation_pk')
        conversation = get_object_or_404(
            Conversation,
            id=conversation_id,
            participants=self.request.user
        )

        message = serializer.save(
            conversation=conversation,
            sender=self.request.user
        )

        # Update conversation's updated_at timestamp
        conversation.updated_at = timezone.now()
        conversation.save(update_fields=['updated_at'])

    def perform_update(self, serializer):
        """Update message (only sender can edit)."""
        message = self.get_object()
        if message.sender != self.request.user:
            return Response(
                {'error': 'Only sender can edit message'},
                status=status.HTTP_403_FORBIDDEN
            )

        serializer.save(edited_at=timezone.now())

    def destroy(self, request, *args, **kwargs):
        """Soft delete message (keep in database)."""
        message = self.get_object()

        # Only sender can delete
        if message.sender != request.user:
            return Response(
                {'error': 'Only sender can delete message'},
                status=status.HTTP_403_FORBIDDEN
            )

        message.is_deleted = True
        message.save()

        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=['post'])
    def read(self, request, conversation_pk=None, pk=None):
        """Mark message as read by current user."""
        message = self.get_object()

        # Create or get read receipt
        MessageRead.objects.get_or_create(
            message=message,
            user=request.user
        )

        return Response({'message': 'Message marked as read'}, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'])
    def forward(self, request, conversation_pk=None, pk=None):
        """Forward a message to another conversation with its attachments."""
        from channels.layers import get_channel_layer
        from asgiref.sync import async_to_sync

        original_message = self.get_object()
        target_conversation_id = request.data.get('target_conversation_id')

        if not target_conversation_id:
            return Response(
                {'error': 'target_conversation_id is required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Verify user is participant in target conversation
        try:
            target_conversation = Conversation.objects.get(
                id=target_conversation_id,
                participants=request.user
            )
        except Conversation.DoesNotExist:
            return Response(
                {'error': 'Target conversation not found or access denied'},
                status=status.HTTP_404_NOT_FOUND
            )

        # Create the forwarded message
        forwarded_message = Message.objects.create(
            conversation=target_conversation,
            sender=request.user,
            content=original_message.content or '',
            message_type=original_message.message_type
        )

        # Duplicate attachments
        for attachment in original_message.attachments.all():
            MessageAttachment.objects.create(
                message=forwarded_message,
                file_name=attachment.file_name,
                file_size=attachment.file_size,
                file_type=attachment.file_type,
                attachment_type=attachment.attachment_type,
                cloudinary_url=attachment.cloudinary_url,
                cloudinary_public_id=attachment.cloudinary_public_id,
                thumbnail_url=attachment.thumbnail_url,
                file_data=attachment.file_data
            )

        # Update target conversation timestamp
        target_conversation.updated_at = timezone.now()
        target_conversation.save(update_fields=['updated_at'])

        # Refresh the message from DB to get all related data
        forwarded_message.refresh_from_db()
        forwarded_message = Message.objects.select_related('sender').prefetch_related(
            'attachments', 'read_by'
        ).get(id=forwarded_message.id)

        # Serialize the new message
        serializer = self.get_serializer(forwarded_message)
        message_data = serializer.data

        # Broadcast via WebSocket to the target conversation
        try:
            channel_layer = get_channel_layer()

            if channel_layer is None:
                print("WARNING: Channel layer is None - WebSocket notifications will not be sent")
            else:
                print(f"Broadcasting forwarded message to conversation {target_conversation_id}")

                # Send to conversation group (for users currently viewing this conversation)
                async_to_sync(channel_layer.group_send)(
                    f'conversation_{target_conversation_id}',
                    {
                        'type': 'message_sent' if request.user.id == forwarded_message.sender.id else 'new_message',
                        'data': message_data
                    }
                )
                print(f"Sent to conversation group: conversation_{target_conversation_id}")

                # Send notification to all participants (for conversation list updates)
                for participant in target_conversation.participants.all():
                    print(f"Sending notification to user {participant.id}")
                    async_to_sync(channel_layer.group_send)(
                        f'user_notifications_{participant.id}',
                        {
                            'type': 'new_message_notification',
                            'data': {
                                'conversation_id': str(target_conversation_id),
                                'message': message_data
                            }
                        }
                    )
                    print(f"Notification sent to user_notifications_{participant.id}")
        except Exception as e:
            # Log the error but still return success since message was created
            print(f"Error broadcasting forwarded message: {e}")
            import traceback
            traceback.print_exc()

        return Response(message_data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post', 'delete'], url_path='react')
    def react(self, request, conversation_pk=None, pk=None):
        """Add or remove emoji reaction to/from a message."""
        from channels.layers import get_channel_layer
        from asgiref.sync import async_to_sync

        message = self.get_object()
        conversation = message.conversation
        emoji = request.data.get('emoji')

        if not emoji:
            return Response(
                {'error': 'emoji is required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        if request.method == 'POST':
            # Add or toggle reaction
            reaction, created = MessageReaction.objects.get_or_create(
                message=message,
                user=request.user,
                emoji=emoji
            )

            if not created:
                # If reaction already exists, remove it (toggle)
                reaction.delete()
                action = 'removed'
            else:
                action = 'added'

        elif request.method == 'DELETE':
            # Remove reaction
            try:
                reaction = MessageReaction.objects.get(
                    message=message,
                    user=request.user,
                    emoji=emoji
                )
                reaction.delete()
                action = 'removed'
            except MessageReaction.DoesNotExist:
                return Response(
                    {'error': 'Reaction not found'},
                    status=status.HTTP_404_NOT_FOUND
                )

        # Update conversation timestamp to move it to top
        conversation.updated_at = timezone.now()
        conversation.save(update_fields=['updated_at'])

        # Get updated message with reactions
        message.refresh_from_db()
        message = Message.objects.select_related('sender').prefetch_related(
            'attachments', 'read_by', 'reactions__user'
        ).get(id=message.id)

        serializer = self.get_serializer(message)

        # Broadcast reaction update via WebSocket
        try:
            channel_layer = get_channel_layer()
            if channel_layer:
                async_to_sync(channel_layer.group_send)(
                    f'conversation_{conversation_pk}',
                    {
                        'type': 'message_reaction',
                        'data': {
                            'message_id': str(message.id),
                            'reactions': serializer.data.get('reactions', []),
                            'action': action,
                            'user_id': request.user.id,
                            'emoji': emoji
                        }
                    }
                )
        except Exception as e:
            print(f"Error broadcasting reaction: {e}")

        return Response({
            'message': f'Reaction {action}',
            'reactions': serializer.data.get('reactions', [])
        }, status=status.HTTP_200_OK)


class FileUploadView(generics.CreateAPIView):
    """
    Upload file attachments for messages.
    Hybrid storage: Images to Cloudinary, Documents to PostgreSQL.
    """
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]
    serializer_class = MessageAttachmentSerializer

    def create(self, request, *args, **kwargs):
        """Handle file upload with validation."""
        file = request.FILES.get('file')
        message_id = request.data.get('message_id')

        if not file or not message_id:
            return Response(
                {'error': 'file and message_id are required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Verify message exists and user is participant
        try:
            message = Message.objects.select_related('conversation').get(id=message_id)
            if not message.conversation.participants.filter(id=request.user.id).exists():
                return Response(
                    {'error': 'Access denied'},
                    status=status.HTTP_403_FORBIDDEN
                )
        except Message.DoesNotExist:
            return Response(
                {'error': 'Message not found'},
                status=status.HTTP_404_NOT_FOUND
            )

        # Validate file type
        file_bytes = file.read(2048)
        file.seek(0)  # Reset file pointer
        kind = filetype.guess(file_bytes)
        if kind is not None:
            file_type = kind.mime
        else:
            # Fall back to generic binary if detection fails
            import mimetypes
            file_type = mimetypes.guess_type(file.name)[0] or 'application/octet-stream'

        # Determine attachment type
        if file_type.startswith('image/'):
            attachment_type = MessageAttachment.AttachmentType.IMAGE
        else:
            attachment_type = MessageAttachment.AttachmentType.DOCUMENT

        # File size validation
        file_size = file.size
        if attachment_type == MessageAttachment.AttachmentType.IMAGE and file_size > 10 * 1024 * 1024:
            return Response(
                {'error': 'Image files must be under 10MB'},
                status=status.HTTP_400_BAD_REQUEST
            )
        elif attachment_type == MessageAttachment.AttachmentType.DOCUMENT and file_size > 5 * 1024 * 1024:
            return Response(
                {'error': 'Document files must be under 5MB'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Create attachment
        attachment = MessageAttachment.objects.create(
            message=message,
            file_name=file.name,
            file_size=file_size,
            file_type=file_type,
            attachment_type=attachment_type
        )

        # Upload based on type
        try:
            if attachment_type == MessageAttachment.AttachmentType.IMAGE:
                # Upload to Cloudinary
                upload_result = cloudinary.uploader.upload(
                    file,
                    folder='messaging/images',
                    resource_type='image'
                )
                attachment.cloudinary_url = upload_result['secure_url']
                attachment.cloudinary_public_id = upload_result['public_id']
                attachment.thumbnail_url = cloudinary.uploader.explicit(
                    upload_result['public_id'],
                    type='upload',
                    eager=[{'width': 200, 'height': 200, 'crop': 'thumb'}]
                )['eager'][0]['secure_url']
            else:
                # Store in PostgreSQL
                attachment.file_data = file.read()

            attachment.save()

            serializer = self.get_serializer(attachment)
            return Response(serializer.data, status=status.HTTP_201_CREATED)

        except Exception as e:
            attachment.delete()
            return Response(
                {'error': f'Upload failed: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class UserSearchView(generics.ListAPIView):
    """
    Search users by name or email (organization-wide).
    """
    permission_classes = [IsAuthenticated]
    serializer_class = UserSearchSerializer

    def get_queryset(self):
        """Search users by query parameter."""
        query = self.request.query_params.get('q', '').strip()

        if not query:
            # Return suggested users — same plant first, fall back to all active users
            user_plant = self.request.user.plant
            if user_plant:
                return User.objects.filter(
                    plant=user_plant,
                    is_active=True
                ).exclude(id=self.request.user.id)[:10]
            else:
                # No plant assigned — return all active users as suggestions
                return User.objects.filter(
                    is_active=True
                ).exclude(id=self.request.user.id)[:10]

        # Search org-wide by first name, last name, or email (no plant restriction)
        return User.objects.filter(
            Q(first_name__icontains=query) |
            Q(last_name__icontains=query) |
            Q(email__icontains=query),
            is_active=True
        ).exclude(id=self.request.user.id)[:20]


class UserPresenceView(APIView):
    """
    Check if a user is currently online.
    GET /api/messaging/users/<user_id>/presence/
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, user_id):
        cache_key = f'{PRESENCE_KEY_PREFIX}{user_id}'
        is_online = cache.get(cache_key) == 'online'

        return Response({
            'user_id': user_id,
            'is_online': is_online,
            'status': 'online' if is_online else 'offline'
        })


class BulkUserPresenceView(APIView):
    """
    Check presence status for multiple users at once.
    POST /api/messaging/users/presence/bulk/
    Body: { "user_ids": [1, 2, 3] }
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        user_ids = request.data.get('user_ids', [])

        if not user_ids or not isinstance(user_ids, list):
            return Response(
                {'error': 'user_ids must be a non-empty list'},
                status=status.HTTP_400_BAD_REQUEST
            )

        presence_data = {}
        for user_id in user_ids:
            cache_key = f'{PRESENCE_KEY_PREFIX}{user_id}'
            is_online = cache.get(cache_key) == 'online'
            presence_data[str(user_id)] = {
                'is_online': is_online,
                'status': 'online' if is_online else 'offline'
            }

        return Response(presence_data)


class DownloadAttachmentView(APIView):
    """
    Download or view a document attachment stored in PostgreSQL.
    GET /api/messaging/attachments/<attachment_id>/download/
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, attachment_id):
        from django.http import HttpResponse

        try:
            attachment = MessageAttachment.objects.select_related('message__conversation').get(id=attachment_id)

            # Verify user is a participant in the conversation
            if not attachment.message.conversation.participants.filter(id=request.user.id).exists():
                return Response(
                    {'error': 'Access denied'},
                    status=status.HTTP_403_FORBIDDEN
                )

            # For images, redirect to Cloudinary URL
            if attachment.attachment_type == MessageAttachment.AttachmentType.IMAGE:
                return Response({
                    'url': attachment.cloudinary_url
                })

            # For documents, serve from PostgreSQL
            if not attachment.file_data:
                return Response(
                    {'error': 'File data not found'},
                    status=status.HTTP_404_NOT_FOUND
                )

            response = HttpResponse(attachment.file_data, content_type=attachment.file_type)
            response['Content-Disposition'] = f'attachment; filename="{attachment.file_name}"'
            response['Content-Length'] = attachment.file_size
            return response

        except MessageAttachment.DoesNotExist:
            return Response(
                {'error': 'Attachment not found'},
                status=status.HTTP_404_NOT_FOUND
            )
