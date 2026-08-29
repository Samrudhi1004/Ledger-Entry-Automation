import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../providers/auth_provider.dart';
import '../providers/inspection_provider.dart';
import '../services/api_service.dart';
import 'account_screen.dart';
import 'machine_select_screen.dart';
import 'operation_select_screen.dart';
import 'daily_production_report_screen.dart';
import 'inspection_voice_screen.dart';
import 'setup_approval_report_screen.dart';

class AppHomeScreen extends StatefulWidget {
  const AppHomeScreen({super.key});

  @override
  State<AppHomeScreen> createState() => _AppHomeScreenState();
}

class _AppHomeScreenState extends State<AppHomeScreen> {
  int _currentIndex = 0;
  List<Map<String, dynamic>> _supervisorNotifications = [];
  List<dynamic> _teamMembers = [];

  @override
  void initState() {
    super.initState();
    _loadDashboardData();
  }

  Future<void> _loadDashboardData() async {
    try {
      final provider = Provider.of<InspectionProvider>(context, listen: false);
      final machineId = provider.selectedMachine?['id'];

      // 1. Fetch pending supervisor rejections
      await provider.fetchPendingRejections();

      // 2. Fetch machine setup approval status
      bool approved = false;
      String msg = '';
      if (machineId != null) {
        final res = await ApiService.checkSetupApproved(machineId);
        approved = res['is_setup_approved'] == true;
        msg = res['message'] ?? '';
      }

      // 3. Build Notifications List from Supervisor Actions
      final List<Map<String, dynamic>> notifs = [];

      // Add Rejection / Corrective Trial Notifications from Supervisor
      for (var rej in provider.activeRejections) {
        final currentTrial = rej['trial_number'] ?? 1;
        final nextTrial = currentTrial + 1;
        final remark = rej['rejection_reason'] ?? rej['supervisor_remark'] ?? 'Targeted parameter correction requested.';
        final List<dynamic> params = rej['rejected_parameters'] ?? [];

        notifs.add({
          'id': 'rej_${rej['id'] ?? rej['session_id']}',
          'type': 'rejection',
          'title': '🚨 Supervisor Rejection & Retrial Notice',
          'subtitle': 'Supervisor requested corrective trial #$nextTrial',
          'message': 'Remark: "$remark"',
          'details': params.isNotEmpty ? 'Targeted Params: ${params.join(", ")}' : 'All parameters require re-verification.',
          'time': 'Just now',
          'is_read': false,
          'raw_rej': rej,
          'next_trial': nextTrial,
        });
      }

      // Add Setup Approval Notification
      if (approved) {
        notifs.add({
          'id': 'setup_approved',
          'type': 'approval',
          'title': '✓ 1st Piece Setup Authorized',
          'subtitle': 'Supervisor / Quality Inspector',
          'message': msg.isNotEmpty ? msg : 'First Piece inspection finalized and PASSED. Hourly in-process inspections unlocked.',
          'time': 'Active Shift',
          'is_read': false,
        });
      }

      // Add General Supervisor Quality Directive Notification
      notifs.add({
        'id': 'directive_1',
        'type': 'directive',
        'title': '📢 Supervisor Quality Directive',
        'subtitle': 'Quality Control Supervisor',
        'message': 'Verify chamfer dimensions (CHA-01) and bore tolerances strictly for production run.',
        'time': 'Today, 08:00 AM',
        'is_read': true,
      });

      // Fetch dynamic station team operators from backend (100% dynamic from backend API)
      final dynamicUsers = await ApiService.getUsers(role: 'operator');
      final operatorsOnly = dynamicUsers.where((u) {
        final role = (u['role'] ?? '').toString().toLowerCase();
        return role == 'operator';
      }).toList();

      if (mounted) {
        setState(() {
          _supervisorNotifications = notifs;
          _teamMembers = operatorsOnly;
        });
      }
    } catch (_) {
      // Handle error silently
    }
  }

  void _showNotificationsModal(BuildContext context) {
    final provider = Provider.of<InspectionProvider>(context, listen: false);

    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.white,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (ctx) {
        return StatefulBuilder(
          builder: (context, setModalState) {
            final unreadCount = _supervisorNotifications.where((n) => n['is_read'] == false).length;

            return Container(
              padding: const EdgeInsets.all(20),
              height: MediaQuery.of(context).size.height * 0.75,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Modal Header
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Row(
                        children: [
                          Container(
                            padding: const EdgeInsets.all(8),
                            decoration: BoxDecoration(
                              color: const Color(0xFF0284C7).withValues(alpha: 0.1),
                              borderRadius: BorderRadius.circular(10),
                            ),
                            child: const Icon(Icons.notifications_active_rounded, color: Color(0xFF0284C7), size: 22),
                          ),
                          const SizedBox(width: 12),
                          Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              const Text(
                                'Supervisor Notifications',
                                style: TextStyle(color: Color(0xFF0F172A), fontWeight: FontWeight.bold, fontSize: 16),
                              ),
                              Text(
                                '$unreadCount Unread Alert${unreadCount == 1 ? '' : 's'} from Supervisor',
                                style: const TextStyle(color: Color(0xFF64748B), fontSize: 12),
                              ),
                            ],
                          ),
                        ],
                      ),
                      IconButton(
                        icon: const Icon(Icons.close_rounded, color: Color(0xFF94A3B8)),
                        onPressed: () => Navigator.pop(ctx),
                      ),
                    ],
                  ),

                  const SizedBox(height: 16),
                  const Divider(color: Color(0xFF1E293B)),
                  const SizedBox(height: 10),

                  // Notifications List
                  Expanded(
                    child: _supervisorNotifications.isEmpty
                        ? const Center(
                            child: Column(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                Icon(Icons.notifications_none_rounded, color: Color(0xFF64748B), size: 48),
                                SizedBox(height: 12),
                                Text('No supervisor notifications yet', style: TextStyle(color: Color(0xFF94A3B8), fontSize: 14)),
                              ],
                            ),
                          )
                        : ListView.builder(
                            itemCount: _supervisorNotifications.length,
                            itemBuilder: (context, index) {
                              final item = _supervisorNotifications[index];
                              final isRead = item['is_read'] == true;
                              final type = item['type'];

                              Color cardBorder = const Color(0xFF1E293B);
                              Color iconColor = const Color(0xFF38BDF8);
                              if (type == 'rejection') {
                                cardBorder = const Color(0xFFEF4444);
                                iconColor = const Color(0xFFEF4444);
                              } else if (type == 'approval') {
                                cardBorder = const Color(0xFF10B981);
                                iconColor = const Color(0xFF10B981);
                              }

                              return Container(
                                margin: const EdgeInsets.only(bottom: 12),
                                padding: const EdgeInsets.all(16),
                                decoration: BoxDecoration(
                                  color: isRead ? const Color(0xFF161F32) : const Color(0xFF1E293B),
                                  borderRadius: BorderRadius.circular(16),
                                  border: Border.all(color: cardBorder, width: isRead ? 1 : 1.5),
                                ),
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Row(
                                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                      children: [
                                        Expanded(
                                          child: Text(
                                            item['title'] ?? 'Notification',
                                            style: TextStyle(
                                              color: isRead ? Colors.white70 : Colors.white,
                                              fontWeight: FontWeight.bold,
                                              fontSize: 14,
                                            ),
                                          ),
                                        ),
                                        Text(
                                          item['time'] ?? '',
                                          style: const TextStyle(color: Color(0xFF64748B), fontSize: 11),
                                        ),
                                      ],
                                    ),
                                    const SizedBox(height: 4),
                                    Text(
                                      item['subtitle'] ?? '',
                                      style: TextStyle(color: iconColor, fontSize: 12, fontWeight: FontWeight.w600),
                                    ),
                                    const SizedBox(height: 6),
                                    Text(
                                      item['message'] ?? '',
                                      style: const TextStyle(color: Color(0xFFCBD5E1), fontSize: 12.5),
                                    ),
                                    if (item['details'] != null) ...[
                                      const SizedBox(height: 4),
                                      Text(
                                        item['details'],
                                        style: const TextStyle(color: Color(0xFFFDE68A), fontSize: 11.5, fontWeight: FontWeight.bold),
                                      ),
                                    ],

                                    // Action Button for Rejection Notification
                                    if (type == 'rejection' && item['raw_rej'] != null) ...[
                                      const SizedBox(height: 12),
                                      ElevatedButton.icon(
                                        style: ElevatedButton.styleFrom(
                                          backgroundColor: const Color(0xFFEF4444),
                                          foregroundColor: Colors.white,
                                          minimumSize: const Size(double.infinity, 38),
                                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                                        ),
                                        icon: const Icon(Icons.play_arrow_rounded, color: Colors.white, size: 18),
                                        label: Text(
                                          'START CORRECTIVE TRIAL (1ST PC #${item['next_trial']})',
                                          style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 12),
                                        ),
                                        onPressed: () async {
                                          Navigator.pop(ctx);
                                          final rej = item['raw_rej'];
                                          final nextTrial = item['next_trial'];
                                          final List<dynamic> rejectedParams = rej['rejected_parameters'] ?? [];
                                          final partNo = provider.selectedPart?['part_number'] ?? 'FBT00222';
                                          final templates = await ApiService.getTemplatesByPart(partNo);

                                          if (templates.isNotEmpty) {
                                            final targetTemplate = templates.first;
                                            await provider.loadParameters(
                                              targetTemplate,
                                              targetRejectedCodes: rejectedParams,
                                            );
                                            final parentId = rej['session_id'] ?? rej['id'];
                                            final started = await provider.startSession(
                                              trial: nextTrial,
                                              parentId: parentId,
                                              inspectionType: 'first_piece',
                                            );
                                            if (started && context.mounted) {
                                              Navigator.push(
                                                context,
                                                MaterialPageRoute(builder: (_) => const InspectionVoiceScreen()),
                                              );
                                            }
                                          }
                                        },
                                      ),
                                    ],
                                  ],
                                ),
                              );
                            },
                          ),
                  ),
                ],
              ),
            );
          },
        );
      },
    );
  }
  String _getInitials(Map<String, dynamic> user) {
    final name = (user['full_name'] ?? user['first_name'] ?? user['username'] ?? 'U').toString().trim();
    if (name.isEmpty) return 'U';
    final parts = name.split(' ').where((p) => p.isNotEmpty).toList();
    if (parts.length >= 2) {
      return '${parts[0][0]}${parts[1][0]}'.toUpperCase();
    }
    return name.substring(0, name.length >= 2 ? 2 : 1).toUpperCase();
  }

  String _getShortName(Map<String, dynamic> user) {
    final name = (user['full_name'] ?? user['first_name'] ?? user['username'] ?? 'User').toString().trim();
    if (name.isEmpty) return 'User';
    final parts = name.split(' ').where((p) => p.isNotEmpty).toList();
    if (parts.length >= 2) {
      return '${parts[0]} ${parts[1][0]}.';
    }
    return name;
  }

  Color _getRoleColor(String? role) {
    final r = (role ?? '').toLowerCase();
    if (r == 'operator') return const Color(0xFF059669);
    if (r == 'quality_engineer' || r == 'inspector') return const Color(0xFF4F46E5);
    if (r == 'supervisor' || r == 'admin') return const Color(0xFFD97706);
    return const Color(0xFF0284C7);
  }

  Color _getRoleBg(String? role) {
    final r = (role ?? '').toLowerCase();
    if (r == 'operator') return const Color(0xFFA7F3D0);
    if (r == 'quality_engineer' || r == 'inspector') return const Color(0xFFE0E7FF);
    if (r == 'supervisor' || r == 'admin') return const Color(0xFFFED7AA);
    return const Color(0xFFBAE6FD);
  }

  String _getRoleTitle(String? role) {
    final r = (role ?? '').toLowerCase();
    if (r == 'operator') return 'Machine Operator';
    if (r == 'quality_engineer' || r == 'inspector') return 'Quality Inspector';
    if (r == 'supervisor') return 'Quality Supervisor';
    if (r == 'admin') return 'System Administrator';
    return 'Station Operator';
  }

  void _showTeamMemberModal(BuildContext context, Map<String, dynamic> member) {
    final fullName = member['full_name'] ?? member['first_name'] ?? member['username'] ?? 'Station Operator';
    final username = member['username'] ?? 'operator';
    final empId = member['employee_id'] ?? 'EMP-OP-01';
    final roleStr = member['role'] ?? 'operator';
    final initials = _getInitials(member);
    final roleColor = _getRoleColor(roleStr);
    final roleTitle = _getRoleTitle(roleStr);

    showModalBottomSheet(
      context: context,
      backgroundColor: const Color(0xFF0F172A),
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (ctx) {
        return Container(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                width: 40,
                height: 4,
                decoration: BoxDecoration(
                  color: const Color(0xFF334155),
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
              const SizedBox(height: 20),
              CircleAvatar(
                radius: 36,
                backgroundColor: roleColor.withValues(alpha: 0.2),
                child: Text(
                  initials,
                  style: TextStyle(
                    color: roleColor,
                    fontWeight: FontWeight.bold,
                    fontSize: 24,
                  ),
                ),
              ),
              const SizedBox(height: 12),
              Text(
                fullName,
                style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 18),
              ),
              const SizedBox(height: 4),
              Text(
                '@$username  •  ID: $empId',
                style: const TextStyle(color: Color(0xFF94A3B8), fontSize: 12),
              ),
              const SizedBox(height: 14),
              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 5),
                    decoration: BoxDecoration(
                      color: roleColor.withValues(alpha: 0.15),
                      borderRadius: BorderRadius.circular(20),
                      border: Border.all(color: roleColor.withValues(alpha: 0.4)),
                    ),
                    child: Text(
                      roleTitle,
                      style: TextStyle(color: roleColor, fontSize: 11, fontWeight: FontWeight.bold),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                    decoration: BoxDecoration(
                      color: const Color(0xFF10B981).withValues(alpha: 0.15),
                      borderRadius: BorderRadius.circular(20),
                      border: Border.all(color: const Color(0xFF10B981).withValues(alpha: 0.4)),
                    ),
                    child: const Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(Icons.wifi_tethering_rounded, color: Color(0xFF10B981), size: 12),
                        SizedBox(width: 4),
                        Text('CONNECTED', style: TextStyle(color: Color(0xFF10B981), fontSize: 10, fontWeight: FontWeight.bold)),
                      ],
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 24),
              ElevatedButton.icon(
                style: ElevatedButton.styleFrom(
                  backgroundColor: roleColor,
                  foregroundColor: Colors.white,
                  minimumSize: const Size(double.infinity, 44),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                ),
                icon: const Icon(Icons.check_circle_rounded, size: 18),
                label: const Text('STATION OPERATOR VERIFIED', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                onPressed: () => Navigator.pop(ctx),
              ),
            ],
          ),
        );
      },
    );
  }

  void _showAddOperatorModal(BuildContext context) {
    showModalBottomSheet(
      context: context,
      backgroundColor: const Color(0xFF0F172A),
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (ctx) {
        return Container(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text(
                    'Connect Operator to Station',
                    style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 16),
                  ),
                  IconButton(
                    icon: const Icon(Icons.close_rounded, color: Color(0xFF94A3B8)),
                    onPressed: () => Navigator.pop(ctx),
                  ),
                ],
              ),
              const SizedBox(height: 8),
              const Text(
                'All operators registered in system are automatically connected to active floor station.',
                style: TextStyle(color: Color(0xFF94A3B8), fontSize: 12),
              ),
              const SizedBox(height: 20),
              ElevatedButton.icon(
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF4F46E5),
                  foregroundColor: Colors.white,
                  minimumSize: const Size(double.infinity, 46),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                ),
                icon: const Icon(Icons.swap_horiz_rounded),
                label: const Text('SWITCH ACTIVE STATION', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                onPressed: () {
                  Navigator.pop(ctx);
                  Navigator.push(
                    context,
                    MaterialPageRoute(builder: (_) => const MachineSelectScreen()),
                  );
                },
              ),
            ],
          ),
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    final auth = Provider.of<AuthProvider>(context);
    final provider = Provider.of<InspectionProvider>(context);

    final name = auth.fullName ?? auth.username ?? 'Operator';
    final firstName = name.split(' ').first;
    final roleTitle = auth.isInspector
        ? 'Quality Inspector'
        : (auth.isOperator ? 'Machine Operator' : 'Supervisor');

    final selectedPart = provider.selectedPart;
    final partNumber = selectedPart?['part_number'] ?? 'FBT00222';

    final unreadNotifCount = _supervisorNotifications.where((n) => n['is_read'] == false).length;

    Widget homeTabContent = RefreshIndicator(
      color: const Color(0xFF4F46E5),
      onRefresh: _loadDashboardData,
      child: SingleChildScrollView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.symmetric(horizontal: 24.0, vertical: 16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // 1. TOP GREETING HEADER & NOTIFICATION BELL
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Hi $firstName,',
                      style: const TextStyle(
                        fontSize: 15,
                        color: Color(0xFF64748B),
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      roleTitle,
                      style: const TextStyle(
                        fontSize: 26,
                        fontWeight: FontWeight.w800,
                        color: Color(0xFF0F172A),
                        letterSpacing: -0.5,
                      ),
                    ),
                  ],
                ),

                // Notification Bell Icon
                GestureDetector(
                  onTap: () => _showNotificationsModal(context),
                  child: Stack(
                    children: [
                      Container(
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(
                          color: Colors.white,
                          shape: BoxShape.circle,
                          boxShadow: [
                            BoxShadow(
                              color: Colors.black.withValues(alpha: 0.08),
                              blurRadius: 10,
                              offset: const Offset(0, 4),
                            )
                          ],
                        ),
                        child: const Icon(Icons.notifications_none_rounded, color: Color(0xFF0F172A), size: 24),
                      ),
                      if (unreadNotifCount > 0)
                        Positioned(
                          right: 2,
                          top: 2,
                          child: Container(
                            padding: const EdgeInsets.all(4),
                            decoration: const BoxDecoration(
                              color: Color(0xFFEF4444),
                              shape: BoxShape.circle,
                            ),
                            constraints: const BoxConstraints(
                              minWidth: 18,
                              minHeight: 18,
                            ),
                            child: Text(
                              '$unreadNotifCount',
                              style: const TextStyle(
                                color: Colors.white,
                                fontSize: 10,
                                fontWeight: FontWeight.bold,
                              ),
                              textAlign: TextAlign.center,
                            ),
                          ),
                        ),
                    ],
                  ),
                ),
              ],
            ),

            const SizedBox(height: 24),

            // 2. FEATURE MODULES TITLE
            const Text(
              'Consoles & Inspection Modules',
              style: TextStyle(
                fontSize: 14,
                fontWeight: FontWeight.w600,
                color: Color(0xFF64748B),
              ),
            ),

            const SizedBox(height: 16),

            // 3. CORE MODULE CARDS GRID
            GridView.count(
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              crossAxisCount: 2,
              crossAxisSpacing: 14,
              mainAxisSpacing: 14,
              childAspectRatio: 1.05,
              children: [
                // Module 1: Machine Selection (Soft Indigo)
                _buildSoftPastelCard(
                  title: 'Machine',
                  description: 'Choose or switch active floor machine',
                  icon: Icons.precision_manufacturing_rounded,
                  bgColor: const Color(0xFFF0F3FF),
                  borderColor: const Color(0xFFE0E7FF),
                  iconColor: const Color(0xFF4F46E5),
                  onTap: () {
                    Navigator.push(
                      context,
                      MaterialPageRoute(builder: (_) => const MachineSelectScreen()),
                    );
                  },
                ),

                // Module 2: Process Inspection (Operator) OR Setup Approval Report (Inspector / Supervisor)
                if (auth.isOperator)
                  _buildSoftPastelCard(
                    title: 'Process Inspection',
                    description: 'Select & start process inspection operations',
                    icon: Icons.fact_check_rounded,
                    bgColor: const Color(0xFFECFDF5),
                    borderColor: const Color(0xFFA7F3D0),
                    iconColor: const Color(0xFF059669),
                    onTap: () {
                      Navigator.push(
                        context,
                        MaterialPageRoute(builder: (_) => const OperationSelectScreen()),
                      );
                    },
                  )
                else
                  _buildSoftPastelCard(
                    title: 'Setup Approval Report',
                    description: 'View official first piece setup approval report (Form F02)',
                    icon: Icons.assignment_turned_in_rounded,
                    bgColor: const Color(0xFFFAF5FF),
                    borderColor: const Color(0xFFE9D5FF),
                    iconColor: const Color(0xFF9333EA),
                    onTap: () {
                      Navigator.push(
                        context,
                        MaterialPageRoute(builder: (_) => const SetupApprovalReportScreen()),
                      );
                    },
                  ),

                // Module 3: Daily Production Report (Operators Only)
                if (auth.isOperator)
                  _buildSoftPastelCard(
                    title: 'Daily Production Report',
                    description: 'End of shift output, target & breakdown log (Form F19)',
                    icon: Icons.bar_chart_rounded,
                    bgColor: const Color(0xFFFFF7ED),
                    borderColor: const Color(0xFFFFEDD5),
                    iconColor: const Color(0xFFEA580C),
                    onTap: () {
                      Navigator.push(
                        context,
                        MaterialPageRoute(builder: (_) => const DailyProductionReportScreen()),
                      );
                    },
                  ),
              ],
            ),

            const SizedBox(height: 28),

            // 4. "YOUR TEAM & OPERATORS" ROW
            if (!auth.isOperator) ...[
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text(
                    'Your station team',
                    style: TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w600,
                      color: Color(0xFF64748B),
                    ),
                  ),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                    decoration: BoxDecoration(
                      color: const Color(0xFF10B981).withValues(alpha: 0.15),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Text(
                      '${_teamMembers.length} Operators Connected',
                      style: const TextStyle(
                        fontSize: 10,
                        fontWeight: FontWeight.bold,
                        color: Color(0xFF10B981),
                      ),
                    ),
                  ),
                ],
              ),

              const SizedBox(height: 14),

              SizedBox(
                height: 76,
                child: ListView(
                  scrollDirection: Axis.horizontal,
                  children: [
                    _buildAvatarItem(
                      isAdd: true,
                      label: 'Add',
                      onTap: () => _showAddOperatorModal(context),
                    ),

                    const SizedBox(width: 14),

                    ..._teamMembers.map((member) {
                      final initials = _getInitials(member);
                      final name = _getShortName(member);
                      final roleColor = _getRoleColor(member['role']);
                      final imageBg = _getRoleBg(member['role']);

                      return Padding(
                        padding: const EdgeInsets.only(right: 14.0),
                        child: GestureDetector(
                          onTap: () => _showTeamMemberModal(context, member),
                          child: _buildAvatarItem(
                            initials: initials,
                            name: name,
                            roleColor: roleColor,
                            imageBg: imageBg,
                          ),
                        ),
                      );
                    }),
                  ],
                ),
              ),

              const SizedBox(height: 16),
            ],
          ],
        ),
      ),
    );

    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      body: SafeArea(
        child: IndexedStack(
          index: _currentIndex == 1 ? 1 : 0,
          children: [
            homeTabContent,
            const AccountScreen(),
          ],
        ),
      ),

      // FLOATING 2-TAB BOTTOM NAVIGATION BAR (Home & About)
      bottomNavigationBar: Container(
        margin: const EdgeInsets.only(left: 24, right: 24, bottom: 16),
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(30),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.08),
              blurRadius: 20,
              offset: const Offset(0, 6),
            )
          ],
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.spaceAround,
          children: [
            // Tab 1: Home
            InkWell(
              onTap: () => setState(() => _currentIndex = 0),
              borderRadius: BorderRadius.circular(20),
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
                child: Row(
                  children: [
                    Icon(
                      Icons.home_rounded,
                      color: _currentIndex == 0 ? const Color(0xFF4F46E5) : const Color(0xFF94A3B8),
                      size: 22,
                    ),
                    const SizedBox(width: 6),
                    Text(
                      'Home',
                      style: TextStyle(
                        color: _currentIndex == 0 ? const Color(0xFF4F46E5) : const Color(0xFF94A3B8),
                        fontWeight: _currentIndex == 0 ? FontWeight.bold : FontWeight.w600,
                        fontSize: 13,
                      ),
                    ),
                  ],
                ),
              ),
            ),

            // Tab 2: About (Profile & Station details)
            InkWell(
              onTap: () => setState(() => _currentIndex = 1),
              borderRadius: BorderRadius.circular(20),
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
                child: Row(
                  children: [
                    Icon(
                      Icons.person_rounded,
                      color: _currentIndex == 1 ? const Color(0xFF4F46E5) : const Color(0xFF94A3B8),
                      size: 22,
                    ),
                    const SizedBox(width: 6),
                    Text(
                      'About',
                      style: TextStyle(
                        color: _currentIndex == 1 ? const Color(0xFF4F46E5) : const Color(0xFF94A3B8),
                        fontWeight: _currentIndex == 1 ? FontWeight.bold : FontWeight.w600,
                        fontSize: 13,
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

  Widget _buildSoftPastelCard({
    required String title,
    required String description,
    required IconData icon,
    required Color bgColor,
    required Color borderColor,
    required Color iconColor,
    required VoidCallback onTap,
  }) {
    return Container(
      decoration: BoxDecoration(
        color: bgColor,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: borderColor, width: 1.2),
      ),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          borderRadius: BorderRadius.circular(20),
          onTap: onTap,
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Container(
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(12),
                    boxShadow: [
                      BoxShadow(
                        color: iconColor.withValues(alpha: 0.15),
                        blurRadius: 8,
                        offset: const Offset(0, 2),
                      )
                    ],
                  ),
                  child: Icon(icon, color: iconColor, size: 22),
                ),
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      title,
                      style: const TextStyle(
                        fontSize: 15,
                        fontWeight: FontWeight.bold,
                        color: Color(0xFF0F172A),
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      description,
                      style: const TextStyle(
                        fontSize: 11,
                        color: Color(0xFF64748B),
                        height: 1.2,
                      ),
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildAvatarItem({
    bool isAdd = false,
    String? initials,
    String label = '',
    String name = '',
    Color roleColor = Colors.blueAccent,
    Color imageBg = Colors.white,
    VoidCallback? onTap,
  }) {
    if (isAdd) {
      return GestureDetector(
        onTap: onTap,
        child: Column(
          children: [
            Container(
              width: 48,
              height: 48,
              decoration: BoxDecoration(
                color: const Color(0xFFF1F5F9),
                shape: BoxShape.circle,
                border: Border.all(color: const Color(0xFFE2E8F0)),
              ),
              child: const Icon(Icons.add_rounded, color: Color(0xFF64748B), size: 24),
            ),
            const SizedBox(height: 6),
            Text(
              label,
              style: const TextStyle(fontSize: 11, color: Color(0xFF64748B), fontWeight: FontWeight.w500),
            ),
          ],
        ),
      );
    }

    return Column(
      children: [
        Stack(
          children: [
            Container(
              width: 48,
              height: 48,
              decoration: BoxDecoration(
                color: imageBg,
                shape: BoxShape.circle,
                border: Border.all(color: roleColor.withValues(alpha: 0.3)),
              ),
              child: Center(
                child: Text(
                  initials ?? 'U',
                  style: TextStyle(color: roleColor, fontWeight: FontWeight.bold, fontSize: 15),
                ),
              ),
            ),
            Positioned(
              right: 0,
              bottom: 0,
              child: Container(
                width: 14,
                height: 14,
                decoration: BoxDecoration(
                  color: roleColor,
                  shape: BoxShape.circle,
                  border: Border.all(color: Colors.white, width: 2),
                ),
              ),
            ),
          ],
        ),
        const SizedBox(height: 6),
        Text(
          name,
          style: const TextStyle(fontSize: 11, color: Color(0xFF0F172A), fontWeight: FontWeight.w600),
        ),
      ],
    );
  }

  Widget _buildBottomNavItem({required IconData icon, required bool isSelected, required VoidCallback onTap}) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.all(10),
        child: Icon(
          icon,
          color: isSelected ? const Color(0xFF4F46E5) : const Color(0xFF94A3B8),
          size: 24,
        ),
      ),
    );
  }
}
