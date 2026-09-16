# Critical Security & Bug Fixes Required Before Deployment

**Generated**: 2026-09-09  
**Review Status**: 133 issues found (5 critical, 29 high, 51 medium, 31 low)

---

## ⚠️ CRITICAL - Fix Immediately (5 Issues)

### 1. JWT Token Extraction Vulnerability
**File**: `backend/apps/messaging/consumers.py:27`  
**Risk**: Authentication bypass, token injection attacks

**Current Code**:
```python
token = self.scope['query_string'].decode().split('token=')[-1].split('&')[0]
```

**Fix**:
```python
from urllib.parse import parse_qs

query_string = self.scope['query_string'].decode()
parsed = parse_qs(query_string)
token = parsed.get('token', [None])[0]
if not token:
    await self.close(code=4001)
    return
```

---

### 2. WebSocket Reconnection After Widget Disposal (Mobile)
**File**: `mobile/lib/screens/messaging/chat_screen.dart:43`  
**Risk**: Memory leaks, crashes when callbacks fire on disposed widgets

**Fix**:
```dart
// In ChatScreen state class
bool _disposed = false;

@override
void dispose() {
  _disposed = true;
  // Clear callbacks before disconnecting
  _messagingService.onMessageReceived = null;
  _messagingService.onTypingIndicator = null;
  _messagingService.onMessageRead = null;
  _messagingService.disconnectWebSocket();
  super.dispose();
}

// In MessagingService
void connectWebSocket(String conversationId, String token, {VoidCallback? onDisposed}) {
  // Check disposal before reconnecting
  _channel = WebSocketChannel.connect(uri);
  _channel!.stream.listen(
    onData,
    onDone: () {
      if (onDisposed != null && onDisposed()) return; // Check if disposed
      Future.delayed(Duration(seconds: 3), () {
        if (onDisposed == null || !onDisposed()) {
          connectWebSocket(conversationId, token, onDisposed: onDisposed);
        }
      });
    },
  );
}
```

---

### 3. Shared MessagingService Instance State Conflicts (Mobile)
**File**: `mobile/lib/screens/messaging/chat_screen.dart:24`  
**Risk**: Messages appear in wrong conversations

**Fix**: Make MessagingService conversation-specific
```dart
// Option 1: Provider-based
class MessagingProvider extends ChangeNotifier {
  final Map<String, MessagingService> _services = {};
  
  MessagingService getService(String conversationId) {
    if (!_services.containsKey(conversationId)) {
      _services[conversationId] = MessagingService(conversationId);
    }
    return _services[conversationId]!;
  }
  
  void disposeService(String conversationId) {
    _services[conversationId]?.disconnectWebSocket();
    _services.remove(conversationId);
  }
}

// In ChatScreen
@override
void initState() {
  super.initState();
  final provider = Provider.of<MessagingProvider>(context, listen: false);
  _messagingService = provider.getService(widget.conversationId);
  // ... rest of init
}
```

---

### 4. WebSocket Message Structure Mismatch
**Files**: Backend consumers.py, Dashboard MessagingContext.jsx, Mobile messaging_service.dart  
**Risk**: Read receipts fail silently

**Fix Backend** (`apps/messaging/consumers.py:199-208`):
```python
# Change from:
await self.channel_layer.group_send(
    self.room_group_name,
    {
        'type': 'message_read',
        'message_id': str(message_read.message.id),
        'read_by': UserBasicSerializer(user).data,
    }
)

# To:
await self.channel_layer.group_send(
    self.room_group_name,
    {
        'type': 'message_read',
        'data': {  # Wrap in 'data' key
            'message_id': str(message_read.message.id),
            'read_by': UserBasicSerializer(user).data,
        }
    }
)
```

---

### 5. WebSocket Token in Query String
**Files**: All consumers/clients  
**Risk**: Token exposed in server logs, browser history

**Better Approach** (if backend supports):
```python
# Backend: Accept token in first message
async def connect(self):
    await self.accept()
    # Wait for auth message within 5 seconds
    
async def receive(self, text_data):
    data = json.loads(text_data)
    if not self.authenticated:
        if data.get('action') == 'authenticate':
            # Validate token from message
            self.authenticated = True
        return
    # ... normal message handling
```

**Immediate Workaround**: Document that tokens in query strings are logged and rotate tokens frequently.

---

## 🔥 HIGH PRIORITY - Fix Before Production (Top 10 of 29)

### 6. Missing Permission Check for Mark as Read
**File**: `backend/apps/messaging/consumers.py:289`

```python
async def mark_message_read(self, message_id):
    message = await sync_to_async(Message.objects.get)(id=message_id)
    # Add this check:
    if message.conversation_id != self.conversation_id:
        return None  # Prevent marking messages in other conversations
    # ... rest of method
```

---

### 7. XSS Vulnerability - Unsanitized Message Content (Dashboard)
**File**: `dashboard/src/components/messaging/ChatWindow.jsx:135`

**Install**:
```bash
npm install dompurify
```

**Fix**:
```jsx
import DOMPurify from 'dompurify';

// In message rendering:
<p 
  className="message-text"
  dangerouslySetInnerHTML={{ 
    __html: DOMPurify.sanitize(message.content) 
  }}
/>
```

---

### 8. N+1 Query Problem in Conversation List
**File**: `backend/apps/messaging/views.py:36`

```python
def get_queryset(self):
    from django.db.models import Prefetch
    return Conversation.objects.filter(
        participants=self.request.user
    ).select_related('admin', 'created_by').prefetch_related(
        'participants',
        Prefetch(
            'messages',
            queryset=Message.objects.filter(is_deleted=False)
                .select_related('sender')
                .order_by('-created_at')[:1]  # Only latest message
        )
    ).distinct().order_by('-updated_at')
```

---

### 9. perform_update Returns Response Instead of Raising Exception
**File**: `backend/apps/messaging/views.py:60, 268`

```python
# Change from:
def perform_update(self, serializer):
    if self.get_object().admin != self.request.user:
        return Response(
            {'detail': 'Only group admin can update'},
            status=status.HTTP_403_FORBIDDEN
        )
    serializer.save()

# To:
from rest_framework.exceptions import PermissionDenied

def perform_update(self, serializer):
    if self.get_object().admin != self.request.user:
        raise PermissionDenied('Only group admin can update')
    serializer.save()
```

---

### 10. Race Condition in WebSocket Reconnection (Dashboard)
**File**: `dashboard/src/context/MessagingContext.jsx:152`

```javascript
const connectWebSocket = useCallback((conversationId) => {
  // Use ref to track current conversation
  const currentConversationRef = useRef(activeConversation);
  
  useEffect(() => {
    currentConversationRef.current = activeConversation;
  }, [activeConversation]);

  // In onclose:
  ws.onclose = () => {
    wsRef.current = null;
    // Check current state, not closure
    if (currentConversationRef.current) {
      reconnectTimeoutRef.current = setTimeout(() => {
        connectWebSocket(currentConversationRef.current.id);
      }, 3000);
    }
  };
}, [/* dependencies */]);
```

---

### 11. Soft Delete Not Enforced at Model Level
**File**: `backend/apps/messaging/models.py:111`

```python
class ActiveMessageManager(models.Manager):
    def get_queryset(self):
        return super().get_queryset().filter(is_deleted=False)

class Message(models.Model):
    # ... existing fields ...
    
    objects = models.Manager()  # All messages
    active = ActiveMessageManager()  # Only non-deleted
    
    class Meta:
        indexes = [
            models.Index(fields=['conversation', 'is_deleted', '-created_at']),
        ]
```

---

### 12. Missing Composite Index for Participants
**File**: `backend/apps/messaging/models.py:19`

**Create migration**:
```python
# In new migration file
operations = [
    migrations.RunSQL(
        """
        CREATE INDEX messaging_conversation_participants_user_conv
        ON messaging_conversation_participants (user_id, conversation_id);
        """
    ),
]
```

---

### 13. No Rate Limiting
**File**: `backend/apps/messaging/views.py`, `consumers.py`

**Add to settings.py**:
```python
REST_FRAMEWORK = {
    'DEFAULT_THROTTLE_CLASSES': [
        'rest_framework.throttling.UserRateThrottle',
    ],
    'DEFAULT_THROTTLE_RATES': {
        'user': '1000/hour',
        'messaging': '60/minute',
        'uploads': '10/minute',
    }
}
```

**In views.py**:
```python
from rest_framework.throttling import UserRateThrottle

class MessagingRateThrottle(UserRateThrottle):
    scope = 'messaging'

class FileUploadThrottle(UserRateThrottle):
    scope = 'uploads'

class MessageViewSet(viewsets.ModelViewSet):
    throttle_classes = [MessagingRateThrottle]
    # ...

class FileUploadView(APIView):
    throttle_classes = [FileUploadThrottle]
    # ...
```

**For WebSocket** (in consumers.py):
```python
from django.core.cache import cache
from django.utils import timezone

async def handle_send_message(self, data):
    # Rate limit: 10 messages per minute
    cache_key = f'msg_rate_{self.user.id}'
    count = cache.get(cache_key, 0)
    if count >= 10:
        await self.send(text_data=json.dumps({
            'type': 'error',
            'message': 'Rate limit exceeded. Please slow down.'
        }))
        return
    cache.set(cache_key, count + 1, 60)  # 60 seconds
    
    # ... rest of method
```

---

### 14. Unbounded Message List Growth (Mobile)
**File**: `mobile/lib/screens/messaging/chat_screen.dart:29`

```dart
class _ChatScreenState extends State<ChatScreen> {
  List<Map<String, dynamic>> _messages = [];
  static const int MESSAGE_LIMIT = 100;
  int _offset = 0;
  bool _hasMore = true;
  
  Future<void> _loadMessages() async {
    final messages = await _messagingService.fetchMessages(
      widget.conversationId,
      offset: _offset,
      limit: 50,
    );
    
    setState(() {
      if (_messages.length > MESSAGE_LIMIT) {
        // Remove oldest messages beyond limit
        _messages = _messages.sublist(_messages.length - MESSAGE_LIMIT);
      }
      _messages.insertAll(0, messages);
      _offset += messages.length;
      _hasMore = messages.length == 50;
    });
  }
  
  // Add ScrollController with listener for infinite scroll
  @override
  void initState() {
    super.initState();
    _scrollController.addListener(() {
      if (_scrollController.position.pixels <= 0 && _hasMore && !_loading) {
        _loadMessages(); // Load more when scrolled to top
      }
    });
  }
}
```

---

### 15. WebSocket Callbacks Not Cleared on Dispose (Mobile)
**File**: `mobile/lib/screens/messaging/chat_screen.dart:65`

```dart
@override
void dispose() {
  // CRITICAL: Clear callbacks before disconnecting
  _messagingService.onMessageReceived = null;
  _messagingService.onTypingIndicator = null;
  _messagingService.onMessageRead = null;
  
  _messagingService.disconnectWebSocket();
  _scrollController.dispose();
  _messageController.dispose();
  super.dispose();
}
```

---

## 📋 Medium Priority (Top 5 of 51)

### 16. Missing Validation: Sender Must Be Participant
**File**: `backend/apps/messaging/models.py:82`

```python
class Message(models.Model):
    # ... existing fields ...
    
    def clean(self):
        if self.sender not in self.conversation.participants.all():
            raise ValidationError('Sender must be a conversation participant')
    
    def save(self, *args, **kwargs):
        self.full_clean()
        super().save(*args, **kwargs)
```

---

### 17. Missing Input Validation for Pagination
**File**: `backend/apps/messaging/views.py:234`

```python
def list(self, request, conversation_pk=None):
    try:
        offset = max(int(request.query_params.get('offset', 0)), 0)
        limit = min(max(int(request.query_params.get('limit', 50)), 1), 100)
    except (ValueError, TypeError):
        return Response(
            {'detail': 'Invalid offset or limit'},
            status=status.HTTP_400_BAD_REQUEST
        )
    # ... rest of method
```

---

### 18. File Name Sanitization Missing
**File**: `backend/apps/messaging/views.py:365`

```python
import os
from django.utils.text import get_valid_filename

file_name = get_valid_filename(os.path.basename(file.name))[:255]
```

---

### 19. Search Input Non-Functional (Dashboard)
**File**: `dashboard/src/components/messaging/ConversationList.jsx:51`

```jsx
const [searchTerm, setSearchTerm] = useState('');

const filteredConversations = conversations.filter(conv => {
  const name = getConversationName(conv).toLowerCase();
  const lastMsg = getLastMessagePreview(conv).toLowerCase();
  const term = searchTerm.toLowerCase();
  return name.includes(term) || lastMsg.includes(term);
});

// In render:
<input
  type="text"
  placeholder="Search conversations..."
  value={searchTerm}
  onChange={(e) => setSearchTerm(e.target.value)}
  className="conversation-search"
/>

{filteredConversations.map(conversation => (
  // ... render conversation
))}
```

---

### 20. Exponential Backoff for Reconnection
**File**: `dashboard/src/context/MessagingContext.jsx:151`

```javascript
const [reconnectAttempts, setReconnectAttempts] = useState(0);
const MAX_RECONNECT_ATTEMPTS = 10;

// In onclose:
ws.onclose = () => {
  wsRef.current = null;
  if (activeConversation && reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
    const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 30000);
    reconnectTimeoutRef.current = setTimeout(() => {
      setReconnectAttempts(prev => prev + 1);
      connectWebSocket(activeConversation.id);
    }, delay);
  } else if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
    console.error('Max reconnection attempts reached');
    // Show user notification
  }
};

// Reset on successful connection:
ws.onopen = () => {
  setReconnectAttempts(0);
  // ...
};
```

---

## ✅ Testing Checklist After Fixes

- [ ] JWT token validation works correctly
- [ ] Mobile app doesn't crash when navigating away from chat
- [ ] Multiple chat screens don't interfere with each other
- [ ] Read receipts display correctly across all platforms
- [ ] Message content with HTML/scripts is sanitized
- [ ] Conversation list loads quickly (no N+1 queries)
- [ ] Rate limiting prevents spam
- [ ] Mobile app handles long conversations without memory issues
- [ ] WebSocket reconnection uses exponential backoff
- [ ] Search functionality works in conversation list
- [ ] File uploads validate file types and sizes
- [ ] Authorization checks prevent unauthorized actions

---

## 📊 Full Report

Complete review results: `C:\Users\LENOVO\AppData\Local\Temp\claude\D--lihatech-ledger\63753433-48a9-4cfe-b357-942f8095dcf4\tasks\wzey5l8gq.output`

**Breakdown**:
- Backend: 54 issues (models, views, consumers, serializers)
- Dashboard: 27 issues (context, components)
- Mobile: 24 issues (services, screens)
- Integration: 10 issues (API contracts)
- Security: 15 issues (auth, validation, rate limiting)

---

## 🚀 Deployment Blockers

**DO NOT DEPLOY** until these are fixed:
1. JWT token extraction vulnerability (#1)
2. WebSocket message structure mismatch (#4)
3. XSS vulnerabilities (#7)
4. Missing rate limiting (#13)
5. Mobile memory leaks (#2, #14, #15)

All other issues can be addressed post-deployment with monitoring.
