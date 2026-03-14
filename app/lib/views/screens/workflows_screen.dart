import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/constants.dart';
import '../../view_models/workflow_view_model.dart';
import '../widgets/glass_card.dart';

class WorkflowsScreen extends ConsumerWidget {
  const WorkflowsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final workflowsAsync = ref.watch(workflowViewModelProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('ENGINEERING WORKFLOWS')),
      body: Container(
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [AppColors.background, AppColors.surface],
          ),
        ),
        child: workflowsAsync.when(
          data: (workflows) => ListView.builder(
            padding: const EdgeInsets.all(16),
            itemCount: workflows.length,
            itemBuilder: (context, index) {
              final wf = workflows[index];
              return _buildWorkflowCard(ref, wf);
            },
          ),
          loading: () => const Center(child: CircularProgressIndicator(color: AppColors.accent)),
          error: (err, _) => Center(child: Text('Error: $err')),
        ),
      ),
    );
  }

  Widget _buildWorkflowCard(WidgetRef ref, Map<String, dynamic> wf) {
    final statusColor = wf['status'] == 'Running' ? Colors.greenAccent : Colors.amberAccent;

    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: GlassCard(
        child: Row(
          children: [
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  wf['name'],
                  style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
                ),
                const SizedBox(height: 4),
                Row(
                  children: [
                    Container(
                      width: 8,
                      height: 8,
                      decoration: BoxDecoration(color: statusColor, shape: BoxShape.circle),
                    ),
                    const SizedBox(width: 8),
                    Text(wf['status'].toUpperCase(), style: TextStyle(color: statusColor, fontSize: 10)),
                    const SizedBox(width: 12),
                    Text(wf['agent'], style: const TextStyle(color: Colors.white38, fontSize: 10)),
                  ],
                ),
              ],
            ),
            const Spacer(),
            IconButton(
              icon: Icon(wf['status'] == 'Running' ? Icons.stop_circle_outlined : Icons.play_arrow_rounded),
              onPressed: () {
                final action = wf['status'] == 'Running' ? 'stop' : 'start';
                ref.read(workflowViewModelProvider.notifier).controlWorkflow(wf['id'], action);
              },
              color: AppColors.accent,
            ),
          ],
        ),
      ),
    );
  }
}
