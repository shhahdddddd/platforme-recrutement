import 'package:flutter_secure_storage/flutter_secure_storage.dart';

abstract class AuthLocalDataSource {
  Future<void> cacheToken(String token);
  Future<void> cacheRefreshToken(String refreshToken);
  Future<String?> getLastToken();
  Future<String?> getRefreshToken();
  Future<void> clearToken();
}

class AuthLocalDataSourceImpl implements AuthLocalDataSource {
  final FlutterSecureStorage secureStorage;
  String? _cachedToken;
  String? _cachedRefreshToken;

  AuthLocalDataSourceImpl({required this.secureStorage});

  static const cachedTokenKey = 'CACHED_AUTH_TOKEN';
  static const cachedRefreshTokenKey = 'CACHED_REFRESH_TOKEN';
  // Legacy key used in older builds.
  static const legacyTokenKey = 'auth_token';

  @override
  Future<void> cacheToken(String token) async {
    _cachedToken = token;
    try {
      await secureStorage.write(key: cachedTokenKey, value: token);
    } catch (_) {}
    // Best-effort legacy write for older consumers.
    try {
      await secureStorage.write(key: legacyTokenKey, value: token);
    } catch (_) {}
  }

  @override
  Future<void> cacheRefreshToken(String refreshToken) async {
    _cachedRefreshToken = refreshToken;
    try {
      await secureStorage.write(key: cachedRefreshTokenKey, value: refreshToken);
    } catch (_) {}
  }

  @override
  Future<String?> getLastToken() async {
    if (_cachedToken != null && _cachedToken!.isNotEmpty) {
      return _cachedToken;
    }

    String? token;
    try {
      token = await secureStorage.read(key: cachedTokenKey);
    } catch (_) {}

    if (token == null || token.isEmpty) {
      try {
        token = await secureStorage.read(key: legacyTokenKey);
      } catch (_) {}
    }

    if (token != null && token.isNotEmpty) {
      _cachedToken = token;
    }

    return token;
  }

  @override
  Future<String?> getRefreshToken() async {
    if (_cachedRefreshToken != null && _cachedRefreshToken!.isNotEmpty) {
      return _cachedRefreshToken;
    }

    String? token;
    try {
      token = await secureStorage.read(key: cachedRefreshTokenKey);
    } catch (_) {}

    if (token != null && token.isNotEmpty) {
      _cachedRefreshToken = token;
    }

    return token;
  }

  @override
  Future<void> clearToken() async {
    _cachedToken = null;
    _cachedRefreshToken = null;
    try {
      await Future.wait([
        secureStorage.delete(key: cachedTokenKey),
        secureStorage.delete(key: cachedRefreshTokenKey),
        secureStorage.delete(key: legacyTokenKey),
      ]);
    } catch (_) {}
  }
}
