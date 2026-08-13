import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// PersistenceService — saves & restores in-flight inspection state.
///
/// This service is ONLY responsible for local persistence and recovery.
/// It does NOT contain any business logic, validation, or submission logic.
/// The backend remains the primary source of truth.
///
/// Keys stored in SharedPreferences (prefixed `insp_` to avoid collisions):
///   insp_user_id          — userId who saved state (guards against cross-user resume)
///   insp_session_id       — active session UUID
///   insp_machine          — JSON of selectedMachine
///   insp_part             — JSON of selectedPart
///   insp_template         — JSON of selectedTemplate
///   insp_type             — inspection_type (first_piece / hourly)
///   insp_trial            — trialNumber (int)
///   insp_hourly_slot      — hourlySlot (int)
///   insp_completed_slots  — JSON list of completed slot ints
///   insp_parameters       — JSON list of parameter objects
///   insp_recorded_results — JSON map paramCode→result
///   insp_saved_at         — ISO8601 timestamp of last save
class PersistenceService {
  static const String _kUserId         = 'insp_user_id';
  static const String _kSessionId      = 'insp_session_id';
  static const String _kMachine        = 'insp_machine';
  static const String _kPart           = 'insp_part';
  static const String _kTemplate       = 'insp_template';
  static const String _kType           = 'insp_type';
  static const String _kTrial          = 'insp_trial';
  static const String _kHourlySlot     = 'insp_hourly_slot';
  static const String _kCompletedSlots = 'insp_completed_slots';
  static const String _kParameters     = 'insp_parameters';
  static const String _kRecordedResults= 'insp_recorded_results';
  static const String _kSavedAt        = 'insp_saved_at';

  /// Save the current inspection state. Called after any state mutation.
  /// [userId] — the logged-in user's ID or username, to guard cross-user resume.
  static Future<void> saveState({
    required String userId,
    required String? sessionId,
    required Map<String, dynamic>? machine,
    required Map<String, dynamic>? part,
    required Map<String, dynamic>? template,
    required String inspectionType,
    required int trialNumber,
    required int hourlySlot,
    required Set<int> completedHourlySlots,
    required List<dynamic> parameters,
    required Map<String, Map<String, dynamic>> recordedResults,
  }) async {
    // Only persist if there's an active session worth saving.
    if (sessionId == null && machine == null) return;

    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(_kUserId, userId);
      await prefs.setString(_kSessionId, sessionId ?? '');
      await prefs.setString(_kMachine, machine != null ? jsonEncode(machine) : '');
      await prefs.setString(_kPart, part != null ? jsonEncode(part) : '');
      await prefs.setString(_kTemplate, template != null ? jsonEncode(template) : '');
      await prefs.setString(_kType, inspectionType);
      await prefs.setInt(_kTrial, trialNumber);
      await prefs.setInt(_kHourlySlot, hourlySlot);
      await prefs.setString(_kCompletedSlots, jsonEncode(completedHourlySlots.toList()));
      await prefs.setString(_kParameters, jsonEncode(parameters));
      await prefs.setString(_kRecordedResults, jsonEncode(recordedResults));
      await prefs.setString(_kSavedAt, DateTime.now().toIso8601String());
    } catch (e) {
      debugPrint('[PersistenceService] saveState error: $e');
    }
  }

  /// Returns true if there is a saved state for the given userId.
  static Future<bool> hasSavedState(String userId) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final savedUser = prefs.getString(_kUserId);
      final sessionId = prefs.getString(_kSessionId);
      return savedUser == userId && (sessionId != null && sessionId.isNotEmpty);
    } catch (_) {
      return false;
    }
  }

  /// Load saved state. Returns null if nothing is saved or userId doesn't match.
  static Future<Map<String, dynamic>?> loadState(String userId) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final savedUser = prefs.getString(_kUserId);
      if (savedUser != userId) return null;

      final sessionId = prefs.getString(_kSessionId);
      if (sessionId == null || sessionId.isEmpty) return null;

      final machineStr        = prefs.getString(_kMachine) ?? '';
      final partStr           = prefs.getString(_kPart) ?? '';
      final templateStr       = prefs.getString(_kTemplate) ?? '';
      final completedSlotsStr = prefs.getString(_kCompletedSlots) ?? '[]';
      final parametersStr     = prefs.getString(_kParameters) ?? '[]';
      final recordedStr       = prefs.getString(_kRecordedResults) ?? '{}';

      return {
        'session_id':        sessionId,
        'machine':           machineStr.isNotEmpty ? jsonDecode(machineStr) : null,
        'part':              partStr.isNotEmpty    ? jsonDecode(partStr)    : null,
        'template':          templateStr.isNotEmpty? jsonDecode(templateStr): null,
        'inspection_type':   prefs.getString(_kType) ?? 'first_piece',
        'trial_number':      prefs.getInt(_kTrial) ?? 1,
        'hourly_slot':       prefs.getInt(_kHourlySlot) ?? 1,
        'completed_slots':   List<int>.from(jsonDecode(completedSlotsStr)),
        'parameters':        List<dynamic>.from(jsonDecode(parametersStr)),
        'recorded_results':  Map<String, dynamic>.from(jsonDecode(recordedStr)),
        'saved_at':          prefs.getString(_kSavedAt),
      };
    } catch (e) {
      debugPrint('[PersistenceService] loadState error: $e');
      return null;
    }
  }

  /// Returns a human-readable summary for the Resume dialog.
  static Future<Map<String, String>?> getSavedStateSummary(String userId) async {
    final state = await loadState(userId);
    if (state == null) return null;

    final machine  = state['machine']  as Map<String, dynamic>?;
    final part     = state['part']     as Map<String, dynamic>?;
    final itype    = state['inspection_type'] as String? ?? 'first_piece';
    final slot     = state['hourly_slot'] as int? ?? 1;
    final trial    = state['trial_number'] as int? ?? 1;
    final results  = state['recorded_results'] as Map<String, dynamic>? ?? {};
    final params   = state['parameters'] as List<dynamic>? ?? [];
    final savedAt  = state['saved_at']  as String?;

    final machineName  = machine?['machine_code'] ?? machine?['name'] ?? '—';
    final partName     = part?['part_name'] ?? part?['part_number'] ?? '—';
    final inspLabel    = itype == 'hourly' ? 'Hourly — Slot $slot/HR' : '1st Piece #$trial';
    final progress     = '${results.length} / ${params.length} Parameters';
    final savedLabel   = savedAt != null
        ? _friendlyTime(DateTime.parse(savedAt))
        : 'Recently';

    return {
      'machine':    machineName,
      'part':       partName,
      'inspection': inspLabel,
      'progress':   progress,
      'saved_at':   savedLabel,
    };
  }

  /// Clear inspection state (called after a session is fully completed or user starts new).
  static Future<void> clearState() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.remove(_kUserId);
      await prefs.remove(_kSessionId);
      await prefs.remove(_kMachine);
      await prefs.remove(_kPart);
      await prefs.remove(_kTemplate);
      await prefs.remove(_kType);
      await prefs.remove(_kTrial);
      await prefs.remove(_kHourlySlot);
      await prefs.remove(_kCompletedSlots);
      await prefs.remove(_kParameters);
      await prefs.remove(_kRecordedResults);
      await prefs.remove(_kSavedAt);
    } catch (e) {
      debugPrint('[PersistenceService] clearState error: $e');
    }
  }

  static String _friendlyTime(DateTime dt) {
    final now  = DateTime.now();
    final diff = now.difference(dt);
    if (diff.inMinutes < 1)  return 'Just now';
    if (diff.inMinutes < 60) return '${diff.inMinutes}m ago';
    if (diff.inHours   < 24) return '${diff.inHours}h ago';
    return '${diff.inDays}d ago';
  }
}
