import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod/legacy.dart';
import '../models/system_metrics.dart';
import '../services/api_service.dart';

final apiServiceProvider = Provider((ref) => ApiService());

final dashboardViewModelProvider = StateNotifierProvider<DashboardViewModel, AsyncValue<SystemMetrics>>((ref) {
  final apiService = ref.watch(apiServiceProvider);
  return DashboardViewModel(apiService);
});

class DashboardViewModel extends StateNotifier<AsyncValue<SystemMetrics>> {
  final ApiService _apiService;

  DashboardViewModel(this._apiService) : super(const AsyncValue.loading()) {
    refreshMetrics();
  }

  Future<void> refreshMetrics() async {
    state = const AsyncValue.loading();
    try {
      final data = await _apiService.fetchMetrics();
      final metrics = SystemMetrics.fromJson(data);
      state = AsyncValue.data(metrics);
    } catch (e, st) {
      state = AsyncValue.error(e, st);
    }
  }
}
