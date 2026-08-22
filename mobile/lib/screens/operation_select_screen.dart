import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../providers/auth_provider.dart';
import '../providers/inspection_provider.dart';
import '../services/api_service.dart';
import 'app_home_screen.dart';
import 'inspection_voice_screen.dart';
import 'machine_select_screen.dart';
import 'login_screen.dart';
import 'parameter_list_screen.dart';
import 'daily_production_report_screen.dart';

class OperationSelectScreen extends StatefulWidget {
  const OperationSelectScreen({super.key});

  @override
  State<OperationSelectScreen> createState() => _OperationSelectScreenState();
}

class _OperationSelectScreenState extends State<OperationSelectScreen> {
  List<dynamic> _templates = [];
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _loadTemplates();
  }

  Future<void> _loadTemplates() async {
    try {
      final provider = Provider.of<InspectionProvider>(context, listen: false);
      final machineId = provider.selectedMachine?['id'] ?? 2;

      await provider.fetchPendingRejections();

      try {
        final setupStatus = await ApiService.checkSetupApproved(machineId);
        if (setupStatus['has_today_report'] == true || setupStatus['session_id'] != null) {
          await provider.restoreActiveReportState(setupStatus);
        }
      } catch (_) {}

      List<dynamic> rawTemplates = [];
      if (provider.selectedPart != null && provider.selectedPart?['part_number'] != null) {
        rawTemplates = await ApiService.getTemplatesByPart(provider.selectedPart!['part_number']);
      } else {
        final parts = await ApiService.getPartsByMachine(machineId);
        if (parts.isNotEmpty) {
          provider.selectPart(parts.first);
          rawTemplates = await ApiService.getTemplatesByPart(parts.first['part_number']);
        } else {
          provider.selectPart({'part_number': 'FBT00222', 'part_name': 'POLY V PULLEY'});
          rawTemplates = await ApiService.getTemplatesByPart('FBT00222');
        }
      }

      final List<dynamic> sorted = List.from(rawTemplates);
      sorted.sort((a, b) {
        final vA = int.tryParse(a['version']?.toString() ?? '0') ?? 0;
        final vB = int.tryParse(b['version']?.toString() ?? '0') ?? 0;
        return vA.compareTo(vB);
      });

      if (mounted) {
        setState(() {
          _templates = sorted;
          _isLoading = false;
        });
      }
    } catch (e) {
      debugPrint('Error loading templates: $e');
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
        return 'Op $version — Custom Operation';
    }
  }

  Future<void> _startFpiTrial(Map<String, dynamic> template, int trialNumber) async {
    final provider = Provider.of<InspectionProvider>(context, listen: false);
    // Always load PRODUCT parameters only for the normal FPI flow.
    // Process Parameters belong exclusively to Setup Approval (separate screen).
    if (trialNumber == 1) {
      await provider.loadParameters(template, isFirstPiece: true, categoryFilter: 'product');
    } else {
      await provider.loadParametersForRetrial(template, trial: trialNumber);
    }

    if (provider.parameters.isEmpty) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('⚠️ No product parameters found for this operation. Please configure parameters in the master setup first.'),
            backgroundColor: Colors.orangeAccent,
            behavior: SnackBarBehavior.floating,
          ),
        );
      }
      return;
    }

    // If a session is already active (e.g. restored on login), skip creating a new one
    // to prevent duplicate sessions and the double-submit bug.
    if (provider.sessionId != null && trialNumber == provider.trialNumber) {
      if (mounted) {
        Navigator.push(context, MaterialPageRoute(builder: (_) => const InspectionVoiceScreen()));
      }
      return;
    }

    final started = await provider.startSession(trial: trialNumber, inspectionType: 'first_piece');
    if (started && mounted) {
      if (trialNumber > 1) {
        final count = provider.parameters.length;
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('🎯 Corrective Trial 1ST PC #$trialNumber: Re-measuring $count failed parameter(s).'),
            backgroundColor: const Color(0xFFF59E0B),
            behavior: SnackBarBehavior.floating,
          ),
        );
      }
      Navigator.push(context, MaterialPageRoute(builder: (_) => const InspectionVoiceScreen()));
    } else if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Failed to start 1st Piece trial #$trialNumber: ${provider.errorMessage ?? "Server error"}'),
          backgroundColor: Colors.redAccent,
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final provider = Provider.of<InspectionProvider>(context);
    final auth = Provider.of<AuthProvider>(context);
    final isInspector = auth.isInspector;

    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 1,
        iconTheme: const IconThemeData(color: Color(0xFF0F172A)),
        title: Text(
          'Part: ${provider.selectedPart?['part_number'] ?? 'FBT00222'}',
          style: const TextStyle(color: Color(0xFF0F172A), fontWeight: FontWeight.bold),
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.home_rounded, color: Color(0xFF2563EB)),
            tooltip: 'Go to Home',
            onPressed: () {
              Navigator.pushAndRemoveUntil(
                context,
                MaterialPageRoute(builder: (_) => const AppHomeScreen()),
                (route) => false,
              );
            },
          ),
          IconButton(
            icon: const Icon(Icons.swap_horiz_rounded, color: Colors.blueAccent),
            tooltip: 'Change Machine / Station',
            onPressed: () {
              Navigator.push(
                context,
                MaterialPageRoute(builder: (_) => const MachineSelectScreen()),
              );
            },
          ),
          IconButton(
            icon: const Icon(Icons.logout_rounded, color: Colors.redAccent),
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
      body: Padding(
        padding: const EdgeInsets.all(20.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Selected Machine Banner
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: const Color(0xFF0D1424),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: const Color(0xFF1E293B)),
              ),
              child: Row(
                children: [
                  const Icon(Icons.build_circle_rounded, color: Colors.blueAccent, size: 32),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          provider.selectedMachine?['name'] ?? 'Machine',
                          style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 16),
                        ),
                        Text(
                          'Code: ${provider.selectedMachine?['machine_code'] ?? ''}  •  Part: ${provider.selectedPart?['part_name'] ?? provider.selectedPart?['part_number'] ?? '-'}',
                          style: const TextStyle(color: Colors.blueGrey, fontSize: 13),
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
                      side: const BorderSide(color: Colors.blueAccent),
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                    ),
                    child: const Text('CHANGE', style: TextStyle(color: Colors.blueAccent, fontSize: 11, fontWeight: FontWeight.bold)),
                  ),
                ],
              ),
            ),

            // Daily Production Report Button for Operator / Quality Engineer
            const SizedBox(height: 10),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton.icon(
                onPressed: () {
                  Navigator.push(
                    context,
                    MaterialPageRoute(builder: (_) => const DailyProductionReportScreen()),
                  );
                },
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFFEA580C),
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(vertical: 11),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                  elevation: 2,
                ),
                icon: const Icon(Icons.assessment_rounded, size: 18),
                label: const Text(
                  'ADD DAILY PRODUCTION REPORT (END OF SHIFT)',
                  style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, letterSpacing: 0.5),
                ),
              ),
            ),

            // Active Supervisor Rejection Banner (If any session was rejected)
            if (provider.activeRejections.isNotEmpty) ...[
              const SizedBox(height: 16),
              ...provider.activeRejections.map((rej) {
                final currentTrial = rej['trial_number'] ?? 1;
                final nextTrial = currentTrial + 1;
                final remark = rej['rejection_reason'] ?? rej['supervisor_remark'] ?? 'Correction required by supervisor.';
                final List<dynamic> rejectedParams = rej['rejected_parameters'] ?? [];

                return Container(
                  margin: const EdgeInsets.only(bottom: 12),
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: Colors.redAccent.withValues(alpha: 0.15),
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: Colors.redAccent, width: 1.5),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          const Icon(Icons.warning_amber_rounded, color: Colors.redAccent, size: 24),
                          const SizedBox(width: 8),
                          Text(
                            '1ST PC #$currentTrial REJECTED BY SUPERVISOR',
                            style: const TextStyle(color: Colors.redAccent, fontWeight: FontWeight.bold, fontSize: 13),
                          ),
                        ],
                      ),
                      const SizedBox(height: 8),
                      Text(
                        'Remark: "$remark"',
                        style: const TextStyle(color: Colors.white, fontSize: 13, fontStyle: FontStyle.italic),
                      ),
                      if (rejectedParams.isNotEmpty) ...[
                        const SizedBox(height: 6),
                        Text(
                          'Targeted Re-entry Params: ${rejectedParams.join(", ")}',
                          style: const TextStyle(color: Colors.amberAccent, fontSize: 12, fontWeight: FontWeight.bold),
                        ),
                      ],
                      const SizedBox(height: 12),
                      ElevatedButton.icon(
                        style: ElevatedButton.styleFrom(
                          backgroundColor: Colors.redAccent,
                          minimumSize: const Size(double.infinity, 42),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                        ),
                        icon: const Icon(Icons.play_arrow_rounded, color: Colors.white),
                        label: Text(
                          'START CORRECTIVE TRIAL (1ST PC #$nextTrial)',
                          style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 13),
                        ),
                        onPressed: () async {
                          List<dynamic> templates = _templates;
                          if (templates.isEmpty) {
                            final partNo = provider.selectedPart?['part_number'] ?? 'FBT00222';
                            templates = await ApiService.getTemplatesByPart(partNo);
                          }

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
                            );
                            if (started && context.mounted) {
                              Navigator.push(
                                context,
                                MaterialPageRoute(builder: (_) => const InspectionVoiceScreen()),
                              );
                            } else if (context.mounted) {
                              ScaffoldMessenger.of(context).showSnackBar(
                                SnackBar(
                                  content: Text('Failed to start corrective session: ${provider.errorMessage ?? "Server error"}'),
                                  backgroundColor: Colors.redAccent,
                                ),
                              );
                            }
                          } else if (context.mounted) {
                            ScaffoldMessenger.of(context).showSnackBar(
                              const SnackBar(
                                content: Text('No active template found for corrective trial.'),
                                backgroundColor: Colors.amber,
                              ),
                            );
                          }
                        },
                      )
                    ],
                  ),
                );
              }),
            ],

            if (isInspector) ...[
              const SizedBox(height: 20),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text(
                    'FIRST PIECE INSPECTION TRIALS',
                    style: TextStyle(
                      color: Color(0xFF38BDF8),
                      fontSize: 12,
                      fontWeight: FontWeight.w900,
                      letterSpacing: 1.0,
                    ),
                  ),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                    decoration: BoxDecoration(
                      color: const Color(0xFF38BDF8).withValues(alpha: 0.15),
                      borderRadius: BorderRadius.circular(6),
                      border: Border.all(color: const Color(0xFF38BDF8).withValues(alpha: 0.4)),
                    ),
                    child: const Text(
                      '1PC ONLY',
                      style: TextStyle(color: Color(0xFF38BDF8), fontSize: 10, fontWeight: FontWeight.bold),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 10),
              Row(
                children: [
                  Expanded(
                    child: _buildTrialLaunchCard(1, '1ST PC #1', 'Initial Setup', const Color(0xFF38BDF8)),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: _buildTrialLaunchCard(2, '1ST PC #2', 'Corrective', const Color(0xFFF59E0B)),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: _buildTrialLaunchCard(3, '1ST PC #3', 'Final Check', const Color(0xFF10B981)),
                  ),
                ],
              ),
            ] else ...[
              const SizedBox(height: 20),
              const Text(
                'HOURLY IN-PROCESS INSPECTION SLOTS (1/HR - 8/HR)',
                style: TextStyle(color: Colors.blueGrey, fontSize: 12, fontWeight: FontWeight.bold, letterSpacing: 1.2),
              ),
              const SizedBox(height: 10),

              // Horizontal Hourly Slots Strip
              SizedBox(
                height: 52,
                child: ListView.builder(
                  scrollDirection: Axis.horizontal,
                  itemCount: 8,
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
                              backgroundColor: Colors.orangeAccent,
                              behavior: SnackBarBehavior.floating,
                            ),
                          );
                        } else if (!isUnlocked) {
                          ScaffoldMessenger.of(context).showSnackBar(
                            SnackBar(
                              content: Text('🔒 Complete Slot ${slotNum - 1}/HR before opening Slot $slotNum/HR.'),
                              backgroundColor: Colors.orangeAccent,
                              behavior: SnackBarBehavior.floating,
                            ),
                          );
                        } else {
                          provider.setHourlySlot(slotNum);
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
                        margin: const EdgeInsets.only(right: 8),
                        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                        decoration: BoxDecoration(
                          color: isSelected
                              ? const Color(0xFF10B981).withValues(alpha: 0.2)
                              : isCompleted
                                  ? Colors.blue.withValues(alpha: 0.12)
                                  : isUnlocked
                                      ? const Color(0xFF0D1424)
                                      : const Color(0xFF060911),
                          borderRadius: BorderRadius.circular(10),
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
                                          : Colors.blueGrey,
                              size: 18,
                            ),
                            const SizedBox(width: 6),
                            Text(
                              '$slotNum/HR',
                              style: TextStyle(
                                color: isSelected
                                    ? const Color(0xFF10B981)
                                    : isUnlocked
                                        ? Colors.white
                                        : Colors.blueGrey,
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
            ],

            const SizedBox(height: 20),
            Text(
              isInspector ? 'SELECT OPERATION FOR 1ST PIECE INSPECTION' : 'SELECT PROCESS OPERATION TO INSPECT',
              style: const TextStyle(color: Colors.blueGrey, fontSize: 12, fontWeight: FontWeight.bold, letterSpacing: 1.2),
            ),
            const SizedBox(height: 12),

            _isLoading
                ? const Expanded(
                    child: Center(
                      child: CircularProgressIndicator(color: Colors.blueAccent),
                    ),
                  )
                : Expanded(
                    child: RefreshIndicator(
                      onRefresh: _loadTemplates,
                      color: Colors.blueAccent,
                      backgroundColor: const Color(0xFF0D1424),
                      child: ListView.builder(
                        physics: const AlwaysScrollableScrollPhysics(),
                        itemCount: _templates.length,
                        itemBuilder: (context, index) {
                          final t = _templates[index];
                          final version = t['version'] ?? 10;
                          final customName = t['name']?.toString().trim();
                          final title = (customName != null && customName.isNotEmpty)
                              ? customName
                              : _getOpTitle(version);
                          final paramCount = t['configured_parameter_count'] ?? t['target_parameter_count'] ?? 18;
                          final isPublished = t['is_published'] == true || t['is_active'] == true;

                          return Card(
                            color: const Color(0xFF0D1424),
                            margin: const EdgeInsets.only(bottom: 12),
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(14),
                              side: BorderSide(
                                color: isPublished ? const Color(0xFF10B981).withValues(alpha: 0.6) : const Color(0xFF1E293B),
                                width: isPublished ? 1.5 : 1,
                              ),
                            ),
                            child: InkWell(
                              borderRadius: BorderRadius.circular(14),
                              onTap: () {
                                if (!isInspector && provider.completedHourlySlots.contains(provider.hourlySlot)) {
                                  ScaffoldMessenger.of(context).showSnackBar(
                                    SnackBar(
                                      content: Text('🔒 Slot ${provider.hourlySlot}/HR is already completed & submitted. Rewriting is not allowed.'),
                                      backgroundColor: Colors.orangeAccent,
                                      behavior: SnackBarBehavior.floating,
                                    ),
                                  );
                                  return;
                                }
                                // For Inspectors: go straight to FPI voice entry (Product Params only).
                                // For Operators: go straight to Hourly Product Param entry.
                                // Process Parameters ONLY appear in the Setup Approval screen.
                                if (isInspector) {
                                  _showInspectionTypeSelectionModal(context, t);
                                } else {
                                  _startHourlyInspection(context, t);
                                }
                              },
                              child: Padding(
                                padding: const EdgeInsets.all(16),
                                child: Row(
                                  children: [
                                    CircleAvatar(
                                      radius: 22,
                                      backgroundColor: isPublished
                                          ? const Color(0xFF10B981).withValues(alpha: 0.15)
                                          : const Color(0xFF131D30),
                                      child: Text(
                                        '${index + 1}',
                                        style: TextStyle(
                                          color: isPublished ? const Color(0xFF10B981) : Colors.blueAccent,
                                          fontWeight: FontWeight.bold,
                                          fontSize: 14,
                                        ),
                                      ),
                                    ),
                                    const SizedBox(width: 14),
                                    Expanded(
                                      child: Column(
                                        crossAxisAlignment: CrossAxisAlignment.start,
                                        children: [
                                          Row(
                                            children: [
                                              Expanded(
                                                child: Text(
                                                  title,
                                                  style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 15),
                                                  overflow: TextOverflow.ellipsis,
                                                ),
                                              ),
                                              if (isPublished) ...[
                                                const SizedBox(width: 6),
                                                Container(
                                                  padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                                  decoration: BoxDecoration(
                                                    color: const Color(0xFF10B981).withValues(alpha: 0.15),
                                                    borderRadius: BorderRadius.circular(4),
                                                    border: Border.all(color: const Color(0xFF10B981).withValues(alpha: 0.5)),
                                                  ),
                                                  child: const Text('DISPATCHED', style: TextStyle(color: Color(0xFF10B981), fontSize: 9, fontWeight: FontWeight.bold)),
                                                ),
                                              ],
                                            ],
                                          ),
                                          const SizedBox(height: 4),
                                          Row(
                                            children: [
                                              Text(
                                                'Type: ${t['inspection_type_display'] ?? t['inspection_type']}',
                                                style: const TextStyle(color: Colors.blueGrey, fontSize: 12),
                                              ),
                                              const SizedBox(width: 8),
                                              const Text('•', style: TextStyle(color: Colors.blueGrey, fontSize: 12)),
                                              const SizedBox(width: 8),
                                              Text(
                                                '⚡ $paramCount Params',
                                                style: const TextStyle(color: Color(0xFF38BDF8), fontSize: 12, fontWeight: FontWeight.bold),
                                              ),
                                            ],
                                          ),
                                        ],
                                      ),
                                    ),
                                    const SizedBox(width: 10),
                                    const Icon(Icons.arrow_forward_ios_rounded, color: Colors.blueAccent, size: 16),
                                  ],
                                ),
                              ),
                            ),
                          );
                        },
                      ),
                    ),
                  ),
          ],
        ),
      ),
    );
  }

  Widget _buildTrialLaunchCard(int trialNum, String title, String subtitle, Color color) {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 8),
      decoration: BoxDecoration(
        color: const Color(0xFF0F172A),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: color.withValues(alpha: 0.4)),
      ),
      child: Column(
        children: [
          Icon(Icons.verified_rounded, color: color, size: 20),
          const SizedBox(height: 4),
          Text(title, style: TextStyle(color: color, fontWeight: FontWeight.bold, fontSize: 11)),
          Text(subtitle, style: const TextStyle(color: Colors.blueGrey, fontSize: 9)),
          const SizedBox(height: 6),
          SizedBox(
            width: double.infinity,
            child: ElevatedButton(
              onPressed: () {
                final t = _templates.isNotEmpty ? _templates.first : null;
                if (t != null) {
                  // Always start with product parameters only.
                  // Process Parameters → Setup Approval screen (Inspector Home).
                  _startFpiTrial(t, trialNum);
                } else {
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(
                      content: Text('No active template found to start trial.'),
                      backgroundColor: Colors.orangeAccent,
                    ),
                  );
                }
              },
              style: ElevatedButton.styleFrom(
                backgroundColor: color,
                foregroundColor: (color == const Color(0xFFF59E0B) || color == const Color(0xFF38BDF8))
                    ? Colors.black
                    : Colors.white,
                padding: const EdgeInsets.symmetric(vertical: 4),
                minimumSize: Size.zero,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(6)),
              ),
              child: Text('START #$trialNum', style: const TextStyle(fontSize: 10, fontWeight: FontWeight.bold)),
            ),
          ),
        ],
      ),
    );
  }

  /// Starts a Hourly Inspection session (Operator only — Product Parameters, no process params).
  Future<void> _startHourlyInspection(BuildContext context, Map<String, dynamic> template) async {
    final provider = Provider.of<InspectionProvider>(context, listen: false);
    await provider.loadParameters(template, isFirstPiece: false, categoryFilter: 'product');

    if (provider.parameters.isEmpty) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('⚠️ No product parameters found for this operation.'),
            backgroundColor: Colors.orangeAccent,
            behavior: SnackBarBehavior.floating,
          ),
        );
      }
      return;
    }

    final started = await provider.startSession(
      inspectionType: 'hourly',
      hourlySlot: provider.hourlySlot,
    );
    if (started && context.mounted) {
      Navigator.push(context, MaterialPageRoute(builder: (_) => const InspectionVoiceScreen()));
    } else if (context.mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Failed to start hourly session: ${provider.errorMessage ?? "Server error"}'),
          backgroundColor: Colors.redAccent,
        ),
      );
    }
  }

  /// Shows the Part 1 Required Popup for Inspectors:
  ///   ┌───────────────────────────────┐
  ///   │ Select Inspection Type        │
  ///   │                               │
  ///   │ [ Product Parameters ]        │
  ///   │ [ Process Parameters ]        │
  ///   └───────────────────────────────┘
  void _showInspectionTypeSelectionModal(BuildContext context, Map<String, dynamic> template) {
    final opTitle = template['name'] ?? _getOpTitle(template['version'] ?? 10);

    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      isScrollControlled: true,
      builder: (ctx) {
        return Container(
          padding: const EdgeInsets.all(24),
          decoration: BoxDecoration(
            color: const Color(0xFF0F172A),
            borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
            border: Border.all(color: const Color(0xFF38BDF8), width: 1.5),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(alpha: 0.5),
                blurRadius: 20,
                spreadRadius: 5,
              ),
            ],
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Center(
                child: Container(
                  width: 44,
                  height: 4,
                  decoration: BoxDecoration(
                    color: Colors.blueGrey.withValues(alpha: 0.6),
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
              ),
              const SizedBox(height: 18),
              Text(
                opTitle,
                style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 17),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 6),
              const Text(
                'Select Inspection Type',
                style: TextStyle(color: Color(0xFF38BDF8), fontWeight: FontWeight.bold, fontSize: 15),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 22),

              // 1) PRODUCT PARAMETERS BUTTON
              InkWell(
                borderRadius: BorderRadius.circular(14),
                onTap: () {
                  Navigator.pop(ctx);
                  final provider = Provider.of<InspectionProvider>(context, listen: false);
                  provider.selectedTemplate = template;
                  Navigator.push(
                    context,
                    MaterialPageRoute(
                      builder: (_) => ParameterListScreen(template: template, initialCategory: 'product'),
                    ),
                  );
                },
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                  decoration: BoxDecoration(
                    gradient: const LinearGradient(
                      colors: [Color(0xFF0284C7), Color(0xFF0369A1)],
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                    ),
                    borderRadius: BorderRadius.circular(14),
                    border: Border.all(color: const Color(0xFF38BDF8), width: 1.5),
                    boxShadow: [
                      BoxShadow(
                        color: const Color(0xFF0284C7).withValues(alpha: 0.35),
                        blurRadius: 8,
                        offset: const Offset(0, 4),
                      ),
                    ],
                  ),
                  child: Row(
                    children: [
                      Container(
                        width: 42,
                        height: 42,
                        decoration: BoxDecoration(
                          color: Colors.white.withValues(alpha: 0.15),
                          borderRadius: BorderRadius.circular(10),
                        ),
                        child: const Icon(Icons.straighten_rounded, color: Colors.white, size: 24),
                      ),
                      const SizedBox(width: 14),
                      const Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Text(
                              'Product Parameters',
                              style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 16),
                            ),
                            SizedBox(height: 3),
                            Text(
                              '1PC#1 · 1PC#2 · 1PC#3 Quality Dimensions',
                              style: TextStyle(color: Color(0xFFBAE6FD), fontSize: 12),
                            ),
                          ],
                        ),
                      ),
                      const Icon(Icons.arrow_forward_ios_rounded, color: Colors.white, size: 16),
                    ],
                  ),
                ),
              ),

              const SizedBox(height: 14),

              // 2) PROCESS PARAMETERS BUTTON
              InkWell(
                borderRadius: BorderRadius.circular(14),
                onTap: () {
                  Navigator.pop(ctx);
                  final provider = Provider.of<InspectionProvider>(context, listen: false);
                  provider.selectedTemplate = template;
                  Navigator.push(
                    context,
                    MaterialPageRoute(
                      builder: (_) => ParameterListScreen(template: template, initialCategory: 'process'),
                    ),
                  );
                },
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                  decoration: BoxDecoration(
                    gradient: const LinearGradient(
                      colors: [Color(0xFF312E81), Color(0xFF4338CA)],
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                    ),
                    borderRadius: BorderRadius.circular(14),
                    border: Border.all(color: const Color(0xFF818CF8), width: 1.5),
                    boxShadow: [
                      BoxShadow(
                        color: const Color(0xFF4338CA).withValues(alpha: 0.35),
                        blurRadius: 8,
                        offset: const Offset(0, 4),
                      ),
                    ],
                  ),
                  child: Row(
                    children: [
                      Container(
                        width: 42,
                        height: 42,
                        decoration: BoxDecoration(
                          color: Colors.white.withValues(alpha: 0.15),
                          borderRadius: BorderRadius.circular(10),
                        ),
                        child: const Icon(Icons.settings_suggest_rounded, color: Colors.white, size: 24),
                      ),
                      const SizedBox(width: 14),
                      const Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Text(
                              'Process Parameters',
                              style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 16),
                            ),
                            SizedBox(height: 3),
                            Text(
                              '1PC#1 · 1PC#2 · 1PC#3 Process Setup Checks',
                              style: TextStyle(color: Color(0xFFC7D2FE), fontSize: 12),
                            ),
                          ],
                        ),
                      ),
                      const Icon(Icons.arrow_forward_ios_rounded, color: Colors.white, size: 16),
                    ],
                  ),
                ),
              ),

              const SizedBox(height: 12),
            ],
          ),
        );
      },
    );
  }
}
