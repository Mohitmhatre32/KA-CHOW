import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../core/constants.dart';
import '../../view_models/dashboard_view_model.dart';
import '../widgets/glass_card.dart';
import '../widgets/mesh_background.dart';
import 'approvals_screen.dart';
import 'workflows_screen.dart';

class DashboardScreen extends ConsumerWidget {
  const DashboardScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final metricsAsync = ref.watch(dashboardViewModelProvider);

    return Scaffold(
      body: MeshBackground(
        child: metricsAsync.when(
          data: (metrics) => CustomScrollView(
            physics: const BouncingScrollPhysics(),
            slivers: [
              SliverAppBar(
                expandedHeight: 200,
                pinned: true,
                stretch: true,
                backgroundColor: Colors.transparent,
                title: Text(
                  'SYSTEM DASHBOARD',
                  style: GoogleFonts.orbitron(
                    fontSize: 16,
                    fontWeight: FontWeight.bold,
                    letterSpacing: 2,
                  ),
                ),
                centerTitle: true,
                flexibleSpace: FlexibleSpaceBar(
                  stretchModes: const [StretchMode.blurBackground, StretchMode.zoomBackground],
                  background: Center(
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        const SizedBox(height: 60),
                        Text(
                          'OPERATIONAL',
                          style: TextStyle(
                            color: AppColors.neonGreen.withValues(alpha: 0.8),
                            fontSize: 10,
                            letterSpacing: 2,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                        const SizedBox(height: 8),
                        Text(
                          '98.4%',
                          style: TextStyle(
                            fontSize: 48,
                            fontWeight: FontWeight.bold,
                            color: Colors.white,
                            shadows: [
                              Shadow(color: AppColors.primary.withValues(alpha: 0.5), blurRadius: 20),
                            ],
                          ),
                        ),
                        const Text(
                          'SYSTEM HEALTH SCORE',
                          style: TextStyle(
                            fontSize: 10, 
                            color: Colors.white24, 
                            letterSpacing: 2,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
                actions: [
                  IconButton(
                    icon: const Icon(Icons.refresh, color: AppColors.primary),
                    onPressed: () => ref.read(dashboardViewModelProvider.notifier).refreshMetrics(),
                  ),
                ],
              ),
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.all(20),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      _buildSectionHeader('METRIC OVERVIEW'),
                      const SizedBox(height: 16),
                      _buildProgressMetrics(context, metrics),
                      const SizedBox(height: 32),
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          _buildSectionHeader('ACTIVE AGENTS'),
                          TextButton(
                            onPressed: () => Navigator.of(context).push(
                              MaterialPageRoute(builder: (context) => const WorkflowsScreen()),
                            ),
                            child: const Text('MANAGE', style: TextStyle(fontSize: 10, color: AppColors.primary)),
                          ),
                        ],
                      ),
                      const SizedBox(height: 12),
                      ...metrics.activeWorkflows.take(3).map((wf) => _buildWorkflowItem(context, wf)),
                      if (metrics.activeWorkflows.isEmpty)
                        const GlassCard(
                          child: Center(child: Text('No active processes.', style: TextStyle(color: Colors.white38))),
                        ),
                      const SizedBox(height: 100),
                    ],
                  ),
                ),
              ),
            ],
          ),
          loading: () => const Center(child: CircularProgressIndicator(color: AppColors.primary)),
          error: (err, stack) => Center(
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                const Icon(Icons.error_outline, color: AppColors.neonPink, size: 64),
                const SizedBox(height: 16),
                Text('UPLINK FAILED: $err', textAlign: TextAlign.center, style: const TextStyle(fontWeight: FontWeight.bold)),
                const SizedBox(height: 24),
                ElevatedButton(
                  style: ElevatedButton.styleFrom(backgroundColor: AppColors.primary, foregroundColor: Colors.black),
                  onPressed: () => ref.read(dashboardViewModelProvider.notifier).refreshMetrics(),
                  child: const Text('RETRY SYNC'),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildSectionHeader(String title) {
    return Row(
      children: [
        Container(
          width: 4,
          height: 16,
          decoration: BoxDecoration(
            color: AppColors.primary,
            borderRadius: BorderRadius.circular(2),
          ),
        ),
        const SizedBox(width: 8),
        Text(
          title,
          style: const TextStyle(
            fontSize: 12,
            fontWeight: FontWeight.w900,
            letterSpacing: 2.0,
            color: Colors.white,
          ),
        ),
      ],
    );
  }

  Widget _buildProgressMetrics(BuildContext context, metrics) {
    return GridView.count(
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      crossAxisCount: 2,
      crossAxisSpacing: 16,
      mainAxisSpacing: 16,
      childAspectRatio: 1.1,
      children: [
        _buildMetricCard('TECH DEBT', '${metrics.technicalDebt}%', Icons.bolt, AppColors.neonOrange, () {}),
        _buildMetricCard('CODE QUALITY', '${metrics.codeQuality}%', Icons.shield_outlined, AppColors.neonCyan, () {}),
        _buildMetricCard('DOCS COVERAGE', '${metrics.documentationCoverage}%', Icons.layers_outlined, AppColors.neonPurple, () {}),
        _buildMetricCard('CRITICAL PRS', '${metrics.pendingCriticalChanges}', Icons.emergency_share_outlined, AppColors.neonPink, () {
          Navigator.of(context).push(MaterialPageRoute(builder: (context) => const ApprovalsScreen()));
        }),
      ],
    );
  }

  Widget _buildMetricCard(String label, String value, IconData icon, Color color, VoidCallback onTap) {
    return GestureDetector(
      onTap: onTap,
      child: GlassCard(
        padding: const EdgeInsets.all(16),
        glowColor: color,
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(
                color: color.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(8),
              ),
              child: Icon(icon, color: color, size: 20),
            ),
            const Spacer(),
            Text(
              value,
              style: const TextStyle(fontSize: 26, fontWeight: FontWeight.w900, color: Colors.white),
            ),
            const SizedBox(height: 4),
            Text(
              label,
              style: TextStyle(fontSize: 9, color: Colors.white.withValues(alpha: 0.4), letterSpacing: 1),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildWorkflowItem(BuildContext context, String workflow) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12.0),
      child: GestureDetector(
        onTap: () => Navigator.of(context).push(MaterialPageRoute(builder: (context) => const WorkflowsScreen())),
        child: GlassCard(
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
          child: Row(
            children: [
              Container(
                width: 12,
                height: 12,
                decoration: BoxDecoration(
                  color: AppColors.primary,
                  shape: BoxShape.circle,
                  boxShadow: [
                    BoxShadow(color: AppColors.primary.withValues(alpha: 0.5), blurRadius: 8, spreadRadius: 2),
                  ],
                ),
              ),
              const SizedBox(width: 20),
              Expanded(
                child: Text(
                  workflow,
                  style: const TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: Colors.white),
                ),
              ),
              const Icon(Icons.arrow_forward_ios, color: Colors.white24, size: 14),
            ],
          ),
        ),
      ),
    );
  }
}
