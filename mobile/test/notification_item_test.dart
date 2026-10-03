import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/models/notification_item.dart';

void main() {
  test('notification copyWith preserves identity and changes read state', () {
    const item = NotificationItem(
      id: 'dcr-7',
      category: NotificationCategory.dcr,
      title: 'Review required',
      message: 'A document change request needs attention.',
      backendNotificationId: 7,
    );

    final readItem = item.copyWith(isRead: true);

    expect(readItem.id, 'dcr-7');
    expect(readItem.backendNotificationId, 7);
    expect(readItem.category, NotificationCategory.dcr);
    expect(readItem.isRead, isTrue);
    expect(item.isRead, isFalse);
  });
}
