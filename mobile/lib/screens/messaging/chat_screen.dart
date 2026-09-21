import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../services/messaging_service.dart';
import '../../providers/messaging_provider.dart';
import '../../providers/auth_provider.dart';
import '../../widgets/messaging/message_bubble.dart';
import '../../widgets/messaging/typing_indicator.dart';
import 'package:image_picker/image_picker.dart';
import 'package:file_picker/file_picker.dart';
import 'dart:io';
import 'user_search_screen.dart';

class ChatScreen extends StatefulWidget {
  final String conversationId;
  final String conversationName;

  const ChatScreen({
    Key? key,
    required this.conversationId,
    required this.conversationName,
  }) : super(key: key);

  @override
  State<ChatScreen> createState() => _ChatScreenState();
}

class _ChatScreenState extends State<ChatScreen> {
  late MessagingService _messagingService;
  final TextEditingController _messageController = TextEditingController();
  final ScrollController _scrollController = ScrollController();
  final ImagePicker _imagePicker = ImagePicker();

  List<Map<String, dynamic>> _messages = [];
  Map<int, String> _typingUsers = {};
  bool _loading = true;
  bool _isTyping = false;
  bool _disposed = false; // Track disposal state
  
  Map<String, dynamic>? _replyingTo;
  List<Map<String, dynamic>> _pinnedMessages = [];
  int _currentPinIndex = 0;

  Map<int, bool> _onlineUsers = {};
  List<dynamic> _participants = [];
  bool _isGroup = false;
  int? _otherUserId;
  Map<String, dynamic>? _conversationDetails;

  @override
  void initState() {
    super.initState();

    // Get conversation-specific MessagingService from provider
    final messagingProvider = Provider.of<MessagingProvider>(context, listen: false);
    _messagingService = messagingProvider.getService(widget.conversationId);

    _loadMessages();
    _connectWebSocket();
  }

  @override
  void dispose() {
    _disposed = true;

    // Clear ALL callbacks before disconnecting to prevent setState() on disposed widget.
    // onMessageDeleted must also be cleared — the service may outlive this screen.
    _messagingService.onMessageReceived = null;
    _messagingService.onMessageSent = null;
    _messagingService.onTypingIndicator = null;
    _messagingService.onMessageRead = null;
    _messagingService.onMessageReaction = null;
    _messagingService.onMessageDeleted = null; // Fix: was missing — caused stale callback leak
    _messagingService.onPresenceUpdated = null;

    _messagingService.disconnectWebSocket();
    _messagingService.disconnectPresenceWebSocket();
    _messageController.dispose();
    _scrollController.dispose();
    super.dispose();
  }

  Future<void> _loadMessages() async {
    setState(() => _loading = true);
    final result = await _messagingService.fetchMessages(widget.conversationId);
    final messages = result['results'] as List? ?? [];
    
    final conv = await _messagingService.getConversation(widget.conversationId);
    final pinned = conv != null ? (conv['pinned_messages'] as List? ?? []) : [];

    if (_disposed) return;

    final authProvider = Provider.of<AuthProvider>(context, listen: false);
    final currentUserId = int.tryParse(authProvider.userId ?? '0') ?? 0;

    setState(() {
      _messages = messages.cast<Map<String, dynamic>>().reversed.toList();
      _pinnedMessages = pinned.cast<Map<String, dynamic>>();
      _loading = false;
      if (conv != null) {
        _conversationDetails = conv;
        _isGroup = conv['type'] == 'group';
        _participants = conv['participants'] as List? ?? [];
        if (!_isGroup) {
          final other = _participants.firstWhere((p) => (p['id'] as int?) != currentUserId, orElse: () => null);
          if (other != null) _otherUserId = other['id'] as int?;
        }
      }
    });

    _scrollToBottom();
    _markUnreadAsRead();
  }

  void _markUnreadAsRead() {
    if (_messages.isEmpty) return;
    
    final authProvider = Provider.of<AuthProvider>(context, listen: false);
    final currentUserId = int.tryParse(authProvider.userId ?? '0') ?? 0;

    for (var msg in _messages) {
      final sender = msg['sender'] as Map<String, dynamic>? ?? {};
      final senderId = sender['id'] as int? ?? 0;
      
      // If we didn't send it, check if we've read it
      if (senderId != currentUserId) {
        final readBy = msg['read_by'] as List? ?? [];
        final hasRead = readBy.any((r) => r['user']?['id']?.toString() == currentUserId.toString());
        
        if (!hasRead) {
          _messagingService.markMessageAsReadHttp(widget.conversationId, msg['id'].toString());
        }
      }
    }
  }

  void _connectWebSocket() {
    _messagingService.connectWebSocket(widget.conversationId);
    
    _messagingService.onPresenceUpdated = (onlineUsers) {
      if (_disposed) return;
      setState(() {
        _onlineUsers = Map.from(onlineUsers);
      });
    };
    _messagingService.connectPresenceWebSocket();

    // Message we sent — server echoes it back as 'message_sent' with the full saved object
    _messagingService.onMessageSent = (message) {
      if (_disposed) return;
      setState(() {
        // Fix: Deduplicate — server echoes the saved message back as 'message_sent'.
        // Without this check, the message would appear twice when sent via WebSocket.
        final exists = _messages.any((m) => m['id']?.toString() == message['id']?.toString());
        if (!exists) _messages.add(message);
      });
      _scrollToBottom();
    };

    _messagingService.onMessageReceived = (message) {
      if (_disposed) return; // Prevent setState on disposed widget
      setState(() {
        // Avoid duplicates: server may echo back a message we already added optimistically
        final exists = _messages.any((m) => m['id']?.toString() == message['id']?.toString());
        if (!exists) _messages.add(message);
      });
      _scrollToBottomIfNeeded();
    };

    _messagingService.onTypingIndicator = (data) {
      if (_disposed) return; // Prevent setState on disposed widget
      final user = data['user'] as Map<String, dynamic>;
      final isTyping = data['is_typing'] as bool;
      final userId = user['id'] as int;

      setState(() {
        if (isTyping) {
          _typingUsers[userId] = user['first_name'] ?? user['email'];
        } else {
          _typingUsers.remove(userId);
        }
      });
    };

    _messagingService.onMessageRead = (data) {
      if (_disposed) return; // Prevent setState on disposed widget
      final messageId = data['message_id'] as String;
      final readBy = data['read_by'] as Map<String, dynamic>;

      setState(() {
        final messageIndex = _messages.indexWhere((m) => m['id'] == messageId);
        if (messageIndex != -1) {
          final readByList = _messages[messageIndex]['read_by'] as List? ?? [];
          readByList.add(readBy);
          _messages[messageIndex]['read_by'] = readByList;
        }
      });
    };

    _messagingService.onMessageDeleted = (messageId) {
      if (_disposed) return;
      setState(() {
        _messages.removeWhere((m) => m['id'].toString() == messageId);
      });
    };

    _messagingService.onMessageReaction = (data) {
      if (_disposed) return;
      final messageId = data['message_id'] as String;
      final reactions = data['reactions'] as List;
      setState(() {
        final idx = _messages.indexWhere((m) => m['id'].toString() == messageId);
        if (idx != -1) {
          _messages[idx]['reactions'] = reactions;
        }
      });
    };
  }

  void _scrollToBottom() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (_scrollController.hasClients) {
        _scrollController.animateTo(
          _scrollController.position.maxScrollExtent,
          duration: const Duration(milliseconds: 300),
          curve: Curves.easeOut,
        );
      }
    });
  }

  void _scrollToBottomIfNeeded() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (_scrollController.hasClients) {
        final position = _scrollController.position;
        final maxScroll = position.maxScrollExtent;
        final currentScroll = position.pixels;
        
        // If we are within 300 pixels of the bottom, auto-scroll.
        // Otherwise, the user is reading history; let them be.
        if (maxScroll - currentScroll <= 300) {
          _scrollController.animateTo(
            maxScroll,
            duration: const Duration(milliseconds: 300),
            curve: Curves.easeOut,
          );
        }
      }
    });
  }

  void _sendMessage() {
    final text = _messageController.text.trim();
    if (text.isEmpty) return;

    // Capture replyTo ID before clearing state
    final replyToId = _replyingTo?['id']?.toString();

    // Clear input immediately for snappy UX
    _messageController.clear();
    setState(() {
      _isTyping = false;
      _replyingTo = null;
    });

    _messagingService.sendMessage(
      content: text,
      replyTo: replyToId,
    );
    _messagingService.sendTypingIndicator(false);
  }

  void _onTyping(String value) {
    if (value.isNotEmpty && !_isTyping) {
      setState(() => _isTyping = true);
      _messagingService.sendTypingIndicator(true);
    } else if (value.isEmpty && _isTyping) {
      setState(() => _isTyping = false);
      _messagingService.sendTypingIndicator(false);
    }
  }

  Future<void> _pickImage() async {
    final XFile? image = await _imagePicker.pickImage(source: ImageSource.gallery);
    if (image != null) {
      final bytes = await image.readAsBytes();
      try {
        final message = await _messagingService.sendAttachment(
          conversationId: widget.conversationId,
          bytes: bytes,
          filename: image.name,
          messageType: 'image',
        );

        if (message == null && mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Failed to upload image')),
          );
        } else if (message != null && mounted) {
          setState(() {
            _messages.add(message);
          });
          _scrollToBottom();
        }
      } on ArgumentError catch (e) {
        // Fix 5: File size limit exceeded
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text(e.message.toString())),
          );
        }
      }
    }
  }

  Future<void> _pickFile() async {
    final result = await FilePicker.platform.pickFiles();
    if (result != null && result.files.isNotEmpty) {
      final file = result.files.first;
      final bytes = file.bytes;

      if (bytes != null) {
        try {
          final message = await _messagingService.sendAttachment(
            conversationId: widget.conversationId,
            bytes: bytes,
            filename: file.name,
            messageType: 'file',
          );

          if (message == null && mounted) {
            ScaffoldMessenger.of(context).showSnackBar(
              const SnackBar(content: Text('Failed to upload file')),
            );
          } else if (message != null && mounted) {
            setState(() {
              _messages.add(message);
            });
            _scrollToBottom();
          }
        } on ArgumentError catch (e) {
          // Fix 5: File size limit exceeded
          if (mounted) {
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(content: Text(e.message.toString())),
            );
          }
        }
      } else {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Could not read file data')),
          );
        }
      }
    }
  }

  Future<void> _pinMessage(String messageId) async {
    final success = await _messagingService.pinMessage(widget.conversationId, messageId);
    if (success) {
      // Reload messages to get updated pinned list from backend
      _loadMessages();
    } else if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Failed to pin/unpin message')),
      );
    }
  }

  void _showReactionPicker(String messageId) {
    showModalBottomSheet(
      context: context,
      builder: (context) {
        final emojis = ['👍', '❤️', '😂', '😮', '😢', '🔥'];
        return SafeArea(
          child: Padding(
            padding: const EdgeInsets.symmetric(vertical: 20),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceEvenly,
              children: emojis.map((emoji) {
                return GestureDetector(
                  onTap: () async {
                    Navigator.pop(context);
                    final success = await _messagingService.reactToMessage(
                        widget.conversationId, messageId, emoji);
                    if (success) {
                      // Update reactions locally from REST response instead of _loadMessages()
                      // (WebSocket broadcast will also deliver the update via onMessageReaction)
                    } else if (mounted) {
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(content: Text('Failed to add reaction')),
                      );
                    }
                  },
                  child: Text(emoji, style: const TextStyle(fontSize: 32)),
                );
              }).toList(),
            ),
          ),
        );
      },
    );
  }

  void _showForwardDialog(String messageId, String content) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (sheetContext) {
        return _ForwardConversationSheet(
          messagingService: _messagingService,
          sourceConversationId: widget.conversationId,
          messageId: messageId,
          currentUserId: int.tryParse(
                Provider.of<AuthProvider>(context, listen: false).userId ?? '0') ??
            0,
        );
      },
    );
  }

  void _showDetails() {
    if (_conversationDetails == null) return;

    final currentUserId = int.tryParse(Provider.of<AuthProvider>(context, listen: false).userId ?? '0') ?? 0;

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (sheetContext) {
        return DraggableScrollableSheet(
          initialChildSize: 0.6,
          maxChildSize: 0.9,
          minChildSize: 0.4,
          expand: false,
          builder: (context, scrollController) {
            if (!_isGroup) {
              final otherUser = _participants.firstWhere((p) => (p['id'] as int?) != currentUserId, orElse: () => null);
              if (otherUser == null) return const SizedBox();
              
              final name = "${otherUser['first_name'] ?? ''} ${otherUser['last_name'] ?? ''}".trim();
              final displayName = name.isNotEmpty ? name : (otherUser['email'] ?? 'Unknown');
              
              return SingleChildScrollView(
                controller: scrollController,
                padding: const EdgeInsets.all(24),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.center,
                  children: [
                    CircleAvatar(
                      radius: 50,
                      backgroundColor: Colors.indigo.shade100,
                      child: Text(
                        displayName.isNotEmpty ? displayName[0].toUpperCase() : '?',
                        style: TextStyle(fontSize: 40, color: Colors.indigo.shade700, fontWeight: FontWeight.bold),
                      ),
                    ),
                    const SizedBox(height: 16),
                    Text(displayName, style: const TextStyle(fontSize: 24, fontWeight: FontWeight.bold)),
                    const SizedBox(height: 32),
                    _buildDetailRow('Email', otherUser['email'] ?? 'N/A'),
                    const Divider(),
                    _buildDetailRow('Role', otherUser['role'] ?? 'N/A'),
                  ],
                ),
              );
            } else {
              final name = _conversationDetails!['name'] ?? 'Unnamed Group';
              final desc = _conversationDetails!['description'] as String?;
              final admin = _conversationDetails!['admin'];
              final creator = _conversationDetails!['created_by'];

              return SingleChildScrollView(
                controller: scrollController,
                padding: const EdgeInsets.all(24),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.center,
                  children: [
                    CircleAvatar(
                      radius: 50,
                      backgroundColor: Colors.grey.shade200,
                      child: Text(
                        name.isNotEmpty ? name[0].toUpperCase() : 'G',
                        style: TextStyle(fontSize: 40, color: Colors.grey.shade700, fontWeight: FontWeight.bold),
                      ),
                    ),
                    const SizedBox(height: 16),
                    Text(name, style: const TextStyle(fontSize: 24, fontWeight: FontWeight.bold)),
                    
                    if (desc != null && desc.isNotEmpty) ...[
                      const SizedBox(height: 24),
                      Container(
                        width: double.infinity,
                        padding: const EdgeInsets.all(16),
                        decoration: BoxDecoration(
                          color: Colors.grey.shade100,
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text('Description', style: TextStyle(fontSize: 14, color: Colors.grey.shade600, fontWeight: FontWeight.w500)),
                            const SizedBox(height: 8),
                            Text(desc, style: const TextStyle(fontSize: 16)),
                          ],
                        ),
                      ),
                    ],
                    
                    const SizedBox(height: 24),
                    Align(
                      alignment: Alignment.centerLeft,
                      child: Text('Participants (${_participants.length})', style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
                    ),
                    const SizedBox(height: 12),
                    ..._participants.map((p) {
                      final pName = "${p['first_name'] ?? ''} ${p['last_name'] ?? ''}".trim();
                      final pDisp = pName.isNotEmpty ? pName : (p['email'] ?? 'Unknown');
                      final isYou = (p['id'] as int?) == currentUserId;
                      final isAdmin = admin != null && admin['id'] == p['id'];
                      final isCreator = creator != null && creator['id'] == p['id'];
                      
                      return ListTile(
                        contentPadding: EdgeInsets.zero,
                        leading: CircleAvatar(
                          backgroundColor: Colors.indigo.shade50,
                          child: Text(
                            pDisp.isNotEmpty ? pDisp[0].toUpperCase() : '?',
                            style: TextStyle(color: Colors.indigo.shade700),
                          ),
                        ),
                        title: Row(
                          children: [
                            Expanded(child: Text(isYou ? 'You' : pDisp, overflow: TextOverflow.ellipsis)),
                            if (isAdmin)
                              Container(
                                margin: const EdgeInsets.only(left: 8),
                                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                decoration: BoxDecoration(color: Colors.blue.shade100, borderRadius: BorderRadius.circular(4)),
                                child: Text('Admin', style: TextStyle(fontSize: 10, color: Colors.blue.shade800, fontWeight: FontWeight.bold)),
                              )
                            else if (isCreator && !isAdmin)
                              Container(
                                margin: const EdgeInsets.only(left: 8),
                                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                decoration: BoxDecoration(color: Colors.blue.shade100, borderRadius: BorderRadius.circular(4)),
                                child: Text('Creator', style: TextStyle(fontSize: 10, color: Colors.blue.shade800, fontWeight: FontWeight.bold)),
                              ),
                          ],
                        ),
                        subtitle: Text(p['role'] ?? ''),
                      );
                    }).toList(),
                  ],
                ),
              );
            }
          },
        );
      },
    );
  }

  Widget _buildDetailRow(String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 12),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: TextStyle(fontSize: 16, color: Colors.grey.shade600, fontWeight: FontWeight.w500)),
          Text(value, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w600)),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    // Fix: Fall back to 0 (not 1) so we never accidentally treat messages from
    // another real user (id=1) as our own when the session has no persisted userId.
    final currentUserId = int.tryParse(Provider.of<AuthProvider>(context, listen: false).userId ?? '0') ?? 0;
    final bool isParticipant = _participants.any((p) => p['id'] == currentUserId);

    return Scaffold(
      appBar: AppBar(
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(widget.conversationName, style: const TextStyle(fontSize: 16)),
            if (!_isGroup && _otherUserId != null && _onlineUsers[_otherUserId] == true)
              const Text('Online', style: TextStyle(fontSize: 12, color: Colors.green, fontWeight: FontWeight.normal)),
          ],
        ),
        actions: [
          PopupMenuButton<String>(
            icon: const Icon(Icons.more_vert),
            onSelected: (value) async {
              if (value == 'details') {
                _showDetails();
              } else if (value == 'clear') {
                final confirm = await showDialog<bool>(
                  context: context,
                  builder: (context) => AlertDialog(
                    title: const Text('Clear History'),
                    content: const Text('Are you sure you want to clear this chat history? This will only clear it for you.'),
                    actions: [
                      TextButton(
                        onPressed: () => Navigator.pop(context, false),
                        child: const Text('Cancel'),
                      ),
                      TextButton(
                        onPressed: () => Navigator.pop(context, true),
                        child: const Text('Clear', style: TextStyle(color: Colors.red)),
                      ),
                    ],
                  ),
                );

                if (confirm == true) {
                  final success = await _messagingService.clearHistory(widget.conversationId);
                  if (success) {
                    setState(() {
                      _messages.clear();
                    });
                  }
                }
              } else if (value == 'leave') {
                final confirm = await showDialog<bool>(
                  context: context,
                  builder: (context) => AlertDialog(
                    title: const Text('Leave Group'),
                    content: const Text('Are you sure you want to leave this group?'),
                    actions: [
                      TextButton(
                        onPressed: () => Navigator.pop(context, false),
                        child: const Text('Cancel'),
                      ),
                      TextButton(
                        onPressed: () => Navigator.pop(context, true),
                        child: const Text('Leave', style: TextStyle(color: Colors.red)),
                      ),
                    ],
                  ),
                );

                if (confirm == true) {
                  final success = await _messagingService.leaveGroup(widget.conversationId);
                  if (success) {
                    setState(() {
                      _participants.removeWhere((p) => p['id'] == currentUserId);
                    });
                  } else {
                    if (mounted) {
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(content: Text('Failed to leave group')),
                      );
                    }
                  }
                }
              }
            },
            itemBuilder: (BuildContext context) => <PopupMenuEntry<String>>[
              PopupMenuItem<String>(
                value: 'details',
                child: Text(_isGroup ? 'Group Details' : 'Contact Info'),
              ),
              const PopupMenuItem<String>(
                value: 'clear',
                child: Text('Clear History', style: TextStyle(color: Colors.red)),
              ),
              if (_isGroup && isParticipant)
                const PopupMenuItem<String>(
                  value: 'leave',
                  child: Text('Leave Group', style: TextStyle(color: Colors.red)),
                ),
            ],
          ),
        ],
      ),
      body: Column(
        children: [
          if (_pinnedMessages.isNotEmpty)
            GestureDetector(
              onTap: () {
                if (_pinnedMessages.length > 1) {
                  setState(() {
                    _currentPinIndex = (_currentPinIndex + 1) % _pinnedMessages.length;
                  });
                }
              },
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                color: Colors.amber[50],
                child: Row(
                  children: [
                    const Icon(Icons.push_pin, size: 16, color: Colors.orange),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        _pinnedMessages[_currentPinIndex]['content'] ?? 'Attachment',
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(color: Colors.orange[800], fontSize: 13),
                      ),
                    ),
                    if (_pinnedMessages.length > 1)
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                        decoration: BoxDecoration(
                          color: Colors.orange[100],
                          borderRadius: BorderRadius.circular(10),
                        ),
                        child: Text(
                          '${_currentPinIndex + 1}/${_pinnedMessages.length}',
                          style: TextStyle(color: Colors.orange[900], fontSize: 11, fontWeight: FontWeight.bold),
                        ),
                      ),
                  ],
                ),
              ),
            ),
          Expanded(
            child: _loading
                ? const Center(child: CircularProgressIndicator())
                : ListView.builder(
                    controller: _scrollController,
                    padding: const EdgeInsets.symmetric(vertical: 16),
                    itemCount: _messages.length + (_typingUsers.isNotEmpty ? 1 : 0),
                    itemBuilder: (context, index) {
                      if (index == _messages.length) {
                        // Show typing indicator
                        final typingUserName = _typingUsers.values.first;
                        return TypingIndicator(userName: typingUserName);
                      }

                      final message = _messages[index];
                      final isSent = (message['sender'] as Map)['id'] == currentUserId;

                      return MessageBubble(
                        message: message,
                        isSent: isSent,
                        currentUserId: currentUserId,
                        onUnsend: () async {
                          final success = await _messagingService.deleteMessage(message['id'].toString());
                          if (!success && mounted) {
                            ScaffoldMessenger.of(context).showSnackBar(
                              const SnackBar(content: Text('Failed to unsend message')),
                            );
                          }
                        },
                        onReply: () {
                          setState(() {
                            _replyingTo = message;
                          });
                        },
                        onForward: () {
                          _showForwardDialog(message['id'].toString(), message['content'] ?? '');
                        },
                        onPin: () {
                          _pinMessage(message['id'].toString());
                        },
                        onReact: () {
                          _showReactionPicker(message['id'].toString());
                        },
                        onRemoveReaction: (emoji) async {
                          final success = await _messagingService.removeReaction(
                              widget.conversationId, message['id'].toString(), emoji);
                          if (!success && mounted) {
                            ScaffoldMessenger.of(context).showSnackBar(
                              const SnackBar(content: Text('Failed to remove reaction')),
                            );
                          }
                        },
                      );
                    },
                  ),
          ),
          if (_replyingTo != null)
            Container(
              color: Colors.grey[100],
              padding: const EdgeInsets.fromLTRB(8, 6, 8, 6),
              child: Row(
                children: [
                  // WhatsApp-style accent bar + content
                  Expanded(
                    child: Container(
                      decoration: BoxDecoration(
                        color: Colors.grey[200],
                        borderRadius: BorderRadius.circular(8),
                      ),
                      clipBehavior: Clip.hardEdge,
                      child: IntrinsicHeight(
                        child: Row(
                          crossAxisAlignment: CrossAxisAlignment.stretch,
                          children: [
                            Container(width: 4, color: Colors.teal),
                            Expanded(
                              child: Padding(
                                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  mainAxisSize: MainAxisSize.min,
                                  children: [
                                    Text(
                                      _replyingTo!['sender']['first_name'] ??
                                          _replyingTo!['sender']['email'] ??
                                          'Someone',
                                      style: const TextStyle(
                                        fontWeight: FontWeight.bold,
                                        fontSize: 13,
                                        color: Colors.teal,
                                      ),
                                    ),
                                    const SizedBox(height: 2),
                                    Text(
                                      _replyingTo!['content'] as String? ?? 'Attachment',
                                      maxLines: 1,
                                      overflow: TextOverflow.ellipsis,
                                      style: TextStyle(fontSize: 13, color: Colors.grey[700]),
                                    ),
                                  ],
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
                  // Close button
                  IconButton(
                    icon: const Icon(Icons.close, size: 20),
                    onPressed: () {
                      setState(() {
                        _replyingTo = null;
                      });
                    },
                    padding: EdgeInsets.zero,
                    constraints: const BoxConstraints(),
                    color: Colors.grey[600],
                  ),
                ],
              ),
            ),
          if (isParticipant)
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 8),
              decoration: BoxDecoration(
                color: Colors.white,
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withOpacity(0.05),
                    blurRadius: 4,
                    offset: const Offset(0, -2),
                  ),
                ],
              ),
              child: Row(
                children: [
                  IconButton(
                    icon: const Icon(Icons.attach_file),
                    onPressed: _pickFile,
                    color: Colors.grey[700],
                  ),
                  IconButton(
                    icon: const Icon(Icons.image),
                    onPressed: _pickImage,
                    color: Colors.grey[700],
                  ),
                  Expanded(
                    child: TextField(
                      controller: _messageController,
                      onChanged: _onTyping,
                      decoration: const InputDecoration(
                        hintText: 'Type a message...',
                        border: InputBorder.none,
                        contentPadding: EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                      ),
                      maxLines: null,
                      textInputAction: TextInputAction.send,
                      onSubmitted: (_) => _sendMessage(),
                    ),
                  ),
                  IconButton(
                    icon: const Icon(Icons.send),
                    onPressed: _sendMessage,
                    color: Colors.blue,
                  ),
                ],
              ),
            )
          else
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(16),
              color: Colors.grey[200],
              child: const Text(
                'You can\'t send messages to this group because you\'re no longer a participant.',
                textAlign: TextAlign.center,
                style: TextStyle(color: Colors.black54),
              ),
            ),
        ],
      ),
    );
  }
}

/// A bottom sheet that shows existing conversations for forwarding — no duplicates.
class _ForwardConversationSheet extends StatefulWidget {
  final MessagingService messagingService;
  final String sourceConversationId;
  final String messageId;
  final int currentUserId;

  const _ForwardConversationSheet({
    required this.messagingService,
    required this.sourceConversationId,
    required this.messageId,
    required this.currentUserId,
  });

  @override
  State<_ForwardConversationSheet> createState() => _ForwardConversationSheetState();
}

class _ForwardConversationSheetState extends State<_ForwardConversationSheet> {
  final TextEditingController _searchCtrl = TextEditingController();
  List<dynamic> _allConversations = [];
  List<dynamic> _filtered = [];
  bool _loading = true;
  bool _forwarding = false;

  @override
  void initState() {
    super.initState();
    _loadConversations();
    _searchCtrl.addListener(_filter);
  }

  @override
  void dispose() {
    _searchCtrl.removeListener(_filter);
    _searchCtrl.dispose();
    super.dispose();
  }

  Future<void> _loadConversations() async {
    final convs = await widget.messagingService.fetchConversations();
    if (mounted) {
      final others = convs
          .where((c) => c['id'].toString() != widget.sourceConversationId)
          .toList();
      setState(() {
        _allConversations = others;
        _filtered = others;
        _loading = false;
      });
    }
  }

  void _filter() {
    final q = _searchCtrl.text.trim().toLowerCase();
    setState(() {
      _filtered = q.isEmpty
          ? _allConversations
          : _allConversations.where((c) {
              final name = _convName(c).toLowerCase();
              return name.contains(q);
            }).toList();
    });
  }

  String _convName(Map<String, dynamic> conv) {
    if (conv['type'] == 'group') return conv['name'] ?? 'Unnamed Group';
    final participants = conv['participants'] as List? ?? [];
    final other = participants.firstWhere(
      (p) => p['id'] != widget.currentUserId,
      orElse: () => <String, dynamic>{'first_name': 'Unknown', 'last_name': '', 'email': ''},
    );
    final full = ' '.trim();
    return full.isNotEmpty ? full : (other['email'] ?? 'Unknown');
  }

  Future<void> _forward(Map<String, dynamic> conv) async {
    setState(() => _forwarding = true);
    final success = await widget.messagingService.forwardMessage(
      widget.sourceConversationId,
      widget.messageId,
      conv['id'].toString(),
    );
    if (!mounted) return;
    Navigator.pop(context);
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(success
            ? 'Message forwarded to '
            : 'Failed to forward message'),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return DraggableScrollableSheet(
      initialChildSize: 0.6,
      minChildSize: 0.4,
      maxChildSize: 0.9,
      expand: false,
      builder: (_, scrollController) {
        return Column(
          children: [
            Container(
              margin: const EdgeInsets.symmetric(vertical: 10),
              width: 40,
              height: 4,
              decoration: BoxDecoration(
                color: Colors.grey[300],
                borderRadius: BorderRadius.circular(2),
              ),
            ),
            const Text('Forward to...', style: TextStyle(fontSize: 17, fontWeight: FontWeight.bold)),
            const SizedBox(height: 8),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: TextField(
                controller: _searchCtrl,
                decoration: InputDecoration(
                  hintText: 'Search conversations...',
                  prefixIcon: const Icon(Icons.search),
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                  filled: true,
                  fillColor: Colors.grey[100],
                  contentPadding: const EdgeInsets.symmetric(vertical: 10),
                ),
              ),
            ),
            const SizedBox(height: 8),
            Expanded(
              child: _loading
                  ? const Center(child: CircularProgressIndicator())
                  : _filtered.isEmpty
                      ? Center(
                          child: Text(
                            _searchCtrl.text.isNotEmpty ? 'No conversations match' : 'No other conversations',
                            style: TextStyle(color: Colors.grey[600]),
                          ),
                        )
                      : ListView.separated(
                          controller: scrollController,
                          itemCount: _filtered.length,
                          separatorBuilder: (_, __) => const Divider(height: 1),
                          itemBuilder: (context, i) {
                            final conv = _filtered[i] as Map<String, dynamic>;
                            final name = _convName(conv);
                            final isGroup = conv['type'] == 'group';
                            return ListTile(
                              leading: CircleAvatar(
                                backgroundColor: isGroup ? Colors.teal : Colors.blue,
                                child: Icon(isGroup ? Icons.group : Icons.person, color: Colors.white, size: 18),
                              ),
                              title: Text(name, style: const TextStyle(fontWeight: FontWeight.w600)),
                              subtitle: Text(
                                isGroup ? ' members' : 'Direct message',
                                style: TextStyle(fontSize: 12, color: Colors.grey[600]),
                              ),
                              trailing: _forwarding
                                  ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2))
                                  : const Icon(Icons.send, color: Colors.blue),
                              onTap: _forwarding ? null : () => _forward(conv),
                            );
                          },
                        ),
            ),
          ],
        );
      },
    );
  }
}
