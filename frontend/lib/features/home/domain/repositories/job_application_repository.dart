import 'package:dartz/dartz.dart';
import '../../../../core/error/failures.dart';

abstract class JobApplicationRepository {
  Future<Either<Failure, bool>> applyToJob({
    required int jobOfferId,
    required List<int> fileBytes,
    required String fileName,
  });
}
