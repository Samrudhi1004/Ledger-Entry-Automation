import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../services/api_service.dart';

class CompanyProvider extends ChangeNotifier {
  String _companyName = 'MANTRI METALLICS PVT. LTD.';
  String _companyCode = 'MMPL';
  bool _isLoading = false;

  String get companyName => _companyName;
  String get companyCode => _companyCode;
  bool get isLoading => _isLoading;

  CompanyProvider() {
    _loadFromCache();
    fetchCompanyDetails();
  }

  Future<void> _loadFromCache() async {
    final prefs = await SharedPreferences.getInstance();
    _companyName = prefs.getString('company_name') ?? 'MANTRI METALLICS PVT. LTD.';
    _companyCode = prefs.getString('company_code') ?? 'MMPL';
    notifyListeners();
  }

  Future<void> fetchCompanyDetails() async {
    _isLoading = true;
    notifyListeners();

    try {
      final res = await ApiService.get('/machines/factories/');
      if (res.statusCode == 200) {
        final data = json.decode(res.body);
        final results = data['results'] ?? data;
        if (results is List && results.isNotEmpty) {
          final primary = results[0];
          _companyName = primary['name'] ?? 'MANTRI METALLICS PVT. LTD.';
          _companyCode = primary['code'] ?? 'MMPL';

          final prefs = await SharedPreferences.getInstance();
          await prefs.setString('company_name', _companyName);
          await prefs.setString('company_code', _companyCode);
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
