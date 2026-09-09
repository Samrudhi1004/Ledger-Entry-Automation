import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

class MessageBubble extends StatelessWidget {
  final Map<String, dynamic> message;
  final bool isSent;
  final int currentUserId;

  const MessageBubble({
    Key? key,
    required this.message,
    required this.isSent,
    required this.currentUserId,
  }) : super(key: key);

  String _formatTime(String timestamp) {
    try {
      final dateTime = DateTime.parse(timestamp);
      return DateFormat('HH:mm').format(dateTime);
    } catch (e) {
      return '';
    }
  }

  @override
  Widget build(BuildContext context) {
    final content = message['content'] as String? ?? '';
    final createdAt = message['created_at'] as String? ?? '';
    final attachments = message['attachments'] as List? ?? [];
    final readBy = message['read_by'] as List? ?? [];

    return Align(
      alignment: isSent ? Alignment.centerRight : Alignment.centerLeft,
      child: Container(
        margin: const EdgeInsets.symmetric(vertical: 4, horizontal: 16),
        constraints: BoxConstraints(
          maxWidth: MediaQuery.of(context).size.width * 0.7,
        ),
        child: Column(
          crossAxisAlignment: isSent ? CrossAxisAlignment.end : CrossAxisAlignment.start,
          children: [
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
              decoration: BoxDecoration(
                color: isSent ? Colors.blue : Colors.grey[300],
                borderRadius: BorderRadius.only(
                  topLeft: const Radius.circular(16),
                  topRight: const Radius.circular(16),
                  bottomLeft: Radius.circular(isSent ? 16 : 4),
                  bottomRight: Radius.circular(isSent ? 4 : 16),
                ),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  if (content.isNotEmpty)
                    Text(
                      content,
                      style: TextStyle(
                        color: isSent ? Colors.white : Colors.black87,
                        fontSize: 15,
                      ),
                    ),
                  if (attachments.isNotEmpty) ...[
                    const SizedBox(height: 8),
                    ...attachments.map((attachment) => _buildAttachment(attachment)),
                  ],
                ],
              ),
            ),
            Padding(
              padding: const EdgeInsets.only(top: 4, left: 4, right: 4),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    _formatTime(createdAt),
                    style: TextStyle(
                      fontSize: 11,
                      color: Colors.grey[600],
                    ),
                  ),
                  if (isSent && readBy.isNotEmpty) ...[
                    const SizedBox(width: 4),
                    Icon(
                      Icons.done_all,
                      size: 14,
                      color: Colors.blue[700],
                    ),
                  ],
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildAttachment(Map<String, dynamic> attachment) {
    final attachmentType = attachment['attachment_type'] as String? ?? '';
    final fileName = attachment['file_name'] as String? ?? '';
    final cloudinaryUrl = attachment['cloudinary_url'] as String?;

    if (attachmentType == 'image' && cloudinaryUrl != null) {
      return ClipRRect(
        borderRadius: BorderRadius.circular(8),
        child: Image.network(
          cloudinaryUrl,
          fit: BoxFit.cover,
          errorBuilder: (context, error, stackTrace) {
            return Container(
              padding: const EdgeInsets.all(8),
              color: Colors.grey[200],
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Icon(Icons.image, size: 20),
                  const SizedBox(width: 8),
                  Text(fileName),
                ],
              ),
            );
          },
        ),
      );
    } else {
      return Container(
        padding: const EdgeInsets.all(8),
        decoration: BoxDecoration(
          color: isSent ? Colors.blue[700] : Colors.grey[400],
          borderRadius: BorderRadius.circular(8),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              Icons.attach_file,
              size: 20,
              color: isSent ? Colors.white : Colors.black87,
            ),
            const SizedBox(width: 8),
            Flexible(
              child: Text(
                fileName,
                style: TextStyle(
                  color: isSent ? Colors.white : Colors.black87,
                  fontSize: 13,
                ),
                overflow: TextOverflow.ellipsis,
              ),
            ),
          ],
        ),
      );
    }
  }
}
