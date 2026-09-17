import 'package:flutter/material.dart';
import '../../services/messaging_service.dart';
import 'chat_screen.dart';

class UserSearchScreen extends StatefulWidget {
  final Function(Map<String, dynamic>)? onUserSelected;

  const UserSearchScreen({Key? key, this.onUserSelected}) : super(key: key);

  @override
  State<UserSearchScreen> createState() => _UserSearchScreenState();
}

class _UserSearchScreenState extends State<UserSearchScreen> {
  final MessagingService _messagingService = MessagingService();
  final TextEditingController _searchController = TextEditingController();

  List<dynamic> _allUsers = [];       // full org member list loaded on init
  List<dynamic> _filteredUsers = [];  // filtered by search query
  bool _loading = false;

  @override
  void initState() {
    super.initState();
    _loadAllUsers();
    _searchController.addListener(_filterUsers);
  }

  @override
  void dispose() {
    _searchController.removeListener(_filterUsers);
    _searchController.dispose();
    super.dispose();
  }

  /// Loads all org members once on screen open (empty query = all users),
  /// matching the dashboard UserSearch behaviour.
  Future<void> _loadAllUsers() async {
    setState(() => _loading = true);
    final results = await _messagingService.searchUsers('');
    if (mounted) {
      setState(() {
        _allUsers = results;
        _filteredUsers = results;
        _loading = false;
      });
    }
  }

  /// Filters the already-loaded list locally so there are no extra API calls
  /// while the user types. Falls back to a remote search for longer queries
  /// in case the initial load was paginated / truncated.
  void _filterUsers() {
    final query = _searchController.text.trim().toLowerCase();
    if (query.isEmpty) {
      setState(() => _filteredUsers = _allUsers);
      return;
    }
    setState(() {
      _filteredUsers = _allUsers.where((user) {
        final name = '${user['first_name'] ?? ''} ${user['last_name'] ?? ''}'.toLowerCase();
        final email = (user['email'] ?? '').toLowerCase();
        final role = (user['role'] ?? '').toLowerCase();
        return name.contains(query) || email.contains(query) || role.contains(query);
      }).toList();
    });
  }

  Future<void> _startConversation(Map<String, dynamic> user) async {
    final conversation = await _messagingService.createConversation(
      type: 'direct',
      participantIds: [user['id']],
    );

    if (conversation != null && mounted) {
      Navigator.pop(context, true);
      Navigator.push(
        context,
        MaterialPageRoute(
          builder: (context) => ChatScreen(
            conversationId: conversation['id'],
            conversationName: '${user['first_name']} ${user['last_name']}'.trim(),
          ),
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('New Conversation'),
      ),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.all(16),
            child: TextField(
              controller: _searchController,
              decoration: InputDecoration(
                hintText: 'Search users by name or email...',
                prefixIcon: const Icon(Icons.search),
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                ),
                filled: true,
                fillColor: Colors.grey[100],
              ),
              autofocus: false,
            ),
          ),
          Expanded(
            child: _loading
                ? const Center(child: CircularProgressIndicator())
                : _filteredUsers.isEmpty
                    ? Center(
                        child: Text(
                          _searchController.text.isNotEmpty
                              ? 'No users found'
                              : 'No members in this organisation',
                          style: TextStyle(
                            fontSize: 16,
                            color: Colors.grey[600],
                          ),
                        ),
                      )
                    : ListView.builder(
                        itemCount: _filteredUsers.length,
                        itemBuilder: (context, index) {
                          final user = _filteredUsers[index] as Map<String, dynamic>;
                          final firstName = user['first_name'] ?? '';
                          final lastName = user['last_name'] ?? '';
                          final email = user['email'] ?? '';
                          final role = user['role'] ?? '';

                          return ListTile(
                            leading: CircleAvatar(
                              backgroundColor: Colors.blue,
                              child: Text(
                                (firstName.isNotEmpty
                                    ? firstName[0]
                                    : email.isNotEmpty
                                        ? email[0]
                                        : '?').toUpperCase(),
                                style: const TextStyle(
                                  color: Colors.white,
                                  fontWeight: FontWeight.bold,
                                ),
                              ),
                            ),
                            title: Text(
                              '$firstName $lastName'.trim().isEmpty ? email : '$firstName $lastName',
                              style: const TextStyle(fontWeight: FontWeight.w600),
                            ),
                            subtitle: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(email, style: TextStyle(color: Colors.grey[600])),
                                Text(
                                  role.replaceAll('_', ' ').toUpperCase(),
                                  style: TextStyle(
                                    fontSize: 12,
                                    color: Colors.grey[500],
                                  ),
                                ),
                              ],
                            ),
                            trailing: IconButton(
                              icon: const Icon(Icons.chat_bubble),
                              color: Colors.blue,
                              onPressed: () {
                                if (widget.onUserSelected != null) {
                                  widget.onUserSelected!(user);
                                } else {
                                  _startConversation(user);
                                }
                              },
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
