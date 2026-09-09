import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../services/messaging_service.dart';
import '../../providers/messaging_provider.dart';
import '../../widgets/messaging/message_bubble.dart';
import '../../widgets/messaging/typing_indicator.dart';
import 'package:image_picker/image_picker.dart';
import 'package:file_picker/file_picker.dart';
import 'dart:io';

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

    setState(() {
      _messages = messages.cast<Map<String, dynamic>>().reversed.toList();
      _loading = false;
    });

    _scrollToBottom();
  }

  void _connectWebSocket() {
    _messagingService.connectWebSocket(widget.conversationId);

    _messagingService.onMessageReceived = (message) {
      if (_disposed) return; // Prevent setState on disposed widget
      setState(() {
        _messages.add(message);
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

    _messagingService.sendMessage(text);
    _messageController.clear();
    _messagingService.sendTypingIndicator(false);
    setState(() => _isTyping = false);
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
      // TODO: Upload image after sending message
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Image upload feature coming soon')),
      );
    }
  }

  Future<void> _pickFile() async {
    final result = await FilePicker.platform.pickFiles();
    if (result != null) {
      // TODO: Upload file after sending message
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('File upload feature coming soon')),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    const currentUserId = 1; // Replace with actual user ID

    return Scaffold(
      appBar: AppBar(
        title: Text(widget.conversationName),
        actions: [
          IconButton(
            icon: const Icon(Icons.videocam),
            onPressed: () {
              // Open Google Meet
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(content: Text('Opening Google Meet...')),
              );
            },
          ),
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
                      );
                    },
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
