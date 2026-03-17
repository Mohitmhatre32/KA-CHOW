import 'package:flutter/material.dart';
import 'package:speech_to_text/speech_to_text.dart';
import '../../core/constants.dart';

class VoiceTaskFAB extends StatefulWidget {
  const VoiceTaskFAB({super.key});

  @override
  State<VoiceTaskFAB> createState() => _VoiceTaskFABState();
}

class _VoiceTaskFABState extends State<VoiceTaskFAB> {
  final SpeechToText _speech = SpeechToText();
  bool _isListening = false;
  String _words = "";
  bool _initialized = false;

  @override
  void initState() {
    super.initState();
    _initSpeech();
  }

  void _initSpeech() async {
    try {
      await Future.delayed(const Duration(milliseconds: 1000));
      _initialized = await _speech.initialize();
      if (mounted) setState(() {});
    } catch (e) {
      debugPrint("Speech init error: $e");
    }
  }

  void _startListening() async {
    if (!_initialized) return;
    _words = "";
    await _speech.listen(onResult: (result) {
      if (mounted) {
        setState(() {
          _words = result.recognizedWords;
        });
      }
    });
    setState(() => _isListening = true);
  }

  void _stopListening() async {
    await _speech.stop();
    setState(() => _isListening = false);
    if (_words.isNotEmpty) {
      _showConfirmDialog();
    }
  }

  void _showConfirmDialog() {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        backgroundColor: AppColors.surface,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: const Row(
          children: [
            Icon(Icons.mic, color: AppColors.accent),
            SizedBox(width: 8),
            Text('Voice Task', style: TextStyle(color: Colors.white)),
          ],
        ),
        content: Text(
          'Create task: \n\n"$_words"', 
          style: const TextStyle(color: Colors.white70, fontStyle: FontStyle.italic)
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context), 
            child: const Text('DISCARD', style: TextStyle(color: Colors.white38))
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(
              backgroundColor: AppColors.accent,
              foregroundColor: Colors.black,
            ),
            onPressed: () {
              Navigator.pop(context);
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(
                  content: Text('Task created instantly! ⚡'),
                  behavior: SnackBarBehavior.floating,
                  backgroundColor: AppColors.accent,
                )
              );
            },
            child: const Text('CONFIRM'),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    if (!_initialized) return const SizedBox.shrink();

    return AnimatedContainer(
      duration: const Duration(milliseconds: 200),
      curve: Curves.easeInOut,
      width: _isListening ? 70 : 56,
      height: _isListening ? 70 : 56,
      child: GestureDetector(
        onLongPress: _startListening,
        onLongPressUp: _stopListening,
        child: Container(
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            color: _isListening ? AppColors.neonPink : AppColors.primary,
            boxShadow: [
              BoxShadow(
                color: (_isListening ? AppColors.neonPink : AppColors.primary).withValues(alpha: 0.5),
                blurRadius: _isListening ? 25 : 12,
                spreadRadius: _isListening ? 6 : 2,
              ),
            ],
          ),
          child: Icon(
            _isListening ? Icons.mic_rounded : Icons.mic_none_rounded,
            color: _isListening ? Colors.white : Colors.black,
            size: 28,
          ),
        ),
      ),
    );
  }
}
