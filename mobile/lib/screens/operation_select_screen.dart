import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../providers/auth_provider.dart';
import '../providers/inspection_provider.dart';
import '../services/api_service.dart';
import 'app_home_screen.dart';
import 'inspection_voice_screen.dart';
import 'machine_select_screen.dart';
import 'parameter_list_screen.dart';

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
    if (trialNumber == 1) {
      await provider.loadParameters(template, isFirstPiece: true, categoryFilter: 'product');
    } else {
      await provider.loadParametersForRetrial(template, trial: trialNumber);
    }

    if (provider.parameters.isEmpty) {
      if (mounted) {
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
            backgroundColor: const Color(0xFFD97706),
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
        elevation: 0,
        scrolledUnderElevation: 0.5,
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(1.0),
          child: Container(color: const Color(0xFFE2E8F0), height: 1.0),
        ),
        iconTheme: const IconThemeData(color: Color(0xFF0F172A)),
        title: Text(
          'Part: ${provider.selectedPart?['part_number'] ?? 'FBT00222'}',
          style: const TextStyle(color: Color(0xFF0F172A), fontWeight: FontWeight.bold, fontSize: 17),
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.home_rounded, color: Color(0xFF64748B)),
            tooltip: 'Go to Home',
            onPressed: () {
              Navigator.pushAndRemoveUntil(
                context,
                MaterialPageRoute(builder: (_) => const AppHomeScreen()),
                (route) => false,
              );
            },
          ),
        ],
      ),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 20.0, vertical: 16.0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // ⚡ LIVE RESUMING CARD (If session is in-progress or app was restarted mid-entry)
              if (provider.sessionId != null || provider.recordedResults.isNotEmpty) ...[
                _buildResumeInspectionCard(provider),
                const SizedBox(height: 12),
              ],

              // Selected Machine & Part Banner
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: const Color(0xFFE2E8F0)),
                  boxShadow: const [
                    BoxShadow(
                      color: Color(0x0A0F172A),
                      blurRadius: 10,
                      offset: Offset(0, 3),
                    )
                  ],
                ),
                child: Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.all(10),
                      decoration: BoxDecoration(
                        color: const Color(0xFFEFF6FF),
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(color: const Color(0xFFDBEAFE)),
                      ),
                      child: const Icon(Icons.build_circle_rounded, color: Color(0xFF2563EB), size: 24),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            provider.selectedMachine?['name'] ?? 'Machine',
                            style: const TextStyle(color: Color(0xFF0F172A), fontWeight: FontWeight.bold, fontSize: 15),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            'Code: ${provider.selectedMachine?['machine_code'] ?? ''}  •  Part: ${provider.selectedPart?['part_name'] ?? provider.selectedPart?['part_number'] ?? '-'}',
                            style: const TextStyle(color: Color(0xFF64748B), fontSize: 12),
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
                        foregroundColor: const Color(0xFF2563EB),
                        side: const BorderSide(color: Color(0xFFBFDBFE)),
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                      ),
                      child: const Text('CHANGE', style: TextStyle(color: Color(0xFF2563EB), fontSize: 11, fontWeight: FontWeight.bold)),
                    ),
                  ],
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
                      color: const Color(0xFFFEF2F2),
                      borderRadius: BorderRadius.circular(14),
                      border: Border.all(color: const Color(0xFFFCA5A5)),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            const Icon(Icons.warning_amber_rounded, color: Color(0xFFDC2626), size: 22),
                            const SizedBox(width: 8),
                            Text(
                              '1ST PC #$currentTrial REJECTED BY SUPERVISOR',
                              style: const TextStyle(color: Color(0xFFDC2626), fontWeight: FontWeight.bold, fontSize: 13),
                            ),
                          ],
                        ),
                        const SizedBox(height: 8),
                        Text(
                          'Remark: "$remark"',
                          style: const TextStyle(color: Color(0xFF451A03), fontSize: 13, fontStyle: FontStyle.italic),
                        ),
                        if (rejectedParams.isNotEmpty) ...[
                          const SizedBox(height: 6),
                          Text(
                            'Targeted Re-entry Params: ${rejectedParams.join(", ")}',
                            style: const TextStyle(color: Color(0xFFB45309), fontSize: 12, fontWeight: FontWeight.bold),
                          ),
                        ],
                        const SizedBox(height: 12),
                        ElevatedButton.icon(
                          style: ElevatedButton.styleFrom(
                            backgroundColor: const Color(0xFFDC2626),
                            foregroundColor: Colors.white,
                            minimumSize: const Size(double.infinity, 42),
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                            elevation: 0,
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
                        color: Color(0xFF475569),
                        fontSize: 11,
                        fontWeight: FontWeight.bold,
                        letterSpacing: 1.0,
                      ),
                    ),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                      decoration: BoxDecoration(
                        color: const Color(0xFFEFF6FF),
                        borderRadius: BorderRadius.circular(6),
                        border: Border.all(color: const Color(0xFFDBEAFE)),
                      ),
                      child: const Text(
                        '1PC ONLY',
                        style: TextStyle(color: Color(0xFF2563EB), fontSize: 10, fontWeight: FontWeight.bold),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 10),
                Row(
                  children: [
                    Expanded(
                      child: _buildTrialLaunchCard(1, '1ST PC #1', 'Initial Setup', const Color(0xFF2563EB)),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: _buildTrialLaunchCard(2, '1ST PC #2', 'Corrective', const Color(0xFFD97706)),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: _buildTrialLaunchCard(3, '1ST PC #3', 'Final Check', const Color(0xFF059669)),
                    ),
                  ],
                ),
              ] else ...[
                const SizedBox(height: 20),
                const Text(
                  'HOURLY IN-PROCESS INSPECTION SLOTS (1/HR - 8/HR)',
                  style: TextStyle(color: Color(0xFF475569), fontSize: 11, fontWeight: FontWeight.bold, letterSpacing: 1.0),
                ),
                const SizedBox(height: 10),

                // Horizontal Hourly Slots Strip
                SizedBox(
                  height: 50,
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
                                content: Text('🔒 Slot $slotNum/HR is already completed & submitted.'),
                                backgroundColor: const Color(0xFFD97706),
                                behavior: SnackBarBehavior.floating,
                              ),
                            );
                          } else if (!isUnlocked) {
                            ScaffoldMessenger.of(context).showSnackBar(
                              SnackBar(
                                content: Text('🔒 Complete Slot ${slotNum - 1}/HR before opening Slot $slotNum/HR.'),
                                backgroundColor: const Color(0xFFD97706),
                                behavior: SnackBarBehavior.floating,
                              ),
                            );
                          } else {
                            provider.setHourlySlot(slotNum);
                            ScaffoldMessenger.of(context).showSnackBar(
                              SnackBar(
                                content: Text('🟢 Slot $slotNum/HR Selected. Tap operation below to record.'),
                                backgroundColor: const Color(0xFF059669),
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
                                ? const Color(0xFFEFF6FF)
                                : isCompleted
                                    ? const Color(0xFFECFDF5)
                                    : isUnlocked
                                        ? Colors.white
                                        : const Color(0xFFF1F5F9),
                            borderRadius: BorderRadius.circular(10),
                            border: Border.all(
                              color: isSelected
                                  ? const Color(0xFF2563EB)
                                  : isCompleted
                                      ? const Color(0xFFA7F3D0)
                                      : isUnlocked
                                          ? const Color(0xFFCBD5E1)
                                          : const Color(0xFFE2E8F0),
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
                                    ? const Color(0xFF2563EB)
                                    : isCompleted
                                        ? const Color(0xFF059669)
                                        : isUnlocked
                                            ? const Color(0xFF0F172A)
                                            : const Color(0xFF94A3B8),
                                size: 18,
                              ),
                              const SizedBox(width: 6),
                              Text(
                                '$slotNum/HR',
                                style: TextStyle(
                                  color: isSelected
                                      ? const Color(0xFF2563EB)
                                      : isCompleted
                                          ? const Color(0xFF059669)
                                          : isUnlocked
                                              ? const Color(0xFF0F172A)
                                              : const Color(0xFF94A3B8),
                                  fontWeight: FontWeight.bold,
                                  fontSize: 13,
                                ),
                              ),
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
                style: const TextStyle(color: Color(0xFF475569), fontSize: 11, fontWeight: FontWeight.bold, letterSpacing: 1.0),
              ),
              const SizedBox(height: 12),

              _isLoading
                  ? const Expanded(
                      child: Center(
                        child: CircularProgressIndicator(color: Color(0xFF2563EB)),
                      ),
                    )
                  : Expanded(
                      child: RefreshIndicator(
                        onRefresh: _loadTemplates,
                        color: const Color(0xFF2563EB),
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
                              color: Colors.white,
                              elevation: 0,
                              margin: const EdgeInsets.only(bottom: 12),
                              shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(14),
                                side: BorderSide(
                                  color: isPublished ? const Color(0xFFA7F3D0) : const Color(0xFFE2E8F0),
                                  width: isPublished ? 1.5 : 1,
                                ),
                              ),
                              child: InkWell(
                                borderRadius: BorderRadius.circular(14),
                                onTap: () {
                                  if (!isInspector && provider.completedHourlySlots.contains(provider.hourlySlot)) {
                                    ScaffoldMessenger.of(context).showSnackBar(
                                      SnackBar(
                                        content: Text('🔒 Slot ${provider.hourlySlot}/HR is already completed & submitted.'),
                                        backgroundColor: const Color(0xFFD97706),
                                        behavior: SnackBarBehavior.floating,
                                      ),
                                    );
                                    return;
                                  }
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
                                        radius: 20,
                                        backgroundColor: isPublished
                                            ? const Color(0xFFECFDF5)
                                            : const Color(0xFFF1F5F9),
                                        child: Text(
                                          '${index + 1}',
                                          style: TextStyle(
                                            color: isPublished ? const Color(0xFF059669) : const Color(0xFF2563EB),
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
                                                    style: const TextStyle(color: Color(0xFF0F172A), fontWeight: FontWeight.bold, fontSize: 15),
                                                    overflow: TextOverflow.ellipsis,
                                                  ),
                                                ),
                                                if (isPublished) ...[
                                                  const SizedBox(width: 6),
                                                  Container(
                                                    padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                                    decoration: BoxDecoration(
                                                      color: const Color(0xFFECFDF5),
                                                      borderRadius: BorderRadius.circular(4),
                                                      border: Border.all(color: const Color(0xFFA7F3D0)),
                                                    ),
                                                    child: const Text('DISPATCHED', style: TextStyle(color: Color(0xFF059669), fontSize: 9, fontWeight: FontWeight.bold)),
                                                  ),
                                                ],
                                              ],
                                            ),
                                            const SizedBox(height: 4),
                                            Row(
                                              children: [
                                                Text(
                                                  isInspector
                                                      ? 'Type: ${t['inspection_type_display'] ?? t['inspection_type']}'
                                                      : 'Type: Hourly (Slot ${provider.hourlySlot}/HR)',
                                                  style: const TextStyle(color: Color(0xFF64748B), fontSize: 12),
                                                ),
                                                const SizedBox(width: 8),
                                                const Text('•', style: TextStyle(color: Color(0xFF94A3B8), fontSize: 12)),
                                                const SizedBox(width: 8),
                                                Text(
                                                  '⚡ $paramCount Params',
                                                  style: const TextStyle(color: Color(0xFF2563EB), fontSize: 12, fontWeight: FontWeight.bold),
                                                ),
                                              ],
                                            ),
                                          ],
                                        ),
                                      ),
                                      const SizedBox(width: 10),
                                      const Icon(Icons.arrow_forward_ios_rounded, color: Color(0xFF2563EB), size: 16),
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
      ),
    );
  }

  /// Starts a Hourly Inspection session (Operator only — Product Parameters).
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

  Widget _buildTrialLaunchCard(int trialNum, String title, String subtitle, Color color) {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 8),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: color.withValues(alpha: 0.4)),
      ),
      child: Column(
        children: [
          Icon(Icons.verified_rounded, color: color, size: 20),
          const SizedBox(height: 4),
          Text(title, style: TextStyle(color: color, fontWeight: FontWeight.bold, fontSize: 11)),
          Text(subtitle, style: const TextStyle(color: Color(0xFF64748B), fontSize: 9)),
          const SizedBox(height: 6),
          SizedBox(
            width: double.infinity,
            child: ElevatedButton(
              onPressed: () {
                final t = _templates.isNotEmpty ? _templates.first : null;
                if (t != null) {
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
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(vertical: 4),
                minimumSize: Size.zero,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(6)),
                elevation: 0,
              ),
              child: Text('START #$trialNum', style: const TextStyle(fontSize: 10, fontWeight: FontWeight.bold)),
            ),
          ),
        ],
      ),
    );
  }

  void _showInspectionTypeSelectionModal(BuildContext context, Map<String, dynamic> template) {
    final opTitle = template['name'] ?? _getOpTitle(template['version'] ?? 10);

    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      isScrollControlled: true,
      builder: (ctx) {
        return Container(
          padding: const EdgeInsets.all(24),
          decoration: const BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
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
                    color: const Color(0xFFCBD5E1),
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
              ),
              const SizedBox(height: 18),
              Text(
                opTitle,
                style: const TextStyle(color: Color(0xFF0F172A), fontWeight: FontWeight.bold, fontSize: 17),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 6),
              const Text(
                'Select Inspection Type',
                style: TextStyle(color: Color(0xFF2563EB), fontWeight: FontWeight.bold, fontSize: 14),
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
                    color: const Color(0xFFEFF6FF),
                    borderRadius: BorderRadius.circular(14),
                    border: Border.all(color: const Color(0xFFBFDBFE)),
                  ),
                  child: Row(
                    children: [
                      Container(
                        width: 42,
                        height: 42,
                        decoration: BoxDecoration(
                          color: const Color(0xFF2563EB),
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
                              style: TextStyle(color: Color(0xFF0F172A), fontWeight: FontWeight.bold, fontSize: 15),
                            ),
                            SizedBox(height: 3),
                            Text(
                              '1PC#1 · 1PC#2 · 1PC#3 Quality Dimensions',
                              style: TextStyle(color: Color(0xFF64748B), fontSize: 12),
                            ),
                          ],
                        ),
                      ),
                      const Icon(Icons.arrow_forward_ios_rounded, color: Color(0xFF2563EB), size: 16),
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
                    color: const Color(0xFFEEF2FF),
                    borderRadius: BorderRadius.circular(14),
                    border: Border.all(color: const Color(0xFFC7D2FE)),
                  ),
                  child: Row(
                    children: [
                      Container(
                        width: 42,
                        height: 42,
                        decoration: BoxDecoration(
                          color: const Color(0xFF4F46E5),
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
                              style: TextStyle(color: Color(0xFF0F172A), fontWeight: FontWeight.bold, fontSize: 15),
                            ),
                            SizedBox(height: 3),
                            Text(
                              '1PC#1 · 1PC#2 · 1PC#3 Process Setup Checks',
                              style: TextStyle(color: Color(0xFF64748B), fontSize: 12),
                            ),
                          ],
                        ),
                      ),
                      const Icon(Icons.arrow_forward_ios_rounded, color: Color(0xFF4F46E5), size: 16),
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

  Widget _buildResumeInspectionCard(InspectionProvider provider) {
    final recordedCount = provider.recordedResults.length;
    final totalCount = provider.parameters.length;
    final slotText = provider.inspectionType == 'first_piece'
        ? '1ST PC #${provider.trialNumber}'
        : 'SLOT ${provider.hourlySlot}/HR';

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: const Color(0xFFEFF6FF),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFF93C5FD), width: 1.5),
        boxShadow: const [
          BoxShadow(
            color: Color(0x0A0F172A),
            blurRadius: 10,
            offset: Offset(0, 3),
          )
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Row(
                children: [
                  Container(
                    padding: const EdgeInsets.all(8),
                    decoration: BoxDecoration(
                      color: const Color(0xFF2563EB),
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: const Icon(Icons.play_circle_fill_rounded, color: Colors.white, size: 20),
                  ),
                  const SizedBox(width: 10),
                  const Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'RESUME LIVE INSPECTION',
                        style: TextStyle(color: Color(0xFF1E40AF), fontWeight: FontWeight.bold, fontSize: 13, letterSpacing: 0.5),
                      ),
                      Text(
                        'In-progress session active',
                        style: TextStyle(color: Color(0xFF3B82F6), fontSize: 11),
                      ),
                    ],
                  ),
                ],
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: const Color(0xFFBFDBFE)),
                ),
                child: Text(
                  slotText,
                  style: const TextStyle(color: Color(0xFF2563EB), fontWeight: FontWeight.bold, fontSize: 11),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Text(
            'Part: ${provider.selectedPart?['part_number'] ?? '—'}  •  Progress: $recordedCount of ${totalCount > 0 ? totalCount : '—'} parameters recorded',
            style: const TextStyle(color: Color(0xFF1E293B), fontSize: 13, fontWeight: FontWeight.w600),
          ),
          const SizedBox(height: 12),
          ElevatedButton.icon(
            onPressed: () {
              Navigator.push(
                context,
                MaterialPageRoute(builder: (_) => const InspectionVoiceScreen()),
              );
            },
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFF2563EB),
              foregroundColor: Colors.white,
              minimumSize: const Size(double.infinity, 44),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
              elevation: 0,
            ),
            icon: const Icon(Icons.arrow_forward_rounded, color: Colors.white, size: 18),
            label: const Text('RESUME DATA ENTRY NOW', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
          ),
        ],
      ),
    );
  }
}
