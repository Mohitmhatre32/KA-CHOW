import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../core/constants.dart';
import '../../view_models/alerts_view_model.dart';
import '../widgets/glass_card.dart';
import '../widgets/mesh_background.dart';

class AlertsScreen extends ConsumerWidget {
  const AlertsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final alertsAsync = ref.watch(alertsViewModelProvider);

    return Scaffold(
      extendBodyBehindAppBar: true,
      appBar: AppBar(
        title: Text(
          'ALERTS FEED',
          style: GoogleFonts.orbitron(fontSize: 16, fontWeight: FontWeight.bold, letterSpacing: 2),
        ),
        centerTitle: true,
        backgroundColor: Colors.transparent,
        actions: [
          IconButton(
            icon: const Icon(Icons.done_all, color: AppColors.primary),
            onPressed: () => ref.read(alertsViewModelProvider.notifier).markAllAsRead(),
          ),
        ],
      ),
      body: MeshBackground(
        child: alertsAsync.when(
          data: (alerts) => alerts.isEmpty
              ? _buildEmptyState()
              : ListView.builder(
                  padding: const EdgeInsets.fromLTRB(20, 120, 20, 100),
                  itemCount: alerts.length,
                  itemBuilder: (context, index) {
                    final alert = alerts[index];
                    return _buildAlertCard(ref, alert);
                  },
                ),
          loading: () => const Center(child: CircularProgressIndicator(color: AppColors.primary)),
          error: (err, stack) => Center(child: Text('Uplink Error: $err')),
        ),
      ),
    );
  }

  Widget _buildEmptyState() {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(Icons.notifications_off_outlined, color: Colors.white10, size: 80),
          const SizedBox(height: 16),
          const Text(
            'SYSTEM CALM',
            style: TextStyle(color: Colors.white24, letterSpacing: 4, fontWeight: FontWeight.bold),
          ),
        ],
      ),
    );
  }

  Widget _buildAlertCard(WidgetRef ref, alert) {
    Color severityColor;
    IconData icon;

    switch (alert.severity.toLowerCase()) {
      case 'critical':
        severityColor = AppColors.neonPink;
        icon = Icons.gpp_maybe_outlined;
        break;
      case 'warning':
        severityColor = AppColors.neonOrange;
        icon = Icons.warning_amber_rounded;
        break;
      case 'success':
        severityColor = AppColors.neonGreen;
        icon = Icons.check_circle_outline_rounded;
        break;
      default:
        severityColor = AppColors.neonCyan;
        icon = Icons.info_outline_rounded;
    }

    return Padding(
      padding: const EdgeInsets.only(bottom: 16.0),
      child: Stack(
        children: [
          GestureDetector(
            onTap: () => ref.read(alertsViewModelProvider.notifier).markAsRead(alert.id),
            child: GlassCard(
              padding: const EdgeInsets.all(20),
              glowColor: alert.read ? Colors.transparent : severityColor,
              child: Opacity(
                opacity: alert.read ? 0.5 : 1.0,
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Container(
                      padding: const EdgeInsets.all(10),
                      decoration: BoxDecoration(
                        color: severityColor.withValues(alpha: 0.1),
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: Icon(icon, color: severityColor, size: 24),
                    ),
                    const SizedBox(width: 16),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              Text(
                                alert.severity.toUpperCase(),
                                style: TextStyle(
                                  color: severityColor,
                                  fontSize: 10,
                                  fontWeight: FontWeight.w900,
                                  letterSpacing: 1,
                                ),
                              ),
                              Text(
                                alert.timestamp,
                                style: const TextStyle(color: Colors.white24, fontSize: 10),
                              ),
                            ],
                          ),
                          const SizedBox(height: 4),
                          Text(
                            alert.title,
                            style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: Colors.white),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            alert.message,
                            style: TextStyle(fontSize: 13, color: Colors.white.withValues(alpha: 0.7), height: 1.4),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
          if (!alert.read)
            Positioned(
              top: 12,
              right: 12,
              child: Container(
                width: 8,
                height: 8,
                decoration: BoxDecoration(
                  color: severityColor,
                  shape: BoxShape.circle,
                  boxShadow: [
                    BoxShadow(color: severityColor.withValues(alpha: 0.5), blurRadius: 4, spreadRadius: 1),
                  ],
                ),
              ),
            ),
        ],
      ),
    );
  }
}
