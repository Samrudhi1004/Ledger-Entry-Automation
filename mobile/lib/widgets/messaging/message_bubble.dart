import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:flutter_linkify/flutter_linkify.dart';
import 'package:url_launcher/url_launcher.dart';

class MessageBubble extends StatelessWidget {
  final Map<String, dynamic> message;
  final bool isSent;
  final int currentUserId;
  final VoidCallback? onUnsend;
  final VoidCallback? onReply;
  final VoidCallback? onForward;
  final VoidCallback? onPin;
  final VoidCallback? onReact;
  final void Function(String emoji)? onRemoveReaction;

  const MessageBubble({
    Key? key,
    required this.message,
    required this.isSent,
    required this.currentUserId,
    this.onUnsend,
    this.onReply,
    this.onForward,
    this.onPin,
    this.onReact,
    this.onRemoveReaction,
  }) : super(key: key);

  String _formatTime(String timestamp) {
    try {
      final dateTime = DateTime.parse(timestamp);
      return DateFormat('HH:mm').format(dateTime);
    } catch (e) {
      return '';
    }
  }

  List<Map<String, dynamic>> _groupReactions(List reactions) {
    // Group by emoji, collecting all reacting users and whether current user reacted
    final Map<String, Map<String, dynamic>> groups = {};
    for (var reaction in reactions) {
      final emoji = reaction['emoji'] as String;
      final reactionUser = reaction['user'] as Map<String, dynamic>? ?? {};
      final reactionUserId = reactionUser['id'] as int? ?? -1;
      final name = reactionUser['first_name'] as String? ??
          reactionUser['email'] as String? ??
          'Someone';

      if (!groups.containsKey(emoji)) {
        groups[emoji] = {
          'emoji': emoji,
          'count': 0,
          'users': <String>[],
          'isMine': false,
        };
      }
      groups[emoji]!['count'] = (groups[emoji]!['count'] as int) + 1;
      (groups[emoji]!['users'] as List<String>).add(name);
      if (reactionUserId == currentUserId) {
        groups[emoji]!['isMine'] = true;
      }
    }
    return groups.values.toList();
  }

  void _showReactionDetail(BuildContext context, Map<String, dynamic> reactionGroup) {
    final emoji = reactionGroup['emoji'] as String;
    final users = reactionGroup['users'] as List<String>;
    final isMine = reactionGroup['isMine'] as bool;

    showModalBottomSheet(
      context: context,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
              child: Row(
                children: [
                  Text(emoji, style: const TextStyle(fontSize: 24)),
                  const SizedBox(width: 8),
                  Text(
                    '${users.length} reaction${users.length == 1 ? '' : 's'}',
                    style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
                  ),
                ],
              ),
            ),
            const Divider(height: 1),
            ...users.map((name) => ListTile(
                  leading: const CircleAvatar(child: Icon(Icons.person, size: 18)),
                  title: Text(name),
                )),
            if (isMine && onRemoveReaction != null)
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 4, 16, 8),
                child: SizedBox(
                  width: double.infinity,
                  child: OutlinedButton.icon(
                    onPressed: () {
                      Navigator.pop(ctx);
                      onRemoveReaction!(emoji);
                    },
                    icon: const Icon(Icons.remove_circle_outline, color: Colors.red),
                    label: const Text('Remove my reaction', style: TextStyle(color: Colors.red)),
                  ),
                ),
              ),
            const SizedBox(height: 8),
          ],
        ),
      ),
    );
  }

  /// WhatsApp-style quoted message block with a left accent bar.
  Widget _buildReplyPreview(Map<String, dynamic> replyToMessage, bool isSent) {
    final senderName = replyToMessage['sender']?['first_name'] as String? ??
        replyToMessage['sender']?['email'] as String? ??
        'Someone';
    final replyContent = replyToMessage['content'] as String? ?? '';
    final replyAttachments = replyToMessage['attachments'] as List? ?? [];
    final hasImage = replyAttachments.any(
        (a) => (a['attachment_type'] as String? ?? '') == 'image');
    final displayText = replyContent.isNotEmpty
        ? replyContent
        : hasImage
            ? '📷 Photo'
            : replyAttachments.isNotEmpty
                ? '📎 Attachment'
                : 'Message';

    // Accent bar colour: green for sent-side quotes, teal for received-side
    final accentColor = isSent ? Colors.greenAccent[400]! : Colors.teal[300]!;
    final bgColor = isSent
        ? Colors.blue[800]!.withOpacity(0.6)
        : Colors.black12;
    final nameColor = isSent ? Colors.greenAccent[200]! : Colors.teal[600]!;
    final textColor = isSent ? Colors.white70 : Colors.black54;

    return Container(
      margin: const EdgeInsets.only(bottom: 6),
      decoration: BoxDecoration(
        color: bgColor,
        borderRadius: BorderRadius.circular(8),
      ),
      clipBehavior: Clip.hardEdge,
      child: IntrinsicHeight(
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Left accent bar
            Container(width: 4, color: accentColor),
            // Content
            Expanded(
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
                child: Row(
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Text(
                            senderName,
                            style: TextStyle(
                              fontWeight: FontWeight.bold,
                              fontSize: 12,
                              color: nameColor,
                            ),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            displayText,
                            maxLines: 2,
                            overflow: TextOverflow.ellipsis,
                            style: TextStyle(fontSize: 12, color: textColor),
                          ),
                        ],
                      ),
                    ),
                    // Thumbnail if the quoted message has an image
                    if (hasImage)
                      Padding(
                        padding: const EdgeInsets.only(left: 8),
                        child: ClipRRect(
                          borderRadius: BorderRadius.circular(4),
                          child: Image.network(
                            (replyAttachments.firstWhere(
                                (a) => (a['attachment_type'] as String? ?? '') ==
                                    'image'))['cloudinary_url'] as String,
                            width: 40,
                            height: 40,
                            fit: BoxFit.cover,
                            errorBuilder: (_, __, ___) => const Icon(
                              Icons.image,
                              size: 40,
                              color: Colors.white54,
                            ),
                          ),
                        ),
                      ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final content = message['content'] as String? ?? '';
    final createdAt = message['created_at'] as String? ?? '';
    final attachments = message['attachments'] as List? ?? [];
    final readBy = message['read_by'] as List? ?? [];
    final replyToMessage = message['reply_to_message'] as Map<String, dynamic>?;
    final reactions = message['reactions'] as List? ?? [];

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
              child: GestureDetector(
                onLongPress: () {
                  showModalBottomSheet(
                    context: context,
                    shape: const RoundedRectangleBorder(
                      borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
                    ),
                    builder: (context) => SafeArea(
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          if (onReply != null)
                            ListTile(
                              leading: const Icon(Icons.reply),
                              title: const Text('Reply'),
                              onTap: () {
                                Navigator.pop(context);
                                onReply!();
                              },
                            ),
                          if (onForward != null)
                            ListTile(
                              leading: const Icon(Icons.forward),
                              title: const Text('Forward'),
                              onTap: () {
                                Navigator.pop(context);
                                onForward!();
                              },
                            ),
                          if (onPin != null)
                            ListTile(
                              leading: const Icon(Icons.push_pin),
                              title: const Text('Pin'),
                              onTap: () {
                                Navigator.pop(context);
                                onPin!();
                              },
                            ),
                          if (onReact != null)
                            ListTile(
                              leading: const Icon(Icons.add_reaction),
                              title: const Text('React'),
                              onTap: () {
                                Navigator.pop(context);
                                onReact!();
                              },
                            ),
                          if (isSent && onUnsend != null)
                            ListTile(
                              leading: const Icon(Icons.delete, color: Colors.red),
                              title: const Text('Unsend', style: TextStyle(color: Colors.red)),
                              onTap: () {
                                Navigator.pop(context);
                                showDialog(
                                  context: context,
                                  builder: (context) => AlertDialog(
                                    title: const Text('Unsend Message'),
                                    content: const Text('Are you sure you want to unsend this message?'),
                                    actions: [
                                      TextButton(
                                        onPressed: () => Navigator.pop(context),
                                        child: const Text('Cancel'),
                                      ),
                                      TextButton(
                                        onPressed: () {
                                          Navigator.pop(context);
                                          onUnsend!();
                                        },
                                        style: TextButton.styleFrom(foregroundColor: Colors.red),
                                        child: const Text('Unsend'),
                                      ),
                                    ],
                                  ),
                                );
                              },
                            ),
                        ],
                      ),
                    ),
                  );
                },
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    if (replyToMessage != null)
                      _buildReplyPreview(replyToMessage, isSent),
                    if (content.isNotEmpty)
                      SelectableLinkify(
                        text: content,
                        onOpen: (link) async {
                          final uri = Uri.parse(link.url);
                          if (await canLaunchUrl(uri)) {
                            await launchUrl(uri, mode: LaunchMode.externalApplication);
                          } else {
                            ScaffoldMessenger.of(context).showSnackBar(
                              const SnackBar(content: Text('Could not open link')),
                            );
                          }
                        },
                        style: TextStyle(
                          color: isSent ? Colors.white : Colors.black87,
                          fontSize: 15,
                        ),
                        linkStyle: TextStyle(
                          color: isSent ? Colors.white : Colors.blue,
                          decoration: TextDecoration.underline,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    if (attachments.isNotEmpty) ...[
                      const SizedBox(height: 8),
                      ...attachments.map((attachment) => _buildAttachment(attachment)),
                    ],
                  ],
                ),
              ),
            ),
            if (reactions.isNotEmpty)
              Container(
                margin: const EdgeInsets.only(top: 4),
                child: Wrap(
                  spacing: 4,
                  children: _groupReactions(reactions).map((reactionGroup) {
                    final isMine = reactionGroup['isMine'] as bool;
                    return GestureDetector(
                      onTap: () => _showReactionDetail(context, reactionGroup),
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                        decoration: BoxDecoration(
                          color: isMine ? Colors.blue[100] : Colors.grey[200],
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(
                            color: isMine ? Colors.blue : Colors.grey[300]!,
                          ),
                        ),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Text(reactionGroup['emoji'], style: const TextStyle(fontSize: 12)),
                            if ((reactionGroup['count'] as int) > 1)
                              Padding(
                                padding: const EdgeInsets.only(left: 4),
                                child: Text('${reactionGroup['count']}',
                                    style: const TextStyle(fontSize: 12)),
                              ),
                          ],
                        ),
                      ),
                    );
                  }).toList(),
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
      return GestureDetector(
        onTap: () {
          Navigator.push(
            context,
            MaterialPageRoute(
              builder: (_) => Scaffold(
                backgroundColor: Colors.black,
                appBar: AppBar(
                  backgroundColor: Colors.black,
                  iconTheme: const IconThemeData(color: Colors.white),
                  title: Text(fileName, style: const TextStyle(color: Colors.white, fontSize: 16)),
                ),
                body: Center(
                  child: InteractiveViewer(
                    panEnabled: true,
                    minScale: 0.5,
                    maxScale: 4,
                    child: Image.network(cloudinaryUrl),
                  ),
                ),
              ),
            ),
          );
        },
        child: ClipRRect(
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
