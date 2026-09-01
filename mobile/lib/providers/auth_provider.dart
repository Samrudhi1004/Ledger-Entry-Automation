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
  String? _firstName;
  String? _lastName;
  String? _email;
  String? _phone;
  String? _employeeId;
  String? _plantName;
  String? _profilePhotoUrl;
  bool _isLoading = true;

  bool get isAuthenticated => _isAuthenticated;
  String? get username => _username;
  String? get userId => _username;
  String? get userRole => _userRole;
  String? get fullName => _fullName;
  String? get firstName => _firstName;
  String? get lastName => _lastName;
  String? get email => _email;
  String? get phone => _phone;
  String? get employeeId => _employeeId;
  String? get plantName => _plantName;
  String? get profilePhotoUrl => _profilePhotoUrl;
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
  /// Reads stored access/refresh tokens and restores local session immediately.
  /// Silently attempts a background token refresh to keep session warm.
  /// ONLY forces logout if the backend explicitly rejects the refresh token (HTTP 400/401).
  Future<void> checkLoginStatus() async {
    _isLoading = true;
    notifyListeners();

    try {
      final token = await ApiService.getToken();
      final refreshToken = await ApiService.getRefreshToken();
      final prefs = await SharedPreferences.getInstance();

      if ((token != null && token.isNotEmpty) || (refreshToken != null && refreshToken.isNotEmpty)) {
        // Restore local user session immediately so app opens home screen instantly
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
        _isAuthenticated = true;
        debugPrint('[AuthProvider] Restored local session for $_username (role: $_userRole)');

        // Silently attempt background refresh to get fresh access token & rotate refresh token
        final refreshStatus = await ApiService.refreshToken();
        if (refreshStatus == false) {
          // Explicitly rejected by server (expired/blacklisted/revoked) -> force logout
          debugPrint('[AuthProvider] Refresh token explicitly rejected by server. Requiring login.');
          await ApiService.clearTokens();
          _isAuthenticated = false;
          _username = null;
          _userRole = null;
          _fullName = null;
        } else if (refreshStatus == true) {
          // Refresh succeeded — re-decode the new JWT to re-persist user_info.
          // Protects against OS wiping SharedPreferences while SecureStorage survives.
          try {
            final newToken = await ApiService.getToken();
            if (newToken != null) {
              final parts = newToken.split('.');
              if (parts.length == 3) {
                final paddedPayload = base64Url.normalize(parts[1]);
                final payloadBytes = base64Url.decode(paddedPayload);
                final payload = jsonDecode(utf8.decode(payloadBytes)) as Map<String, dynamic>;
                final roleFromJwt = payload['role']?.toString() ?? _userRole ?? 'operator';
                _userRole = roleFromJwt;
                final prefs = await SharedPreferences.getInstance();
                await prefs.setString('user_info', jsonEncode({
                  'role': roleFromJwt,
                  'full_name': _fullName ?? _username,
                }));
                debugPrint('[AuthProvider] Re-persisted user_info from JWT (role: $roleFromJwt).');
              }
            }
          } catch (e) {
            debugPrint('[AuthProvider] JWT payload decode warning: $e');
          }
        }
        // Fetch latest profile details from backend
        await refreshProfile();
        // If refreshStatus == null -> network timeout/error, local session STAYS LOGGED IN!
      } else {
        _isAuthenticated = false;
        _username = null;
        _userRole = null;
        _fullName = null;
      }
    } catch (e) {
      debugPrint('[AuthProvider] checkLoginStatus error: $e');
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  /// Re-fetch current user profile details from backend and update local provider state
  Future<void> refreshProfile() async {
    try {
      final profile = await ApiService.getProfile();
      if (profile != null) {
        _username = profile['username'] ?? _username;
        _firstName = profile['first_name'] ?? '';
        _lastName = profile['last_name'] ?? '';
        _email = profile['email'] ?? '';
        _phone = profile['phone'] ?? '';
        _employeeId = profile['employee_id'] ?? '';
        _plantName = profile['plant_name'] ?? '';
        _profilePhotoUrl = profile['profile_photo_url'];
        _userRole = profile['role'] ?? _userRole;

        final first = _firstName ?? '';
        final last = _lastName ?? '';
        final full = '$first $last'.trim();
        _fullName = full.isNotEmpty ? full : _username;

        notifyListeners();
      }
    } catch (e) {
      debugPrint('[AuthProvider] refreshProfile error: $e');
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
  /// Updates UI state synchronously first so navigation happens immediately,
  /// then clears tokens in the background (fire-and-forget is safe here).
  void forceLogout() {
    // Update auth state and notify listeners immediately so the UI
    // (router/splash) can react without waiting for the async token clear.
    _isAuthenticated = false;
    _username = null;
    _userRole = null;
    _fullName = null;
    _isLoading = false;
    notifyListeners();
    // Clear tokens in background — non-critical if it's slightly delayed.
    ApiService.clearTokens();
  }
}
