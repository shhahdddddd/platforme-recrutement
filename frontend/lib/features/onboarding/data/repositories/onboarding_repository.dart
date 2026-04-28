import 'package:shared_preferences/shared_preferences.dart';

abstract class OnboardingRepository {
  Future<bool> hasSeenOnboarding();
  Future<void> setOnboardingComplete();
  Future<void> resetOnboarding();
}

class OnboardingRepositoryImpl implements OnboardingRepository {
  static const String _keyHasSeenOnboarding = 'has_seen_onboarding';

  @override
  Future<bool> hasSeenOnboarding() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getBool(_keyHasSeenOnboarding) ?? false;
  }

  @override
  Future<void> setOnboardingComplete() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool(_keyHasSeenOnboarding, true);
  }

  @override
  Future<void> resetOnboarding() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool(_keyHasSeenOnboarding, false);
  }
}
