import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'dart:async';
import '../../services/messaging_service.dart';
import 'chat_screen.dart';
import 'user_search_screen.dart';
import 'create_meet_screen.dart';
import 'group_creation_screen.dart';
import 'package:intl/intl.dart';
import '../../providers/auth_provider.dart';
import '../../providers/messaging_provider.dart';

class MessagesScreen extends StatefulWidget {
  const MessagesScreen({Key? key}) : super(key: key);

  @override
  State<MessagesScreen> createState() => _MessagesScreenState();
}

class _MessagesScreenState extends State<MessagesScreen> {
  late final MessagingService _messagingService;
  List<dynamic> _conversations = [];
  bool _loading = true;
  Timer? _refreshTimer;

  @override
  void initState() {
    super.initState();
    _messagingService = Provider.of<MessagingProvider>(context, listen: false).globalService;
    _loadConversations();
    // Refresh every 10 seconds for near-live unread badge updates
    _refreshTimer = Timer.periodic(const Duration(seconds: 10), (_) {
      _silentRefresh();
    });
  }

  @override
  void dispose() {
    _refreshTimer?.cancel();
    super.dispose();
  }

  Future<void> _loadConversations() async {
    setState(() => _loading = true);
    final conversations = await _messagingService.fetchConversations();
    if (mounted) {
      setState(() {
        _conversations = conversations;
        _loading = false;
      });
    }
  }

  /// Silent refresh — no loading spinner, just updates data in background.
  Future<void> _silentRefresh() async {
    if (!mounted) return;
    final conversations = await _messagingService.fetchConversations();
    if (mounted) {
      setState(() => _conversations = conversations);
    }
  }

  String _getConversationName(Map<String, dynamic> conversation, int currentUserId) {
    if (conversation['type'] == 'group') {
      return conversation['name'] ?? 'Unnamed Group';
    }

    final participants = conversation['participants'] as List? ?? [];
    final otherParticipant = participants.firstWhere(
      (p) => p['id'] != currentUserId,
      orElse: () => {'first_name': 'Unknown', 'last_name': 'User', 'email': ''},
    );

    final firstName = otherParticipant['first_name'] ?? '';
    final lastName = otherParticipant['last_name'] ?? '';
    return '$firstName $lastName'.trim().isEmpty
        ? otherParticipant['email'] ?? 'Unknown'
        : '$firstName $lastName'.trim();
  }

  String _getLastMessagePreview(Map<String, dynamic>? lastMessage, int currentUserId) {
    if (lastMessage == null) return 'No messages yet';

    final sender = lastMessage['sender'] as Map<String, dynamic>? ?? {};
    final senderId = sender['id'] as int? ?? 0;
    final senderName = senderId == currentUserId
        ? 'You'
        : sender['first_name'] ?? sender['email']?.split('@')[0] ?? 'Unknown';

    final messageType = lastMessage['message_type'] ?? 'text';
    final content = lastMessage['content'] ?? '';

    if (messageType == 'image') return '$senderName: 📷 Image';
    if (messageType == 'file') return '$senderName: 📎 File';
    if (messageType == 'meeting') return '$senderName: 📅 Meeting';

    final preview = content.length > 50 ? '${content.substring(0, 50)}...' : content;
    return '$senderName: $preview';
  }

  String _formatTime(String? timestamp) {
    if (timestamp == null) return '';
    try {
      final dateTime = DateTime.parse(timestamp);
      final now = DateTime.now();
      final difference = now.difference(dateTime);

      if (difference.inDays == 0) {
        return DateFormat('HH:mm').format(dateTime);
      } else if (difference.inDays == 1) {
        return 'Yesterday';
      } else if (difference.inDays < 7) {
        return DateFormat('EEEE').format(dateTime);
      } else {
        return DateFormat('MMM dd').format(dateTime);
      }
    } catch (e) {
      return '';
    }
  }

  @override
  Widget build(BuildContext context) {
    // Fix: Fall back to 0 (not 1) so we never accidentally treat messages from
    // real user ID 1 as the current user's own when the session has no persisted userId.
    final currentUserId = int.tryParse(Provider.of<AuthProvider>(context, listen: false).userId ?? '0') ?? 0;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Messages'),
        actions: [
          IconButton(
            icon: const Icon(Icons.search),
            onPressed: () async {
              final result = await Navigator.push(
                context,
                MaterialPageRoute(
                  builder: (context) => const UserSearchScreen(),
                ),
              );

              if (result != null) {
                _loadConversations();
              }
            },
          ),
        ],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _conversations.isEmpty
              ? Center(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(Icons.chat_bubble_outline, size: 64, color: Colors.grey[400]),
                      const SizedBox(height: 16),
                      Text(
                        'No conversations yet',
                        style: TextStyle(fontSize: 18, color: Colors.grey[600]),
                      ),
                      const SizedBox(height: 8),
                      Text(
                        'Start a new chat to get started',
                        style: TextStyle(fontSize: 14, color: Colors.grey[500]),
                      ),
                    ],
                  ),
                )
              : RefreshIndicator(
                  onRefresh: _loadConversations,
                  child: ListView.builder(
                    itemCount: _conversations.length,
                    itemBuilder: (context, index) {
                      final conversation = _conversations[index] as Map<String, dynamic>;
                      final conversationId = conversation['id'] ?? '';
                      final unreadCount = conversation['unread_count'] ?? 0;
                      final lastMessage = conversation['last_message'] as Map<String, dynamic>?;

                      return ListTile(
                        leading: CircleAvatar(
                          backgroundColor: Colors.blue,
                          child: Text(
                            _getConversationName(conversation, currentUserId)[0].toUpperCase(),
                            style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold),
                          ),
                        ),
                        title: Text(
                          _getConversationName(conversation, currentUserId),
                          style: const TextStyle(fontWeight: FontWeight.w600),
                        ),
                        subtitle: Row(
                          children: [
                            if (lastMessage != null && (lastMessage['sender']?['id'] as int? ?? 0) == currentUserId) ...[
                              Icon(
                                Icons.done_all,
                                size: 14,
                                color: (lastMessage['read_by'] as List?)?.isNotEmpty == true ? Colors.blue : Colors.grey,
                              ),
                              const SizedBox(width: 4),
                            ],
                            Expanded(
                              child: Text(
                                _getLastMessagePreview(lastMessage, currentUserId),
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: TextStyle(
                                  color: unreadCount > 0 ? Colors.black87 : Colors.grey[600],
                                  fontWeight: unreadCount > 0 ? FontWeight.w500 : FontWeight.normal,
                                ),
                              ),
                            ),
                          ],
                        ),
                        trailing: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          crossAxisAlignment: CrossAxisAlignment.end,
                          children: [
                            Text(
                              _formatTime(conversation['updated_at']),
                              style: TextStyle(
                                fontSize: 12,
                                color: unreadCount > 0 ? Colors.blue : Colors.grey[600],
                              ),
                            ),
                            if (unreadCount > 0) ...[
                              const SizedBox(height: 4),
                              Container(
                                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                decoration: BoxDecoration(
                                  color: Colors.blue,
                                  borderRadius: BorderRadius.circular(10),
                                ),
                                child: Text(
                                  unreadCount.toString(),
                                  style: const TextStyle(
                                    color: Colors.white,
                                    fontSize: 12,
                                    fontWeight: FontWeight.bold,
                                  ),
                                ),
                              ),
                            ],
                          ],
                        ),
                        onTap: () async {
                          await Navigator.push(
                            context,
                            MaterialPageRoute(
                              builder: (context) => ChatScreen(
                                conversationId: conversationId,
                                conversationName: _getConversationName(conversation, currentUserId),
                              ),
                            ),
                          );
                          _loadConversations();
                        },
                      );
                    },
                  ),
                ),
      floatingActionButton: FloatingActionButton(
        onPressed: () {
          showModalBottomSheet(
            context: context,
            shape: const RoundedRectangleBorder(
              borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
            ),
            builder: (context) => SafeArea(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  ListTile(
                    leading: const Icon(Icons.chat),
                    title: const Text('New Conversation'),
                    onTap: () async {
                      Navigator.pop(context); // close bottom sheet
                      final result = await Navigator.push(
                        context,
                        MaterialPageRoute(
                          builder: (context) => const UserSearchScreen(),
                        ),
                      );
                      if (result != null) {
                        _loadConversations();
                      }
                    },
                  ),
                  ListTile(
                    leading: const Icon(Icons.group_add),
                    title: const Text('New Group'),
                    subtitle: const Text('Create a group with org members'),
                    onTap: () async {
                      Navigator.pop(context); // close bottom sheet
                      final result = await Navigator.push(
                        context,
                        MaterialPageRoute(
                          builder: (context) => const GroupCreationScreen(),
                        ),
                      );
                      if (result == true) {
                        _loadConversations();
                      }
                    },
                  ),
                  ListTile(
                    leading: const Icon(Icons.video_call),
                    title: const Text('Create Meet'),
                    subtitle: const Text('Invite org members to a Jitsi meeting'),
                    onTap: () async {
                      Navigator.pop(context); // close bottom sheet
                      final result = await Navigator.push(
                        context,
                        MaterialPageRoute(
                          builder: (context) => const CreateMeetScreen(),
                        ),
                      );
                      if (result == true) {
                        _loadConversations();
                      }
                    },
                  ),
                ],
              ),
            ),
          );
        },
        child: const Icon(Icons.add),
      ),
    );
  }
}
