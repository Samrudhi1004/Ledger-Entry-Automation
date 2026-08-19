import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../services/api_service.dart';

/// AuthProvider — manages user authentication state, silent token refresh,
/// persistent login, and server-side token blacklisting on logout.
class AuthProvider with ChangeNotifier {
  bool _isAuthenticated = false;
  String? _username;
  String? _userRole;
  String? _fullName;
  bool _isLoading = true;

  bool get isAuthenticated => _isAuthenticated;
  String? get username => _username;
  String? get userId => _username;
  String? get userRole => _userRole;
  String? get fullName => _fullName;
  bool get isLoading => _isLoading;

  bool get isOperator => _userRole == 'operator' || _userRole == null;
  bool get isInspector => _userRole == 'quality_engineer' || _userRole == 'inspector';
  bool get isSupervisor => _userRole == 'supervisor' || _userRole == 'admin';

  String? _lastErrorMessage;
  String? get lastErrorMessage => _lastErrorMessage;

  AuthProvider() {
    // Hook up ApiService 401 failure callback to trigger automatic logout
    ApiService.onUnauthenticated = forceLogout;
    checkLoginStatus();
  }

  /// Bootstrap auth state on app start:
  /// Reads stored refresh token and silently mints a new access token.
  /// If refresh succeeds → session extended, stays logged in.
  /// If refresh fails → forces login screen.
  Future<void> checkLoginStatus() async {
    _isLoading = true;
    notifyListeners();

    try {
      final refreshToken = await ApiService.getRefreshToken();
      if (refreshToken != null && refreshToken.isNotEmpty) {
        // Attempt silent token refresh to extend session & get valid access token
        final refreshed = await ApiService.refreshToken();
        if (refreshed) {
          _isAuthenticated = true;
          final prefs = await SharedPreferences.getInstance();
          _username = prefs.getString('username') ?? 'User';

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
          debugPrint('[AuthProvider] Persistent session restored for $_username (role: $_userRole)');
        } else {
          debugPrint('[AuthProvider] Refresh token expired or revoked. Requiring login.');
          await ApiService.clearTokens();
          _isAuthenticated = false;
          _username = null;
          _userRole = null;
          _fullName = null;
        }
      } else {
        _isAuthenticated = false;
        _username = null;
        _userRole = null;
        _fullName = null;
      }
    } catch (e) {
      debugPrint('[AuthProvider] checkLoginStatus error: $e');
      _isAuthenticated = false;
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  /// User explicit login with username & password.
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

  /// Explicit user logout: calls backend to blacklist refresh token,
  /// deletes secure storage keys, clears local auth state.
  Future<void> logout() async {
    _isLoading = true;
    notifyListeners();

    await ApiService.logout();

    _isAuthenticated = false;
    _username = null;
    _userRole = null;
    _fullName = null;
    _isLoading = false;
    notifyListeners();
  }

  /// Triggered automatically when an unauthenticated 401 cannot be refreshed.
  void forceLogout() async {
    await ApiService.clearTokens();
    _isAuthenticated = false;
    _username = null;
    _userRole = null;
    _fullName = null;
    _isLoading = false;
    notifyListeners();
  }
}
