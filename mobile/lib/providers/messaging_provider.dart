import 'package:flutter/foundation.dart';
import '../services/messaging_service.dart';

/// Provider for managing MessagingService instances per conversation.
/// Prevents state conflicts when multiple chat screens are open simultaneously.
class MessagingProvider extends ChangeNotifier {
  final Map<String, MessagingService> _services = {};

  /// Get or create a MessagingService instance for a specific conversation.
  MessagingService getService(String conversationId) {
    if (!_services.containsKey(conversationId)) {
      _services[conversationId] = MessagingService();
    }
    return _services[conversationId]!;
  }

  /// Dispose a MessagingService instance when no longer needed.
  void disposeService(String conversationId) {
    final service = _services[conversationId];
    if (service != null) {
      service.disconnectWebSocket();
      _services.remove(conversationId);
    }
  }

  /// Dispose all services.
  @override
  void dispose() {
    for (var service in _services.values) {
      service.disconnectWebSocket();
    }
    _services.clear();
    super.dispose();
  }

  /// Check if a service exists for a conversation.
  bool hasService(String conversationId) {
    return _services.containsKey(conversationId);
  }

  /// Get all active conversation IDs.
  List<String> getActiveConversations() {
    return _services.keys.toList();
  }
}
