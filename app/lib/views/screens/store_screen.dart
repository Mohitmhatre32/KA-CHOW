import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../core/constants.dart';
import '../../view_models/store_view_model.dart';
import '../widgets/glass_card.dart';
import '../widgets/mesh_background.dart';
import 'repo_dashboard_screen.dart';

class StoreScreen extends ConsumerWidget {
  const StoreScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final reposAsync = ref.watch(storeReposProvider);

    return Scaffold(
      extendBodyBehindAppBar: true,
      appBar: AppBar(
        title: Text(
          'DASHBOARD',
          style: GoogleFonts.orbitron(
              fontSize: 16, fontWeight: FontWeight.bold, letterSpacing: 2),
        ),
        centerTitle: true,
        backgroundColor: Colors.transparent,
      ),
      floatingActionButton: Padding(
        padding: const EdgeInsets.only(bottom: 20, right: 8),
        child: FloatingActionButton.extended(
          onPressed: () => _showImportSheet(context, ref),
          backgroundColor: AppColors.primary,
          foregroundColor: Colors.black,
          elevation: 10,
          icon: const Icon(Icons.add_link_rounded),
          label: Text('LINK REPO',
              style: GoogleFonts.orbitron(
                  fontSize: 10, fontWeight: FontWeight.bold)),
        ),
      ),
      body: MeshBackground(
        child: reposAsync.when(
          data: (repos) => repos.isEmpty
              ? _buildEmptyState(context, ref)
              : _buildRepoList(context, ref, repos),
          loading: () =>
              const Center(child: CircularProgressIndicator(color: AppColors.primary)),
          error: (err, _) => _buildError(context, ref, err.toString()),
        ),
      ),
    );
  }

  Widget _buildRepoList(
      BuildContext context, WidgetRef ref, List<Map<String, dynamic>> repos) {
    return CustomScrollView(
      physics: const BouncingScrollPhysics(),
      slivers: [
        const SliverToBoxAdapter(child: SizedBox(height: 110)),
        SliverPadding(
          padding: const EdgeInsets.symmetric(horizontal: 16),
          sliver: SliverList(
            delegate: SliverChildBuilderDelegate(
              (context, index) => Padding(
                padding: const EdgeInsets.only(bottom: 16),
                child: _buildRepoCard(context, ref, repos[index]),
              ),
              childCount: repos.length,
            ),
          ),
        ),
        const SliverToBoxAdapter(child: SizedBox(height: 120)),
      ],
    );
  }

  Widget _buildRepoCard(
      BuildContext context, WidgetRef ref, Map<String, dynamic> repo) {
    final docRatio = (repo['documented_ratio'] as num? ?? 0.0).toDouble();
    final totalFiles = repo['total_files'] as int? ?? 0;
    final branch = repo['branch'] as String? ?? 'main';
    final repoName = repo['repo_name'] as String? ?? '';
    final name = repo['name'] as String? ?? repoName;
    final processedAt = repo['processed_at'] as String? ?? '';

    final Color healthColor = docRatio >= 0.7
        ? AppColors.neonGreen
        : docRatio >= 0.4
            ? AppColors.neonCyan
            : AppColors.neonOrange;

    return GestureDetector(
      onTap: () => Navigator.of(context).push(
        MaterialPageRoute(
          builder: (_) => RepoDashboardScreen(
            repoName: repoName,
            projectName: name,
          ),
        ),
      ),
      child: GlassCard(
        padding: const EdgeInsets.all(20),
        glowColor: healthColor.withValues(alpha: 0.25),
        child: Row(
          children: [
            // Health ring
            SizedBox(
              width: 54,
              height: 54,
              child: Stack(
                alignment: Alignment.center,
                children: [
                  CircularProgressIndicator(
                    value: docRatio,
                    strokeWidth: 3,
                    backgroundColor: healthColor.withValues(alpha: 0.1),
                    valueColor: AlwaysStoppedAnimation<Color>(healthColor),
                  ),
                  Icon(Icons.folder_special_outlined,
                      color: healthColor, size: 20),
                ],
              ),
            ),
            const SizedBox(width: 16),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    name,
                    style: const TextStyle(
                        fontSize: 15,
                        fontWeight: FontWeight.bold,
                        color: Colors.white),
                    overflow: TextOverflow.ellipsis,
                  ),
                  const SizedBox(height: 4),
                  Text(
                    '$totalFiles files  ·  $branch',
                    style: TextStyle(
                        fontSize: 11,
                        color: Colors.white.withValues(alpha: 0.45)),
                  ),
                  if (processedAt.isNotEmpty) ...[
                    const SizedBox(height: 2),
                    Text(
                      'Scanned ${_formatDate(processedAt)}',
                      style: TextStyle(
                          fontSize: 10,
                          color: Colors.white.withValues(alpha: 0.3),
                          fontStyle: FontStyle.italic),
                    ),
                  ],
                  const SizedBox(height: 8),
                  Row(
                    children: [
                      _statusBadge(
                        docRatio >= 0.7
                            ? 'HEALTHY'
                            : docRatio >= 0.4
                                ? 'ACTIVE'
                                : 'NEEDS DOCS',
                        healthColor,
                      ),
                      const SizedBox(width: 8),
                      Text(
                        '${(docRatio * 100).toStringAsFixed(0)}% docs',
                        style: TextStyle(
                            fontSize: 10,
                            color: healthColor.withValues(alpha: 0.7)),
                      ),
                    ],
                  ),
                ],
              ),
            ),
            const Icon(Icons.chevron_right, color: Colors.white24, size: 20),
          ],
        ),
      ),
    );
  }

  Widget _statusBadge(String label, Color color) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(4),
        border: Border.all(color: color.withValues(alpha: 0.25)),
      ),
      child: Text(
        label,
        style: TextStyle(
            fontSize: 9,
            fontWeight: FontWeight.w900,
            letterSpacing: 1.5,
            color: color),
      ),
    );
  }

  Widget _buildEmptyState(BuildContext context, WidgetRef ref) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(40),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.radar_outlined,
                size: 80, color: AppColors.primary.withValues(alpha: 0.3)),
            const SizedBox(height: 24),
            const Text(
              'NO REPOS LINKED',
              style: TextStyle(
                  color: Colors.white38,
                  letterSpacing: 3,
                  fontWeight: FontWeight.bold,
                  fontSize: 13),
            ),
            const SizedBox(height: 12),
            Text(
              'Tap the button below to link a GitHub repository.\nKA-CHOW will clone, analyze, and index it.',
              textAlign: TextAlign.center,
              style: TextStyle(
                  fontSize: 12,
                  color: Colors.white.withValues(alpha: 0.3),
                  height: 1.6),
            ),
            const SizedBox(height: 32),
            ElevatedButton.icon(
              style: ElevatedButton.styleFrom(
                  backgroundColor: AppColors.primary,
                  foregroundColor: Colors.black),
              onPressed: () => _showImportSheet(context, ref),
              icon: const Icon(Icons.add_link_rounded, size: 18),
              label: const Text('LINK A REPO'),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildError(BuildContext context, WidgetRef ref, String error) {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          const Icon(Icons.cloud_off_outlined,
              size: 64, color: AppColors.neonPink),
          const SizedBox(height: 16),
          const Text('UPLINK FAILED',
              style: TextStyle(
                  color: Colors.white54,
                  letterSpacing: 3,
                  fontWeight: FontWeight.bold)),
          const SizedBox(height: 8),
          Text('Backend unreachable.\nMake sure uvicorn is running.',
              textAlign: TextAlign.center,
              style: TextStyle(
                  fontSize: 12,
                  color: Colors.white.withValues(alpha: 0.35),
                  height: 1.5)),
          const SizedBox(height: 24),
          ElevatedButton.icon(
            style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.primary,
                foregroundColor: Colors.black),
            onPressed: () => ref.invalidate(storeReposProvider),
            icon: const Icon(Icons.refresh, size: 16),
            label: const Text('RETRY'),
          ),
        ],
      ),
    );
  }

  void _showImportSheet(BuildContext context, WidgetRef ref) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => ImportRepoSheet(
        onSuccess: () {
          ref.invalidate(storeReposProvider);
          ref.read(importRepoProvider.notifier).reset();
        },
      ),
    );
  }

  String _formatDate(String iso) {
    try {
      final dt = DateTime.parse(iso).toLocal();
      final months = [
        '', 'Jan','Feb','Mar','Apr','May','Jun',
        'Jul','Aug','Sep','Oct','Nov','Dec'
      ];
      return '${dt.day} ${months[dt.month]}';
    } catch (_) {
      return iso.split('T').first;
    }
  }
}

// ── Import Repo Bottom Sheet ──────────────────────────────────────────────────

class ImportRepoSheet extends ConsumerStatefulWidget {
  final VoidCallback onSuccess;
  const ImportRepoSheet({super.key, required this.onSuccess});

  @override
  ConsumerState<ImportRepoSheet> createState() => _ImportRepoSheetState();
}

class _ImportRepoSheetState extends ConsumerState<ImportRepoSheet> {
  final _urlController = TextEditingController();
  final _branchController = TextEditingController(text: 'main');

  @override
  void dispose() {
    _urlController.dispose();
    _branchController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final importState = ref.watch(importRepoProvider);
    final isLoading = importState.status == ImportStatus.loading;
    final isDone = importState.status == ImportStatus.success;

    ref.listen(importRepoProvider, (previous, next) {
      if (next.status == ImportStatus.success) {
        widget.onSuccess();
        Future.delayed(const Duration(seconds: 1), () {
          if (mounted) Navigator.of(context).pop();
        });
      }
    });

    return Padding(
      padding: EdgeInsets.only(
          bottom: MediaQuery.of(context).viewInsets.bottom),
      child: Container(
        decoration: BoxDecoration(
          color: AppColors.surface,
          borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
          border: Border(
              top: BorderSide(
                  color: AppColors.primary.withValues(alpha: 0.3), width: 1)),
        ),
        padding: const EdgeInsets.fromLTRB(24, 16, 24, 40),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Handle
            Center(
              child: Container(
                width: 40,
                height: 4,
                decoration: BoxDecoration(
                  color: Colors.white24,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
            ),
            const SizedBox(height: 24),
            Text(
              'LINK A REPOSITORY',
              style: GoogleFonts.orbitron(
                  color: AppColors.primary,
                  fontWeight: FontWeight.bold,
                  letterSpacing: 2,
                  fontSize: 14),
            ),
            const SizedBox(height: 6),
            Text(
              'KA-CHOW will clone, analyze, and index the repo.',
              style: TextStyle(
                  fontSize: 12, color: Colors.white.withValues(alpha: 0.45)),
            ),
            const SizedBox(height: 24),
            _buildField(
              controller: _urlController,
              label: 'GitHub URL',
              hint: 'https://github.com/owner/repo',
              icon: Icons.link,
              inputType: TextInputType.url,
            ),
            const SizedBox(height: 16),
            _buildField(
              controller: _branchController,
              label: 'Branch',
              hint: 'main',
              icon: Icons.account_tree_outlined,
            ),
            const SizedBox(height: 28),

            // Status feedback
            if (importState.status != ImportStatus.idle) ...[
              AnimatedContainer(
                duration: const Duration(milliseconds: 300),
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: _statusColor(importState.status).withValues(alpha: 0.08),
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(
                      color: _statusColor(importState.status).withValues(alpha: 0.3)),
                ),
                child: Row(
                  children: [
                    if (isLoading)
                      const SizedBox(
                        width: 14,
                        height: 14,
                        child: CircularProgressIndicator(
                            strokeWidth: 2, color: AppColors.primary),
                      )
                    else
                      Icon(_statusIcon(importState.status),
                          color: _statusColor(importState.status), size: 16),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Text(
                        importState.message,
                        style: TextStyle(
                            color: _statusColor(importState.status),
                            fontSize: 12),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 16),
            ],

            SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                style: ElevatedButton.styleFrom(
                  backgroundColor: isDone ? AppColors.neonGreen : AppColors.primary,
                  foregroundColor: Colors.black,
                  padding: const EdgeInsets.symmetric(vertical: 16),
                  shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12)),
                ),
                onPressed: isLoading || isDone
                    ? null
                    : () => ref.read(importRepoProvider.notifier).importRepo(
                          _urlController.text,
                          _branchController.text,
                          ref,
                        ),
                child: isLoading
                    ? const Text('ANALYZING REPO…')
                    : isDone
                        ? const Text('✓ IMPORT COMPLETE')
                        : const Text('IMPORT & ANALYZE'),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildField({
    required TextEditingController controller,
    required String label,
    required String hint,
    required IconData icon,
    TextInputType inputType = TextInputType.text,
  }) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label,
            style: const TextStyle(
                color: Colors.white54,
                fontSize: 11,
                fontWeight: FontWeight.bold,
                letterSpacing: 1)),
        const SizedBox(height: 8),
        Container(
          decoration: BoxDecoration(
            color: AppColors.glassWhite,
            borderRadius: BorderRadius.circular(10),
            border: Border.all(color: AppColors.glassBorder),
          ),
          child: TextField(
            controller: controller,
            style: const TextStyle(color: Colors.white, fontSize: 14),
            keyboardType: inputType,
            autocorrect: false,
            decoration: InputDecoration(
              hintText: hint,
              hintStyle:
                  TextStyle(color: Colors.white.withValues(alpha: 0.25), fontSize: 13),
              prefixIcon: Icon(icon, color: AppColors.primary, size: 18),
              border: InputBorder.none,
              contentPadding:
                  const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
            ),
          ),
        ),
      ],
    );
  }

  Color _statusColor(ImportStatus s) {
    switch (s) {
      case ImportStatus.loading:
        return AppColors.primary;
      case ImportStatus.success:
        return AppColors.neonGreen;
      case ImportStatus.error:
        return AppColors.neonPink;
      default:
        return Colors.white54;
    }
  }

  IconData _statusIcon(ImportStatus s) {
    switch (s) {
      case ImportStatus.success:
        return Icons.check_circle_outline;
      case ImportStatus.error:
        return Icons.error_outline;
      default:
        return Icons.info_outline;
    }
  }
}
