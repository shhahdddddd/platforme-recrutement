import 'package:flutter/material.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

class LocaleController {
  LocaleController._();

  static final LocaleController instance = LocaleController._();
  static const String _localeKey = 'app_locale';

  final FlutterSecureStorage _storage = const FlutterSecureStorage();
  final ValueNotifier<Locale?> localeNotifier = ValueNotifier<Locale?>(null);

  Locale? get currentLocale => localeNotifier.value;

  Future<void> loadSavedLocale() async {
    final code = await _storage.read(key: _localeKey);
    if (code == null || code.isEmpty) return;
    localeNotifier.value = Locale(code);
  }

  Future<void> setLocale(String languageCode) async {
    final locale = Locale(languageCode);
    localeNotifier.value = locale;
    await _storage.write(key: _localeKey, value: languageCode);
  }
}
