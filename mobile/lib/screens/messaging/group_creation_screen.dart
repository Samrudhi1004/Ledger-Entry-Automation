import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../services/messaging_service.dart';
import '../../providers/messaging_provider.dart';
import 'chat_screen.dart';

class GroupCreationScreen extends StatefulWidget {
  const GroupCreationScreen({Key? key}) : super(key: key);

  @override
  State<GroupCreationScreen> createState() => _GroupCreationScreenState();
}

class _GroupCreationScreenState extends State<GroupCreationScreen> {
  late final MessagingService _messagingService;
  final TextEditingController _searchController = TextEditingController();
  final TextEditingController _groupNameController = TextEditingController();
  final TextEditingController _groupDescController = TextEditingController();

  List<dynamic> _allUsers = [];
  List<dynamic> _filteredUsers = [];
  bool _loadingUsers = false;
  bool _creating = false;

  // Use a List so insertion order is preserved (like dashboard's array)
  final List<Map<String, dynamic>> _selectedUsers = [];

  // Step 0 = Select Members, Step 1 = Group Details  (matches dashboard's step 1/2)
  int _step = 0;

  @override
  void initState() {
    super.initState();
    _messagingService = Provider.of<MessagingProvider>(context, listen: false).globalService;
    _loadAllUsers();
    _searchController.addListener(_filterUsers);
    // Rebuild when group name changes so the Create Group button enables/disables reactively
    _groupNameController.addListener(() => setState(() {}));
  }

  @override
  void dispose() {
    _searchController.removeListener(_filterUsers);
    _groupNameController.removeListener(() => setState(() {}));
    _searchController.dispose();
    _groupNameController.dispose();
    _groupDescController.dispose();
    super.dispose();
  }

  // ── Data helpers ────────────────────────────────────────────────────────────

  /// Load all org members once — mirrors dashboard's `searchUsers('')` on mount.
  Future<void> _loadAllUsers() async {
    setState(() => _loadingUsers = true);
    final results = await _messagingService.searchUsers('');
    if (mounted) {
      setState(() {
        _allUsers = results;
        _filteredUsers = results;
        _loadingUsers = false;
      });
    }
  }

  /// Local filter — no extra API calls per keystroke.
  void _filterUsers() {
    final q = _searchController.text.trim().toLowerCase();
    setState(() {
      _filteredUsers = q.isEmpty
          ? _allUsers
          : _allUsers.where((u) {
              final name = _displayName(u as Map<String, dynamic>).toLowerCase();
              final email = (u['email'] ?? '').toLowerCase();
              return name.contains(q) || email.contains(q);
            }).toList();
    });
  }

  void _toggleUser(Map<String, dynamic> user) {
    setState(() {
      final idx = _selectedUsers.indexWhere((u) => u['id'] == user['id']);
      if (idx >= 0) {
        _selectedUsers.removeAt(idx);
      } else {
        _selectedUsers.add(user);
      }
    });
  }

  bool _isSelected(Map<String, dynamic> user) =>
      _selectedUsers.any((u) => u['id'] == user['id']);

  String _displayName(Map<String, dynamic> user) {
    final first = user['first_name'] ?? '';
    final last = user['last_name'] ?? '';
    final full = '$first $last'.trim();
    if (full.isNotEmpty) return full;
    final email = user['email'] as String? ?? '';
    return email.isNotEmpty ? email.split('@')[0] : 'Unknown';
  }

  /// Safe initial letter — guards against empty string crash.
  String _initial(Map<String, dynamic> user) {
    final first = user['first_name'] as String? ?? '';
    final email = user['email'] as String? ?? '';
    if (first.isNotEmpty) return first[0].toUpperCase();
    if (email.isNotEmpty) return email[0].toUpperCase();
    return '?';
  }

  // ── Create group ────────────────────────────────────────────────────────────

  Future<void> _createGroup() async {
    final groupName = _groupNameController.text.trim();
    if (groupName.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please enter a group name')),
      );
      return;
    }

    setState(() => _creating = true);

    final participantIds = _selectedUsers.map<int>((u) => u['id'] as int).toList();
    final groupDesc = _groupDescController.text.trim();

    final conversation = await _messagingService.createConversation(
      type: 'group',
      participantIds: participantIds,
      name: groupName,
      description: groupDesc,
    );

    if (mounted) {
      setState(() => _creating = false);
      if (conversation != null) {
        Navigator.pushReplacement(
          context,
          MaterialPageRoute(
            builder: (context) => ChatScreen(
              conversationId: conversation['id'],
              conversationName: conversation['name'] ?? groupName,
            ),
          ),
          result: true, // Signal success to MessagesScreen
        );
      } else {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Failed to create group. Please try again.')),
        );
      }
    }
  }

  // ── Step widgets ────────────────────────────────────────────────────────────

  /// Step 1: Select Members
  Widget _buildStep1() {
    final theme = Theme.of(context);
    return Column(
      children: [
        // Search bar
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 4),
          child: TextField(
            controller: _searchController,
            decoration: InputDecoration(
              hintText: 'Search users…',
              prefixIcon: const Icon(Icons.search),
              border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
              filled: true,
              fillColor: Colors.grey[100],
            ),
          ),
        ),

        // Selected chips
        if (_selectedUsers.isNotEmpty)
          Container(
            width: double.infinity,
            color: theme.colorScheme.primary.withValues(alpha: 0.06),
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Selected (${_selectedUsers.length})',
                  style: TextStyle(
                    fontWeight: FontWeight.bold,
                    color: theme.colorScheme.primary,
                    fontSize: 13,
                  ),
                ),
                const SizedBox(height: 6),
                Wrap(
                  spacing: 8,
                  runSpacing: 4,
                  children: _selectedUsers.map((user) {
                    return Chip(
                      avatar: CircleAvatar(
                        backgroundColor: theme.colorScheme.primary,
                        child: Text(
                          _initial(user),
                          style: const TextStyle(color: Colors.white, fontSize: 11),
                        ),
                      ),
                      label: Text(_displayName(user), style: const TextStyle(fontSize: 13)),
                      deleteIcon: const Icon(Icons.close, size: 15),
                      onDeleted: () => _toggleUser(user),
                      backgroundColor: Colors.white,
                    );
                  }).toList(),
                ),
              ],
            ),
          ),

        // User list
        Expanded(
          child: _loadingUsers
              ? const Center(child: CircularProgressIndicator())
              : _filteredUsers.isEmpty
                  ? Center(
                      child: Text(
                        _searchController.text.isNotEmpty
                            ? 'No users found'
                            : 'No members in this organisation',
                        style: TextStyle(color: Colors.grey[600]),
                      ),
                    )
                  : ListView.separated(
                      itemCount: _filteredUsers.length,
                      separatorBuilder: (_, __) => const Divider(height: 1),
                      itemBuilder: (context, index) {
                        final user = _filteredUsers[index] as Map<String, dynamic>;
                        final selected = _isSelected(user);
                        final role = (user['role'] ?? '')
                            .toString()
                            .replaceAll('_', ' ')
                            .toUpperCase();

                        return ListTile(
                          leading: CircleAvatar(
                            backgroundColor:
                                selected ? theme.colorScheme.primary : Colors.grey[300],
                            child: Text(
                              _initial(user),
                              style: TextStyle(
                                color: selected ? Colors.white : Colors.grey[700],
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                          ),
                          title: Text(
                            _displayName(user),
                            style: TextStyle(
                              fontWeight: FontWeight.w600,
                              color: selected ? theme.colorScheme.primary : null,
                            ),
                          ),
                          subtitle: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(user['email'] ?? '',
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
                          onTap: () => _toggleUser(user),
                        );
                      },
                    ),
        ),

        // Footer buttons
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 16),
          child: Row(
            children: [
              Expanded(
                child: OutlinedButton(
                  onPressed: () => Navigator.pop(context),
                  child: const Text('Cancel'),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                flex: 2,
                child: FilledButton(
                  onPressed: _selectedUsers.isEmpty
                      ? null
                      : () => setState(() => _step = 1),
                  child: Text('Next (${_selectedUsers.length})'),
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }

  /// Step 2: Group Details
  Widget _buildStep2() {
    final theme = Theme.of(context);
    return Column(
      children: [
        Expanded(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(20),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Group icon placeholder
                Center(
                  child: Container(
                    width: 80,
                    height: 80,
                    decoration: BoxDecoration(
                      color: theme.colorScheme.primaryContainer,
                      shape: BoxShape.circle,
                    ),
                    child: Icon(Icons.group_rounded,
                        size: 40, color: theme.colorScheme.primary),
                  ),
                ),
                const SizedBox(height: 28),

                // Group name
                const Text('Group Name *',
                    style: TextStyle(fontWeight: FontWeight.bold, fontSize: 15)),
                const SizedBox(height: 8),
                TextField(
                  controller: _groupNameController,
                  autofocus: true,
                  maxLength: 100,
                  decoration: InputDecoration(
                    hintText: 'Enter group name',
                    border:
                        OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                    contentPadding:
                        const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                  ),
                ),
                const SizedBox(height: 12),

                // Description
                const Text('Description',
                    style: TextStyle(fontWeight: FontWeight.bold, fontSize: 15)),
                const SizedBox(height: 8),
                TextField(
                  controller: _groupDescController,
                  maxLines: 3,
                  maxLength: 500,
                  decoration: InputDecoration(
                    hintText: 'Optional description for the group',
                    border:
                        OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                    contentPadding:
                        const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                  ),
                ),
                const SizedBox(height: 20),

                // Members summary
                Row(
                  children: [
                    Icon(Icons.group_rounded,
                        size: 18, color: theme.colorScheme.primary),
                    const SizedBox(width: 6),
                    Text(
                      'Members (${_selectedUsers.length})',
                      style: TextStyle(
                          fontWeight: FontWeight.bold,
                          fontSize: 15,
                          color: theme.colorScheme.primary),
                    ),
                  ],
                ),
                const SizedBox(height: 10),
                Container(
                  decoration: BoxDecoration(
                    border: Border.all(color: Colors.grey[300]!),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: ListView.builder(
                    shrinkWrap: true,
                    physics: const NeverScrollableScrollPhysics(),
                    itemCount: _selectedUsers.length,
                    itemBuilder: (context, index) {
                      final user = _selectedUsers[index];
                      return ListTile(
                        leading: CircleAvatar(
                          backgroundColor: theme.colorScheme.primary,
                          radius: 16,
                          child: Text(
                            _initial(user),
                            style: const TextStyle(
                                color: Colors.white,
                                fontSize: 13,
                                fontWeight: FontWeight.bold),
                          ),
                        ),
                        title: Text(_displayName(user),
                            style:
                                const TextStyle(fontWeight: FontWeight.w500)),
                        subtitle: Text(user['email'] ?? '',
                            style: TextStyle(
                                fontSize: 12, color: Colors.grey[600])),
                      );
                    },
                  ),
                ),
              ],
            ),
          ),
        ),

        // Footer buttons
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 16),
          child: Row(
            children: [
              Expanded(
                child: OutlinedButton(
                  onPressed: _creating ? null : () => setState(() => _step = 0),
                  child: const Text('Back'),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                flex: 2,
                child: FilledButton.icon(
                  onPressed: (_creating ||
                          _groupNameController.text.trim().isEmpty)
                      ? null
                      : _createGroup,
                  icon: _creating
                      ? const SizedBox(
                          width: 16,
                          height: 16,
                          child: CircularProgressIndicator(
                              strokeWidth: 2, color: Colors.white),
                        )
                      : const Icon(Icons.check_rounded),
                  label: Text(_creating ? 'Creating…' : 'Create Group'),
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }

  // ── Build ───────────────────────────────────────────────────────────────────

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(_step == 0 ? 'Add Group Members' : 'Group Details'),
        // Step indicator — matches "Step 1 of 2" in dashboard header
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(24),
          child: Padding(
            padding: const EdgeInsets.only(bottom: 8),
            child: Text(
              'Step ${_step + 1} of 2',
              style: TextStyle(fontSize: 12, color: Colors.grey[600]),
            ),
          ),
        ),
        leading: _step == 1
            ? IconButton(
                icon: const Icon(Icons.arrow_back),
                onPressed: () => setState(() => _step = 0),
              )
            : null,
      ),
      body: _step == 0 ? _buildStep1() : _buildStep2(),
    );
  }
}

