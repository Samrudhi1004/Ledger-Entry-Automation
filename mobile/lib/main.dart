import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:google_fonts/google_fonts.dart';

import 'providers/auth_provider.dart';
import 'providers/inspection_provider.dart';
import 'providers/task_provider.dart';
import 'providers/company_provider.dart';
import 'providers/messaging_provider.dart';
import 'providers/notification_provider.dart';
import 'screens/splash_screen.dart';
import 'screens/messaging/messages_screen.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(const VoiceInspectionApp());
}

class VoiceInspectionApp extends StatefulWidget {
  const VoiceInspectionApp({super.key});

  @override
  State<VoiceInspectionApp> createState() => _VoiceInspectionAppState();
}

class _VoiceInspectionAppState extends State<VoiceInspectionApp>
    with WidgetsBindingObserver {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  /// Re-fetch company logo & details every time app returns to foreground.
  /// This ensures in-app logo stays in sync with admin uploads automatically.
  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      final companyProvider =
          context.read<CompanyProvider>();
      companyProvider.fetchCompanyDetails();
    }
  }

  @override
  Widget build(BuildContext context) {
    return MultiProvider(
      providers: [
        ChangeNotifierProvider(create: (_) => AuthProvider()),
        ChangeNotifierProvider(create: (_) => InspectionProvider()),
        ChangeNotifierProvider(create: (_) => TaskProvider()),
        ChangeNotifierProvider(create: (_) => CompanyProvider()),
        ChangeNotifierProvider(create: (_) => MessagingProvider()),
        ChangeNotifierProxyProvider<AuthProvider, NotificationProvider>(
          create: (_) => NotificationProvider(),
          update: (_, auth, notifications) {
            final provider = notifications ?? NotificationProvider();
            if (auth.isAuthenticated) {
              provider.initializeForUser(userId: auth.userId);
            } else if (!auth.isLoading) {
              provider.resetForLogout();
            }
            return provider;
          },
        ),
      ],
      child: MaterialApp(
        title: 'Inspection Hub',
        debugShowCheckedModeBanner: false,
        theme: ThemeData(
          brightness: Brightness.light,
          scaffoldBackgroundColor: Colors.grey[50],
          primaryColor: Colors.blueAccent,
          colorScheme: ColorScheme.fromSeed(
            seedColor: Colors.blueAccent,
            brightness: Brightness.light,
            surface: Colors.white,
          ),
          textTheme: GoogleFonts.interTextTheme(ThemeData.light().textTheme),
          useMaterial3: true,
        ),
        routes: {
          '/messages': (context) => MessagesScreen(
            initialConversationId:
                ModalRoute.of(context)?.settings.arguments as String?,
          ),
        },
        home: const SplashScreen(),
      ),
    );
  }
}
