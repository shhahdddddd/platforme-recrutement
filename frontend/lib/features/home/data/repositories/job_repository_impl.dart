import 'package:dartz/dartz.dart';
import '../../../../core/error/failures.dart';
import '../../../../core/error/exceptions.dart';
import '../../domain/repositories/job_repository.dart';
import '../../domain/entities/job_offer_entity.dart';
import '../datasources/job_remote_data_source.dart';
import '../../../../core/network/network_info.dart';

class JobRepositoryImpl implements JobRepository {
  final JobRemoteDataSource remoteDataSource;
  final NetworkInfo networkInfo;

  JobRepositoryImpl({
    required this.remoteDataSource,
    required this.networkInfo,
  });

  @override
  Future<Either<Failure, List<JobOfferEntity>>> getJobOffers() async {
    if (await networkInfo.isConnected) {
      try {
        final remoteJobs = await remoteDataSource.getJobOffers();
        // Convert Model -> Entity
        final entities = remoteJobs.map((model) => model.toEntity()).toList();

        return Right(entities);
      } on ServerException {
        return Left(ServerFailure());
      }
    } else {
      return Left(ServerFailure());
    }
  }
}
