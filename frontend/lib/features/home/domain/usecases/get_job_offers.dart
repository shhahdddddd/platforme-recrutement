import 'package:dartz/dartz.dart';
import '../../../../core/error/failures.dart';
import '../repositories/job_repository.dart';
import '../entities/job_offer_entity.dart';
import '../../../../core/usecases/usecase.dart';

class GetJobOffers implements UseCase<List<JobOfferEntity>, NoParams> {
  final JobRepository repository;

  GetJobOffers(this.repository);

  @override
  Future<Either<Failure, List<JobOfferEntity>>> call(NoParams params) async {
    return await repository.getJobOffers();
  }
}
