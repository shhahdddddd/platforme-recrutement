import 'package:flutter/material.dart';
import '../../../../core/theme/app_theme.dart';

class CompanyCard extends StatelessWidget {
  final String name;
  final String logo;
  final int openJobs;

  const CompanyCard({
    super.key,
    required this.name,
    required this.logo,
    required this.openJobs,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 150,
      margin: const EdgeInsets.only(right: 16),
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: Colors.grey.shade100),
      ),
      child: Column(
        children: [
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: AppTheme.backgroundColor,
              shape: BoxShape.circle,
            ),
            child: Text(
              logo,
              style: const TextStyle(fontSize: 24),
            ),
          ),
          const SizedBox(height: 16),
          Text(
            name,
            style: const TextStyle(
              fontWeight: FontWeight.bold,
              fontSize: 15,
              color: AppTheme.textColor,
            ),
            textAlign: TextAlign.center,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
          const SizedBox(height: 4),
          Text(
            "$openJobs offres",
            style: const TextStyle(
              fontSize: 12,
              color: AppTheme.subtextColor,
            ),
          ),
        ],
      ),
    );
  }
}
