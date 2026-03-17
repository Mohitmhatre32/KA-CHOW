class Ticket {
  final String id;
  final String title;
  final String description;
  final String status;
  final String priority;
  final String assignee;
  final String createdAt;

  Ticket({
    required this.id,
    required this.title,
    required this.description,
    required this.status,
    required this.priority,
    required this.assignee,
    required this.createdAt,
  });

  factory Ticket.fromJson(Map<String, dynamic> json) {
    return Ticket(
      id: json['id'],
      title: json['title'],
      description: json['description'] ?? '',
      status: json['status'],
      priority: json['priority'],
      assignee: json['assignee'],
      createdAt: json['created_at'],
    );
  }
}

class TicketAnalytics {
  final int open;
  final int inProgress;
  final int closedToday;
  final double velocity;

  TicketAnalytics({
    required this.open,
    required this.inProgress,
    required this.closedToday,
    required this.velocity,
  });

  factory TicketAnalytics.fromJson(Map<String, dynamic> json) {
    return TicketAnalytics(
      open: json['open'],
      inProgress: json['in_progress'],
      closedToday: json['closed_today'],
      velocity: (json['velocity'] as num).toDouble(),
    );
  }
}
