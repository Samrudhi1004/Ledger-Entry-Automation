import 'dart:convert';
import 'dart:io';
import 'package:flutter/foundation.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:http/http.dart' as http;
import 'package:path_provider/path_provider.dart';
import 'package:shared_preferences/shared_preferences.dart';

class ApiService {
  // Base API URL
  // For physical Android device via USB, run ADB port forwarding in your terminal:
  // & "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe" reverse tcp:8000 tcp:8000
  static String baseUrl = 'http://127.0.0.1:8000/api';

  // Secure storage for JWT tokens — survives app uninstall on some platforms
  static const _secure = FlutterSecureStorage(
    aOptions: AndroidOptions(encryptedSharedPreferences: true),
  );

  // ── Token Storage ──────────────────────────────────────────────────────────

  /// Read access token. Checks secure storage first, falls back to SharedPreferences
  /// (for backwards-compatibility with existing installs).
  static Future<String?> getToken() async {
    try {
      final secure = await _secure.read(key: 'access_token');
      if (secure != null && secure.isNotEmpty) return secure;
    } catch (_) {}
    // Fallback: SharedPreferences (old installs before secure storage migration)
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString('access_token');
  }

  static Future<void> _writeTokens(String access, String refresh) async {
    try {
      await _secure.write(key: 'access_token', value: access);
      await _secure.write(key: 'refresh_token', value: refresh);
    } catch (_) {}
    // Also keep in SharedPreferences for backwards compat
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('access_token', access);
    await prefs.setString('refresh_token', refresh);
  }

  static Future<void> clearTokens() async {
    try {
      await _secure.delete(key: 'access_token');
      await _secure.delete(key: 'refresh_token');
    } catch (_) {}
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove('access_token');
    await prefs.remove('refresh_token');
  }

  /// Silently refresh the access token using the stored refresh token.
  /// Returns true if a new access token was obtained successfully.
  /// Called by AuthProvider.checkLoginStatus() to extend sessions.
  static Future<bool> refreshToken() async {
    try {
      // Read refresh token from secure storage or SharedPreferences
      String? refresh;
      try {
        refresh = await _secure.read(key: 'refresh_token');
      } catch (_) {}
      if (refresh == null || refresh.isEmpty) {
        final prefs = await SharedPreferences.getInstance();
        refresh = prefs.getString('refresh_token');
      }
      if (refresh == null || refresh.isEmpty) return false;

      final response = await http.post(
        Uri.parse('$baseUrl/users/token/refresh/'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({'refresh': refresh}),
      ).timeout(const Duration(seconds: 8));

      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        final newAccess = data['access'] as String?;
        if (newAccess != null && newAccess.isNotEmpty) {
          // Write new access token; keep existing refresh token
          try {
            await _secure.write(key: 'access_token', value: newAccess);
          } catch (_) {}
          final prefs = await SharedPreferences.getInstance();
          await prefs.setString('access_token', newAccess);
          // If a new refresh token was also returned, persist it
          final newRefresh = data['refresh'] as String?;
          if (newRefresh != null && newRefresh.isNotEmpty) {
            try {
              await _secure.write(key: 'refresh_token', value: newRefresh);
            } catch (_) {}
            await prefs.setString('refresh_token', newRefresh);
          }
          debugPrint('[ApiService] Token refreshed successfully.');
          return true;
        }
      }
    } catch (e) {
      debugPrint('[ApiService] refreshToken error: $e');
    }
    return false;
  }

  static Future<Map<String, String>> _headers() async {
    final token = await getToken();
    return {
      'Content-Type': 'application/json',
      if (token != null) 'Authorization': 'Bearer $token',
    };
  }

  // 1. Auth: Login
  static Future<Map<String, dynamic>> login(String username, String password) async {
    try {
      final response = await http.post(
        Uri.parse('$baseUrl/users/login/'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({'username': username, 'password': password}),
      ).timeout(const Duration(seconds: 10));

      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        // Persist tokens securely
        await _writeTokens(data['access'], data['refresh']);
        // User info in SharedPreferences (not sensitive)
        if (data['user'] != null) {
          final prefs = await SharedPreferences.getInstance();
          await prefs.setString('user_info', jsonEncode(data['user']));
        }
        return {'success': true, 'data': data};
      } else {
        final body = jsonDecode(response.body);
        return {
          'success': false,
          'message': body['detail'] ?? 'Login failed (${response.statusCode})'
        };
      }
    } catch (e) {
      return {'success': false, 'message': 'Cannot connect to backend server (http://127.0.0.1:8000). Verify adb reverse tcp:8000 tcp:8000'};
    }
  }

  // 2. Machine QR / Code Lookup
  static Future<Map<String, dynamic>?> getMachineByCode(String code) async {
    final response = await http.get(
      Uri.parse('$baseUrl/machines/scan/$code/'),
      headers: await _headers(),
    );

    if (response.statusCode == 200) {
      return jsonDecode(response.body);
    }
    return null;
  }

  // 2b. Get All Floor Machines
  static Future<List<dynamic>> getMachines() async {
    try {
      final response = await http.get(
        Uri.parse('$baseUrl/machines/'),
        headers: await _headers(),
      );

      if (response.statusCode == 200) {
        final decoded = jsonDecode(response.body);
        if (decoded is List) return decoded;
        if (decoded is Map && decoded['results'] != null) return decoded['results'];
      }
    } catch (_) {}
    return [];
  }

  // 3. Get Parts by Machine
  static Future<List<dynamic>> getPartsByMachine(int machineId) async {
    final response = await http.get(
      Uri.parse('$baseUrl/parts/?machine=$machineId'),
      headers: await _headers(),
    );

    if (response.statusCode == 200) {
      final decoded = jsonDecode(response.body);
      if (decoded is List) return decoded;
      if (decoded is Map && decoded['results'] != null) return decoded['results'];
    }
    return [];
  }

  // 4. Get Templates by Part
  static Future<List<dynamic>> getTemplatesByPart(String partNumber) async {
    final response = await http.get(
      Uri.parse('$baseUrl/parts/$partNumber/templates/'),
      headers: await _headers(),
    );

    if (response.statusCode == 200) {
      final decoded = jsonDecode(response.body);
      if (decoded is List) return decoded;
      if (decoded is Map && decoded['results'] != null) return decoded['results'];
      if (decoded is Map) return [decoded];
    }
    return [];
  }

  // 5. Get Parameters for a Template
  static Future<List<dynamic>> getParameters(int templateId) async {
    final response = await http.get(
      Uri.parse('$baseUrl/parts/templates/$templateId/parameters/'),
      headers: await _headers(),
    );

    if (response.statusCode == 200) {
      final decoded = jsonDecode(response.body);
      if (decoded is List) return decoded;
      if (decoded is Map && decoded['results'] != null) return decoded['results'];
    }
    return [];
  }

  // 5b. Get Process Parameters for a Template (Setup Approval Only)
  static Future<List<dynamic>> getProcessParameters(int templateId) async {
    final response = await http.get(
      Uri.parse('$baseUrl/parts/templates/$templateId/process-parameters/'),
      headers: await _headers(),
    );

    if (response.statusCode == 200) {
      final decoded = jsonDecode(response.body);
      if (decoded is List) return decoded;
      if (decoded is Map && decoded['results'] != null) return decoded['results'];
    }
    return [];
  }

  // 6. Start Inspection Session
  static Future<Map<String, dynamic>?> startSession({
    required String partNumber,
    required int machineId,
    required int templateId,
    required String inspectionType,
    required String shift,
    int trialNumber = 1,
    int hourlySlot = 1,
    String? parentSessionId,
  }) async {
    final response = await http.post(
      Uri.parse('$baseUrl/inspections/start/'),
      headers: await _headers(),
      body: jsonEncode({
        'part_number': partNumber,
        'machine_id': machineId,
        'template_id': templateId,
        'inspection_type': inspectionType,
        'shift': shift,
        'trial_number': trialNumber,
        'hourly_slot': hourlySlot,
        'parent_session_id': parentSessionId,
      }),
    );

    if (response.statusCode == 201 || response.statusCode == 200) {
      return jsonDecode(response.body);
    }
    return null;
  }

  // Fetch session detail document
  static Future<Map<String, dynamic>?> getSessionDetail(String sessionId) async {
    try {
      final response = await http.get(
        Uri.parse('$baseUrl/inspections/$sessionId/'),
        headers: await _headers(),
      );
      if (response.statusCode == 200) {
        return jsonDecode(response.body);
      }
    } catch (_) {}
    return null;
  }

  // Download PDF Report file for Session
  static Future<String?> downloadSessionPDF(String sessionId) async {
    try {
      final token = await getToken();
      final response = await http.get(
        Uri.parse('$baseUrl/inspections/$sessionId/pdf/'),
        headers: {
          if (token != null) 'Authorization': 'Bearer $token',
        },
      );

      if (response.statusCode == 200) {
        final dir = await getApplicationDocumentsDirectory();
        final file = File('${dir.path}/FirstPiece_Report_${sessionId.substring(0, 8)}.pdf');
        await file.writeAsBytes(response.bodyBytes);
        return file.path;
      }
    } catch (e) {
      debugPrint('[API] PDF Download error: $e');
    }
    return null;
  }

  // Fetch list of inspection sessions
  static Future<List<dynamic>> getSessions({String? machineCode}) async {
    try {
      final query = machineCode != null ? '?machine=$machineCode' : '';
      final response = await http.get(
        Uri.parse('$baseUrl/inspections/$query'),
        headers: await _headers(),
      );
      if (response.statusCode == 200) {
        final decoded = jsonDecode(response.body);
        if (decoded is List) return decoded;
        if (decoded is Map && decoded['results'] != null) return decoded['results'];
      }
    } catch (_) {}
    return [];
  }

  // Fetch 1st Piece Setup Approval Status for Machine
  static Future<Map<String, dynamic>> checkSetupApproved(int machineId) async {
    try {
      final response = await http.get(
        Uri.parse('$baseUrl/inspections/setup-status/?machine=$machineId'),
        headers: await _headers(),
      );

      if (response.statusCode == 200) {
        return jsonDecode(response.body);
      }
    } catch (_) {}
    return {'is_setup_approved': false};
  }

  // Fetch active supervisor rejections for operator
  static Future<List<dynamic>> getRejections() async {
    final response = await http.get(
      Uri.parse('$baseUrl/inspections/rejections/'),
      headers: await _headers(),
    );

    if (response.statusCode == 200) {
      final decoded = jsonDecode(response.body);
      if (decoded is List) return decoded;
      if (decoded is Map && decoded['results'] != null) return decoded['results'];
    }
    return [];
  }

  // 7. Transcribe Voice Audio File
  static Future<Map<String, dynamic>> transcribeVoice(String filePath) async {
    final request = http.MultipartRequest(
      'POST',
      Uri.parse('$baseUrl/voice/transcribe/'),
    );
    final token = await getToken();
    if (token != null) {
      request.headers['Authorization'] = 'Bearer $token';
    }

    request.files.add(await http.MultipartFile.fromPath('audio_file', filePath));
    final streamedResponse = await request.send();
    final response = await http.Response.fromStream(streamedResponse);

    if (response.statusCode == 200) {
      return jsonDecode(response.body);
    } else {
      return {'error': 'Failed to transcribe audio'};
    }
  }

  // 8. Transcribe Text / Parse Measurement Directly
  static Future<Map<String, dynamic>> parseText(String text) async {
    final response = await http.post(
      Uri.parse('$baseUrl/voice/parse/'),
      headers: await _headers(),
      body: jsonEncode({'text': text}),
    );

    if (response.statusCode == 200) {
      return jsonDecode(response.body);
    }
    return {'is_parseable': false};
  }

  // 9. Record Measurement
  static Future<Map<String, dynamic>?> recordMeasurement({
    required String sessionId,
    required String parameterCode,
    required double value,
    String voiceRawText = '',
    String method = 'voice',
    int? hourlySlot,
    String? inspectionType,
  }) async {
    final response = await http.post(
      Uri.parse('$baseUrl/inspections/$sessionId/measure/'),
      headers: await _headers(),
      body: jsonEncode({
        'parameter_code': parameterCode,
        'measured_value': value,
        'voice_raw_text': voiceRawText,
        'method': method,
        'hourly_slot': hourlySlot,
        'inspection_type': inspectionType,
      }),
    );

    if (response.statusCode == 200) {
      return jsonDecode(response.body);
    }
    return null;
  }

  // 10. Complete Session
  static Future<bool> completeSession(String sessionId) async {
    final response = await http.post(
      Uri.parse('$baseUrl/inspections/$sessionId/complete/'),
      headers: await _headers(),
    );

    return response.statusCode == 200;
  }

  // 11. Finalize First Piece Session (Inspector Workflow)
  static Future<Map<String, dynamic>?> finalizeFirstPiece(String sessionId) async {
    final response = await http.post(
      Uri.parse('$baseUrl/inspections/$sessionId/finalize/'),
      headers: await _headers(),
    );

    if (response.statusCode == 200) {
      return jsonDecode(response.body);
    }
    return null;
  }

  // 12. Get Users (Filtered by role e.g. 'operator')
  static Future<List<dynamic>> getUsers({String? role}) async {
    try {
      final url = (role != null && role.isNotEmpty)
          ? '$baseUrl/users/?role=$role'
          : '$baseUrl/users/';
      final response = await http.get(
        Uri.parse(url),
        headers: await _headers(),
      );

      if (response.statusCode == 200) {
        final decoded = jsonDecode(response.body);
        if (decoded is List) return decoded;
        if (decoded is Map && decoded['results'] != null) return decoded['results'];
      }
    } catch (_) {}
    return [];
  }

  // 13. Submit Setup Approval — Process Parameters for 1PC#1, 1PC#2, 1PC#3
  // Called from SetupApprovalScreen after Inspector enters all process param values.
  // Stored as inspection_type='setup_approval' in the backend (separate from FPI sessions).
  static Future<Map<String, dynamic>?> submitSetupApproval({
    required int templateId,
    required int machineId,
    required String partNumber,
    required List<Map<String, dynamic>> processParamEntries,
    // processParamEntries: [
    //   { 'parameter_code': 'PR1', 'trial_1': '1200', 'trial_2': '1250', 'trial_3': '1200' },
    //   ...
    // ]
    required String inspectorName,
  }) async {
    try {
      final response = await http.post(
        Uri.parse('$baseUrl/inspections/setup-approval/'),
        headers: await _headers(),
        body: jsonEncode({
          'template_id': templateId,
          'machine_id': machineId,
          'part_number': partNumber,
          'process_param_entries': processParamEntries,
          'inspector_name': inspectorName,
        }),
      );
      if (response.statusCode == 200 || response.statusCode == 201) {
        return jsonDecode(response.body);
      }
    } catch (e) {
      debugPrint('[API] submitSetupApproval error: $e');
    }
    return null;
  }

  // 14. Get existing Setup Approval data for a template + machine
  // Used to pre-populate Setup Approval screen with previously saved values.
  static Future<Map<String, dynamic>?> getSetupApprovalData(int templateId, int machineId) async {
    try {
      final response = await http.get(
        Uri.parse('$baseUrl/inspections/setup-approval/?template=$templateId&machine=$machineId'),
        headers: await _headers(),
      );
      if (response.statusCode == 200) {
        return jsonDecode(response.body);
      }
    } catch (e) {
      debugPrint('[API] getSetupApprovalData error: $e');
    }
    return null;
  }

  // 15. Submit Daily Production Report (End of Day Entry)
  static Future<Map<String, dynamic>> submitDailyProductionReport(Map<String, dynamic> reportData) async {
    try {
      final response = await http.post(
        Uri.parse('$baseUrl/inspections/daily-production-reports/'),
        headers: await _headers(),
        body: jsonEncode(reportData),
      );
      if (response.statusCode == 200 || response.statusCode == 201) {
        return {'success': true, 'data': jsonDecode(response.body)};
      } else {
        final body = jsonDecode(response.body);
        String msg = 'Failed to submit report (${response.statusCode})';
        if (body is Map) {
          final errs = <String>[];
          body.forEach((key, val) {
            if (val is List) {
              errs.add(val.join(', '));
            } else {
              errs.add(val.toString());
            }
          });
          if (errs.isNotEmpty) msg = errs.join('\n');
        }
        return {'success': false, 'message': msg};
      }
    } catch (e) {
      return {'success': false, 'message': 'Network error: $e'};
    }
  }
}


