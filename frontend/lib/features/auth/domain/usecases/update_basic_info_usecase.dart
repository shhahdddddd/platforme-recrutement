import 'package:dartz/dartz.dart';
import '../../../../core/error/failures.dart';
import '../repositories/auth_repository.dart';

class UpdateBasicInfoUseCase {
  final AuthRepository repository;

  UpdateBasicInfoUseCase({required this.repository});

  Future<Either<Failure, void>> call({
    String? name,
    String? email,
    String? phone,
    String? location,
    String? bio,
  }) async {
    return await repository.updateBasicInfo(
      name: name,
      email: email,
      phone: phone,
      location: location,
      bio: bio,
    );
  }
}
