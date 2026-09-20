import 'package:flutter/material.dart';
import '../../services/messaging_service.dart';

class GroupCreationScreen extends StatefulWidget {
  const GroupCreationScreen({Key? key}) : super(key: key);

  @override
  State<GroupCreationScreen> createState() => _GroupCreationScreenState();
}

class _GroupCreationScreenState extends State<GroupCreationScreen> {
  final MessagingService _messagingService = MessagingService();
  final TextEditingController _searchController = TextEditingController();
  final TextEditingController _groupNameController = TextEditingController();

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

  Future<void> _createGroup() async {
    if (_groupNameController.text.trim().isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please enter a group name')),
      );
      return;
    }
    if (_selectedUsers.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please select at least one member')),
      );
      return;
    }

    setState(() => _isCreating = true);
    final participantIds =
        _selectedUsers.map<int>((u) => u['id'] as int).toList();

    final result = await _messagingService.createConversation(
      type: 'group',
      participantIds: participantIds,
      name: _groupNameController.text.trim(),
    );

    setState(() => _isCreating = false);

    if (result != null && mounted) {
      Navigator.pop(context, true);
    } else if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Failed to create group. Please try again.')),
      );
    }
  }

  @override
  void dispose() {
    _searchController.dispose();
    _groupNameController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('New Group'),
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
              onPressed: _createGroup,
              child: const Text('Create', style: TextStyle(fontWeight: FontWeight.bold)),
            ),
        ],
      ),
      body: Column(
        children: [
          // Group name field
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 4),
            child: TextField(
              controller: _groupNameController,
              decoration: const InputDecoration(
                labelText: 'Group Name',
                hintText: 'Enter a name for the group',
                border: OutlineInputBorder(),
                prefixIcon: Icon(Icons.group),
              ),
              textCapitalization: TextCapitalization.words,
            ),
          ),

          // Selected members chips
          if (_selectedUsers.isNotEmpty)
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
              child: Wrap(
                spacing: 6,
                children: _selectedUsers.map((user) {
                  return Chip(
                    avatar: CircleAvatar(
                      backgroundColor: Colors.blue,
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
                hintText: 'Search members...',
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
                              'Search for org members to add',
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
                                  backgroundColor: selected ? Colors.blue : Colors.grey[300],
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
                                    ? const Icon(Icons.check_circle, color: Colors.blue)
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
