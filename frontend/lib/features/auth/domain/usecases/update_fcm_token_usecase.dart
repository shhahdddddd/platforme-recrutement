import 'package:dartz/dartz.dart';
import '../../../../core/error/failures.dart';
import '../repositories/auth_repository.dart';

class UpdateFcmTokenUseCase {
  final AuthRepository repository;

  UpdateFcmTokenUseCase(this.repository);

  Future<Either<Failure, void>> call(String fcmToken, String platform) async {
    return await repository.updateFcmToken(fcmToken, platform);
  }
}
