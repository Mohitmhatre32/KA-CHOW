class Alert {
  final int id;
  final String timestamp;
  final String title;
  final String message;
  final String severity;
  final bool read;

  Alert({
    required this.id,
    required this.timestamp,
    required this.title,
    required this.message,
    required this.severity,
    required this.read,
  });

  factory Alert.fromJson(Map<String, dynamic> json) {
    return Alert(
      id: json['id'],
      timestamp: json['timestamp'],
      title: json['title'],
      message: json['message'],
      severity: json['severity'],
      read: json['read'] ?? false,
    );
  }
}
