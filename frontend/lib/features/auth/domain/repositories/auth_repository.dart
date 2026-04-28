import 'package:dartz/dartz.dart';
import '../../../../core/error/failures.dart';
import '../entities/user_entity.dart';

abstract class AuthRepository {
  Future<Either<Failure, UserEntity>> login(String email, String password);
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
  });

  Future<Either<Failure, bool>> checkEmail(String email);

  Future<Either<Failure, void>> resetPassword({
    required String email,
    required String newPassword,
  });
  Future<Either<Failure, UserEntity>> verifyToken();
  Future<Either<Failure, void>> updatePassword(String currentPassword, String newPassword);
  Future<Either<Failure, void>> updateBasicInfo({
    String? name,
    String? email,
    String? phone,
    String? location,
    String? bio,
  });
  Future<Either<Failure, void>> sendOtp(String email);
  Future<Either<Failure, void>> verifyOtp(String email, String otp);
  Future<Either<Failure, void>> updateFcmToken(String fcmToken, String platform);
  Future<void> logout();
}
