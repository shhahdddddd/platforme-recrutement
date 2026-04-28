import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:recrutitn/core/constants/app_constants.dart';
import 'package:recrutitn/injection_container.dart';

class RecruiterInterviewsPage extends StatefulWidget {
  const RecruiterInterviewsPage({super.key});

  @override
  State<RecruiterInterviewsPage> createState() =>
      _RecruiterInterviewsPageState();
}

class _RecruiterInterviewsPageState extends State<RecruiterInterviewsPage> {
  bool _isLoading = false;
  String? _error;
  List<_InterviewItem> _items = const [];

  @override
  void initState() {
    super.initState();
    _loadInterviews();
  }

  Future<void> _loadInterviews() async {
    if (mounted) {
      setState(() {
        _isLoading = true;
        _error = null;
      });
    }

    try {
      final response = await sl<Dio>().get('${AppConstants.apiBaseUrl}/company/interviews');
      final data = response.data;

      final rawItems = (data is Map && data['data'] is List)
          ? List<dynamic>.from(data['data'] as List)
          : const <dynamic>[];

      final interviews = <_InterviewItem>[];
      for (final item in rawItems) {
        if (item is Map) {
          interviews.add(_InterviewItem.fromJson(Map<String, dynamic>.from(item)));
        }
      }

      if (!mounted) return;
      setState(() {
        _items = interviews;
        _isLoading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _isLoading = false;
        _error = 'Unable to load interviews right now.';
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF5F8FC),
      appBar: AppBar(
        title: const Text('Interviews'),
        backgroundColor: Colors.white,
        elevation: 0,
        surfaceTintColor: Colors.transparent,
      ),
      body: RefreshIndicator(
        onRefresh: _loadInterviews,
        child: _buildBody(),
      ),
    );
  }

  Widget _buildBody() {
    if (_isLoading && _items.isEmpty) {
      return const Center(child: CircularProgressIndicator());
    }

    if (_error != null && _items.isEmpty) {
      return ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        children: [
          const SizedBox(height: 140),
          const Icon(Icons.error_outline_rounded, size: 36, color: Color(0xFF94A3B8)),
          const SizedBox(height: 12),
          Center(
            child: Text(
              _error!,
              style: const TextStyle(fontSize: 14, color: Color(0xFF64748B)),
            ),
          ),
          const SizedBox(height: 12),
          Center(
            child: OutlinedButton.icon(
              onPressed: _loadInterviews,
              icon: const Icon(Icons.refresh_rounded),
              label: const Text('Retry'),
            ),
          ),
        ],
      );
    }

    if (_items.isEmpty) {
      return ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        children: const [
          SizedBox(height: 140),
          Icon(Icons.event_note_rounded, size: 36, color: Color(0xFF94A3B8)),
          SizedBox(height: 12),
          Center(
            child: Text(
              'No interviews found.',
              style: TextStyle(fontSize: 14, color: Color(0xFF64748B)),
            ),
          ),
        ],
      );
    }

    return ListView.separated(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.fromLTRB(16, 14, 16, 24),
      itemCount: _items.length,
      separatorBuilder: (_, __) => const SizedBox(height: 12),
      itemBuilder: (_, i) => _InterviewCard(item: _items[i]),
    );
  }
}

class _InterviewItem {
  final int id;
  final String candidateName;
  final String candidateEmail;
  final String jobTitle;
  final String interviewType;
  final String interviewMode;
  final String status;
  final String? scheduledAt;
  final int? durationMinutes;
  final String notes;

  const _InterviewItem({
    required this.id,
    required this.candidateName,
    required this.candidateEmail,
    required this.jobTitle,
    required this.interviewType,
    required this.interviewMode,
    required this.status,
    required this.scheduledAt,
    required this.durationMinutes,
    required this.notes,
  });

  static _InterviewItem fromJson(Map<String, dynamic> json) {
    final candidate = _safeMap(json['candidate']);
    final jobOffer = _safeMap(json['job_offer']);

    return _InterviewItem(
      id: (json['id'] as num?)?.toInt() ?? 0,
      candidateName: _text(candidate['name'], fallback: 'Candidate'),
      candidateEmail: _text(candidate['email']),
      jobTitle: _text(jobOffer['title'], fallback: 'Untitled job'),
      interviewType: _text(json['interview_type']),
      interviewMode: _text(json['interview_mode']),
      status: _text(json['status'], fallback: 'pending'),
      scheduledAt: _text(json['scheduled_at']).isNotEmpty ? _text(json['scheduled_at']) : null,
      durationMinutes: (json['duration_minutes'] as num?)?.toInt(),
      notes: _text(json['notes']),
    );
  }

  static Map<String, dynamic> _safeMap(dynamic value) {
    if (value is Map) return Map<String, dynamic>.from(value);
    return <String, dynamic>{};
  }

  static String _text(dynamic value, {String fallback = ''}) {
    final txt = (value ?? '').toString().trim();
    return txt.isEmpty ? fallback : txt;
  }
}

class _InterviewCard extends StatelessWidget {
  final _InterviewItem item;
  const _InterviewCard({required this.item});

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: const Color(0xFFE2E8F0)),
      ),
      padding: const EdgeInsets.all(14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 40,
                height: 40,
                decoration: BoxDecoration(
                  color: const Color(0xFFE6F4FF),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: const Icon(Icons.person_outline_rounded, color: Color(0xFF0EA5E9)),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      item.candidateName,
                      style: const TextStyle(
                        fontWeight: FontWeight.w700,
                        color: Color(0xFF0F172A),
                      ),
                    ),
                    if (item.candidateEmail.isNotEmpty)
                      Text(
                        item.candidateEmail,
                        style: const TextStyle(fontSize: 12, color: Color(0xFF64748B)),
                      ),
                  ],
                ),
              ),
              _statusChip(item.status),
            ],
          ),
          const SizedBox(height: 12),
          _metaRow(Icons.work_outline_rounded, item.jobTitle),
          const SizedBox(height: 8),
          _metaRow(Icons.badge_outlined, _labelInterviewType(item.interviewType)),
          const SizedBox(height: 8),
          _metaRow(Icons.calendar_month_rounded, _formatDate(item.scheduledAt)),
          const SizedBox(height: 8),
          _metaRow(
            Icons.schedule_rounded,
            '${_labelInterviewMode(item.interviewMode)}${item.durationMinutes != null ? ' - ${item.durationMinutes} min' : ''}',
          ),
          if (item.notes.isNotEmpty) ...[
            const SizedBox(height: 8),
            _metaRow(Icons.notes_rounded, item.notes),
          ],
        ],
      ),
    );
  }

  Widget _metaRow(IconData icon, String text) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Icon(icon, size: 16, color: const Color(0xFF64748B)),
        const SizedBox(width: 8),
        Expanded(
          child: Text(
            text,
            style: const TextStyle(fontSize: 13, color: Color(0xFF334155)),
          ),
        ),
      ],
    );
  }

  Widget _statusChip(String status) {
    final normalized = status.toLowerCase().trim();
    Color bg;
    Color fg;
    String label;

    switch (normalized) {
      case 'completed':
        bg = const Color(0xFFDCFCE7);
        fg = const Color(0xFF166534);
        label = 'Completed';
        break;
      case 'cancelled':
        bg = const Color(0xFFFEE2E2);
        fg = const Color(0xFF991B1B);
        label = 'Cancelled';
        break;
      case 'pending':
      default:
        bg = const Color(0xFFDBEAFE);
        fg = const Color(0xFF1E40AF);
        label = 'Pending';
        break;
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(
        label,
        style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: fg),
      ),
    );
  }

  String _labelInterviewType(String raw) {
    switch (raw.trim().toLowerCase()) {
      case 'test_technique':
        return 'Test technique';
      case 'test_rh_telephonique':
        return 'Test RH telephonique';
      case 'test_rh_video':
        return 'Test RH video';
      case 'test_psychotechnique':
        return 'Test psychotechnique';
      default:
        final normalized = raw.replaceAll('_', ' ').trim();
        if (normalized.isEmpty) return 'Interview';
        return normalized[0].toUpperCase() + normalized.substring(1);
    }
  }

  String _labelInterviewMode(String raw) {
    switch (raw.trim().toLowerCase()) {
      case 'online':
        return 'Online';
      case 'presentiel':
        return 'Presentiel';
      default:
        return raw.isEmpty ? 'Mode not set' : raw;
    }
  }

  String _formatDate(String? raw) {
    if (raw == null || raw.trim().isEmpty) return 'Date not set';
    final parsed = DateTime.tryParse(raw)?.toLocal();
    if (parsed == null) return raw;
    return DateFormat('dd MMM yyyy, HH:mm').format(parsed);
  }
}
