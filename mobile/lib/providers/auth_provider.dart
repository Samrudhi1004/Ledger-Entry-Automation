import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../services/api_service.dart';

class AuthProvider with ChangeNotifier {
  bool _isAuthenticated = false;
  String? _username;
  bool _isLoading = false;

  bool get isAuthenticated => _isAuthenticated;
  String? get username => _username;
  bool get isLoading => _isLoading;

  AuthProvider() {
    checkLoginStatus();
  }

  Future<void> checkLoginStatus() async {
    final token = await ApiService.getToken();
    if (token != null) {
      _isAuthenticated = true;
      final prefs = await SharedPreferences.getInstance();
      _username = prefs.getString('username') ?? 'Operator';
    } else {
      _isAuthenticated = false;
    }
    notifyListeners();
  }

  Future<bool> login(String username, String password) async {
    _isLoading = true;
    notifyListeners();

    final result = await ApiService.login(username, password);

    _isLoading = false;
    if (result['success'] == true) {
      _isAuthenticated = true;
      _username = username;
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString('username', username);
      notifyListeners();
      return true;
    } else {
      notifyListeners();
      return false;
    }
  }

  Future<void> logout() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.clear();
    _isAuthenticated = false;
    _username = null;
    notifyListeners();
  }
}
