import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../providers/auth_provider.dart';
import '../providers/inspection_provider.dart';
import '../services/persistence_service.dart';
import 'app_home_screen.dart';
import 'inspector_home_screen.dart';
import 'supervisor_info_screen.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _usernameController = TextEditingController(text: 'operator');
  final _passwordController = TextEditingController(text: 'operator123');
  bool _obscurePassword = true;

  @override
  Widget build(BuildContext context) {
    final auth = Provider.of<AuthProvider>(context);

    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(24.0),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                // Header Logo / Icon
                Container(
                  padding: const EdgeInsets.all(20),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    shape: BoxShape.circle,
                    boxShadow: [
                      BoxShadow(
                        color: Colors.blue.withValues(alpha: 0.15),
                        blurRadius: 20,
                        spreadRadius: 5,
                      )
                    ],
                  ),
                  child: const Icon(
                    Icons.mic_external_on_rounded,
                    size: 64,
                    color: Color(0xFF2563EB),
                  ),
                ),
                const SizedBox(height: 24),
                const Text(
                  'VOICE INSPECTION',
                  style: TextStyle(
                    color: Color(0xFF0F172A),
                    fontSize: 26,
                    fontWeight: FontWeight.bold,
                    letterSpacing: 1.5,
                  ),
                ),
                const SizedBox(height: 8),
                const Text(
                  'Mantri Metallics — Shop Floor Console',
                  style: TextStyle(
                    color: Color(0xFF64748B),
                    fontSize: 14,
                  ),
                ),
                const SizedBox(height: 36),

                // Form Container
                Container(
                  padding: const EdgeInsets.all(24),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(color: const Color(0xFFE2E8F0)),
                    boxShadow: [
                      BoxShadow(
                        color: Colors.black.withValues(alpha: 0.05),
                        blurRadius: 15,
                        offset: const Offset(0, 4),
                      ),
                    ],
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      const Text(
                        'Authentication',
                        style: TextStyle(
                          color: Color(0xFF0F172A),
                          fontSize: 18,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                      const SizedBox(height: 20),

                      // Username field
                      TextField(
                        controller: _usernameController,
                        style: const TextStyle(color: Color(0xFF0F172A)),
                        decoration: InputDecoration(
                          labelText: 'Employee ID / Username',
                          labelStyle: const TextStyle(color: Color(0xFF64748B)),
                          prefixIcon: const Icon(Icons.person_outline, color: Color(0xFF2563EB)),
                          filled: true,
                          fillColor: const Color(0xFFF1F5F9),
                          border: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(10),
                            borderSide: BorderSide.none,
                          ),
                        ),
                      ),
                      const SizedBox(height: 16),

                      // Password field
                      TextField(
                        controller: _passwordController,
                        obscureText: _obscurePassword,
                        style: const TextStyle(color: Color(0xFF0F172A)),
                        decoration: InputDecoration(
                          labelText: 'Password',
                          labelStyle: const TextStyle(color: Color(0xFF64748B)),
                          prefixIcon: const Icon(Icons.lock_outline, color: Color(0xFF2563EB)),
                          suffixIcon: IconButton(
                            icon: Icon(
                              _obscurePassword ? Icons.visibility_off : Icons.visibility,
                              color: const Color(0xFF64748B),
                            ),
                            onPressed: () {
                              setState(() {
                                _obscurePassword = !_obscurePassword;
                              });
                            },
                          ),
                          filled: true,
                          fillColor: const Color(0xFFF1F5F9),
                          border: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(10),
                            borderSide: BorderSide.none,
                          ),
                        ),
                      ),
                      const SizedBox(height: 24),

                      // Login Button
                      ElevatedButton(
                        onPressed: auth.isLoading
                            ? null
                            : () async {
                                final username = _usernameController.text.trim();
                                final password = _passwordController.text.trim();

                                if (username.isEmpty || password.isEmpty) {
                                  ScaffoldMessenger.of(context).showSnackBar(
                                    const SnackBar(content: Text('Please enter username and password')),
                                  );
                                  return;
                                }

                                final success = await auth.login(username, password);

                                if (context.mounted) {
                                  if (success) {
                                    Widget targetScreen = const AppHomeScreen();
                                    final role = (auth.userRole ?? '').toLowerCase();

                                    if (role == 'inspector' || role == 'quality_engineer') {
                                      targetScreen = const InspectorHomeScreen();
                                    } else if (role == 'supervisor' || role == 'admin') {
                                      targetScreen = const SupervisorInfoScreen();
                                    } else {
                                      // Operator role - check for saved state summary to resume
                                      if (auth.userId != null) {
                                        final provider = Provider.of<InspectionProvider>(context, listen: false);
                                        provider.currentUserId = auth.userId!;

                                        final summary = await PersistenceService.getSavedStateSummary(auth.userId!);
                                        if (summary != null && context.mounted) {
                                          final shouldResume = await showDialog<bool>(
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
                                                  _resumeRow(Icons.precision_manufacturing_rounded, 'Machine', summary['machine'] ?? '—'),
                                                  const SizedBox(height: 8),
                                                  _resumeRow(Icons.category_rounded, 'Part', summary['part'] ?? '—'),
                                                  const SizedBox(height: 8),
                                                  _resumeRow(Icons.assignment_rounded, 'Inspection', summary['inspection'] ?? '—'),
                                                  const SizedBox(height: 8),
                                                  _resumeRow(Icons.bar_chart_rounded, 'Progress', summary['progress'] ?? '—'),
                                                  const SizedBox(height: 8),
                                                  _resumeRow(Icons.access_time_rounded, 'Saved', summary['saved_at'] ?? 'Recently'),
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
                                          if (shouldResume == true) {
                                            final savedState = await PersistenceService.loadState(auth.userId!);
                                            if (savedState != null) {
                                              provider.restoreFromLocalState(savedState, auth.userId!);
                                            }
                                          } else {
                                            await PersistenceService.clearState();
                                          }
                                        } else {
                                          final hasSaved = await PersistenceService.hasSavedState(auth.userId!);
                                          if (hasSaved) {
                                            final savedState = await PersistenceService.loadState(auth.userId!);
                                            if (savedState != null) {
                                              provider.restoreFromLocalState(savedState, auth.userId!);
                                            }
                                          }
                                        }
                                      }
                                      targetScreen = const AppHomeScreen();
                                    }

                                    Navigator.pushReplacement(
                                      context,
                                      MaterialPageRoute(builder: (_) => targetScreen),
                                    );
                                  } else {
                                    ScaffoldMessenger.of(context).showSnackBar(
                                      SnackBar(
                                        content: Text(auth.lastErrorMessage ?? 'Login failed. Please check credentials.'),
                                        backgroundColor: Colors.redAccent,
                                      ),
                                    );
                                  }
                                }
                              },
                        style: ElevatedButton.styleFrom(
                          backgroundColor: const Color(0xFF2563EB),
                          foregroundColor: Colors.white,
                          padding: const EdgeInsets.symmetric(vertical: 16),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(10),
                          ),
                        ),
                        child: auth.isLoading
                            ? const SizedBox(
                                width: 24,
                                height: 24,
                                child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2),
                              )
                            : const Text(
                                'LOGIN TO CONSOLE',
                                style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
                              ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 24),
                const Text(
                  'v1.0.0 — MMPL Real-Time Quality Systems',
                  style: TextStyle(color: Color(0xFF94A3B8), fontSize: 12),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _resumeRow(IconData icon, String label, String value) {
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
}
