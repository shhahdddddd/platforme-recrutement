import 'package:dartz/dartz.dart';
import '../../../../core/error/failures.dart';
import '../entities/job_offer_entity.dart';

abstract class JobRepository {
  Future<Either<Failure, List<JobOfferEntity>>> getJobOffers();
}
