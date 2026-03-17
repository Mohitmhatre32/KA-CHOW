import 'package:flutter_riverpod/legacy.dart';
import '../core/constants.dart';
import '../models/chat.dart';
import '../services/api_service.dart';

final chatViewModelProvider = StateNotifierProvider<ChatViewModel, ChatState>((ref) {
  return ChatViewModel(ApiService());
});

class ChatState {
  final List<ChatMessage> messages;
  final bool isLoading;

  ChatState({required this.messages, this.isLoading = false});

  ChatState copyWith({List<ChatMessage>? messages, bool? isLoading}) {
    return ChatState(
      messages: messages ?? this.messages,
      isLoading: isLoading ?? this.isLoading,
    );
  }
}

class ChatViewModel extends StateNotifier<ChatState> {
  final ApiService _apiService;

  ChatViewModel(this._apiService) : super(ChatState(messages: []));

  Future<void> sendMessage(String text) async {
    if (text.trim().isEmpty) return;

    final userMessage = ChatMessage(
      content: text,
      type: MessageType.user,
      timestamp: DateTime.now(),
    );

    state = state.copyWith(
      messages: [...state.messages, userMessage],
      isLoading: true,
    );

    try {
      // Detect ticket-creation intent
      final isTicketIntent = text.toLowerCase().contains('create ticket') ||
          text.toLowerCase().contains('new ticket');

      // Use the correct Mentor endpoint with proper field names
      final response = await _apiService.post(
        AppConstants.chatEndpoint,
        data: {
          'question': text,
          'user_role': 'developer',
          'repo_url': '',
        },
      );

      final mentorResponse = MentorResponse.fromJson(response.data);
      String answer = mentorResponse.answer;

      if (isTicketIntent) {
        answer += "\n\n**[SYSTEM]** I have autonomously created a new ticket based on our discussion. You can track it in the **TICKETS** engine.";
        // Trigger actual ticket creation in backend
        await _apiService.post('/api/mobile/tickets', data: {
          'title': text.replaceAll(RegExp(r'(create|new) ticket', caseSensitive: false), '').trim(),
          'description': 'Created via AI Chat: $text',
          'priority': 'Medium',
        });
      }
      
      final botMessage = ChatMessage(
        content: answer,
        type: MessageType.bot,
        timestamp: DateTime.now(),
      );

      state = state.copyWith(
        messages: [...state.messages, botMessage],
        isLoading: false,
      );
    } catch (e) {
      final errorMessage = ChatMessage(
        content: 'Uplink interrupted. Error: ${e.toString()}',
        type: MessageType.bot,
        timestamp: DateTime.now(),
      );
      state = state.copyWith(
        messages: [...state.messages, errorMessage],
        isLoading: false,
      );
    }
  }
}
