import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod/legacy.dart';
import '../models/system_metrics.dart';
import '../services/api_service.dart';
import '../views/screens/project_selection_screen.dart';

final apiServiceProvider = Provider((ref) => ApiService());

final dashboardViewModelProvider =
    StateNotifierProvider<DashboardViewModel, AsyncValue<SystemMetrics>>((ref) {
  final apiService = ref.watch(apiServiceProvider);
  final activeRepo = ref.watch(activeRepoProvider);
  return DashboardViewModel(apiService, activeRepo);
});

class DashboardViewModel extends StateNotifier<AsyncValue<SystemMetrics>> {
  final ApiService _apiService;
  final String? _activeRepo;

  DashboardViewModel(this._apiService, this._activeRepo)
      : super(const AsyncValue.loading()) {
    refreshMetrics();
  }

  Future<void> refreshMetrics() async {
    state = const AsyncValue.loading();
    try {
      // Append ?repo_name= to scope metrics to the selected project
      final query = _activeRepo != null ? '?repo_name=$_activeRepo' : '';
      final response =
          await _apiService.get('/api/mobile/status$query');
      final metrics = SystemMetrics.fromJson(
          response.data as Map<String, dynamic>);
      state = AsyncValue.data(metrics);
    } catch (e, st) {
      state = AsyncValue.error(e, st);
    }
  }
}
