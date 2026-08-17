import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../providers/auth_provider.dart';
import '../providers/inspection_provider.dart';
import '../services/persistence_service.dart';
import 'login_screen.dart';
import 'app_home_screen.dart';
import 'supervisor_info_screen.dart';

/// SplashScreen — shown at app startup.
///
/// Responsibilities (in order):
///   1. Show MMPL branding briefly while checking auth.
///   2. Try to validate existing JWT token (attempt silent refresh if needed).
///   3. If valid → route to correct home screen (Operator / Inspector / Supervisor).
///   4. If invalid → route to LoginScreen.
///
/// This screen does NOT change any business logic. It only reads the auth
/// state that AuthProvider.checkLoginStatus() already manages.
class SplashScreen extends StatefulWidget {
  const SplashScreen({super.key});

  @override
  State<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends State<SplashScreen>
    with SingleTickerProviderStateMixin {
  late AnimationController _pulseCtrl;
  late Animation<double>   _pulseAnim;

  @override
  void initState() {
    super.initState();

    _pulseCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 900),
    )..repeat(reverse: true);

    _pulseAnim = Tween<double>(begin: 0.85, end: 1.0).animate(
      CurvedAnimation(parent: _pulseCtrl, curve: Curves.easeInOut),
    );

    // Defer navigation until after first frame so providers are ready.
    WidgetsBinding.instance.addPostFrameCallback((_) => _checkAndRoute());
  }

  @override
  void dispose() {
    _pulseCtrl.dispose();
    super.dispose();
  }

  Future<void> _checkAndRoute() async {
    // Give the splash a minimum display time so it doesn't flash.
    await Future.delayed(const Duration(milliseconds: 1400));

    if (!mounted) return;

    final auth = Provider.of<AuthProvider>(context, listen: false);

    // AuthProvider constructor already called checkLoginStatus().
    // Wait briefly for it to complete if still loading.
    int retries = 0;
    while (auth.isLoading && retries < 20) {
      await Future.delayed(const Duration(milliseconds: 100));
      retries++;
    }

    if (!mounted) return;

    if (auth.isAuthenticated) {
      Widget home = const AppHomeScreen();
      if (auth.isSupervisor) {
        home = const SupervisorInfoScreen();
      }
      if (!mounted) return;
      Navigator.pushReplacement(
        context,
        MaterialPageRoute(builder: (_) => home),
      );
    } else {
      if (!mounted) return;
      Navigator.pushReplacement(
        context,
        MaterialPageRoute(builder: (_) => const LoginScreen()),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF080C18),
      body: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            // Animated MMPL Logo
            ScaleTransition(
              scale: _pulseAnim,
              child: Container(
                width: 110,
                height: 110,
                decoration: BoxDecoration(
                  color: const Color(0xFF0D1424),
                  shape: BoxShape.circle,
                  border: Border.all(color: const Color(0xFF2563EB), width: 2),
                  boxShadow: [
                    BoxShadow(
                      color: const Color(0xFF2563EB).withValues(alpha: 0.35),
                      blurRadius: 30,
                      spreadRadius: 6,
                    ),
                  ],
                ),
                child: const Icon(
                  Icons.mic_external_on_rounded,
                  size: 56,
                  color: Color(0xFF2563EB),
                ),
              ),
            ),
            const SizedBox(height: 28),
            const Text(
              'MMPL',
              style: TextStyle(
                color: Colors.white,
                fontSize: 28,
                fontWeight: FontWeight.w900,
                letterSpacing: 6,
              ),
            ),
            const SizedBox(height: 6),
            const Text(
              'Voice Inspection System',
              style: TextStyle(
                color: Color(0xFF64748B),
                fontSize: 14,
                letterSpacing: 1.2,
              ),
            ),
            const SizedBox(height: 48),
            // Loading indicator
            SizedBox(
              width: 28,
              height: 28,
              child: CircularProgressIndicator(
                strokeWidth: 2.5,
                color: const Color(0xFF2563EB).withValues(alpha: 0.7),
              ),
            ),
            const SizedBox(height: 16),
            const Text(
              'Checking session…',
              style: TextStyle(
                color: Color(0xFF475569),
                fontSize: 12,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
