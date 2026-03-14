import 'package:flutter/material.dart';
import '../../core/constants.dart';

class MeshBackground extends StatelessWidget {
  final Widget child;

  const MeshBackground({super.key, required this.child});

  @override
  Widget build(BuildContext context) {
    return Stack(
      children: [
        Container(color: AppColors.background),
        Positioned(
          top: -100,
          right: -100,
          child: _GlowCircle(color: AppColors.primary.withValues(alpha: 0.15), size: 300),
        ),
        Positioned(
          bottom: -50,
          left: -50,
          child: _GlowCircle(color: AppColors.accent.withValues(alpha: 0.1), size: 250),
        ),
        child,
      ],
    );
  }
}

class _GlowCircle extends StatelessWidget {
  final Color color;
  final double size;

  const _GlowCircle({required this.color, required this.size});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        boxShadow: [
          BoxShadow(
            color: color,
            blurRadius: 100,
            spreadRadius: 50,
          ),
        ],
      ),
    );
  }
}
