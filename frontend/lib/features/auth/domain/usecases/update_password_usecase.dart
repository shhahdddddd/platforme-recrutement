import 'package:dartz/dartz.dart';
import '../../../../core/error/failures.dart';
import '../repositories/auth_repository.dart';

class UpdatePasswordUseCase {
  final AuthRepository repository;

  UpdatePasswordUseCase({required this.repository});

  Future<Either<Failure, void>> call(String currentPassword, String newPassword) async {
    return await repository.updatePassword(currentPassword, newPassword);
  }
}
