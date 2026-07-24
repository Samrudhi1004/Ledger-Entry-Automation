import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';

class ApiService {
  // Base API URL
  // For physical Android device via USB, run ADB port forwarding in your terminal:
  // & "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe" reverse tcp:8000 tcp:8000
  static String baseUrl = 'http://127.0.0.1:8000/api';

  static Future<String?> getToken() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString('access_token');
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
    final response = await http.post(
      Uri.parse('$baseUrl/users/login/'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({'username': username, 'password': password}),
    );

    if (response.statusCode == 200) {
      final data = jsonDecode(response.body);
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString('access_token', data['access']);
      await prefs.setString('refresh_token', data['refresh']);
      if (data['user'] != null) {
        await prefs.setString('user_info', jsonEncode(data['user']));
      }
      return {'success': true, 'data': data};
    } else {
      return {
        'success': false,
        'message': jsonDecode(response.body)['detail'] ?? 'Login failed'
      };
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

  // 6. Start Inspection Session
  static Future<Map<String, dynamic>?> startSession({
    required String partNumber,
    required int machineId,
    required int templateId,
    required String inspectionType,
    required String shift,
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
      }),
    );

    if (response.statusCode == 201 || response.statusCode == 200) {
      return jsonDecode(response.body);
    }
    return null;
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
  }) async {
    final response = await http.post(
      Uri.parse('$baseUrl/inspections/$sessionId/measure/'),
      headers: await _headers(),
      body: jsonEncode({
        'parameter_code': parameterCode,
        'measured_value': value,
        'voice_raw_text': voiceRawText,
        'method': method,
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
}
