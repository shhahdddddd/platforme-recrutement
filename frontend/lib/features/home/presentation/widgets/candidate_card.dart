import 'package:flutter/material.dart';
import '../../../../core/theme/app_theme.dart';

class CandidateCard extends StatelessWidget {
  final String name;
  final String specialty;
  final String location;
  final double matchScore;
  final List<String> skills;
  final String? jobTitle;
  final double? semanticScore;
  final double? confidenceScore;
  final String? explanation;
  final VoidCallback? onLaunchInterview;
  final bool isLaunchingInterview;
  final String launchInterviewLabel;

  const CandidateCard({
    super.key,
    required this.name,
    required this.specialty,
    required this.location,
    required this.matchScore,
    required this.skills,
    this.jobTitle,
    this.semanticScore,
    this.confidenceScore,
    this.explanation,
    this.onLaunchInterview,
    this.isLaunchingInterview = false,
    this.launchInterviewLabel = 'Lancer interview',
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: Colors.grey.shade100),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.03),
            blurRadius: 15,
            offset: const Offset(0, 8),
          ),
        ],
      ),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: () {},
          borderRadius: BorderRadius.circular(24),
          child: Padding(
            padding: const EdgeInsets.all(20.0),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Stack(
                      alignment: Alignment.bottomRight,
                      children: [
                        Container(
                          width: 56,
                          height: 56,
                          decoration: BoxDecoration(
                            gradient: const LinearGradient(
                              colors: [
                                AppTheme.primaryColor,
                                AppTheme.secondaryColor,
                              ],
                            ),
                            borderRadius: BorderRadius.circular(18),
                          ),
                          child: const Center(
                            child: Icon(
                              Icons.person,
                              color: Colors.white,
                              size: 32,
                            ),
                          ),
                        ),
                        Container(
                          width: 14,
                          height: 14,
                          decoration: BoxDecoration(
                            color: Colors.green,
                            shape: BoxShape.circle,
                            border: Border.all(color: Colors.white, width: 2),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(width: 16),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            name,
                            style: const TextStyle(
                              fontSize: 17,
                              fontWeight: FontWeight.w700,
                              color: AppTheme.textColor,
                            ),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            "$specialty • $location",
                            style: const TextStyle(
                              fontSize: 14,
                              color: AppTheme.subtextColor,
                            ),
                          ),
                        ],
                      ),
                    ),
                    _buildCompatibilityBadge(),
                  ],
                ),
                const SizedBox(height: 20),
                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: skills
                      .take(3)
                      .map((skill) => _buildSkillChip(skill))
                      .toList(),
                ),
                if (jobTitle != null && jobTitle!.trim().isNotEmpty) ...[
                  const SizedBox(height: 14),
                  Text(
                    jobTitle!,
                    style: const TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w600,
                      color: AppTheme.subtextColor,
                    ),
                  ),
                ],
                if (semanticScore != null) ...[
                  const SizedBox(height: 8),
                  Text(
                    'Semantic: ${(semanticScore! * 100).toStringAsFixed(0)}%',
                    style: const TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w700,
                      color: Color(0xFF0F766E),
                    ),
                  ),
                ],
                if (confidenceScore != null) ...[
                  const SizedBox(height: 6),
                  Text(
                    'Extraction confidence: ${(confidenceScore! * 100).toStringAsFixed(0)}%',
                    style: const TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w600,
                      color: AppTheme.subtextColor,
                    ),
                  ),
                ],
                if (explanation != null && explanation!.trim().isNotEmpty) ...[
                  const SizedBox(height: 8),
                  Text(
                    explanation!,
                    style: const TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w500,
                      color: AppTheme.subtextColor,
                    ),
                  ),
                ],
                if (onLaunchInterview != null) ...[
                  const SizedBox(height: 16),
                  SizedBox(
                    width: double.infinity,
                    child: ElevatedButton.icon(
                      onPressed: isLaunchingInterview ? null : onLaunchInterview,
                      icon: isLaunchingInterview
                          ? const SizedBox(
                              width: 14,
                              height: 14,
                              child: CircularProgressIndicator(strokeWidth: 2),
                            )
                          : const Icon(Icons.rocket_launch_rounded, size: 16),
                      label: Text(launchInterviewLabel),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFF0EA5E9),
                        foregroundColor: Colors.white,
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(12),
                        ),
                      ),
                    ),
                  ),
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildCompatibilityBadge() {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
      decoration: BoxDecoration(
        color: Colors.green.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Column(
        children: [
          Text(
            "${(matchScore * 100).toInt()}%",
            style: const TextStyle(
              color: Colors.green,
              fontWeight: FontWeight.w800,
              fontSize: 14,
            ),
          ),
          const Text(
            "Match",
            style: TextStyle(
              color: Colors.green,
              fontSize: 10,
              fontWeight: FontWeight.w600,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildSkillChip(String label) {
    final icon = _skillIcon(label);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      decoration: BoxDecoration(
        color: AppTheme.backgroundColor,
        borderRadius: BorderRadius.circular(12),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 13, color: const Color(0xFF0F766E)),
          const SizedBox(width: 6),
          Text(
            label,
            style: const TextStyle(
              color: AppTheme.subtextColor,
              fontSize: 12,
              fontWeight: FontWeight.w600,
            ),
          ),
        ],
      ),
    );
  }

  IconData _skillIcon(String skill) {
    final value = skill.toLowerCase();
    if (value.contains('flutter') || value.contains('mobile'))
      return Icons.phone_iphone_rounded;
    if (value.contains('laravel') || value.contains('php'))
      return Icons.data_object_rounded;
    if (value.contains('docker') || value.contains('devops'))
      return Icons.dns_rounded;
    if (value.contains('react') || value.contains('front'))
      return Icons.web_rounded;
    if (value.contains('ui') || value.contains('ux') || value.contains('figma'))
      return Icons.design_services_rounded;
    if (value.contains('data') ||
        value.contains('sql') ||
        value.contains('postgres'))
      return Icons.storage_rounded;
    if (value.contains('ai') || value.contains('ml'))
      return Icons.psychology_alt_rounded;
    return Icons.stars_rounded;
  }
}
