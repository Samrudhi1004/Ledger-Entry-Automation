import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../providers/auth_provider.dart';
import '../providers/inspection_provider.dart';
import '../services/api_service.dart';
import 'app_home_screen.dart';
import 'inspection_voice_screen.dart';

class ParameterListScreen extends StatefulWidget {
  final Map<String, dynamic> template;
  final String? initialCategory;

  const ParameterListScreen({super.key, required this.template, this.initialCategory});

  @override
  State<ParameterListScreen> createState() => _ParameterListScreenState();
}

class _ParameterListScreenState extends State<ParameterListScreen> {
  bool _isLoading = true;
  List<dynamic> _parameters = [];
  bool _isGridView = true; // Default to modern 3-col App Grid view
  late String _activeCategoryTab; // 'process', 'product', 'all'

  bool get isInspector {
    final auth = Provider.of<AuthProvider>(context, listen: false);
    final role = (auth.userRole ?? '').toLowerCase();
    return role == 'inspector' || role == 'quality_engineer';
  }

  List<dynamic> get _displayedParameters {
    if (_activeCategoryTab == 'process') {
      return _parameters.where((p) => p['is_process_parameter'] == true).toList();
    } else if (_activeCategoryTab == 'product') {
      return _parameters.where((p) => p['is_process_parameter'] != true).toList();
    }
    return _parameters;
  }

  @override
  void initState() {
    super.initState();
    _activeCategoryTab = widget.initialCategory ?? 'all';
    _loadParameters();
  }

  Future<void> _loadParameters() async {
    try {
      final auth = Provider.of<AuthProvider>(context, listen: false);
      final role = (auth.userRole ?? '').toLowerCase();
      final isInspector = role == 'inspector' || role == 'quality_engineer';
      final templateId = widget.template['id'];

      if (templateId != null) {
        final loaded = await ApiService.getParameters(templateId);
        List<dynamic> combined = List.from(loaded);
        if (isInspector) {
          final procLoaded = await ApiService.getProcessParameters(templateId);
          for (var p in procLoaded) {
            p['is_process_parameter'] = true;
          }
          combined.addAll(procLoaded);
        }
        if (mounted) {
          setState(() {
            _parameters = combined;
            _isLoading = false;
          });
        }
      } else {
        if (mounted) {
          setState(() {
            _parameters = widget.template['parameters'] ?? [];
            _isLoading = false;
          });
        }
      }
    } catch (_) {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  Future<void> _startDataEntry({int startIndex = 0}) async {
    final provider = Provider.of<InspectionProvider>(context, listen: false);
    final auth = Provider.of<AuthProvider>(context, listen: false);
    final role = (auth.userRole ?? '').toLowerCase();
    final isInspector = role == 'inspector' || role == 'quality_engineer';

    final categoryFilter = _activeCategoryTab == 'process'
        ? 'process'
        : (_activeCategoryTab == 'product' ? 'product' : null);

    // Load parameters into provider state (supporting product or process parameter flow)
    await provider.loadParameters(
      widget.template,
      isFirstPiece: isInspector,
      categoryFilter: categoryFilter,
    );

    // Ensure inspection session is properly initialized with correct type
    final String type = isInspector ? 'first_piece' : 'hourly';
    if (provider.sessionId == null || provider.inspectionType != type) {
      await provider.startSession(
        trial: isInspector ? 1 : 0,
        inspectionType: type,
        hourlySlot: provider.hourlySlot,
      );
    }

    // Jump to requested parameter index
    provider.goToParameter(startIndex);

    if (mounted) {
      // Navigate to DATA ENTRY Screen (Step 5)
      Navigator.push(
        context,
        MaterialPageRoute(builder: (_) => const InspectionVoiceScreen()),
      );
    }
  }

  int _getParameterRule(Map<String, dynamic> param) {
    final type = (param['measurement_type'] ?? '').toString().toLowerCase();
    final name = (param['parameter_name'] ?? '').toString().toUpperCase();

    if (type == 'visual') return 2; // Rule 2: Visual
    if (type == 'min_limit' || name.contains('MIN')) return 31; // Rule 3A: Min limit
    if (type == 'max_limit' || type == 'surface' || name.contains('MAX')) return 32; // Rule 3B: Max limit
    return 1; // Rule 1: Range
  }

  String _formatSpec(Map<String, dynamic> param) {
    final rule = _getParameterRule(param);
    final unit = param['unit'] ?? 'mm';
    final nom = param['nominal_value'] ?? '0';

    if (rule == 2) {
      final code = (param['parameter_code'] ?? '').toString().toUpperCase();
      if (code == 'CHA-01' || nom == '0.5' || nom == '0.50') return '0.5x45°';
      if (code == 'CHM-01' || nom == '1' || nom == '1.00') return '1x45°';
      if (code == 'CHA-02' || nom == '2' || nom == '2.00') return '2x45°';
      return '$nom $unit Spec';
    } else if (rule == 31) {
      final minVal = param['lower_limit'] ?? nom;
      return '≥ $minVal $unit';
    } else if (rule == 32) {
      return '≤ $nom $unit';
    } else {
      final upper = param['upper_tolerance'] ?? '+0.00';
      final lower = param['lower_tolerance'] ?? '-0.00';
      final upperStr = upper.toString().startsWith('+') || upper.toString().startsWith('-') ? '$upper' : '+$upper';
      return '$nom ($upperStr / $lower) $unit';
    }
  }

  @override
  Widget build(BuildContext context) {
    final provider = Provider.of<InspectionProvider>(context);
    final selectedMachine = provider.selectedMachine;
    final selectedPart = provider.selectedPart;

    final machineCode = selectedMachine?['machine_code'] ?? 'CNC-01';
    final partNo = selectedPart?['part_number'] ?? 'FBT00222';
    final opTitle = widget.template['operation_name'] ?? 'Operation ${widget.template['version'] ?? 10}';
    final recordedCount = provider.recordedResults.length;
    final totalParams = _parameters.length;

    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 1,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_rounded, color: Color(0xFF0F172A)),
          onPressed: () => Navigator.pop(context),
        ),
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                  decoration: BoxDecoration(
                    color: const Color(0xFF6366F1).withValues(alpha: 0.2),
                    borderRadius: BorderRadius.circular(4),
                  ),
                  child: const Text(
                    'STEP 4 OF 5',
                    style: TextStyle(color: Color(0xFF818CF8), fontSize: 10, fontWeight: FontWeight.w900),
                  ),
                ),
                const SizedBox(width: 8),
                Text(
                  '$partNo · $machineCode',
                  style: const TextStyle(color: Color(0xFF94A3B8), fontSize: 11, fontWeight: FontWeight.w600),
                ),
              ],
            ),
            const SizedBox(height: 2),
            Text(
              opTitle,
              style: const TextStyle(color: Colors.white, fontSize: 15, fontWeight: FontWeight.bold),
            ),
          ],
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
          // View Switcher (Grid vs List)
          IconButton(
            icon: Icon(
              _isGridView ? Icons.view_list_rounded : Icons.grid_view_rounded,
              color: const Color(0xFF2563EB),
            ),
            tooltip: _isGridView ? 'Switch to List View' : 'Switch to Grid View',
            onPressed: () => setState(() => _isGridView = !_isGridView),
          ),
        ],
      ),
      body: SafeArea(
        child: Column(
          children: [
            // Top Summary Progress Card
            Container(
              margin: const EdgeInsets.fromLTRB(16, 12, 16, 8),
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                gradient: const LinearGradient(
                  colors: [Color(0xFF1E1B4B), Color(0xFF1E293B)],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: const Color(0xFF4338CA).withValues(alpha: 0.5)),
              ),
              child: Row(
                children: [
                  Container(
                    width: 44,
                    height: 44,
                    decoration: BoxDecoration(
                      color: const Color(0xFF4F46E5).withValues(alpha: 0.2),
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: const Color(0xFF6366F1)),
                    ),
                    child: const Icon(Icons.grid_view_rounded, color: Color(0xFF818CF8), size: 22),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Text(
                              'Parameter Matrix ($totalParams items)',
                              style: const TextStyle(color: Colors.white, fontSize: 13, fontWeight: FontWeight.bold),
                            ),
                            Text(
                              '$recordedCount / $totalParams Recorded',
                              style: const TextStyle(color: Color(0xFF34D399), fontSize: 11, fontWeight: FontWeight.bold),
                            ),
                          ],
                        ),
                        const SizedBox(height: 6),
                        ClipRRect(
                          borderRadius: BorderRadius.circular(6),
                          child: LinearProgressIndicator(
                            value: totalParams > 0 ? (recordedCount / totalParams) : 0,
                            minHeight: 6,
                            backgroundColor: const Color(0xFF334155),
                            valueColor: const AlwaysStoppedAnimation<Color>(Color(0xFF10B981)),
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),

            // Inspector Setup Parameter Category Selection Tabs
            if (isInspector)
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
                child: Row(
                  children: [
                    Expanded(
                      child: GestureDetector(
                        onTap: () => setState(() => _activeCategoryTab = 'process'),
                        child: AnimatedContainer(
                          duration: const Duration(milliseconds: 200),
                          padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 8),
                          decoration: BoxDecoration(
                            color: _activeCategoryTab == 'process' ? const Color(0xFF4338CA) : const Color(0xFF1E293B),
                            borderRadius: BorderRadius.circular(10),
                            border: Border.all(
                              color: _activeCategoryTab == 'process' ? const Color(0xFF818CF8) : const Color(0xFF334155),
                              width: _activeCategoryTab == 'process' ? 1.8 : 1.0,
                            ),
                          ),
                          child: Row(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              const Text('⚙️', style: TextStyle(fontSize: 12)),
                              const SizedBox(width: 4),
                              Flexible(
                                child: Text(
                                  'Process (${_parameters.where((p) => p['is_process_parameter'] == true).length})',
                                  overflow: TextOverflow.ellipsis,
                                  style: TextStyle(
                                    color: Colors.white,
                                    fontSize: 11,
                                    fontWeight: _activeCategoryTab == 'process' ? FontWeight.w900 : FontWeight.w600,
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: GestureDetector(
                        onTap: () => setState(() => _activeCategoryTab = 'product'),
                        child: AnimatedContainer(
                          duration: const Duration(milliseconds: 200),
                          padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 8),
                          decoration: BoxDecoration(
                            color: _activeCategoryTab == 'product' ? const Color(0xFF0284C7) : const Color(0xFF1E293B),
                            borderRadius: BorderRadius.circular(10),
                            border: Border.all(
                              color: _activeCategoryTab == 'product' ? const Color(0xFF38BDF8) : const Color(0xFF334155),
                              width: _activeCategoryTab == 'product' ? 1.8 : 1.0,
                            ),
                          ),
                          child: Row(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              const Text('📏', style: TextStyle(fontSize: 12)),
                              const SizedBox(width: 4),
                              Flexible(
                                child: Text(
                                  'Product (${_parameters.where((p) => p['is_process_parameter'] != true).length})',
                                  overflow: TextOverflow.ellipsis,
                                  style: TextStyle(
                                    color: Colors.white,
                                    fontSize: 11,
                                    fontWeight: _activeCategoryTab == 'product' ? FontWeight.w900 : FontWeight.w600,
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(width: 8),
                    GestureDetector(
                      onTap: () => setState(() => _activeCategoryTab = 'all'),
                      child: AnimatedContainer(
                        duration: const Duration(milliseconds: 200),
                        padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 10),
                        decoration: BoxDecoration(
                          color: _activeCategoryTab == 'all' ? const Color(0xFF334155) : const Color(0xFF0F172A),
                          borderRadius: BorderRadius.circular(10),
                          border: Border.all(
                            color: _activeCategoryTab == 'all' ? const Color(0xFF94A3B8) : const Color(0xFF1E293B),
                          ),
                        ),
                        child: Text(
                          'All (${_parameters.length})',
                          style: TextStyle(
                            color: _activeCategoryTab == 'all' ? Colors.white : const Color(0xFF94A3B8),
                            fontSize: 11,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
              ),

            // Instruction Banner
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 4),
              child: Row(
                children: [
                  const Icon(Icons.touch_app_rounded, color: Color(0xFF94A3B8), size: 14),
                  const SizedBox(width: 6),
                  Text(
                    isInspector
                        ? 'Tap tile to enter ${_activeCategoryTab.toUpperCase()} parameter'
                        : 'Tap any tile to inspect with Auto-Advance',
                    style: TextStyle(color: Colors.grey.shade400, fontSize: 11.5, fontWeight: FontWeight.w500),
                  ),
                  const Spacer(),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                    decoration: BoxDecoration(
                      color: const Color(0xFFEF4444).withValues(alpha: 0.15),
                      borderRadius: BorderRadius.circular(4),
                      border: Border.all(color: const Color(0xFFEF4444).withValues(alpha: 0.4)),
                    ),
                    child: const Row(
                      children: [
                        Icon(Icons.warning_amber_rounded, color: Color(0xFFEF4444), size: 10),
                        SizedBox(width: 3),
                        Text('◑ Critical', style: TextStyle(color: Color(0xFFF87171), fontSize: 9.5, fontWeight: FontWeight.bold)),
                      ],
                    ),
                  ),
                ],
              ),
            ),

            const SizedBox(height: 6),

            // Main Parameters Grid or List
            Expanded(
              child: _isLoading
                  ? const Center(child: CircularProgressIndicator(color: Color(0xFF6366F1)))
                  : _displayedParameters.isEmpty
                      ? Center(
                          child: Column(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              Icon(
                                _activeCategoryTab == 'process' ? Icons.settings_suggest_rounded : Icons.square_foot_rounded,
                                size: 42,
                                color: const Color(0xFF64748B),
                              ),
                              const SizedBox(height: 8),
                              Text(
                                'No ${_activeCategoryTab.toUpperCase()} parameters configured.',
                                style: const TextStyle(color: Color(0xFF94A3B8), fontWeight: FontWeight.bold, fontSize: 13),
                              ),
                            ],
                          ),
                        )
                      : _isGridView
                          ? _buildGridView(provider)
                          : _buildListView(provider),
            ),

            // Bottom Floating Action Button
            Container(
              padding: const EdgeInsets.fromLTRB(16, 10, 16, 14),
              decoration: BoxDecoration(
                color: const Color(0xFF0F172A),
                border: Border(top: BorderSide(color: Colors.white.withValues(alpha: 0.08))),
              ),
              child: ElevatedButton.icon(
                onPressed: () => _startDataEntry(startIndex: 0),
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF4F46E5),
                  foregroundColor: Colors.white,
                  minimumSize: const Size(double.infinity, 50),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                  elevation: 4,
                  shadowColor: const Color(0xFF4F46E5).withValues(alpha: 0.5),
                ),
                icon: const Icon(Icons.bolt_rounded, size: 22),
                label: Text(
                  recordedCount > 0 ? 'RESUME INSPECTION (AUTO-ADVANCE)' : 'START DATA ENTRY (AUTO-ADVANCE)',
                  style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 13.5, letterSpacing: 0.4),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  // 📱 Modern 3-Column App-Style Grid View
  Widget _buildGridView(InspectionProvider provider) {
    final list = _displayedParameters;
    return GridView.builder(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: 3,
        childAspectRatio: 0.78,
        crossAxisSpacing: 10,
        mainAxisSpacing: 10,
      ),
      itemCount: list.length,
      itemBuilder: (context, index) {
        final param = list[index];
        final code = param['parameter_code'] ?? param['code'] ?? 'P${index + 1}';
        final name = param['parameter_name'] ?? param['name'] ?? 'Param $code';
        final isCritical = param['is_critical'] == true;
        final rule = _getParameterRule(param);
        final spec = _formatSpec(param);

        final isRecorded = provider.isParamFilled(code);
        final status = provider.getParamStatus(code);
        final recordedVal = provider.getParamReading(code);

        // Color theme by Rule
        Color ruleColor;
        String ruleLabel;
        if (rule == 2) {
          ruleColor = const Color(0xFFA855F7); // Purple for Visual
          ruleLabel = 'Visual';
        } else if (rule == 31 || rule == 32) {
          ruleColor = const Color(0xFFF59E0B); // Amber for Limit
          ruleLabel = 'Limit';
        } else {
          ruleColor = const Color(0xFF3B82F6); // Blue for Range
          ruleLabel = 'Range';
        }

        // Status border & background
        Color cardBg = const Color(0xFF1E293B);
        Color borderCol = const Color(0xFF334155);

        if (isRecorded) {
          if (status == 'ok') {
            cardBg = const Color(0xFF064E3B).withValues(alpha: 0.5);
            borderCol = const Color(0xFF10B981);
          } else {
            cardBg = const Color(0xFF7F1D1D).withValues(alpha: 0.5);
            borderCol = const Color(0xFFEF4444);
          }
        } else if (isCritical) {
          borderCol = const Color(0xFFEF4444).withValues(alpha: 0.6);
        }

        return Material(
          color: Colors.transparent,
          child: InkWell(
            onTap: () => _startDataEntry(startIndex: index),
            borderRadius: BorderRadius.circular(14),
            child: Container(
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(
                color: cardBg,
                borderRadius: BorderRadius.circular(14),
                border: Border.all(color: borderCol, width: isRecorded || isCritical ? 1.6 : 1.0),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withValues(alpha: 0.25),
                    blurRadius: 4,
                    offset: const Offset(0, 2),
                  ),
                ],
              ),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  // Top Row: Rule Badge + Critical Icon
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 2),
                        decoration: BoxDecoration(
                          color: ruleColor.withValues(alpha: 0.2),
                          borderRadius: BorderRadius.circular(4),
                        ),
                        child: Text(
                          ruleLabel,
                          style: TextStyle(color: ruleColor, fontSize: 8.5, fontWeight: FontWeight.bold),
                        ),
                      ),
                      if (isCritical)
                        Container(
                          width: 8,
                          height: 8,
                          decoration: const BoxDecoration(
                            shape: BoxShape.circle,
                            color: Color(0xFFEF4444),
                            boxShadow: [
                              BoxShadow(color: Color(0xFFEF4444), blurRadius: 4, spreadRadius: 1),
                            ],
                          ),
                        ),
                    ],
                  ),

                  // Center: Code & Name
                  Column(
                    children: [
                      Text(
                        code,
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 16,
                          fontWeight: FontWeight.w900,
                          letterSpacing: 0.5,
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        name,
                        maxLines: 2,
                        textAlign: TextAlign.center,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                          color: Color(0xFFCBD5E1),
                          fontSize: 10,
                          fontWeight: FontWeight.w600,
                          height: 1.1,
                        ),
                      ),
                      const SizedBox(height: 3),
                      Text(
                        spec,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(
                          color: Colors.grey.shade400,
                          fontSize: 9,
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                    ],
                  ),

                  // Bottom Status Badge
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.symmetric(vertical: 3),
                    decoration: BoxDecoration(
                      color: isRecorded
                          ? (status == 'ok'
                              ? const Color(0xFF10B981).withValues(alpha: 0.2)
                              : const Color(0xFFEF4444).withValues(alpha: 0.2))
                          : const Color(0xFF0F172A),
                      borderRadius: BorderRadius.circular(6),
                    ),
                    child: Center(
                      child: isRecorded
                          ? Row(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                Icon(
                                  status == 'ok' ? Icons.check_circle_rounded : Icons.cancel_rounded,
                                  color: status == 'ok' ? const Color(0xFF34D399) : const Color(0xFFF87171),
                                  size: 11,
                                ),
                                const SizedBox(width: 3),
                                Text(
                                  recordedVal != null ? '$recordedVal' : (status == 'ok' ? 'OK' : 'FAIL'),
                                  style: TextStyle(
                                    color: status == 'ok' ? const Color(0xFF34D399) : const Color(0xFFF87171),
                                    fontSize: 9.5,
                                    fontWeight: FontWeight.bold,
                                  ),
                                ),
                              ],
                            )
                          : const Text(
                              '⭕ Pending',
                              style: TextStyle(color: Color(0xFF64748B), fontSize: 9, fontWeight: FontWeight.bold),
                            ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        );
      },
    );
  }

  // 📋 Detailed List View
  Widget _buildListView(InspectionProvider provider) {
    final list = _displayedParameters;
    return ListView.builder(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
      itemCount: list.length,
      itemBuilder: (context, index) {
        final param = list[index];
        final code = param['parameter_code'] ?? param['code'] ?? 'P${index + 1}';
        final name = param['parameter_name'] ?? param['name'] ?? 'Parameter $code';
        final isCritical = param['is_critical'] == true;
        final spec = _formatSpec(param);
        final technique = param['measurement_technique'] ?? 'Standard';

        final isRecorded = provider.isParamFilled(code);
        final status = provider.getParamStatus(code);

        return Container(
          margin: const EdgeInsets.only(bottom: 8),
          decoration: BoxDecoration(
            color: const Color(0xFF1E293B),
            borderRadius: BorderRadius.circular(12),
            border: Border.all(
              color: isRecorded
                  ? (status == 'ok' ? const Color(0xFF10B981) : const Color(0xFFEF4444))
                  : (isCritical ? const Color(0xFFEF4444).withValues(alpha: 0.5) : const Color(0xFF334155)),
            ),
          ),
          child: ListTile(
            contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
            onTap: () => _startDataEntry(startIndex: index),
            leading: Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
              decoration: BoxDecoration(
                color: const Color(0xFF0F172A),
                borderRadius: BorderRadius.circular(8),
              ),
              child: Text(
                code,
                style: const TextStyle(color: Color(0xFF818CF8), fontWeight: FontWeight.w900, fontSize: 13),
              ),
            ),
            title: Row(
              children: [
                Expanded(
                  child: Text(
                    name,
                    style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 13.5),
                  ),
                ),
                if (isCritical)
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                    decoration: BoxDecoration(
                      color: const Color(0xFFEF4444).withValues(alpha: 0.2),
                      borderRadius: BorderRadius.circular(4),
                    ),
                    child: const Text('CRITICAL', style: TextStyle(color: Color(0xFFF87171), fontSize: 9, fontWeight: FontWeight.bold)),
                  ),
              ],
            ),
            subtitle: Text(
              'Spec: $spec  •  $technique',
              style: const TextStyle(color: Color(0xFF94A3B8), fontSize: 11.5),
            ),
            trailing: isRecorded
                ? Icon(
                    status == 'ok' ? Icons.check_circle_rounded : Icons.cancel_rounded,
                    color: status == 'ok' ? const Color(0xFF10B981) : const Color(0xFFEF4444),
                  )
                : const Icon(Icons.arrow_forward_ios_rounded, color: Color(0xFF64748B), size: 14),
          ),
        );
      },
    );
  }
}
