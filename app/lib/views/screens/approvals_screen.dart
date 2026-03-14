import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/constants.dart';
import '../../view_models/workflow_view_model.dart';
import '../widgets/glass_card.dart';
import '../widgets/cyber_button.dart';

class ApprovalsScreen extends ConsumerWidget {
  const ApprovalsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final approvalsAsync = ref.watch(approvalsViewModelProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('CRITICAL APPROVALS')),
      body: Container(
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [AppColors.background, AppColors.surface],
          ),
        ),
        child: approvalsAsync.when(
          data: (approvals) => approvals.isEmpty
              ? const Center(child: Text('No pending approvals.'))
              : ListView.builder(
                  padding: const EdgeInsets.all(16),
                  itemCount: approvals.length,
                  itemBuilder: (context, index) {
                    final item = approvals[index];
                    return _buildApprovalCard(context, ref, item);
                  },
                ),
          loading: () => const Center(child: CircularProgressIndicator(color: AppColors.accent)),
          error: (err, _) => Center(child: Text('Error: $err')),
        ),
      ),
    );
  }

  Widget _buildApprovalCard(BuildContext context, WidgetRef ref, Map<String, dynamic> item) {
    final severityColor = item['severity'] == 'High' ? Colors.redAccent : Colors.orangeAccent;

    return Padding(
      padding: const EdgeInsets.only(bottom: 16),
      child: GlassCard(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  decoration: BoxDecoration(
                    color: severityColor.withOpacity(0.2),
                    borderRadius: BorderRadius.circular(4),
                    border: Border.all(color: severityColor),
                  ),
                  child: Text(
                    item['severity'].toUpperCase(),
                    style: TextStyle(color: severityColor, fontSize: 10, fontWeight: FontWeight.bold),
                  ),
                ),
                const Spacer(),
                Text(item['requester'], style: const TextStyle(fontSize: 12, color: Colors.white54)),
              ],
            ),
            const SizedBox(height: 12),
            Text(
              item['title'],
              style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 8),
            Text(
              item['description'],
              style: const TextStyle(color: Colors.white70, fontSize: 14),
            ),
            const SizedBox(height: 20),
            Row(
              children: [
                Expanded(
                  child: OutlinedButton(
                    onPressed: () => ref.read(approvalsViewModelProvider.notifier).decideApproval(item['id'], 'reject'),
                    style: OutlinedButton.styleFrom(foregroundColor: Colors.redAccent),
                    child: const Text('REJECT'),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: CyberButton(
                    text: 'APPROVE',
                    color: Colors.greenAccent,
                    onPressed: () => ref.read(approvalsViewModelProvider.notifier).decideApproval(item['id'], 'approve'),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
