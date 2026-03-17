import 'package:app/core/constants.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'core/theme.dart';
import 'views/widgets/glass_card.dart';
import 'views/widgets/cyber_button.dart';
import 'views/widgets/mesh_background.dart';
import 'views/screens/project_selection_screen.dart';

void main() {
  runApp(
    const ProviderScope(
      child: MainApp(),
    ),
  );
}

class MainApp extends StatelessWidget {
  const MainApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'KA-CHOW',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.darkTheme,
      builder: (context, child) {
        return child!;
      },
      home: const WelcomeScreen(),
    );
  }
}

class WelcomeScreen extends StatelessWidget {
  const WelcomeScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: MeshBackground(
        child: Center(
          child: Padding(
            padding: const EdgeInsets.all(32.0),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Container(
                  padding: const EdgeInsets.all(20),
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    border: Border.all(color: AppColors.primary.withOpacity(0.2), width: 2),
                    boxShadow: [
                      BoxShadow(color: AppColors.primary.withOpacity(0.1), blurRadius: 40, spreadRadius: 10),
                    ],
                  ),
                  child: const Icon(Icons.bolt, color: AppColors.primary, size: 64),
                ),
                const SizedBox(height: 40),
                Text(
                  'KA-CHOW',
                  style: Theme.of(context).textTheme.displayLarge,
                ),
                const SizedBox(height: 12),
                Text(
                  'AUTONOMOUS ENGINEERING BRAIN',
                  style: TextStyle(
                    fontSize: 10,
                    letterSpacing: 4,
                    color: Colors.white.withOpacity(0.5),
                    fontWeight: FontWeight.bold,
                  ),
                ),
                const SizedBox(height: 60),
                GlassCard(
                  padding: const EdgeInsets.all(24),
                  child: Column(
                    children: [
                      const Text(
                        'UPLINK ACTIVE',
                        style: TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w900,
                          letterSpacing: 2,
                          color: AppColors.neonGreen,
                        ),
                      ),
                      const SizedBox(height: 16),
                      const Text(
                        'All engineering agents are live and analyzing your infrastructure patterns.',
                        textAlign: TextAlign.center,
                        style: TextStyle(color: Colors.white70, height: 1.5, fontSize: 13),
                      ),
                      const SizedBox(height: 32),
                      CyberButton(
                        text: 'INITIALIZE DASHBOARD',
                        onPressed: () {
                          Navigator.of(context).pushReplacement(
                            MaterialPageRoute(builder: (context) => const ProjectSelectionScreen()),
                          );
                        },
                        icon: Icons.rocket_launch_outlined,
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
