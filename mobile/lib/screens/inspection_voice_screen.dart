import 'package:flutter/material.dart';
import 'package:flutter/foundation.dart';
import 'package:provider/provider.dart';
import 'package:record/record.dart';
import 'package:path_provider/path_provider.dart';
import 'package:permission_handler/permission_handler.dart';

import '../providers/inspection_provider.dart';
import '../services/api_service.dart';
import 'app_home_screen.dart';
import 'summary_screen.dart';

class InspectionVoiceScreen extends StatefulWidget {
  const InspectionVoiceScreen({super.key});

  @override
  State<InspectionVoiceScreen> createState() => _InspectionVoiceScreenState();
}

class _InspectionVoiceScreenState extends State<InspectionVoiceScreen> {
  final _inputController = TextEditingController();
  final _audioRecorder = AudioRecorder();
  final _scrollController = ScrollController();

  bool _isRecording = false;
  bool _isProcessing = false;
  bool _autoAdvance = true; // Auto-Advance on by default
  String _transcribedText = '';
  Map<String, dynamic>? _lastResult;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _scrollToCurrentParam();
    });
  }

  @override
  void dispose() {
    _inputController.dispose();
    _audioRecorder.dispose();
    _scrollController.dispose();
    super.dispose();
  }

  void _scrollToCurrentParam() {
    final provider = Provider.of<InspectionProvider>(context, listen: false);
    if (_scrollController.hasClients && provider.parameters.isNotEmpty) {
      const itemWidth = 68.0;
      final targetOffset = (provider.currentParamIndex * itemWidth) - 100.0;
      _scrollController.animateTo(
        targetOffset.clamp(0.0, _scrollController.position.maxScrollExtent),
        duration: const Duration(milliseconds: 300),
        curve: Curves.easeOutCubic,
      );
    }
  }

  int _getParameterRule(Map<String, dynamic> param) {
    final type = (param['measurement_type'] ?? '').toString().toLowerCase();
    final name = (param['parameter_name'] ?? '').toString().toUpperCase();

    if (type == 'visual') return 2; // Rule 2: Visual (YES/NO)
    if (type == 'min_limit' || name.contains('MIN')) return 31; // Rule 3A: MIN Limit
    if (type == 'max_limit' || type == 'surface' || name.contains('MAX')) return 32; // Rule 3B: MAX Limit
    return 1; // Rule 1: Range
  }

  String _getVisualSpecText(Map<String, dynamic> param) {
    final code = (param['parameter_code'] ?? '').toString().toUpperCase();
    final nom = double.tryParse('${param['nominal_value']}')?.toStringAsFixed(2) ?? '${param['nominal_value']}';
    final unit = param['unit'] ?? 'mm';

    if (code == 'CHA-01' || nom == '0.50' || nom == '0.5') return '0.5 x 45° Chamfer';
    if (code == 'CHM-01' || nom == '1.00' || nom == '1.0' || nom == '1') return '1.0 x 45° Chamfer';
    if (code == 'CHA-02' || nom == '2.00' || nom == '2.0' || nom == '2') return '2.0 x 45° Chamfer';

    return '$nom $unit (Master Spec)';
  }

  // Submit Spoken or Typed Value + Handle Auto-Advance
  Future<void> _submitSpokenOrTypedValue(String inputStr) async {
    if (inputStr.trim().isEmpty) return;

    setState(() {
      _isProcessing = true;
      _lastResult = null;
    });

    final provider = Provider.of<InspectionProvider>(context, listen: false);
    final currentParam = provider.currentParameter;
    if (currentParam == null) return;

    final rule = _getParameterRule(currentParam);

    double? parsedVal;
    // For visual YES/NO checks
    if (rule == 2) {
      final clean = inputStr.trim().toLowerCase();
      if (clean == '1' || clean == '1.0' || clean == 'yes' || clean == 'pass' || clean == 'ok') {
        parsedVal = 1.0;
      } else if (clean == '0' || clean == '0.0' || clean == 'no' || clean == 'fail' || clean == 'reject') {
        parsedVal = 0.0;
      } else {
        parsedVal = double.tryParse(inputStr.replaceAll(RegExp(r'[^0-9.-]'), ''));
      }
      _transcribedText = parsedVal != null && parsedVal >= 0.5 ? 'YES (PASS)' : 'NO (REJECT)';
    } else {
      // For numeric measurements
      final parseResult = await ApiService.parseText(inputStr);
      if (parseResult['is_parseable'] == true && parseResult['parsed_value'] != null) {
        parsedVal = (parseResult['parsed_value'] as num).toDouble();
        _transcribedText = parseResult['raw_text'] ?? inputStr;
      } else {
        parsedVal = double.tryParse(inputStr.replaceAll(RegExp(r'[^0-9.-]'), ''));
        _transcribedText = inputStr;
      }
    }

    if (parsedVal == null) {
      setState(() => _isProcessing = false);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Could not understand measurement. Please enter a valid number.'),
            backgroundColor: Color(0xFFF59E0B),
          ),
        );
      }
      return;
    }

    // Submit measurement to backend
    final result = await provider.submitMeasurement(
      value: parsedVal,
      voiceRawText: _transcribedText,
    );

    if (!mounted) return;

    setState(() {
      _isProcessing = false;
      _lastResult = result;
      _inputController.clear();
    });

    // ⚡ AUTO-ADVANCE LOGIC
    if (_autoAdvance && result != null) {
      await Future.delayed(const Duration(milliseconds: 700));
      if (!mounted) return;

      if (provider.currentParamIndex < provider.parameters.length - 1) {
        provider.advanceToNext();
        setState(() {
          _lastResult = null;
        });
        _scrollToCurrentParam();
      } else {
        // All parameters completed!
        _showCompletionDialog();
      }
    }
  }

  void _showCompletionDialog() {
    final provider = Provider.of<InspectionProvider>(context, listen: false);
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (ctx) => AlertDialog(
        backgroundColor: const Color(0xFF0F172A),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(20),
          side: const BorderSide(color: Color(0xFF10B981), width: 1.5),
        ),
        title: const Row(
          children: [
            Icon(Icons.check_circle_rounded, color: Color(0xFF10B981), size: 28),
            SizedBox(width: 10),
            Text('All Readings Done!', style: TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold)),
          ],
        ),
        content: Text(
          'You have recorded all ${provider.parameters.length} parameters for this inspection session.\n\nProceed to review the summary and submit.',
          style: const TextStyle(color: Color(0xFF94A3B8), fontSize: 13.5),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Review Again', style: TextStyle(color: Color(0xFF94A3B8))),
          ),
          ElevatedButton.icon(
            onPressed: () {
              Navigator.pop(ctx);
              Navigator.pushReplacement(
                context,
                MaterialPageRoute(builder: (_) => const SummaryScreen()),
              );
            },
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFF10B981),
              foregroundColor: Colors.white,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
            ),
            icon: const Icon(Icons.assessment_rounded, size: 18),
            label: const Text('VIEW SUMMARY', style: TextStyle(fontWeight: FontWeight.bold)),
          ),
        ],
      ),
    );
  }

  Future<void> _toggleVoiceRecording() async {
    if (_isRecording) {
      setState(() {
        _isRecording = false;
        _isProcessing = true;  // spinner stays on while we poll
      });

      final e2eSw = Stopwatch()..start();
      try {
        final path = await _audioRecorder.stop();
        if (path != null) {
          // Step 1 — send audio, get job_id back immediately (< 0.5 s)
          final uploadSw = Stopwatch()..start();
          final submitRes = await ApiService.transcribeVoice(path);
          uploadSw.stop();

          // Backward-compat: old server returns raw_text directly (status 200)
          if (submitRes.containsKey('raw_text')) {
            final textResult = submitRes['raw_text'] ?? submitRes['text'];
            if (textResult != null && (textResult as String).isNotEmpty) {
              await _submitSpokenOrTypedValue(textResult);
            } else {
              if (mounted) {
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(content: Text('No speech detected. Please try again or type manually.')),
                );
              }
            }
            return; // handled by old path
          }

          final jobId = submitRes['job_id'] as String?;
          if (jobId == null) {
            if (mounted) {
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(content: Text('Transcription failed to start. Please try again.')),
              );
            }
            return;
          }

          // Step 2 — poll every 2 s until done, failed, or 60 s timeout
          const pollInterval = Duration(seconds: 2);
          const maxWait      = Duration(seconds: 60);
          final deadline     = DateTime.now().add(maxWait);

          final pollSw = Stopwatch()..start();
          int pollCount = 0;
          Map<String, dynamic> pollRes = {'status': 'processing'};

          while (DateTime.now().isBefore(deadline)) {
            await Future.delayed(pollInterval);
            pollCount++;
            pollRes = await ApiService.checkTranscriptionStatus(jobId);

            final st = pollRes['status'] as String? ?? 'processing';
            if (st == 'done' || st == 'failed') break;
          }
          pollSw.stop();
          e2eSw.stop();

          final timingMeta = pollRes['timing'] as Map<String, dynamic>?;
          debugPrint('''
==================================================
[PERF CLIENT SUMMARY] Voice Entry Job: $jobId
  ├─ HTTP Upload Time  : ${uploadSw.elapsedMilliseconds} ms
  ├─ Polling Attempts  : $pollCount attempt(s)
  ├─ Polling Duration  : ${pollSw.elapsedMilliseconds} ms
  ├─ Backend Whisper   : ${timingMeta?['whisper_infer_ms'] ?? 'N/A'} ms
  ├─ Backend Total Exec: ${timingMeta?['total_backend_ms'] ?? 'N/A'} ms
  └─ TOTAL E2E LATENCY : ${e2eSw.elapsedMilliseconds} ms
==================================================
''');

          // Step 3 — handle result
          final finalStatus = pollRes['status'] as String? ?? 'failed';
          if (finalStatus == 'done') {
            final textResult = pollRes['raw_text'] ?? pollRes['text'];
            if (textResult != null && (textResult as String).isNotEmpty) {
              await _submitSpokenOrTypedValue(textResult);
            } else {
              if (mounted) {
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(content: Text('No speech detected. Please try again or type manually.')),
                );
              }
            }
          } else {
            // failed or timed-out
            if (mounted) {
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(content: Text('Transcription failed or timed out. Please try again.')),
              );
            }
          }
        }
      } catch (e) {
        debugPrint('Recording error: $e');
      } finally {
        if (mounted) {
          setState(() {
            _isProcessing = false;
            _isRecording  = false;
          });
        }
      }
    } else {
      bool hasMicPermission = kIsWeb;
      if (!kIsWeb) {
        final status = await Permission.microphone.request();
        hasMicPermission = status.isGranted;
      }
      if (hasMicPermission) {
        if (await _audioRecorder.hasPermission()) {
          String path = '';
          if (!kIsWeb) {
            final tempDir = await getTemporaryDirectory();
            path = '${tempDir.path}/voice_input.m4a';
          }
          await _audioRecorder.start(const RecordConfig(), path: path);
          setState(() {
            _isRecording = true;
          });
        }
      } else {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Microphone permission required for voice entry.')),
          );
        }
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final provider = Provider.of<InspectionProvider>(context);
    final param = provider.currentParameter;

    if (param == null) {
      return Scaffold(
        backgroundColor: const Color(0xFF0B1120),
        body: Center(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Icon(Icons.check_circle_outline_rounded, color: Color(0xFF10B981), size: 64),
              const SizedBox(height: 16),
              const Text('All parameters recorded!', style: TextStyle(color: Colors.white, fontSize: 20, fontWeight: FontWeight.bold)),
              const SizedBox(height: 20),
              ElevatedButton.icon(
                onPressed: () {
                  Navigator.pushReplacement(
                    context,
                    MaterialPageRoute(builder: (_) => const SummaryScreen()),
                  );
                },
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF10B981),
                  padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 14),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                ),
                icon: const Icon(Icons.assessment_rounded),
                label: const Text('VIEW SESSION SUMMARY', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
              )
            ],
          ),
        ),
      );
    }

    final isCritical = param['is_critical'] == true;
    final totalCount = provider.parameters.length;
    final currentIndex = provider.currentParamIndex + 1;
    final paramName = param['parameter_name'] ?? 'Parameter $currentIndex';
    final rule = _getParameterRule(param);

    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 1,
        leading: IconButton(
          icon: const Icon(Icons.grid_view_rounded, color: Color(0xFF2563EB)),
          tooltip: 'Back to Parameter Grid',
          onPressed: () => Navigator.pop(context),
        ),
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              paramName,
              style: const TextStyle(color: Color(0xFF0F172A), fontWeight: FontWeight.bold, fontSize: 15),
              overflow: TextOverflow.ellipsis,
            ),
            Text(
              'Step $currentIndex of $totalCount',
              style: const TextStyle(color: Color(0xFF2563EB), fontSize: 11, fontWeight: FontWeight.w600),
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
          // Auto-Advance Toggle Pill
          GestureDetector(
            onTap: () {
              setState(() => _autoAdvance = !_autoAdvance);
              ScaffoldMessenger.of(context).showSnackBar(
                SnackBar(
                  content: Text(_autoAdvance ? '⚡ Auto-Advance is ON' : '⏸️ Auto-Advance is OFF (Manual Mode)'),
                  duration: const Duration(seconds: 1),
                  backgroundColor: _autoAdvance ? const Color(0xFF10B981) : const Color(0xFF64748B),
                ),
              );
            },
            child: Container(
              margin: const EdgeInsets.symmetric(vertical: 10, horizontal: 4),
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
              decoration: BoxDecoration(
                color: _autoAdvance ? const Color(0xFF10B981).withValues(alpha: 0.2) : const Color(0xFF334155),
                borderRadius: BorderRadius.circular(20),
                border: Border.all(color: _autoAdvance ? const Color(0xFF10B981) : const Color(0xFF64748B)),
              ),
              child: Row(
                children: [
                  Icon(
                    _autoAdvance ? Icons.bolt_rounded : Icons.pause_circle_rounded,
                    color: _autoAdvance ? const Color(0xFF34D399) : const Color(0xFF94A3B8),
                    size: 14,
                  ),
                  const SizedBox(width: 4),
                  Text(
                    _autoAdvance ? 'AUTO' : 'MANUAL',
                    style: TextStyle(
                      color: _autoAdvance ? const Color(0xFF34D399) : const Color(0xFF94A3B8),
                      fontSize: 10,
                      fontWeight: FontWeight.w900,
                    ),
                  ),
                ],
              ),
            ),
          ),
          IconButton(
            icon: const Icon(Icons.assessment_rounded, color: Color(0xFF94A3B8)),
            tooltip: 'View Summary',
            onPressed: () {
              Navigator.push(
                context,
                MaterialPageRoute(builder: (_) => const SummaryScreen()),
              );
            },
          )
        ],
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 20),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // Top Horizontal Scrollable Mini-Grid Strip
              _buildMiniGridStrip(provider),

              const SizedBox(height: 14),

              // Parameter Card Header
              Container(
                padding: const EdgeInsets.all(18),
                decoration: BoxDecoration(
                  gradient: const LinearGradient(
                    colors: [Color(0xFF1E293B), Color(0xFF0F172A)],
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                  ),
                  borderRadius: BorderRadius.circular(18),
                  border: Border.all(
                    color: isCritical ? const Color(0xFFEF4444) : const Color(0xFF334155),
                    width: isCritical ? 2 : 1,
                  ),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black.withValues(alpha: 0.3),
                      blurRadius: 10,
                      offset: const Offset(0, 4),
                    ),
                  ],
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Tag row: Code + Critical + Technique
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Row(
                          children: [
                            _buildRuleBadge(rule),
                          ],
                        ),
                        if (isCritical)
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                            decoration: BoxDecoration(
                              color: const Color(0xFFEF4444).withValues(alpha: 0.2),
                              borderRadius: BorderRadius.circular(12),
                              border: Border.all(color: const Color(0xFFEF4444)),
                            ),
                            child: const Row(
                              children: [
                                Icon(Icons.warning_amber_rounded, color: Color(0xFFEF4444), size: 12),
                                SizedBox(width: 4),
                                Text('◑ CRITICAL', style: TextStyle(color: Color(0xFFF87171), fontSize: 10, fontWeight: FontWeight.w900)),
                              ],
                            ),
                          ),
                      ],
                    ),

                    const SizedBox(height: 12),

                    // Parameter Name
                    Text(
                      paramName,
                      style: const TextStyle(color: Colors.white, fontSize: 22, fontWeight: FontWeight.w900, letterSpacing: -0.3),
                    ),

                    if (param['measurement_technique'] != null && param['measurement_technique'].toString().isNotEmpty) ...[
                      const SizedBox(height: 4),
                      Row(
                        children: [
                          const Icon(Icons.construction_rounded, color: Color(0xFF94A3B8), size: 13),
                          const SizedBox(width: 5),
                          Text(
                            'Tool / Tech: ${param['measurement_technique']}',
                            style: const TextStyle(color: Color(0xFF94A3B8), fontSize: 12, fontWeight: FontWeight.w500),
                          ),
                        ],
                      ),
                    ],

                    const SizedBox(height: 14),
                    const Divider(color: Color(0xFF334155), height: 1),
                    const SizedBox(height: 14),

                    // Spec Target Box per Rule
                    _buildSpecSection(param, rule),
                  ],
                ),
              ),

              const SizedBox(height: 18),

              // Interactive Data Input Section (Voice, Buttons, Keyboard)
              _buildInputSection(provider, param, rule),

              const SizedBox(height: 16),

              // Result Feedback Banner (if just saved)
              if (_lastResult != null) ...[
                _buildResultBanner(_lastResult!),
                const SizedBox(height: 16),
              ],

            ],
          ),
        ),
      ),
    );
  }

  // 📱 Horizontal Scrollable Mini-Grid Progress Strip
  Widget _buildMiniGridStrip(InspectionProvider provider) {
    return Container(
      height: 58,
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: ListView.builder(
        controller: _scrollController,
        scrollDirection: Axis.horizontal,
        itemCount: provider.parameters.length,
        itemBuilder: (context, idx) {
          final item = provider.parameters[idx];
          final code = item['parameter_code'] ?? 'P${idx + 1}';
          final isFilled = provider.isParamFilled(code);
          final status = provider.getParamStatus(code);
          final isSelected = idx == provider.currentParamIndex;

          Color chipBg = const Color(0xFF1E293B);
          Color borderCol = const Color(0xFF334155);
          IconData icon = Icons.circle_outlined;
          Color iconCol = const Color(0xFF64748B);

          if (isFilled) {
            if (status == 'ok') {
              chipBg = const Color(0xFF064E3B);
              borderCol = const Color(0xFF10B981);
              icon = Icons.check_circle_rounded;
              iconCol = const Color(0xFF34D399);
            } else {
              chipBg = const Color(0xFF7F1D1D);
              borderCol = const Color(0xFFEF4444);
              icon = Icons.cancel_rounded;
              iconCol = const Color(0xFFF87171);
            }
          }

          if (isSelected) {
            borderCol = const Color(0xFF6366F1);
            chipBg = const Color(0xFF312E81);
          }

          return GestureDetector(
            onTap: () {
              provider.goToParameter(idx);
              setState(() => _lastResult = null);
              _scrollToCurrentParam();
            },
            child: Container(
              width: 58,
              margin: const EdgeInsets.only(right: 8),
              padding: const EdgeInsets.symmetric(vertical: 4, horizontal: 4),
              decoration: BoxDecoration(
                color: chipBg,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: borderCol, width: isSelected ? 2 : 1),
                boxShadow: isSelected
                    ? [
                        BoxShadow(
                          color: const Color(0xFF6366F1).withValues(alpha: 0.4),
                          blurRadius: 8,
                          spreadRadius: 1,
                        )
                      ]
                    : null,
              ),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Text(
                    (item['parameter_name'] ?? code).toString(),
                    style: TextStyle(
                      color: isSelected ? Colors.white : const Color(0xFFCBD5E1),
                      fontSize: 10,
                      fontWeight: FontWeight.w900,
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                  const SizedBox(height: 2),
                  Icon(icon, color: isSelected ? const Color(0xFF818CF8) : iconCol, size: 14),
                ],
              ),
            ),
          );
        },
      ),
    );
  }

  Widget _buildRuleBadge(int rule) {
    Color bg;
    Color text;
    String label;

    if (rule == 2) {
      bg = const Color(0xFFA855F7).withValues(alpha: 0.2);
      text = const Color(0xFFC084FC);
      label = 'Rule 2: Visual';
    } else if (rule == 31) {
      bg = const Color(0xFFF59E0B).withValues(alpha: 0.2);
      text = const Color(0xFFFBBF24);
      label = 'Rule 3A: Min Limit';
    } else if (rule == 32) {
      bg = const Color(0xFF06B6D4).withValues(alpha: 0.2);
      text = const Color(0xFF22D3EE);
      label = 'Rule 3B: Max Limit';
    } else {
      bg = const Color(0xFF3B82F6).withValues(alpha: 0.2);
      text = const Color(0xFF60A5FA);
      label = 'Rule 1: Range';
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
      decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(6)),
      child: Text(label, style: TextStyle(color: text, fontSize: 10, fontWeight: FontWeight.bold)),
    );
  }

  // Dynamic Spec Section Display per Rule
  Widget _buildSpecSection(Map<String, dynamic> param, int rule) {
    final unit = param['unit'] ?? 'mm';

    if (param['is_process_parameter'] == true) {
      final spec = param['specification'] ?? '—';
      final dataType = (param['data_type'] ?? 'numeric').toString().toUpperCase();
      final low = param['lower_limit'];
      final high = param['upper_limit'];

      return Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: const Color(0xFF1E1B4B),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: const Color(0xFF6366F1).withValues(alpha: 0.4)),
        ),
        child: Row(
          children: [
            const Icon(Icons.settings_suggest_rounded, color: Color(0xFF818CF8), size: 24),
            const SizedBox(width: 10),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('PROCESS PARAMETER ($dataType)', style: const TextStyle(color: Color(0xFF818CF8), fontSize: 10, fontWeight: FontWeight.w900)),
                  const SizedBox(height: 2),
                  Text(
                    low != null && high != null ? 'Spec: $spec  [$low – $high $unit]' : 'Specification: $spec $unit',
                    style: const TextStyle(color: Colors.white, fontSize: 15, fontWeight: FontWeight.bold),
                  ),
                ],
              ),
            ),
          ],
        ),
      );
    }

    if (rule == 2) {
      final specText = _getVisualSpecText(param);
      return Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: const Color(0xFF1E1B4B),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: const Color(0xFFA855F7).withValues(alpha: 0.4)),
        ),
        child: Row(
          children: [
            const Icon(Icons.remove_red_eye_rounded, color: Color(0xFFC084FC), size: 24),
            const SizedBox(width: 10),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('MASTER VISUAL SPECIFICATION', style: TextStyle(color: Color(0xFFC084FC), fontSize: 10, fontWeight: FontWeight.w900)),
                  const SizedBox(height: 2),
                  Text(specText, style: const TextStyle(color: Colors.white, fontSize: 15, fontWeight: FontWeight.bold)),
                ],
              ),
            ),
          ],
        ),
      );
    } else if (rule == 31) {
      final minVal = param['lower_limit'] ?? param['nominal_value'] ?? '0';
      return Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: const Color(0xFF451A03),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: const Color(0xFFF59E0B).withValues(alpha: 0.4)),
        ),
        child: Row(
          children: [
            const Icon(Icons.vertical_align_bottom_rounded, color: Color(0xFFFBBF24), size: 24),
            const SizedBox(width: 10),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('RULE 3: MINIMUM LIMIT THRESHOLD', style: TextStyle(color: Color(0xFFFBBF24), fontSize: 10, fontWeight: FontWeight.w900)),
                  const SizedBox(height: 2),
                  Text('Must be ≥ $minVal $unit', style: const TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.bold)),
                ],
              ),
            ),
          ],
        ),
      );
    } else if (rule == 32) {
      final maxVal = param['nominal_value'] ?? param['upper_limit'] ?? '0';
      return Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: const Color(0xFF083344),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: const Color(0xFF06B6D4).withValues(alpha: 0.4)),
        ),
        child: Row(
          children: [
            const Icon(Icons.vertical_align_top_rounded, color: Color(0xFF22D3EE), size: 24),
            const SizedBox(width: 10),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('RULE 3: MAXIMUM LIMIT / ROUGHNESS', style: TextStyle(color: Color(0xFF22D3EE), fontSize: 10, fontWeight: FontWeight.w900)),
                  const SizedBox(height: 2),
                  Text('Must be ≤ $maxVal $unit', style: const TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.bold)),
                ],
              ),
            ),
          ],
        ),
      );
    } else {
      // Rule 1: Range
      final nomVal = double.tryParse('${param['nominal_value']}')?.toStringAsFixed(2) ?? '${param['nominal_value']}';
      final minVal = double.tryParse('${param['lower_limit']}')?.toStringAsFixed(2) ?? '${param['lower_limit']}';
      final maxVal = double.tryParse('${param['upper_limit']}')?.toStringAsFixed(2) ?? '${param['upper_limit']}';

      return Row(
        mainAxisAlignment: MainAxisAlignment.spaceAround,
        children: [
          _buildSpecItem('Lower Limit', '$minVal $unit', const Color(0xFF94A3B8)),
          _buildSpecItem('Nominal Target', '$nomVal $unit', const Color(0xFF60A5FA)),
          _buildSpecItem('Upper Limit', '$maxVal $unit', const Color(0xFF94A3B8)),
        ],
      );
    }
  }

  Widget _buildSpecItem(String label, String value, Color col) {
    return Column(
      children: [
        Text(label, style: const TextStyle(color: Color(0xFF64748B), fontSize: 11, fontWeight: FontWeight.w600)),
        const SizedBox(height: 4),
        Text(value, style: TextStyle(color: col, fontWeight: FontWeight.w900, fontSize: 14)),
      ],
    );
  }

  // Interactive Input Section: Visual YES/NO or Numeric Voice/Keyboard
  Widget _buildInputSection(InspectionProvider provider, Map<String, dynamic> param, int rule) {
    final isFilled = provider.isParamFilled(param['parameter_code']);
    final recorded = provider.recordedResults[param['parameter_code']];

    if (isFilled && recorded != null) {
      final displayVal = (rule == 2)
          ? ((recorded['measured_value'] == 1.0 || recorded['status'] == 'ok') ? 'YES (PASS)' : 'NO (REJECT)')
          : '${recorded['measured_value'] ?? recorded['value']} ${param['unit']}';

      final isOk = recorded['status'] == 'ok';

      return Container(
        padding: const EdgeInsets.all(18),
        decoration: BoxDecoration(
          color: isOk ? const Color(0xFF064E3B).withValues(alpha: 0.3) : const Color(0xFF7F1D1D).withValues(alpha: 0.3),
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: isOk ? const Color(0xFF10B981) : const Color(0xFFEF4444), width: 1.5),
        ),
        child: Column(
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(isOk ? Icons.check_circle_rounded : Icons.cancel_rounded, color: isOk ? const Color(0xFF34D399) : const Color(0xFFF87171), size: 22),
                const SizedBox(width: 8),
                Text(
                  isOk ? 'RECORDED: WITHIN SPEC' : 'RECORDED: OUT OF SPEC',
                  style: TextStyle(color: isOk ? const Color(0xFF34D399) : const Color(0xFFF87171), fontWeight: FontWeight.w900, fontSize: 14),
                ),
              ],
            ),
            const SizedBox(height: 10),
            Text(
              displayVal,
              style: const TextStyle(color: Colors.white, fontSize: 24, fontWeight: FontWeight.w900),
            ),
            const SizedBox(height: 12),
            OutlinedButton.icon(
              onPressed: () {
                // Re-open entry for this parameter
                setState(() {
                  provider.recordedResults.remove(param['parameter_code']);
                  _lastResult = null;
                });
              },
              style: OutlinedButton.styleFrom(
                side: const BorderSide(color: Color(0xFF64748B)),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
              ),
              icon: const Icon(Icons.edit_rounded, color: Color(0xFFCBD5E1), size: 14),
              label: const Text('Re-enter / Correct Value', style: TextStyle(color: Color(0xFFCBD5E1), fontSize: 11)),
            ),
          ],
        ),
      );
    }

    // Rule 2: Big YES / NO Visual Buttons + Auto-Advance
    if (rule == 2) {
      return Container(
        padding: const EdgeInsets.all(18),
        decoration: BoxDecoration(
          color: const Color(0xFF1E293B),
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: const Color(0xFF334155)),
        ),
        child: Column(
          children: [
            const Text(
              'TAP VISUAL INSPECTION OUTCOME',
              style: TextStyle(color: Color(0xFF94A3B8), fontSize: 11, fontWeight: FontWeight.w900, letterSpacing: 0.5),
            ),
            const SizedBox(height: 14),
            Row(
              children: [
                Expanded(
                  child: ElevatedButton.icon(
                    onPressed: _isProcessing ? null : () => _submitSpokenOrTypedValue('1.0'),
                    icon: const Icon(Icons.check_circle_rounded, color: Colors.white, size: 22),
                    label: const Text('YES (PASS)', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w900, fontSize: 15)),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFF10B981),
                      padding: const EdgeInsets.symmetric(vertical: 18),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                      elevation: 3,
                    ),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: ElevatedButton.icon(
                    onPressed: _isProcessing ? null : () => _submitSpokenOrTypedValue('0.0'),
                    icon: const Icon(Icons.cancel_rounded, color: Colors.white, size: 22),
                    label: const Text('NO (REJECT)', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w900, fontSize: 15)),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFFEF4444),
                      padding: const EdgeInsets.symmetric(vertical: 18),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                      elevation: 3,
                    ),
                  ),
                ),
              ],
            ),
          ],
        ),
      );
    }

    // Rule 1 & Rule 3: Numeric Entry (Voice Mic + Typed input)
    String hintText = 'Type measurement...';
    if (rule == 31) hintText = 'Type value (e.g. 3.35 for ≥ 3.30 MIN)...';
    if (rule == 32) hintText = 'Type roughness (e.g. 2.8 for ≤ 3.2 Ra)...';

    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: const Color(0xFF1E293B),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFF334155)),
      ),
      child: Column(
        children: [
          // Voice Mic Button
          GestureDetector(
            onTap: _isProcessing ? null : _toggleVoiceRecording,
            child: Container(
              padding: const EdgeInsets.all(22),
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: _isRecording
                    ? const Color(0xFFEF4444)
                    : (_isProcessing ? const Color(0xFFF59E0B) : const Color(0xFF4F46E5)),
                boxShadow: [
                  BoxShadow(
                    color: (_isRecording ? const Color(0xFFEF4444) : const Color(0xFF4F46E5)).withValues(alpha: 0.4),
                    blurRadius: 20,
                    spreadRadius: 4,
                  )
                ],
              ),
              child: Icon(
                _isRecording
                    ? Icons.stop_rounded
                    : (_isProcessing ? Icons.sync_rounded : Icons.mic_rounded),
                size: 42,
                color: Colors.white,
              ),
            ),
          ),
          const SizedBox(height: 10),
          Text(
            _isRecording
                ? 'Recording... Tap to evaluate & auto-advance'
                : (_isProcessing ? 'Processing speech...' : 'Tap Mic to Speak Reading'),
            style: const TextStyle(color: Colors.white, fontSize: 13, fontWeight: FontWeight.w600),
          ),
          const SizedBox(height: 16),

          // Manual typing input
          Row(
            children: [
              Expanded(
                child: TextField(
                  controller: _inputController,
                  keyboardType: const TextInputType.numberWithOptions(decimal: true),
                  style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold),
                  decoration: InputDecoration(
                    hintText: hintText,
                    hintStyle: const TextStyle(color: Color(0xFF64748B), fontSize: 12.5),
                    filled: true,
                    fillColor: const Color(0xFF0F172A),
                    contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(12),
                      borderSide: const BorderSide(color: Color(0xFF334155)),
                    ),
                    focusedBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(12),
                      borderSide: const BorderSide(color: Color(0xFF6366F1), width: 2),
                    ),
                  ),
                  onSubmitted: (val) => _submitSpokenOrTypedValue(val),
                ),
              ),
              const SizedBox(width: 10),
              ElevatedButton(
                onPressed: _isProcessing ? null : () => _submitSpokenOrTypedValue(_inputController.text),
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF4F46E5),
                  padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 14),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                ),
                child: const Text('SUBMIT', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w900)),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildResultBanner(Map<String, dynamic> result) {
    final isOk = result['status'] == 'ok';
    final msg = result['message'] ?? (isOk ? 'Value within tolerance.' : 'Out of specification.');

    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: isOk ? const Color(0xFF064E3B).withValues(alpha: 0.4) : const Color(0xFF7F1D1D).withValues(alpha: 0.4),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: isOk ? const Color(0xFF10B981) : const Color(0xFFEF4444)),
      ),
      child: Row(
        children: [
          Icon(isOk ? Icons.check_circle_rounded : Icons.cancel_rounded, color: isOk ? const Color(0xFF34D399) : const Color(0xFFF87171), size: 24),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              msg,
              style: TextStyle(color: isOk ? const Color(0xFF34D399) : const Color(0xFFF87171), fontWeight: FontWeight.bold, fontSize: 13),
            ),
          ),
        ],
      ),
    );
  }
}
