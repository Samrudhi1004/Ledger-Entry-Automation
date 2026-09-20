import 'package:flutter/material.dart';
import '../../services/messaging_service.dart';

class CreateMeetScreen extends StatefulWidget {
  const CreateMeetScreen({Key? key}) : super(key: key);

  @override
  State<CreateMeetScreen> createState() => _CreateMeetScreenState();
}

class _CreateMeetScreenState extends State<CreateMeetScreen> {
  final MessagingService _messagingService = MessagingService();
  final TextEditingController _searchController = TextEditingController();
  final TextEditingController _topicController = TextEditingController();

  List<dynamic> _searchResults = [];
  List<dynamic> _selectedUsers = [];
  bool _isSearching = false;
  bool _isCreating = false;

  Future<void> _searchUsers(String query) async {
    if (query.trim().isEmpty) {
      setState(() => _searchResults = []);
      return;
    }
    setState(() => _isSearching = true);
    final results = await _messagingService.searchUsers(query.trim());
    setState(() {
      _searchResults = results;
      _isSearching = false;
    });
  }

  void _toggleUser(Map<String, dynamic> user) {
    setState(() {
      final alreadySelected = _selectedUsers.any((u) => u['id'] == user['id']);
      if (alreadySelected) {
        _selectedUsers.removeWhere((u) => u['id'] == user['id']);
      } else {
        _selectedUsers.add(user);
      }
    });
  }

  bool _isSelected(Map<String, dynamic> user) =>
      _selectedUsers.any((u) => u['id'] == user['id']);

  String _userName(Map<String, dynamic> user) {
    final first = user['first_name'] ?? '';
    final last = user['last_name'] ?? '';
    final full = '$first $last'.trim();
    return full.isNotEmpty ? full : user['email'] ?? 'Unknown';
  }

  /// Generates a unique Jitsi room name from topic + timestamp
  String _generateRoomName(String topic) {
    final slug = topic
        .toLowerCase()
        .replaceAll(RegExp(r'[^a-z0-9]'), '-')
        .replaceAll(RegExp(r'-+'), '-')
        .replaceAll(RegExp(r'^-|-$'), '');
    final ts = DateTime.now().millisecondsSinceEpoch;
    return '$slug-$ts';
  }

  Future<void> _createMeet() async {
    if (_topicController.text.trim().isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please enter a meeting topic')),
      );
      return;
    }
    if (_selectedUsers.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please select at least one participant')),
      );
      return;
    }

    setState(() => _isCreating = true);

    final topic = _topicController.text.trim();
    final roomName = _generateRoomName(topic);
    final jitsiUrl = 'https://meet.jit.si/$roomName';

    final participantIds =
        _selectedUsers.map<int>((u) => u['id'] as int).toList();

    // Create a group conversation for the meet
    final conversation = await _messagingService.createConversation(
      type: _selectedUsers.length == 1 ? 'direct' : 'group',
      participantIds: participantIds,
      name: _selectedUsers.length == 1 ? null : 'Meet: $topic',
    );

    if (conversation != null) {
      final conversationId = conversation['id'].toString();
      // Send a meeting-type message with the Jitsi link
      await _messagingService.sendMessage(
        content: '📅 Meeting: $topic\n$jitsiUrl',
        messageType: 'meeting',
        conversationId: conversationId,
      );
    }

    setState(() => _isCreating = false);

    if (mounted) {
      if (conversation != null) {
        Navigator.pop(context, true);
      } else {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Failed to create meeting. Please try again.')),
        );
      }
    }
  }

  @override
  void dispose() {
    _searchController.dispose();
    _topicController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Create Meet'),
        actions: [
          if (_isCreating)
            const Center(
              child: Padding(
                padding: EdgeInsets.only(right: 16),
                child: SizedBox(
                  width: 20,
                  height: 20,
                  child: CircularProgressIndicator(strokeWidth: 2),
                ),
              ),
            )
          else
            TextButton(
              onPressed: _createMeet,
              child: const Text('Start', style: TextStyle(fontWeight: FontWeight.bold)),
            ),
        ],
      ),
      body: Column(
        children: [
          // Topic field
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 4),
            child: TextField(
              controller: _topicController,
              decoration: const InputDecoration(
                labelText: 'Meeting Topic',
                hintText: 'Enter a topic for the meeting',
                border: OutlineInputBorder(),
                prefixIcon: Icon(Icons.video_call),
              ),
              textCapitalization: TextCapitalization.sentences,
            ),
          ),

          // Jitsi info banner
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              decoration: BoxDecoration(
                color: Colors.blue[50],
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: Colors.blue[200]!),
              ),
              child: Row(
                children: const [
                  Icon(Icons.info_outline, color: Colors.blue, size: 18),
                  SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      'A Jitsi Meet link will be shared with selected participants.',
                      style: TextStyle(fontSize: 12, color: Colors.blue),
                    ),
                  ),
                ],
              ),
            ),
          ),

          // Selected participants chips
          if (_selectedUsers.isNotEmpty)
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
              child: Wrap(
                spacing: 6,
                children: _selectedUsers.map((user) {
                  return Chip(
                    avatar: CircleAvatar(
                      backgroundColor: Colors.green,
                      child: Text(
                        _userName(user)[0].toUpperCase(),
                        style: const TextStyle(color: Colors.white, fontSize: 12),
                      ),
                    ),
                    label: Text(_userName(user)),
                    onDeleted: () => _toggleUser(user as Map<String, dynamic>),
                  );
                }).toList(),
              ),
            ),

          // Search bar
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
            child: TextField(
              controller: _searchController,
              decoration: InputDecoration(
                hintText: 'Search participants...',
                prefixIcon: const Icon(Icons.search),
                border: const OutlineInputBorder(),
                suffixIcon: _searchController.text.isNotEmpty
                    ? IconButton(
                        icon: const Icon(Icons.clear),
                        onPressed: () {
                          _searchController.clear();
                          setState(() => _searchResults = []);
                        },
                      )
                    : null,
              ),
              onChanged: _searchUsers,
            ),
          ),

          const Divider(height: 1),

          // Results
          Expanded(
            child: _isSearching
                ? const Center(child: CircularProgressIndicator())
                : _searchResults.isEmpty && _searchController.text.isNotEmpty
                    ? Center(
                        child: Text(
                          'No users found',
                          style: TextStyle(color: Colors.grey[600]),
                        ),
                      )
                    : _searchResults.isEmpty
                        ? Center(
                            child: Text(
                              'Search for org members to invite',
                              style: TextStyle(color: Colors.grey[500]),
                            ),
                          )
                        : ListView.builder(
                            itemCount: _searchResults.length,
                            itemBuilder: (context, index) {
                              final user = _searchResults[index] as Map<String, dynamic>;
                              final selected = _isSelected(user);
                              return ListTile(
                                leading: CircleAvatar(
                                  backgroundColor: selected ? Colors.green : Colors.grey[300],
                                  child: Text(
                                    _userName(user)[0].toUpperCase(),
                                    style: TextStyle(
                                      color: selected ? Colors.white : Colors.black54,
                                      fontWeight: FontWeight.bold,
                                    ),
                                  ),
                                ),
                                title: Text(_userName(user)),
                                subtitle: Text(user['email'] ?? ''),
                                trailing: selected
                                    ? const Icon(Icons.check_circle, color: Colors.green)
                                    : const Icon(Icons.radio_button_unchecked, color: Colors.grey),
                                onTap: () => _toggleUser(user),
                              );
                            },
                          ),
          ),
        ],
      ),
    );
  }
}
