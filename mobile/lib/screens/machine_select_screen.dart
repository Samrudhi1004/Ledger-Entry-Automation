import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../providers/inspection_provider.dart';
import '../services/api_service.dart';
import 'operation_select_screen.dart';

class MachineSelectScreen extends StatefulWidget {
  const MachineSelectScreen({super.key});

  @override
  State<MachineSelectScreen> createState() => _MachineSelectScreenState();
}

class _MachineSelectScreenState extends State<MachineSelectScreen> {
  final _qrController = TextEditingController(text: 'CNC-01');
  bool _isSearching = false;
  String? _searchError;

  final List<Map<String, dynamic>> _quickMachines = [
    {
      'id': 1,
      'machine_code': 'CNC-01',
      'name': 'CNC Turning Center 01',
      'type': 'CNC Turning',
      'status': 'active'
    },
    {
      'id': 2,
      'machine_code': 'VMC-01',
      'name': 'VMC Drilling Machine 01',
      'type': 'VMC Drilling',
      'status': 'active'
    },
    {
      'id': 3,
      'machine_code': 'BAL-01',
      'name': 'Dynamic Balancing Rig 01',
      'type': 'Balancing',
      'status': 'active'
    },
  ];

  Future<void> _searchMachine(String code) async {
    setState(() {
      _isSearching = true;
      _searchError = null;
    });

    final machine = await ApiService.getMachineByCode(code.trim());

    setState(() {
      _isSearching = false;
    });

    if (machine != null && mounted) {
      final provider = Provider.of<InspectionProvider>(context, listen: false);
      provider.selectMachine(machine);
      Navigator.push(
        context,
        MaterialPageRoute(builder: (_) => const OperationSelectScreen()),
      );
    } else if (mounted) {
      setState(() {
        _searchError = 'Machine with code "$code" not found.';
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF080C18),
      appBar: AppBar(
        backgroundColor: const Color(0xFF0D1424),
        title: const Text('Select Machine / Station', style: TextStyle(color: Colors.white)),
        elevation: 0,
      ),
      body: Padding(
        padding: const EdgeInsets.all(20.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // QR Scan Simulation Card
            Container(
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                color: const Color(0xFF0D1424),
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: Colors.blueAccent.withValues(alpha: 0.3)),
              ),
              child: Column(
                children: [
                  const Icon(Icons.qr_code_scanner_rounded, size: 48, color: Colors.blueAccent),
                  const SizedBox(height: 12),
                  const Text(
                    'Scan Machine QR Code',
                    style: TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold),
                  ),
                  const SizedBox(height: 8),
                  const Text(
                    'Enter or scan the machine QR code on the factory floor',
                    textAlign: TextAlign.center,
                    style: TextStyle(color: Colors.blueGrey, fontSize: 13),
                  ),
                  const SizedBox(height: 16),

                  Row(
                    children: [
                      Expanded(
                        child: TextField(
                          controller: _qrController,
                          style: const TextStyle(color: Colors.white),
                          decoration: InputDecoration(
                            hintText: 'e.g. CNC-01',
                            hintStyle: const TextStyle(color: Colors.blueGrey),
                            filled: true,
                            fillColor: const Color(0xFF131D30),
                            border: OutlineInputBorder(
                              borderRadius: BorderRadius.circular(10),
                              borderSide: BorderSide.none,
                            ),
                          ),
                        ),
                      ),
                      const SizedBox(width: 12),
                      ElevatedButton(
                        onPressed: _isSearching ? null : () => _searchMachine(_qrController.text),
                        style: ElevatedButton.styleFrom(
                          backgroundColor: Colors.blueAccent,
                          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                        ),
                        child: _isSearching
                            ? const SizedBox(height: 18, width: 18, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                            : const Text('SEARCH', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
                      ),
                    ],
                  ),
                  if (_searchError != null) ...[
                    const SizedBox(height: 12),
                    Text(_searchError!, style: const TextStyle(color: Colors.redAccent, fontSize: 13)),
                  ],
                ],
              ),
            ),

            const SizedBox(height: 24),
            const Text(
              'ACTIVE MACHINES ON FLOOR',
              style: TextStyle(color: Colors.blueGrey, fontSize: 12, fontWeight: FontWeight.bold, letterSpacing: 1.2),
            ),
            const SizedBox(height: 12),

            // Quick select list
            Expanded(
              child: ListView.builder(
                itemCount: _quickMachines.length,
                itemBuilder: (context, index) {
                  final machine = _quickMachines[index];
                  return Card(
                    color: const Color(0xFF0D1424),
                    margin: const EdgeInsets.only(bottom: 12),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
                      side: const BorderSide(color: Color(0xFF1E293B)),
                    ),
                    child: ListTile(
                      contentPadding: const EdgeInsets.all(16),
                      leading: Container(
                        padding: const EdgeInsets.all(10),
                        decoration: BoxDecoration(
                          color: const Color(0xFF131D30),
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: const Icon(Icons.precision_manufacturing_rounded, color: Colors.blueAccent),
                      ),
                      title: Text(
                        machine['name'],
                        style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 16),
                      ),
                      subtitle: Text(
                        'Code: ${machine['machine_code']}  •  Type: ${machine['type']}',
                        style: const TextStyle(color: Colors.blueGrey, fontSize: 13),
                      ),
                      trailing: const Icon(Icons.arrow_forward_ios_rounded, color: Colors.blueAccent, size: 18),
                      onTap: () => _searchMachine(machine['machine_code']),
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
