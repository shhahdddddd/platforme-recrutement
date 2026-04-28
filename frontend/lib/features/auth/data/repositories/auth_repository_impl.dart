import 'dart:async';

import 'package:dartz/dartz.dart';
import '../../../../core/error/failures.dart';
import '../../domain/entities/user_entity.dart';
import '../../domain/repositories/auth_repository.dart';
import '../datasources/auth_remote_data_source.dart';
import '../datasources/auth_local_data_source.dart';

class AuthRepositoryImpl implements AuthRepository {
  final AuthDataSource remoteDataSource;
  final AuthLocalDataSource localDataSource;

  AuthRepositoryImpl({
    required this.remoteDataSource,
    required this.localDataSource,
  });

  @override
  Future<Either<Failure, UserEntity>> login(
    String email,
    String password,
  ) async {
    try {
      final user = await remoteDataSource.login(email, password);
      if (user.token != null) {
        await localDataSource.cacheToken(user.token!);
      }
      if (user.refreshToken != null) {
        await localDataSource.cacheRefreshToken(user.refreshToken!);
      }
      return Right(user);
    } catch (e) {
      String msg = e.toString();
      if (msg.startsWith('Exception: ')) {
        msg = msg.substring(11);
      }
      return Left(ServerFailure(message: msg));
    }
  }

  @override
  Future<Either<Failure, UserEntity>> signUp({
    required String name,
    required String email,
    required String password,
    required String role,
    String? phone,
    String? location,
    String? bio,
    String? specialite,
    bool? isStudent,
    bool? isEngineer,
    String? companyName,
    String? companyDescription,
    String? industry,
    String? photoPath,
    bool? businessOwner,
  }) async {
    try {
      // Map frontend roles to backend roles
      String backendRole = role;
      if (role == 'candidat') backendRole = 'candidate';
      if (role == 'entreprise') backendRole = 'company';

      final Map<String, dynamic> data = {
        'name': name,
        'email': email,
        'password': password,
        'password_confirmation': password,
        'role': backendRole,
        'phone': phone,
        'location': location,
        'bio': bio,
        'photo_path': photoPath,
      };

      if (backendRole == 'candidate') {
        final names = name.split(' ');
        data['first_name'] = names.first;
        data['last_name'] = names.length > 1 ? names.sublist(1).join(' ') : '';
        data['still_student'] = isStudent;
        data['is_engineer'] = isEngineer;
        data['specialite'] = specialite;
      } else if (backendRole == 'company') {
        data['company_name'] = companyName;
        data['description'] = companyDescription;
        data['industry'] = industry;
      }

      final user = await remoteDataSource.signUp(data);
      return Right(user);
    } catch (e) {
      String msg = e.toString();
      if (msg.startsWith('Exception: ')) {
        msg = msg.substring(11);
      }
      return Left(ServerFailure(message: msg));
    }
  }

  @override
  Future<Either<Failure, bool>> checkEmail(String email) async {
    try {
      final exists = await remoteDataSource.checkEmail(email);
      return Right(exists);
    } catch (e) {
      String msg = e.toString();
      if (msg.startsWith('Exception: ')) {
        msg = msg.substring(11);
      }
      return Left(ServerFailure(message: msg));
    }
  }

  @override
  Future<Either<Failure, void>> resetPassword({
    required String email,
    required String newPassword,
  }) async {
    try {
      await remoteDataSource.resetPassword(email, newPassword);
      return const Right(null);
    } catch (e) {
      String msg = e.toString();
      if (msg.startsWith('Exception: ')) {
        msg = msg.substring(11);
      }
      return Left(ServerFailure(message: msg));
    }
  }

  @override
  Future<Either<Failure, UserEntity>> verifyToken() async {
    try {
      final token = await localDataSource.getLastToken();
      if (token == null) {
        return Left(CacheFailure(message: "No token found"));
      }

      final user = await remoteDataSource
          .getUserProfile(token)
          .timeout(const Duration(seconds: 6));
      final userWithToken = user.copyWith(token: token);

      return Right(userWithToken);
    } on TimeoutException {
      // Don't clear tokens on transient network issues.
      return Left(ServerFailure(message: 'Session check timeout'));
    } catch (e) {
      // Keep tokens; interceptor will handle refresh/clearing if truly invalid.
      String msg = e.toString();
      if (msg.startsWith('Exception: ')) {
        msg = msg.substring(11);
      }
      return Left(ServerFailure(message: msg));
    }
  }

  @override
  Future<Either<Failure, void>> updatePassword(
    String currentPassword,
    String newPassword,
  ) async {
    try {
      final token = await localDataSource.getLastToken();
      if (token == null)
        return Left(CacheFailure(message: "S'il vous plaît connectez-vous"));
      await remoteDataSource.updatePassword(
        token,
        currentPassword,
        newPassword,
      );
      return const Right(null);
    } catch (e) {
      String msg = e.toString();
      if (msg.startsWith('Exception: ')) {
        msg = msg.substring(11);
      }
      return Left(ServerFailure(message: msg));
    }
  }

  @override
  Future<Either<Failure, void>> updateBasicInfo({
    String? name,
    String? email,
    String? phone,
    String? location,
    String? bio,
  }) async {
    try {
      final token = await localDataSource.getLastToken();
      if (token == null) {
        return Left(CacheFailure(message: "Not logged in"));
      }

      final Map<String, dynamic> data = {};
      if (name != null) data['name'] = name;
      if (email != null) data['email'] = email;
      if (phone != null) data['phone'] = phone;
      if (location != null) data['location'] = location;
      if (bio != null) data['bio'] = bio;

      await remoteDataSource.updateBasicInfo(token, data);
      return const Right(null);
    } catch (e) {
      String msg = e.toString();
      if (msg.startsWith('Exception: ')) {
        msg = msg.substring(11);
      }
      return Left(ServerFailure(message: msg));
    }
  }

  @override
  Future<Either<Failure, void>> sendOtp(String email) async {
    try {
      await remoteDataSource.sendOtp(email);
      return const Right(null);
    } catch (e) {
      String msg = e.toString();
      if (msg.startsWith('Exception: ')) {
        msg = msg.substring(11);
      }
      return Left(ServerFailure(message: msg));
    }
  }

  @override
  Future<Either<Failure, void>> verifyOtp(String email, String otp) async {
    try {
      await remoteDataSource.verifyOtp(email, otp);
      return const Right(null);
    } catch (e) {
      String msg = e.toString();
      if (msg.startsWith('Exception: ')) {
        msg = msg.substring(11);
      }
      return Left(ServerFailure(message: msg));
    }
  }

  @override
  Future<Either<Failure, void>> updateFcmToken(String fcmToken, String platform) async {
    try {
      final token = await localDataSource.getLastToken();
      if (token == null) return Left(CacheFailure(message: "Not logged in"));
      await remoteDataSource.updateFcmToken(token, fcmToken, platform);
      return const Right(null);
    } catch (e) {
      String msg = e.toString();
      if (msg.startsWith('Exception: ')) {
        msg = msg.substring(11);
      }
      return Left(ServerFailure(message: msg));
    }
  }

  @override
  Future<void> logout() async {
    await localDataSource.clearToken();
  }
}
