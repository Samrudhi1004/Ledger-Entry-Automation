import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/auth_provider.dart';
import '../providers/inspection_provider.dart';
import '../services/api_service.dart';

class DailyProductionReportScreen extends StatefulWidget {
  const DailyProductionReportScreen({super.key});

  @override
  State<DailyProductionReportScreen> createState() => _DailyProductionReportScreenState();
}

class _DailyProductionReportScreenState extends State<DailyProductionReportScreen> {
  final _formKey = GlobalKey<FormState>();

  final _targetController = TextEditingController(text: '500');
  final _completedController = TextEditingController(text: '480');
  final _correctController = TextEditingController(text: '460');
  final _incorrectController = TextEditingController(text: '20');
  final _crController = TextEditingController(text: '8');
  final _mrController = TextEditingController(text: '5');
  final _rwController = TextEditingController(text: '7');
  final _remarksController = TextEditingController();

  bool _isSubmitting = false;
  String? _validationError;

  @override
  void initState() {
    super.initState();
    _targetController.addListener(_validateInputs);
    _completedController.addListener(_validateInputs);
    _correctController.addListener(_validateInputs);
    _incorrectController.addListener(_validateInputs);
    _crController.addListener(_validateInputs);
    _mrController.addListener(_validateInputs);
    _rwController.addListener(_validateInputs);
  }

  @override
  void dispose() {
    _targetController.dispose();
    _completedController.dispose();
    _correctController.dispose();
    _incorrectController.dispose();
    _crController.dispose();
    _mrController.dispose();
    _rwController.dispose();
    _remarksController.dispose();
    super.dispose();
  }

  void _validateInputs() {
    final completed = int.tryParse(_completedController.text.trim()) ?? 0;
    final correct = int.tryParse(_correctController.text.trim()) ?? 0;
    final incorrect = int.tryParse(_incorrectController.text.trim()) ?? 0;
    final cr = int.tryParse(_crController.text.trim()) ?? 0;
    final mr = int.tryParse(_mrController.text.trim()) ?? 0;
    final rw = int.tryParse(_rwController.text.trim()) ?? 0;

    String? err;
    if (completed != (correct + incorrect)) {
      err = '⚠️ Validation 1 Failed: Jobs Completed ($completed) must equal Correct Jobs ($correct) + Incorrect Jobs ($incorrect).';
    } else if (incorrect != (cr + mr + rw)) {
      err = '⚠️ Validation 2 Failed: Incorrect Jobs ($incorrect) must equal CR ($cr) + MR ($mr) + RW ($rw).';
    }

    setState(() {
      _validationError = err;
    });
  }

  double get _achievementPercentage {
    final target = double.tryParse(_targetController.text.trim()) ?? 0;
    final completed = double.tryParse(_completedController.text.trim()) ?? 0;
    if (target > 0) {
      return (completed / target) * 100;
    }
    return 0.0;
  }

  Future<void> _submitReport() async {
    _validateInputs();
    if (_validationError != null) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(_validationError!),
          backgroundColor: const Color(0xFFDC2626),
          behavior: SnackBarBehavior.floating,
        ),
      );
      return;
    }

    setState(() => _isSubmitting = true);

    final provider = Provider.of<InspectionProvider>(context, listen: false);

    final now = DateTime.now();
    final dateStr = "${now.year}-${now.month.toString().padLeft(2, '0')}-${now.day.toString().padLeft(2, '0')}";

    // Use valid database fallback IDs (Machine: 5 CNC-01, Part: 10 Brake Drum Rear)
    final machineId = provider.selectedMachine?['id'] ?? 5;
    final partId = provider.selectedPart?['id'] ?? 10;
    final operation = provider.selectedTemplate?['part_operation_name'] ?? provider.selectedTemplate?['version']?.toString() ?? 'Drilling';
    final shift = provider.shift;

    final payload = {
      'date': dateStr,
      'machine': machineId,
      'part': partId,
      'operation': operation,
      'shift': shift,
      'production_target': int.tryParse(_targetController.text.trim()) ?? 0,
      'jobs_completed': int.tryParse(_completedController.text.trim()) ?? 0,
      'correct_jobs': int.tryParse(_correctController.text.trim()) ?? 0,
      'incorrect_jobs': int.tryParse(_incorrectController.text.trim()) ?? 0,
      'cr_count': int.tryParse(_crController.text.trim()) ?? 0,
      'mr_count': int.tryParse(_mrController.text.trim()) ?? 0,
      'rw_count': int.tryParse(_rwController.text.trim()) ?? 0,
      'remarks': _remarksController.text.trim(),
    };

    final res = await ApiService.submitDailyProductionReport(payload);

    setState(() => _isSubmitting = false);

    if (mounted) {
      if (res['success'] == true) {
        showDialog(
          context: context,
          barrierDismissible: false,
          builder: (ctx) => AlertDialog(
            backgroundColor: Colors.white,
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
            title: const Row(
              children: [
                Icon(Icons.check_circle_rounded, color: Color(0xFF059669), size: 28),
                SizedBox(width: 10),
                Text('Report Submitted', style: TextStyle(color: Color(0xFF0F172A), fontSize: 18, fontWeight: FontWeight.bold)),
              ],
            ),
            content: Text(
              'Daily Production Report saved successfully!\nAchievement Rating: ${_achievementPercentage.toStringAsFixed(1)}%',
              style: const TextStyle(color: Color(0xFF334155), fontSize: 13),
            ),
            actions: [
              ElevatedButton(
                onPressed: () {
                  Navigator.pop(ctx);
                  Navigator.pop(context);
                },
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF059669),
                  foregroundColor: Colors.white,
                ),
                child: const Text('OK'),
              )
            ],
          ),
        );
      } else {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Failed to submit: ${res['message']}'),
            backgroundColor: const Color(0xFFDC2626),
            behavior: SnackBarBehavior.floating,
          ),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final provider = Provider.of<InspectionProvider>(context);
    final auth = Provider.of<AuthProvider>(context);

    final now = DateTime.now();
    final dateDisplay = "${now.day.toString().padLeft(2, '0')}-${_monthAbbr(now.month)}-${now.year}";
    final machineCode = provider.selectedMachine?['machine_code'] ?? 'CNC-01';
    final partName = provider.selectedPart?['part_name'] ?? 'Brake Drum Rear';
    final operation = provider.selectedTemplate?['part_operation_name'] ?? 'Drilling';
    final shift = provider.shift;
    final operatorName = auth.fullName ?? auth.username ?? 'Operator User';

    final isTargetMet = _achievementPercentage >= 100;

    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 1,
        shadowColor: const Color(0x1A000000),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_rounded, color: Color(0xFF2563EB)),
          onPressed: () => Navigator.pop(context),
        ),
        title: const Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'DAILY PRODUCTION REPORT',
              style: TextStyle(color: Color(0xFF0F172A), fontWeight: FontWeight.bold, fontSize: 15, letterSpacing: 0.5),
            ),
            Text(
              'End of Day Output & Rejection Log',
              style: TextStyle(color: Color(0xFF64748B), fontSize: 11),
            ),
          ],
        ),
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(20.0),
          child: Form(
            key: _formKey,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                // 1. LIGHT METADATA SUMMARY CONTAINER
                Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(14),
                    border: Border.all(color: const Color(0xFFE2E8F0)),
                    boxShadow: const [
                      BoxShadow(color: Color(0x0A000000), blurRadius: 8, offset: Offset(0, 2)),
                    ],
                  ),
                  child: Column(
                    children: [
                      _metaRow('Date:', dateDisplay, 'Shift:', 'Shift $shift'),
                      const SizedBox(height: 8),
                      _metaRow('Machine:', machineCode, 'Operator:', operatorName),
                      const SizedBox(height: 8),
                      _metaRow('Part:', partName, 'Operation:', operation),
                    ],
                  ),
                ),

                const SizedBox(height: 20),

                // 2. LIGHT LIVE ACHIEVEMENT RATING CARD
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 14),
                  decoration: BoxDecoration(
                    gradient: LinearGradient(
                      colors: isTargetMet
                          ? [const Color(0xFFECFDF5), const Color(0xFFD1FAE5)]
                          : [const Color(0xFFEFF6FF), const Color(0xFFDBEAFE)],
                    ),
                    borderRadius: BorderRadius.circular(14),
                    border: Border.all(
                      color: isTargetMet ? const Color(0xFFA7F3D0) : const Color(0xFFBFDBFE),
                    ),
                  ),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text(
                            'Production Achievement',
                            style: TextStyle(color: Color(0xFF475569), fontSize: 12, fontWeight: FontWeight.w600),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            '${_achievementPercentage.toStringAsFixed(1)}%',
                            style: TextStyle(
                              color: isTargetMet ? const Color(0xFF047857) : const Color(0xFF1E40AF),
                              fontSize: 26,
                              fontWeight: FontWeight.w900,
                            ),
                          ),
                        ],
                      ),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                        decoration: BoxDecoration(
                          color: isTargetMet ? const Color(0xFF10B981) : const Color(0xFF2563EB),
                          borderRadius: BorderRadius.circular(20),
                        ),
                        child: Text(
                          isTargetMet ? '🎯 TARGET MET' : '📊 IN PROGRESS',
                          style: const TextStyle(
                            color: Colors.white,
                            fontWeight: FontWeight.bold,
                            fontSize: 11,
                          ),
                        ),
                      )
                    ],
                  ),
                ),

                const SizedBox(height: 20),

                // 3. LIGHT VALIDATION WARNING BANNER
                if (_validationError != null)
                  Container(
                    margin: const EdgeInsets.only(bottom: 20),
                    padding: const EdgeInsets.all(14),
                    decoration: BoxDecoration(
                      color: const Color(0xFFFEF2F2),
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: const Color(0xFFFCA5A5)),
                    ),
                    child: Text(
                      _validationError!,
                      style: const TextStyle(color: Color(0xFF991B1B), fontSize: 12, fontWeight: FontWeight.bold),
                    ),
                  ),

                // 4. FORM INPUT FIELDS (LIGHT THEME)
                _buildNumberInput('Production Target', _targetController, icon: Icons.flag_rounded),
                const SizedBox(height: 14),
                _buildNumberInput('Jobs Completed', _completedController, icon: Icons.checklist_rounded),
                const SizedBox(height: 14),

                Row(
                  children: [
                    Expanded(child: _buildNumberInput('Correct Jobs', _correctController, icon: Icons.check_circle_outline, color: const Color(0xFF059669))),
                    const SizedBox(width: 12),
                    Expanded(child: _buildNumberInput('Incorrect Jobs', _incorrectController, icon: Icons.cancel_outlined, color: const Color(0xFFDC2626))),
                  ],
                ),

                const SizedBox(height: 18),
                const Text(
                  'Rejection Breakup (Must sum to Incorrect Jobs)',
                  style: TextStyle(color: Color(0xFF334155), fontSize: 12, fontWeight: FontWeight.bold),
                ),
                const SizedBox(height: 10),

                Row(
                  children: [
                    Expanded(child: _buildNumberInput('CR (Customer)', _crController, isCompact: true)),
                    const SizedBox(width: 8),
                    Expanded(child: _buildNumberInput('MR (Machine)', _mrController, isCompact: true)),
                    const SizedBox(width: 8),
                    Expanded(child: _buildNumberInput('RW (Rework)', _rwController, isCompact: true)),
                  ],
                ),

                const SizedBox(height: 18),

                // Remarks Input
                const Text(
                  'Remarks (Optional)',
                  style: TextStyle(color: Color(0xFF334155), fontSize: 12, fontWeight: FontWeight.bold),
                ),
                const SizedBox(height: 8),
                TextField(
                  controller: _remarksController,
                  maxLines: 3,
                  style: const TextStyle(color: Color(0xFF0F172A), fontSize: 13),
                  decoration: InputDecoration(
                    hintText: 'e.g. Machine stopped for 15 minutes due to tool change.',
                    hintStyle: const TextStyle(color: Color(0xFF94A3B8), fontSize: 12),
                    filled: true,
                    fillColor: Colors.white,
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: Color(0xFFCBD5E1))),
                    enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: Color(0xFFCBD5E1))),
                    focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: Color(0xFF2563EB), width: 2)),
                  ),
                ),

                const SizedBox(height: 28),

                // SUBMIT BUTTON
                ElevatedButton.icon(
                  onPressed: _isSubmitting ? null : _submitReport,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF2563EB),
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(vertical: 16),
                    elevation: 2,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  ),
                  icon: _isSubmitting
                      ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                      : const Icon(Icons.send_rounded),
                  label: Text(
                    _isSubmitting ? 'SUBMITTING...' : 'Submit Daily Production Report',
                    style: const TextStyle(fontSize: 15, fontWeight: FontWeight.bold),
                  ),
                ),
                const SizedBox(height: 20),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _metaRow(String label1, String val1, String label2, String val2) {
    return Row(
      children: [
        Expanded(
          child: RichText(
            text: TextSpan(
              style: const TextStyle(fontSize: 12),
              children: [
                TextSpan(text: '$label1 ', style: const TextStyle(color: Color(0xFF64748B))),
                TextSpan(text: val1, style: const TextStyle(color: Color(0xFF0F172A), fontWeight: FontWeight.bold)),
              ],
            ),
          ),
        ),
        Expanded(
          child: RichText(
            text: TextSpan(
              style: const TextStyle(fontSize: 12),
              children: [
                TextSpan(text: '$label2 ', style: const TextStyle(color: Color(0xFF64748B))),
                TextSpan(text: val2, style: const TextStyle(color: Color(0xFF0F172A), fontWeight: FontWeight.bold)),
              ],
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildNumberInput(
    String label,
    TextEditingController controller, {
    IconData? icon,
    Color color = const Color(0xFF2563EB),
    bool isCompact = false,
  }) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (!isCompact) ...[
          Text(label, style: const TextStyle(color: Color(0xFF334155), fontSize: 12, fontWeight: FontWeight.bold)),
          const SizedBox(height: 6),
        ],
        TextField(
          controller: controller,
          keyboardType: TextInputType.number,
          style: const TextStyle(color: Color(0xFF0F172A), fontWeight: FontWeight.bold, fontSize: 15),
          decoration: InputDecoration(
            labelText: isCompact ? label : null,
            labelStyle: const TextStyle(color: Color(0xFF64748B), fontSize: 11),
            prefixIcon: icon != null ? Icon(icon, color: color, size: 20) : null,
            filled: true,
            fillColor: Colors.white,
            contentPadding: EdgeInsets.symmetric(horizontal: 12, vertical: isCompact ? 10 : 14),
            border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: Color(0xFFCBD5E1))),
            enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: Color(0xFFCBD5E1))),
            focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide(color: color, width: 2)),
          ),
        ),
      ],
    );
  }

  String _monthAbbr(int month) {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return months[month - 1];
  }
}
