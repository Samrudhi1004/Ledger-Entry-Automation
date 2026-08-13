import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../providers/auth_provider.dart';
import '../providers/inspection_provider.dart';
import 'app_home_screen.dart';
import 'operation_select_screen.dart';
import 'report_sheet_screen.dart';
import 'inspection_voice_screen.dart';
import 'daily_production_report_screen.dart';

class SummaryScreen extends StatefulWidget {
  const SummaryScreen({super.key});

  @override
  State<SummaryScreen> createState() => _SummaryScreenState();
}

class _SummaryScreenState extends State<SummaryScreen> {
  bool _isSubmitting = false;

  String _formatSpecSubtitle(Map<String, dynamic> param) {
    if (param['is_process_parameter'] == true) {
      return 'Spec: ${param['specification'] ?? '—'} ${param['unit'] ?? ''}';
    }

    final type = (param['measurement_type'] ?? '').toString().toLowerCase();
    final name = (param['parameter_name'] ?? '').toString().toUpperCase();

    if (type == 'visual') {
      return 'Spec: Visual Pass / Fail Check';
    }
    if (name.contains('MIN')) {
      return 'Spec: ≥ ${param['lower_limit']} ${param['unit']} (MINIMUM)';
    }
    if (type == 'surface' || name.contains('MAX')) {
      return 'Spec: ≤ ${param['upper_limit']} ${param['unit']} (MAXIMUM)';
    }
    return 'Spec: ${param['nominal_value']} ${param['unit']} [${param['lower_limit']} - ${param['upper_limit']}]';
  }

  String _formatRecordedValue(Map<String, dynamic> param, Map<String, dynamic> res) {
    if (param['is_process_parameter'] == true) {
      if (param['data_type'] == 'yes_no') {
        return (res['measured_value'] == 1.0 || res['status'] == 'ok') ? 'YES (PASS)' : 'NO (REJECT)';
      }
      return '${res['measured_value']} ${param['unit'] ?? ''}';
    }

    final type = (param['measurement_type'] ?? '').toString().toLowerCase();

    if (type == 'visual') {
      return (res['measured_value'] == 1.0 || res['status'] == 'ok') ? 'YES (PASS)' : 'NO (REJECT)';
    }
    return '${res['measured_value']} ${param['unit']}';
  }

  @override
  Widget build(BuildContext context) {
    final provider = Provider.of<InspectionProvider>(context);
    final results = provider.recordedResults;

    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 1,
        title: const Text('Inspection Session Summary', style: TextStyle(color: Color(0xFF0F172A), fontWeight: FontWeight.bold)),
        iconTheme: const IconThemeData(color: Color(0xFF0F172A)),
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
        ],
      ),
      body: Padding(
        padding: const EdgeInsets.all(20.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Session Overview Banner
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: const Color(0xFF0D1424),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: const Color(0xFF1E293B)),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Expanded(
                        child: Text(
                          'Part: ${provider.selectedPart?['part_number'] ?? '-'} (${provider.selectedPart?['part_name'] ?? provider.selectedPart?['part_number'] ?? '-'})',
                          style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 15),
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                      const SizedBox(width: 8),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                        decoration: BoxDecoration(
                          color: provider.inspectionType == 'first_piece'
                              ? const Color(0xFF38BDF8).withValues(alpha: 0.15)
                              : const Color(0xFF10B981).withValues(alpha: 0.15),
                          borderRadius: BorderRadius.circular(6),
                          border: Border.all(
                            color: provider.inspectionType == 'first_piece'
                                ? const Color(0xFF38BDF8)
                                : const Color(0xFF10B981),
                          ),
                        ),
                        child: Text(
                          provider.inspectionType == 'first_piece'
                              ? '1ST PC #${provider.trialNumber} SHEET'
                              : 'HOURLY SHEET',
                          style: TextStyle(
                            color: provider.inspectionType == 'first_piece'
                                ? const Color(0xFF38BDF8)
                                : const Color(0xFF10B981),
                            fontSize: 10,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 4),
                  Text(
                    'Machine: ${provider.selectedMachine?['machine_code'] ?? 'CNC-01'}  •  Recorded: ${results.length} of ${provider.parameters.length} params',
                    style: const TextStyle(color: Colors.blueGrey, fontSize: 13),
                  ),
                ],
              ),
            ),

            const SizedBox(height: 20),
            const Text(
              'RECORDED PARAMETERS CHECKLIST',
              style: TextStyle(color: Colors.blueGrey, fontSize: 12, fontWeight: FontWeight.bold, letterSpacing: 1.2),
            ),
            const SizedBox(height: 12),

            Expanded(
              child: ListView.builder(
                itemCount: provider.parameters.length,
                itemBuilder: (context, index) {
                  final param = provider.parameters[index];
                  final code = param['parameter_code'];
                  final res = results[code];
                  final isRecorded = res != null;
                  final isOk = isRecorded && res['status'] == 'ok';

                  return Card(
                    color: const Color(0xFF0D1424),
                    margin: const EdgeInsets.only(bottom: 10),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(10),
                      side: BorderSide(
                        color: isRecorded
                            ? (isOk ? Colors.green.withValues(alpha: 0.5) : Colors.red.withValues(alpha: 0.5))
                            : const Color(0xFF1E293B),
                      ),
                    ),
                    child: ListTile(
                      title: Text(
                        '${param['parameter_name']}',
                        style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w600),
                      ),
                      subtitle: Text(
                        _formatSpecSubtitle(param),
                        style: const TextStyle(color: Colors.blueGrey, fontSize: 12),
                      ),
                      trailing: isRecorded
                          ? Container(
                              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                              decoration: BoxDecoration(
                                color: isOk ? Colors.green.withValues(alpha: 0.2) : Colors.red.withValues(alpha: 0.2),
                                borderRadius: BorderRadius.circular(8),
                              ),
                              child: Text(
                                '${_formatRecordedValue(param, res)} (${res['status'].toString().toUpperCase()})',
                                style: TextStyle(
                                  color: isOk ? Colors.green : Colors.red,
                                  fontWeight: FontWeight.bold,
                                  fontSize: 12,
                                ),
                              ),
                            )
                          : const Text(
                              'PENDING',
                              style: TextStyle(color: Colors.amber, fontWeight: FontWeight.bold, fontSize: 12),
                            ),
                    ),
                  );
                },
              ),
            ),

            const SizedBox(height: 16),

            // Submit / Finalize Session Button
            ElevatedButton(
              onPressed: _isSubmitting
                  ? null
                  : () async {
                      // ⚠️ Guard: Block finalization if no parameters were loaded.
                      // This prevents the false "FIRST PIECE FINALIZED & PASSED"
                      // shown when parameters.length == 0 and oocCount == 0.
                      if (provider.parameters.isEmpty) {
                        ScaffoldMessenger.of(context).showSnackBar(
                          const SnackBar(
                            content: Text(
                              '❌ Cannot finalize: No inspection parameters were loaded for this session. '
                              'Please ensure the operation template has configured parameters.',
                            ),
                            backgroundColor: Colors.redAccent,
                            duration: Duration(seconds: 5),
                            behavior: SnackBarBehavior.floating,
                          ),
                        );
                        return;
                      }

                      setState(() {
                        _isSubmitting = true;
                      });

                      final auth = Provider.of<AuthProvider>(context, listen: false);
                      Map<String, dynamic>? finalResult;

                      if (auth.isInspector) {
                        finalResult = await provider.finalizeFirstPieceSession();
                      } else {
                        await provider.completeSession();
                      }

                      if (!mounted) return;

                      setState(() {
                        _isSubmitting = false;
                      });

                      _showCompletionDialog(provider, finalResult);
                    },
              style: ElevatedButton.styleFrom(
                backgroundColor: Provider.of<AuthProvider>(context, listen: false).isInspector ? Colors.blueAccent : Colors.green,
                padding: const EdgeInsets.symmetric(vertical: 16),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
              ),
              child: _isSubmitting
                  ? const CircularProgressIndicator(color: Colors.white)
                  : Text(
                      Provider.of<AuthProvider>(context, listen: false).isInspector
                          ? 'FINALIZE FIRST PIECE & GENERATE PDF'
                          : 'SUBMIT HOURLY SESSION',
                      style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: Colors.white),
                    ),
            ),

          ],
        ),
      ),
    );
  }

  void _showCompletionDialog(InspectionProvider provider, [Map<String, dynamic>? finalResult]) {
    final results = provider.recordedResults;
    final totalParams = provider.parameters.length;
    int okCount = 0;
    int oocCount = 0;

    results.forEach((key, val) {
      if (val['status'] == 'ok') {
        okCount++;
      } else {
        oocCount++;
      }
    });

    final templateName = provider.selectedTemplate?['name'] ??
        'Op ${provider.selectedTemplate?['version'] ?? 10} — Inspection';

    final isInspector = Provider.of<AuthProvider>(context, listen: false).isInspector;

    // ⚠️ Hard guard: 0/0 must NEVER be treated as PASSED.
    // If no parameters are present, this is an invalid finalization state.
    // isPassed requires: (a) API returned finalized_passed, OR (b) oocCount==0 AND totalParams>0.
    final isPassed = (finalResult?['status'] == 'finalized_passed') ||
        (oocCount == 0 && totalParams > 0 && results.isNotEmpty);

    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (ctx) => AlertDialog(
        backgroundColor: const Color(0xFF0D1424),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(16),
          side: BorderSide(color: isPassed ? Colors.greenAccent : Colors.redAccent, width: 1.5),
        ),
        title: Column(
          children: [
            Icon(isPassed ? Icons.verified_rounded : Icons.warning_rounded, color: isPassed ? Colors.greenAccent : Colors.redAccent, size: 54),
            const SizedBox(height: 10),
            Text(
              isInspector
                  ? (isPassed ? 'FIRST PIECE FINALIZED & PASSED!' : 'FIRST PIECE FINALIZED (FAILED)')
                  : 'HOURLY INSPECTION SUBMITTED!',
              textAlign: TextAlign.center,
              style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 18),
            ),
            const SizedBox(height: 4),
            Text(
              templateName,
              textAlign: TextAlign.center,
              style: const TextStyle(color: Colors.blueAccent, fontSize: 13, fontWeight: FontWeight.w600),
            ),
          ],
        ),

        content: SizedBox(
          width: double.maxFinite,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              // Show warning if 0 parameters were recorded (abnormal state)
              if (totalParams == 0) ...[
                Container(
                  padding: const EdgeInsets.all(12),
                  margin: const EdgeInsets.only(bottom: 12),
                  decoration: BoxDecoration(
                    color: Colors.redAccent.withValues(alpha: 0.15),
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(color: Colors.redAccent),
                  ),
                  child: const Row(
                    children: [
                      Icon(Icons.warning_amber_rounded, color: Colors.redAccent, size: 20),
                      SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          'No inspection parameters were loaded. This session has 0 parameters — results are invalid.',
                          style: TextStyle(color: Colors.white, fontSize: 12),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: const Color(0xFF131D30),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceAround,
                  children: [
                    _buildStatCol('FILLED', '${results.length} / $totalParams', Colors.blueAccent),
                    _buildStatCol('PASSED (OK)', '$okCount', Colors.greenAccent),
                    _buildStatCol('OOC FAIL', '$oocCount', Colors.redAccent),
                  ],
                ),
              ),
              const SizedBox(height: 14),
              const Align(
                alignment: Alignment.centerLeft,
                child: Text('FILLED MEASUREMENTS:', style: TextStyle(color: Colors.blueGrey, fontSize: 11, fontWeight: FontWeight.bold)),
              ),
              const SizedBox(height: 6),
              Flexible(
                child: ListView.builder(
                  shrinkWrap: true,
                  itemCount: provider.parameters.length,
                  itemBuilder: (_, idx) {
                    final p = provider.parameters[idx];
                    final code = p['parameter_code'];
                    final res = results[code];
                    if (res == null) return const SizedBox.shrink();
                    final isOk = res['status'] == 'ok';

                    return Padding(
                      padding: const EdgeInsets.symmetric(vertical: 4),
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Expanded(
                            child: Text(
                              '${p['parameter_name']}',
                              style: const TextStyle(color: Colors.white70, fontSize: 12),
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                          const SizedBox(width: 8),
                          Row(
                            children: [
                              Text('${res['measured_value']} ${p['unit']}', style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 12)),
                              const SizedBox(width: 6),
                              Icon(isOk ? Icons.check_circle : Icons.cancel, color: isOk ? Colors.greenAccent : Colors.redAccent, size: 14),
                            ],
                          ),
                        ],
                      ),
                    );
                  },
                ),
              ),
            ],
          ),
        ),
        actions: [
          Row(
            children: [
              Expanded(
                child: OutlinedButton.icon(
                  style: OutlinedButton.styleFrom(
                    foregroundColor: const Color(0xFF38BDF8),
                    side: const BorderSide(color: Color(0xFF38BDF8)),
                    padding: const EdgeInsets.symmetric(vertical: 12),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                  ),
                  icon: const Icon(Icons.home_rounded, size: 16),
                  label: const Text('BACK TO HOME', style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold)),
                  onPressed: () {
                    provider.resetForNextOperation();
                    Navigator.pop(ctx);
                    Navigator.pushAndRemoveUntil(
                      context,
                      MaterialPageRoute(builder: (_) => const AppHomeScreen()),
                      (route) => false,
                    );
                  },
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: ElevatedButton.icon(
                  style: ElevatedButton.styleFrom(
                    backgroundColor: oocCount > 0 ? const Color(0xFFF59E0B) : const Color(0xFF10B981),
                    foregroundColor: Colors.black,
                    padding: const EdgeInsets.symmetric(vertical: 12),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                  ),
                  icon: Icon(
                    isInspector
                        ? (oocCount > 0 ? Icons.build_circle_rounded : Icons.assignment_rounded)
                        : Icons.fact_check_rounded,
                    size: 16,
                  ),
                  label: Text(
                    isInspector
                        ? (oocCount > 0
                            ? '1ST PC #${provider.trialNumber + 1}'
                            : 'DAILY REPORT')
                        : 'NEXT OPERATION',
                    style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold),
                  ),
                  onPressed: () async {
                    final auth = Provider.of<AuthProvider>(context, listen: false);
                    final navigator = Navigator.of(context);
                    final messenger = ScaffoldMessenger.of(context);

                    Navigator.pop(ctx);

                    if (auth.isInspector) {
                      final currentTrial = provider.trialNumber;
                      if (oocCount > 0 && currentTrial < 3) {
                        final nextTrial = currentTrial + 1;
                        final template = provider.selectedTemplate;
                        if (template != null) {
                          await provider.loadParametersForRetrial(template, trial: nextTrial);
                          await provider.startSession(trial: nextTrial, inspectionType: 'first_piece');
                          messenger.showSnackBar(
                            SnackBar(
                              content: Text('🎯 Auto-launched Corrective Trial 1ST PC #$nextTrial for $oocCount failed parameter(s).'),
                              backgroundColor: const Color(0xFFF59E0B),
                              behavior: SnackBarBehavior.floating,
                            ),
                          );
                          navigator.push(
                            MaterialPageRoute(builder: (_) => const InspectionVoiceScreen()),
                          );
                          return;
                        }
                      }
                      navigator.push(
                        MaterialPageRoute(builder: (_) => const ReportSheetScreen()),
                      );
                    } else {
                      // Capture slot state BEFORE reset (reset clears completedHourlySlots).
                      // ONLY check contains(8) — after slot 7 completes, hourlySlot auto-advances
                      // to 8 but slot 8 is NOT done yet. hourlySlot >= 8 would fire too early.
                      final wasSlot8Done = provider.completedHourlySlots.contains(8);
                      provider.resetForNextOperation();
                      if (wasSlot8Done) {
                        // Slot 8 inspection is fully submitted → go to Daily Production Report
                        navigator.push(
                          MaterialPageRoute(builder: (_) => const DailyProductionReportScreen()),
                        );
                      } else {
                        // Still have slots to complete → go back to operation select
                        navigator.push(
                          MaterialPageRoute(builder: (_) => const OperationSelectScreen()),
                        );
                      }
                    }
                  },
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildStatCol(String title, String val, Color col) {
    return Column(
      children: [
        Text(val, style: TextStyle(color: col, fontWeight: FontWeight.bold, fontSize: 16)),
        const SizedBox(height: 2),
        Text(title, style: const TextStyle(color: Colors.blueGrey, fontSize: 10)),
      ],
    );
  }
}

