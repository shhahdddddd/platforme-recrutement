import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:recrutitn/l10n/app_localizations.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'firebase_options.dart';
import 'features/auth/presentation/bloc/auth_bloc.dart';
import 'features/auth/presentation/bloc/auth_event.dart';
import 'features/auth/presentation/bloc/auth_state.dart';
import 'features/auth/presentation/pages/entry_page.dart';
import 'features/home/presentation/pages/home_page.dart';
import 'features/onboarding/presentation/pages/onboarding_screen.dart';
import 'features/home/presentation/bloc/saved_jobs_bloc.dart';
import 'features/home/presentation/bloc/saved_jobs_event.dart';
import 'features/home/presentation/bloc/job_application_bloc.dart';
import 'injection_container.dart' as di;
import 'core/theme/app_theme.dart';
import 'core/services/notification_service.dart';
import 'core/localization/locale_controller.dart';

void configureWebSecurity() {
  if (kIsWeb) {
    // Browser TLS is enforced by the platform.
  }
}

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  if (kIsWeb) {
    configureWebSecurity();
  }

  // Initialize Firebase (for mobile and web)
  try {
    if (kIsWeb || defaultTargetPlatform == TargetPlatform.android) {
      await Firebase.initializeApp(options: getCurrentPlatformOptions);
    } else {
      await Firebase.initializeApp();
    }
  } catch (e) {
    debugPrint("Firebase initialization skipped/failed: $e");
  }

  FirebaseMessaging.onBackgroundMessage(
    firebaseMessagingBackgroundHandler,
  );

  await di.init();
  await LocaleController.instance.loadSavedLocale();

  // During development, always show onboarding on fresh app launch.
  if (kDebugMode) {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool('has_seen_onboarding', false);
  }

  runApp(const MyApp());

  // Initialize notifications in background so first app launch is not blocked.
  unawaited(
    Future(() async {
      try {
        await di.sl<NotificationService>().initialize();
      } catch (e) {
        debugPrint("Notification init skipped/failed: $e");
      }
    }),
  );
}

class MyApp extends StatefulWidget {
  const MyApp({super.key});

  @override
  State<MyApp> createState() => _MyAppState();
}

class _MyAppState extends State<MyApp> {
  @override
  Widget build(BuildContext context) {
    return MultiBlocProvider(
      providers: [
        BlocProvider(
          create: (_) => di.sl<AuthBloc>()..add(CheckAuthStatusEvent()),
        ),
        BlocProvider(create: (_) => di.sl<SavedJobsBloc>()),
        BlocProvider(create: (_) => di.sl<JobApplicationBloc>()),
      ],
      child: ValueListenableBuilder<Locale?>(
        valueListenable: LocaleController.instance.localeNotifier,
        builder: (context, locale, _) {
          return MaterialApp(
            title: 'Recruitment App',
            locale: locale ?? const Locale('en'),
            localizationsDelegates: AppLocalizations.localizationsDelegates,
            supportedLocales: AppLocalizations.supportedLocales,
            debugShowCheckedModeBanner: false,
            theme: AppTheme.lightTheme,
            home: const AppEntryPoint(),
            routes: {
              '/entry': (context) => const AppEntryPoint(),
            },
          );
        },
      ),
    );
  }
}

/// Main entry point that handles onboarding and auth flow
class AppEntryPoint extends StatefulWidget {
  const AppEntryPoint({super.key});

  @override
  State<AppEntryPoint> createState() => _AppEntryPointState();
}

class _AppEntryPointState extends State<AppEntryPoint> {
  bool _isLoading = true;
  bool _hasSeenOnboarding = false;

  @override
  void initState() {
    super.initState();
    _checkOnboardingStatus();
  }

  Future<void> _checkOnboardingStatus() async {
    final prefs = await SharedPreferences.getInstance();
    setState(() {
      _hasSeenOnboarding = prefs.getBool('has_seen_onboarding') ?? false;
      _isLoading = false;
    });
  }

  @override
  Widget build(BuildContext context) {
    if (_isLoading) {
      return Scaffold(
        backgroundColor: Colors.white,
        body: Center(
          child: CircularProgressIndicator(
            color: AppTheme.primaryColor,
          ),
        ),
      );
    }

    // If user hasn't seen onboarding, show onboarding directly
    if (!_hasSeenOnboarding) {
      return const OnboardingScreen();
    }

    // Otherwise, show auth flow
    return BlocListener<AuthBloc, AuthState>(
      listener: (context, state) {
        if (state is AuthAuthenticated) {
          context.read<SavedJobsBloc>().add(
            LoadSavedJobs(state.user.id),
          );
          unawaited(di.sl<NotificationService>().syncTokenToBackend());
        } else if (state is AuthInitial) {
          context.read<SavedJobsBloc>().add(ClearSavedJobs());
        }
      },
      child: BlocBuilder<AuthBloc, AuthState>(
        builder: (context, state) {
          if (state is AuthCheckingStatus) {
            return Scaffold(
              backgroundColor: Colors.white,
              body: Center(
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    CircularProgressIndicator(
                      color: AppTheme.primaryColor,
                    ),
                    const SizedBox(height: 24),
                    Text(
                      AppLocalizations.of(context)!.loading,
                      style: GoogleFonts.outfit(
                        fontSize: 16,
                        color: Colors.grey.shade600,
                      ),
                    ),
                  ],
                ),
              ),
            );
          }

          if (state is AuthAuthenticated) {
            context.read<SavedJobsBloc>().add(
              LoadSavedJobs(state.user.id),
            );
            return HomePage(user: state.user);
          }

          return const EntryPage();
        },
      ),
    );
  }
}
