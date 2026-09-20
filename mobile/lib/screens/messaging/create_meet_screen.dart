import 'dart:math';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../providers/company_provider.dart';
import '../../providers/messaging_provider.dart';
import '../../services/messaging_service.dart';

/// Generates a random 10-character alphanumeric room code.
String _randomCode() {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  final rand = Random();
  return List.generate(10, (_) => chars[rand.nextInt(chars.length)]).join();
}

/// Returns a display-friendly name for a user map.
String _displayName(Map<String, dynamic> u) {
  final first = u['first_name'] ?? '';
  final last = u['last_name'] ?? '';
  final full = '$first $last'.trim();
  if (full.isNotEmpty) return full;
  final email = u['email'] as String? ?? '';
  return email.isNotEmpty ? email.split('@')[0] : 'Unknown';
}

/// Safe initial letter for avatars.
String _initial(Map<String, dynamic> u) {
  final first = u['first_name'] as String? ?? '';
  final email = u['email'] as String? ?? '';
  if (first.isNotEmpty) return first[0].toUpperCase();
  if (email.isNotEmpty) return email[0].toUpperCase();
  return '?';
}

class CreateMeetScreen extends StatefulWidget {
  const CreateMeetScreen({Key? key}) : super(key: key);

  @override
  State<CreateMeetScreen> createState() => _CreateMeetScreenState();
}

class _CreateMeetScreenState extends State<CreateMeetScreen> {
  late final MessagingService _service;
  final TextEditingController _searchCtrl = TextEditingController();

  List<dynamic> _allUsers = [];
  List<dynamic> _filtered = [];
  List<Map<String, dynamic>> _selected = [];

  bool _loadingUsers = false;
  bool _creating = false;
  String _status = '';

  @override
  void initState() {
    super.initState();
    _service = Provider.of<MessagingProvider>(context, listen: false).globalService;
    _loadUsers();
    _searchCtrl.addListener(_filter);
  }

  @override
  void dispose() {
    _searchCtrl.removeListener(_filter);
    _searchCtrl.dispose();
    super.dispose();
  }

  Future<void> _loadUsers() async {
    setState(() => _loadingUsers = true);
    final users = await _service.searchUsers('');
    if (mounted) {
      setState(() {
        _allUsers = users;
        _filtered = users;
        _loadingUsers = false;
      });
    }
  }

  void _filter() {
    final q = _searchCtrl.text.trim().toLowerCase();
    setState(() {
      _filtered = q.isEmpty
          ? _allUsers
          : _allUsers.where((u) {
              final name = _displayName(u as Map<String, dynamic>).toLowerCase();
              final email = (u['email'] ?? '').toLowerCase();
              return name.contains(q) || email.contains(q);
            }).toList();
    });
  }

  void _toggleUser(Map<String, dynamic> u) {
    if (_creating) return;
    setState(() {
      final idx = _selected.indexWhere((s) => s['id'] == u['id']);
      if (idx >= 0) {
        _selected.removeAt(idx);
      } else {
        _selected.add(u);
      }
    });
  }

  bool _isSelected(Map<String, dynamic> u) =>
      _selected.any((s) => s['id'] == u['id']);

  /// Mirrors the dashboard CreateMeet.jsx handleCreateMeet:
  /// 1. Build Jitsi URL from company name prefix + random code.
  /// 2. Open Jitsi in browser immediately.
  /// 3. Send invite message to every selected user's direct conversation via REST.
  Future<void> _handleCreateMeet() async {
    if (_selected.isEmpty || _creating) return;

    setState(() {
      _creating = true;
      _status = 'Generating meeting link…';
    });

    try {
      final companyName =
          Provider.of<CompanyProvider>(context, listen: false).companyName;

      // Strip special chars & spaces, cap at 20 chars — same as dashboard
      final cleaned = companyName.replaceAll(RegExp(r'[^a-zA-Z0-9]'), '');
      final prefix = cleaned.substring(0, cleaned.length.clamp(0, 20));

      final meetUrl = 'https://meet.jit.si/$prefix-${_randomCode()}';
      final meetMessage = '📹 Join my meeting:\n$meetUrl';

      // Open Jitsi immediately
      final uri = Uri.parse(meetUrl);
      if (await canLaunchUrl(uri)) {
        await launchUrl(uri, mode: LaunchMode.externalApplication);
      }

      setState(() => _status = 'Sending invite to ${_selected.length} participant(s)…');

      int successCount = 0;
      int failCount = 0;

      for (final invitee in _selected) {
        try {
          final conversation = await _service.createConversation(
            type: 'direct',
            participantIds: [invitee['id'] as int],
          );
          if (conversation != null) {
            await _service.sendMessage(
              content: meetMessage,
              messageType: 'text',
              conversationId: conversation['id'].toString(),
            );
            successCount++;
          } else {
            failCount++;
          }
        } catch (_) {
          failCount++;
        }
      }

      if (!mounted) return;

      if (failCount == 0) {
        setState(() => _status = 'Done! Meeting opened and invites sent ✓');
        await Future.delayed(const Duration(milliseconds: 1200));
        if (mounted) Navigator.pop(context, true);
      } else if (successCount > 0) {
        setState(() =>
            _status = 'Warning: $failCount invite(s) failed, $successCount sent.');
        await Future.delayed(const Duration(milliseconds: 2500));
        if (mounted) Navigator.pop(context, true);
      } else {
        setState(() {
          _status = 'Failed to send any invites.';
          _creating = false;
        });
      }
    } catch (_) {
      setState(() {
        _status = 'Something went wrong. Please try again.';
        _creating = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Scaffold(
      appBar: AppBar(
        title: Row(
          children: [
            Icon(Icons.video_call_rounded, color: theme.colorScheme.primary),
            const SizedBox(width: 8),
            const Text('Create a Meeting'),
          ],
        ),
      ),
      body: Column(
        children: [
          // ── Search bar ──────────────────────────────────────────────
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 4),
            child: TextField(
              controller: _searchCtrl,
              enabled: !_creating,
              decoration: InputDecoration(
                hintText: 'Search by name or email…',
                prefixIcon: const Icon(Icons.search),
                border:
                    OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                filled: true,
                fillColor: Colors.grey[100],
              ),
            ),
          ),

          // ── Selected chips ──────────────────────────────────────────
          if (_selected.isNotEmpty)
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
              child: Wrap(
                spacing: 8,
                runSpacing: 4,
                children: _selected.map((u) {
                  return Chip(
                    avatar: CircleAvatar(
                      backgroundColor: theme.colorScheme.primary,
                      child: Text(
                        _initial(u),
                        style: const TextStyle(color: Colors.white, fontSize: 12),
                      ),
                    ),
                    label: Text(_displayName(u)),
                    deleteIcon: const Icon(Icons.close, size: 16),
                    onDeleted: _creating ? null : () => _toggleUser(u),
                  );
                }).toList(),
              ),
            ),

          // ── User list ───────────────────────────────────────────────
          Expanded(
            child: _loadingUsers
                ? const Center(child: CircularProgressIndicator())
                : _filtered.isEmpty
                    ? Center(
                        child: Text(
                          _searchCtrl.text.isNotEmpty
                              ? 'No users found'
                              : 'No members in this organisation',
                          style: TextStyle(color: Colors.grey[600]),
                        ),
                      )
                    : ListView.builder(
                        itemCount: _filtered.length,
                        itemBuilder: (context, i) {
                          final u = _filtered[i] as Map<String, dynamic>;
                          final selected = _isSelected(u);
                          final role = (u['role'] ?? '')
                              .toString()
                              .replaceAll('_', ' ')
                              .toUpperCase();

                          return ListTile(
                            leading: CircleAvatar(
                              backgroundColor: selected
                                  ? theme.colorScheme.primary
                                  : Colors.grey[300],
                              child: Text(
                                _initial(u),
                                style: TextStyle(
                                  color: selected ? Colors.white : Colors.grey[700],
                                  fontWeight: FontWeight.bold,
                                ),
                              ),
                            ),
                            title: Text(
                              _displayName(u),
                              style: TextStyle(
                                fontWeight: FontWeight.w600,
                                color: selected
                                    ? theme.colorScheme.primary
                                    : null,
                              ),
                            ),
                            subtitle: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(u['email'] ?? '',
                                    style: TextStyle(color: Colors.grey[600])),
                                if (role.isNotEmpty)
                                  Text(role,
                                      style: TextStyle(
                                          fontSize: 11, color: Colors.grey[500])),
                              ],
                            ),
                            trailing: selected
                                ? Icon(Icons.check_circle_rounded,
                                    color: theme.colorScheme.primary)
                                : const Icon(Icons.radio_button_unchecked,
                                    color: Colors.grey),
                            onTap: () => _toggleUser(u),
                          );
                        },
                      ),
          ),

          // ── Status message ──────────────────────────────────────────
          if (_status.isNotEmpty)
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
              child: Row(
                children: [
                  if (_creating)
                    const SizedBox(
                      width: 14,
                      height: 14,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    ),
                  if (_creating) const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      _status,
                      style: TextStyle(
                        fontSize: 13,
                        color: _status.contains('✓')
                            ? Colors.green[700]
                            : _status.contains('Warning') ||
                                    _status.contains('Failed')
                                ? Colors.orange[700]
                                : Colors.grey[700],
                      ),
                    ),
                  ),
                ],
              ),
            ),

          // ── Footer buttons ──────────────────────────────────────────
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 16),
            child: Row(
              children: [
                Expanded(
                  child: OutlinedButton(
                    onPressed: _creating ? null : () => Navigator.pop(context),
                    child: const Text('Cancel'),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  flex: 2,
                  child: FilledButton.icon(
                    onPressed: (_selected.isEmpty || _creating)
                        ? null
                        : _handleCreateMeet,
                    icon: _creating
                        ? const SizedBox(
                            width: 16,
                            height: 16,
                            child: CircularProgressIndicator(
                                strokeWidth: 2, color: Colors.white),
                          )
                        : const Icon(Icons.video_call_rounded),
                    label: Text(_creating
                        ? 'Creating…'
                        : 'Create Meet${_selected.isNotEmpty ? ' (${_selected.length})' : ''}'),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
