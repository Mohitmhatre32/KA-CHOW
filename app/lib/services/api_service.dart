import 'package:dio/dio.dart';
import '../core/constants.dart';

class ApiService {
  final Dio _dio = Dio(
    BaseOptions(
      baseUrl: AppConstants.baseUrl,
      connectTimeout: const Duration(seconds: 5),
      receiveTimeout: const Duration(seconds: 3),
      headers: {
        'Content-Type': 'application/json',
      },
    ),
  );

  Future<Response> get(String path, {Map<String, dynamic>? queryParameters}) async {
    try {
      return await _dio.get(path, queryParameters: queryParameters);
    } on DioException catch (e) {
      // Handle errors globally or rethrow
      throw _handleError(e);
    }
  }

  Future<Response> post(String path, {dynamic data}) async {
    try {
      return await _dio.post(path, data: data);
    } on DioException catch (e) {
      throw _handleError(e);
    }
  }

  Future<Map<String, dynamic>> fetchMetrics() async {
    try {
      final response = await get(AppConstants.metricsEndpoint);
      // Backend might return the metrics structured differently, adjusting for dummy/demo data if needed
      return response.data as Map<String, dynamic>;
    } catch (e) {
      rethrow;
    }
  }

  String _handleError(DioException error) {
    if (error.response != null) {
      return 'API Error: ${error.response?.statusCode} - ${error.response?.statusMessage}';
    }
    return 'Connection Error: ${error.message}';
  }
}
