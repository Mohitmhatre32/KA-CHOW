import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod/legacy.dart';
import '../../core/constants.dart';
import '../../services/api_service.dart';
import '../widgets/glass_card.dart';
import '../widgets/mesh_background.dart';
import '../navigation_shell.dart';

// ── Provider ──────────────────────────────────────────────────────────────────

final _projectsProvider = FutureProvider<List<Map<String, dynamic>>>((ref) async {
  final api = ApiService();
  final response = await api.get('/api/mobile/projects');
  final List<dynamic> data = response.data;
  return data.cast<Map<String, dynamic>>();
});

// Holds the currently selected repo_name so the dashboard can scope metrics
final activeRepoProvider = StateProvider<String?>((ref) => null);

// ── Screen ───────────────────────────────────────────────────────────────────

class ProjectSelectionScreen extends ConsumerWidget {
  const ProjectSelectionScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final projectsAsync = ref.watch(_projectsProvider);

    return Scaffold(
      body: MeshBackground(
        child: SafeArea(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 24.0, vertical: 32.0),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'SELECT TARGET',
                      style: Theme.of(context).textTheme.displayLarge?.copyWith(fontSize: 28),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      'Choose a scanned repository to initialize the diagnostic dashboard.',
                      style: TextStyle(
                        fontSize: 12,
                        color: Colors.white.withValues(alpha: 0.6),
                        letterSpacing: 1,
                      ),
                    ),
                  ],
                ),
              ),
              Expanded(
                child: projectsAsync.when(
                  data: (projects) => projects.isEmpty
                      ? _buildEmpty(context, ref)
                      : ListView.builder(
                          padding: const EdgeInsets.symmetric(horizontal: 16.0),
                          physics: const BouncingScrollPhysics(),
                          itemCount: projects.length,
                          itemBuilder: (context, index) {
                            final project = projects[index];
                            return Padding(
                              padding: const EdgeInsets.only(bottom: 16.0),
                              child: _buildProjectCard(context, ref, project),
                            );
                          },
                        ),
                  loading: () => const Center(
                    child: CircularProgressIndicator(color: AppColors.primary),
                  ),
                  error: (err, _) => _buildError(context, ref, err.toString()),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildProjectCard(
      BuildContext context, WidgetRef ref, Map<String, dynamic> project) {
    final docRatio = (project['documented_ratio'] as num? ?? 0.0).toDouble();
    final totalFiles = project['total_files'] as int? ?? 0;
    final branch = project['branch'] as String? ?? 'main';
    final processedAt = project['processed_at'] as String? ?? '';

    // Pick a color based on documentation ratio
    final Color projColor = docRatio >= 0.7
        ? AppColors.neonGreen
        : docRatio >= 0.4
            ? AppColors.neonCyan
            : AppColors.neonOrange;

    final String status = docRatio >= 0.7
        ? 'HEALTHY'
        : docRatio >= 0.4
            ? 'ACTIVE'
            : 'NEEDS DOCS';

    return GestureDetector(
      onTap: () {
        // Store the selected repo so dashboard uses it for scoped metrics
        ref.read(activeRepoProvider.notifier).state =
            project['repo_name'] as String?;
        Navigator.of(context).pushReplacement(
          MaterialPageRoute(builder: (context) => const MainNavigationShell()),
        );
      },
      child: GlassCard(
        padding: const EdgeInsets.all(20),
        glowColor: projColor.withValues(alpha: 0.3),
        child: Row(
          children: [
            // Icon + health ring
            Stack(
              alignment: Alignment.center,
              children: [
                SizedBox(
                  width: 52,
                  height: 52,
                  child: CircularProgressIndicator(
                    value: docRatio,
                    strokeWidth: 2,
                    backgroundColor: projColor.withValues(alpha: 0.1),
                    valueColor: AlwaysStoppedAnimation<Color>(projColor),
                  ),
                ),
                Container(
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: projColor.withValues(alpha: 0.1),
                    shape: BoxShape.circle,
                  ),
                  child: Icon(Icons.folder_special_outlined, color: projColor, size: 22),
                ),
              ],
            ),
            const SizedBox(width: 20),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    project['name'] as String? ?? project['repo_name'] as String,
                    style: const TextStyle(
                      fontSize: 15,
                      fontWeight: FontWeight.bold,
                      color: Colors.white,
                      letterSpacing: 0.5,
                    ),
                    overflow: TextOverflow.ellipsis,
                  ),
                  const SizedBox(height: 4),
                  Text(
                    '$totalFiles files  ·  branch: $branch',
                    style: TextStyle(
                      fontSize: 11,
                      color: Colors.white.withValues(alpha: 0.45),
                    ),
                  ),
                  if (processedAt.isNotEmpty) ...[
                    const SizedBox(height: 2),
                    Text(
                      'Scanned: ${_formatDate(processedAt)}',
                      style: TextStyle(
                        fontSize: 10,
                        color: Colors.white.withValues(alpha: 0.3),
                        fontStyle: FontStyle.italic,
                      ),
                    ),
                  ],
                  const SizedBox(height: 8),
                  Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                        decoration: BoxDecoration(
                          color: projColor.withValues(alpha: 0.1),
                          borderRadius: BorderRadius.circular(4),
                          border: Border.all(color: projColor.withValues(alpha: 0.25)),
                        ),
                        child: Text(
                          status,
                          style: TextStyle(
                            fontSize: 9,
                            fontWeight: FontWeight.w900,
                            letterSpacing: 1.5,
                            color: projColor,
                          ),
                        ),
                      ),
                      const SizedBox(width: 8),
                      Text(
                        '${(docRatio * 100).toStringAsFixed(0)}% docs',
                        style: TextStyle(
                          fontSize: 10,
                          color: projColor.withValues(alpha: 0.7),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
            Icon(Icons.chevron_right, color: Colors.white.withValues(alpha: 0.3)),
          ],
        ),
      ),
    );
  }

  Widget _buildEmpty(BuildContext context, WidgetRef ref) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(40),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.radar_outlined, size: 80, color: AppColors.primary.withValues(alpha: 0.3)),
            const SizedBox(height: 24),
            const Text(
              'NO REPOS SCANNED YET',
              style: TextStyle(
                color: Colors.white38,
                letterSpacing: 3,
                fontWeight: FontWeight.bold,
                fontSize: 13,
              ),
            ),
            const SizedBox(height: 12),
            Text(
              'Use the web dashboard to scan a GitHub repository first. '
              'Once processed, it will appear here automatically.',
              textAlign: TextAlign.center,
              style: TextStyle(
                fontSize: 12,
                color: Colors.white.withValues(alpha: 0.3),
                height: 1.6,
              ),
            ),
            const SizedBox(height: 32),
            OutlinedButton.icon(
              style: OutlinedButton.styleFrom(
                side: const BorderSide(color: AppColors.primary),
                foregroundColor: AppColors.primary,
              ),
              onPressed: () => ref.invalidate(_projectsProvider),
              icon: const Icon(Icons.refresh, size: 16),
              label: const Text('RETRY'),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildError(BuildContext context, WidgetRef ref, String error) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(40),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(Icons.signal_wifi_connected_no_internet_4, size: 64, color: AppColors.neonPink),
            const SizedBox(height: 16),
            const Text(
              'UPLINK FAILED',
              style: TextStyle(color: Colors.white54, letterSpacing: 3, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 8),
            Text(
              'Cannot reach the KA-CHOW backend.\nMake sure uvicorn is running.',
              textAlign: TextAlign.center,
              style: TextStyle(fontSize: 12, color: Colors.white.withValues(alpha: 0.35), height: 1.5),
            ),
            const SizedBox(height: 32),
            ElevatedButton.icon(
              style: ElevatedButton.styleFrom(
                  backgroundColor: AppColors.primary, foregroundColor: Colors.black),
              onPressed: () => ref.invalidate(_projectsProvider),
              icon: const Icon(Icons.refresh, size: 16),
              label: const Text('RETRY SYNC'),
            ),
          ],
        ),
      ),
    );
  }

  String _formatDate(String iso) {
    try {
      final dt = DateTime.parse(iso).toLocal();
      return '${dt.day} ${_month(dt.month)} ${dt.year}, ${dt.hour.toString().padLeft(2,'0')}:${dt.minute.toString().padLeft(2,'0')}';
    } catch (_) {
      return iso.split('T').first;
    }
  }

  String _month(int m) => const [
    '', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
  ][m];
}
