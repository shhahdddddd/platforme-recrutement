import 'package:dio/dio.dart';
import '../../../../core/error/exceptions.dart';
import '../../../../core/constants/app_constants.dart';
import '../models/job_offer_model.dart';

abstract class JobRemoteDataSource {
  Future<List<JobOfferModel>> getJobOffers();
}

class JobRemoteDataSourceImpl implements JobRemoteDataSource {
  final Dio dio;

  JobRemoteDataSourceImpl({required this.dio});

  @override
  Future<List<JobOfferModel>> getJobOffers() async {
    try {
      final response = await dio.get(
        '${AppConstants.apiBaseUrl}/auth/job-offers',
      );

      if (response.statusCode == 200 && response.data['success'] == true) {
        final data = response.data['data'] as List;
        return data.map((json) => JobOfferModel.fromJson(json)).toList();
      } else {
        throw ServerException();
      }
    } on DioException catch (e) {
      if (e.response?.statusCode == 401) {
        throw UnauthorizedException();
      }
      throw ServerException();
    } catch (e) {
      throw ServerException();
    }
  }
}
