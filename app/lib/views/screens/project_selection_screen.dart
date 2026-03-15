import 'package:flutter/material.dart';
import '../../core/constants.dart';
import '../widgets/glass_card.dart';
import '../widgets/mesh_background.dart';
import '../navigation_shell.dart';

class ProjectSelectionScreen extends StatelessWidget {
  const ProjectSelectionScreen({super.key});

  final List<Map<String, dynamic>> projects = const [
    {
      'name': 'KA-CHOW Core',
      'description': 'Main engineering agent processing core.',
      'status': 'ACTIVE',
      'icon': Icons.bolt,
      'color': AppColors.neonGreen,
    },
    {
      'name': 'Mobile Client (Alpha)',
      'description': 'Flutter-based autonomous interface.',
      'status': 'DEVELOPMENT',
      'icon': Icons.phone_android,
      'color': AppColors.neonCyan,
    },
    {
      'name': 'Backend API Services',
      'description': 'Python FastAPI orchestration layer.',
      'status': 'MAINTENANCE',
      'icon': Icons.api,
      'color': AppColors.neonPink,
    },
    {
      'name': 'Infrastructure Sync',
      'description': 'Terraform module deployment configs.',
      'status': 'PAUSED',
      'icon': Icons.cloud_sync,
      'color': AppColors.neonOrange,
    },
  ];

  @override
  Widget build(BuildContext context) {
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
                      'Choose an active project directory to initialize the diagnostic dashboard.',
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
                child: ListView.builder(
                  padding: const EdgeInsets.symmetric(horizontal: 16.0),
                  physics: const BouncingScrollPhysics(),
                  itemCount: projects.length,
                  itemBuilder: (context, index) {
                    final project = projects[index];
                    return Padding(
                      padding: const EdgeInsets.only(bottom: 16.0),
                      child: _buildProjectCard(context, project),
                    );
                  },
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildProjectCard(BuildContext context, Map<String, dynamic> project) {
    final Color projColor = project['color'] as Color;
    
    return GestureDetector(
      onTap: () {
        // Navigate to the main dashboard
        Navigator.of(context).pushReplacement(
          MaterialPageRoute(builder: (context) => const MainNavigationShell()),
        );
      },
      child: GlassCard(
        padding: const EdgeInsets.all(20),
        glowColor: projColor.withValues(alpha: 0.3),
        child: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: projColor.withValues(alpha: 0.1),
                shape: BoxShape.circle,
                border: Border.all(color: projColor.withValues(alpha: 0.3), width: 1),
              ),
              child: Icon(project['icon'] as IconData, color: projColor, size: 28),
            ),
            const SizedBox(width: 20),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    project['name'] as String,
                    style: const TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.bold,
                      color: Colors.white,
                      letterSpacing: 1,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    project['description'] as String,
                    style: TextStyle(
                      fontSize: 11,
                      color: Colors.white.withValues(alpha: 0.5),
                    ),
                  ),
                  const SizedBox(height: 8),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                    decoration: BoxDecoration(
                      color: projColor.withValues(alpha: 0.1),
                      borderRadius: BorderRadius.circular(4),
                      border: Border.all(color: projColor.withValues(alpha: 0.2)),
                    ),
                    child: Text(
                      project['status'] as String,
                      style: TextStyle(
                        fontSize: 9,
                        fontWeight: FontWeight.w900,
                        letterSpacing: 1.5,
                        color: projColor,
                      ),
                    ),
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
}
