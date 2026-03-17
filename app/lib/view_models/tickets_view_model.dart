import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod/legacy.dart';
import '../models/ticket.dart';
import '../services/api_service.dart';

final ticketsProvider = StateNotifierProvider<TicketsViewModel, AsyncValue<List<Ticket>>>((ref) {
  return TicketsViewModel(ApiService());
});

final ticketAnalyticsProvider = FutureProvider<TicketAnalytics>((ref) async {
  final apiService = ApiService();
  final response = await apiService.get('/api/mobile/analytics/tickets');
  return TicketAnalytics.fromJson(response.data);
});

class TicketsViewModel extends StateNotifier<AsyncValue<List<Ticket>>> {
  final ApiService _apiService;

  TicketsViewModel(this._apiService) : super(const AsyncValue.loading());

  Future<void> fetchTickets(String projectName) async {
    state = const AsyncValue.loading();
    try {
      final response = await _apiService.get('/api/tasks/${Uri.encodeComponent(projectName)}');
      final List<dynamic> data = response.data;
      final tickets = data.map((json) => Ticket(
        id: json['id'],
        title: json['title'],
        description: json['project_name'] ?? '', // Store project name here
        status: json['status'] == 'resolved' ? 'Closed' : 'Open',
        priority: 'Medium', // Defaulting as backend doesn't store priority currently
        createdAt: 'Just now',
        assignee: 'Mobile App',
      )).toList();
      state = AsyncValue.data(tickets);
    } catch (e, stack) {
      state = AsyncValue.error(e, stack);
    }
  }

  Future<void> closeTicket(String ticketId, String projectName) async {
    try {
      await _apiService.post('/api/tasks/$ticketId/close');
      fetchTickets(projectName);
    } catch (e) {
      // Handle error
    }
  }
  
  Future<void> createTicket(String projectName, String title, String description, {String priority = 'Medium'}) async {
    try {
      await _apiService.post('/api/tasks/create', data: {
        'project_name': projectName,
        'description': '$title - $description',
      });
      fetchTickets(projectName);
    } catch (e) {
      // Handle error
    }
  }
}
