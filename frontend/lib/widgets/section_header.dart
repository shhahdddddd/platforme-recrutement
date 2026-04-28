import 'package:flutter/material.dart';
import '../core/theme/app_theme.dart';

class SectionHeader extends StatelessWidget {
  final String title;
  final String subtitle;
  final TextStyle? titleStyle;
  final bool center;
  final double bottomSpacing;

  const SectionHeader({
    super.key,
    required this.title,
    required this.subtitle,
    this.center = false,
    this.titleStyle,
    this.bottomSpacing = 20,
  });

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: double.infinity,
      child: Column(
        crossAxisAlignment: center ? CrossAxisAlignment.center : CrossAxisAlignment.start,
        children: [
          Text(
            title,
            textAlign: center ? TextAlign.center : TextAlign.start,
            style: titleStyle ?? const TextStyle(
              fontSize: 28,
              fontWeight: FontWeight.w800,
              color: AppTheme.textColor,
              letterSpacing: -0.5,
            ),
          ),
          if (subtitle.isNotEmpty) ...[
            const SizedBox(height: 8),
            Text(
              subtitle,
              textAlign: center ? TextAlign.center : TextAlign.start,
              style: const TextStyle(
                fontSize: 16,
                color: AppTheme.subtextColor,
                height: 1.5,
              ),
            ),
          ],
          SizedBox(height: bottomSpacing),
        ],
      ),
    );
  }
}
