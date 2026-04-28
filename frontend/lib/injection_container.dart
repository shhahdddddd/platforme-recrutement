import 'package:get_it/get_it.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:dio/dio.dart';
import 'package:connectivity_plus/connectivity_plus.dart';

import 'features/auth/data/repositories/auth_repository_impl.dart';
import 'features/auth/data/datasources/auth_remote_data_source.dart';
import 'features/auth/data/datasources/auth_local_data_source.dart';
import 'features/auth/domain/repositories/auth_repository.dart';
import 'features/auth/domain/usecases/login_usecase.dart';
import 'features/auth/domain/usecases/signup_usecase.dart';
import 'features/auth/domain/usecases/reset_password_usecase.dart';
import 'features/auth/domain/usecases/check_email_usecase.dart';
import 'features/auth/domain/usecases/check_auth_status_usecase.dart';
import 'features/auth/domain/usecases/update_password_usecase.dart';
import 'features/auth/domain/usecases/update_basic_info_usecase.dart';
import 'features/auth/domain/usecases/send_otp_usecase.dart';
import 'features/auth/domain/usecases/verify_otp_usecase.dart';
import 'features/auth/domain/usecases/update_fcm_token_usecase.dart';
import 'features/auth/presentation/bloc/auth_bloc.dart';

import 'features/home/data/datasources/job_remote_data_source.dart';
import 'features/home/data/datasources/job_application_remote_data_source.dart';
import 'features/home/data/repositories/job_repository_impl.dart';
import 'features/home/data/repositories/job_application_repository_impl.dart';
import 'features/home/domain/repositories/job_repository.dart';
import 'features/home/domain/repositories/job_application_repository.dart';
import 'features/home/domain/usecases/get_job_offers.dart';
import 'features/home/domain/usecases/apply_to_job.dart';
import 'features/home/presentation/bloc/home_bloc.dart';
import 'features/home/presentation/bloc/saved_jobs_bloc.dart';
import 'features/home/presentation/bloc/job_application_bloc.dart';

import 'core/network/auth_interceptor.dart';
import 'core/network/dio_ssl_config.dart';
import 'core/network/network_info.dart';
import 'core/services/notification_service.dart';
import 'core/services/websocket_service.dart';
import 'core/services/presence_service.dart';

final sl = GetIt.instance;

Future<void> init() async {

  //! =========================
  //! External
  //! =========================

  sl.registerLazySingleton(() => const FlutterSecureStorage());
  sl.registerLazySingleton(() => Connectivity());

  final dio = Dio(
    BaseOptions(
      connectTimeout: const Duration(seconds: 10),
      sendTimeout: const Duration(seconds: 10),
      receiveTimeout: const Duration(seconds: 15),
      headers: const {
        'Accept': 'application/json',
      },
    ),
  );

  configureLocalDevSsl(dio);

  sl.registerLazySingleton(() => dio);

  //! =========================
  //! Core
  //! =========================

  sl.registerLazySingleton<NetworkInfo>(
    () => NetworkInfoImpl(sl<Connectivity>()),
  );

  sl.registerLazySingleton(
    () => NotificationService(updateFcmTokenUseCase: sl()),
  );

  sl.registerLazySingleton(() => WebSocketService(dio: sl()));
  sl.registerLazySingleton(() => PresenceService(dio: sl()));

  //! =========================
  //! Features - Auth
  //! =========================

  // Bloc
  sl.registerFactory(
    () => AuthBloc(
      loginUseCase: sl(),
      signUpUseCase: sl(),
      resetPasswordUseCase: sl(),
      checkEmailUseCase: sl(),
      checkAuthStatusUseCase: sl(),
      updatePasswordUseCase: sl(),
      updateBasicInfoUseCase: sl(),
      sendOtpUseCase: sl(),
      verifyOtpUseCase: sl(),
    ),
  );

  // Use cases
  sl.registerLazySingleton(() => LoginUseCase(sl()));
  sl.registerLazySingleton(() => SignUpUseCase(sl()));
  sl.registerLazySingleton(() => ResetPasswordUseCase(sl()));
  sl.registerLazySingleton(() => CheckEmailUseCase(sl()));
  sl.registerLazySingleton(() => CheckAuthStatusUseCase(sl()));
  sl.registerLazySingleton(() => UpdatePasswordUseCase(repository: sl()));
  sl.registerLazySingleton(() => UpdateBasicInfoUseCase(repository: sl()));
  sl.registerLazySingleton(() => SendOtpUseCase(sl()));
  sl.registerLazySingleton(() => VerifyOtpUseCase(sl()));
  sl.registerLazySingleton(() => UpdateFcmTokenUseCase(sl()));

  // Repository
  sl.registerLazySingleton<AuthRepository>(
    () => AuthRepositoryImpl(
      remoteDataSource: sl(),
      localDataSource: sl(),
    ),
  );

  // Data sources
  sl.registerLazySingleton<AuthDataSource>(
    () => AuthRemoteDataSource(dio: sl()),
  );

  sl.registerLazySingleton<AuthLocalDataSource>(
    () => AuthLocalDataSourceImpl(secureStorage: sl()),
  );

  //! =========================
  //! Features - Home
  //! =========================

  // Bloc
  sl.registerFactory(() => HomeBloc(getJobOffers: sl()));
  sl.registerFactory(() => SavedJobsBloc(secureStorage: sl(), dio: sl()));
  sl.registerFactory(() => JobApplicationBloc(applyToJob: sl()));

  // Use cases
  sl.registerLazySingleton(() => GetJobOffers(sl()));
  sl.registerLazySingleton(() => ApplyToJobUseCase(sl()));

  // Repository
  sl.registerLazySingleton<JobRepository>(
    () => JobRepositoryImpl(
      remoteDataSource: sl(),
      networkInfo: sl(),
    ),
  );

  sl.registerLazySingleton<JobApplicationRepository>(
    () => JobApplicationRepositoryImpl(
      remoteDataSource: sl(),
      networkInfo: sl(),
    ),
  );

  // Data sources
  sl.registerLazySingleton<JobRemoteDataSource>(
    () => JobRemoteDataSourceImpl(dio: sl()),
  );

  sl.registerLazySingleton<JobApplicationRemoteDataSource>(
    () => JobApplicationRemoteDataSourceImpl(dio: sl()),
  );

  //! =========================
  //! Add Interceptors (AFTER registration)
  //! =========================

  dio.interceptors.add(
    AuthInterceptor(
      localDataSource: sl<AuthLocalDataSource>(),
      remoteDataSource: sl<AuthDataSource>(),
      dio: dio,
    ),
  );
}
