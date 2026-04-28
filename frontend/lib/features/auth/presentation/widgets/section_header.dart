import 'package:flutter/material.dart';
import '../../../../core/theme/app_theme.dart';

class SectionHeader extends StatelessWidget {
  final String title;
  final String subtitle;

  final double? bottomSpacing;
  final bool center;
  final TextStyle? titleStyle;

  const SectionHeader({
    super.key,
    required this.title,
    required this.subtitle,
    this.bottomSpacing,
    this.center = false,
    this.titleStyle,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
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
        SizedBox(height: bottomSpacing ?? 32),
      ],
    );
  }
}
