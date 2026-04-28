import 'package:dio/dio.dart';
import '../../features/auth/data/datasources/auth_local_data_source.dart';
import '../../features/auth/data/datasources/auth_remote_data_source.dart';

class AuthInterceptor extends Interceptor {
  final AuthLocalDataSource localDataSource;
  final AuthDataSource remoteDataSource;
  final Dio dio;

  AuthInterceptor({
    required this.localDataSource,
    required this.remoteDataSource,
    required this.dio,
  });

  bool _isAuthEndpoint(String path) {
    final normalizedPath = path.toLowerCase();
    return normalizedPath.contains('/auth/login') ||
        normalizedPath.contains('/auth/register') ||
        normalizedPath.contains('/auth/refresh') ||
        normalizedPath.contains('/auth/send-otp') ||
        normalizedPath.contains('/auth/verify-otp') ||
        normalizedPath.contains('/auth/reset-password');
  }

  @override
  void onRequest(RequestOptions options, RequestInterceptorHandler handler) async {
    // Add token to all requests automatically
    final token = await localDataSource.getLastToken();
    if (token != null && !options.path.contains('/login') && !options.path.contains('/register')) {
      options.headers['Authorization'] = 'Bearer $token';
    }
    handler.next(options);
  }

  @override
  void onError(DioException err, ErrorInterceptorHandler handler) async {
    final path = err.requestOptions.path;
    final isRetry = err.requestOptions.extra['__retried_with_refresh'] == true;
    final hasAuthHeader = err.requestOptions.headers['Authorization'] != null;
    final shouldTryRefresh = err.response?.statusCode == 401 &&
        !_isAuthEndpoint(path) &&
        hasAuthHeader &&
        !isRetry;

    if (shouldTryRefresh) {
      // Token expired, try to refresh
      try {
        final refreshToken = await localDataSource.getRefreshToken();
        if (refreshToken != null) {
          // Attempt to refresh the token
          final newToken = await remoteDataSource.refreshToken(refreshToken);
          await localDataSource.cacheToken(newToken);

          // Retry the original request with new token
          final opts = err.requestOptions;
          opts.headers['Authorization'] = 'Bearer $newToken';
          opts.extra['__retried_with_refresh'] = true;

          final response = await dio.fetch(opts);
          return handler.resolve(response);
        }
      } catch (e) {
        // Refresh failed, clear token and let the error propagate
        await localDataSource.clearToken();
        return handler.next(err);
      }
    }
    handler.next(err);
  }
}
