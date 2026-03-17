import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod/legacy.dart';
import '../models/alert.dart';
import '../services/api_service.dart';

final alertsViewModelProvider = StateNotifierProvider<AlertsViewModel, AsyncValue<List<Alert>>>((ref) {
  return AlertsViewModel(ApiService());
});

class AlertsViewModel extends StateNotifier<AsyncValue<List<Alert>>> {
  final ApiService _apiService;

  AlertsViewModel(this._apiService) : super(const AsyncValue.loading()) {
    fetchAlerts();
  }

  Future<void> fetchAlerts() async {
    state = const AsyncValue.loading();
    try {
      final response = await _apiService.get('/api/alerts');
      final List<dynamic> data = response.data;
      final alerts = data.map((json) => Alert.fromJson(json)).toList();
      state = AsyncValue.data(alerts);
    } catch (e, stack) {
      state = AsyncValue.error(e, stack);
    }
  }

  Future<void> markAsRead(int alertId) async {
    try {
      await _apiService.post('/api/alerts/$alertId/read');
      fetchAlerts();
    } catch (e) {
      // Silence error for now
    }
  }

  Future<void> markAllAsRead() async {
    try {
      await _apiService.post('/api/alerts/read-all');
      fetchAlerts();
    } catch (e) {
      // Silence error
    }
  }
}
