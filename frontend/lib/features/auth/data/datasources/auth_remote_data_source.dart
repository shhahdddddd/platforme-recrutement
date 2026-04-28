import 'package:dio/dio.dart';
import '../models/user_model.dart';
import '../../../../core/constants/app_constants.dart';

/// Contract for remote authentication data source.
abstract class AuthDataSource {
  Future<UserModel> login(String email, String password);
  Future<UserModel> signUp(Map<String, dynamic> data);
  Future<bool> checkEmail(String email);
  Future<void> resetPassword(String email, String newPassword);
  Future<UserModel> getUserProfile(String token);
  Future<String> refreshToken(String token);
  Future<void> updatePassword(String token, String currentPassword, String newPassword);
  Future<void> updateBasicInfo(String token, Map<String, dynamic> data);
  Future<void> sendOtp(String email);
  Future<void> verifyOtp(String email, String otp);
  Future<void> updateFcmToken(String token, String fcmToken, String platform);
}

/// Concrete implementation using Dio to talk to the Laravel backend.
class AuthRemoteDataSource implements AuthDataSource {
  final Dio dio;

  AuthRemoteDataSource({required this.dio});

  String _extractBackendMessage(dynamic responseData) {
    if (responseData is! Map) return '';

    final message = responseData['message'];
    if (message is String && message.trim().isNotEmpty) {
      return message;
    }

    final error = responseData['error'];
    if (error is String && error.trim().isNotEmpty) {
      return error;
    }

    final errors = responseData['errors'];
    if (errors is Map && errors.isNotEmpty) {
      final firstError = errors.values.first;
      if (firstError is List && firstError.isNotEmpty) {
        return firstError.first.toString();
      }
      if (firstError != null) {
        return firstError.toString();
      }
    }

    return '';
  }

  String _resolveDioMessage(DioException e, String fallback) {
    final backendMessage = _extractBackendMessage(e.response?.data);
    if (backendMessage.isNotEmpty) {
      return backendMessage;
    }

    if (e.type == DioExceptionType.connectionTimeout ||
        e.type == DioExceptionType.sendTimeout ||
        e.type == DioExceptionType.receiveTimeout) {
      return 'Connexion au serveur expiree. Verifie que le backend est demarre.';
    }

    final rawError = (e.error?.toString() ?? e.message ?? '').toLowerCase();
    if (rawError.contains('ssl') ||
        rawError.contains('tls') ||
        rawError.contains('certificate') ||
        rawError.contains('handshake')) {
      return 'Erreur SSL. En local, utilise HTTP ou un certificat valide.';
    }
    if (rawError.contains('failed host lookup') ||
        rawError.contains('connection refused') ||
        rawError.contains('network is unreachable')) {
      return 'Impossible de joindre le serveur API. Verifie l URL de base.';
    }
    if (e.type == DioExceptionType.connectionError) {
      return 'Connexion au serveur impossible. Verifie le backend et l URL API.';
    }

    return fallback;
  }

  @override
  Future<void> sendOtp(String email) async {
    try {
      final response = await dio.post(
        '${AppConstants.apiBaseUrl}/auth/send-otp',
        data: {'email': email},
        options: Options(headers: {'Accept': 'application/json'}),
        // OTP sent successfully (no debug output for security)
      );
    } on DioException catch (e) {
      throw Exception(_resolveDioMessage(e, 'Erreur lors de l envoi de l OTP'));
    }
  }

  @override
  Future<void> verifyOtp(String email, String otp) async {
    try {
      final response = await dio.post(
        '${AppConstants.apiBaseUrl}/auth/verify-otp',
        data: {'email': email, 'otp': otp},
        options: Options(headers: {'Accept': 'application/json'}),
      );
      if (response.statusCode != 200) {
        throw Exception(response.data['message'] ?? 'OTP invalide');
      }
    } on DioException catch (e) {
      throw Exception(_resolveDioMessage(e, 'OTP invalide ou expire'));
    }
  }

  @override
  Future<UserModel> login(String email, String password) async {
    try {
      final response = await dio.post(
        '${AppConstants.apiBaseUrl}/auth/login',
        data: {'email': email, 'password': password},
        options: Options(headers: {'Accept': 'application/json'}),
      );

      if (response.statusCode == 200) {
        final data = response.data['data'];
        // Backend returns:
        // data: { user: {...}, access_token: "...", refresh_token: "...", ... }
        // We merge tokens into the user payload so the app can persist them.
        final rawUser = (data is Map) ? (data['user'] ?? data) : data;

        final Map<String, dynamic> userMap =
            rawUser is Map<String, dynamic> ? Map<String, dynamic>.from(rawUser) : <String, dynamic>{};

        // Merge tokens (if present) into the same map that UserModel expects.
        if (data is Map) {
          userMap['access_token'] ??= data['access_token'];
          userMap['refresh_token'] ??= data['refresh_token'];
          userMap['expires_in'] ??= data['expires_in'];
          userMap['token_type'] ??= data['token_type'];
        }

        return UserModel.fromJson(userMap);
      } else {
        throw Exception(response.data['message'] ?? 'Login failed');
      }
    } on DioException catch (e) {
      throw Exception(_resolveDioMessage(e, 'Erreur de connexion'));
    }
  }

  @override
  Future<UserModel> signUp(Map<String, dynamic> data) async {
    try {
      final response = await dio.post(
        '${AppConstants.apiBaseUrl}/auth/register',
        data: data,
        options: Options(
          headers: {'Accept': 'application/json'},
          connectTimeout: const Duration(seconds: 15),
          sendTimeout: const Duration(seconds: 30),
          receiveTimeout: const Duration(seconds: 60),
        ),
      );

      if (response.statusCode == 201 || response.statusCode == 200) {
        return UserModel.fromJson(response.data['data']);
      } else {
        throw Exception(response.data['message'] ?? 'Inscription echouee');
      }
    } on DioException catch (e) {
      throw Exception(_resolveDioMessage(e, 'Donnees invalides ou email deja utilise'));
    }
  }

  @override
  Future<bool> checkEmail(String email) async {
    try {
      final response = await dio.post(
        '${AppConstants.apiBaseUrl}/auth/check-email',
        data: {'email': email},
        options: Options(headers: {'Accept': 'application/json'}),
      );
      return response.data['exists'] ?? false;
    } catch (e) {
      // In case of any error, we assume email is not taken to avoid blocking UX.
      return false;
    }
  }

  @override
  Future<void> resetPassword(String email, String newPassword) async {
    try {
      await dio.post(
        '${AppConstants.apiBaseUrl}/auth/reset-password',
        data: {
          'email': email,
          'password': newPassword,
          'password_confirmation': newPassword,
        },
        options: Options(headers: {'Accept': 'application/json'}),
      );
    } on DioException catch (e) {
      throw Exception(_resolveDioMessage(e, 'Reinitialisation echouee'));
    }
  }

  @override
  Future<UserModel> getUserProfile(String token) async {
    try {
      final response = await dio.get(
        '${AppConstants.apiBaseUrl}/auth/me',
        options: Options(headers: {
          'Accept': 'application/json',
          'Authorization': 'Bearer $token',
        }),
      );

      if (response.statusCode == 200) {
        return UserModel.fromJson(response.data['data']);
      } else {
        throw Exception('Session expired');
      }
    } on DioException catch (e) {
      throw Exception(_resolveDioMessage(e, 'Erreur de session'));
    }
  }

  @override
  Future<String> refreshToken(String token) async {
    try {
      final response = await dio.post(
        '${AppConstants.apiBaseUrl}/auth/refresh',
        data: {'refresh_token': token},
        options: Options(headers: {
          'Accept': 'application/json',
        }),
      );

      if (response.statusCode == 200) {
        return response.data['data']['access_token'];
      } else {
        throw Exception('Token refresh failed');
      }
    } on DioException catch (e) {
      throw Exception(_resolveDioMessage(e, 'Erreur de rafraichissement'));
    }
  }

  @override
  Future<void> updatePassword(String token, String currentPassword, String newPassword) async {
    try {
      final response = await dio.post(
        '${AppConstants.apiBaseUrl}/auth/password/update',
        data: {
          'current_password': currentPassword,
          'new_password': newPassword,
          'new_password_confirmation': newPassword,
        },
        options: Options(headers: {
          'Accept': 'application/json',
          'Authorization': 'Bearer $token',
        }),
      );

      if (response.statusCode != 200) {
        throw Exception(response.data['message'] ?? 'Erreur lors de la mise a jour');
      }
    } on DioException catch (e) {
      throw Exception(_resolveDioMessage(e, 'Echec du changement de mot de passe'));
    }
  }

  @override
  Future<void> updateBasicInfo(String token, Map<String, dynamic> data) async {
    try {
      final response = await dio.post(
        '${AppConstants.apiBaseUrl}/auth/profile/basic',
        data: data,
        options: Options(headers: {
          'Accept': 'application/json',
          'Authorization': 'Bearer $token',
        }),
      );

      if (response.statusCode != 200) {
        throw Exception(response.data['message'] ?? 'Erreur lors de la mise a jour');
      }
    } on DioException catch (e) {
      throw Exception(_resolveDioMessage(e, 'Echec de la mise a jour des informations'));
    }
  }

  @override
  Future<void> updateFcmToken(String token, String fcmToken, String platform) async {
    try {
      await dio.post(
        '${AppConstants.apiBaseUrl}/auth/fcm-token',
        data: {'fcm_token': fcmToken, 'platform': platform},
        options: Options(headers: {
          'Accept': 'application/json',
          'Authorization': 'Bearer $token',
        }),
      );
    } catch (e) {
      // We don't want to throw error if FCM token update fails, just log it
      print('Failed to update FCM token: $e');
    }
  }
}
