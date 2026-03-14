import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../services/api_service.dart';
import 'dashboard_view_model.dart';

final workflowViewModelProvider = NotifierProvider<WorkflowViewModel, AsyncValue<List<Map<String, dynamic>>>>(() {
  return WorkflowViewModel();
});

class WorkflowViewModel extends Notifier<AsyncValue<List<Map<String, dynamic>>>> {
  @override
  AsyncValue<List<Map<String, dynamic>>> build() {
    _apiService = ref.watch(apiServiceProvider);
    Future.microtask(() => fetchWorkflows());
    return const AsyncValue.loading();
  }

  late final ApiService _apiService;

  Future<void> fetchWorkflows() async {
    state = const AsyncValue.loading();
    try {
      final response = await _apiService.get('/api/mobile/workflows');
      final List<dynamic> data = response.data;
      state = AsyncValue.data(data.cast<Map<String, dynamic>>());
    } catch (e, st) {
      state = AsyncValue.error(e, st);
    }
  }

  Future<void> controlWorkflow(String id, String action) async {
    try {
      await _apiService.post('/api/mobile/workflows/$id/control', data: {'action': action});
      await fetchWorkflows(); // Refresh list
    } catch (e) {
      // Handle error locally or through a global messenger
    }
  }
}

final approvalsViewModelProvider = NotifierProvider<ApprovalsViewModel, AsyncValue<List<Map<String, dynamic>>>>(() {
  return ApprovalsViewModel();
});

class ApprovalsViewModel extends Notifier<AsyncValue<List<Map<String, dynamic>>>> {
  @override
  AsyncValue<List<Map<String, dynamic>>> build() {
    _apiService = ref.watch(apiServiceProvider);
    Future.microtask(() => fetchApprovals());
    return const AsyncValue.loading();
  }

  late final ApiService _apiService;

  Future<void> fetchApprovals() async {
    state = const AsyncValue.loading();
    try {
      final response = await _apiService.get('/api/mobile/approvals');
      final List<dynamic> data = response.data;
      state = AsyncValue.data(data.cast<Map<String, dynamic>>());
    } catch (e, st) {
      state = AsyncValue.error(e, st);
    }
  }

  Future<void> decideApproval(String id, String decision) async {
    try {
      await _apiService.post('/api/mobile/approvals/$id/decide', data: {'decision': decision});
      await fetchApprovals(); // Refresh list
    } catch (e) {
      // Handle error
    }
  }
}
