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

    // Clear all callbacks before disconnecting to prevent setState() on disposed widget
    _messagingService.onMessageReceived = null;
    _messagingService.onMessageSent = null;
    _messagingService.onTypingIndicator = null;
    _messagingService.onMessageRead = null;

    _messagingService.disconnectWebSocket();
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

    setState(() {
      _messages = messages.cast<Map<String, dynamic>>().reversed.toList();
      _pinnedMessages = pinned.cast<Map<String, dynamic>>();
      _loading = false;
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
        final hasRead = readBy.any((r) => r['user']?['id'] == currentUserId);
        
        if (!hasRead) {
          _messagingService.markMessageAsReadHttp(widget.conversationId, msg['id'].toString());
        }
      }
    }
  }

  void _connectWebSocket() {
    _messagingService.connectWebSocket(widget.conversationId);

    // Message we sent — server echoes it back as 'message_sent' with the full saved object
    _messagingService.onMessageSent = (message) {
      if (_disposed) return;
      setState(() {
        _messages.add(message);
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
      _scrollToBottom();
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

  void _sendMessage() {
    final text = _messageController.text.trim();
    if (text.isEmpty) return;

    // Clear input immediately for snappy UX
    _messageController.clear();
    setState(() {
      _isTyping = false;
      _replyingTo = null;
    });

    _messagingService.sendMessage(
      content: text,
      replyTo: _replyingTo?['id']?.toString(),
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
    }
  }

  Future<void> _pickFile() async {
    final result = await FilePicker.platform.pickFiles();
    if (result != null && result.files.isNotEmpty) {
      final file = result.files.first;
      final bytes = file.bytes;
      
      if (bytes != null) {
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
                    final success = await _messagingService.reactToMessage(widget.conversationId, messageId, emoji);
                    if (success) {
                      _loadMessages(); // reload to get updated reactions
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
    // We need to fetch conversations to forward to
    showModalBottomSheet(
      context: context,
      builder: (context) {
        return SafeArea(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Padding(
                padding: EdgeInsets.all(16.0),
                child: Text('Forward to...', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
              ),
              ListTile(
                leading: const Icon(Icons.send),
                title: const Text('Select conversation'),
                onTap: () {
                  Navigator.pop(context); // close bottom sheet
                  Navigator.push(
                    context,
                    MaterialPageRoute(
                      builder: (context) => UserSearchScreen(
                        onUserSelected: (user) async {
                          final conversation = await _messagingService.createConversation(
                            type: 'direct',
                            participantIds: [user['id']],
                          );
                          if (conversation != null) {
                            final success = await _messagingService.forwardMessage(
                                widget.conversationId, messageId, conversation['id']);
                            if (success && mounted) {
                              Navigator.pop(context); // close search screen
                              ScaffoldMessenger.of(context).showSnackBar(
                                const SnackBar(content: Text('Message forwarded!')),
                              );
                            }
                          }
                        },
                      ),
                    ),
                  );
                },
              ),
            ],
          ),
        );
      }
    );
  }

  @override
  Widget build(BuildContext context) {
    final currentUserId = int.tryParse(Provider.of<AuthProvider>(context, listen: false).userId ?? '1') ?? 1;

    return Scaffold(
      appBar: AppBar(
        title: Text(widget.conversationName),
        actions: [
          IconButton(
            icon: const Icon(Icons.more_vert),
            onPressed: () {
              // Show conversation options
            },
          ),
        ],
      ),
      body: Column(
        children: [
          if (_pinnedMessages.isNotEmpty)
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
              color: Colors.amber[50],
              child: Row(
                children: [
                  const Icon(Icons.push_pin, size: 16, color: Colors.orange),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      _pinnedMessages.first['content'] ?? 'Attachment',
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(color: Colors.orange[800], fontSize: 13),
                    ),
                  ),
                  if (_pinnedMessages.length > 1)
                    Text(
                      '+${_pinnedMessages.length - 1}',
                      style: TextStyle(color: Colors.orange[800], fontSize: 12, fontWeight: FontWeight.bold),
                    ),
                ],
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
                      );
                    },
                  ),
          ),
          if (_replyingTo != null)
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
              color: Colors.grey[200],
              child: Row(
                children: [
                  const Icon(Icons.reply, size: 20, color: Colors.grey),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          _replyingTo!['sender']['first_name'] ?? _replyingTo!['sender']['email'],
                          style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13),
                        ),
                        Text(
                          _replyingTo!['content'] ?? 'Attachment',
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(color: Colors.grey, fontSize: 13),
                        ),
                      ],
                    ),
                  ),
                  IconButton(
                    icon: const Icon(Icons.close, size: 20),
                    onPressed: () {
                      setState(() {
                        _replyingTo = null;
                      });
                    },
                    padding: EdgeInsets.zero,
                    constraints: const BoxConstraints(),
                  ),
                ],
              ),
            ),
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
          ),
        ],
      ),
    );
  }
}
