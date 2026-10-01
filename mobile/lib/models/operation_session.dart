/// OperationSession — holds all per-operation state in memory.
///
/// One instance per (templateId + inspectionType) pair.
/// The InspectionProvider keeps a Map<String, OperationSession> so that
/// multiple operations can run concurrently without overwriting each other.
class OperationSession {
  /// Unique key: "${templateId}_${inspectionType}"  e.g. "12_hourly"
  final String operationKey;

  String? sessionId;
  Map<String, dynamic>? template;
  List<dynamic> parameters;
  Map<String, Map<String, dynamic>> recordedResults;
  Map<String, Map<String, dynamic>> pendingBatchValues;
  int currentParamIndex;
  String inspectionType;
  int hourlySlot;
  Set<int> completedHourlySlots;
  int trialNumber;
  String? parentSessionId;

  OperationSession({
    required this.operationKey,
    this.sessionId,
    this.template,
    List<dynamic>? parameters,
    Map<String, Map<String, dynamic>>? recordedResults,
    Map<String, Map<String, dynamic>>? pendingBatchValues,
    this.currentParamIndex = 0,
    this.inspectionType = '',
    this.hourlySlot = 1,
    Set<int>? completedHourlySlots,
    this.trialNumber = 1,
    this.parentSessionId,
  })  : parameters = parameters ?? [],
        recordedResults = recordedResults ?? {},
        pendingBatchValues = pendingBatchValues ?? {},
        completedHourlySlots = completedHourlySlots ?? {};

  /// Serialise to JSON for SharedPreferences persistence.
  Map<String, dynamic> toJson() => {
        'operation_key': operationKey,
        'session_id': sessionId,
        'template': template,
        'parameters': parameters,
        'recorded_results': recordedResults,
        'pending_batch_values': pendingBatchValues,
        'current_param_index': currentParamIndex,
        'inspection_type': inspectionType,
        'hourly_slot': hourlySlot,
        'completed_hourly_slots': completedHourlySlots.toList(),
        'trial_number': trialNumber,
        'parent_session_id': parentSessionId,
      };

  /// Restore from JSON loaded from SharedPreferences.
  factory OperationSession.fromJson(Map<String, dynamic> json) {
    Map<String, Map<String, dynamic>> _decodeResults(dynamic raw) {
      if (raw == null) return {};
      final Map<String, dynamic> src = Map<String, dynamic>.from(raw);
      return src.map((k, v) => MapEntry(k, Map<String, dynamic>.from(v as Map)));
    }

    return OperationSession(
      operationKey: json['operation_key'] as String,
      sessionId: json['session_id'] as String?,
      template: json['template'] != null
          ? Map<String, dynamic>.from(json['template'] as Map)
          : null,
      parameters: List<dynamic>.from(json['parameters'] ?? []),
      recordedResults: _decodeResults(json['recorded_results']),
      pendingBatchValues: _decodeResults(json['pending_batch_values']),
      currentParamIndex: (json['current_param_index'] as int?) ?? 0,
      inspectionType: (json['inspection_type'] as String?) ?? '',
      hourlySlot: (json['hourly_slot'] as int?) ?? 1,
      completedHourlySlots:
          Set<int>.from(List<int>.from(json['completed_hourly_slots'] ?? [])),
      trialNumber: (json['trial_number'] as int?) ?? 1,
      parentSessionId: json['parent_session_id'] as String?,
    );
  }
}
