import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';

class AppConstants {
  static const String appName = 'KA-CHOW';
  static String get baseUrl => kIsWeb ? 'http://localhost:8000' : 'http://10.0.2.2:8000';
  
  // API Endpoints
  static const String metricsEndpoint = '/api/mobile/status';
  static const String chatEndpoint = '/api/v1/mentor/chat';
  static const String alertsEndpoint = '/api/alerts';
  
  // Padding & Spacing
  static const double defaultPadding = 16.0;
  static const double borderRadius = 20.0;
}

class AppColors {
  static const Color background = Color(0xFF020205); // Deep space black
  static const Color surface = Color(0xFF0A0A1F);    // Darkest navy
  static const Color primary = Color(0xFF00F2FF);    // Hyper Cyan
  static const Color accent = Color(0xFF7000FF);     // Deep Electric Purple
  
  static const Color neonCyan = Color(0xFF00F2FF);
  static const Color neonPink = Color(0xFFFF0080);
  static const Color neonPurple = Color(0xFF9100FF);
  static const Color neonGreen = Color(0xFF39FF14);
  static const Color neonOrange = Color(0xFFFFAC1C);
  
  static const Color glassWhite = Color(0x0DFFFFFF); // 5% white for better transparency
  static const Color glassBorder = Color(0x26FFFFFF); // 15% white
  static const Color glassGlow = Color(0x1A00F2FF);  // Subtle cyan glow
}
