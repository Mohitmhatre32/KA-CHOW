import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../core/constants.dart';
import '../../view_models/store_view_model.dart';
import '../../view_models/tickets_view_model.dart';
import '../widgets/glass_card.dart';
import '../widgets/mesh_background.dart';
import '../widgets/create_ticket_sheet.dart';

class RepoDashboardScreen extends ConsumerWidget {
  final String repoName;
  final String projectName;

  const RepoDashboardScreen({
    super.key,
    required this.repoName,
    required this.projectName,
  });

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final dashboardAsync = ref.watch(repoDashboardProvider(repoName));

    return Scaffold(
      extendBodyBehindAppBar: true,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new, color: AppColors.primary),
          onPressed: () => Navigator.of(context).pop(),
        ),
        title: Column(
          children: [
            Text(
              projectName,
              style: GoogleFonts.orbitron(
                  fontSize: 13, fontWeight: FontWeight.bold, letterSpacing: 1),
              overflow: TextOverflow.ellipsis,
            ),
            Text(
              'REPO DASHBOARD',
              style: TextStyle(
                  fontSize: 9,
                  color: AppColors.primary.withValues(alpha: 0.7),
                  letterSpacing: 2),
            ),
          ],
        ),
        centerTitle: true,
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh, color: AppColors.primary),
            onPressed: () => ref.invalidate(repoDashboardProvider(repoName)),
            tooltip: 'Re-sync',
          ),
        ],
      ),
      floatingActionButton: Padding(
        padding: const EdgeInsets.only(bottom: 20, right: 8),
        child: FloatingActionButton(
          onPressed: () => _showCreateTicket(context, ref),
          backgroundColor: AppColors.primary,
          foregroundColor: Colors.black,
          elevation: 10,
          shape: const CircleBorder(),
          child: const Icon(Icons.add_rounded, size: 28),
        ),
      ),
      body: MeshBackground(
        child: dashboardAsync.when(
          data: (data) => data.containsKey('error')
              ? _buildError(context, ref, data['error'] as String)
              : _buildDashboard(context, ref, data),
          loading: () => const Center(
              child: CircularProgressIndicator(color: AppColors.primary)),
          error: (err, _) => _buildError(context, ref, err.toString()),
        ),
      ),
    );
  }

  Widget _buildDashboard(
      BuildContext context, WidgetRef ref, Map<String, dynamic> data) {
    final codeQuality = (data['code_quality'] as num? ?? 0.0).toDouble();
    final totalFiles = data['total_files'] as int? ?? 0;
    final branch = data['branch'] as String? ?? 'main';
    final processedAt = data['processed_at'] as String? ?? '';
    final commits = (data['commits'] as List<dynamic>?) ?? [];
    final topFiles = (data['top_files'] as List<dynamic>?) ?? [];

    return CustomScrollView(
      physics: const BouncingScrollPhysics(),
      slivers: [
        // ── Hero health bar ──────────────────────────────────────────────────
        SliverToBoxAdapter(
          child: Container(
            margin: const EdgeInsets.fromLTRB(16, 108, 16, 0),
            child: GlassCard(
              padding: const EdgeInsets.all(24),
              glowColor: _qualityColor(codeQuality).withValues(alpha: 0.3),
              child: Row(
                children: [
                  // Big ring
                  SizedBox(
                    width: 80,
                    height: 80,
                    child: Stack(
                      alignment: Alignment.center,
                      children: [
                        CircularProgressIndicator(
                          value: codeQuality / 100,
                          strokeWidth: 6,
                          backgroundColor:
                              _qualityColor(codeQuality).withValues(alpha: 0.1),
                          valueColor: AlwaysStoppedAnimation<Color>(
                              _qualityColor(codeQuality)),
                        ),
                        Text(
                          '${codeQuality.toInt()}%',
                          style: GoogleFonts.orbitron(
                              fontSize: 16,
                              fontWeight: FontWeight.bold,
                              color: Colors.white),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(width: 20),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text('CODE QUALITY',
                            style: TextStyle(
                                fontSize: 10,
                                color: Colors.white.withValues(alpha: 0.4),
                                letterSpacing: 1.5)),
                        const SizedBox(height: 4),
                        Text(
                          codeQuality >= 70
                              ? 'HEALTHY'
                              : codeQuality >= 40
                                  ? 'NEEDS ATTENTION'
                                  : 'CRITICAL',
                          style: GoogleFonts.orbitron(
                              fontSize: 14,
                              fontWeight: FontWeight.bold,
                              color: _qualityColor(codeQuality)),
                        ),
                        const SizedBox(height: 12),
                        _infoRow(Icons.insert_drive_file_outlined,
                            '$totalFiles files'),
                        const SizedBox(height: 4),
                        _infoRow(Icons.account_tree_outlined, branch),
                        if (processedAt.isNotEmpty) ...[
                          const SizedBox(height: 4),
                          _infoRow(Icons.schedule_outlined,
                              'Scanned ${_formatDate(processedAt)}'),
                        ],
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),

        // ── Commit history ───────────────────────────────────────────────────
        SliverToBoxAdapter(
          child: _sectionHeader('RECENT COMMITS', Icons.commit,
              '${commits.length}', AppColors.neonCyan),
        ),
        commits.isEmpty
            ? const SliverToBoxAdapter(
                child: Padding(
                  padding: EdgeInsets.symmetric(horizontal: 16),
                  child: GlassCard(
                    child: Center(
                      child: Text('No commits found.',
                          style: TextStyle(color: Colors.white38)),
                    ),
                  ),
                ),
              )
            : SliverPadding(
                padding: const EdgeInsets.symmetric(horizontal: 16),
                sliver: SliverList(
                  delegate: SliverChildBuilderDelegate(
                    (context, i) => _buildCommitTile(
                        commits[i] as Map<String, dynamic>),
                    childCount: commits.length,
                  ),
                ),
              ),

        // ── Top files ────────────────────────────────────────────────────────
        if (topFiles.isNotEmpty) ...[
          SliverToBoxAdapter(
            child: _sectionHeader('LARGEST FILES', Icons.code,
                '${topFiles.length}', AppColors.neonPurple),
          ),
          SliverPadding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            sliver: SliverList(
              delegate: SliverChildBuilderDelegate(
                (context, i) =>
                    _buildFileTile(topFiles[i] as Map<String, dynamic>),
                childCount: topFiles.length,
              ),
            ),
          ),
        ],

        const SliverToBoxAdapter(child: SizedBox(height: 120)),
      ],
    );
  }

  Widget _buildCommitTile(Map<String, dynamic> commit) {
    final type = commit['commit_type'] as String? ?? 'other';
    final color = _commitTypeColor(type);
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: GlassCard(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        child: Row(
          children: [
            Container(
              width: 6,
              height: 6,
              margin: const EdgeInsets.only(right: 12),
              decoration: BoxDecoration(color: color, shape: BoxShape.circle,
                  boxShadow: [BoxShadow(color: color.withValues(alpha: 0.5), blurRadius: 6)]),
            ),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    commit['message'] as String? ?? '',
                    style: const TextStyle(
                        color: Colors.white,
                        fontSize: 13,
                        fontWeight: FontWeight.w600),
                    overflow: TextOverflow.ellipsis,
                  ),
                  const SizedBox(height: 3),
                  Text(
                    '${commit['author'] ?? ''}  ·  ${commit['date'] ?? ''}',
                    style: TextStyle(
                        color: Colors.white.withValues(alpha: 0.35),
                        fontSize: 11),
                  ),
                ],
              ),
            ),
            Container(
              margin: const EdgeInsets.only(left: 8),
              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
              decoration: BoxDecoration(
                color: color.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(4),
                border: Border.all(color: color.withValues(alpha: 0.3)),
              ),
              child: Text(
                commit['hash'] as String? ?? '',
                style: GoogleFonts.firaCode(color: color, fontSize: 10),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildFileTile(Map<String, dynamic> file) {
    final sizeBytes = file['size_bytes'] as int? ?? 0;
    final sizeStr = sizeBytes > 1024
        ? '${(sizeBytes / 1024).toStringAsFixed(1)} KB'
        : '$sizeBytes B';
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: GlassCard(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        child: Row(
          children: [
            Icon(Icons.insert_drive_file_outlined,
                color: AppColors.neonPurple.withValues(alpha: 0.7), size: 16),
            const SizedBox(width: 12),
            Expanded(
              child: Text(
                file['name'] as String? ?? '',
                style: const TextStyle(color: Colors.white, fontSize: 13),
                overflow: TextOverflow.ellipsis,
              ),
            ),
            Text(sizeStr,
                style: TextStyle(
                    color: Colors.white.withValues(alpha: 0.4), fontSize: 11)),
            const SizedBox(width: 8),
            if ((file['language'] as String? ?? '').isNotEmpty)
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                decoration: BoxDecoration(
                  color: AppColors.neonPurple.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(4),
                ),
                child: Text(
                  file['language'] as String,
                  style: const TextStyle(
                      color: AppColors.neonPurple, fontSize: 9),
                ),
              ),
          ],
        ),
      ),
    );
  }

  Widget _sectionHeader(
      String title, IconData icon, String count, Color color) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 24, 20, 12),
      child: Row(
        children: [
          Container(
              width: 4,
              height: 16,
              decoration: BoxDecoration(
                  color: color, borderRadius: BorderRadius.circular(2))),
          const SizedBox(width: 8),
          Icon(icon, color: color, size: 14),
          const SizedBox(width: 6),
          Text(title,
              style: TextStyle(
                  fontSize: 11,
                  fontWeight: FontWeight.w900,
                  letterSpacing: 2,
                  color: Colors.white)),
          const Spacer(),
          Text(count,
              style: TextStyle(
                  fontSize: 11,
                  color: color.withValues(alpha: 0.7),
                  fontWeight: FontWeight.bold)),
        ],
      ),
    );
  }

  Widget _infoRow(IconData icon, String text) {
    return Row(
      children: [
        Icon(icon, size: 13, color: Colors.white38),
        const SizedBox(width: 6),
        Text(text,
            style:
                TextStyle(fontSize: 12, color: Colors.white.withValues(alpha: 0.5))),
      ],
    );
  }

  Widget _buildError(BuildContext context, WidgetRef ref, String error) {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          const Icon(Icons.error_outline, color: AppColors.neonPink, size: 48),
          const SizedBox(height: 16),
          Text(error,
              textAlign: TextAlign.center,
              style: const TextStyle(color: Colors.white38, fontSize: 12)),
          const SizedBox(height: 24),
          ElevatedButton(
            style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.primary,
                foregroundColor: Colors.black),
            onPressed: () => ref.invalidate(repoDashboardProvider(repoName)),
            child: const Text('RETRY'),
          ),
        ],
      ),
    );
  }

  void _showCreateTicket(BuildContext context, WidgetRef ref) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => CreateTicketSheet(
        onCreate: (title, description, priority) {
          // Create ticket and tag it with the repo name
          ref.read(ticketsProvider.notifier).createTicket(
                repoName,
                title,
                description,
                priority: priority,
              );
        },
      ),
    );
  }

  Color _qualityColor(double quality) {
    if (quality >= 70) return AppColors.neonGreen;
    if (quality >= 40) return AppColors.neonOrange;
    return AppColors.neonPink;
  }

  Color _commitTypeColor(String type) {
    switch (type.toLowerCase()) {
      case 'feat':
        return AppColors.neonCyan;
      case 'fix':
        return AppColors.neonGreen;
      case 'chore':
        return Colors.white38;
      case 'docs':
        return AppColors.neonPurple;
      case 'refactor':
        return AppColors.neonOrange;
      default:
        return AppColors.primary;
    }
  }

  String _formatDate(String iso) {
    try {
      final dt = DateTime.parse(iso).toLocal();
      final months = [
        '', 'Jan','Feb','Mar','Apr','May','Jun',
        'Jul','Aug','Sep','Oct','Nov','Dec'
      ];
      return '${dt.day} ${months[dt.month]} ${dt.year}';
    } catch (_) {
      return iso.split('T').first;
    }
  }
}
