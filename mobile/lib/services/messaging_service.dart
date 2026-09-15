import 'dart:convert';
import 'dart:io';
import 'package:http/http.dart' as http;
import 'package:web_socket_channel/web_socket_channel.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'api_service.dart';

class MessagingService {
  static String get baseUrl => ApiService.baseUrl;
  static String get wsUrl {
    if (ApiService.baseUrl.startsWith('https://')) {
      return ApiService.baseUrl.replaceFirst('https://', 'wss://').replaceFirst('/api', '');
    } else {
      return ApiService.baseUrl.replaceFirst('http://', 'ws://').replaceFirst('/api', '');
    }
  }

  final _storage = const FlutterSecureStorage();
  WebSocketChannel? _channel;
  Function(Map<String, dynamic>)? onMessageReceived;
  Function(Map<String, dynamic>)? onTypingIndicator;
  Function(Map<String, dynamic>)? onMessageRead;

  Future<String?> _getToken() async {
    return await _storage.read(key: 'access_token');
  }

  Future<Map<String, String>> _getHeaders() async {
    final token = await _getToken();
    return {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer $token',
    };
  }

  // Fetch conversations
  Future<List<dynamic>> fetchConversations() async {
    try {
      final headers = await _getHeaders();
      final response = await http.get(
        Uri.parse('$baseUrl/messaging/conversations/'),
        headers: headers,
      );

      if (response.statusCode == 200) {
        return json.decode(response.body) as List;
      } else {
        throw Exception('Failed to load conversations');
      }
    } catch (e) {
      print('Error fetching conversations: $e');
      return [];
    }
  }

  // Fetch messages for a conversation
  Future<Map<String, dynamic>> fetchMessages(
    String conversationId, {
    int offset = 0,
    int limit = 50,
  }) async {
    try {
      final headers = await _getHeaders();
      final response = await http.get(
        Uri.parse(
          '$baseUrl/messaging/conversations/$conversationId/messages/?offset=$offset&limit=$limit',
        ),
        headers: headers,
      );

      if (response.statusCode == 200) {
        return json.decode(response.body);
      } else {
        throw Exception('Failed to load messages');
      }
    } catch (e) {
      print('Error fetching messages: $e');
      return {'results': [], 'count': 0, 'next_offset': null};
    }
  }

  // Create new conversation
  Future<Map<String, dynamic>?> createConversation({
    required String type,
    required List<int> participantIds,
    String? name,
    String? description,
  }) async {
    try {
      final headers = await _getHeaders();
      final response = await http.post(
        Uri.parse('$baseUrl/messaging/conversations/'),
        headers: headers,
        body: json.encode({
          'type': type,
          'participant_ids': participantIds,
          'name': name ?? '',
          'description': description ?? '',
        }),
      );

      if (response.statusCode == 201) {
        return json.decode(response.body);
      } else {
        throw Exception('Failed to create conversation');
      }
    } catch (e) {
      print('Error creating conversation: $e');
      return null;
    }
  }

  // Search users
  Future<List<dynamic>> searchUsers(String query) async {
    try {
      final headers = await _getHeaders();
      final response = await http.get(
        Uri.parse('$baseUrl/messaging/users/search/?q=${Uri.encodeComponent(query)}'),
        headers: headers,
      );

      if (response.statusCode == 200) {
        return json.decode(response.body) as List;
      } else {
        throw Exception('Failed to search users');
      }
    } catch (e) {
      print('Error searching users: $e');
      return [];
    }
  }

  // Upload file
  Future<Map<String, dynamic>?> uploadFile(File file, String messageId) async {
    try {
      final token = await _getToken();
      final request = http.MultipartRequest(
        'POST',
        Uri.parse('$baseUrl/messaging/upload/'),
      );

      request.headers['Authorization'] = 'Bearer $token';
      request.fields['message_id'] = messageId;
      request.files.add(await http.MultipartFile.fromPath('file', file.path));

      final streamedResponse = await request.send();
      final response = await http.Response.fromStream(streamedResponse);

      if (response.statusCode == 201) {
        return json.decode(response.body);
      } else {
        throw Exception('Failed to upload file');
      }
    } catch (e) {
      print('Error uploading file: $e');
      return null;
    }
  }

  String? _currentConversationId;
  bool _shouldReconnect = true;

  // Connect to WebSocket
  void connectWebSocket(String conversationId) async {
    _currentConversationId = conversationId;
    _shouldReconnect = true;

    final token = await _getToken();
    if (token == null) {
      print('No token available for WebSocket connection');
      return;
    }

    try {
      final uri = Uri.parse('$wsUrl/ws/messaging/$conversationId/?token=$token');
      _channel = WebSocketChannel.connect(uri);

      _channel!.stream.listen(
        (message) {
          final data = json.decode(message);
          _handleWebSocketMessage(data);
        },
        onError: (error) {
          print('WebSocket error: $error');
        },
        onDone: () {
          print('WebSocket connection closed');
          // Only reconnect if shouldReconnect flag is true and callbacks are still set
          if (_shouldReconnect &&
              _currentConversationId == conversationId &&
              (onMessageReceived != null || onTypingIndicator != null || onMessageRead != null)) {
            Future.delayed(const Duration(seconds: 3), () {
              // Double-check callbacks still exist before reconnecting
              if (onMessageReceived != null || onTypingIndicator != null || onMessageRead != null) {
                connectWebSocket(conversationId);
              }
            });
          }
        },
      );
    } catch (e) {
      print('Error connecting to WebSocket: $e');
    }
  }

  void _handleWebSocketMessage(Map<String, dynamic> data) {
    switch (data['type']) {
      case 'connection_established':
        print('WebSocket connected: ${data['message']}');
        break;

      case 'new_message':
        if (onMessageReceived != null) {
          onMessageReceived!(data['data']);
        }
        break;

      case 'message_read':
        if (onMessageRead != null) {
          onMessageRead!(data['data']);
        }
        break;

      case 'user_typing':
        if (onTypingIndicator != null) {
          onTypingIndicator!(data['data']);
        }
        break;

      case 'error':
        print('WebSocket error: ${data['message']}');
        break;

      default:
        print('Unknown message type: ${data['type']}');
    }
  }

  // Send message via WebSocket
  void sendMessage(String content, {String messageType = 'text', String? replyTo}) {
    if (_channel == null) {
      print('WebSocket not connected');
      return;
    }

    _channel!.sink.add(json.encode({
      'action': 'send_message',
      'data': {
        'content': content,
        'message_type': messageType,
        'reply_to': replyTo,
      }
    }));
  }

  // Mark message as read
  void markAsRead(String messageId) {
    if (_channel == null) return;

    _channel!.sink.add(json.encode({
      'action': 'mark_read',
      'data': {
        'message_id': messageId,
      }
    }));
  }

  // Send typing indicator
  void sendTypingIndicator(bool isTyping) {
    if (_channel == null) return;

    _channel!.sink.add(json.encode({
      'action': 'typing',
      'data': {
        'is_typing': isTyping,
      }
    }));
  }

  // Disconnect WebSocket
  void disconnectWebSocket() {
    _shouldReconnect = false; // Prevent reconnection after intentional disconnect
    _currentConversationId = null;
    _channel?.sink.close();
    _channel = null;
  }

  // Mark message as read via HTTP (fallback)
  Future<void> markMessageAsReadHttp(String conversationId, String messageId) async {
    try {
      final headers = await _getHeaders();
      await http.post(
        Uri.parse('$baseUrl/messaging/conversations/$conversationId/messages/$messageId/read/'),
        headers: headers,
      );
    } catch (e) {
      print('Error marking message as read: $e');
    }
  }
}
