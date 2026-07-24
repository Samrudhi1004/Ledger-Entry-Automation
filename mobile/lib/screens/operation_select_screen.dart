import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../providers/inspection_provider.dart';
import '../services/api_service.dart';
import 'inspection_voice_screen.dart';

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
      
      final parts = await ApiService.getPartsByMachine(machineId);

      List<dynamic> rawTemplates = [];
      if (parts.isNotEmpty) {
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

  @override
  Widget build(BuildContext context) {
    final provider = Provider.of<InspectionProvider>(context);

    return Scaffold(
      backgroundColor: const Color(0xFF080C18),
      appBar: AppBar(
        backgroundColor: const Color(0xFF0D1424),
        title: Text(
          'Part: ${provider.selectedPart?['part_number'] ?? 'FBT00222'}',
          style: const TextStyle(color: Colors.white),
        ),
        elevation: 0,
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
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        provider.selectedMachine?['name'] ?? 'Machine',
                        style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 16),
                      ),
                      Text(
                        'Code: ${provider.selectedMachine?['machine_code'] ?? ''}  •  Part: POLY V PULLEY',
                        style: const TextStyle(color: Colors.blueGrey, fontSize: 13),
                      ),
                    ],
                  )
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
                          if (_templates.isNotEmpty) {
                            final targetTemplate = _templates.first;
                            await provider.loadParameters(targetTemplate);
                            final started = await provider.startSession(
                              trial: nextTrial,
                              parentId: rej['session_id'],
                            );
                            if (started && context.mounted) {
                              Navigator.push(
                                context,
                                MaterialPageRoute(builder: (_) => const InspectionVoiceScreen()),
                              );
                            }
                          }
                        },
                      )
                    ],
                  ),
                );
              }),
            ],

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
                  final isOpen = slotNum == 1; // 1/HR is open, others time-locked for demo

                  return GestureDetector(
                    onTap: () {
                      if (!isOpen) {
                        ScaffoldMessenger.of(context).showSnackBar(
                          SnackBar(
                            content: Text('🔒 Slot $slotNum/HR is time-locked. Opens in ${slotNum * 60} mins.'),
                            backgroundColor: Colors.orangeAccent,
                            behavior: SnackBarBehavior.floating,
                          ),
                        );
                      } else {
                        ScaffoldMessenger.of(context).showSnackBar(
                          SnackBar(
                            content: Text('🟢 Slot $slotNum/HR Active. Perform hourly inspection.'),
                            backgroundColor: Colors.green,
                            behavior: SnackBarBehavior.floating,
                          ),
                        );
                      }
                    },
                    child: Container(
                      margin: const EdgeInsets.only(right: 8),
                      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                      decoration: BoxDecoration(
                        color: isOpen ? Colors.greenAccent.withValues(alpha: 0.15) : const Color(0xFF0D1424),
                        borderRadius: BorderRadius.circular(10),
                        border: Border.all(
                          color: isOpen ? Colors.greenAccent : const Color(0xFF1E293B),
                        ),
                      ),
                      child: Row(
                        children: [
                          Icon(
                            isOpen ? Icons.play_circle_fill_rounded : Icons.lock_clock_rounded,
                            color: isOpen ? Colors.greenAccent : Colors.blueGrey,
                            size: 18,
                          ),
                          const SizedBox(width: 6),
                          Text(
                            '$slotNum/HR',
                            style: TextStyle(
                              color: isOpen ? Colors.white : Colors.blueGrey,
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

            const SizedBox(height: 20),
            const Text(
              'SELECT PROCESS OPERATION TO INSPECT',
              style: TextStyle(color: TextStyle(color: Colors.blueGrey).color, fontSize: 12, fontWeight: FontWeight.bold, letterSpacing: 1.2),
            ),
            const SizedBox(height: 12),

            _isLoading
                ? const Expanded(
                    child: Center(
                      child: CircularProgressIndicator(color: Colors.blueAccent),
                    ),
                  )
                : Expanded(
                    child: ListView.builder(
                      itemCount: _templates.length,
                      itemBuilder: (context, index) {
                        final t = _templates[index];
                        final version = t['version'] ?? 10;
                        final title = _getOpTitle(version);

                        return Card(
                          color: const Color(0xFF0D1424),
                          margin: const EdgeInsets.only(bottom: 12),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(12),
                            side: BorderSide(
                              color: version == 10 ? Colors.blueAccent.withValues(alpha: 0.5) : const Color(0xFF1E293B),
                            ),
                          ),
                          child: ListTile(
                            contentPadding: const EdgeInsets.all(16),
                            leading: CircleAvatar(
                              backgroundColor: const Color(0xFF131D30),
                              child: Text(
                                '$version',
                                style: const TextStyle(color: Colors.blueAccent, fontWeight: FontWeight.bold),
                              ),
                            ),
                            title: Text(
                              title,
                              style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 15),
                            ),
                            subtitle: Text(
                              'Type: ${t['inspection_type_display'] ?? t['inspection_type']}',
                              style: const TextStyle(color: Colors.blueGrey, fontSize: 13),
                            ),
                            trailing: const Icon(Icons.play_arrow_rounded, color: Colors.blueAccent),
                            onTap: () async {
                              await provider.loadParameters(t);
                              final started = await provider.startSession();
                              if (started && context.mounted) {
                                Navigator.push(
                                  context,
                                  MaterialPageRoute(builder: (_) => const InspectionVoiceScreen()),
                                );
                              }
                            },
                          ),
                        );
                      },
                    ),
                  ),
          ],
        ),
      ),
    );
  }
}
