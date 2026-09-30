import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../providers/inspection_provider.dart';
import 'inspection_voice_screen.dart';

/// Per-operation hourly slot picker screen.
///
/// Navigation flow:
///   OperatorHomeScreen  ->  (tap operation card)
///   OperationHourlySlotScreen  ->  (tap slot)
///   InspectionVoiceScreen
///
/// Each operation has its own independent slot progress, so OP-10 completing
/// Slot 2 does NOT mark Slot 2 as done for OP-02.
class OperationHourlySlotScreen extends StatelessWidget {
  final Map<String, dynamic> template;
  final int totalSlots;
  final List<int> completedSlots;
  final int activeSlot;

  const OperationHourlySlotScreen({
    super.key,
    required this.template,
    required this.totalSlots,
    required this.completedSlots,
    required this.activeSlot,
  });

  String get _opName {
    final name = (template['name'] ?? '').toString().trim();
    if (name.isNotEmpty) return name;
    final v = template['version']?.toString() ?? '';
    return 'Op $v — Inspection';
  }

  @override
  Widget build(BuildContext context) {
    final provider = Provider.of<InspectionProvider>(context);

    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 1,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_rounded, color: Color(0xFF0F172A)),
          onPressed: () => Navigator.pop(context),
        ),
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              _opName,
              style: const TextStyle(
                color: Color(0xFF0F172A),
                fontSize: 15,
                fontWeight: FontWeight.bold,
              ),
            ),
            const Text(
              'SELECT HOURLY SLOT',
              style: TextStyle(
                color: Color(0xFF64748B),
                fontSize: 10,
                letterSpacing: 1.1,
                fontWeight: FontWeight.bold,
              ),
            ),
          ],
        ),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Operation summary banner
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                gradient: const LinearGradient(
                  colors: [Color(0xFF0F172A), Color(0xFF1E293B)],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
                borderRadius: BorderRadius.circular(14),
                border: Border.all(color: const Color(0xFF10B981).withValues(alpha: 0.3)),
              ),
              child: Row(
                children: [
                  Container(
                    padding: const EdgeInsets.all(10),
                    decoration: BoxDecoration(
                      color: const Color(0xFF10B981).withValues(alpha: 0.15),
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: const Icon(Icons.precision_manufacturing_rounded,
                        color: Color(0xFF10B981), size: 26),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          _opName,
                          style: const TextStyle(
                              color: Colors.white,
                              fontWeight: FontWeight.bold,
                              fontSize: 14),
                        ),
                        const SizedBox(height: 3),
                        Text(
                          'Hourly In-Process Inspection  •  ${template['target_parameter_count'] ?? template['total_parameters'] ?? '?'} params',
                          style: const TextStyle(color: Color(0xFF94A3B8), fontSize: 12),
                        ),
                      ],
                    ),
                  ),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                    decoration: BoxDecoration(
                      color: const Color(0xFF10B981).withValues(alpha: 0.2),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Text(
                      '${completedSlots.length}/$totalSlots done',
                      style: const TextStyle(
                          color: Color(0xFF10B981),
                          fontSize: 11,
                          fontWeight: FontWeight.bold),
                    ),
                  ),
                ],
              ),
            ),

            const SizedBox(height: 20),
            const Text(
              'HOURLY IN-PROCESS INSPECTION SLOTS',
              style: TextStyle(
                  color: Color(0xFF94A3B8),
                  fontSize: 11,
                  fontWeight: FontWeight.bold,
                  letterSpacing: 1.1),
            ),
            const SizedBox(height: 12),

            // Horizontal slot strip
            SizedBox(
              height: 52,
              child: ListView.builder(
                scrollDirection: Axis.horizontal,
                itemCount: totalSlots,
                itemBuilder: (context, index) {
                  final slotNum = index + 1;
                  final isCompleted = completedSlots.contains(slotNum);
                  final isActive = slotNum == activeSlot;
                  final isUnlocked = isCompleted || isActive || slotNum <= activeSlot;

                  return GestureDetector(
                    onTap: () => _onSlotTapped(context, provider, slotNum, isCompleted, isUnlocked),
                    child: Container(
                      margin: const EdgeInsets.only(right: 10),
                      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                      decoration: BoxDecoration(
                        color: isActive
                            ? const Color(0xFF10B981).withValues(alpha: 0.2)
                            : isCompleted
                                ? Colors.blue.withValues(alpha: 0.12)
                                : const Color(0xFF0F172A),
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(
                          color: isActive
                              ? const Color(0xFF10B981)
                              : isCompleted
                                  ? Colors.blueAccent
                                  : const Color(0xFF1E293B),
                          width: isActive ? 2 : 1,
                        ),
                      ),
                      child: Row(
                        children: [
                          Icon(
                            isCompleted
                                ? Icons.check_circle_rounded
                                : isActive
                                    ? Icons.play_circle_fill_rounded
                                    : isUnlocked
                                        ? Icons.play_arrow_rounded
                                        : Icons.lock_rounded,
                            color: isActive
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
                              color: isActive
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
            const Text(
              'SLOT DETAILS',
              style: TextStyle(
                  color: Color(0xFF94A3B8),
                  fontSize: 11,
                  fontWeight: FontWeight.bold,
                  letterSpacing: 1.1),
            ),
            const SizedBox(height: 12),

            // Slot detail cards
            ...List.generate(totalSlots, (index) {
              final slotNum = index + 1;
              final isCompleted = completedSlots.contains(slotNum);
              final isActive = slotNum == activeSlot;
              final isUnlocked = isCompleted || isActive || slotNum <= activeSlot;

              final Color borderColor;
              final Color labelColor;
              final IconData iconData;
              final String statusLabel;

              if (isCompleted) {
                borderColor = Colors.blueAccent;
                labelColor = Colors.blueAccent;
                iconData = Icons.check_circle_rounded;
                statusLabel = 'COMPLETED';
              } else if (isActive) {
                borderColor = const Color(0xFF10B981);
                labelColor = const Color(0xFF10B981);
                iconData = Icons.play_circle_fill_rounded;
                statusLabel = 'ACTIVE — TAP TO RECORD';
              } else if (isUnlocked) {
                borderColor = const Color(0xFF334155);
                labelColor = Colors.white;
                iconData = Icons.play_arrow_rounded;
                statusLabel = 'UNLOCKED';
              } else {
                borderColor = const Color(0xFF1E293B);
                labelColor = const Color(0xFF64748B);
                iconData = Icons.lock_rounded;
                statusLabel = 'LOCKED';
              }

              return GestureDetector(
                onTap: () => _onSlotTapped(context, provider, slotNum, isCompleted, isUnlocked),
                child: Container(
                  margin: const EdgeInsets.only(bottom: 12),
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: const Color(0xFF0F172A),
                    borderRadius: BorderRadius.circular(14),
                    border: Border.all(color: borderColor, width: isActive ? 1.5 : 1),
                    boxShadow: [
                      BoxShadow(
                        color: Colors.black.withValues(alpha: 0.15),
                        blurRadius: 6,
                        offset: const Offset(0, 3),
                      ),
                    ],
                  ),
                  child: Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.all(10),
                        decoration: BoxDecoration(
                          color: labelColor.withValues(alpha: 0.12),
                          borderRadius: BorderRadius.circular(10),
                        ),
                        child: Icon(iconData, color: labelColor, size: 22),
                      ),
                      const SizedBox(width: 14),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              'Slot $slotNum/HR',
                              style: const TextStyle(
                                  color: Colors.white,
                                  fontWeight: FontWeight.bold,
                                  fontSize: 15),
                            ),
                            const SizedBox(height: 3),
                            Text(
                              statusLabel,
                              style: TextStyle(
                                  color: labelColor,
                                  fontSize: 11,
                                  fontWeight: FontWeight.bold,
                                  letterSpacing: 0.8),
                            ),
                          ],
                        ),
                      ),
                      if (isActive || (isUnlocked && !isCompleted))
                        Icon(Icons.chevron_right_rounded, color: labelColor, size: 24),
                    ],
                  ),
                ),
              );
            }),
          ],
        ),
      ),
    );
  }

  Future<void> _onSlotTapped(
    BuildContext context,
    InspectionProvider provider,
    int slotNum,
    bool isCompleted,
    bool isUnlocked,
  ) async {
    if (isCompleted) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Slot $slotNum/HR for $_opName is already completed. Rewriting is not allowed.'),
            backgroundColor: const Color(0xFFF59E0B),
            behavior: SnackBarBehavior.floating,
          ),
        );
      }
      return;
    }

    if (!isUnlocked) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Complete Slot ${slotNum - 1}/HR for $_opName first.'),
            backgroundColor: const Color(0xFFF59E0B),
            behavior: SnackBarBehavior.floating,
          ),
        );
      }
      return;
    }

    await provider.loadParameters(template);
    final started = await provider.startSession(
      trial: 1,
      inspectionType: 'hourly',
      hourlySlot: slotNum,
    );

    if (started && context.mounted) {
      Navigator.push(
        context,
        MaterialPageRoute(builder: (_) => const InspectionVoiceScreen()),
      );
    } else if (context.mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Cannot start: ${provider.errorMessage ?? "Unknown error."}'),
          backgroundColor: const Color(0xFFEF4444),
        ),
      );
    }
  }
}
