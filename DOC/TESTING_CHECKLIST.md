# Messaging Module - Manual Testing Checklist

## Prerequisites

- [ ] Backend server running on http://localhost:8000
- [ ] Dashboard running on http://localhost:5173
- [ ] Mobile app running on browser
- [ ] Test users created (operator, inspector, supervisor)

---

## Backend API Testing

### 1. Conversations API

- [x] **GET /api/messaging/conversations/** - List conversations
  - Verify authenticated user sees only their conversations
  - Check pagination works correctly
  - Verify unread counts are accurate

- [ ] **POST /api/messaging/conversations/** - Create conversation
  - Test creating direct message (1-on-1)
  - Test creating group chat with multiple users
  - Verify creator becomes admin for groups
  - Test with invalid participant IDs

- [ ] **GET /api/messaging/conversations/{id}/** - Get conversation details
  - Verify participants list is complete
  - Check admin field for groups
  - Verify recent messages are included

- [ ] **PATCH /api/messaging/conversations/{id}/** - Update conversation
  - Test updating group name (admin only)
  - Test updating description (admin only)
  - Verify non-admin cannot update

- [ ] **DELETE /api/messaging/conversations/{id}/** - Leave conversation
  - Test user can leave conversation
  - Verify user removed from participants
  - Test admin leaving transfers admin role

### 2. Messages API

- [ ] **GET /api/messaging/conversations/{id}/messages/** - List messages
  - Test pagination (offset/limit)
  - Verify messages ordered by created_at
  - Test with 0 messages, 1 message, 50+ messages

- [ ] **POST /api/messaging/conversations/{id}/messages/** - Send message
  - Test sending text message
  - Test sending with reply_to (threading)
  - Verify sender is set correctly
  - Test empty content (should fail)

- [ ] **PATCH /api/messaging/messages/{id}/** - Edit message
  - Test sender can edit their message
  - Test non-sender cannot edit
  - Verify edited_at timestamp is set

- [ ] **DELETE /api/messaging/messages/{id}/** - Delete message
  - Test soft delete (is_deleted=True)
  - Verify message still in database
  - Test non-sender cannot delete

- [ ] **POST /api/messaging/messages/{id}/read/** - Mark as read
  - Test marking message as read
  - Verify MessageRead object created
  - Test marking own message (should work but be redundant)

### 3. File Upload API

- [ ] **POST /api/messaging/upload/** - Upload file
  - Test uploading image (< 10MB)
    - Verify uploaded to Cloudinary
    - Check cloudinary_url is returned
    - Verify thumbnail_url is generated
  - Test uploading document (< 5MB)
    - Verify stored in PostgreSQL
    - Check file_data field populated
  - Test file size limits
    - Image > 10MB (should fail)
    - Document > 5MB (should fail)
  - Test invalid file types
  - Test without authentication (should fail)

### 4. User Search API

- [ ] **GET /api/messaging/users/search/?q={query}**
  - Test searching by first name
  - Test searching by last name
  - Test searching by email
  - Test with < 2 characters (returns suggestions)
  - Test with no matches
  - Verify current user excluded from results

### 5. Group Admin Actions

- [ ] **POST /api/messaging/conversations/{id}/add-participant/**
  - Test admin can add members
  - Test non-admin cannot add (should fail with 403)
  - Test adding user already in group

- [ ] **POST /api/messaging/conversations/{id}/remove-participant/**
  - Test admin can remove members
  - Test non-admin cannot remove (should fail with 403)
  - Test removing non-existent participant

- [ ] **POST /api/messaging/conversations/{id}/transfer-admin/**
  - Test admin can transfer role
  - Test non-admin cannot transfer (should fail with 403)
  - Test transferring to non-participant (should fail)
  - Verify new admin has permissions

---

## WebSocket Testing

### Connection

- [ ] Open WebSocket: `ws://localhost:8000/ws/messaging/{conversation_id}/?token={jwt_token}`
  - Test with valid token (should connect)
  - Test with invalid token (should disconnect with 4001)
  - Test with expired token (should disconnect with 4001)
  - Test without token (should disconnect with 4001)
  - Test with non-participant user (should disconnect with 4003)

### Real-time Messaging

- [ ] **Send Message Action**

  ```json
  {
    "action": "send_message",
    "data": { "content": "Hello", "message_type": "text" }
  }
  ```

  - Verify message broadcasts to all participants
  - Check message saved to database
  - Test with reply_to field
  - Verify conversation updated_at timestamp updates

- [ ] **Typing Indicator Action**

  ```json
  { "action": "typing", "data": { "is_typing": true } }
  ```

  - Verify broadcasts to other participants (not sender)
  - Test starting typing (is_typing: true)
  - Test stopping typing (is_typing: false)

- [ ] **Mark as Read Action**

  ```json
  { "action": "mark_read", "data": { "message_id": "uuid" } }
  ```

  - Verify MessageRead object created
  - Check broadcasts to other participants
  - Verify read receipts shown correctly

### Error Handling

- [ ] Send invalid JSON (should return error)
- [ ] Send unknown action (should return error)
- [ ] Send malformed data (should return error)

---

## Dashboard Frontend Testing

### Navigation

- [x] Click "Messages" in sidebar
  - Verify navigates to /messages
  - Check page loads correctly

### Conversation List

- [x] View conversation list
  - Verify conversations sorted by updated_at
  - Check unread badges display correctly
  - Verify last message preview shows
  - Check time formatting (HH:mm, Yesterday, day name, date)

- [x] Search conversations
  - Type in search box
  - Verify filters conversations

### User Search & Create Conversation

- [x] Click "+ New Chat" button
  - Verify modal opens
  - Test searching users by name
  - Test searching users by email
  - Click user to start conversation
  - Verify conversation created and opened

### Chat Window

- [x] Select a conversation
  - Verify messages load
  - Check sent/received styling
  - Verify message grouping by sender
  - Check timestamps display
  - Test auto-scroll to bottom

- [x] Send a message
  - Type in input field
  - Press Enter or click Send
  - Verify message appears immediately
  - Check message persists after refresh

- [x] Receive a message (open 2 browser windows)
  - Send message from Window 1
  - Verify appears in Window 2 in real-time
  - No page refresh needed

- [x] Typing indicators
  - Start typing in Window 1
  - Verify "User is typing..." shows in Window 2
  - Stop typing
  - Verify indicator disappears after 3 seconds

- [x] Read receipts
  - Send message from Window 1
  - Open conversation in Window 2
  - Verify double checkmark (✓✓) appears in Window 1

- [x] File attachments
  - Click attach button
  - Select image
  - Verify uploads and displays inline
  - Select document
  - Verify shows as downloadable link

- [ ] Google Meet integration
  - Click video call button
  - Verify opens meet.google.com/new in new tab

### Responsive Design

- [ ] Resize browser window
  - Check layout adapts
  - Verify mobile breakpoint works

---

## Mobile App Testing

### Operator Home Screen

- [ ] View Messages card
  - Verify card displays with icon and text
  - Check gradient styling
  - Tap card
  - Verify navigates to Messages screen

### Messages Screen

- [ ] View conversation list
  - Check conversations display correctly
  - Verify unread badges show
  - Test pull-to-refresh

- [ ] Tap FAB (floating action button)
  - Verify opens user search
  - Search for a user
  - Tap user
  - Verify creates conversation and opens chat

### Chat Screen

- [ ] Send messages
  - Type message
  - Tap send button
  - Verify message appears

- [ ] Receive messages in real-time
  - Open app on 2 devices/browsers
  - Send from Device 1
  - Verify appears on Device 2 without refresh

- [ ] Typing indicators
  - Start typing on Device 1
  - Verify animated dots show on Device 2

- [ ] Attachments
  - Tap image button
  - Select photo from gallery
  - Verify uploads (placeholder for now)
  - Tap attachment button
  - Select file
  - Verify uploads (placeholder for now)

- [ ] Navigation
  - Tap back button
  - Verify returns to Messages list
  - Check unread count updates

---

## Integration Testing

### Cross-Platform Real-time

- [ ] **Dashboard ↔ Mobile**
  - Send message from Dashboard
  - Verify appears on Mobile in real-time
  - Send message from Mobile
  - Verify appears on Dashboard in real-time

- [ ] **Typing indicators across platforms**
  - Type in Dashboard
  - Verify Mobile shows "User is typing..."
  - Type in Mobile
  - Verify Dashboard shows indicator

- [ ] **Read receipts across platforms**
  - Send from Dashboard
  - Open on Mobile
  - Verify Dashboard shows ✓✓

### Multiple Users

- [ ] Create group chat with 3+ users
  - Verify all users see the chat
  - Send message as User 1
  - Verify Users 2 & 3 receive in real-time
  - Verify typing indicators work for all
  - Check read receipts from multiple users

### Data Persistence

- [ ] Send messages
- [ ] Close browser/app
- [ ] Reopen
- [ ] Verify messages still there
- [ ] Verify can scroll up to load older messages

### File Storage

- [ ] Upload image
  - Verify stored in Cloudinary
  - Check URL contains "cloudinary.com"
  - Verify thumbnail generated

- [ ] Upload document
  - Verify stored in PostgreSQL
  - Check can download
  - Verify persists after Render restart (if deployed)

---

## Performance Testing

### Load Testing

- [ ] Create conversation with 100+ messages
  - Verify loads first 50
  - Scroll up
  - Verify loads next 50
  - Check no lag or freezing

- [ ] Send 10 messages rapidly
  - Verify all appear
  - Check order is correct
  - Verify no duplicates

### WebSocket Reconnection

- [ ] Open chat
- [ ] Stop backend server
- [ ] Wait for disconnect
- [ ] Restart backend
- [ ] Verify reconnects automatically (3 seconds)
- [ ] Send message
- [ ] Verify works after reconnection

---

## Security Testing

### Authentication

- [ ] Try accessing API without token
  - Verify returns 401 Unauthorized

- [ ] Try accessing other user's conversations
  - Verify returns 404 or empty list

- [ ] Try WebSocket with invalid token
  - Verify disconnects with code 4001

### Authorization

- [ ] Try editing someone else's message
  - Verify returns 403 Forbidden

- [ ] Try removing member as non-admin
  - Verify returns 403 Forbidden

- [ ] Try accessing conversation you're not in
  - Verify returns 404 or 403

### Input Validation

- [ ] Send empty message
  - Verify rejected

- [ ] Send very long message (>5000 chars)
  - Verify truncated or rejected

- [ ] Upload file > size limit
  - Verify rejected with error message

- [ ] Upload malicious file type
  - Verify python-magic validates MIME type
  - Reject if not allowed type

---

## Edge Cases

### Network Issues

- [ ] Disconnect internet while sending message
  - Verify graceful error handling
  - Reconnect
  - Retry sending

### Empty States

- [ ] New user with 0 conversations
  - Verify empty state shows
  - Check "Start a new chat" message displays

- [ ] Conversation with 0 messages
  - Verify empty state shows
  - Check placeholder text

### Large Data

- [ ] User with 50+ conversations
  - Verify scrolling works
  - Check performance is acceptable

- [ ] Conversation with 500+ messages
  - Verify infinite scroll works
  - Check only 50 loaded at a time

### Group Chat Edge Cases

- [ ] Group with only admin
  - Admin leaves
  - Verify group still exists (no participants)

- [ ] Group with 2 members (admin + 1)
  - Admin leaves
  - Verify remaining member becomes admin

- [ ] Remove all members except admin
  - Verify admin can add new members
  - Verify group still functional

---

## Browser Compatibility

- [ ] Chrome/Edge (latest)
- [ ] Firefox (latest)
- [ ] Safari (if available)
- [ ] Mobile Chrome (Android)
- [ ] Mobile Safari (iOS)

---

## Deployment Testing (Render)

### Environment Variables

- [ ] Verify Cloudinary credentials set
- [ ] Check Redis URL configured
- [ ] Verify DATABASE_URL correct

### WebSocket

- [ ] Test WebSocket over WSS (secure)
- [ ] Verify CORS configured correctly
- [ ] Check Daphne serving WebSocket

### File Storage

- [ ] Upload image
  - Verify goes to Cloudinary (not local)
- [ ] Upload document
  - Verify in PostgreSQL
  - Restart Render service
  - Verify document still accessible

---

## Final Checklist

- [ ] All API endpoints return correct status codes
- [ ] All WebSocket actions work as expected
- [ ] Real-time messaging works across all platforms
- [ ] File uploads work for both images and documents
- [ ] Group admin permissions enforced correctly
- [ ] Typing indicators show and disappear correctly
- [ ] Read receipts display accurately
- [ ] Unread counts update in real-time
- [ ] Infinite scroll loads older messages
- [ ] Messages persist across sessions
- [ ] No console errors in browser
- [ ] No Python exceptions in backend logs
- [ ] Performance is acceptable (no lag)
- [ ] UI is responsive on mobile and desktop

---

## Test Results Summary

**Date:** ******\_\_\_******
**Tested by:** ******\_\_\_******

**Backend API:** **_ / _** tests passed
**WebSocket:** **_ / _** tests passed
**Dashboard UI:** **_ / _** tests passed
**Mobile App:** **_ / _** tests passed
**Integration:** **_ / _** tests passed
**Security:** **_ / _** tests passed

**Overall Status:** ☐ PASS ☐ FAIL

**Issues Found:**

1. ***
2. ***
3. ***

**Notes:**

---

---

---
