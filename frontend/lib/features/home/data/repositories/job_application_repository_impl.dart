import 'package:dartz/dartz.dart';
import '../../../../core/error/exceptions.dart';
import '../../../../core/error/failures.dart';
import '../../../../core/network/network_info.dart';
import '../../domain/repositories/job_application_repository.dart';
import '../datasources/job_application_remote_data_source.dart';

class JobApplicationRepositoryImpl implements JobApplicationRepository {
  final JobApplicationRemoteDataSource remoteDataSource;
  final NetworkInfo networkInfo;

  JobApplicationRepositoryImpl({
    required this.remoteDataSource,
    required this.networkInfo,
  });

  @override
  Future<Either<Failure, bool>> applyToJob({
    required int jobOfferId,
    required List<int> fileBytes,
    required String fileName,
  }) async {
    if (await networkInfo.isConnected) {
      try {
        final result = await remoteDataSource.applyToJob(
          jobOfferId: jobOfferId,
          fileBytes: fileBytes,
          fileName: fileName,
        );
        return Right(result);
      } on ServerException {
        return Left(ServerFailure());
      } catch (e) {
        final message = e.toString().replaceFirst('Exception: ', '').trim();
        return Left(
          ServerFailure(message: message.isEmpty ? 'Erreur serveur' : message),
        );
      }
    } else {
      return Left(ServerFailure(message: 'No internet connection'));
    }
  }
}
