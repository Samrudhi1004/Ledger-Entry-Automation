import 'package:flutter/material.dart';
import '../services/document_control_service.dart';

class DCRNotificationsSheet extends StatefulWidget {
  final VoidCallback? onNotificationsChanged;

  const DCRNotificationsSheet({super.key, this.onNotificationsChanged});

  static Future<void> show(BuildContext context, {VoidCallback? onNotificationsChanged}) {
    return showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => DCRNotificationsSheet(onNotificationsChanged: onNotificationsChanged),
    );
  }

  @override
  State<DCRNotificationsSheet> createState() => _DCRNotificationsSheetState();
}

class _DCRNotificationsSheetState extends State<DCRNotificationsSheet> {
  final _service = DocumentControlService();
  List<DCRNotification> _notifications = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final list = await _service.getNotifications();
      if (mounted) {
        setState(() {
          _notifications = list;
          _loading = false;
        });
      }
    } catch (_) {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _markAllRead() async {
    await _service.markAllNotificationsAsRead();
    _load();
    widget.onNotificationsChanged?.call();
  }

  Future<void> _markRead(DCRNotification n) async {
    if (!n.isRead) {
      await _service.markNotificationAsRead(n.id);
      _load();
      widget.onNotificationsChanged?.call();
    }
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      constraints: BoxConstraints(
        maxHeight: MediaQuery.of(context).size.height * 0.75,
      ),
      decoration: const BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      padding: const EdgeInsets.fromLTRB(20, 16, 20, 20),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          // Drag handle
          Center(
            child: Container(
              width: 40,
              height: 4,
              decoration: BoxDecoration(
                color: const Color(0xFFE2E8F0),
                borderRadius: BorderRadius.circular(2),
              ),
            ),
          ),
          const SizedBox(height: 14),

          // Header
          Row(
            children: [
              const Icon(Icons.notifications_active_rounded, color: Color(0xFF7C3AED), size: 22),
              const SizedBox(width: 10),
              const Text(
                'DCR Notifications',
                style: TextStyle(fontWeight: FontWeight.w800, fontSize: 16, color: Color(0xFF0F172A)),
              ),
              const Spacer(),
              if (_notifications.any((n) => !n.isRead))
                TextButton(
                  onPressed: _markAllRead,
                  child: const Text('Mark all read', style: TextStyle(fontSize: 12, color: Color(0xFF7C3AED))),
                ),
              IconButton(
                icon: const Icon(Icons.close_rounded, color: Color(0xFF94A3B8)),
                onPressed: () => Navigator.pop(context),
              ),
            ],
          ),
          const SizedBox(height: 8),
          const Divider(height: 1, color: Color(0xFFE2E8F0)),

          // List
          Flexible(
            child: _loading
                ? const Center(child: Padding(
                    padding: EdgeInsets.all(32),
                    child: CircularProgressIndicator(color: Color(0xFF7C3AED)),
                  ))
                : _notifications.isEmpty
                    ? Center(
                        child: Padding(
                          padding: const EdgeInsets.all(32),
                          child: Column(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Icon(Icons.notifications_none_rounded, size: 48, color: Colors.grey.shade300),
                              const SizedBox(height: 12),
                              Text('No notifications', style: TextStyle(color: Colors.grey.shade500, fontWeight: FontWeight.w600)),
                              const SizedBox(height: 4),
                              Text('You are all caught up on DCR alerts.', style: TextStyle(color: Colors.grey.shade400, fontSize: 12)),
                            ],
                          ),
                        ),
                      )
                    : ListView.separated(
                        shrinkWrap: true,
                        padding: const EdgeInsets.symmetric(vertical: 12),
                        itemCount: _notifications.length,
                        separatorBuilder: (context, index) => const Divider(height: 1, color: Color(0xFFF1F5F9)),
                        itemBuilder: (ctx, i) {
                          final n = _notifications[i];
                          return InkWell(
                            onTap: () => _markRead(n),
                            child: Container(
                              padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 8),
                              decoration: BoxDecoration(
                                color: n.isRead ? Colors.transparent : const Color(0xFFF5F3FF).withOpacity(0.5),
                                borderRadius: BorderRadius.circular(8),
                              ),
                              child: Row(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Container(
                                    margin: const EdgeInsets.only(top: 2),
                                    width: 8,
                                    height: 8,
                                    decoration: BoxDecoration(
                                      color: n.isRead ? Colors.transparent : const Color(0xFF7C3AED),
                                      shape: BoxShape.circle,
                                    ),
                                  ),
                                  const SizedBox(width: 10),
                                  Expanded(
                                    child: Column(
                                      crossAxisAlignment: CrossAxisAlignment.start,
                                      children: [
                                        Row(
                                          children: [
                                            Expanded(
                                              child: Text(
                                                n.title,
                                                style: TextStyle(
                                                  fontWeight: n.isRead ? FontWeight.w600 : FontWeight.w800,
                                                  fontSize: 13,
                                                  color: const Color(0xFF0F172A),
                                                ),
                                              ),
                                            ),
                                            if (n.dcrNumber != null)
                                              Container(
                                                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                                decoration: BoxDecoration(
                                                  color: const Color(0xFFEEF2FF),
                                                  borderRadius: BorderRadius.circular(4),
                                                ),
                                                child: Text(
                                                  n.dcrNumber!,
                                                  style: const TextStyle(
                                                    fontSize: 10,
                                                    fontWeight: FontWeight.w700,
                                                    color: Color(0xFF4F46E5),
                                                  ),
                                                ),
                                              ),
                                          ],
                                        ),
                                        const SizedBox(height: 4),
                                        Text(
                                          n.message,
                                          style: const TextStyle(fontSize: 12, color: Color(0xFF475569)),
                                        ),
                                      ],
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          );
                        },
                      ),
          ),
        ],
      ),
    );
  }
}
