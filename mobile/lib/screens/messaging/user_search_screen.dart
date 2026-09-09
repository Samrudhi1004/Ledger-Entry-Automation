import 'package:flutter/material.dart';
import '../../services/messaging_service.dart';
import 'chat_screen.dart';

class UserSearchScreen extends StatefulWidget {
  const UserSearchScreen({Key? key}) : super(key: key);

  @override
  State<UserSearchScreen> createState() => _UserSearchScreenState();
}

class _UserSearchScreenState extends State<UserSearchScreen> {
  final MessagingService _messagingService = MessagingService();
  final TextEditingController _searchController = TextEditingController();

  List<dynamic> _searchResults = [];
  bool _loading = false;

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  Future<void> _searchUsers(String query) async {
    if (query.trim().length < 2) {
      setState(() => _searchResults = []);
      return;
    }

    setState(() => _loading = true);
    final results = await _messagingService.searchUsers(query);
    setState(() {
      _searchResults = results;
      _loading = false;
    });
  }

  Future<void> _startConversation(Map<String, dynamic> user) async {
    final conversation = await _messagingService.createConversation(
      type: 'direct',
      participantIds: [user['id']],
    );

    if (conversation != null && mounted) {
      Navigator.pop(context, true); // Return success
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
              onChanged: _searchUsers,
              decoration: InputDecoration(
                hintText: 'Search users by name or email...',
                prefixIcon: const Icon(Icons.search),
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                ),
                filled: true,
                fillColor: Colors.grey[100],
              ),
              autofocus: true,
            ),
          ),
          Expanded(
            child: _loading
                ? const Center(child: CircularProgressIndicator())
                : _searchResults.isEmpty
                    ? Center(
                        child: Text(
                          _searchController.text.length >= 2
                              ? 'No users found'
                              : 'Type to search for users',
                          style: TextStyle(
                            fontSize: 16,
                            color: Colors.grey[600],
                          ),
                        ),
                      )
                    : ListView.builder(
                        itemCount: _searchResults.length,
                        itemBuilder: (context, index) {
                          final user = _searchResults[index] as Map<String, dynamic>;
                          final firstName = user['first_name'] ?? '';
                          final lastName = user['last_name'] ?? '';
                          final email = user['email'] ?? '';
                          final role = user['role'] ?? '';

                          return ListTile(
                            leading: CircleAvatar(
                              backgroundColor: Colors.blue,
                              child: Text(
                                (firstName.isNotEmpty ? firstName[0] : email[0]).toUpperCase(),
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
                              onPressed: () => _startConversation(user),
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
