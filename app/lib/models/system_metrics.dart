class SystemMetrics {
  final double technicalDebt;
  final double codeQuality;
  final int documentationCoverage;
  final int pendingCriticalChanges;
  final List<String> activeWorkflows;

  SystemMetrics({
    required this.technicalDebt,
    required this.codeQuality,
    required this.documentationCoverage,
    required this.pendingCriticalChanges,
    required this.activeWorkflows,
  });

  factory SystemMetrics.fromJson(Map<String, dynamic> json) {
    return SystemMetrics(
      technicalDebt: (json['technical_debt'] ?? 0.0).toDouble(),
      codeQuality: (json['code_quality'] ?? 0.0).toDouble(),
      documentationCoverage: json['documentation_coverage'] ?? 0,
      pendingCriticalChanges: json['pending_critical_changes'] ?? 0,
      activeWorkflows: List<String>.from(json['active_workflows'] ?? []),
    );
  }

  // Initial/Empty state
  factory SystemMetrics.empty() {
    return SystemMetrics(
      technicalDebt: 0.0,
      codeQuality: 0.0,
      documentationCoverage: 0,
      pendingCriticalChanges: 0,
      activeWorkflows: [],
    );
  }
}
