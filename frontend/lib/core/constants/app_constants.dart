import 'package:flutter/foundation.dart';

class AppConstants {
  // Optional override for all environments:
  // flutter run --dart-define=API_BASE_URL=http://192.168.1.50:8000/api
  static const String _apiBaseUrlOverride = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: '',
  );

  static String _normalizeBaseUrl(String rawUrl) {
    final trimmed = rawUrl.trim();
    if (trimmed.isEmpty) return trimmed;
    return trimmed.endsWith('/') ? trimmed.substring(0, trimmed.length - 1) : trimmed;
  }

  static String get apiBaseUrl {
    if (_apiBaseUrlOverride.isNotEmpty) {
      return _normalizeBaseUrl(_apiBaseUrlOverride);
    }

    // Local development defaults:
    // - Web/Desktop/iOS simulator: localhost
    // - Android emulator: 10.0.2.2 maps to host machine localhost
    // Override with --dart-define if you need HTTP or a LAN IP.
    if (kIsWeb ||
        defaultTargetPlatform == TargetPlatform.windows ||
        defaultTargetPlatform == TargetPlatform.macOS ||
        defaultTargetPlatform == TargetPlatform.linux ||
        defaultTargetPlatform == TargetPlatform.iOS) {
      return 'https://localhost:8000/api';
    }
    return 'https://10.0.2.2:8000/api';
  }

  static const List<String> tunisiaStates = [
    'Tunis', 'Ariana', 'Ben Arous', 'Manouba', 'Nabeul', 'Zaghouan',
    'Bizerte', 'Béja', 'Jendouba', 'Kef', 'Siliana', 'Kairouan',
    'Kasserine', 'Sidi Bouzid', 'Sousse', 'Monastir', 'Mahdia', 'Sfax',
    'Gafsa', 'Tozeur', 'Kebili', 'Gabès', 'Medenine', 'Tataouine'
  ];

  static const List<String> industries = [
    'Marketing',
    'Software Engineering',
    'Design',
    'Sales',
    'Finance',
    'Human Resources',
    'Education',
    'Healthcare',
    'Construction',
    'Other',
  ];

  static const List<String> specialities = [
    'Software Development',
    'Data Science',
    'Mobile Development',
    'UI/UX Design',
    'Cybersecurity',
    'Cloud Computing',
    'Artificial Intelligence',
    'Networking',
    'Embedded Systems',
    'Mechanical Engineering',
    'Electrical Engineering',
    'Industrial Engineering',
    'Civil Engineering',
    'Other',
  ];
}
