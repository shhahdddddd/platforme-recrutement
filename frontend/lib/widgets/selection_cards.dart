import 'package:flutter/material.dart';
import '../core/theme/app_theme.dart';

class SelectionCard extends StatelessWidget {
  final String label;
  final bool isSelected;
  final VoidCallback onTap;
  final IconData? icon;
  final double verticalPadding;

  const SelectionCard({
    super.key,
    required this.label,
    required this.isSelected,
    required this.onTap,
    this.icon,
    this.verticalPadding = 16,
  });

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(16),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        padding: EdgeInsets.symmetric(vertical: verticalPadding),
        decoration: BoxDecoration(
          color: isSelected ? AppTheme.primaryColor : Colors.white,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(
            color: isSelected ? AppTheme.primaryColor : Colors.grey.shade200,
            width: 2,
          ),
          boxShadow: isSelected ? [
            BoxShadow(
              color: AppTheme.primaryColor.withValues(alpha: 0.3),
              blurRadius: 12,
              offset: const Offset(0, 6),
            )
          ] : null,
        ),
        child: Column(
          children: [
            if (icon != null) ...[
              Icon(
                icon,
                color: isSelected ? Colors.white : AppTheme.subtextColor,
                size: 28,
              ),
              const SizedBox(height: 10),
            ],
            Text(
              label,
              textAlign: TextAlign.center,
              style: TextStyle(
                fontSize: icon != null ? 12 : 14,
                color: isSelected ? Colors.white : AppTheme.textColor,
                fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class BinarySelectionRow extends StatelessWidget {
  final String? question;
  final bool? value;
  final String firstLabel;
  final String secondLabel;
  final Function(bool) onChanged;

  const BinarySelectionRow({
    super.key,
    this.question,
    required this.value,
    required this.firstLabel,
    required this.secondLabel,
    required this.onChanged,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (question != null) ...[
          Text(
            question!,
            style: TextStyle(
              fontSize: 14,
              color: AppTheme.textColor.withValues(alpha: 0.7),
              fontWeight: FontWeight.w500,
            ),
          ),
          const SizedBox(height: 12),
        ],
        Row(
          children: [
            Expanded(
              child: SelectionCard(
                label: firstLabel,
                isSelected: value == true,
                onTap: () => onChanged(true),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: SelectionCard(
                label: secondLabel,
                isSelected: value == false,
                onTap: () => onChanged(false),
              ),
            ),
          ],
        ),
      ],
    );
  }
}

class BinarySelectionRowNoYes extends StatelessWidget {
  final String? question;
  final bool? value;
  final String noLabel;
  final String yesLabel;
  final Function(bool) onChanged;

  const BinarySelectionRowNoYes({
    super.key,
    this.question,
    required this.value,
    required this.noLabel,
    required this.yesLabel,
    required this.onChanged,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (question != null) ...[
          Text(
            question!,
            style: TextStyle(
              fontSize: 14,
              color: AppTheme.textColor.withValues(alpha: 0.7),
              fontWeight: FontWeight.w500,
            ),
          ),
          const SizedBox(height: 12),
        ],
        Row(
          children: [
            Expanded(
              child: SelectionCard(
                label: noLabel,
                isSelected: value == false,
                onTap: () => onChanged(false),
                verticalPadding: 12,
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: SelectionCard(
                label: yesLabel,
                isSelected: value == true,
                onTap: () => onChanged(true),
                verticalPadding: 12,
              ),
            ),
          ],
        ),
      ],
    );
  }
}
