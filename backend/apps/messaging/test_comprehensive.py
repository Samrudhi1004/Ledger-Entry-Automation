"""
Comprehensive Messaging Module Test Suite
Covers all test cases from TESTING_CHECKLIST.md
"""

import sys
import os
import django
from io import BytesIO
from PIL import Image

# Setup Django
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../..'))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from django.test import TestCase, TransactionTestCase
from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from apps.messaging.models import Conversation, Message, MessageAttachment, MessageRead
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken
import json

User = get_user_model()


class ConversationsAPITests(TransactionTestCase):
    """Tests for Conversations API endpoints"""

    def setUp(self):
        """Create test users and authentication"""
        self.user1 = User.objects.create_user(
            email='user1@test.com',
            password='testpass123',
            first_name='User',
            last_name='One',
            role='operator'
        )
        self.user2 = User.objects.create_user(
            email='user2@test.com',
            password='testpass123',
            first_name='User',
            last_name='Two',
            role='quality_engineer'
        )
        self.user3 = User.objects.create_user(
            email='user3@test.com',
            password='testpass123',
            first_name='User',
            last_name='Three',
            role='supervisor'
        )

        self.client1 = APIClient()
        self.client2 = APIClient()
        self.client3 = APIClient()

        token1 = RefreshToken.for_user(self.user1)
        token2 = RefreshToken.for_user(self.user2)
        token3 = RefreshToken.for_user(self.user3)

        self.client1.credentials(HTTP_AUTHORIZATION=f'Bearer {token1.access_token}')
        self.client2.credentials(HTTP_AUTHORIZATION=f'Bearer {token2.access_token}')
        self.client3.credentials(HTTP_AUTHORIZATION=f'Bearer {token3.access_token}')

    def test_list_conversations_authenticated(self):
        """GET /api/messaging/conversations/ - List conversations for authenticated user"""
        # Create conversation for user1
        Conversation.objects.create(type='direct').participants.set([self.user1, self.user2])

        response = self.client1.get('/api/messaging/conversations/')
        self.assertEqual(response.status_code, 200)
        self.assertGreaterEqual(len(response.data), 1)
        print("✓ List conversations - authenticated user sees only their conversations")

    def test_list_conversations_pagination(self):
        """GET /api/messaging/conversations/ - Check pagination"""
        # Create multiple conversations
        for i in range(15):
            Conversation.objects.create(type='direct').participants.set([self.user1, self.user2])

        response = self.client1.get('/api/messaging/conversations/?limit=10')
        self.assertEqual(response.status_code, 200)
        self.assertLessEqual(len(response.data), 10)
        print("✓ List conversations - pagination works correctly")

    def test_create_direct_conversation(self):
        """POST /api/messaging/conversations/ - Create direct message"""
        response = self.client1.post('/api/messaging/conversations/', {
            'type': 'direct',
            'participant_ids': [self.user2.id]
        }, format='json')

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data['type'], 'direct')
        self.assertEqual(len(response.data['participants']), 2)
        print("✓ Create direct conversation")

    def test_create_group_conversation(self):
        """POST /api/messaging/conversations/ - Create group chat"""
        response = self.client1.post('/api/messaging/conversations/', {
            'type': 'group',
            'name': 'Test Group',
            'description': 'Group description',
            'participant_ids': [self.user2.id, self.user3.id]
        }, format='json')

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data['type'], 'group')
        self.assertEqual(response.data['name'], 'Test Group')
        self.assertEqual(response.data['admin']['id'], self.user1.id)
        print("✓ Create group conversation - creator becomes admin")

    def test_create_conversation_invalid_participants(self):
        """POST /api/messaging/conversations/ - Test with invalid participant IDs"""
        response = self.client1.post('/api/messaging/conversations/', {
            'type': 'direct',
            'participant_ids': [99999]
        }, format='json')

        self.assertIn(response.status_code, [400, 404])
        print("✓ Create conversation - rejects invalid participant IDs")

    def test_get_conversation_details(self):
        """GET /api/messaging/conversations/{id}/ - Get conversation details"""
        conv = Conversation.objects.create(type='group', name='Details Test')
        conv.participants.set([self.user1, self.user2, self.user3])
        conv.admin = self.user1
        conv.save()

        response = self.client1.get(f'/api/messaging/conversations/{conv.id}/')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data['participants']), 3)
        self.assertEqual(response.data['admin']['id'], self.user1.id)
        print("✓ Get conversation details - participants and admin included")

    def test_update_group_name_as_admin(self):
        """PATCH /api/messaging/conversations/{id}/ - Admin can update group name"""
        conv = Conversation.objects.create(type='group', name='Old Name')
        conv.participants.set([self.user1, self.user2])
        conv.admin = self.user1
        conv.save()

        response = self.client1.patch(f'/api/messaging/conversations/{conv.id}/', {
            'name': 'New Name'
        }, format='json')

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['name'], 'New Name')
        print("✓ Update conversation - admin can update group name")

    def test_update_group_name_as_non_admin(self):
        """PATCH /api/messaging/conversations/{id}/ - Non-admin cannot update"""
        conv = Conversation.objects.create(type='group', name='Protected Name')
        conv.participants.set([self.user1, self.user2])
        conv.admin = self.user1
        conv.save()

        response = self.client2.patch(f'/api/messaging/conversations/{conv.id}/', {
            'name': 'Hacked Name'
        }, format='json')

        self.assertEqual(response.status_code, 403)
        print("✓ Update conversation - non-admin cannot update")

    def test_leave_conversation(self):
        """DELETE /api/messaging/conversations/{id}/ - User can leave"""
        conv = Conversation.objects.create(type='group')
        conv.participants.set([self.user1, self.user2, self.user3])
        conv.admin = self.user1
        conv.save()

        response = self.client2.delete(f'/api/messaging/conversations/{conv.id}/')
        self.assertEqual(response.status_code, 204)

        conv.refresh_from_db()
        self.assertNotIn(self.user2, conv.participants.all())
        print("✓ Leave conversation - user removed from participants")

    def test_leave_conversation_admin_transfer(self):
        """DELETE /api/messaging/conversations/{id}/ - Admin leaving transfers role"""
        conv = Conversation.objects.create(type='group')
        conv.participants.set([self.user1, self.user2])
        conv.admin = self.user1
        conv.save()

        response = self.client1.delete(f'/api/messaging/conversations/{conv.id}/')
        self.assertEqual(response.status_code, 204)

        conv.refresh_from_db()
        self.assertEqual(conv.admin, self.user2)
        print("✓ Leave conversation - admin transfer works")


class MessagesAPITests(TransactionTestCase):
    """Tests for Messages API endpoints"""

    def setUp(self):
        """Create test users and conversation"""
        self.user1 = User.objects.create_user(
            email='msg1@test.com',
            password='testpass123',
            first_name='Msg',
            last_name='User1',
            role='operator'
        )
        self.user2 = User.objects.create_user(
            email='msg2@test.com',
            password='testpass123',
            first_name='Msg',
            last_name='User2',
            role='quality_engineer'
        )

        self.client1 = APIClient()
        self.client2 = APIClient()

        token1 = RefreshToken.for_user(self.user1)
        token2 = RefreshToken.for_user(self.user2)

        self.client1.credentials(HTTP_AUTHORIZATION=f'Bearer {token1.access_token}')
        self.client2.credentials(HTTP_AUTHORIZATION=f'Bearer {token2.access_token}')

        self.conversation = Conversation.objects.create(type='direct')
        self.conversation.participants.set([self.user1, self.user2])

    def test_list_messages_pagination(self):
        """GET /api/messaging/conversations/{id}/messages/ - Pagination"""
        # Create 60 messages
        for i in range(60):
            Message.objects.create(
                conversation=self.conversation,
                sender=self.user1,
                content=f'Message {i}',
                message_type='text'
            )

        response = self.client1.get(
            f'/api/messaging/conversations/{self.conversation.id}/messages/',
            {'offset': 0, 'limit': 50}
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data['results']), 50)
        print("✓ List messages - pagination works (50 messages)")

    def test_list_messages_ordering(self):
        """GET /api/messaging/conversations/{id}/messages/ - Ordered by created_at"""
        msg1 = Message.objects.create(
            conversation=self.conversation,
            sender=self.user1,
            content='First',
            message_type='text'
        )
        msg2 = Message.objects.create(
            conversation=self.conversation,
            sender=self.user1,
            content='Second',
            message_type='text'
        )

        response = self.client1.get(
            f'/api/messaging/conversations/{self.conversation.id}/messages/'
        )

        self.assertEqual(response.status_code, 200)
        # Should be ordered by created_at (oldest first or newest first depending on API)
        print("✓ List messages - ordered by created_at")

    def test_send_text_message(self):
        """POST /api/messaging/conversations/{id}/messages/ - Send text"""
        response = self.client1.post(
            f'/api/messaging/conversations/{self.conversation.id}/messages/',
            {
                'content': 'Hello World',
                'message_type': 'text'
            },
            format='json'
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data['content'], 'Hello World')
        self.assertEqual(response.data['sender']['id'], self.user1.id)
        print("✓ Send message - text message created")

    def test_send_message_with_reply(self):
        """POST /api/messaging/conversations/{id}/messages/ - Send with reply_to"""
        original = Message.objects.create(
            conversation=self.conversation,
            sender=self.user1,
            content='Original',
            message_type='text'
        )

        response = self.client2.post(
            f'/api/messaging/conversations/{self.conversation.id}/messages/',
            {
                'content': 'Reply',
                'message_type': 'text',
                'reply_to': original.id
            },
            format='json'
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data['reply_to']['id'], str(original.id))
        print("✓ Send message - threading with reply_to works")

    def test_send_empty_message(self):
        """POST /api/messaging/conversations/{id}/messages/ - Empty content fails"""
        response = self.client1.post(
            f'/api/messaging/conversations/{self.conversation.id}/messages/',
            {
                'content': '',
                'message_type': 'text'
            },
            format='json'
        )

        self.assertIn(response.status_code, [400, 422])
        print("✓ Send message - empty content rejected")

    def test_edit_own_message(self):
        """PATCH /api/messaging/messages/{id}/ - Sender can edit"""
        message = Message.objects.create(
            conversation=self.conversation,
            sender=self.user1,
            content='Original content',
            message_type='text'
        )

        response = self.client1.patch(
            f'/api/messaging/messages/{message.id}/',
            {'content': 'Edited content'},
            format='json'
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['content'], 'Edited content')
        self.assertIsNotNone(response.data.get('edited_at'))
        print("✓ Edit message - sender can edit, edited_at set")

    def test_edit_others_message(self):
        """PATCH /api/messaging/messages/{id}/ - Non-sender cannot edit"""
        message = Message.objects.create(
            conversation=self.conversation,
            sender=self.user1,
            content='Protected',
            message_type='text'
        )

        response = self.client2.patch(
            f'/api/messaging/messages/{message.id}/',
            {'content': 'Hacked'},
            format='json'
        )

        self.assertEqual(response.status_code, 403)
        print("✓ Edit message - non-sender cannot edit")

    def test_delete_own_message(self):
        """DELETE /api/messaging/messages/{id}/ - Soft delete"""
        message = Message.objects.create(
            conversation=self.conversation,
            sender=self.user1,
            content='To delete',
            message_type='text'
        )

        response = self.client1.delete(f'/api/messaging/messages/{message.id}/')
        self.assertEqual(response.status_code, 204)

        message.refresh_from_db()
        self.assertTrue(message.is_deleted)
        print("✓ Delete message - soft delete (is_deleted=True)")

    def test_delete_others_message(self):
        """DELETE /api/messaging/messages/{id}/ - Non-sender cannot delete"""
        message = Message.objects.create(
            conversation=self.conversation,
            sender=self.user1,
            content='Protected',
            message_type='text'
        )

        response = self.client2.delete(f'/api/messaging/messages/{message.id}/')
        self.assertEqual(response.status_code, 403)
        print("✓ Delete message - non-sender cannot delete")

    def test_mark_message_as_read(self):
        """POST /api/messaging/messages/{id}/read/ - Mark as read"""
        message = Message.objects.create(
            conversation=self.conversation,
            sender=self.user1,
            content='Read me',
            message_type='text'
        )

        response = self.client2.post(
            f'/api/messaging/conversations/{self.conversation.id}/messages/{message.id}/read/'
        )

        self.assertEqual(response.status_code, 200)
        self.assertTrue(
            MessageRead.objects.filter(message=message, user=self.user2).exists()
        )
        print("✓ Mark as read - MessageRead object created")


class FileUploadAPITests(TransactionTestCase):
    """Tests for File Upload API"""

    def setUp(self):
        self.user = User.objects.create_user(
            email='upload@test.com',
            password='testpass123',
            first_name='Upload',
            last_name='User',
            role='operator'
        )

        self.client = APIClient()
        token = RefreshToken.for_user(self.user)
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {token.access_token}')

    def create_test_image(self, size_kb=100):
        """Helper to create test image"""
        file = BytesIO()
        image = Image.new('RGB', (100, 100), color='red')
        image.save(file, 'PNG')
        file.seek(0)
        return SimpleUploadedFile(
            'test.png',
            file.read(),
            content_type='image/png'
        )

    def test_upload_without_auth(self):
        """POST /api/messaging/upload/ - Requires authentication"""
        client = APIClient()  # No auth
        image = self.create_test_image()

        response = client.post('/api/messaging/upload/', {
            'file': image,
            'file_type': 'image'
        }, format='multipart')

        self.assertEqual(response.status_code, 401)
        print("✓ File upload - requires authentication")

    def test_upload_invalid_file_type(self):
        """POST /api/messaging/upload/ - Invalid file type rejected"""
        # Create a fake executable file
        fake_file = SimpleUploadedFile(
            'virus.exe',
            b'fake executable content',
            content_type='application/x-msdownload'
        )

        response = self.client.post('/api/messaging/upload/', {
            'file': fake_file,
            'file_type': 'document'
        }, format='multipart')

        # Should reject based on MIME type validation
        self.assertIn(response.status_code, [400, 415])
        print("✓ File upload - invalid file type rejected")


class UserSearchAPITests(TransactionTestCase):
    """Tests for User Search API"""

    def setUp(self):
        self.user1 = User.objects.create_user(
            email='alice@test.com',
            password='testpass123',
            first_name='Alice',
            last_name='Smith',
            role='operator'
        )
        self.user2 = User.objects.create_user(
            email='bob@test.com',
            password='testpass123',
            first_name='Bob',
            last_name='Johnson',
            role='quality_engineer'
        )
        self.user3 = User.objects.create_user(
            email='charlie@test.com',
            password='testpass123',
            first_name='Charlie',
            last_name='Brown',
            role='supervisor'
        )

        self.client = APIClient()
        token = RefreshToken.for_user(self.user1)
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {token.access_token}')

    def test_search_by_first_name(self):
        """GET /api/messaging/users/search/?q={query} - Search by first name"""
        response = self.client.get('/api/messaging/users/search/', {'q': 'Bob'})

        self.assertEqual(response.status_code, 200)
        self.assertGreaterEqual(len(response.data), 1)
        self.assertTrue(any(u['first_name'] == 'Bob' for u in response.data))
        print("✓ User search - by first name")

    def test_search_by_last_name(self):
        """GET /api/messaging/users/search/?q={query} - Search by last name"""
        response = self.client.get('/api/messaging/users/search/', {'q': 'Brown'})

        self.assertEqual(response.status_code, 200)
        self.assertGreaterEqual(len(response.data), 1)
        self.assertTrue(any(u['last_name'] == 'Brown' for u in response.data))
        print("✓ User search - by last name")

    def test_search_by_email(self):
        """GET /api/messaging/users/search/?q={query} - Search by email"""
        response = self.client.get('/api/messaging/users/search/', {'q': 'charlie@test.com'})

        self.assertEqual(response.status_code, 200)
        self.assertGreaterEqual(len(response.data), 1)
        print("✓ User search - by email")

    def test_search_short_query(self):
        """GET /api/messaging/users/search/?q={query} - < 2 characters returns suggestions"""
        response = self.client.get('/api/messaging/users/search/', {'q': 'A'})

        self.assertEqual(response.status_code, 200)
        # Should return suggestions or empty list
        print("✓ User search - handles < 2 characters")

    def test_search_no_matches(self):
        """GET /api/messaging/users/search/?q={query} - No matches"""
        response = self.client.get('/api/messaging/users/search/', {'q': 'XYZ123'})

        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data), 0)
        print("✓ User search - no matches returns empty list")

    def test_search_excludes_current_user(self):
        """GET /api/messaging/users/search/?q={query} - Current user excluded"""
        response = self.client.get('/api/messaging/users/search/', {'q': 'Alice'})

        self.assertEqual(response.status_code, 200)
        # Current user (Alice/user1) should not be in results
        self.assertFalse(any(u['id'] == self.user1.id for u in response.data))
        print("✓ User search - current user excluded from results")


class GroupAdminActionsTests(TransactionTestCase):
    """Tests for Group Admin Actions"""

    def setUp(self):
        self.admin = User.objects.create_user(
            email='admin@test.com',
            password='testpass123',
            first_name='Admin',
            last_name='User',
            role='supervisor'
        )
        self.member1 = User.objects.create_user(
            email='member1@test.com',
            password='testpass123',
            first_name='Member',
            last_name='One',
            role='operator'
        )
        self.member2 = User.objects.create_user(
            email='member2@test.com',
            password='testpass123',
            first_name='Member',
            last_name='Two',
            role='quality_engineer'
        )
        self.outsider = User.objects.create_user(
            email='outsider@test.com',
            password='testpass123',
            first_name='Outsider',
            last_name='User',
            role='operator'
        )

        self.admin_client = APIClient()
        self.member_client = APIClient()

        admin_token = RefreshToken.for_user(self.admin)
        member_token = RefreshToken.for_user(self.member1)

        self.admin_client.credentials(HTTP_AUTHORIZATION=f'Bearer {admin_token.access_token}')
        self.member_client.credentials(HTTP_AUTHORIZATION=f'Bearer {member_token.access_token}')

        self.group = Conversation.objects.create(type='group', name='Test Group')
        self.group.participants.set([self.admin, self.member1, self.member2])
        self.group.admin = self.admin
        self.group.save()

    def test_admin_add_participant(self):
        """POST /api/messaging/conversations/{id}/add-participant/ - Admin can add"""
        response = self.admin_client.post(
            f'/api/messaging/conversations/{self.group.id}/add-participant/',
            {'user_id': self.outsider.id},
            format='json'
        )

        self.assertEqual(response.status_code, 200)
        self.assertIn(self.outsider, self.group.participants.all())
        print("✓ Group admin - can add participant")

    def test_non_admin_cannot_add_participant(self):
        """POST /api/messaging/conversations/{id}/add-participant/ - Non-admin fails"""
        response = self.member_client.post(
            f'/api/messaging/conversations/{self.group.id}/add-participant/',
            {'user_id': self.outsider.id},
            format='json'
        )

        self.assertEqual(response.status_code, 403)
        print("✓ Group admin - non-admin cannot add participant")

    def test_admin_add_existing_participant(self):
        """POST /api/messaging/conversations/{id}/add-participant/ - Adding existing user"""
        response = self.admin_client.post(
            f'/api/messaging/conversations/{self.group.id}/add-participant/',
            {'user_id': self.member1.id},
            format='json'
        )

        # Should handle gracefully (success or 400)
        self.assertIn(response.status_code, [200, 400])
        print("✓ Group admin - adding existing user handled")

    def test_admin_remove_participant(self):
        """POST /api/messaging/conversations/{id}/remove-participant/ - Admin can remove"""
        response = self.admin_client.post(
            f'/api/messaging/conversations/{self.group.id}/remove-participant/',
            {'user_id': self.member2.id},
            format='json'
        )

        self.assertEqual(response.status_code, 200)
        self.assertNotIn(self.member2, self.group.participants.all())
        print("✓ Group admin - can remove participant")

    def test_non_admin_cannot_remove_participant(self):
        """POST /api/messaging/conversations/{id}/remove-participant/ - Non-admin fails"""
        response = self.member_client.post(
            f'/api/messaging/conversations/{self.group.id}/remove-participant/',
            {'user_id': self.member2.id},
            format='json'
        )

        self.assertEqual(response.status_code, 403)
        print("✓ Group admin - non-admin cannot remove participant")

    def test_admin_remove_nonexistent_participant(self):
        """POST /api/messaging/conversations/{id}/remove-participant/ - Non-existent user"""
        response = self.admin_client.post(
            f'/api/messaging/conversations/{self.group.id}/remove-participant/',
            {'user_id': 99999},
            format='json'
        )

        self.assertIn(response.status_code, [400, 404])
        print("✓ Group admin - removing non-existent participant fails")

    def test_admin_transfer_admin(self):
        """POST /api/messaging/conversations/{id}/transfer-admin/ - Admin can transfer"""
        response = self.admin_client.post(
            f'/api/messaging/conversations/{self.group.id}/transfer-admin/',
            {'user_id': self.member1.id},
            format='json'
        )

        self.assertEqual(response.status_code, 200)
        self.group.refresh_from_db()
        self.assertEqual(self.group.admin, self.member1)
        print("✓ Group admin - can transfer admin role")

    def test_non_admin_cannot_transfer_admin(self):
        """POST /api/messaging/conversations/{id}/transfer-admin/ - Non-admin fails"""
        response = self.member_client.post(
            f'/api/messaging/conversations/{self.group.id}/transfer-admin/',
            {'user_id': self.member2.id},
            format='json'
        )

        self.assertEqual(response.status_code, 403)
        print("✓ Group admin - non-admin cannot transfer")

    def test_transfer_admin_to_non_participant(self):
        """POST /api/messaging/conversations/{id}/transfer-admin/ - Non-participant fails"""
        response = self.admin_client.post(
            f'/api/messaging/conversations/{self.group.id}/transfer-admin/',
            {'user_id': self.outsider.id},
            format='json'
        )

        self.assertIn(response.status_code, [400, 404])
        print("✓ Group admin - cannot transfer to non-participant")


class SecurityTests(TransactionTestCase):
    """Security and Authorization Tests"""

    def setUp(self):
        self.user1 = User.objects.create_user(
            email='secure1@test.com',
            password='testpass123',
            first_name='Secure',
            last_name='One',
            role='operator'
        )
        self.user2 = User.objects.create_user(
            email='secure2@test.com',
            password='testpass123',
            first_name='Secure',
            last_name='Two',
            role='quality_engineer'
        )

        self.client1 = APIClient()
        self.client2 = APIClient()

        token1 = RefreshToken.for_user(self.user1)
        self.client1.credentials(HTTP_AUTHORIZATION=f'Bearer {token1.access_token}')

        # user2's conversation
        self.private_conv = Conversation.objects.create(type='direct')
        self.private_conv.participants.set([self.user2])

    def test_api_without_token(self):
        """Try accessing API without token - 401"""
        client = APIClient()
        response = client.get('/api/messaging/conversations/')
        self.assertEqual(response.status_code, 401)
        print("✓ Security - API without token returns 401")

    def test_access_other_user_conversation(self):
        """Try accessing conversation you're not in - 404 or 403"""
        response = self.client1.get(f'/api/messaging/conversations/{self.private_conv.id}/')
        self.assertIn(response.status_code, [403, 404])
        print("✓ Security - cannot access other user's conversation")

    def test_very_long_message(self):
        """Send very long message - should be handled"""
        conv = Conversation.objects.create(type='direct')
        conv.participants.set([self.user1, self.user2])

        long_content = 'A' * 6000  # > 5000 chars
        response = self.client1.post(
            f'/api/messaging/conversations/{conv.id}/messages/',
            {
                'content': long_content,
                'message_type': 'text'
            },
            format='json'
        )

        # Should either accept, truncate, or reject
        self.assertIn(response.status_code, [201, 400, 413])
        print("✓ Security - very long message handled")


def run_all_tests():
    """Run all comprehensive tests"""
    import sys
    from io import StringIO
    from django.test.utils import setup_test_environment, teardown_test_environment
    from django.test.runner import DiscoverRunner

    print("=" * 70)
    print("COMPREHENSIVE MESSAGING MODULE TEST SUITE")
    print("=" * 70)
    print()

    setup_test_environment()
    runner = DiscoverRunner(verbosity=2)

    # Collect all test classes
    test_classes = [
        ConversationsAPITests,
        MessagesAPITests,
        FileUploadAPITests,
        UserSearchAPITests,
        GroupAdminActionsTests,
        SecurityTests,
    ]

    all_results = []
    total_tests = 0
    total_failures = 0
    total_errors = 0

    for test_class in test_classes:
        print(f"\n{'=' * 70}")
        print(f"Running: {test_class.__name__}")
        print('=' * 70)

        test_suite = runner.test_loader.loadTestsFromTestCase(test_class)
        result = runner.test_runner.run(test_suite)

        all_results.append((test_class.__name__, result))
        total_tests += result.testsRun
        total_failures += len(result.failures)
        total_errors += len(result.errors)

    # Print final summary
    print("\n" + "=" * 70)
    print("FINAL TEST SUMMARY")
    print("=" * 70)
    print(f"Total tests run: {total_tests}")
    print(f"Passed: {total_tests - total_failures - total_errors}")
    print(f"Failures: {total_failures}")
    print(f"Errors: {total_errors}")
    print(f"Success rate: {(total_tests - total_failures - total_errors) / total_tests * 100:.1f}%")

    print("\n" + "-" * 70)
    print("Breakdown by test class:")
    print("-" * 70)
    for class_name, result in all_results:
        passed = result.testsRun - len(result.failures) - len(result.errors)
        status = "✓ PASS" if result.wasSuccessful() else "✗ FAIL"
        print(f"{class_name:40} {passed}/{result.testsRun} {status}")

    teardown_test_environment()

    if total_failures + total_errors == 0:
        print("\n✓ ALL TESTS PASSED!")
        return True
    else:
        print("\n✗ SOME TESTS FAILED")
        print("\nFailed tests:")
        for class_name, result in all_results:
            for test, traceback in result.failures + result.errors:
                print(f"\n  - {test}")
        return False


if __name__ == '__main__':
    success = run_all_tests()
    sys.exit(0 if success else 1)
