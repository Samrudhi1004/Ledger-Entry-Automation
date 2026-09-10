import 'package:flutter/material.dart';

class TypingIndicator extends StatefulWidget {
  final String userName;

  const TypingIndicator({
    Key? key,
    required this.userName,
  }) : super(key: key);

  @override
  State<TypingIndicator> createState() => _TypingIndicatorState();
}

class _TypingIndicatorState extends State<TypingIndicator>
    with SingleTickerProviderStateMixin {
  late AnimationController _controller;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      duration: const Duration(milliseconds: 1400),
      vsync: this,
    )..repeat();
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
            decoration: BoxDecoration(
              color: Colors.grey[300],
              borderRadius: BorderRadius.circular(16),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                _buildDot(0),
                const SizedBox(width: 4),
                _buildDot(200),
                const SizedBox(width: 4),
                _buildDot(400),
              ],
            ),
          ),
          const SizedBox(width: 8),
          Text(
            '${widget.userName} is typing...',
            style: TextStyle(
              fontSize: 12,
              color: Colors.grey[600],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildDot(int delay) {
    return AnimatedBuilder(
      animation: _controller,
      builder: (context, child) {
        final value = _controller.value;
        final normalizedDelay = delay / 1400;
        final normalizedValue = (value - normalizedDelay) % 1.0;

        double opacity;
        if (normalizedValue < 0.3) {
          opacity = normalizedValue / 0.3;
        } else if (normalizedValue < 0.6) {
          opacity = 1.0;
        } else {
          opacity = 1.0 - ((normalizedValue - 0.6) / 0.4);
        }

        return Container(
          width: 8,
          height: 8,
          decoration: BoxDecoration(
            color: Colors.grey[600]!.withOpacity(opacity),
            shape: BoxShape.circle,
          ),
        );
      },
    );
  }
}
