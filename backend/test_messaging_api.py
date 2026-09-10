"""
Messaging API Tests using Existing Database Users
Tests all backend API endpoints from TESTING_CHECKLIST.md
"""

import os
import sys
import django

# Setup Django
sys.path.insert(0, os.path.dirname(__file__))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken
import json

User = get_user_model()

# Test Results Tracking
test_results = {
    'passed': [],
    'failed': [],
    'skipped': []
}

def log_test(name, passed, reason=''):
    """Log test result"""
    if passed:
        test_results['passed'].append(name)
        print(f"[PASS] {name}")
    else:
        test_results['failed'].append((name, reason))
        print(f"[FAIL] {name}: {reason}")

def get_authenticated_client(username):
    """Get API client with JWT token for user"""
    user = User.objects.get(username=username)
    client = APIClient()
    token = RefreshToken.for_user(user)
    client.credentials(HTTP_AUTHORIZATION=f'Bearer {token.access_token}')
    return client, user

# ============================================================================
# SETUP
# ============================================================================
print("=" * 70)
print("MESSAGING MODULE API TESTS")
print("Using existing database users")
print("=" * 70)
print()

# Get existing users
try:
    operator_client, operator = get_authenticated_client('operator')
    inspector_client, inspector = get_authenticated_client('inspector')
    supervisor_client, supervisor = get_authenticated_client('supervisor')
    print(f"[PASS] Using existing users:")
    print(f"  - Operator: {operator.get_full_name()} ({operator.username})")
    print(f"  - Inspector: {inspector.get_full_name()} ({inspector.username})")
    print(f"  - Supervisor: {supervisor.get_full_name()} ({supervisor.username})")
    print()
except Exception as e:
    print(f"[FAIL] Failed to load users: {e}")
    sys.exit(1)

# ============================================================================
# CONVERSATIONS API TESTS
# ============================================================================
print("-" * 70)
print("1. CONVERSATIONS API")
print("-" * 70)

# Test 1.1: List conversations
try:
    response = operator_client.get('/api/messaging/conversations/')
    log_test("GET /api/messaging/conversations/ - List conversations",
             response.status_code == 200)
except Exception as e:
    log_test("GET /api/messaging/conversations/ - List conversations", False, str(e))

# Test 1.2: Create direct conversation
try:
    response = operator_client.post('/api/messaging/conversations/', {
        'type': 'direct',
        'participant_ids': [inspector.id]
    }, format='json')

    if response.status_code == 201:
        direct_conv_id = response.data['id']
        log_test("POST /api/messaging/conversations/ - Create direct conversation", True)
    else:
        log_test("POST /api/messaging/conversations/ - Create direct conversation",
                False, f"Status {response.status_code}")
        direct_conv_id = None
except Exception as e:
    log_test("POST /api/messaging/conversations/ - Create direct conversation", False, str(e))
    direct_conv_id = None

# Test 1.3: Create group conversation
try:
    response = supervisor_client.post('/api/messaging/conversations/', {
        'type': 'group',
        'name': 'Test Team',
        'description': 'Testing group chat',
        'participant_ids': [operator.id, inspector.id]
    }, format='json')

    if response.status_code == 201:
        group_conv_id = response.data['id']
        is_admin = response.data.get('admin', {}).get('id') == supervisor.id
        log_test("POST /api/messaging/conversations/ - Create group (admin assigned)", is_admin)
    else:
        log_test("POST /api/messaging/conversations/ - Create group",
                False, f"Status {response.status_code}")
        group_conv_id = None
except Exception as e:
    log_test("POST /api/messaging/conversations/ - Create group", False, str(e))
    group_conv_id = None

# Test 1.4: Get conversation details
if direct_conv_id:
    try:
        response = operator_client.get(f'/api/messaging/conversations/{direct_conv_id}/')
        has_participants = len(response.data.get('participants', [])) > 0
        log_test("GET /api/messaging/conversations/{id}/ - Get details",
                response.status_code == 200 and has_participants)
    except Exception as e:
        log_test("GET /api/messaging/conversations/{id}/ - Get details", False, str(e))

# Test 1.5: Update group name (admin)
if group_conv_id:
    try:
        response = supervisor_client.patch(f'/api/messaging/conversations/{group_conv_id}/', {
            'name': 'Updated Team Name'
        }, format='json')
        log_test("PATCH /api/messaging/conversations/{id}/ - Admin can update",
                response.status_code == 200)
    except Exception as e:
        log_test("PATCH /api/messaging/conversations/{id}/ - Admin can update", False, str(e))

# Test 1.6: Update group name (non-admin should fail)
if group_conv_id:
    try:
        response = operator_client.patch(f'/api/messaging/conversations/{group_conv_id}/', {
            'name': 'Hacked Name'
        }, format='json')
        log_test("PATCH /api/messaging/conversations/{id}/ - Non-admin blocked",
                response.status_code == 403)
    except Exception as e:
        log_test("PATCH /api/messaging/conversations/{id}/ - Non-admin blocked", False, str(e))

# Test 1.7: Invalid participant IDs
try:
    response = operator_client.post('/api/messaging/conversations/', {
        'type': 'direct',
        'participant_ids': [99999]
    }, format='json')
    log_test("POST /api/messaging/conversations/ - Invalid IDs rejected",
            response.status_code in [400, 404])
except Exception as e:
    log_test("POST /api/messaging/conversations/ - Invalid IDs rejected", False, str(e))

# ============================================================================
# MESSAGES API TESTS
# ============================================================================
print()
print("-" * 70)
print("2. MESSAGES API")
print("-" * 70)

# Test 2.1: Send text message
if direct_conv_id:
    try:
        response = operator_client.post(
            f'/api/messaging/conversations/{direct_conv_id}/messages/',
            {
                'content': 'Hello from automated test!',
                'message_type': 'text'
            },
            format='json'
        )

        if response.status_code == 201:
            message_id = response.data['id']
            sender_correct = response.data['sender']['id'] == operator.id
            log_test("POST .../messages/ - Send text message", sender_correct)
        else:
            log_test("POST .../messages/ - Send text message",
                    False, f"Status {response.status_code}")
            message_id = None
    except Exception as e:
        log_test("POST .../messages/ - Send text message", False, str(e))
        message_id = None

# Test 2.2: Send empty message (should fail)
if direct_conv_id:
    try:
        response = operator_client.post(
            f'/api/messaging/conversations/{direct_conv_id}/messages/',
            {
                'content': '',
                'message_type': 'text'
            },
            format='json'
        )
        log_test("POST .../messages/ - Empty content rejected",
                response.status_code in [400, 422])
    except Exception as e:
        log_test("POST .../messages/ - Empty content rejected", False, str(e))

# Test 2.3: List messages
if direct_conv_id:
    try:
        response = operator_client.get(
            f'/api/messaging/conversations/{direct_conv_id}/messages/',
            {'offset': 0, 'limit': 50}
        )
        log_test("GET .../messages/ - List messages with pagination",
                response.status_code == 200)
    except Exception as e:
        log_test("GET .../messages/ - List messages with pagination", False, str(e))

# Test 2.4: Edit own message
if direct_conv_id and message_id:
    try:
        response = operator_client.patch(
            f'/api/messaging/messages/{message_id}/',
            {'content': 'Edited message'},
            format='json'
        )
        has_edited_at = response.data.get('edited_at') is not None if response.status_code == 200 else False
        log_test("PATCH /api/messaging/messages/{id}/ - Edit own message",
                response.status_code == 200 and has_edited_at)
    except Exception as e:
        log_test("PATCH /api/messaging/messages/{id}/ - Edit own message", False, str(e))

# Test 2.5: Edit other's message (should fail)
if direct_conv_id and message_id:
    try:
        response = inspector_client.patch(
            f'/api/messaging/messages/{message_id}/',
            {'content': 'Hacked message'},
            format='json'
        )
        log_test("PATCH /api/messaging/messages/{id}/ - Cannot edit other's message",
                response.status_code == 403)
    except Exception as e:
        log_test("PATCH /api/messaging/messages/{id}/ - Cannot edit other's message", False, str(e))

# Test 2.6: Mark message as read
if direct_conv_id and message_id:
    try:
        response = inspector_client.post(
            f'/api/messaging/conversations/{direct_conv_id}/messages/{message_id}/read/'
        )
        log_test("POST .../messages/{id}/read/ - Mark as read",
                response.status_code == 200)
    except Exception as e:
        log_test("POST .../messages/{id}/read/ - Mark as read", False, str(e))

# Test 2.7: Delete own message (soft delete)
if direct_conv_id:
    try:
        # Create a message to delete
        create_response = operator_client.post(
            f'/api/messaging/conversations/{direct_conv_id}/messages/',
            {'content': 'Message to delete', 'message_type': 'text'},
            format='json'
        )

        if create_response.status_code == 201:
            delete_msg_id = create_response.data['id']
            response = operator_client.delete(f'/api/messaging/messages/{delete_msg_id}/')
            log_test("DELETE /api/messaging/messages/{id}/ - Soft delete",
                    response.status_code == 204)
        else:
            log_test("DELETE /api/messaging/messages/{id}/ - Soft delete", False, "Failed to create test message")
    except Exception as e:
        log_test("DELETE /api/messaging/messages/{id}/ - Soft delete", False, str(e))

# Test 2.8: Delete other's message (should fail)
if direct_conv_id and message_id:
    try:
        response = inspector_client.delete(f'/api/messaging/messages/{message_id}/')
        log_test("DELETE /api/messaging/messages/{id}/ - Cannot delete other's message",
                response.status_code == 403)
    except Exception as e:
        log_test("DELETE /api/messaging/messages/{id}/ - Cannot delete other's message", False, str(e))

# ============================================================================
# USER SEARCH API TESTS
# ============================================================================
print()
print("-" * 70)
print("3. USER SEARCH API")
print("-" * 70)

# Test 3.1: Search by first name
try:
    response = operator_client.get('/api/messaging/users/search/', {'q': 'John'})
    has_results = len(response.data) > 0 if response.status_code == 200 else False
    log_test("GET /api/messaging/users/search/ - Search by first name",
            response.status_code == 200)
except Exception as e:
    log_test("GET /api/messaging/users/search/ - Search by first name", False, str(e))

# Test 3.2: Search by last name
try:
    response = operator_client.get('/api/messaging/users/search/', {'q': 'Inspector'})
    log_test("GET /api/messaging/users/search/ - Search by last name",
            response.status_code == 200)
except Exception as e:
    log_test("GET /api/messaging/users/search/ - Search by last name", False, str(e))

# Test 3.3: Search by email
try:
    response = operator_client.get('/api/messaging/users/search/', {'q': 'inspector@mantri.com'})
    log_test("GET /api/messaging/users/search/ - Search by email",
            response.status_code == 200)
except Exception as e:
    log_test("GET /api/messaging/users/search/ - Search by email", False, str(e))

# Test 3.4: Short query (< 2 characters)
try:
    response = operator_client.get('/api/messaging/users/search/', {'q': 'A'})
    log_test("GET /api/messaging/users/search/ - Handle short query",
            response.status_code == 200)
except Exception as e:
    log_test("GET /api/messaging/users/search/ - Handle short query", False, str(e))

# Test 3.5: No matches
try:
    response = operator_client.get('/api/messaging/users/search/', {'q': 'XYZ123NotFound'})
    no_results = len(response.data) == 0 if response.status_code == 200 else False
    log_test("GET /api/messaging/users/search/ - No matches returns empty",
            response.status_code == 200 and no_results)
except Exception as e:
    log_test("GET /api/messaging/users/search/ - No matches returns empty", False, str(e))

# Test 3.6: Current user excluded
try:
    response = operator_client.get('/api/messaging/users/search/', {'q': 'John'})
    if response.status_code == 200:
        user_ids = [u['id'] for u in response.data]
        excluded = operator.id not in user_ids
        log_test("GET /api/messaging/users/search/ - Current user excluded", excluded)
    else:
        log_test("GET /api/messaging/users/search/ - Current user excluded", False, f"Status {response.status_code}")
except Exception as e:
    log_test("GET /api/messaging/users/search/ - Current user excluded", False, str(e))

# ============================================================================
# GROUP ADMIN ACTIONS TESTS
# ============================================================================
print()
print("-" * 70)
print("4. GROUP ADMIN ACTIONS")
print("-" * 70)

# Create a fresh group for admin tests
try:
    response = supervisor_client.post('/api/messaging/conversations/', {
        'type': 'group',
        'name': 'Admin Test Group',
        'participant_ids': [operator.id]
    }, format='json')

    if response.status_code == 201:
        admin_test_group_id = response.data['id']
        print(f"  Created test group: {admin_test_group_id}")
    else:
        admin_test_group_id = None
        print(f"  Failed to create test group: {response.status_code}")
except Exception as e:
    admin_test_group_id = None
    print(f"  Failed to create test group: {e}")

# Test 4.1: Admin can add participant
if admin_test_group_id:
    try:
        response = supervisor_client.post(
            f'/api/messaging/conversations/{admin_test_group_id}/add-participant/',
            {'user_id': inspector.id},
            format='json'
        )
        log_test("POST .../add-participant/ - Admin can add",
                response.status_code == 200)
    except Exception as e:
        log_test("POST .../add-participant/ - Admin can add", False, str(e))

# Test 4.2: Non-admin cannot add participant
if admin_test_group_id:
    try:
        admin_user = User.objects.get(username='admin')  # Get another user to try adding
        response = operator_client.post(
            f'/api/messaging/conversations/{admin_test_group_id}/add-participant/',
            {'user_id': admin_user.id},
            format='json'
        )
        log_test("POST .../add-participant/ - Non-admin blocked",
                response.status_code == 403)
    except Exception as e:
        log_test("POST .../add-participant/ - Non-admin blocked", False, str(e))

# Test 4.3: Admin can remove participant
if admin_test_group_id:
    try:
        response = supervisor_client.post(
            f'/api/messaging/conversations/{admin_test_group_id}/remove-participant/',
            {'user_id': inspector.id},
            format='json'
        )
        log_test("POST .../remove-participant/ - Admin can remove",
                response.status_code == 200)
    except Exception as e:
        log_test("POST .../remove-participant/ - Admin can remove", False, str(e))

# Test 4.4: Non-admin cannot remove participant
if admin_test_group_id:
    try:
        response = operator_client.post(
            f'/api/messaging/conversations/{admin_test_group_id}/remove-participant/',
            {'user_id': supervisor.id},
            format='json'
        )
        log_test("POST .../remove-participant/ - Non-admin blocked",
                response.status_code == 403)
    except Exception as e:
        log_test("POST .../remove-participant/ - Non-admin blocked", False, str(e))

# Test 4.5: Admin can transfer admin role
if admin_test_group_id:
    try:
        response = supervisor_client.post(
            f'/api/messaging/conversations/{admin_test_group_id}/transfer-admin/',
            {'user_id': operator.id},
            format='json'
        )
        log_test("POST .../transfer-admin/ - Admin can transfer",
                response.status_code == 200)
    except Exception as e:
        log_test("POST .../transfer-admin/ - Admin can transfer", False, str(e))

# Test 4.6: Non-admin cannot transfer (operator was just made admin, supervisor tries to take it back without permission)
if admin_test_group_id:
    try:
        response = inspector_client.post(
            f'/api/messaging/conversations/{admin_test_group_id}/transfer-admin/',
            {'user_id': inspector.id},
            format='json'
        )
        log_test("POST .../transfer-admin/ - Non-admin blocked",
                response.status_code == 403)
    except Exception as e:
        log_test("POST .../transfer-admin/ - Non-admin blocked", False, str(e))

# ============================================================================
# SECURITY TESTS
# ============================================================================
print()
print("-" * 70)
print("5. SECURITY & AUTHORIZATION")
print("-" * 70)

# Test 5.1: API without token
try:
    no_auth_client = APIClient()
    response = no_auth_client.get('/api/messaging/conversations/')
    log_test("Security - API without token returns 401",
            response.status_code == 401)
except Exception as e:
    log_test("Security - API without token returns 401", False, str(e))

# Test 5.2: Cannot access other user's private conversation
if direct_conv_id:
    try:
        # Create a private conversation between operator and inspector
        # Then try to access it with supervisor (who is not a participant)
        other_user_response = supervisor_client.get(f'/api/messaging/conversations/{direct_conv_id}/')

        # Check if supervisor is actually a participant
        if other_user_response.status_code == 200:
            participants = [p['id'] for p in other_user_response.data.get('participants', [])]
            if supervisor.id in participants:
                log_test("Security - Cannot access non-participant conversation", True,
                        "User is participant (expected)")
            else:
                log_test("Security - Cannot access non-participant conversation", False,
                        "Non-participant could access conversation")
        else:
            log_test("Security - Cannot access non-participant conversation",
                    other_user_response.status_code in [403, 404])
    except Exception as e:
        log_test("Security - Cannot access non-participant conversation", False, str(e))

# Test 5.3: Very long message
if direct_conv_id:
    try:
        long_content = 'A' * 6000  # > 5000 chars
        response = operator_client.post(
            f'/api/messaging/conversations/{direct_conv_id}/messages/',
            {'content': long_content, 'message_type': 'text'},
            format='json'
        )
        log_test("Security - Very long message handled",
                response.status_code in [201, 400, 413])
    except Exception as e:
        log_test("Security - Very long message handled", False, str(e))

# ============================================================================
# FINAL SUMMARY
# ============================================================================
print()
print("=" * 70)
print("TEST SUMMARY")
print("=" * 70)
print(f"Total Passed:  {len(test_results['passed'])}")
print(f"Total Failed:  {len(test_results['failed'])}")
print(f"Total Skipped: {len(test_results['skipped'])}")
print()

if test_results['failed']:
    print("Failed Tests:")
    for name, reason in test_results['failed']:
        print(f"  [FAIL] {name}")
        if reason:
            print(f"    Reason: {reason}")
    print()

success_rate = len(test_results['passed']) / (len(test_results['passed']) + len(test_results['failed'])) * 100 if (len(test_results['passed']) + len(test_results['failed'])) > 0 else 0
print(f"Success Rate: {success_rate:.1f}%")
print()

if len(test_results['failed']) == 0:
    print("[PASS] ALL TESTS PASSED!")
else:
    print(f"[FAIL] {len(test_results['failed'])} test(s) failed")

print("=" * 70)
