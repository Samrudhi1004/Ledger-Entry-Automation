import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../providers/auth_provider.dart';
import '../providers/inspection_provider.dart';
import '../services/api_service.dart';
import 'inspection_voice_screen.dart';
import 'machine_select_screen.dart';
import 'report_sheet_screen.dart';
import 'daily_production_report_screen.dart';
import 'login_screen.dart';

class OperatorHomeScreen extends StatefulWidget {
  const OperatorHomeScreen({super.key});

  @override
  State<OperatorHomeScreen> createState() => _OperatorHomeScreenState();
}

class _OperatorHomeScreenState extends State<OperatorHomeScreen> {
  List<dynamic> _templates = [];
  bool _isLoading = true;
  bool _isSetupApproved = true;
  int _activeSlot = 1;
  String _assignedInspectorName = 'Samruddhi Bartakke';

  @override
  void initState() {
    super.initState();
    _loadOperatorTemplates();
  }

  Future<void> _loadOperatorTemplates() async {
    try {
      final provider = Provider.of<InspectionProvider>(context, listen: false);
      
      if (provider.selectedMachine == null) {
        try {
          final machines = await ApiService.getMachines();
          if (machines.isNotEmpty) {
            provider.selectMachine(machines.first);
          } else {
            if (mounted) {
              ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
                content: Text('No machines available. Please select one manually.'),
                backgroundColor: Color(0xFFF59E0B),
              ));
              Navigator.pushReplacement(context, MaterialPageRoute(builder: (_) => const MachineSelectScreen()));
            }
            return;
          }
        } catch (_) {
          if (mounted) {
            ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
              content: Text('Network error. Please select a machine manually.'),
              backgroundColor: Color(0xFFEF4444),
            ));
            Navigator.pushReplacement(context, MaterialPageRoute(builder: (_) => const MachineSelectScreen()));
          }
          return;
        }
      }

      final machineId = provider.selectedMachine?['id'] ?? 1;

      await provider.fetchPendingRejections();

      final setupStatus = await ApiService.checkSetupApproved(machineId);
      final bool hasToday = setupStatus['has_today_report'] == true;
      final bool approved = setupStatus['is_setup_approved'] == true;

      if (hasToday || setupStatus['session_id'] != null) {
        await provider.restoreActiveReportState(setupStatus);
      }

      final int slot = provider.hourlySlot;

      final parts = await ApiService.getPartsByMachine(machineId);

      List<dynamic> rawTemplates = [];
      if (provider.selectedPart != null && provider.selectedPart?['part_number'] != null) {
        rawTemplates = await ApiService.getTemplatesByPart(provider.selectedPart!['part_number']);
      } else if (parts.isNotEmpty) {
        provider.selectPart(parts.first);
        rawTemplates = await ApiService.getTemplatesByPart(parts.first['part_number']);
      } else {
        provider.selectPart({'part_number': 'FBT00222', 'part_name': 'POLY V PULLEY'});
        rawTemplates = await ApiService.getTemplatesByPart('FBT00222');
      }

      final List<dynamic> sorted = List.from(rawTemplates);
      sorted.sort((a, b) {
        final vA = int.tryParse(a['version']?.toString() ?? '0') ?? 0;
        final vB = int.tryParse(b['version']?.toString() ?? '0') ?? 0;
        return vA.compareTo(vB);
      });

      // Fetch assigned Quality Inspector name for this station
      String inspectorName = 'Samruddhi Bartakke';
      try {
        final allUsers = await ApiService.getUsers();
        final inspectors = allUsers.where((u) {
          final r = (u['role'] ?? '').toString().toLowerCase();
          return r == 'quality_engineer' || r == 'inspector';
        }).toList();

        if (inspectors.isNotEmpty) {
          final first = inspectors.first;
          inspectorName = first['full_name'] ?? first['username'] ?? 'Samruddhi Bartakke';
        }
      } catch (_) {}

      if (mounted) {
        setState(() {
          _templates = sorted;
          _isSetupApproved = approved;
          _activeSlot = slot > 0 ? slot : 1;
          _assignedInspectorName = inspectorName;
          _isLoading = false;
        });
      }
    } catch (e) {
      debugPrint('Error loading operator templates: $e');
      if (mounted) {
        setState(() {
          _isLoading = false;
        });
      }
    }
  }

  String _getOpTitle(int version) {
    switch (version) {
      case 10:
        return 'Op 10 — 1st Side Finish Turning (CNC)';
      case 20:
        return 'Op 20 — 2nd Side Finish Turning (CNC)';
      case 30:
        return 'Op 30 — Drilling (VMC)';
      case 40:
        return 'Op 40 — Balancing';
      case 50:
        return 'Op 50 — Powder Coating';
      case 60:
        return 'Op 60 — Final Inspection';
      default:
        return 'Op $version — Custom Production Operation';
    }
  }

  @override
  Widget build(BuildContext context) {
    final auth = Provider.of<AuthProvider>(context);
    final provider = Provider.of<InspectionProvider>(context);

    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 1,
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('Operator Hourly Terminal', style: TextStyle(color: Color(0xFF0F172A), fontSize: 16, fontWeight: FontWeight.bold)),
            Row(
              children: [
                const Icon(Icons.person_rounded, color: Color(0xFF059669), size: 12),
                const SizedBox(width: 4),
                Text(
                  auth.fullName ?? auth.username ?? 'Production Operator',
                  style: const TextStyle(color: Color(0xFF059669), fontSize: 11, fontWeight: FontWeight.bold),
                ),
              ],
            ),
          ],
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh_rounded, color: Color(0xFF10B981)),
            tooltip: 'Refresh Status',
            onPressed: () {
              setState(() { _isLoading = true; });
              _loadOperatorTemplates();
            },
          ),
          IconButton(
            icon: const Icon(Icons.swap_horiz_rounded, color: Color(0xFF38BDF8)),
            tooltip: 'Change Machine',
            onPressed: () {
              Navigator.push(
                context,
                MaterialPageRoute(builder: (_) => const MachineSelectScreen()),
              );
            },
          ),
          IconButton(
            icon: const Icon(Icons.logout_rounded, color: Color(0xFFEF4444)),
            tooltip: 'Logout',
            onPressed: () async {
              await auth.logout();
              provider.logout();
              if (context.mounted) {
                Navigator.pushAndRemoveUntil(
                  context,
                  MaterialPageRoute(builder: (_) => const LoginScreen()),
                  (route) => false,
                );
              }
            },
          ),
        ],
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(20.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Machine & Station Banner Card
            Container(
              padding: const EdgeInsets.all(18),
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  colors: [
                    const Color(0xFF0F172A),
                    const Color(0xFF1E293B).withValues(alpha: 0.6),
                  ],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: const Color(0xFF38BDF8).withValues(alpha: 0.3)),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withValues(alpha: 0.25),
                    blurRadius: 12,
                    offset: const Offset(0, 4),
                  )
                ],
              ),
              child: Row(
                children: [
                  Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: const Color(0xFF10B981).withValues(alpha: 0.15),
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: const Color(0xFF10B981).withValues(alpha: 0.4)),
                    ),
                    child: const Icon(Icons.precision_manufacturing_rounded, color: Color(0xFF10B981), size: 30),
                  ),
                  const SizedBox(width: 14),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          provider.selectedMachine?['name'] ?? 'CNC Turning Center 01',
                          style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 16),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          'Code: ${provider.selectedMachine?['machine_code'] ?? 'CNC-01'}  •  Part: ${provider.selectedPart?['part_number'] ?? 'FBT00222'}',
                          style: const TextStyle(color: Color(0xFF94A3B8), fontSize: 12),
                        ),
                        const SizedBox(height: 6),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                          decoration: BoxDecoration(
                            color: const Color(0xFF38BDF8).withValues(alpha: 0.15),
                            borderRadius: BorderRadius.circular(6),
                            border: Border.all(color: const Color(0xFF38BDF8).withValues(alpha: 0.3)),
                          ),
                          child: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              const Icon(Icons.verified_user_rounded, color: Color(0xFF38BDF8), size: 12),
                              const SizedBox(width: 4),
                              Text(
                                'Quality Inspector: $_assignedInspectorName',
                                style: const TextStyle(color: Color(0xFF38BDF8), fontSize: 11, fontWeight: FontWeight.bold),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                  OutlinedButton(
                    onPressed: () {
                      Navigator.push(
                        context,
                        MaterialPageRoute(builder: (_) => const MachineSelectScreen()),
                      );
                    },
                    style: OutlinedButton.styleFrom(
                      side: const BorderSide(color: Color(0xFF38BDF8)),
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                      minimumSize: Size.zero,
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                    ),
                    child: const Text('CHANGE', style: TextStyle(color: Color(0xFF38BDF8), fontSize: 11, fontWeight: FontWeight.bold)),
                  ),
                ],
              ),
            ),

            const SizedBox(height: 16),

            // Supervisor Correction Request Banner
            if (provider.activeRejections.isNotEmpty) ...[
              ...provider.activeRejections.map((rej) {
                final currentTrial = rej['trial_number'] ?? 1;
                final nextTrial = currentTrial + 1;
                final remark = rej['rejection_reason'] ?? rej['supervisor_remark'] ?? 'Targeted parameter correction requested.';
                final List<dynamic> rejectedParams = rej['rejected_parameters'] ?? [];

                return Container(
                  margin: const EdgeInsets.only(bottom: 14),
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: const Color(0xFFF59E0B).withValues(alpha: 0.15),
                    borderRadius: BorderRadius.circular(14),
                    border: Border.all(color: const Color(0xFFF59E0B), width: 1.5),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          const Icon(Icons.warning_amber_rounded, color: Color(0xFFF59E0B), size: 24),
                          const SizedBox(width: 8),
                          Text(
                            'TARGETED RE-ENTRY REQUEST (1ST PC #$nextTrial)',
                            style: const TextStyle(color: Color(0xFFF59E0B), fontWeight: FontWeight.bold, fontSize: 13),
                          ),
                        ],
                      ),
                      const SizedBox(height: 6),
                      Text(
                        'Supervisor Remark: "$remark"',
                        style: const TextStyle(color: Colors.white, fontSize: 13, fontStyle: FontStyle.italic),
                      ),
                      if (rejectedParams.isNotEmpty) ...[
                        const SizedBox(height: 6),
                        Text(
                          'Targeted Parameters: ${rejectedParams.join(", ")}',
                          style: const TextStyle(color: Color(0xFFFDE68A), fontSize: 12, fontWeight: FontWeight.bold),
                        ),
                      ],
                      const SizedBox(height: 10),
                      Container(
                        padding: const EdgeInsets.all(10),
                        decoration: BoxDecoration(
                          color: const Color(0xFF0F172A),
                          borderRadius: BorderRadius.circular(8),
                          border: Border.all(color: const Color(0xFFF59E0B).withValues(alpha: 0.4)),
                        ),
                        child: Row(
                          children: [
                            const Icon(Icons.info_outline_rounded, color: Color(0xFFF59E0B), size: 16),
                            const SizedBox(width: 8),
                            Expanded(
                              child: Text(
                                'Awaiting Quality Inspector ($_assignedInspectorName) to perform Corrective Trial (1ST PC #$nextTrial). Hourly logging paused.',
                                style: const TextStyle(color: Color(0xFFFDE68A), fontSize: 11),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                );
              }),
            ],

            // First Piece Finalization Status Card
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: const Color(0xFF10B981).withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(14),
                border: Border.all(
                  color: const Color(0xFF10B981),
                  width: 1.5,
                ),
              ),
              child: Row(
                children: [
                  const Icon(
                    Icons.verified_rounded,
                    color: Color(0xFF10B981),
                    size: 32,
                  ),
                  const SizedBox(width: 14),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text(
                          '✓ TODAY\'S INSPECTION REPORT ACTIVE',
                          style: TextStyle(
                            color: Color(0xFF10B981),
                            fontWeight: FontWeight.bold,
                            fontSize: 13,
                          ),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          'Hourly In-Process Inspections (1/HR..${provider.shiftHours}/HR) active & ready for voice entry into the single report.',
                          style: const TextStyle(color: Color(0xFFCBD5E1), fontSize: 12),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 10),
            Row(
              children: [
                Expanded(
                  child: OutlinedButton.icon(
                    onPressed: () {
                      Navigator.push(
                        context,
                        MaterialPageRoute(builder: (_) => const ReportSheetScreen()),
                      );
                    },
                    style: OutlinedButton.styleFrom(
                      foregroundColor: const Color(0xFF10B981),
                      side: const BorderSide(color: Color(0xFF10B981)),
                      padding: const EdgeInsets.symmetric(vertical: 10),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                    ),
                    icon: const Icon(Icons.table_chart_rounded, size: 16),
                    label: const Text('VIEW FORM F02', style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold)),
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: ElevatedButton.icon(
                    onPressed: () {
                      if (provider.completedHourlySlots.length < provider.shiftHours) {
                        ScaffoldMessenger.of(context).showSnackBar(
                          SnackBar(
                            content: Text('🔒 You must complete all ${provider.shiftHours} hourly inspections before submitting the Daily Production Report.'),
                            backgroundColor: const Color(0xFFF59E0B),
                            behavior: SnackBarBehavior.floating,
                          ),
                        );
                        return;
                      }
                      Navigator.push(
                        context,
                        MaterialPageRoute(builder: (_) => const DailyProductionReportScreen()),
                      );
                    },
                    style: ElevatedButton.styleFrom(
                      backgroundColor: provider.completedHourlySlots.length < provider.shiftHours ? const Color(0xFF94A3B8) : const Color(0xFFEA580C),
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(vertical: 10),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                      elevation: provider.completedHourlySlots.length < provider.shiftHours ? 0 : 2,
                    ),
                    icon: Icon(provider.completedHourlySlots.length < provider.shiftHours ? Icons.lock_rounded : Icons.bar_chart_rounded, size: 16),
                    label: const Text('DAILY PRODUCTION', style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold)),
                  ),
                ),
              ],
            ),

            const SizedBox(height: 22),
            Text(
              'HOURLY IN-PROCESS INSPECTION SLOTS (1/HR - ${provider.shiftHours}/HR)',
              style: const TextStyle(color: Color(0xFF94A3B8), fontSize: 12, fontWeight: FontWeight.bold, letterSpacing: 1.1),
            ),
            const SizedBox(height: 12),

            // Horizontal Hourly Slots Strip
            SizedBox(
              height: 52,
              child: ListView.builder(
                scrollDirection: Axis.horizontal,
                itemCount: provider.shiftHours,
                itemBuilder: (context, index) {
                  final slotNum = index + 1;
                  final isUnlocked = provider.isHourlySlotUnlocked(slotNum);
                  final isCompleted = provider.completedHourlySlots.contains(slotNum);
                  final isSelected = provider.hourlySlot == slotNum;

                  return GestureDetector(
                    onTap: () {
                      if (isCompleted) {
                        ScaffoldMessenger.of(context).showSnackBar(
                          SnackBar(
                            content: Text('🔒 Slot $slotNum/HR is already completed & submitted. Rewriting is not allowed.'),
                            backgroundColor: const Color(0xFFF59E0B),
                            behavior: SnackBarBehavior.floating,
                          ),
                        );
                      } else if (!isUnlocked) {
                        ScaffoldMessenger.of(context).showSnackBar(
                          SnackBar(
                            content: Text('🔒 Complete Slot ${slotNum - 1}/HR before opening Slot $slotNum/HR.'),
                            backgroundColor: const Color(0xFFF59E0B),
                            behavior: SnackBarBehavior.floating,
                          ),
                        );
                      } else {
                        provider.setHourlySlot(slotNum);
                        setState(() {
                          _activeSlot = slotNum;
                        });
                        ScaffoldMessenger.of(context).showSnackBar(
                          SnackBar(
                            content: Text('🟢 Slot $slotNum/HR Selected. Tap operation below to record.'),
                            backgroundColor: const Color(0xFF10B981),
                            behavior: SnackBarBehavior.floating,
                          ),
                        );
                      }
                    },
                    child: Container(
                      margin: const EdgeInsets.only(right: 10),
                      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                      decoration: BoxDecoration(
                        color: isSelected
                            ? const Color(0xFF10B981).withValues(alpha: 0.25)
                            : isCompleted
                                ? Colors.blue.withValues(alpha: 0.15)
                                : isUnlocked
                                    ? const Color(0xFF0F172A)
                                    : const Color(0xFF0F172A),
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(
                          color: isSelected
                              ? const Color(0xFF10B981)
                              : isCompleted
                                  ? Colors.blueAccent
                                  : isUnlocked
                                      ? const Color(0xFF334155)
                                      : const Color(0xFF1E293B),
                          width: isSelected ? 2 : 1,
                        ),
                      ),
                      child: Row(
                        children: [
                          Icon(
                            isCompleted
                                ? Icons.check_circle_rounded
                                : isSelected
                                    ? Icons.play_circle_fill_rounded
                                    : isUnlocked
                                        ? Icons.play_arrow_rounded
                                        : Icons.lock_rounded,
                            color: isSelected
                                ? const Color(0xFF10B981)
                                : isCompleted
                                    ? Colors.blueAccent
                                    : isUnlocked
                                        ? Colors.white
                                        : const Color(0xFF64748B),
                            size: 18,
                          ),
                          const SizedBox(width: 8),
                          Text(
                            '$slotNum hr',
                            style: TextStyle(
                              color: isSelected
                                  ? const Color(0xFF10B981)
                                  : isUnlocked
                                      ? Colors.white
                                      : const Color(0xFF64748B),
                              fontWeight: FontWeight.bold,
                              fontSize: 13,
                            ),
                          ),
                          if (isCompleted) ...[
                            const SizedBox(width: 4),
                            const Icon(Icons.check, color: Colors.blueAccent, size: 12),
                          ],
                        ],
                      ),
                    ),
                  );
                },
              ),
            ),

            const SizedBox(height: 24),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text(
                  'HOURLY INSPECTION OPERATIONS',
                  style: TextStyle(color: Color(0xFF94A3B8), fontSize: 12, fontWeight: FontWeight.bold, letterSpacing: 1.1),
                ),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                  decoration: BoxDecoration(
                    color: _isSetupApproved ? const Color(0xFF10B981).withValues(alpha: 0.2) : const Color(0xFFEF4444).withValues(alpha: 0.2),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Text(
                    _isSetupApproved ? 'SLOT $_activeSlot/HR UNLOCKED' : '🔒 LOCKED',
                    style: TextStyle(
                      color: _isSetupApproved ? const Color(0xFF10B981) : const Color(0xFFEF4444),
                      fontSize: 10,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 14),

            _isLoading
                ? const Center(
                    child: Padding(
                      padding: EdgeInsets.all(30.0),
                      child: CircularProgressIndicator(color: Color(0xFF10B981)),
                    ),
                  )
                : ListView.builder(
                    shrinkWrap: true,
                    physics: const NeverScrollableScrollPhysics(),
                    itemCount: _templates.length,
                    itemBuilder: (context, index) {
                      final t = _templates[index];
                      final version = t['version'] ?? 10;
                      final title = _getOpTitle(version);

                      return Container(
                        margin: const EdgeInsets.only(bottom: 14),
                        decoration: BoxDecoration(
                          color: const Color(0xFF0F172A),
                          borderRadius: BorderRadius.circular(16),
                          border: Border.all(
                            color: _isSetupApproved ? const Color(0xFF1E293B) : const Color(0xFFF59E0B).withValues(alpha: 0.3),
                          ),
                          boxShadow: [
                            BoxShadow(
                              color: Colors.black.withValues(alpha: 0.2),
                              blurRadius: 8,
                              offset: const Offset(0, 4),
                            )
                          ],
                        ),
                        child: ListTile(
                          contentPadding: const EdgeInsets.all(16),
                          leading: CircleAvatar(
                            backgroundColor: _isSetupApproved
                                ? const Color(0xFF10B981).withValues(alpha: 0.2)
                                : const Color(0xFFF59E0B).withValues(alpha: 0.2),
                            child: Text(
                              _isSetupApproved ? '$_activeSlot/H' : '🔒',
                              style: TextStyle(
                                color: _isSetupApproved ? const Color(0xFF10B981) : const Color(0xFFF59E0B),
                                fontWeight: FontWeight.bold,
                                fontSize: 12,
                              ),
                            ),
                          ),
                          title: Text(
                            title,
                            style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 15),
                          ),
                          subtitle: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                _isSetupApproved
                                    ? 'Hourly In-Process Inspection  •  Slot $_activeSlot/HR'
                                    : '🔒 Locked until Quality Inspector finalizes 1st Piece Inspection as PASSED',
                                style: TextStyle(
                                  color: _isSetupApproved ? const Color(0xFF64748B) : const Color(0xFFF59E0B),
                                  fontSize: 12,
                                ),
                              ),
                              const SizedBox(height: 4),
                              Row(
                                children: [
                                  const Icon(Icons.verified_user_rounded, color: Color(0xFF38BDF8), size: 12),
                                  const SizedBox(width: 4),
                                  Text(
                                    'Quality Inspector: $_assignedInspectorName',
                                    style: const TextStyle(color: Color(0xFF38BDF8), fontSize: 11, fontWeight: FontWeight.bold),
                                  ),
                                ],
                              ),
                            ],
                          ),
                          trailing: Icon(
                            _isSetupApproved ? Icons.edit_note_rounded : Icons.lock_rounded,
                            color: _isSetupApproved ? const Color(0xFF10B981) : const Color(0xFFF59E0B),
                          ),
                          onTap: () async {
                            if (!_isSetupApproved && provider.completedHourlySlots.isEmpty) {
                              ScaffoldMessenger.of(context).showSnackBar(
                                const SnackBar(
                                  content: Text('🔒 Hourly inspections are locked. Waiting for Quality Inspector First Piece finalization.'),
                                  backgroundColor: Color(0xFFF59E0B),
                                  behavior: SnackBarBehavior.floating,
                                ),
                              );
                              return;
                            }

                            if (provider.completedHourlySlots.contains(_activeSlot)) {
                              ScaffoldMessenger.of(context).showSnackBar(
                                SnackBar(
                                  content: Text('🔒 Slot $_activeSlot/HR is already completed & submitted. Rewriting is not allowed.'),
                                  backgroundColor: const Color(0xFFF59E0B),
                                  behavior: SnackBarBehavior.floating,
                                ),
                              );
                              return;
                            }

                            await provider.loadParameters(t);
                            final started = await provider.startSession(
                              trial: 1,
                              inspectionType: 'hourly',
                              hourlySlot: _activeSlot,
                            );
                            if (started && context.mounted) {
                              Navigator.push(
                                context,
                                MaterialPageRoute(builder: (_) => const InspectionVoiceScreen()),
                              );
                            } else if (context.mounted) {
                              ScaffoldMessenger.of(context).showSnackBar(
                                SnackBar(
                                  content: Text('Cannot start hourly inspection: ${provider.errorMessage ?? "Awaiting 1st Piece finalization."}'),
                                  backgroundColor: const Color(0xFFEF4444),
                                ),
                              );
                            }
                          },
                        ),
                      );
                    },
                  ),
          ],
        ),
      ),
    );
  }
}
