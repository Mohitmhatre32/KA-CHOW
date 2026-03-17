import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod/legacy.dart';
import '../services/api_service.dart';

// ── Repo list ─────────────────────────────────────────────────────────────────

final storeReposProvider =
    FutureProvider<List<Map<String, dynamic>>>((ref) async {
  final response = await ApiService().get('/api/mobile/store/repos');
  final List<dynamic> data = response.data;
  return data.cast<Map<String, dynamic>>();
});

// ── Per-repo dashboard ────────────────────────────────────────────────────────

final repoDashboardProvider =
    FutureProvider.family<Map<String, dynamic>, String>((ref, repoName) async {
  final response =
      await ApiService().get('/api/mobile/store/repos/$repoName/dashboard');
  return Map<String, dynamic>.from(response.data);
});

// ── Import state ──────────────────────────────────────────────────────────────

enum ImportStatus { idle, loading, success, error }

class ImportState {
  final ImportStatus status;
  final String message;
  final Map<String, dynamic>? result;

  const ImportState({
    this.status = ImportStatus.idle,
    this.message = '',
    this.result,
  });

  ImportState copyWith({
    ImportStatus? status,
    String? message,
    Map<String, dynamic>? result,
  }) {
    return ImportState(
      status: status ?? this.status,
      message: message ?? this.message,
      result: result ?? this.result,
    );
  }
}

class ImportRepoNotifier extends StateNotifier<ImportState> {
  ImportRepoNotifier() : super(const ImportState());

  Future<void> importRepo(String url, String branch, WidgetRef ref) async {
    if (url.trim().isEmpty) return;
    state = state.copyWith(status: ImportStatus.loading, message: 'Cloning & processing…');
    try {
      final response = await ApiService().post(
        '/api/mobile/store/import',
        data: {'repo_url': url.trim(), 'branch': branch.trim()},
      );
      final data = Map<String, dynamic>.from(response.data);
      if (data['ok'] == true) {
        state = state.copyWith(
          status: ImportStatus.success,
          message: 'Imported: ${data['project_name']}',
          result: data,
        );
        // Refresh the repo list
        ref.invalidate(storeReposProvider);
      } else {
        state = state.copyWith(
          status: ImportStatus.error,
          message: data['error'] ?? 'Unknown error',
        );
      }
    } catch (e) {
      state = state.copyWith(
        status: ImportStatus.error,
        message: 'Connection error: ${e.toString().split('\n').first}',
      );
    }
  }

  void reset() => state = const ImportState();
}

final importRepoProvider =
    StateNotifierProvider<ImportRepoNotifier, ImportState>(
  (ref) => ImportRepoNotifier(),
);
