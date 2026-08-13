import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../services/api_service.dart';

class AuthProvider with ChangeNotifier {
  bool _isAuthenticated = false;
  String? _username;
  String? _userRole;
  String? _fullName;
  bool _isLoading = false;

  bool get isAuthenticated => _isAuthenticated;
  String? get username => _username;
  String? get userRole => _userRole;
  String? get fullName => _fullName;
  bool get isLoading => _isLoading;

  bool get isOperator => _userRole == 'operator' || _userRole == null;
  bool get isInspector => _userRole == 'quality_engineer' || _userRole == 'inspector';
  bool get isSupervisor => _userRole == 'supervisor' || _userRole == 'admin';

  String? _lastErrorMessage;
  String? get lastErrorMessage => _lastErrorMessage;

  AuthProvider() {
    checkLoginStatus();
  }

  Future<void> checkLoginStatus() async {
    final token = await ApiService.getToken();
    final prefs = await SharedPreferences.getInstance();
    if (token != null) {
      _isAuthenticated = true;
      _username = prefs.getString('username') ?? 'Operator';
      final userInfoStr = prefs.getString('user_info');
      if (userInfoStr != null) {
        try {
          final info = jsonDecode(userInfoStr);
          _userRole = info['role'] ?? 'operator';
          _fullName = (info['full_name'] != null && info['full_name'].toString().isNotEmpty)
              ? info['full_name']
              : _username;
        } catch (_) {
          _userRole = 'operator';
        }
      } else {
        _userRole = 'operator';
      }
    } else {
      _isAuthenticated = false;
      _userRole = null;
    }
    notifyListeners();
  }

  Future<bool> login(String username, String password) async {
    _isLoading = true;
    _lastErrorMessage = null;
    notifyListeners();

    try {
      final result = await ApiService.login(username, password);

      _isLoading = false;
      if (result['success'] == true) {
        _isAuthenticated = true;
        _username = username;
        final prefs = await SharedPreferences.getInstance();
        await prefs.setString('username', username);

        final userData = result['data']?['user'];
        if (userData != null) {
          _userRole = userData['role'] ?? 'operator';
          _fullName = (userData['full_name'] != null && userData['full_name'].toString().isNotEmpty)
              ? userData['full_name']
              : username;
        } else {
          _userRole = 'operator';
        }
        notifyListeners();
        return true;
      } else {
        _lastErrorMessage = result['message'] ?? 'Invalid username or password';
        notifyListeners();
        return false;
      }
    } catch (e) {
      _isLoading = false;
      _lastErrorMessage = e.toString();
      notifyListeners();
      return false;
    }
  }

  Future<void> logout() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.clear();
    _isAuthenticated = false;
    _username = null;
    _userRole = null;
    _fullName = null;
    notifyListeners();
  }
}

