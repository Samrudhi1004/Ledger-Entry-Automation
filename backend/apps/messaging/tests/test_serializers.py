from django.test import TestCase
from django.contrib.auth import get_user_model
from apps.messaging.models import Conversation, Message
from apps.messaging.serializers import ConversationSerializer, MessageSerializer

User = get_user_model()

class MessagingSerializerTests(TestCase):
    def setUp(self):
        self.user1 = User.objects.create_user(
            username='user1',
            email='user1@test.com',
            password='testpass123',
            first_name='User',
            last_name='One',
            role='operator'
        )
        self.user2 = User.objects.create_user(
            username='user2',
            email='user2@test.com',
            password='testpass123',
            first_name='User',
            last_name='Two',
            role='quality_engineer'
        )

        self.conversation = Conversation.objects.create(type=Conversation.Type.DIRECT)
        self.conversation.participants.add(self.user1, self.user2)

    def test_conversation_serializer(self):
        class MockRequest:
            def __init__(self, user):
                self.user = user
                
        serializer = ConversationSerializer(instance=self.conversation, context={'request': MockRequest(self.user1)})
        data = serializer.data
        self.assertEqual(data['type'], Conversation.Type.DIRECT)
        self.assertEqual(len(data['participants']), 2)
        self.assertEqual(data['id'], str(self.conversation.id))

    def test_message_serializer(self):
        message = Message.objects.create(
            conversation=self.conversation,
            sender=self.user1,
            content="Test message"
        )
        serializer = MessageSerializer(instance=message, context={'request': None})
        data = serializer.data
        self.assertEqual(data['content'], "Test message")
        self.assertEqual(str(data['sender']['id']), str(self.user1.id))
        self.assertEqual(str(data['conversation']), str(self.conversation.id))
