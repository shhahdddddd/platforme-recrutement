import 'package:dartz/dartz.dart';
import '../../../../core/error/failures.dart';
import '../repositories/job_application_repository.dart';

class ApplyToJobUseCase {
  final JobApplicationRepository repository;

  ApplyToJobUseCase(this.repository);

  Future<Either<Failure, bool>> call({
    required int jobOfferId,
    required List<int> fileBytes,
    required String fileName,
  }) async {
    return await repository.applyToJob(
      jobOfferId: jobOfferId,
      fileBytes: fileBytes,
      fileName: fileName,
    );
  }
}
