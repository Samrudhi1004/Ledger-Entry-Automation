from rest_framework import serializers
from django.contrib.auth import get_user_model
from apps.messaging.models import Conversation, Message, MessageAttachment, MessageRead

User = get_user_model()


class UserBasicSerializer(serializers.ModelSerializer):
    """Basic user info for messaging context."""
    class Meta:
        model = User
        fields = ['id', 'email', 'first_name', 'last_name', 'role', 'profile_photo']
        read_only_fields = fields


class MessageAttachmentSerializer(serializers.ModelSerializer):
    """Serializer for message attachments."""
    class Meta:
        model = MessageAttachment
        fields = [
            'id', 'file_name', 'file_size', 'file_type',
            'attachment_type', 'cloudinary_url', 'thumbnail_url',
            'uploaded_at'
        ]
        read_only_fields = ['id', 'uploaded_at']


class MessageReadSerializer(serializers.ModelSerializer):
    """Serializer for message read receipts."""
    user = UserBasicSerializer(read_only=True)

    class Meta:
        model = MessageRead
        fields = ['user', 'read_at']
        read_only_fields = fields


class MessageSerializer(serializers.ModelSerializer):
    """Serializer for messages with attachments and read status."""
    sender = UserBasicSerializer(read_only=True)
    attachments = MessageAttachmentSerializer(many=True, read_only=True)
    read_by = MessageReadSerializer(many=True, read_only=True)
    reply_to_message = serializers.SerializerMethodField()

    class Meta:
        model = Message
        fields = [
            'id', 'conversation', 'sender', 'content', 'message_type',
            'meeting_link', 'meeting_scheduled_at', 'reply_to',
            'reply_to_message', 'attachments', 'read_by',
            'created_at', 'edited_at', 'is_deleted'
        ]
        read_only_fields = ['id', 'sender', 'created_at', 'edited_at']

    def get_reply_to_message(self, obj):
        """Get basic info of the message being replied to."""
        if obj.reply_to:
            return {
                'id': str(obj.reply_to.id),
                'sender': UserBasicSerializer(obj.reply_to.sender).data,
                'content': obj.reply_to.content[:100],  # First 100 chars
                'created_at': obj.reply_to.created_at,
            }
        return None

    def create(self, validated_data):
        """Create message with current user as sender."""
        validated_data['sender'] = self.context['request'].user
        return super().create(validated_data)


class ConversationSerializer(serializers.ModelSerializer):
    """Serializer for conversations with participants and last message."""
    participants = UserBasicSerializer(many=True, read_only=True)
    participant_ids = serializers.ListField(
        child=serializers.IntegerField(),
        write_only=True,
        required=False
    )
    created_by = UserBasicSerializer(read_only=True)
    admin = UserBasicSerializer(read_only=True)
    last_message = serializers.SerializerMethodField()
    unread_count = serializers.SerializerMethodField()

    class Meta:
        model = Conversation
        fields = [
            'id', 'type', 'name', 'description', 'participants',
            'participant_ids', 'created_by', 'admin', 'plant',
            'last_message', 'unread_count', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_by', 'created_at', 'updated_at']

    def get_last_message(self, obj):
        """Get the last message in the conversation."""
        last_message = obj.messages.filter(is_deleted=False).order_by('-created_at').first()
        if last_message:
            return {
                'id': str(last_message.id),
                'sender': UserBasicSerializer(last_message.sender).data,
                'content': last_message.content[:100],  # Preview
                'message_type': last_message.message_type,
                'created_at': last_message.created_at,
            }
        return None

    def get_unread_count(self, obj):
        """Get unread message count for current user."""
        user = self.context['request'].user
        # Messages in this conversation not read by current user
        unread = obj.messages.filter(is_deleted=False).exclude(
            read_by__user=user
        ).exclude(sender=user).count()
        return unread

    def create(self, validated_data):
        """Create conversation with participants."""
        participant_ids = validated_data.pop('participant_ids', [])
        current_user = self.context['request'].user

        # Set created_by and admin
        validated_data['created_by'] = current_user
        if validated_data.get('type') == Conversation.Type.GROUP:
            validated_data['admin'] = current_user

        conversation = super().create(validated_data)

        # Add participants
        if participant_ids:
            conversation.participants.set(participant_ids)

        # Always include the creator
        conversation.participants.add(current_user)

        return conversation

    def update(self, instance, validated_data):
        """Update conversation (admin-only fields checked in view)."""
        participant_ids = validated_data.pop('participant_ids', None)

        conversation = super().update(instance, validated_data)

        if participant_ids is not None:
            conversation.participants.set(participant_ids)

        return conversation


class ConversationDetailSerializer(ConversationSerializer):
    """Detailed conversation serializer with recent messages."""
    recent_messages = serializers.SerializerMethodField()

    class Meta(ConversationSerializer.Meta):
        fields = ConversationSerializer.Meta.fields + ['recent_messages']

    def get_recent_messages(self, obj):
        """Get the 50 most recent messages."""
        messages = obj.messages.filter(is_deleted=False).order_by('-created_at')[:50]
        return MessageSerializer(messages, many=True, context=self.context).data


class UserSearchSerializer(serializers.ModelSerializer):
    """Serializer for user search results."""
    plant_name = serializers.CharField(source='plant.name', read_only=True)

    class Meta:
        model = User
        fields = [
            'id', 'email', 'first_name', 'last_name', 'role',
            'profile_photo', 'plant', 'plant_name'
        ]
        read_only_fields = fields
