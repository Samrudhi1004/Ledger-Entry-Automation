import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/inspection_provider.dart';
import '../providers/company_provider.dart';
import '../providers/auth_provider.dart';
import '../services/api_service.dart';

class JhInspectionScreen extends StatefulWidget {
  const JhInspectionScreen({super.key});

  @override
  State<JhInspectionScreen> createState() => _JhInspectionScreenState();
}

class _JhInspectionScreenState extends State<JhInspectionScreen> {
  bool _isLoading = true;
  bool _isSubmitting = false;
  String? _errorMessage;

  List<dynamic> _items = [];
  List<dynamic> _machines = [];
  String _selectedShift = 'I';
  final DateTime _selectedDate = DateTime.now();
  final TextEditingController _remarksController = TextEditingController();

  // Collapsed state for assembly groups
  final Set<String> _collapsedAssemblies = {};

  // Item evaluation state: itemId -> { 'status': 'OK'|'NOT_OK'|'CORRECTED', 'remark': '', 'action_taken': '' }
  final Map<int, Map<String, dynamic>> _itemEvaluations = {};

  @override
  void initState() {
    super.initState();
    _fetchData();
  }

  @override
  void dispose() {
    _remarksController.dispose();
    super.dispose();
  }

  Future<void> _fetchData() async {
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    final auth = Provider.of<AuthProvider>(context, listen: false);
    if (!auth.isOperator) {
      if (mounted) {
        setState(() {
          _isLoading = false;
          _errorMessage = 'J-H Autonomous Maintenance केवल मशीन ऑपरेटरों के लिए है (Restricted to Operators only).';
        });
      }
      return;
    }

    try {
      // 1. Keep company shift configuration up to date
      await Provider.of<CompanyProvider>(context, listen: false).fetchCompanyDetails();

      // 2. Fetch floor machines and auto-select if needed
      final machines = await ApiService.getMachines();
      _machines = machines;
      if (mounted) {
        final inspectionProvider = Provider.of<InspectionProvider>(context, listen: false);
        if (inspectionProvider.selectedMachine == null && machines.isNotEmpty) {
          inspectionProvider.selectMachine(machines.first);
        }
      }

      // 3. Fetch 27 checklist items
      final items = await ApiService.getJhChecklistItems();
      if (mounted) {
        setState(() {
          _items = items;
          _isLoading = false;
          // Pre-populate with OK by default for maximum shop floor efficiency
          for (var item in items) {
            final id = item['id'] as int;
            if (!_itemEvaluations.containsKey(id)) {
              _itemEvaluations[id] = {
                'status': 'OK',
                'remark': '',
                'action_taken': '',
              };
            }
          }
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _isLoading = false;
          _errorMessage = 'चेकलिस्ट लोड करने में विफल: $e';
        });
      }
    }
  }

  void _markAllAs(String status) {
    setState(() {
      for (var item in _items) {
        final id = item['id'] as int;
        _itemEvaluations[id] = {
          'status': status,
          'remark': _itemEvaluations[id]?['remark'] ?? '',
          'action_taken': _itemEvaluations[id]?['action_taken'] ?? '',
        };
      }
    });

    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Row(
          children: [
            const Icon(Icons.check_circle_rounded, color: Colors.white, size: 20),
            const SizedBox(width: 8),
            Text('सभी ${_items.length} चेकपॉइंट $status मार्क किए गए'),
          ],
        ),
        backgroundColor: const Color(0xFF16A34A),
        duration: const Duration(seconds: 2),
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
      ),
    );
  }

  void _showMachinePicker(BuildContext context) {
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      isScrollControlled: true,
      builder: (ctx) {
        return Container(
          decoration: const BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
          ),
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
          constraints: BoxConstraints(
            maxHeight: MediaQuery.of(context).size.height * 0.7,
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Center(
                child: Container(
                  width: 40,
                  height: 4,
                  margin: const EdgeInsets.only(bottom: 16),
                  decoration: BoxDecoration(
                    color: const Color(0xFFCBD5E1),
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
              ),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: const [
                  Text(
                    'निरीक्षण के लिए मशीन चुनें',
                    style: TextStyle(fontSize: 17, fontWeight: FontWeight.w800, color: Color(0xFF0F172A)),
                  ),
                ],
              ),
              const SizedBox(height: 4),
              const Text(
                'चेकलिस्ट और शिफ्ट रिपोर्ट इसी मशीन के लिए दर्ज होगी।',
                style: TextStyle(fontSize: 12, color: Color(0xFF64748B)),
              ),
              const SizedBox(height: 16),
              if (_machines.isEmpty)
                const Padding(
                  padding: EdgeInsets.all(24.0),
                  child: Center(child: Text('कोई मशीन नहीं मिली। नेटवर्क कनेक्शन जांचें।')),
                )
              else
                Expanded(
                  child: ListView.separated(
                    itemCount: _machines.length,
                    separatorBuilder: (c, i) => const Divider(height: 1, color: Color(0xFFF1F5F9)),
                    itemBuilder: (ctx, idx) {
                      final m = _machines[idx];
                      final isSelected = Provider.of<InspectionProvider>(context).selectedMachine?['id'] == m['id'];

                      return InkWell(
                        onTap: () {
                          Provider.of<InspectionProvider>(context, listen: false).selectMachine(m);
                          Navigator.pop(ctx);
                        },
                        borderRadius: BorderRadius.circular(12),
                        child: Container(
                          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                          decoration: BoxDecoration(
                            color: isSelected ? const Color(0xFFF0FDF4) : Colors.transparent,
                            borderRadius: BorderRadius.circular(12),
                            border: isSelected ? Border.all(color: const Color(0xFF86EFAC)) : null,
                          ),
                          child: Row(
                            children: [
                              Container(
                                padding: const EdgeInsets.all(8),
                                decoration: BoxDecoration(
                                  color: isSelected ? const Color(0xFFDCFCE7) : const Color(0xFFF1F5F9),
                                  borderRadius: BorderRadius.circular(8),
                                ),
                                child: Icon(
                                  Icons.precision_manufacturing_rounded,
                                  size: 20,
                                  color: isSelected ? const Color(0xFF16A34A) : const Color(0xFF64748B),
                                ),
                              ),
                              const SizedBox(width: 12),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      m['machine_code'] ?? 'M-01',
                                      style: TextStyle(
                                        fontSize: 15,
                                        fontWeight: FontWeight.w700,
                                        color: isSelected ? const Color(0xFF166534) : const Color(0xFF0F172A),
                                      ),
                                    ),
                                    Text(
                                      m['name'] ?? 'Production Unit',
                                      style: const TextStyle(fontSize: 12, color: Color(0xFF64748B)),
                                    ),
                                  ],
                                ),
                              ),
                              if (isSelected)
                                const Icon(Icons.check_circle_rounded, color: Color(0xFF16A34A), size: 22),
                            ],
                          ),
                        ),
                      );
                    },
                  ),
                ),
            ],
          ),
        );
      },
    );
  }

  Future<void> _submitInspection() async {
    final inspectionProvider = Provider.of<InspectionProvider>(context, listen: false);
    final machine = inspectionProvider.selectedMachine;

    if (machine == null || machine['id'] == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('कृपया पहले मशीन चुनें।'),
          backgroundColor: Color(0xFFDC2626),
          behavior: SnackBarBehavior.floating,
        ),
      );
      _showMachinePicker(context);
      return;
    }

    // Build payload
    final resultsPayload = <Map<String, dynamic>>[];
    for (var item in _items) {
      final id = item['id'] as int;
      final eval = _itemEvaluations[id];
      resultsPayload.add({
        'item_id': id,
        'status': eval?['status'] ?? 'OK',
        'remark': eval?['remark'] ?? '',
        'action_taken': eval?['action_taken'] ?? '',
      });
    }

    final payload = {
      'machine_id': machine['id'],
      'date': "${_selectedDate.year}-${_selectedDate.month.toString().padLeft(2, '0')}-${_selectedDate.day.toString().padLeft(2, '0')}",
      'shift': _selectedShift,
      'overall_remarks': _remarksController.text.trim(),
      'results': resultsPayload,
    };

    setState(() => _isSubmitting = true);

    final res = await ApiService.submitJhInspection(payload);

    setState(() => _isSubmitting = false);

    if (res['success'] == true) {
      if (!mounted) return;
      showDialog(
        context: context,
        barrierDismissible: false,
        builder: (ctx) => AlertDialog(
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
          title: Row(
            children: const [
              Icon(Icons.check_circle_rounded, color: Color(0xFF16A34A), size: 28),
              SizedBox(width: 10),
              Text('जेएच निरीक्षण दर्ज हुआ', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
            ],
          ),
          content: Text(
            'शिफ्ट $_selectedShift जेएच निरीक्षण मशीन ${machine['machine_code'] ?? 'चयनित मशीन'} के लिए सफलतापूर्वक सेव हुआ।\n\n'
            'कुल चेकपॉइंट: ${_items.length}\n'
            '✓ सही: ${_countStatus('OK')}  |  ✕ ख़राब: ${_countStatus('NOT_OK')}  |  ⊗ ठीक किया: ${_countStatus('CORRECTED')}',
            style: const TextStyle(fontSize: 14, color: Color(0xFF334155), height: 1.4),
          ),
          actions: [
            ElevatedButton(
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF16A34A),
                padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 10),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
              ),
              onPressed: () {
                Navigator.pop(ctx);
                Navigator.pop(context);
              },
              child: const Text('होम पर वापस जाएं', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
            ),
          ],
        ),
      );
    } else {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(res['message'] ?? 'निरीक्षण सबमिट करने में विफलता।'),
          backgroundColor: const Color(0xFFDC2626),
          behavior: SnackBarBehavior.floating,
        ),
      );
    }
  }

  int _countStatus(String status) {
    int count = 0;
    for (var eval in _itemEvaluations.values) {
      if (eval['status'] == status) count++;
    }
    return count;
  }

  String _getHindiAssembly(String name) {
    final clean = name.trim();
    if (clean.contains('1')) return '१. मशीन फ्रंट साइड';
    if (clean.contains('2')) return '२. फिक्सचर';
    if (clean.contains('3')) return '३. टीच पेंडेंट';
    if (clean.contains('4')) return '४. रोबोट';
    if (clean.contains('5')) return '५. ऑटो नोजल क्लीनिंग';
    if (clean.contains('6')) return '६. टीटीओ / टॉर्च';
    return clean;
  }

  String _getOnlyHindi(String text) {
    if (text.isEmpty) return '';
    final openParen = text.indexOf('(');
    if (openParen != -1) {
      final before = text.substring(0, openParen).trim();
      if (before.isNotEmpty) return before;
    }
    return text.trim();
  }

  @override
  Widget build(BuildContext context) {
    final inspectionProvider = Provider.of<InspectionProvider>(context);
    final companyProvider = Provider.of<CompanyProvider>(context);
    final authProvider = Provider.of<AuthProvider>(context);
    final machine = inspectionProvider.selectedMachine;

    // Shift Schedule: 12h -> 2 shifts ('I', 'II'); 8h -> 3 shifts ('I', 'II', 'III')
    final int effectiveShiftHours = (machine != null && machine['shift_duration_hours'] != null)
        ? (machine['shift_duration_hours'] is int
            ? machine['shift_duration_hours']
            : int.tryParse(machine['shift_duration_hours'].toString()) ?? companyProvider.shiftHours)
        : companyProvider.shiftHours;

    final List<String> shifts = effectiveShiftHours == 12 ? const ['I', 'II'] : const ['I', 'II', 'III'];

    // Auto-set to operator's assigned shift if locked
    if (authProvider.isShiftLocked && shifts.contains(authProvider.assignedShift) && _selectedShift != authProvider.assignedShift) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) {
          setState(() {
            _selectedShift = authProvider.assignedShift;
          });
        }
      });
    } else if (!shifts.contains(_selectedShift)) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) {
          setState(() {
            _selectedShift = 'I';
          });
        }
      });
    }

    // Group items by Assembly
    final Map<String, List<dynamic>> groupedItems = {};
    for (var it in _items) {
      final assembly = it['assembly'] as String? ?? 'सामान्य';
      groupedItems.putIfAbsent(assembly, () => []).add(it);
    }

    final okCount = _countStatus('OK');
    final notOkCount = _countStatus('NOT_OK');
    final correctedCount = _countStatus('CORRECTED');

    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: const [
            Text(
              'जेएच-निरीक्षण (Autonomous Inspection)',
              style: TextStyle(fontSize: 16, fontWeight: FontWeight.w800, color: Color(0xFF0F172A)),
            ),
            Text(
              'दैनिक शिफ्ट चेकलिस्ट (Form QF/MF-08)',
              style: TextStyle(fontSize: 11, color: Color(0xFF64748B)),
            ),
          ],
        ),
        backgroundColor: Colors.white,
        elevation: 0.5,
        iconTheme: const IconThemeData(color: Color(0xFF0F172A)),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh_rounded),
            tooltip: 'रिफ्रेश करें',
            onPressed: _fetchData,
          ),
        ],
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator(color: Color(0xFF16A34A)))
          : _errorMessage != null
              ? Center(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Text(_errorMessage!, style: const TextStyle(color: Color(0xFFDC2626))),
                      const SizedBox(height: 12),
                      ElevatedButton(onPressed: _fetchData, child: const Text('पुनः प्रयास करें')),
                    ],
                  ),
                )
              : Column(
                  children: [
                    // TOP CONTROL CARD: Machine & Shift Selector
                    Container(
                      margin: const EdgeInsets.all(12),
                      padding: const EdgeInsets.all(14),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(14),
                        border: Border.all(color: const Color(0xFFE2E8F0)),
                        boxShadow: const [
                          BoxShadow(
                            color: Color(0x08000000),
                            blurRadius: 8,
                            offset: Offset(0, 2),
                          ),
                        ],
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          // Machine and Shifts Row
                          Row(
                            children: [
                              // Interactive Machine Selector
                              Expanded(
                                child: InkWell(
                                  onTap: () => _showMachinePicker(context),
                                  borderRadius: BorderRadius.circular(10),
                                  child: Container(
                                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                                    decoration: BoxDecoration(
                                      color: const Color(0xFFF8FAFC),
                                      borderRadius: BorderRadius.circular(10),
                                      border: Border.all(color: const Color(0xFFE2E8F0)),
                                    ),
                                    child: Row(
                                      children: [
                                        Container(
                                          padding: const EdgeInsets.all(6),
                                          decoration: BoxDecoration(
                                            color: const Color(0xFFDCFCE7),
                                            borderRadius: BorderRadius.circular(8),
                                          ),
                                          child: const Icon(
                                            Icons.precision_manufacturing_rounded,
                                            size: 18,
                                            color: Color(0xFF16A34A),
                                          ),
                                        ),
                                        const SizedBox(width: 8),
                                        Expanded(
                                          child: Column(
                                            crossAxisAlignment: CrossAxisAlignment.start,
                                            children: [
                                              const Text(
                                                'मशीन (MACHINE)',
                                                style: TextStyle(
                                                  fontSize: 9,
                                                  fontWeight: FontWeight.w800,
                                                  color: Color(0xFF94A3B8),
                                                  letterSpacing: 0.5,
                                                ),
                                              ),
                                              Text(
                                                machine != null
                                                    ? "${machine['machine_code'] ?? 'M-01'} • ${machine['name'] ?? ''}"
                                                    : 'मशीन चुनें (टैप करें)',
                                                style: TextStyle(
                                                  fontSize: 13,
                                                  fontWeight: FontWeight.w800,
                                                  color: machine != null
                                                      ? const Color(0xFF0F172A)
                                                      : const Color(0xFF2563EB),
                                                ),
                                                maxLines: 1,
                                                overflow: TextOverflow.ellipsis,
                                              ),
                                            ],
                                          ),
                                        ),
                                        const Icon(Icons.unfold_more_rounded, size: 18, color: Color(0xFF94A3B8)),
                                      ],
                                    ),
                                  ),
                                ),
                              ),

                              const SizedBox(width: 10),

                              // Shift Segmented Pills
                              Row(
                                children: shifts.map((shift) {
                                  final isAllowed = authProvider.canAccessShift(shift);
                                  final isSelected = _selectedShift == shift;
                                  return GestureDetector(
                                    onTap: isAllowed
                                        ? () => setState(() => _selectedShift = shift)
                                        : () {
                                            ScaffoldMessenger.of(context).showSnackBar(
                                              SnackBar(
                                                content: Text('🔒 आप केवल शिफ्ट ${authProvider.assignedShift} के लिए अधिकृत हैं।'),
                                                backgroundColor: const Color(0xFFDC2626),
                                                duration: const Duration(seconds: 2),
                                              ),
                                            );
                                          },
                                    child: Container(
                                      margin: const EdgeInsets.only(left: 6),
                                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 10),
                                      decoration: BoxDecoration(
                                        color: !isAllowed
                                            ? const Color(0xFFF1F5F9)
                                            : isSelected
                                                ? const Color(0xFF16A34A)
                                                : const Color(0xFFFFFFFF),
                                        borderRadius: BorderRadius.circular(10),
                                        border: Border.all(
                                          color: !isAllowed
                                              ? const Color(0xFFE2E8F0)
                                              : isSelected
                                                  ? const Color(0xFF16A34A)
                                                  : const Color(0xFFCBD5E1),
                                        ),
                                        boxShadow: isSelected && isAllowed
                                            ? const [
                                                BoxShadow(
                                                  color: Color(0x3316A34A),
                                                  blurRadius: 4,
                                                  offset: Offset(0, 2),
                                                ),
                                              ]
                                            : null,
                                      ),
                                      child: Row(
                                        mainAxisSize: MainAxisSize.min,
                                        children: [
                                          if (!isAllowed) ...[
                                            const Icon(Icons.lock_rounded, size: 12, color: Color(0xFF94A3B8)),
                                            const SizedBox(width: 4),
                                          ],
                                          Text(
                                            'शिफ्ट $shift',
                                            style: TextStyle(
                                              fontSize: 12,
                                              fontWeight: isSelected ? FontWeight.w800 : FontWeight.w600,
                                              color: !isAllowed
                                                  ? const Color(0xFF94A3B8)
                                                  : isSelected
                                                      ? Colors.white
                                                      : const Color(0xFF475569),
                                            ),
                                          ),
                                        ],
                                      ),
                                    ),
                                  );
                                }).toList(),
                              ),
                            ],
                          ),

                          const SizedBox(height: 12),

                          // Status Counters & Quick Action
                          Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              // Metric Badges
                              Row(
                                children: [
                                  _buildCounterBadge(
                                    label: '✓ $okCount सही',
                                    bg: const Color(0xFFDCFCE7),
                                    fg: const Color(0xFF15803D),
                                  ),
                                  const SizedBox(width: 6),
                                  _buildCounterBadge(
                                    label: '✕ $notOkCount ख़राब',
                                    bg: notOkCount > 0 ? const Color(0xFFFEE2E2) : const Color(0xFFF8FAFC),
                                    fg: notOkCount > 0 ? const Color(0xFFB91C1C) : const Color(0xFF94A3B8),
                                  ),
                                  const SizedBox(width: 6),
                                  _buildCounterBadge(
                                    label: '⊗ $correctedCount ठीक किया',
                                    bg: correctedCount > 0 ? const Color(0xFFFEF3C7) : const Color(0xFFF8FAFC),
                                    fg: correctedCount > 0 ? const Color(0xFFB45309) : const Color(0xFF94A3B8),
                                  ),
                                ],
                              ),

                              // Mark All OK Action Button
                              InkWell(
                                onTap: () => _markAllAs('OK'),
                                borderRadius: BorderRadius.circular(8),
                                child: Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                                  decoration: BoxDecoration(
                                    color: const Color(0xFFF0FDF4),
                                    borderRadius: BorderRadius.circular(8),
                                    border: Border.all(color: const Color(0xFF86EFAC)),
                                  ),
                                  child: Row(
                                    mainAxisSize: MainAxisSize.min,
                                    children: const [
                                      Icon(Icons.done_all_rounded, size: 15, color: Color(0xFF16A34A)),
                                      SizedBox(width: 4),
                                      Text(
                                        'सब सही मार्क करें',
                                        style: TextStyle(
                                          fontSize: 12,
                                          fontWeight: FontWeight.w800,
                                          color: Color(0xFF16A34A),
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ],
                      ),
                    ),

                    // CHECKLIST BODY (Grouped by Assembly)
                    Expanded(
                      child: ListView.builder(
                        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
                        itemCount: groupedItems.keys.length,
                        itemBuilder: (context, groupIdx) {
                          final rawAssemblyName = groupedItems.keys.elementAt(groupIdx);
                          final hindiAssemblyName = _getHindiAssembly(rawAssemblyName);
                          final itemsInGroup = groupedItems[rawAssemblyName]!;
                          final isCollapsed = _collapsedAssemblies.contains(rawAssemblyName);

                          // Count passed in this group
                          int groupOk = 0;
                          for (var it in itemsInGroup) {
                            if (_itemEvaluations[it['id']]?['status'] == 'OK') groupOk++;
                          }

                          return Container(
                            margin: const EdgeInsets.only(bottom: 12),
                            decoration: BoxDecoration(
                              color: Colors.white,
                              borderRadius: BorderRadius.circular(14),
                              border: Border.all(color: const Color(0xFFE2E8F0)),
                              boxShadow: const [
                                BoxShadow(
                                  color: Color(0x06000000),
                                  blurRadius: 6,
                                  offset: Offset(0, 2),
                                ),
                              ],
                            ),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                // Accordion Header
                                InkWell(
                                  onTap: () {
                                    setState(() {
                                      if (isCollapsed) {
                                        _collapsedAssemblies.remove(rawAssemblyName);
                                      } else {
                                        _collapsedAssemblies.add(rawAssemblyName);
                                      }
                                    });
                                  },
                                  borderRadius: const BorderRadius.vertical(top: Radius.circular(13)),
                                  child: Container(
                                    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                                    decoration: BoxDecoration(
                                      color: const Color(0xFFF8FAFC),
                                      borderRadius: BorderRadius.vertical(
                                        top: const Radius.circular(13),
                                        bottom: isCollapsed ? const Radius.circular(13) : Radius.zero,
                                      ),
                                      border: isCollapsed
                                          ? null
                                          : const Border(bottom: BorderSide(color: Color(0xFFE2E8F0))),
                                    ),
                                    child: Row(
                                      children: [
                                        Icon(
                                          _getAssemblyIcon(rawAssemblyName),
                                          size: 18,
                                          color: const Color(0xFF334155),
                                        ),
                                        const SizedBox(width: 8),
                                        Expanded(
                                          child: Text(
                                            hindiAssemblyName,
                                            style: const TextStyle(
                                              fontSize: 13,
                                              fontWeight: FontWeight.w800,
                                              color: Color(0xFF0F172A),
                                              letterSpacing: 0.3,
                                            ),
                                          ),
                                        ),
                                        // Completion chip
                                        Container(
                                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                                          decoration: BoxDecoration(
                                            color: groupOk == itemsInGroup.length
                                                ? const Color(0xFFDCFCE7)
                                                : const Color(0xFFF1F5F9),
                                            borderRadius: BorderRadius.circular(12),
                                          ),
                                          child: Text(
                                            '$groupOk/${itemsInGroup.length} ✓',
                                            style: TextStyle(
                                              fontSize: 11,
                                              fontWeight: FontWeight.w700,
                                              color: groupOk == itemsInGroup.length
                                                  ? const Color(0xFF15803D)
                                                  : const Color(0xFF64748B),
                                            ),
                                          ),
                                        ),
                                        const SizedBox(width: 6),
                                        Icon(
                                          isCollapsed ? Icons.keyboard_arrow_down_rounded : Icons.keyboard_arrow_up_rounded,
                                          size: 20,
                                          color: const Color(0xFF94A3B8),
                                        ),
                                      ],
                                    ),
                                  ),
                                ),

                                // Checkpoint Items
                                if (!isCollapsed)
                                  ListView.separated(
                                    shrinkWrap: true,
                                    physics: const NeverScrollableScrollPhysics(),
                                    itemCount: itemsInGroup.length,
                                    separatorBuilder: (c, i) => const Divider(height: 1, color: Color(0xFFF1F5F9)),
                                    itemBuilder: (context, idx) {
                                      final item = itemsInGroup[idx];
                                      return _buildCheckpointItem(item);
                                    },
                                  ),
                              ],
                            ),
                          );
                        },
                      ),
                    ),

                    // BOTTOM DOCKED SUBMIT BAR
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                      decoration: const BoxDecoration(
                        color: Colors.white,
                        border: Border(top: BorderSide(color: Color(0xFFE2E8F0))),
                        boxShadow: [
                          BoxShadow(
                            color: Color(0x0D000000),
                            offset: Offset(0, -4),
                            blurRadius: 10,
                          ),
                        ],
                      ),
                      child: SafeArea(
                        child: Column(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            // Compact Notes Field
                            TextField(
                              controller: _remarksController,
                              decoration: InputDecoration(
                                hintText: 'कुल रिमार्क्स / नोट्स (वैकल्पिक)...',
                                hintStyle: const TextStyle(fontSize: 12, color: Color(0xFF94A3B8)),
                                isDense: true,
                                prefixIcon: const Icon(Icons.edit_note_rounded, size: 20, color: Color(0xFF94A3B8)),
                                contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                                border: OutlineInputBorder(
                                  borderRadius: BorderRadius.circular(10),
                                  borderSide: const BorderSide(color: Color(0xFFE2E8F0)),
                                ),
                                enabledBorder: OutlineInputBorder(
                                  borderRadius: BorderRadius.circular(10),
                                  borderSide: const BorderSide(color: Color(0xFFE2E8F0)),
                                ),
                                focusedBorder: OutlineInputBorder(
                                  borderRadius: BorderRadius.circular(10),
                                  borderSide: const BorderSide(color: Color(0xFF16A34A)),
                                ),
                                filled: true,
                                fillColor: const Color(0xFFF8FAFC),
                              ),
                              style: const TextStyle(fontSize: 13),
                            ),

                            const SizedBox(height: 10),

                            // Submit Button
                            SizedBox(
                              width: double.infinity,
                              height: 48,
                              child: ElevatedButton.icon(
                                style: ElevatedButton.styleFrom(
                                  backgroundColor: const Color(0xFF16A34A),
                                  elevation: 1,
                                  shadowColor: const Color(0x3316A34A),
                                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                                ),
                                icon: _isSubmitting
                                    ? const SizedBox(
                                        width: 18,
                                        height: 18,
                                        child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2),
                                      )
                                    : const Icon(Icons.check_circle_outline_rounded, size: 20, color: Colors.white),
                                label: Text(
                                  _isSubmitting ? 'डेटा सेव हो रहा है...' : 'शिफ्ट $_selectedShift जेएच निरीक्षण सबमिट करें',
                                  style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w800, color: Colors.white),
                                ),
                                onPressed: _isSubmitting ? null : _submitInspection,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ],
                ),
    );
  }

  Widget _buildCounterBadge({required String label, required Color bg, required Color fg}) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 5),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(8),
      ),
      child: Text(
        label,
        style: TextStyle(fontSize: 11, fontWeight: FontWeight.w800, color: fg),
      ),
    );
  }

  IconData _getAssemblyIcon(String name) {
    final lower = name.toLowerCase();
    if (lower.contains('robot') || lower.contains('रोबोट')) return Icons.smart_toy_rounded;
    if (lower.contains('fixture') || lower.contains('फिक्सचर')) return Icons.handyman_rounded;
    if (lower.contains('pendant') || lower.contains('पेंडेंट')) return Icons.settings_remote_rounded;
    if (lower.contains('nozzle') || lower.contains('नोजल')) return Icons.cleaning_services_rounded;
    if (lower.contains('torch') || lower.contains('tto') || lower.contains('टॉर्च')) return Icons.flash_on_rounded;
    return Icons.settings_suggest_rounded;
  }

  Widget _buildCheckpointItem(dynamic item) {
    final itemId = item['id'] as int;
    final subNo = item['sub_no'] as String? ?? '';
    final subAssembly = item['sub_assembly'] as String? ?? '';
    final rawCheckPoint = item['check_point'] as String? ?? '';
    final rawStandard = item['standard'] as String? ?? '';
    final toolType = item['tool_type'] as String? ?? 'VISUAL';
    final timing = item['timing_sec'] as String? ?? '';
    final eval = _itemEvaluations[itemId] ?? {'status': 'OK', 'remark': '', 'action_taken': ''};
    final currentStatus = eval['status'] as String? ?? 'OK';

    final isNotOk = currentStatus == 'NOT_OK';
    final isCorrected = currentStatus == 'CORRECTED';

    // Pure Hindi extraction
    final hindiCheckPoint = _getOnlyHindi(rawCheckPoint);
    final hindiStandard = _getOnlyHindi(rawStandard);
    final hindiSubAssembly = _getOnlyHindi(subAssembly);

    // Action flags
    final bool actionClean = item['action_clean'] == true;
    final bool actionLubricate = item['action_lubricate'] == true;
    final bool actionInspect = item['action_inspect'] == true;
    final bool actionRetighten = item['action_retighten'] == true;

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // SubNo, SubAssembly, Action Icons & Tool
          Row(
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              // Sub Number Pill
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
                decoration: BoxDecoration(
                  color: const Color(0xFF0F172A),
                  borderRadius: BorderRadius.circular(6),
                ),
                child: Text(
                  subNo,
                  style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w800, color: Colors.white),
                ),
              ),
              const SizedBox(width: 8),

              // Sub-assembly Name (Hindi)
              if (hindiSubAssembly.isNotEmpty)
                Expanded(
                  child: Text(
                    hindiSubAssembly,
                    style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: Color(0xFF475569)),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ),

              // Action Tags (सफाई, ऑयलिंग, चेकिंग, टाइटनिंग)
              if (actionClean) _buildActionChip('🧹 सफाई'),
              if (actionLubricate) _buildActionChip('🛢️ ऑयलिंग'),
              if (actionInspect) _buildActionChip('🔍 चेकिंग'),
              if (actionRetighten) _buildActionChip('🔩 टाइटनिंग'),

              const SizedBox(width: 6),

              // Tool Badge (Hindi)
              _buildToolBadge(toolType),

              if (timing.isNotEmpty) ...[
                const SizedBox(width: 6),
                Text(
                  timing,
                  style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: Color(0xFF94A3B8)),
                ),
              ],
            ],
          ),

          const SizedBox(height: 8),

          // Main Checkpoint Text (Hindi Only)
          Text(
            hindiCheckPoint,
            style: const TextStyle(
              fontSize: 14,
              fontWeight: FontWeight.w800,
              color: Color(0xFF0F172A),
              height: 1.35,
            ),
          ),

          const SizedBox(height: 8),

          // Standard / Specification Pill Strip (Hindi Only)
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
            decoration: BoxDecoration(
              color: const Color(0xFFF1F5F9),
              borderRadius: BorderRadius.circular(8),
            ),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'Standards: ',
                  style: TextStyle(fontSize: 11, fontWeight: FontWeight.w800, color: Color(0xFF475569)),
                ),
                Expanded(
                  child: Text(
                    hindiStandard,
                    style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: Color(0xFF1E293B)),
                  ),
                ),
              ],
            ),
          ),

          const SizedBox(height: 12),

          // 3-Way High-Contrast Evaluation Toggle Buttons (Hindi-first)
          Row(
            children: [
              // OK (✓ सही)
              Expanded(
                child: _buildEvaluationButton(
                  label: '✓ सही',
                  isSelected: currentStatus == 'OK',
                  selectedColor: Colors.white,
                  selectedBg: const Color(0xFF16A34A),
                  onTap: () {
                    setState(() {
                      _itemEvaluations[itemId] = {
                        'status': 'OK',
                        'remark': '',
                        'action_taken': '',
                      };
                    });
                  },
                ),
              ),
              const SizedBox(width: 8),

              // NOT OK (✕ ख़राब)
              Expanded(
                child: _buildEvaluationButton(
                  label: '✕ ख़राब',
                  isSelected: isNotOk,
                  selectedColor: Colors.white,
                  selectedBg: const Color(0xFFDC2626),
                  onTap: () {
                    setState(() {
                      _itemEvaluations[itemId] = {
                        'status': 'NOT_OK',
                        'remark': eval['remark'] ?? '',
                        'action_taken': eval['action_taken'] ?? '',
                      };
                    });
                  },
                ),
              ),
              const SizedBox(width: 8),

              // CORRECTION DONE (⊗ ठीक किया)
              Expanded(
                child: _buildEvaluationButton(
                  label: '⊗ ठीक किया',
                  isSelected: isCorrected,
                  selectedColor: Colors.white,
                  selectedBg: const Color(0xFFD97706),
                  onTap: () {
                    setState(() {
                      _itemEvaluations[itemId] = {
                        'status': 'CORRECTED',
                        'remark': eval['remark'] ?? '',
                        'action_taken': eval['action_taken'] ?? '',
                      };
                    });
                  },
                ),
              ),
            ],
          ),

          // Defect Remark or Corrective Action Box
          if (isNotOk || isCorrected) ...[
            const SizedBox(height: 10),
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: isNotOk ? const Color(0xFFFEF2F2) : const Color(0xFFFFFBEB),
                borderRadius: BorderRadius.circular(10),
                border: Border.all(
                  color: isNotOk ? const Color(0xFFFECACA) : const Color(0xFFFDE68A),
                ),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Icon(
                        isNotOk ? Icons.warning_amber_rounded : Icons.handyman_rounded,
                        size: 16,
                        color: isNotOk ? const Color(0xFFB91C1C) : const Color(0xFFB45309),
                      ),
                      const SizedBox(width: 6),
                      Text(
                        isNotOk ? '⚠️ पाई गई ख़ामी / समस्या:' : '🛠️ तुरंत किया गया सुधार:',
                        style: TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.w800,
                          color: isNotOk ? const Color(0xFFB91C1C) : const Color(0xFFB45309),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 6),
                  TextFormField(
                    initialValue: isNotOk ? eval['remark'] : eval['action_taken'],
                    style: const TextStyle(fontSize: 13),
                    decoration: InputDecoration(
                      hintText: isNotOk
                          ? 'समस्या का विवरण लिखें (जैसे: एयर प्रेशर कम है, तेल रिसाव, सेंसर ढीला)...'
                          : 'किए गए सुधार का विवरण लिखें (जैसे: तेल भरा, बोल्ट टाइट किया, फिल्टर साफ किया)...',
                      hintStyle: const TextStyle(fontSize: 11, color: Color(0xFF94A3B8)),
                      isDense: true,
                      contentPadding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(8),
                        borderSide: const BorderSide(color: Color(0xFFCBD5E1)),
                      ),
                      enabledBorder: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(8),
                        borderSide: const BorderSide(color: Color(0xFFCBD5E1)),
                      ),
                      fillColor: Colors.white,
                      filled: true,
                    ),
                    onChanged: (val) {
                      if (isNotOk) {
                        _itemEvaluations[itemId]?['remark'] = val;
                      } else {
                        _itemEvaluations[itemId]?['action_taken'] = val;
                      }
                    },
                  ),
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildActionChip(String text) {
    return Container(
      margin: const EdgeInsets.only(right: 4),
      padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 2),
      decoration: BoxDecoration(
        color: const Color(0xFFEFF6FF),
        borderRadius: BorderRadius.circular(4),
      ),
      child: Text(
        text,
        style: const TextStyle(fontSize: 9, fontWeight: FontWeight.w700, color: Color(0xFF1D4ED8)),
      ),
    );
  }

  Widget _buildEvaluationButton({
    required String label,
    required bool isSelected,
    required Color selectedColor,
    required Color selectedBg,
    required VoidCallback onTap,
  }) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(10),
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 10),
        decoration: BoxDecoration(
          color: isSelected ? selectedBg : const Color(0xFFF8FAFC),
          borderRadius: BorderRadius.circular(10),
          border: Border.all(
            color: isSelected ? selectedBg : const Color(0xFFE2E8F0),
            width: isSelected ? 1.5 : 1.0,
          ),
          boxShadow: isSelected
              ? [
                  BoxShadow(
                    color: selectedBg.withValues(alpha: 0.3),
                    blurRadius: 4,
                    offset: const Offset(0, 2),
                  ),
                ]
              : null,
        ),
        alignment: Alignment.center,
        child: Text(
          label,
          style: TextStyle(
            fontSize: 12,
            fontWeight: isSelected ? FontWeight.w800 : FontWeight.w600,
            color: isSelected ? selectedColor : const Color(0xFF64748B),
          ),
        ),
      ),
    );
  }

  Widget _buildToolBadge(String toolType) {
    IconData icon;
    String label;
    Color color;

    switch (toolType.toUpperCase()) {
      case 'VISUAL':
        icon = Icons.visibility_rounded;
        label = 'देखकर';
        color = const Color(0xFF2563EB);
        break;
      case 'SPANNER':
        icon = Icons.build_rounded;
        label = 'स्पैनर';
        color = const Color(0xFF7C3AED);
        break;
      case 'COTTON_WASTE':
      case 'COTTON WASTE':
        icon = Icons.cleaning_services_rounded;
        label = 'कपड़ा';
        color = const Color(0xFF059669);
        break;
      case 'PRESSURE_GAUGE':
      case 'PRESSURE GAUGE':
        icon = Icons.speed_rounded;
        label = 'गेज';
        color = const Color(0xFFD97706);
        break;
      default:
        icon = Icons.handyman_rounded;
        label = toolType;
        color = const Color(0xFF475569);
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(6),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 12, color: color),
          const SizedBox(width: 3),
          Text(
            label,
            style: TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: color),
          ),
        ],
      ),
    );
  }
}
