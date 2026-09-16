from django.test import TestCase
from django.urls import reverse
from rest_framework.test import APIClient
from django.contrib.auth import get_user_model
from apps.messaging.models import Conversation, Message
import json

User = get_user_model()

class MessagingViewTests(TestCase):
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

        self.client1 = APIClient()
        # In this project simplejwt might be used, but since we are testing endpoints 
        # using standard DRF client, we can authenticate using force_authenticate.
        self.client1.force_authenticate(user=self.user1)
        
        self.conversation = Conversation.objects.create(type=Conversation.Type.DIRECT)
        self.conversation.participants.add(self.user1, self.user2)

    def test_list_conversations(self):
        response = self.client1.get('/api/messaging/conversations/')
        self.assertEqual(response.status_code, 200)
        
        # Check if the results exist (pagination is typically present)
        data = response.data['results'] if 'results' in response.data else response.data
        self.assertGreaterEqual(len(data), 1)
        self.assertEqual(data[0]['id'], str(self.conversation.id))

    def test_create_group_conversation(self):
        payload = {
            "type": "group",
            "name": "Testing Group",
            "participant_ids": [self.user2.id]
        }
        response = self.client1.post('/api/messaging/conversations/', payload, format='json')
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data['type'], "group")
        self.assertEqual(response.data['name'], "Testing Group")

    def test_send_message(self):
        payload = {
            "conversation": str(self.conversation.id),
            "content": "Hello via API"
        }
        response = self.client1.post(f'/api/messaging/conversations/{self.conversation.id}/messages/', payload, format='json')
        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(response.data['content'], "Hello via API")
        self.assertEqual(str(response.data['sender']['id']), str(self.user1.id))

    def test_list_messages(self):
        Message.objects.create(conversation=self.conversation, sender=self.user1, content="Hi")
        response = self.client1.get(f'/api/messaging/conversations/{self.conversation.id}/messages/')
        self.assertEqual(response.status_code, 200)
        
        data = response.data['results'] if 'results' in response.data else response.data
        self.assertGreaterEqual(len(data), 1)
        self.assertEqual(data[0]['content'], "Hi")
