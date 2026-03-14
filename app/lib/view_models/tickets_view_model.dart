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

  TicketsViewModel(this._apiService) : super(const AsyncValue.loading()) {
    fetchTickets();
  }

  Future<void> fetchTickets() async {
    state = const AsyncValue.loading();
    try {
      final response = await _apiService.get('/api/mobile/tickets');
      final List<dynamic> data = response.data;
      final tickets = data.map((json) => Ticket.fromJson(json)).toList();
      state = AsyncValue.data(tickets);
    } catch (e, stack) {
      state = AsyncValue.error(e, stack);
    }
  }

  Future<void> closeTicket(String ticketId) async {
    try {
      await _apiService.post('/api/mobile/tickets/$ticketId/close');
      fetchTickets();
    } catch (e) {
      // Handle error
    }
  }
  
  Future<void> createTicket(String title, String description, {String priority = 'Medium'}) async {
    try {
      await _apiService.post('/api/mobile/tickets', data: {
        'title': title,
        'description': description,
        'priority': priority,
      });
      fetchTickets();
    } catch (e) {
      // Handle error
    }
  }
}
