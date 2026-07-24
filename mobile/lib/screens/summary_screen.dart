import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../providers/inspection_provider.dart';
import 'machine_select_screen.dart';

class SummaryScreen extends StatefulWidget {
  const SummaryScreen({super.key});

  @override
  State<SummaryScreen> createState() => _SummaryScreenState();
}

class _SummaryScreenState extends State<SummaryScreen> {
  bool _isSubmitting = false;

  @override
  Widget build(BuildContext context) {
    final provider = Provider.of<InspectionProvider>(context);
    final results = provider.recordedResults;

    return Scaffold(
      backgroundColor: const Color(0xFF080C18),
      appBar: AppBar(
        backgroundColor: const Color(0xFF0D1424),
        title: const Text('Inspection Session Summary', style: TextStyle(color: Colors.white)),
        elevation: 0,
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
                  Text(
                    'Part: ${provider.selectedPart?['part_number'] ?? 'FBT00222'} (POLY V PULLEY)',
                    style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 16),
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
                        '${param['parameter_code']}: ${param['parameter_name']}',
                        style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w600),
                      ),
                      subtitle: Text(
                        'Spec: ${param['nominal_value']} ${param['unit']} (${param['lower_limit']} - ${param['upper_limit']})',
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
                                '${res['measured_value']} ${param['unit']} (${res['status'].toUpperCase()})',
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

            // Submit Session Button
            ElevatedButton(
              onPressed: _isSubmitting
                  ? null
                  : () async {
                      setState(() {
                        _isSubmitting = true;
                      });

                      final success = await provider.completeSession();

                      setState(() {
                        _isSubmitting = false;
                      });

                      if (mounted) {
                        _showCompletionDialog(context, provider);
                      }
                    },
              style: ElevatedButton.styleFrom(
                backgroundColor: Colors.green,
                padding: const EdgeInsets.symmetric(vertical: 16),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
              ),
              child: _isSubmitting
                  ? const CircularProgressIndicator(color: Colors.white)
                  : const Text(
                      'SUBMIT SESSION TO SUPERVISOR',
                      style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: Colors.white),
                    ),
            ),
          ],
        ),
      ),
    );
  }

  void _showCompletionDialog(BuildContext context, InspectionProvider provider) {
    final results = provider.recordedResults;
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

    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (ctx) => AlertDialog(
        backgroundColor: const Color(0xFF0D1424),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(16),
          side: const BorderSide(color: Colors.greenAccent, width: 1.5),
        ),
        title: Column(
          children: [
            const Icon(Icons.check_circle_rounded, color: Colors.greenAccent, size: 54),
            const SizedBox(height: 10),
            const Text(
              'OPERATION UPDATED & SUBMITTED!',
              textAlign: TextAlign.center,
              style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 18),
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
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: const Color(0xFF131D30),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceAround,
                  children: [
                    _buildStatCol('FILLED', '${results.length} / ${provider.parameters.length}', Colors.blueAccent),
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
                          Text('${p['parameter_code']} (${p['parameter_name']})', style: const TextStyle(color: Colors.white70, fontSize: 12)),
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
          ElevatedButton(
            style: ElevatedButton.styleFrom(
              backgroundColor: Colors.greenAccent,
              foregroundColor: Colors.black,
              minimumSize: const Size(double.infinity, 45),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
            ),
            onPressed: () {
              Navigator.pop(ctx);
              Navigator.pushAndRemoveUntil(
                context,
                MaterialPageRoute(builder: (_) => const MachineSelectScreen()),
                (route) => false,
              );
            },
            child: const Text('DONE / NEXT OPERATION', style: TextStyle(fontWeight: FontWeight.bold)),
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

