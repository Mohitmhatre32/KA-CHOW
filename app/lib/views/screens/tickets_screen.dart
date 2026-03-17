import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../core/constants.dart';
import '../../models/ticket.dart';
import '../../view_models/tickets_view_model.dart';
import '../widgets/glass_card.dart';
import '../widgets/mesh_background.dart';
import '../widgets/create_ticket_sheet.dart';

class TicketManagementScreen extends ConsumerWidget {
  const TicketManagementScreen({super.key});

  void _showCreateTicketSheet(BuildContext context, WidgetRef ref) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) => CreateTicketSheet(
        onCreate: (title, description, priority) {
          ref.read(ticketsProvider.notifier).createTicket(title, description, priority: priority);
        },
      ),
    );
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final ticketsAsync = ref.watch(ticketsProvider);
    final analyticsAsync = ref.watch(ticketAnalyticsProvider);

    return Scaffold(
      extendBodyBehindAppBar: true,
      appBar: AppBar(
        title: Text(
          'TICKET ENGINE',
          style: GoogleFonts.orbitron(fontSize: 16, fontWeight: FontWeight.bold, letterSpacing: 2),
        ),
        centerTitle: true,
        backgroundColor: Colors.transparent,
      ),
      floatingActionButton: Container(
        margin: const EdgeInsets.only(bottom: 20, right: 10),
        child: FloatingActionButton(
          onPressed: () => _showCreateTicketSheet(context, ref),
          backgroundColor: AppColors.primary,
          foregroundColor: Colors.black,
          elevation: 10,
          shape: const CircleBorder(),
          child: const Icon(Icons.add_rounded, size: 32),
        ),
      ),
      body: MeshBackground(
        child: CustomScrollView(
          slivers: [
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(20, 120, 20, 20),
                child: analyticsAsync.when(
                  data: (analytics) => _buildAnalyticsRow(analytics),
                  loading: () => const Center(child: CircularProgressIndicator(color: AppColors.primary)),
                  error: (e, s) => const SizedBox.shrink(),
                ),
              ),
            ),
            ticketsAsync.when(
              data: (tickets) => SliverPadding(
                padding: const EdgeInsets.symmetric(horizontal: 20),
                sliver: SliverList(
                  delegate: SliverChildBuilderDelegate(
                    (context, index) => _buildTicketCard(ref, tickets[index]),
                    childCount: tickets.length,
                  ),
                ),
              ),
              loading: () => const SliverToBoxAdapter(child: Center(child: CircularProgressIndicator())),
              error: (e, s) => SliverToBoxAdapter(child: Center(child: Text('Error: $e'))),
            ),
            const SliverToBoxAdapter(child: SizedBox(height: 100)),
          ],
        ),
      ),
    );
  }

  Widget _buildAnalyticsRow(TicketAnalytics analytics) {
    return Row(
      children: [
        Expanded(child: _buildMiniStat('OPEN', analytics.open.toString(), AppColors.neonCyan)),
        const SizedBox(width: 12),
        Expanded(child: _buildMiniStat('PROGRESS', analytics.inProgress.toString(), AppColors.neonPurple)),
        const SizedBox(width: 12),
        Expanded(child: _buildMiniStat('VELOCITY', '${(analytics.velocity * 100).toInt()}%', AppColors.neonGreen)),
      ],
    );
  }

  Widget _buildMiniStat(String label, String value, Color color) {
    return GlassCard(
      padding: const EdgeInsets.all(16),
      glowColor: color,
      child: Column(
        children: [
          Text(label, style: TextStyle(color: Colors.white24, fontSize: 10, fontWeight: FontWeight.bold, letterSpacing: 1)),
          const SizedBox(height: 4),
          Text(value, style: GoogleFonts.orbitron(color: color, fontSize: 18, fontWeight: FontWeight.bold)),
        ],
      ),
    );
  }

  Widget _buildTicketCard(WidgetRef ref, Ticket ticket) {
    Color priorityColor;
    switch (ticket.priority.toLowerCase()) {
      case 'high': priorityColor = AppColors.neonPink; break;
      case 'medium': priorityColor = AppColors.neonOrange; break;
      default: priorityColor = AppColors.neonCyan;
    }

    return Padding(
      padding: const EdgeInsets.only(bottom: 16.0),
      child: GlassCard(
        padding: const EdgeInsets.all(20),
        glowColor: ticket.status == 'Closed' ? Colors.transparent : priorityColor,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  decoration: BoxDecoration(
                    color: priorityColor.withOpacity(0.1),
                    borderRadius: BorderRadius.circular(4),
                    border: Border.all(color: priorityColor.withOpacity(0.3)),
                  ),
                  child: Text(
                    ticket.id,
                    style: TextStyle(color: priorityColor, fontSize: 10, fontWeight: FontWeight.bold),
                  ),
                ),
                Text(ticket.createdAt, style: const TextStyle(color: Colors.white24, fontSize: 10)),
              ],
            ),
            const SizedBox(height: 12),
            Text(
              ticket.title,
              style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: Colors.white),
            ),
            const SizedBox(height: 8),
            Row(
              children: [
                Icon(Icons.person_outline, color: Colors.white38, size: 14),
                const SizedBox(width: 4),
                Text(ticket.assignee, style: const TextStyle(color: Colors.white38, fontSize: 12)),
                const Spacer(),
                if (ticket.status != 'Closed')
                  TextButton(
                    onPressed: () => ref.read(ticketsProvider.notifier).closeTicket(ticket.id),
                    child: Text('CLOSE', style: TextStyle(color: AppColors.neonGreen, fontWeight: FontWeight.bold, fontSize: 12)),
                  )
                else
                  const Text('COMPLETED', style: TextStyle(color: Colors.white12, fontWeight: FontWeight.bold, fontSize: 12)),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
