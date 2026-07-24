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
                        ScaffoldMessenger.of(context).showSnackBar(
                          SnackBar(
                            content: Text(
                              success
                                  ? 'Inspection session submitted successfully to Supervisor!'
                                  : 'Session completed locally.',
                            ),
                            backgroundColor: Colors.green,
                          ),
                        );
                        Navigator.pushAndRemoveUntil(
                          context,
                          MaterialPageRoute(builder: (_) => const MachineSelectScreen()),
                          (route) => false,
                        );
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
}
