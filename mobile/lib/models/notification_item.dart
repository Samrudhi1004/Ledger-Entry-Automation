/// A normalized notification used by all mobile notification surfaces.
///
/// The model intentionally supports notifications that are not backed by the
/// DCR API yet (for example, supervisor inspection alerts and messages). This
/// gives later phases one consistent object to render and route.
enum NotificationCategory { supervisor, dcr, document, message, system }

class NotificationItem {
  final String id;
  final NotificationCategory category;
  final String title;
  final String message;
  final DateTime? createdAt;
  final bool isRead;
  final String? conversationId;
  final int? backendNotificationId;
  final int? dcrId;
  final String? dcrNumber;
  final String? documentId;
  final String? action;
  final Map<String, dynamic> metadata;

  const NotificationItem({
    required this.id,
    required this.category,
    required this.title,
    required this.message,
    this.createdAt,
    this.isRead = false,
    this.conversationId,
    this.backendNotificationId,
    this.dcrId,
    this.dcrNumber,
    this.documentId,
    this.action,
    this.metadata = const {},
  });

  NotificationItem copyWith({
    String? id,
    NotificationCategory? category,
    String? title,
    String? message,
    DateTime? createdAt,
    bool? isRead,
    String? conversationId,
    int? backendNotificationId,
    int? dcrId,
    String? dcrNumber,
    String? documentId,
    String? action,
    Map<String, dynamic>? metadata,
  }) {
    return NotificationItem(
      id: id ?? this.id,
      category: category ?? this.category,
      title: title ?? this.title,
      message: message ?? this.message,
      createdAt: createdAt ?? this.createdAt,
      isRead: isRead ?? this.isRead,
      conversationId: conversationId ?? this.conversationId,
      backendNotificationId:
          backendNotificationId ?? this.backendNotificationId,
      dcrId: dcrId ?? this.dcrId,
      dcrNumber: dcrNumber ?? this.dcrNumber,
      documentId: documentId ?? this.documentId,
      action: action ?? this.action,
      metadata: metadata ?? this.metadata,
    );
  }
}
