import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:record/record.dart';
import 'package:path_provider/path_provider.dart';
import 'package:permission_handler/permission_handler.dart';

import '../providers/inspection_provider.dart';
import '../services/api_service.dart';
import 'summary_screen.dart';

class InspectionVoiceScreen extends StatefulWidget {
  const InspectionVoiceScreen({super.key});

  @override
  State<InspectionVoiceScreen> createState() => _InspectionVoiceScreenState();
}

class _InspectionVoiceScreenState extends State<InspectionVoiceScreen> {
  final _inputController = TextEditingController();
  final _audioRecorder = AudioRecorder();
  
  bool _isRecording = false;
  bool _isProcessing = false;
  String _transcribedText = '';
  Map<String, dynamic>? _lastResult;

  @override
  void dispose() {
    _inputController.dispose();
    _audioRecorder.dispose();
    super.dispose();
  }

  Future<void> _submitSpokenOrTypedValue(String inputStr) async {
    if (inputStr.trim().isEmpty) return;

    setState(() {
      _isProcessing = true;
      _lastResult = null;
    });

    final provider = Provider.of<InspectionProvider>(context, listen: false);

    // 1. Try parsing raw input string to double float
    final parseResult = await ApiService.parseText(inputStr);

    double? parsedVal;
    if (parseResult['is_parseable'] == true && parseResult['parsed_value'] != null) {
      parsedVal = (parseResult['parsed_value'] as num).toDouble();
      _transcribedText = parseResult['raw_text'] ?? inputStr;
    } else {
      parsedVal = double.tryParse(inputStr.replaceAll(RegExp(r'[^0-9.-]'), ''));
      _transcribedText = inputStr;
    }

    if (parsedVal == null) {
      setState(() {
        _isProcessing = false;
      });
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Could not understand measurement number. Please enter a valid value.'),
            backgroundColor: Colors.amber,
          ),
        );
      }
      return;
    }

    // 2. Submit measurement to backend Tolerance Validator
    final result = await provider.submitMeasurement(
      value: parsedVal,
      voiceRawText: _transcribedText,
    );

    setState(() {
      _isProcessing = false;
      _lastResult = result;
    });

    _inputController.clear();
  }

  Future<void> _toggleVoiceRecording() async {
    if (_isRecording) {
      // STOP recording & transcribe
      setState(() {
        _isRecording = false;
        _isProcessing = true;
      });

      try {
        final path = await _audioRecorder.stop();
        if (path != null) {
          final res = await ApiService.transcribeVoice(path);
          final textResult = res['raw_text'] ?? res['text'];
          if (textResult != null && (textResult as String).isNotEmpty) {
            await _submitSpokenOrTypedValue(textResult);
          } else {
            // Fallback if audio was empty
            if (mounted) {
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(content: Text('No speech detected. Please try again or type manually.')),
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
            _isRecording = false;
          });
        }
      }
    } else {
      // START recording
      final status = await Permission.microphone.request();
      if (status.isGranted) {
        if (await _audioRecorder.hasPermission()) {
          final tempDir = await getTemporaryDirectory();
          final path = '${tempDir.path}/voice_input.m4a';
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
        backgroundColor: const Color(0xFF080C18),
        body: Center(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Text('All parameters recorded!', style: TextStyle(color: Colors.white, fontSize: 20, fontWeight: FontWeight.bold)),
              const SizedBox(height: 20),
              ElevatedButton(
                onPressed: () {
                  Navigator.pushReplacement(
                    context,
                    MaterialPageRoute(builder: (_) => const SummaryScreen()),
                  );
                },
                style: ElevatedButton.styleFrom(backgroundColor: Colors.green, padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 14)),
                child: const Text('VIEW SESSION SUMMARY', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
              )
            ],
          ),
        ),
      );
    }

    final isCritical = param['is_critical'] == true;
    final totalCount = provider.parameters.length;
    final currentIndex = provider.currentParamIndex + 1;

    return Scaffold(
      backgroundColor: const Color(0xFF080C18),
      appBar: AppBar(
        backgroundColor: const Color(0xFF0D1424),
        title: Text(
          'Parameter $currentIndex of $totalCount',
          style: const TextStyle(color: Colors.white, fontSize: 16),
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.list_alt_rounded, color: Colors.blueAccent),
            onPressed: () {
              Navigator.push(
                context,
                MaterialPageRoute(builder: (_) => const SummaryScreen()),
              );
            },
          )
        ],
        elevation: 0,
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(20.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Progress Bar
            ClipRRect(
              borderRadius: BorderRadius.circular(8),
              child: LinearProgressIndicator(
                value: currentIndex / totalCount,
                minHeight: 8,
                backgroundColor: const Color(0xFF131D30),
                color: Colors.blueAccent,
              ),
            ),
            const SizedBox(height: 16),

            // Filled / Remaining Header Counter Row
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Row(
                  children: [
                    const Icon(Icons.check_circle_rounded, color: Colors.greenAccent, size: 16),
                    const SizedBox(width: 6),
                    Text(
                      'FILLED: ${provider.filledCount} / $totalCount',
                      style: const TextStyle(color: Colors.greenAccent, fontWeight: FontWeight.bold, fontSize: 12),
                    ),
                  ],
                ),
                Row(
                  children: [
                    const Icon(Icons.hourglass_top_rounded, color: Colors.amberAccent, size: 16),
                    const SizedBox(width: 6),
                    Text(
                      'REMAINING: ${provider.remainingCount}',
                      style: const TextStyle(color: Colors.amberAccent, fontWeight: FontWeight.bold, fontSize: 12),
                    ),
                  ],
                ),
              ],
            ),
            const SizedBox(height: 10),

            // Horizontal Parameter Checklist Bar with Small Filled/Unfilled Icons
            SizedBox(
              height: 52,
              child: ListView.builder(
                scrollDirection: Axis.horizontal,
                itemCount: provider.parameters.length,
                itemBuilder: (context, idx) {
                  final item = provider.parameters[idx];
                  final code = item['parameter_code'] ?? 'P${idx + 1}';
                  final isFilled = provider.isParamFilled(code);
                  final status = provider.getParamStatus(code);
                  final isSelected = idx == provider.currentParamIndex;

                  Color chipBg = const Color(0xFF0D1424);
                  Color borderCol = const Color(0xFF1E293B);
                  IconData statusIcon = Icons.radio_button_unchecked_rounded;
                  Color iconCol = Colors.blueGrey;
                  String statusLabel = 'Unfilled';

                  if (isFilled) {
                    if (status == 'ok') {
                      chipBg = Colors.green.withValues(alpha: 0.15);
                      borderCol = Colors.greenAccent;
                      statusIcon = Icons.check_circle_rounded;
                      iconCol = Colors.greenAccent;
                      statusLabel = 'Filled (OK)';
                    } else {
                      chipBg = Colors.red.withValues(alpha: 0.15);
                      borderCol = Colors.redAccent;
                      statusIcon = Icons.cancel_rounded;
                      iconCol = Colors.redAccent;
                      statusLabel = 'Filled (OOC)';
                    }
                  }

                  if (isSelected) {
                    borderCol = Colors.blueAccent;
                  }

                  return GestureDetector(
                    onTap: () {
                      provider.goToParameter(idx);
                      setState(() {
                        _lastResult = null;
                      });
                    },
                    child: Container(
                      margin: const EdgeInsets.only(right: 8),
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                      decoration: BoxDecoration(
                        color: chipBg,
                        borderRadius: BorderRadius.circular(10),
                        border: Border.all(color: borderCol, width: isSelected ? 2 : 1),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(statusIcon, color: iconCol, size: 18),
                          const SizedBox(width: 6),
                          Column(
                            mainAxisAlignment: MainAxisAlignment.center,
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                code,
                                style: TextStyle(
                                  color: isSelected ? Colors.white : Colors.white70,
                                  fontWeight: isSelected ? FontWeight.bold : FontWeight.w500,
                                  fontSize: 12,
                                ),
                              ),
                              Text(
                                statusLabel,
                                style: TextStyle(color: iconCol, fontSize: 9, fontWeight: FontWeight.bold),
                              ),
                            ],
                          )
                        ],
                      ),
                    ),
                  );
                },
              ),
            ),
            const SizedBox(height: 16),


            // Parameter Card Header
            Container(
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                color: const Color(0xFF0D1424),
                borderRadius: BorderRadius.circular(16),
                border: Border.all(
                  color: isCritical ? Colors.redAccent.withValues(alpha: 0.6) : const Color(0xFF1E293B),
                  width: isCritical ? 2 : 1,
                ),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(
                        'CODE: ${param['parameter_code']}',
                        style: const TextStyle(color: Colors.blueAccent, fontWeight: FontWeight.bold, fontSize: 14),
                      ),
                      if (isCritical)
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                          decoration: BoxDecoration(
                            color: Colors.redAccent.withValues(alpha: 0.2),
                            borderRadius: BorderRadius.circular(12),
                            border: Border.all(color: Colors.redAccent),
                          ),
                          child: const Row(
                            children: [
                              Icon(Icons.warning_amber_rounded, color: Colors.redAccent, size: 14),
                              SizedBox(width: 4),
                              Text('CRITICAL', style: TextStyle(color: Colors.redAccent, fontSize: 11, fontWeight: FontWeight.bold)),
                            ],
                          ),
                        ),
                    ],
                  ),
                  const SizedBox(height: 10),
                  Text(
                    param['parameter_name'] ?? 'Parameter',
                    style: const TextStyle(color: Colors.white, fontSize: 24, fontWeight: FontWeight.bold),
                  ),
                  const SizedBox(height: 16),
                  const Divider(color: Color(0xFF1E293B)),
                  const SizedBox(height: 12),

                  // Spec Values Grid (Lower Limit -> Nominal -> Upper Limit)
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceAround,
                    children: [
                      _buildSpecItem('Lower Limit', '${param['lower_limit']} ${param['unit']}'),
                      _buildSpecItem('Nominal', '${param['nominal_value']} ${param['unit']}'),
                      _buildSpecItem('Upper Limit', '${param['upper_limit']} ${param['unit']}'),
                    ],
                  ),
                ],
              ),
            ),

            const SizedBox(height: 24),

            // Voice Capture Input Section
            Container(
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                color: const Color(0xFF0D1424),
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: const Color(0xFF1E293B)),
              ),
              child: Column(
                children: [
                  const Text('VOICE / MANUAL INPUT', style: TextStyle(color: Colors.blueGrey, fontSize: 12, fontWeight: FontWeight.bold)),
                  const SizedBox(height: 16),

                  // Big Mic Button for Live Speech Recording
                  GestureDetector(
                    onTap: _isProcessing ? null : _toggleVoiceRecording,
                    child: Container(
                      padding: const EdgeInsets.all(24),
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        color: _isRecording
                            ? Colors.redAccent
                            : (_isProcessing ? Colors.amber : Colors.blueAccent),
                        boxShadow: [
                          BoxShadow(
                            color: (_isRecording ? Colors.redAccent : Colors.blueAccent).withValues(alpha: 0.4),
                            blurRadius: 20,
                            spreadRadius: 4,
                          )
                        ],
                      ),
                      child: Icon(
                        _isRecording
                            ? Icons.stop_rounded
                            : (_isProcessing ? Icons.sync_rounded : Icons.mic_rounded),
                        size: 48,
                        color: Colors.white,
                      ),
                    ),
                  ),
                  const SizedBox(height: 12),
                  Text(
                    _isRecording
                        ? 'Recording... Tap to Stop & Validate'
                        : (_isProcessing ? 'Processing Speech...' : 'Tap Mic to Speak Reading'),
                    style: const TextStyle(color: Colors.white, fontSize: 14, fontWeight: FontWeight.w500),
                  ),
                  const SizedBox(height: 20),

                  // Manual Text Input Fallback
                  Row(
                    children: [
                      Expanded(
                        child: TextField(
                          controller: _inputController,
                          keyboardType: const TextInputType.numberWithOptions(decimal: true),
                          style: const TextStyle(color: Colors.white),
                          decoration: InputDecoration(
                            hintText: 'Or type value manually...',
                            hintStyle: const TextStyle(color: Colors.blueGrey),
                            filled: true,
                            fillColor: const Color(0xFF131D30),
                            border: OutlineInputBorder(
                              borderRadius: BorderRadius.circular(10),
                              borderSide: BorderSide.none,
                            ),
                          ),
                          onSubmitted: (val) => _submitSpokenOrTypedValue(val),
                        ),
                      ),
                      const SizedBox(width: 12),
                      ElevatedButton(
                        onPressed: () => _submitSpokenOrTypedValue(_inputController.text),
                        style: ElevatedButton.styleFrom(
                          backgroundColor: Colors.blueAccent,
                          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                        ),
                        child: const Text('CONFIRM', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
                      ),
                    ],
                  ),
                ],
              ),
            ),

            const SizedBox(height: 20),

            // Live Result Feedback Card
            if (_lastResult != null) ...[
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: _lastResult!['status'] == 'ok' ? Colors.green.withValues(alpha: 0.15) : Colors.red.withValues(alpha: 0.15),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(
                    color: _lastResult!['status'] == 'ok' ? Colors.green : Colors.red,
                  ),
                ),
                child: Row(
                  children: [
                    Icon(
                      _lastResult!['status'] == 'ok' ? Icons.check_circle_rounded : Icons.cancel_rounded,
                      color: _lastResult!['status'] == 'ok' ? Colors.green : Colors.red,
                      size: 32,
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            _lastResult!['status'] == 'ok' ? 'SPEC STATUS: WITHIN TOLERANCE (OK)' : 'SPEC STATUS: OUT OF SPECIFICATION',
                            style: TextStyle(
                              color: _lastResult!['status'] == 'ok' ? Colors.green : Colors.red,
                              fontWeight: FontWeight.bold,
                              fontSize: 14,
                            ),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            _lastResult!['message'] ?? '',
                            style: const TextStyle(color: Colors.white, fontSize: 13),
                          ),
                        ],
                      ),
                    )
                  ],
                ),
              ),
              const SizedBox(height: 20),
            ],

            // Navigation Buttons
            Row(
              children: [
                Expanded(
                  child: OutlinedButton(
                    onPressed: provider.currentParamIndex > 0 ? provider.previousParameter : null,
                    style: OutlinedButton.styleFrom(
                      side: const BorderSide(color: Colors.blueGrey),
                      padding: const EdgeInsets.symmetric(vertical: 14),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                    ),
                    child: const Text('PREVIOUS', style: TextStyle(color: Colors.white)),
                  ),
                ),
                const SizedBox(width: 16),
                Expanded(
                  child: ElevatedButton(
                    onPressed: () {
                      if (provider.currentParamIndex < totalCount - 1) {
                        provider.nextParameter();
                        setState(() {
                          _lastResult = null;
                        });
                      } else {
                        Navigator.pushReplacement(
                          context,
                          MaterialPageRoute(builder: (_) => const SummaryScreen()),
                        );
                      }
                    },
                    style: ElevatedButton.styleFrom(
                      backgroundColor: Colors.blueAccent,
                      padding: const EdgeInsets.symmetric(vertical: 14),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                    ),
                    child: Text(
                      provider.currentParamIndex < totalCount - 1 ? 'NEXT PARAM' : 'FINISH SESSION',
                      style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold),
                    ),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildSpecItem(String label, String value) {
    return Column(
      children: [
        Text(label, style: const TextStyle(color: Colors.blueGrey, fontSize: 12)),
        const SizedBox(height: 4),
        Text(value, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 15)),
      ],
    );
  }
}
