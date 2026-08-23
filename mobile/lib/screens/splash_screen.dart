import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../providers/auth_provider.dart';
import '../providers/inspection_provider.dart';
import '../services/persistence_service.dart';
import 'login_screen.dart';
import 'app_home_screen.dart';
import 'supervisor_info_screen.dart';
import 'operator_home_screen.dart';
import 'inspection_voice_screen.dart';
import 'summary_screen.dart';

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
    // Wait up to 30 seconds for it to complete (increased from 10s to handle
    // cold-start backend delays without falsely forcing re-login).
    int retries = 0;
    while (auth.isLoading && retries < 300) {
      await Future.delayed(const Duration(milliseconds: 100));
      retries++;
    }

    if (!mounted) return;

    if (auth.isAuthenticated) {
      Widget home = const AppHomeScreen();

      // Restore saved inspection state for both operators AND inspectors.
      // Supervisors are excluded — they don't use the inspection flow.
      if ((auth.isOperator || auth.isInspector) && auth.userId != null) {
        final provider = Provider.of<InspectionProvider>(context, listen: false);
        provider.currentUserId = auth.userId!; // Set so future saves work

        final summary = await PersistenceService.getSavedStateSummary(auth.userId!);
        if (summary != null && mounted) {
          // Ask the user if they want to resume or start fresh.
          final shouldResume = await _showResumeDialog(summary);
          if (shouldResume == true) {
            final savedState = await PersistenceService.loadState(auth.userId!);
            if (savedState != null) {
              provider.restoreFromLocalState(savedState, auth.userId!);
              
              if (provider.sessionId != null && provider.parameters.isNotEmpty) {
                if (provider.recordedResults.length >= provider.parameters.length) {
                  home = const SummaryScreen();
                } else {
                  home = const InspectionVoiceScreen();
                }
              } else {
                if (auth.isOperator) home = const OperatorHomeScreen();
              }
            }
          } else {
            // User chose "Start Fresh" — discard the stale session
            await PersistenceService.clearState();
          }
        }
      }

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

  /// Shows a dialog summarising the saved inspection session and asks the user
  /// whether to resume it or discard it and start fresh.
  /// Returns `true` to resume, `false`/`null` to discard.
  Future<bool?> _showResumeDialog(Map<String, String> summary) {
    return showDialog<bool>(
      context: context,
      barrierDismissible: false,
      builder: (ctx) => AlertDialog(
        backgroundColor: const Color(0xFF0D1424),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(16),
          side: const BorderSide(color: Color(0xFF2563EB), width: 1.5),
        ),
        title: const Row(
          children: [
            Icon(Icons.restore_rounded, color: Color(0xFF2563EB), size: 28),
            SizedBox(width: 10),
            Text(
              'Resume Session?',
              style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 18),
            ),
          ],
        ),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'You have an unfinished inspection session:',
              style: TextStyle(color: Color(0xFF94A3B8), fontSize: 13),
            ),
            const SizedBox(height: 14),
            _resumeInfoRow(Icons.precision_manufacturing_rounded, 'Machine', summary['machine'] ?? '—'),
            const SizedBox(height: 8),
            _resumeInfoRow(Icons.category_rounded, 'Part', summary['part'] ?? '—'),
            const SizedBox(height: 8),
            _resumeInfoRow(Icons.assignment_rounded, 'Inspection', summary['inspection'] ?? '—'),
            const SizedBox(height: 8),
            _resumeInfoRow(Icons.bar_chart_rounded, 'Progress', summary['progress'] ?? '—'),
            const SizedBox(height: 8),
            _resumeInfoRow(Icons.access_time_rounded, 'Saved', summary['saved_at'] ?? 'Recently'),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            style: TextButton.styleFrom(foregroundColor: const Color(0xFFEF4444)),
            child: const Text('START FRESH', style: TextStyle(fontWeight: FontWeight.bold)),
          ),
          ElevatedButton.icon(
            onPressed: () => Navigator.pop(ctx, true),
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFF2563EB),
              foregroundColor: Colors.white,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
            ),
            icon: const Icon(Icons.play_arrow_rounded, size: 18),
            label: const Text('RESUME', style: TextStyle(fontWeight: FontWeight.bold)),
          ),
        ],
      ),
    );
  }

  Widget _resumeInfoRow(IconData icon, String label, String value) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Icon(icon, color: const Color(0xFF38BDF8), size: 16),
        const SizedBox(width: 8),
        Text('$label: ', style: const TextStyle(color: Color(0xFF64748B), fontSize: 12)),
        Expanded(
          child: Text(
            value,
            style: const TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.w600),
            overflow: TextOverflow.ellipsis,
          ),
        ),
      ],
    );
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
