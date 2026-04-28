import 'package:flutter/material.dart';
import '../../../../core/theme/app_theme.dart';

class ProfileStepIndicator extends StatelessWidget {
  final int currentStep;
  final int totalSteps;

  const ProfileStepIndicator({
    super.key,
    required this.currentStep,
    required this.totalSteps,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.symmetric(vertical: 20),
      child: FittedBox(
        fit: BoxFit.scaleDown,
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: List.generate(totalSteps, (index) {
            bool isActive = index < currentStep;
            bool isCurrent = index == currentStep - 1;
            
            return Row(
              children: [
                Container(
                  width: 32,
                  height: 32,
                  decoration: BoxDecoration(
                    color: isCurrent || isActive ? AppTheme.primaryColor : Colors.grey.shade300,
                    shape: BoxShape.circle,
                    boxShadow: isCurrent ? [
                      BoxShadow(
                        color: AppTheme.primaryColor.withValues(alpha: 0.3),
                        blurRadius: 8,
                        offset: const Offset(0, 4),
                      )
                    ] : null,
                  ),
                  child: Center(
                    child: isActive 
                      ? const Icon(Icons.check, size: 18, color: Colors.white)
                      : Text(
                          "${index + 1}",
                          style: TextStyle(
                            color: isCurrent || isActive ? Colors.white : AppTheme.subtextColor,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                  ),
                ),
                if (index < totalSteps - 1)
                  Container(
                    width: 40,
                    height: 2,
                    margin: const EdgeInsets.symmetric(horizontal: 8),
                    color: isActive ? AppTheme.primaryColor : Colors.grey.shade300,
                  ),
              ],
            );
          }),
        ),
      ),
    );
  }
}
