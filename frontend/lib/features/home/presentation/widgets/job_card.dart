import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:intl/intl.dart';
import 'package:dio/dio.dart';
import 'package:recrutitn/core/constants/app_constants.dart';
import 'package:recrutitn/injection_container.dart';
import '../../domain/entities/job_offer_entity.dart';
import '../bloc/saved_jobs_bloc.dart';
import '../bloc/saved_jobs_event.dart';
import '../bloc/saved_jobs_state.dart';
import '../pages/company_profile_page.dart';

class JobCard extends StatefulWidget {
  final JobOfferEntity job;
  final String title;
  final String company;
  final String location;
  final String salary;
  final String description;
  final String datePosted;
  final List<String> tags;
  final String logoUrl;

  const JobCard({
    super.key,
    required this.job,
    required this.title,
    required this.company,
    required this.location,
    required this.salary,
    required this.description,
    required this.datePosted,
    required this.tags,
    this.logoUrl = '',
  });

  @override
  State<JobCard> createState() => _JobCardState();
}

class _JobCardState extends State<JobCard> {
  late int _likesCount;
  late int _commentsCount;
  bool _isLiked = false;
  bool _loadingEngagement = false;
  final Dio _dio = sl<Dio>();

  @override
  void initState() {
    super.initState();
    _likesCount = widget.job.likesCount;
    _commentsCount = widget.job.commentsCount;
    _loadEngagementStats();
  }

  @override
  void dispose() {
    super.dispose();
  }

  Future<void> _loadEngagementStats() async {
    if (_loadingEngagement) return;
    setState(() => _loadingEngagement = true);
    try {
      final response = await _dio.get(
        '${AppConstants.apiBaseUrl}/job-offers/${widget.job.id}/engagement',
      );

      if (response.data['success'] == true) {
        final data = response.data['data'] as Map<String, dynamic>;
        setState(() {
          _likesCount = data['likes_count'] ?? _likesCount;
          _commentsCount = data['comments_count'] ?? _commentsCount;
          _isLiked = data['is_liked'] ?? false;
        });
      }
    } catch (_) {
      // Keep fallback values from feed if request fails.
    } finally {
      if (mounted) {
        setState(() => _loadingEngagement = false);
      }
    }
  }

  Future<void> _toggleLike() async {
    try {
      final response = await _dio.post(
        '${AppConstants.apiBaseUrl}/job-offers/${widget.job.id}/likes/toggle',
      );

      if (response.data['success'] == true) {
        final data = response.data['data'] as Map<String, dynamic>;
        setState(() {
          _isLiked = data['is_liked'] ?? _isLiked;
          _likesCount = data['likes_count'] ?? _likesCount;
        });
      }
    } on DioException catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(e.response?.data?['message'] ?? 'Like failed')),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return BlocBuilder<SavedJobsBloc, SavedJobsState>(
      builder: (context, state) {
        final isSaved =
            state is SavedJobsLoaded &&
            state.savedJobs.any((j) => j.id == widget.job.id);
        final displayedDate = _formatDatePosted(widget.datePosted);

        return Container(
          margin: const EdgeInsets.only(bottom: 20),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(28),
            border: Border.all(color: const Color(0xFFE2EDF5)),
            boxShadow: [
              BoxShadow(
                color: const Color(0xFF0D1117).withOpacity(0.04),
                blurRadius: 18,
                offset: const Offset(0, 8),
              ),
            ],
          ),
          child: Stack(
            children: [
              Padding(
                padding: const EdgeInsets.all(22),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        // Left Logo / Icon
                        GestureDetector(
                          onTap: () {
                            Navigator.push(
                              context,
                              MaterialPageRoute(
                                builder: (_) => CompanyProfilePage(
                                  companyId: widget.job.companyId,
                                  companyName: widget.company,
                                ),
                              ),
                            );
                          },
                          child: Container(
                            width: 58,
                            height: 58,
                            decoration: BoxDecoration(
                              color: const Color(0xFFE8F3FF),
                              borderRadius: BorderRadius.circular(16),
                            ),
                            child: widget.logoUrl.isNotEmpty
                                ? ClipRRect(
                                    borderRadius: BorderRadius.circular(16),
                                    child: Image.network(
                                      widget.logoUrl,
                                      fit: BoxFit.cover,
                                      errorBuilder: (_, __, ___) => _buildDefaultLogo(),
                                    ),
                                  )
                                : _buildDefaultLogo(),
                          ),
                        ),
                        const SizedBox(width: 16),
                        // Titles
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                widget.title,
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: const TextStyle(
                                  fontSize: 18,
                                  fontWeight: FontWeight.w800,
                                  color: Color(0xFF0D1117),
                                  letterSpacing: -0.4,
                                ),
                              ),
                              const SizedBox(height: 4),
                              GestureDetector(
                                onTap: () {
                                  Navigator.push(
                                    context,
                                    MaterialPageRoute(
                                      builder: (_) => CompanyProfilePage(
                                        companyId: widget.job.companyId,
                                        companyName: widget.company,
                                      ),
                                    ),
                                  );
                                },
                                child: Text(
                                  widget.company,
                                  style: const TextStyle(
                                    fontSize: 14,
                                    fontWeight: FontWeight.w600,
                                    color: Color(0xFF0076C6),
                                  ),
                                ),
                              ),
                              const SizedBox(height: 8),
                              Row(
                                children: [
                                  const Icon(Icons.person_outline_rounded, size: 14, color: Color(0xFF94A3B8)),
                                  const SizedBox(width: 6),
                                  Text(
                                    widget.location,
                                    style: const TextStyle(
                                      fontSize: 13,
                                      fontWeight: FontWeight.w500,
                                      color: Color(0xFF64748B),
                                    ),
                                  ),
                                ],
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 18),
                    // Tags
                    Wrap(
                      spacing: 10,
                      runSpacing: 10,
                      children: [
                        _buildTypeTag(widget.job.offerType),
                        if (widget.job.contractType.isNotEmpty) _buildContractTag(widget.job.contractType),
                        _buildGeneralTag(widget.job.department),
                      ],
                    ),
                    const SizedBox(height: 20),
                    Container(height: 1, color: const Color(0xFFF1F5F9)),
                    const SizedBox(height: 14),
                    // Bottom Row
                    Row(
                      children: [
                        Expanded(
                          child: Center(
                            child: GestureDetector(
                              onTap: _toggleLike,
                              child: Row(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  Icon(
                                    _isLiked ? Icons.favorite_rounded : Icons.favorite_border_rounded,
                                    size: 18,
                                    color: _isLiked ? const Color(0xFFEF4444) : const Color(0xFF94A3B8),
                                  ),
                                  const SizedBox(width: 8),
                                  Text(
                                    '$_likesCount',
                                    style: TextStyle(
                                      fontSize: 13,
                                      fontWeight: FontWeight.w700,
                                      color: _isLiked ? const Color(0xFFEF4444) : const Color(0xFF64748B),
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ),
                        ),
                        Text(
                          displayedDate,
                          style: const TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.w600,
                            color: Color(0xFF94A3B8),
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
              // Bookmark at top right
              Positioned(
                top: 18,
                right: 18,
                child: GestureDetector(
                  onTap: () {
                    context.read<SavedJobsBloc>().add(ToggleSaveJob(widget.job));
                  },
                  child: Icon(
                    isSaved ? Icons.bookmark_rounded : Icons.bookmark_outline_rounded,
                    color: isSaved ? const Color(0xFF0076C6) : const Color(0xFF94A3B8),
                    size: 24,
                  ),
                ),
              ),
            ],
          ),
        );
      },
    );
  }

  Widget _buildDefaultLogo() {
    return const Center(
      child: Icon(
        Icons.work_outline_rounded,
        color: Color(0xFF0076C6),
        size: 24,
      ),
    );
  }

  Widget _buildTypeTag(String type) {
    Color bg = const Color(0xFFFFEEDA);
    Color txt = const Color(0xFFB45309);
    
    final lower = type.toLowerCase();
    if (lower.contains('intern')) {
      bg = const Color(0xFFFFEEDA);
      txt = const Color(0xFFB45309);
    } else if (lower.contains('full')) {
      bg = const Color(0xFFFFF7E8);
      txt = const Color(0xFFD97706);
    }

    return _tagChip(type, bg, txt);
  }

  Widget _buildContractTag(String contract) {
    return _tagChip(contract, const Color(0xFFF1E9FF), const Color(0xFF7C3AED));
  }

  Widget _buildGeneralTag(String label) {
    return _tagChip(label, const Color(0xFFE8F7FF), const Color(0xFF0076C6));
  }

  Widget _tagChip(String label, Color bg, Color text) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 7),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(50),
      ),
      child: Text(
        label,
        style: TextStyle(
          fontSize: 12,
          fontWeight: FontWeight.w700,
          color: text,
        ),
      ),
    );
  }

  String _formatDatePosted(String raw) {
    final value = raw.trim();
    if (value.isEmpty) return 'Recently posted';

    DateTime? parsed = DateTime.tryParse(value);
    if (parsed == null) {
      final match = RegExp(r'(\d{4}-\d{2}-\d{2})').firstMatch(value);
      if (match != null) {
        parsed = DateTime.tryParse(match.group(1)!);
      }
    }

    if (parsed == null) return 'Recently posted';
    return DateFormat('MMM d, yyyy').format(parsed);
  }
}
