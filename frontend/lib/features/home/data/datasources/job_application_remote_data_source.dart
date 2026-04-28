import 'package:dio/dio.dart';
import '../../../../core/constants/app_constants.dart';
import '../../../../core/error/exceptions.dart';

abstract class JobApplicationRemoteDataSource {
  Future<bool> applyToJob({
    required int jobOfferId,
    required List<int> fileBytes,
    required String fileName,
  });
}

class JobApplicationRemoteDataSourceImpl implements JobApplicationRemoteDataSource {
  final Dio dio;

  JobApplicationRemoteDataSourceImpl({required this.dio});

  @override
  Future<bool> applyToJob({
    required int jobOfferId,
    required List<int> fileBytes,
    required String fileName,
  }) async {
    final formData = FormData.fromMap({
      'cv': MultipartFile.fromBytes(fileBytes, filename: fileName),
    });

    try {
      final response = await dio.post(
        '${AppConstants.apiBaseUrl}/job-offers/$jobOfferId/apply',
        data: formData,
      );

      if (response.statusCode == 201 || (response.statusCode == 200 && response.data['success'] == true)) {
        return true;
      } else {
        throw ServerException();
      }
    } on DioException catch (e) {
      if (e.response?.statusCode == 400 || e.response?.statusCode == 422) {
        throw Exception(e.response?.data['message'] ?? 'Validation Error');
      }
      throw ServerException();
    }
  }
}
