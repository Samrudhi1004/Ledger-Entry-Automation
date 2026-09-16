import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../services/api_service.dart';
import 'package:http/http.dart' as http;

class CompanyProvider extends ChangeNotifier {
  String _companyName = 'Liha Tech Factory 1';
  String _companyCode = 'LIHA-F1';
  int _shiftHours = 8;
  int _totalShiftsPerDay = 3;
  bool _isLoading = false;

  String get companyName => _companyName;
  String get companyCode => _companyCode;
  int get shiftHours => _shiftHours;
  int get totalShiftsPerDay => _totalShiftsPerDay;
  List<String> get availableShifts => _shiftHours == 12 ? const ['I', 'II'] : const ['I', 'II', 'III'];
  bool get isLoading => _isLoading;

  CompanyProvider() {
    _loadFromCache();
    fetchCompanyDetails();
  }

  Future<void> _loadFromCache() async {
    final prefs = await SharedPreferences.getInstance();
    _companyName = prefs.getString('company_name') ?? 'Liha Tech Factory 1';
    _companyCode = prefs.getString('company_code') ?? 'LIHA-F1';
    _shiftHours = prefs.getInt('shift_hours') ?? 8;
    _totalShiftsPerDay = prefs.getInt('total_shifts_per_day') ?? (_shiftHours == 12 ? 2 : 3);
    notifyListeners();
  }

  Future<void> fetchCompanyDetails() async {
    _isLoading = true;
    notifyListeners();

    try {
      final token = await ApiService.getToken();
      final headers = <String, String>{
        'Content-Type': 'application/json',
        if (token != null) 'Authorization': 'Bearer $token',
      };
      final res = await http.get(
        Uri.parse('${ApiService.baseUrl}/machines/factories/'),
        headers: headers,
      );
      if (res.statusCode == 200) {
        final data = json.decode(res.body);
        final results = data['results'] ?? data;
        if (results is List && results.isNotEmpty) {
          final primary = results[0];
          _companyName = primary['name'] ?? 'Liha Tech Factory 1';
          _companyCode = primary['code'] ?? 'LIHA-F1';
          _shiftHours = primary['shift_hours'] is int
              ? primary['shift_hours']
              : int.tryParse(primary['shift_hours']?.toString() ?? '8') ?? 8;
          _totalShiftsPerDay = primary['total_shifts_per_day'] is int
              ? primary['total_shifts_per_day']
              : int.tryParse(primary['total_shifts_per_day']?.toString() ?? '3') ?? (_shiftHours == 12 ? 2 : 3);

          final prefs = await SharedPreferences.getInstance();
          await prefs.setString('company_name', _companyName);
          await prefs.setString('company_code', _companyCode);
          await prefs.setInt('shift_hours', _shiftHours);
          await prefs.setInt('total_shifts_per_day', _totalShiftsPerDay);
        }
      }
    } catch (e) {
      debugPrint('[CompanyProvider] Failed to fetch company details: $e');
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }
}
