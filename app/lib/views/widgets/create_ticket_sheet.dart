import 'package:flutter/material.dart';
import '../../core/constants.dart';
import 'glass_card.dart';
import 'cyber_button.dart';

class CreateTicketSheet extends StatefulWidget {
  final Function(String title, String description, String priority) onCreate;

  const CreateTicketSheet({super.key, required this.onCreate});

  @override
  State<CreateTicketSheet> createState() => _CreateTicketSheetState();
}

class _CreateTicketSheetState extends State<CreateTicketSheet> {
  final TextEditingController _titleController = TextEditingController();
  final TextEditingController _descController = TextEditingController();
  String _selectedPriority = 'Medium';

  final List<String> _priorities = ['Low', 'Medium', 'High'];

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: EdgeInsets.only(
        bottom: MediaQuery.of(context).viewInsets.bottom,
      ),
      decoration: const BoxDecoration(
        color: Colors.transparent,
      ),
      child: GlassCard(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'NEW ENGINEERING TICKET',
              style: TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.w900,
                letterSpacing: 2,
                color: AppColors.primary,
              ),
            ),
            const SizedBox(height: 24),
            _buildTextField('TITLE', _titleController, 'Brief summary of the issue'),
            const SizedBox(height: 16),
            _buildTextField('DESCRIPTION', _descController, 'Detailed technical context', maxLines: 3),
            const SizedBox(height: 24),
            const Text(
              'PRIORITY LEVEL',
              style: TextStyle(
                fontSize: 10,
                fontWeight: FontWeight.bold,
                letterSpacing: 1.5,
                color: Colors.white38,
              ),
            ),
            const SizedBox(height: 12),
            Row(
              children: _priorities.map((p) => _buildPriorityChip(p)).toList(),
            ),
            const SizedBox(height: 32),
            CyberButton(
              text: 'INITIALIZE TICKET',
              icon: Icons.add_task,
              onPressed: () {
                if (_titleController.text.isNotEmpty) {
                  widget.onCreate(
                    _titleController.text,
                    _descController.text,
                    _selectedPriority,
                  );
                  Navigator.pop(context);
                }
              },
            ),
            const SizedBox(height: 16),
          ],
        ),
      ),
    );
  }

  Widget _buildTextField(String label, TextEditingController controller, String hint, {int maxLines = 1}) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: const TextStyle(
            fontSize: 10,
            fontWeight: FontWeight.bold,
            letterSpacing: 1.5,
            color: Colors.white38,
          ),
        ),
        const SizedBox(height: 8),
        TextField(
          controller: controller,
          maxLines: maxLines,
          style: const TextStyle(color: Colors.white, fontSize: 14),
          decoration: InputDecoration(
            hintText: hint,
            hintStyle: const TextStyle(color: Colors.white12),
            filled: true,
            fillColor: Colors.black26,
            contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(8),
              borderSide: const BorderSide(color: Colors.white10),
            ),
            enabledBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(8),
              borderSide: const BorderSide(color: Colors.white10),
            ),
            focusedBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(8),
              borderSide: const BorderSide(color: AppColors.primary, width: 1),
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildPriorityChip(String priority) {
    bool isSelected = _selectedPriority == priority;
    Color color;
    switch (priority) {
      case 'High': color = AppColors.neonPink; break;
      case 'Medium': color = AppColors.neonOrange; break;
      default: color = AppColors.neonCyan;
    }

    return Padding(
      padding: const EdgeInsets.only(right: 12.0),
      child: GestureDetector(
        onTap: () => setState(() => _selectedPriority = priority),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
          decoration: BoxDecoration(
            color: isSelected ? color.withOpacity(0.2) : Colors.transparent,
            borderRadius: BorderRadius.circular(8),
            border: Border.all(
              color: isSelected ? color : Colors.white10,
              width: 1.5,
            ),
          ),
          child: Text(
            priority.toUpperCase(),
            style: TextStyle(
              color: isSelected ? color : Colors.white38,
              fontSize: 10,
              fontWeight: FontWeight.bold,
              letterSpacing: 1,
            ),
          ),
        ),
      ),
    );
  }
}
