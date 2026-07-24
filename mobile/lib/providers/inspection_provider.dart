import 'package:flutter/material.dart';
import '../services/api_service.dart';

class InspectionProvider with ChangeNotifier {
  Map<String, dynamic>? selectedMachine;
  Map<String, dynamic>? selectedPart;
  Map<String, dynamic>? selectedTemplate;
  List<dynamic> parameters = [];
  int currentParamIndex = 0;

  String? sessionId;
  Map<String, Map<String, dynamic>> recordedResults = {};
  bool isLoading = false;
  String? errorMessage;

  void selectMachine(Map<String, dynamic> machine) {
    selectedMachine = machine;
    selectedPart = null;
    selectedTemplate = null;
    parameters = [];
    currentParamIndex = 0;
    notifyListeners();
  }

  void selectPart(Map<String, dynamic> part) {
    selectedPart = part;
    selectedTemplate = null;
    parameters = [];
    notifyListeners();
  }

  Future<void> loadParameters(Map<String, dynamic> template) async {
    selectedTemplate = template;
    isLoading = true;
    notifyListeners();

    final result = await ApiService.getParameters(template['id']);
    parameters = result;
    currentParamIndex = 0;
    recordedResults.clear();
    isLoading = false;
    notifyListeners();
  }

  Future<bool> startSession({String shift = 'A', String inspectionType = 'first_piece'}) async {
    if (selectedPart == null || selectedMachine == null || selectedTemplate == null) {
      return false;
    }

    isLoading = true;
    notifyListeners();

    final result = await ApiService.startSession(
      partNumber: selectedPart!['part_number'],
      machineId: selectedMachine!['id'],
      templateId: selectedTemplate!['id'],
      inspectionType: inspectionType,
      shift: shift,
    );

    isLoading = false;
    if (result != null && (result.containsKey('session_id') || result.containsKey('id'))) {
      sessionId = result['session_id'] ?? result['id'];
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
    );

    isLoading = false;
    if (result != null) {
      recordedResults[param['parameter_code']] = result;
      notifyListeners();
    }
    return result;
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

  Future<bool> completeSession() async {
    if (sessionId == null) return false;

    isLoading = true;
    notifyListeners();

    final success = await ApiService.completeSession(sessionId!);
    isLoading = false;
    notifyListeners();
    return success;
  }
}
