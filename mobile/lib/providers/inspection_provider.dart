import 'package:flutter/material.dart';
import '../services/api_service.dart';
import '../services/persistence_service.dart';

class InspectionProvider with ChangeNotifier {
  Map<String, dynamic>? selectedMachine;
  Map<String, dynamic>? selectedPart;
  Map<String, dynamic>? selectedTemplate;
  List<dynamic> parameters = [];
  int currentParamIndex = 0;

  String? sessionId;
  int trialNumber = 1;
  String shift = 'A';
  String inspectionType = 'first_piece';
  String? parentSessionId;
  List<dynamic> activeRejections = [];
  Map<String, dynamic>? activeRejectionNotice;
  Map<String, Map<String, dynamic>> recordedResults = {};
  Map<String, Map<String, dynamic>> pendingBatchValues = {};
  bool isLoading = false;
  String? errorMessage;

  void selectMachine(Map<String, dynamic> machine) {
    selectedMachine = machine;
    selectedPart = null;
    selectedTemplate = null;
    parameters = [];
    currentParamIndex = 0;
    trialNumber = 1;
    parentSessionId = null;
    recordedResults.clear();
    saveCurrentState();
    notifyListeners();
  }

  void resetForNextOperation() {
    selectedPart = null;
    selectedTemplate = null;
    parameters = [];
    currentParamIndex = 0;
    sessionId = null;
    trialNumber = 1;
    parentSessionId = null;
    recordedResults.clear();
    activeRejectionNotice = null;
    isLoading = false;
    errorMessage = null;
    notifyListeners();
  }

  void logout() {
    selectedMachine = null;
    currentUserId = null; // prevent future saves after logout
    resetForNextOperation();
    PersistenceService.clearState(); // wipe saved session from disk on explicit logout
  }

  void selectPart(Map<String, dynamic> part) {
    selectedPart = part;
    selectedTemplate = null;
    parameters = [];
    saveCurrentState();
    notifyListeners();
  }

  String? currentUserId;

  void restoreFromLocalState(Map<String, dynamic> state, String userId) {
    currentUserId = userId;
    sessionId = state['session_id'];
    selectedMachine = state['machine'];
    selectedPart = state['part'];
    selectedTemplate = state['template'];
    inspectionType = state['inspection_type'] ?? 'first_piece';
    trialNumber = state['trial_number'] ?? 1;
    hourlySlot = state['hourly_slot'] ?? 1;
    completedHourlySlots = Set<int>.from(state['completed_slots'] ?? []);
    parameters = state['parameters'] ?? [];
    
    if (state['recorded_results'] != null) {
      final Map<String, dynamic> results = state['recorded_results'];
      recordedResults.clear();
      for (final entry in results.entries) {
        recordedResults[entry.key] = Map<String, dynamic>.from(entry.value);
      }
    }
    
    // Automatically determine where the user left off
    currentParamIndex = 0;
    if (parameters.isNotEmpty) {
      for (int i = 0; i < parameters.length; i++) {
        final code = parameters[i]['parameter_code']?.toString();
        if (code != null && !recordedResults.containsKey(code)) {
          currentParamIndex = i;
          break;
        }
      }
    }
    notifyListeners();
  }

  Future<void> saveCurrentState() async {
    if (currentUserId == null) {
      debugPrint('[InspectionProvider] WARNING: saveCurrentState() called but currentUserId is null — state NOT saved! Ensure provider.currentUserId is set at login/splash.');
      return;
    }
    await PersistenceService.saveState(
      userId: currentUserId!,
      sessionId: sessionId,
      machine: selectedMachine,
      part: selectedPart,
      template: selectedTemplate,
      inspectionType: inspectionType,
      trialNumber: trialNumber,
      hourlySlot: hourlySlot,
      completedHourlySlots: completedHourlySlots,
      parameters: parameters,
      recordedResults: recordedResults,
    );
  }

  Future<void> fetchPendingRejections() async {
    try {
      final list = await ApiService.getRejections();
      activeRejections = list;
      notifyListeners();
    } catch (e) {
      debugPrint('Error fetching rejections: $e');
    }
  }

  Future<void> loadParameters(
    Map<String, dynamic> template, {
    List<dynamic>? targetRejectedCodes,
    bool isFirstPiece = false,
    String? categoryFilter,
  }) async {
    selectedTemplate = template;
    isLoading = true;
    notifyListeners();

    List<dynamic> allCombined = [];

    if (categoryFilter == 'process') {
      final procParams = await ApiService.getProcessParameters(template['id']);
      for (var pp in procParams) {
        pp['is_process_parameter'] = true;
      }
      allCombined = procParams;
    } else if (categoryFilter == 'product') {
      final prodParams = await ApiService.getParameters(template['id']);
      allCombined = List.from(prodParams);
    } else {
      // Default / 'all': Process parameters FIRST, then product parameters for First Piece Inspection
      final prodParams = await ApiService.getParameters(template['id']);
      final procParams = await ApiService.getProcessParameters(template['id']);
      for (var pp in procParams) {
        pp['is_process_parameter'] = true;
      }
      allCombined = [...procParams, ...prodParams];
    }

    if (targetRejectedCodes != null && targetRejectedCodes.isNotEmpty) {
      final filtered = allCombined.where((p) => targetRejectedCodes.contains(p['parameter_code'])).toList();
      parameters = filtered.isNotEmpty ? filtered : allCombined;
    } else {
      parameters = allCombined;
    }
    currentParamIndex = 0;
    recordedResults.clear();
    isLoading = false;
    notifyListeners();
  }

  Future<void> loadParametersForRetrial(Map<String, dynamic> template, {required int trial}) async {
    selectedTemplate = template;
    isLoading = true;
    notifyListeners();

    final prodParams = await ApiService.getParameters(template['id']);
    final procParams = await ApiService.getProcessParameters(template['id']);
    for (var pp in procParams) {
      pp['is_process_parameter'] = true;
    }
    final allParams = [...procParams, ...prodParams];
    await fetchPendingRejections();
    List<dynamic> targetCodes = [];

    if (activeRejections.isNotEmpty) {
      targetCodes = activeRejections.first['rejected_parameters'] ?? [];
    }

    if (targetCodes.isEmpty && selectedMachine != null) {
      final setupInfo = await ApiService.checkSetupApproved(selectedMachine!['id']);
      if (setupInfo['session_id'] != null) {
        final sessionDoc = await ApiService.getSessionDetail(setupInfo['session_id']);
        if (sessionDoc != null && sessionDoc['measurements'] != null) {
          final measurements = sessionDoc['measurements'] as List;
          final prevTrial = trial - 1;
          final prevTrialMeasurements = measurements.where((m) => (m['trial_number'] ?? 1) == prevTrial).toList();
          final oocCodes = prevTrialMeasurements
              .where((m) => m['status'] == 'out_of_spec')
              .map((m) => m['parameter_code'])
              .toSet()
              .toList();
          if (oocCodes.isNotEmpty) {
            targetCodes = oocCodes;
          }
        }
      }
    }

    if (targetCodes.isNotEmpty) {
      final filtered = allParams.where((p) => targetCodes.contains(p['parameter_code'])).toList();
      parameters = filtered.isNotEmpty ? filtered : allParams;
    } else {
      parameters = allParams;
    }

    currentParamIndex = 0;
    recordedResults.clear();
    isLoading = false;
    notifyListeners();
  }

  int hourlySlot = 1;
  Set<int> completedHourlySlots = {};

  void setHourlySlot(int slot) {
    hourlySlot = slot;
    inspectionType = 'hourly';
    notifyListeners();
  }

  void markHourlySlotCompleted(int slot) {
    completedHourlySlots.add(slot);
    if (hourlySlot < 8) {
      hourlySlot = slot + 1;
    }
    notifyListeners();
  }

  void syncCompletedSlots(List<int> slots) {
    completedHourlySlots.addAll(slots);
    if (completedHourlySlots.isNotEmpty) {
      final maxDone = completedHourlySlots.reduce((a, b) => a > b ? a : b);
      if (maxDone >= hourlySlot && maxDone < 8) {
        hourlySlot = maxDone + 1;
      }
    }
    notifyListeners();
  }

  Future<void> restoreActiveReportState(Map<String, dynamic> setupStatus) async {
    if (setupStatus['session_id'] != null) {
      sessionId = setupStatus['session_id'].toString();

      if (selectedPart == null && setupStatus['part_number'] != null) {
        selectedPart = {
          'id': setupStatus['part_id'],
          'part_number': setupStatus['part_number'],
          'part_name': setupStatus['part_name'] ?? setupStatus['part_number'],
        };
      }

      if (selectedMachine == null && setupStatus['machine_id'] != null) {
        selectedMachine = {
          'id': setupStatus['machine_id'],
        };
      }

      if (setupStatus['completed_hourly_slots'] is List) {
        final List<int> slots = List<int>.from(setupStatus['completed_hourly_slots']);
        syncCompletedSlots(slots);
      }

      if (setupStatus['next_unlocked_slot'] is int) {
        final int next = setupStatus['next_unlocked_slot'];
        if (next > 0 && next <= 8) {
          hourlySlot = next;
        }
      }

      try {
        final doc = await ApiService.getSessionDetail(sessionId!);
        if (doc != null && doc['measurements'] is List) {
          recordedResults.clear();
          for (var m in doc['measurements']) {
            final code = m['parameter_code'];
            if (code != null) {
              recordedResults[code.toString()] = m;
            }
          }
        }
      } catch (e) {
        debugPrint('Error restoring recorded measurements: $e');
      }
    }
    notifyListeners();
  }

  bool isHourlySlotUnlocked(int slot) {
    if (slot <= 1) return true;
    return completedHourlySlots.contains(slot - 1);
  }

  Future<bool> startSession({
    String shift = 'A',
    String inspectionType = 'first_piece',
    int trial = 1,
    int hourlySlot = 1,
    String? parentId,
  }) async {
    selectedPart ??= {'part_number': 'FBT00222', 'part_name': 'POLY V PULLEY'};
    selectedMachine ??= {'id': 1, 'machine_code': 'CNC-01', 'name': 'CNC Turning Center'};
    selectedTemplate ??= {'id': 1, 'name': 'Op 10 — Inspection', 'version': 10};

    isLoading = true;
    trialNumber = inspectionType == 'hourly' ? 0 : trial;
    this.hourlySlot = inspectionType == 'first_piece' ? 0 : hourlySlot;
    this.inspectionType = inspectionType;
    this.shift = shift;
    parentSessionId = parentId;
    notifyListeners();

    final mId = int.tryParse('${selectedMachine!['id']}') ?? 1;
    final tId = int.tryParse('${selectedTemplate!['id']}') ?? 1;
    final partNo = (selectedPart!['part_number'] ?? 'FBT00222').toString();

    final result = await ApiService.startSession(
      partNumber: partNo,
      machineId: mId,
      templateId: tId,
      inspectionType: inspectionType,
      shift: shift,
      trialNumber: trial,
      hourlySlot: inspectionType == 'first_piece' ? 0 : hourlySlot,
      parentSessionId: parentId,
    );

    isLoading = false;
    if (result != null && (result.containsKey('session_id') || result.containsKey('id'))) {
      sessionId = result['session_id'] ?? result['id'];
      saveCurrentState();
      notifyListeners();
      return true;
    } else {
      errorMessage = 'Failed to start inspection session';
      notifyListeners();
      return false;
    }
  }

  Map<String, dynamic>? get currentParameter {
    if (parameters.isEmpty || currentParamIndex >= parameters.length) {
      return null;
    }
    return parameters[currentParamIndex];
  }

  Future<Map<String, dynamic>?> submitMeasurement({
    required double value,
    required String voiceRawText,
    String method = 'voice',
  }) async {
    final param = currentParameter;
    if (param == null || sessionId == null) return null;

    isLoading = true;
    notifyListeners();

    final result = await ApiService.recordMeasurement(
      sessionId: sessionId!,
      parameterCode: param['parameter_code'],
      value: value,
      voiceRawText: voiceRawText,
      method: method,
      hourlySlot: inspectionType == 'first_piece' ? 0 : hourlySlot,
      inspectionType: inspectionType,
    );

    isLoading = false;
    if (result != null) {
      recordedResults[param['parameter_code']] = result;
      saveCurrentState();
      notifyListeners();
    }
    return result;
  }

  void setPendingValue(String code, double value, String voiceRawText, {String method = 'voice'}) {
    pendingBatchValues[code] = {
      'parameter_code': code,
      'measured_value': value,
      'voice_raw_text': voiceRawText,
      'method': method,
    };
    notifyListeners();
  }

  void clearPendingValues() {
    pendingBatchValues.clear();
    notifyListeners();
  }

  Future<Map<String, dynamic>?> submitBatchMeasurements() async {
    debugPrint('[PROVIDER] submitBatchMeasurements() called. sessionId=$sessionId');

    if (sessionId == null) {
      debugPrint('[PROVIDER] ERROR: sessionId is null — aborting batch submit.');
      return null;
    }

    isLoading = true;
    notifyListeners();

    final measurementsList = pendingBatchValues.values.toList();
    debugPrint('[PROVIDER] Submitting ${measurementsList.length} measurement(s): '
        '${measurementsList.map((m) => "${m['parameter_code']}=${m['measured_value']}").join(", ")}');

    try {
      final result = await ApiService.batchMeasure(
        sessionId: sessionId!,
        measurements: measurementsList,
      );
      debugPrint('[PROVIDER] batchMeasure API response: $result');

      // Populate recordedResults so the summary screen shows correct values
      if (result != null && result['results'] is List) {
        for (var r in (result['results'] as List)) {
          final code = r['parameter_code'];
          if (code != null) {
            recordedResults[code.toString()] = r;
            debugPrint('[PROVIDER] recordedResult saved: $code → status=${r['status']}');
          }
        }
        saveCurrentState(); // Persist recorded results
      }
      return result;
    } catch (e, stack) {
      debugPrint('[PROVIDER] EXCEPTION in batchMeasure API call: $e');
      debugPrint('[PROVIDER] Stack trace: $stack');
      return null;
    } finally {
      // ← CRITICAL: always reset isLoading so the UI doesn't stay in loading state
      isLoading = false;
      notifyListeners();
      debugPrint('[PROVIDER] isLoading reset to false.');
    }
  }


  void nextParameter() {
    if (currentParamIndex < parameters.length - 1) {
      currentParamIndex++;
      notifyListeners();
    }
  }

  void previousParameter() {
    if (currentParamIndex > 0) {
      currentParamIndex--;
      notifyListeners();
    }
  }

  void advanceToNext() => nextParameter();
  void goToPrev() => previousParameter();
  void jumpToParam(int index) => goToParameter(index);

  void goToParameter(int index) {
    if (index >= 0 && index < parameters.length) {
      currentParamIndex = index;
      notifyListeners();
    }
  }

  bool isParamFilled(String code) => recordedResults.containsKey(code);

  String? getParamStatus(String code) => recordedResults[code]?['status'];

  dynamic getParamReading(String code) => recordedResults[code]?['value'];

  int get filledCount => recordedResults.length;

  int get remainingCount => parameters.length - recordedResults.length;

  Future<bool> completeSession() async {
    if (sessionId == null) return false;

    isLoading = true;
    notifyListeners();

    final currentSlot = hourlySlot;
    final success = await ApiService.completeSession(sessionId!);
    if (success) {
      // Session fully submitted — clear local saved state so it doesn't
      // appear as a resume-able session on next app open.
      await PersistenceService.clearState();
      if (inspectionType == 'hourly') {
        if (!completedHourlySlots.contains(currentSlot)) {
          completedHourlySlots.add(currentSlot);
        }
        if (hourlySlot < 8) {
          hourlySlot = hourlySlot + 1;
        }
      }
    }
    isLoading = false;
    notifyListeners();
    return success;
  }

  Future<Map<String, dynamic>?> finalizeFirstPieceSession() async {
    if (sessionId == null) return null;

    isLoading = true;
    notifyListeners();

    final result = await ApiService.finalizeFirstPiece(sessionId!);
    if (result != null) {
      // Session finalized — clear local saved state so it doesn't
      // appear as a resume-able session on next app open.
      await PersistenceService.clearState();
      completedHourlySlots.add(hourlySlot);
      if (hourlySlot < 8) {
        hourlySlot = hourlySlot + 1;
      }
    }
    isLoading = false;
    notifyListeners();
    return result;
  }
}


