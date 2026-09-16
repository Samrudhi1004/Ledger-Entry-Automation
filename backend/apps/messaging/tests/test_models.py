from django.test import TestCase
from django.contrib.auth import get_user_model
from apps.messaging.models import Conversation, Message, MessageAttachment, MessageRead, MessageReaction
from apps.machines.models import Plant

User = get_user_model()

class MessagingModelTests(TestCase):
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
        self.user3 = User.objects.create_user(
            username='user3',
            email='user3@test.com',
            password='testpass123',
            first_name='User',
            last_name='Three',
            role='supervisor'
        )

    def test_direct_conversation_creation(self):
        conv = Conversation.objects.create(type=Conversation.Type.DIRECT)
        conv.participants.add(self.user1, self.user2)
        
        self.assertEqual(conv.participants.count(), 2)
        self.assertEqual(str(conv), f"Direct conversation {conv.id}")

    def test_group_conversation_creation(self):
        conv = Conversation.objects.create(
            type=Conversation.Type.GROUP,
            name='Test Group',
            created_by=self.user1,
            admin=self.user1
        )
        conv.participants.add(self.user1, self.user2, self.user3)
        
        self.assertEqual(conv.participants.count(), 3)
        self.assertEqual(str(conv), "Group: Test Group")
        self.assertEqual(conv.admin, self.user1)

    def test_message_creation(self):
        conv = Conversation.objects.create(type=Conversation.Type.DIRECT)
        conv.participants.add(self.user1, self.user2)

        msg = Message.objects.create(
            conversation=conv,
            sender=self.user1,
            content="Hello World",
            message_type=Message.MessageType.TEXT
        )

        self.assertEqual(msg.sender, self.user1)
        self.assertEqual(msg.content, "Hello World")
        self.assertEqual(str(msg), f"Message from {self.user1.email} at {msg.created_at}")

    def test_message_read(self):
        conv = Conversation.objects.create(type=Conversation.Type.DIRECT)
        conv.participants.add(self.user1, self.user2)
        msg = Message.objects.create(conversation=conv, sender=self.user1, content="Read this")

        read_receipt = MessageRead.objects.create(message=msg, user=self.user2)
        self.assertEqual(read_receipt.user, self.user2)
        self.assertEqual(read_receipt.message, msg)

    def test_message_reaction(self):
        conv = Conversation.objects.create(type=Conversation.Type.DIRECT)
        conv.participants.add(self.user1, self.user2)
        msg = Message.objects.create(conversation=conv, sender=self.user1, content="React to this")

        reaction = MessageReaction.objects.create(message=msg, user=self.user2, emoji="👍")
        self.assertEqual(reaction.user, self.user2)
        self.assertEqual(reaction.emoji, "👍")
