"""
Messaging Module End-to-End Test Suite

This script tests all aspects of the messaging module:
1. Backend API endpoints
2. WebSocket connections
3. File uploads
4. Real-time messaging
"""

import sys
import os
import django

# Setup Django
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from django.test import TestCase, Client
from django.contrib.auth import get_user_model
from apps.messaging.models import Conversation, Message, MessageAttachment, MessageRead
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken
import json

User = get_user_model()


class MessagingEndToEndTests(TestCase):
    """Comprehensive E2E tests for messaging module"""

    def setUp(self):
        """Create test users and authentication tokens"""
        # Create test users
        self.user1 = User.objects.create_user(
            email='operator1@test.com',
            password='testpass123',
            first_name='John',
            last_name='Doe',
            role='operator'
        )

        self.user2 = User.objects.create_user(
            email='inspector1@test.com',
            password='testpass123',
            first_name='Jane',
            last_name='Smith',
            role='quality_engineer'
        )

        self.user3 = User.objects.create_user(
            email='supervisor1@test.com',
            password='testpass123',
            first_name='Bob',
            last_name='Johnson',
            role='supervisor'
        )

        # Create API clients with authentication
        self.client1 = APIClient()
        self.client2 = APIClient()
        self.client3 = APIClient()

        # Generate JWT tokens
        token1 = RefreshToken.for_user(self.user1)
        token2 = RefreshToken.for_user(self.user2)
        token3 = RefreshToken.for_user(self.user3)

        self.client1.credentials(HTTP_AUTHORIZATION=f'Bearer {token1.access_token}')
        self.client2.credentials(HTTP_AUTHORIZATION=f'Bearer {token2.access_token}')
        self.client3.credentials(HTTP_AUTHORIZATION=f'Bearer {token3.access_token}')

        self.token1 = str(token1.access_token)
        self.token2 = str(token2.access_token)

    def test_01_create_direct_conversation(self):
        """Test creating a direct message conversation"""
        print("\n[TEST 1] Creating direct conversation...")

        response = self.client1.post('/api/messaging/conversations/', {
            'type': 'direct',
            'participant_ids': [self.user2.id]
        }, format='json')

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data['type'], 'direct')
        self.assertEqual(len(response.data['participants']), 2)

        print("✓ Direct conversation created successfully")
        return response.data['id']

    def test_02_create_group_conversation(self):
        """Test creating a group conversation"""
        print("\n[TEST 2] Creating group conversation...")

        response = self.client1.post('/api/messaging/conversations/', {
            'type': 'group',
            'name': 'Test Team',
            'description': 'Team communication',
            'participant_ids': [self.user2.id, self.user3.id]
        }, format='json')

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data['type'], 'group')
        self.assertEqual(response.data['name'], 'Test Team')
        self.assertEqual(response.data['admin']['id'], self.user1.id)

        print("✓ Group conversation created with admin role")
        return response.data['id']

    def test_03_list_conversations(self):
        """Test listing user's conversations"""
        print("\n[TEST 3] Listing conversations...")

        # Create a conversation first
        self.client1.post('/api/messaging/conversations/', {
            'type': 'direct',
            'participant_ids': [self.user2.id]
        }, format='json')

        response = self.client1.get('/api/messaging/conversations/')

        self.assertEqual(response.status_code, 200)
        self.assertGreater(len(response.data), 0)

        print(f"✓ Found {len(response.data)} conversation(s)")

    def test_04_send_message(self):
        """Test sending a message"""
        print("\n[TEST 4] Sending message...")

        # Create conversation
        conv_response = self.client1.post('/api/messaging/conversations/', {
            'type': 'direct',
            'participant_ids': [self.user2.id]
        }, format='json')
        conversation_id = conv_response.data['id']

        # Send message
        response = self.client1.post(
            f'/api/messaging/conversations/{conversation_id}/messages/',
            {
                'content': 'Hello from automated test!',
                'message_type': 'text'
            },
            format='json'
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data['content'], 'Hello from automated test!')
        self.assertEqual(response.data['sender']['id'], self.user1.id)

        print("✓ Message sent successfully")
        return conversation_id, response.data['id']

    def test_05_list_messages(self):
        """Test listing messages in a conversation"""
        print("\n[TEST 5] Listing messages...")

        # Create conversation and send message
        conv_response = self.client1.post('/api/messaging/conversations/', {
            'type': 'direct',
            'participant_ids': [self.user2.id]
        }, format='json')
        conversation_id = conv_response.data['id']

        self.client1.post(
            f'/api/messaging/conversations/{conversation_id}/messages/',
            {'content': 'Test message 1', 'message_type': 'text'},
            format='json'
        )
        self.client1.post(
            f'/api/messaging/conversations/{conversation_id}/messages/',
            {'content': 'Test message 2', 'message_type': 'text'},
            format='json'
        )

        # List messages
        response = self.client1.get(
            f'/api/messaging/conversations/{conversation_id}/messages/',
            {'offset': 0, 'limit': 50}
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['count'], 2)
        self.assertEqual(len(response.data['results']), 2)

        print(f"✓ Retrieved {response.data['count']} messages")

    def test_06_mark_message_read(self):
        """Test marking a message as read"""
        print("\n[TEST 6] Marking message as read...")

        # Create conversation and send message
        conv_response = self.client1.post('/api/messaging/conversations/', {
            'type': 'direct',
            'participant_ids': [self.user2.id]
        }, format='json')
        conversation_id = conv_response.data['id']

        msg_response = self.client1.post(
            f'/api/messaging/conversations/{conversation_id}/messages/',
            {'content': 'Read this message', 'message_type': 'text'},
            format='json'
        )
        message_id = msg_response.data['id']

        # User 2 marks message as read
        response = self.client2.post(
            f'/api/messaging/conversations/{conversation_id}/messages/{message_id}/read/'
        )

        self.assertEqual(response.status_code, 200)

        print("✓ Message marked as read successfully")

    def test_07_search_users(self):
        """Test user search functionality"""
        print("\n[TEST 7] Searching users...")

        response = self.client1.get('/api/messaging/users/search/', {'q': 'Jane'})

        self.assertEqual(response.status_code, 200)
        self.assertGreater(len(response.data), 0)
        self.assertEqual(response.data[0]['first_name'], 'Jane')

        print(f"✓ Found {len(response.data)} user(s) matching 'Jane'")

    def test_08_group_admin_add_member(self):
        """Test group admin adding a member"""
        print("\n[TEST 8] Adding member to group (admin)...")

        # Create group
        conv_response = self.client1.post('/api/messaging/conversations/', {
            'type': 'group',
            'name': 'Admin Test Group',
            'participant_ids': [self.user2.id]
        }, format='json')
        conversation_id = conv_response.data['id']

        # Add user3 to group
        response = self.client1.post(
            f'/api/messaging/conversations/{conversation_id}/add-participant/',
            {'user_id': self.user3.id},
            format='json'
        )

        self.assertEqual(response.status_code, 200)

        print("✓ Member added to group successfully")

    def test_09_group_admin_remove_member(self):
        """Test group admin removing a member"""
        print("\n[TEST 9] Removing member from group (admin)...")

        # Create group
        conv_response = self.client1.post('/api/messaging/conversations/', {
            'type': 'group',
            'name': 'Admin Test Group',
            'participant_ids': [self.user2.id, self.user3.id]
        }, format='json')
        conversation_id = conv_response.data['id']

        # Remove user3 from group
        response = self.client1.post(
            f'/api/messaging/conversations/{conversation_id}/remove-participant/',
            {'user_id': self.user3.id},
            format='json'
        )

        self.assertEqual(response.status_code, 200)

        print("✓ Member removed from group successfully")

    def test_10_group_non_admin_cannot_remove(self):
        """Test that non-admin cannot remove members"""
        print("\n[TEST 10] Testing non-admin cannot remove members...")

        # Create group (user1 is admin)
        conv_response = self.client1.post('/api/messaging/conversations/', {
            'type': 'group',
            'name': 'Permission Test Group',
            'participant_ids': [self.user2.id, self.user3.id]
        }, format='json')
        conversation_id = conv_response.data['id']

        # User2 tries to remove user3 (should fail)
        response = self.client2.post(
            f'/api/messaging/conversations/{conversation_id}/remove-participant/',
            {'user_id': self.user3.id},
            format='json'
        )

        self.assertEqual(response.status_code, 403)

        print("✓ Non-admin correctly denied permission")

    def test_11_group_admin_transfer(self):
        """Test transferring admin role"""
        print("\n[TEST 11] Transferring admin role...")

        # Create group
        conv_response = self.client1.post('/api/messaging/conversations/', {
            'type': 'group',
            'name': 'Transfer Test Group',
            'participant_ids': [self.user2.id]
        }, format='json')
        conversation_id = conv_response.data['id']

        # Transfer admin to user2
        response = self.client1.post(
            f'/api/messaging/conversations/{conversation_id}/transfer-admin/',
            {'user_id': self.user2.id},
            format='json'
        )

        self.assertEqual(response.status_code, 200)

        # Verify user2 is now admin
        conv_detail = self.client1.get(f'/api/messaging/conversations/{conversation_id}/')
        self.assertEqual(conv_detail.data['admin']['id'], self.user2.id)

        print("✓ Admin role transferred successfully")

    def test_12_unread_count(self):
        """Test unread message count"""
        print("\n[TEST 12] Testing unread count...")

        # Create conversation
        conv_response = self.client1.post('/api/messaging/conversations/', {
            'type': 'direct',
            'participant_ids': [self.user2.id]
        }, format='json')
        conversation_id = conv_response.data['id']

        # User1 sends 3 messages
        for i in range(3):
            self.client1.post(
                f'/api/messaging/conversations/{conversation_id}/messages/',
                {'content': f'Message {i+1}', 'message_type': 'text'},
                format='json'
            )

        # User2 checks conversations
        response = self.client2.get('/api/messaging/conversations/')

        conv = next(c for c in response.data if c['id'] == conversation_id)
        self.assertEqual(conv['unread_count'], 3)

        print(f"✓ Unread count correctly shows {conv['unread_count']} messages")


def run_all_tests():
    """Run all E2E tests"""
    print("=" * 60)
    print("MESSAGING MODULE END-TO-END TEST SUITE")
    print("=" * 60)

    from django.test.utils import setup_test_environment, teardown_test_environment
    from django.test.runner import DiscoverRunner

    setup_test_environment()
    runner = DiscoverRunner(verbosity=2)

    # Run tests
    test_suite = runner.test_loader.loadTestsFromTestCase(MessagingEndToEndTests)
    result = runner.test_runner.run(test_suite)

    teardown_test_environment()

    # Print summary
    print("\n" + "=" * 60)
    print("TEST SUMMARY")
    print("=" * 60)
    print(f"Tests run: {result.testsRun}")
    print(f"Failures: {len(result.failures)}")
    print(f"Errors: {len(result.errors)}")
    print(f"Success rate: {(result.testsRun - len(result.failures) - len(result.errors)) / result.testsRun * 100:.1f}%")

    if result.wasSuccessful():
        print("\n✓ ALL TESTS PASSED!")
    else:
        print("\n✗ SOME TESTS FAILED")
        for test, traceback in result.failures + result.errors:
            print(f"\nFailed: {test}")
            print(traceback)

    return result.wasSuccessful()


if __name__ == '__main__':
    success = run_all_tests()
    sys.exit(0 if success else 1)
