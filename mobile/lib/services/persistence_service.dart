import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../models/operation_session.dart';

/// PersistenceService — saves & restores in-flight inspection state.
///
/// This service is ONLY responsible for local persistence and recovery.
/// It does NOT contain any business logic, validation, or submission logic.
/// The backend remains the primary source of truth.
class PersistenceService {
  static const String _kUserId = 'insp_user_id';
  static const String _kMachine = 'insp_machine';
  static const String _kPart = 'insp_part';
  static const String _kSessions = 'insp_sessions_map';
  static const String _kActiveOpKey = 'insp_active_op_key';
  static const String _kShiftHours = 'insp_shift_hours';
  static const String _kSavedAt = 'insp_saved_at';

  /// Save the current inspection state. Called after any state mutation.
  static Future<void> saveState({
    required String userId,
    required Map<String, dynamic>? machine,
    required Map<String, dynamic>? part,
    required Map<String, OperationSession> sessions,
    required String? activeOperationKey,
    required int shiftHours,
  }) async {
    // Only persist if there's an active machine/part context.
    if (machine == null && part == null && sessions.isEmpty) return;

    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(_kUserId, userId);
      await prefs.setString(
          _kMachine, machine != null ? jsonEncode(machine) : '');
      await prefs.setString(_kPart, part != null ? jsonEncode(part) : '');
      await prefs.setString(_kActiveOpKey, activeOperationKey ?? '');
      await prefs.setInt(_kShiftHours, shiftHours);

      final Map<String, dynamic> serializedSessions = {};
      sessions.forEach((key, session) {
        serializedSessions[key] = session.toJson();
      });
      await prefs.setString(_kSessions, jsonEncode(serializedSessions));
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
      final sessionsStr = prefs.getString(_kSessions);
      return savedUser == userId &&
          sessionsStr != null &&
          sessionsStr.length > 5; // > {}
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

      final sessionsStr = prefs.getString(_kSessions);
      if (sessionsStr == null || sessionsStr.isEmpty || sessionsStr == '{}') {
        return null;
      }

      final machineStr = prefs.getString(_kMachine) ?? '';
      final partStr = prefs.getString(_kPart) ?? '';
      final activeOpKey = prefs.getString(_kActiveOpKey);

      return {
        'machine': machineStr.isNotEmpty ? jsonDecode(machineStr) : null,
        'part': partStr.isNotEmpty ? jsonDecode(partStr) : null,
        'sessions': jsonDecode(sessionsStr),
        'active_operation_key': activeOpKey?.isNotEmpty == true ? activeOpKey : null,
        'shift_hours': prefs.getInt(_kShiftHours) ?? 8,
        'saved_at': prefs.getString(_kSavedAt),
      };
    } catch (e) {
      debugPrint('[PersistenceService] loadState error: $e');
      return null;
    }
  }

  /// Returns a human-readable summary for the Resume dialog.
  static Future<Map<String, String>?> getSavedStateSummary(
      String userId) async {
    final state = await loadState(userId);
    if (state == null) return null;

    final machine = state['machine'] as Map<String, dynamic>?;
    final part = state['part'] as Map<String, dynamic>?;
    final savedAt = state['saved_at'] as String?;
    final rawSessions = state['sessions'] as Map<String, dynamic>? ?? {};

    final machineName = machine?['machine_code'] ?? machine?['name'] ?? '—';
    final partName = part?['part_name'] ?? part?['part_number'] ?? '—';

    // Build a summary showing how many operations are in progress
    final int opCount = rawSessions.length;
    final progress = '$opCount operation(s) in progress';

    final savedLabel = savedAt != null
        ? _friendlyTime(DateTime.parse(savedAt))
        : 'Recently';

    return {
      'machine': machineName,
      'part': partName,
      'inspection': 'Multi-Operation Session',
      'progress': progress,
      'saved_at': savedLabel,
    };
  }

  /// Clear inspection state (called after a session is fully completed or user starts new).
  static Future<void> clearState() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.remove(_kUserId);
      await prefs.remove(_kMachine);
      await prefs.remove(_kPart);
      await prefs.remove(_kSessions);
      await prefs.remove(_kActiveOpKey);
      await prefs.remove(_kShiftHours);
      await prefs.remove(_kSavedAt);
      
      // Cleanup legacy keys just in case
      await prefs.remove('insp_session_id');
      await prefs.remove('insp_template');
      await prefs.remove('insp_type');
      await prefs.remove('insp_trial');
      await prefs.remove('insp_hourly_slot');
      await prefs.remove('insp_completed_slots');
      await prefs.remove('insp_parameters');
      await prefs.remove('insp_recorded_results');
    } catch (e) {
      debugPrint('[PersistenceService] clearState error: $e');
    }
  }

  static String _friendlyTime(DateTime dt) {
    final now = DateTime.now();
    final diff = now.difference(dt);
    if (diff.inMinutes < 1) return 'Just now';
    if (diff.inMinutes < 60) return '${diff.inMinutes}m ago';
    if (diff.inHours < 24) return '${diff.inHours}h ago';
    return '${diff.inDays}d ago';
  }
}
