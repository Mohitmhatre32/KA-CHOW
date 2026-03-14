enum MessageType { user, bot }

class ChatMessage {
  final String content;
  final MessageType type;
  final DateTime timestamp;

  ChatMessage({
    required this.content,
    required this.type,
    required this.timestamp,
  });
}

class MentorResponse {
  final String answer;
  final List<String> sources;

  MentorResponse({
    required this.answer,
    required this.sources,
  });

  factory MentorResponse.fromJson(Map<String, dynamic> json) {
    return MentorResponse(
      answer: json['answer'],
      sources: List<String>.from(json['sources'] ?? []),
    );
  }
}
