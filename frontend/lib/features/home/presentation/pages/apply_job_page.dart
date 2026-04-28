import 'package:flutter/material.dart';
import 'package:file_picker/file_picker.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:dio/dio.dart';
import '../../../../core/constants/app_constants.dart';
import '../../domain/entities/job_offer_entity.dart';
import '../bloc/job_application_bloc.dart';
import '../bloc/job_application_event.dart';
import '../bloc/job_application_state.dart';
import '../../../../injection_container.dart';
import '../../../quiz/presentation/pages/candidate_quiz_page.dart';

class ApplyJobPage extends StatefulWidget {
  final JobOfferEntity job;

  const ApplyJobPage({super.key, required this.job});

  @override
  State<ApplyJobPage> createState() => _ApplyJobPageState();
}

class _ApplyJobPageState extends State<ApplyJobPage> {
  List<int>? _fileBytes;
  String? _fileName;
  bool _alreadyApplied = false;
  bool _checkingApplied = true;
  Map<String, dynamic>? _applicationData;
  bool _loadingRequirements = true;
  List<JobRequirementEntity> _fetchedRequirements = const [];
  final Dio _dio = sl<Dio>();

  @override
  void initState() {
    super.initState();
    _checkApplicationStatus();
    _loadRequirements();
  }

  Future<void> _loadRequirements() async {
    try {
      final response = await _dio.get(
        '${AppConstants.apiBaseUrl}/job-offers/${widget.job.id}/requirements',
      );
      if (!mounted) return;

      final data = response.data?['data'];
      final raw = data?['requirements'];
      final List<JobRequirementEntity> parsed = [];

      if (raw is List) {
        for (final item in raw) {
          if (item is! Map) continue;
          final int? durationMonths =
              (item['month_durations'] ?? item['duration_months']) != null
              ? int.tryParse(
                  (item['month_durations'] ?? item['duration_months'])
                      .toString(),
                )
              : null;

          // required_degrees may arrive as a List (JSONB decoded) or as a
          // raw JSON string if the DB driver didn't decode it automatically.
          final rawDegrees = item['required_degrees'];
          final List<String> degrees = [];
          if (rawDegrees is List) {
            degrees.addAll(rawDegrees.map((e) => e.toString()));
          } else if (rawDegrees is String && rawDegrees.isNotEmpty) {
            try {
              final decoded = (rawDegrees.startsWith('['))
                  ? List<dynamic>.from(
                      // Simple JSON array parse without dart:convert import:
                      rawDegrees
                          .replaceAll('[', '')
                          .replaceAll(']', '')
                          .split(',')
                          .map((s) => s.trim().replaceAll('"', '')),
                    )
                  : <dynamic>[];
              degrees.addAll(decoded.map((e) => e.toString()));
            } catch (_) {}
          }

          if (durationMonths == null && degrees.isEmpty) continue;

          parsed.add(
            JobRequirementEntity(
              skillName: 'Requirement',
              minimumLevel: '',
              cycleEng: null,
              durationMonths: durationMonths,
              startDate: null,
              requiredDegrees: degrees,
            ),
          );
        }
      }

      setState(() {
        _fetchedRequirements = parsed;
        _loadingRequirements = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() => _loadingRequirements = false);
    }
  }

  Future<void> _checkApplicationStatus() async {
    try {
      final response = await _dio.get(
        '${AppConstants.apiBaseUrl}/job-offers/${widget.job.id}/application-status',
      );
      if (!mounted) return;
      final data = response.data?['data'];
      final hasApplied = data?['has_applied'] == true;
      setState(() {
        _alreadyApplied = hasApplied;
        _applicationData = data;
        _checkingApplied = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() => _checkingApplied = false);
    }
  }

  Future<void> _pickPDF() async {
    try {
      final result = await FilePicker.platform.pickFiles(
        type: FileType.custom,
        allowedExtensions: ['pdf'],
        withData: true, // Crucial for Web
      );

      if (result != null && result.files.single.bytes != null) {
        setState(() {
          _fileBytes = result.files.single.bytes;
          _fileName = result.files.single.name;
        });
      }
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text('Error: $e')));
    }
  }

  void _submitApplication() {
    if (_fileBytes == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please select your PDF CV.')),
      );
      return;
    }

    context.read<JobApplicationBloc>().add(
      SubmitApplication(
        jobOfferId: widget.job.id,
        fileBytes: _fileBytes!,
        fileName: _fileName!,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return BlocListener<JobApplicationBloc, JobApplicationState>(
      listener: (context, state) {
        if (state is JobApplicationSuccess) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text('Application submitted successfully!'),
              backgroundColor: Colors.green,
            ),
          );
          if (mounted) {
            setState(() => _alreadyApplied = true);
          }
          Navigator.pop(context); // Go back after success
        } else if (state is JobApplicationFailure) {
          final isAlreadyApplied = state.message.toLowerCase().contains(
            'already applied',
          );
          if (isAlreadyApplied && mounted) {
            setState(() => _alreadyApplied = true);
          }
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text(
                isAlreadyApplied
                    ? 'You have already applied for this job.'
                    : state.message,
              ),
              backgroundColor: isAlreadyApplied ? Colors.orange : Colors.red,
            ),
          );
        }
      },
      child: Scaffold(
        backgroundColor: Colors.white,
        body: CustomScrollView(
          slivers: [
            _buildAppBar(),
            SliverFillRemaining(
              hasScrollBody: false,
              child: Padding(
                padding: const EdgeInsets.all(24.0),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    _buildJobHeader(),
                    const SizedBox(height: 32),
                    _buildDescriptionSection(),
                    const SizedBox(height: 24),
                    _buildRequirementsSection(),
                    const SizedBox(height: 24),
                    _buildUploadSection(),
                    const Spacer(),
                    _buildSubmitButton(),
                    const SizedBox(height: 16),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildAppBar() {
    return SliverAppBar(
      expandedHeight: 0,
      floating: true,
      backgroundColor: Colors.white,
      elevation: 0,
      leading: IconButton(
        icon: const Icon(
          Icons.arrow_back_ios_new_rounded,
          color: Colors.black87,
          size: 20,
        ),
        onPressed: () => Navigator.pop(context),
      ),
      title: Text(
        "Apply",
        style: GoogleFonts.outfit(
          color: Colors.black87,
          fontWeight: FontWeight.bold,
          fontSize: 18,
        ),
      ),
      centerTitle: true,
    );
  }

  Widget _buildJobHeader() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Container(
              width: 64,
              height: 64,
              decoration: BoxDecoration(
                color: Colors.blue.shade50,
                borderRadius: BorderRadius.circular(16),
                image: widget.job.companyLogo.isNotEmpty
                    ? DecorationImage(
                        image: NetworkImage(widget.job.companyLogo),
                        fit: BoxFit.cover,
                      )
                    : null,
              ),
              child: widget.job.companyLogo.isEmpty
                  ? Icon(
                      Icons.business_rounded,
                      color: Colors.blue.shade700,
                      size: 32,
                    )
                  : null,
            ),
            const SizedBox(width: 16),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    widget.job.title,
                    style: GoogleFonts.outfit(
                      fontSize: 22,
                      fontWeight: FontWeight.w800,
                      color: const Color(0xFF1A1A1A),
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    "${widget.job.companyName} \u2022 ${widget.job.location}",
                    style: GoogleFonts.outfit(
                      fontSize: 15,
                      color: Colors.grey.shade600,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
        const SizedBox(height: 24),
        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: const Color(0xFFF8FAFC),
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: const Color(0xFFE2E8F0)),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              _buildInfoRow(
                Icons.work_outline_rounded,
                "Type of offer",
                _formatOfferType(widget.job.offerType),
              ),
              const SizedBox(height: 12),
              _buildInfoRow(
                Icons.account_tree_outlined,
                "Department",
                widget.job.department,
              ),
              const SizedBox(height: 12),
              _buildInfoRow(
                Icons.payments_outlined,
                "Salary",
                widget.job.budget > 0
                    ? '${widget.job.budget.toStringAsFixed(0)} TND'
                    : 'Negotiable',
              ),
              if (_fetchedRequirements.any((r) => r.requiredDegrees.isNotEmpty)) ...[
                const SizedBox(height: 12),
                _buildInfoRow(
                  Icons.school_outlined,
                  "Academic Pedigree",
                  _fetchedRequirements
                      .expand((r) => r.requiredDegrees)
                      .toSet()
                      .join(', '),
                ),
              ],
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildDescriptionSection() {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: const Color(0xFFF8FAFC),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFE2E8F0)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(Icons.description_outlined, size: 20, color: Color(0xFF0A66C2)),
              const SizedBox(width: 8),
              Text(
                "Description",
                style: GoogleFonts.outfit(
                  fontSize: 18,
                  fontWeight: FontWeight.w800,
                  color: const Color(0xFF1A1A1A),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Text(
            widget.job.description.isNotEmpty 
                ? widget.job.description 
                : "No description provided.",
            style: GoogleFonts.outfit(
              fontSize: 15,
              color: const Color(0xFF475569),
              height: 1.5,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildInfoRow(IconData icon, String label, String value) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Icon(icon, size: 18, color: const Color(0xFF64748B)),
        const SizedBox(width: 12),
        Expanded(
          child: RichText(
            text: TextSpan(
              style: GoogleFonts.outfit(fontSize: 14),
              children: [
                TextSpan(
                  text: "$label: ",
                  style: GoogleFonts.outfit(
                    color: const Color(0xFF64748B),
                    fontSize: 14,
                  ),
                ),
                TextSpan(
                  text: value,
                  style: GoogleFonts.outfit(
                    color: const Color(0xFF1E293B),
                    fontSize: 14,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }

  String _formatOfferType(String type) {
    final t = type.toLowerCase().trim();
    if (t == 'full' || t == 'fulltime') return 'Full Time Job';
    if (t == 'part' || t == 'parttime') return 'Part Time Job';
    if (t == 'internship') return 'Internship';
    if (t.isEmpty) return 'Full Time Job'; // Default
    return t[0].toUpperCase() + t.substring(1);
  }

  Widget _buildRequirementsSection() {
    final isInternship = widget.job.offerType.toLowerCase().contains('intern');
    final requirements = _fetchedRequirements;

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: const Color(0xFFF8FAFC),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFE2E8F0)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(
                Icons.assignment_turned_in_outlined,
                size: 20,
                color: Color(0xFF0A66C2),
              ),
              const SizedBox(width: 8),
              Text(
                'Requirements',
                style: GoogleFonts.outfit(
                  fontSize: 18,
                  fontWeight: FontWeight.w800,
                  color: const Color(0xFF1A1A1A),
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          if (_loadingRequirements)
            Text(
              'Loading requirements...',
              style: GoogleFonts.outfit(
                fontSize: 14,
                color: const Color(0xFF64748B),
              ),
            )
          else if (requirements.isEmpty)
            Text(
              'No specific requirements.',
              style: GoogleFonts.outfit(
                fontSize: 14,
                color: const Color(0xFF64748B),
              ),
            )
          else
            ...requirements.map((req) {
              return Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Duration (internship only)
                  if (isInternship && req.durationMonths != null) ...[
                    Row(
                      children: [
                        const Icon(Icons.calendar_today_outlined, size: 18, color: Color(0xFF0A66C2)),
                        const SizedBox(width: 10),
                        Text(
                          'Duration: ${req.durationMonths} months',
                          style: GoogleFonts.outfit(
                            fontSize: 14,
                            color: const Color(0xFF475569),
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 12),
                  ],
                  // Degree chips
                  if (req.requiredDegrees.isNotEmpty) ...[
                    Row(
                      children: [
                        const Icon(Icons.school_outlined, size: 18, color: Color(0xFF0A66C2)),
                        const SizedBox(width: 10),
                        Text(
                          'Academic Degree Required',
                          style: GoogleFonts.outfit(
                            fontSize: 14,
                            color: const Color(0xFF475569),
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 8),
                    Wrap(
                      spacing: 8,
                      runSpacing: 6,
                      children: req.requiredDegrees.map((degree) {
                        return Container(
                          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                          decoration: BoxDecoration(
                            color: const Color(0xFFEFF6FF),
                            borderRadius: BorderRadius.circular(20),
                            border: Border.all(color: const Color(0xFFBFDBFE)),
                          ),
                          child: Text(
                            degree,
                            style: GoogleFonts.outfit(
                              fontSize: 13,
                              fontWeight: FontWeight.w700,
                              color: const Color(0xFF1D4ED8),
                            ),
                          ),
                        );
                      }).toList(),
                    ),
                    const SizedBox(height: 12),
                  ],
                ],
              );
            }),
        ],
      ),
    );
  }

  Widget _buildUploadSection() {
    final uploadDisabled = _alreadyApplied || _checkingApplied;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          "CV",
          style: GoogleFonts.outfit(
            fontSize: 18,
            fontWeight: FontWeight.bold,
            color: const Color(0xFF1A1A1A),
          ),
        ),
        const SizedBox(height: 8),
        Text(
          uploadDisabled
              ? (_checkingApplied
                    ? "Checking your application..."
                    : "You have already applied for this offer.")
              : "Please upload your CV in PDF format only.",
          style: GoogleFonts.outfit(fontSize: 14, color: Colors.grey.shade600),
        ),
        const SizedBox(height: 20),
        InkWell(
          onTap: uploadDisabled ? null : _pickPDF,
          borderRadius: BorderRadius.circular(20),
          child: Container(
            width: double.infinity,
            padding: const EdgeInsets.symmetric(vertical: 40, horizontal: 20),
            decoration: BoxDecoration(
              color: uploadDisabled
                  ? const Color(0xFFF1F5F9)
                  : _fileBytes != null
                  ? Colors.blue.shade50.withValues(alpha: 0.5)
                  : const Color(0xFFF8FAFC),
              borderRadius: BorderRadius.circular(20),
              border: Border.all(
                color: uploadDisabled
                    ? const Color(0xFFCBD5E1)
                    : _fileBytes != null
                    ? const Color(0xFF0A66C2)
                    : const Color(0xFFE2E8F0),
                width: 2,
                style: uploadDisabled
                    ? BorderStyle.solid
                    : _fileBytes != null
                    ? BorderStyle.solid
                    : BorderStyle.none,
              ),
            ),
            child: Column(
              children: [
                Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: uploadDisabled
                        ? const Color(0xFF94A3B8)
                        : _fileBytes != null
                        ? const Color(0xFF0A66C2)
                        : Colors.white,
                    shape: BoxShape.circle,
                    boxShadow: [
                      BoxShadow(
                        color: Colors.black.withValues(alpha: 0.05),
                        blurRadius: 10,
                        offset: const Offset(0, 4),
                      ),
                    ],
                  ),
                  child: Icon(
                    uploadDisabled
                        ? Icons.lock_outline_rounded
                        : _fileBytes != null
                        ? Icons.check_rounded
                        : Icons.cloud_upload_outlined,
                    color: uploadDisabled
                        ? Colors.white
                        : _fileBytes != null
                        ? Colors.white
                        : const Color(0xFF0A66C2),
                    size: 32,
                  ),
                ),
                const SizedBox(height: 16),
                Text(
                  uploadDisabled
                      ? "Already Applied"
                      : _fileBytes != null
                      ? _fileName!
                      : "Tap to choose a file",
                  textAlign: TextAlign.center,
                  style: GoogleFonts.outfit(
                    fontSize: 16,
                    fontWeight: FontWeight.w600,
                    color: uploadDisabled
                        ? const Color(0xFF64748B)
                        : _fileBytes != null
                        ? const Color(0xFF0A66C2)
                        : const Color(0xFF1E293B),
                  ),
                ),
                if (!uploadDisabled && _fileBytes == null) ...[
                  const SizedBox(height: 4),
                  Text(
                    "Supported format: PDF (max. 5MB)",
                    style: GoogleFonts.outfit(
                      fontSize: 12,
                      color: Colors.grey.shade500,
                    ),
                  ),
                ],
              ],
            ),
          ),
        ),
      ],
    );
  }

  bool get _hasAssignedManualQuiz {
    final status = (_applicationData?['manual_quiz_status'] ?? '')
        .toString()
        .trim()
        .toLowerCase();
    return status.isNotEmpty && status != 'none';
  }

  bool get _hasAssignedAiQuiz {
    final sessionId = _applicationData?['ai_quiz_session_id'];
    final status = (_applicationData?['ai_quiz_status'] ?? '')
        .toString()
        .trim()
        .toLowerCase();
    return sessionId != null && status.isNotEmpty && status != 'none' && status != 'failed';
  }

  bool get _manualQuizCompleted {
    return _applicationData?['manual_quiz_status'] == 'completed';
  }

  bool get _aiQuizCompleted {
    return _applicationData?['ai_quiz_status'] == 'completed';
  }

  Widget _buildSubmitButton() {
    return BlocBuilder<JobApplicationBloc, JobApplicationState>(
      builder: (context, state) {
        final isLoading = state is JobApplicationLoading || _checkingApplied;
        final isDisabled = isLoading || _alreadyApplied;

        // Show loading state
        if (isLoading) {
          return Container(
            width: double.infinity,
            height: 56,
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(16),
              color: const Color(0xFF0A66C2),
            ),
            child: const Center(
              child: SizedBox(
                height: 24,
                width: 24,
                child: CircularProgressIndicator(
                  color: Colors.white,
                  strokeWidth: 2,
                ),
              ),
            ),
          );
        }

        // Not applied yet - show apply button
        if (!_alreadyApplied) {
          return Container(
            width: double.infinity,
            height: 56,
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(16),
              boxShadow: [
                BoxShadow(
                  color: const Color(0xFF0A66C2).withValues(alpha: 0.3),
                  blurRadius: 20,
                  offset: const Offset(0, 8),
                ),
              ],
            ),
            child: ElevatedButton(
              onPressed: _submitApplication,
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF0A66C2),
                foregroundColor: Colors.white,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(16),
                ),
                elevation: 0,
              ),
              child: Text(
                "Apply Now",
                style: GoogleFonts.outfit(
                  fontSize: 16,
                  fontWeight: FontWeight.bold,
                ),
              ),
            ),
          );
        }

        // Already applied - show quiz buttons
        final hasBothQuizzes = _hasAssignedManualQuiz && _hasAssignedAiQuiz;
        final hasAnyQuiz = _hasAssignedManualQuiz || _hasAssignedAiQuiz;

        if (!hasAnyQuiz) {
          return Container(
            width: double.infinity,
            height: 56,
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(16),
              color: Colors.grey[300],
            ),
            child: Center(
              child: Text(
                "Application Submitted - Awaiting Review",
                style: GoogleFonts.outfit(
                  fontSize: 16,
                  fontWeight: FontWeight.bold,
                  color: Colors.grey[700],
                ),
              ),
            ),
          );
        }

        // Show quiz buttons
        return Column(
          children: [
            if (hasBothQuizzes) ...[
              Text(
                "Complete Your Assessments",
                style: GoogleFonts.outfit(
                  fontSize: 14,
                  fontWeight: FontWeight.w600,
                  color: Colors.grey[700],
                ),
              ),
              const SizedBox(height: 12),
            ],
            if (_hasAssignedManualQuiz) ...[
              _buildQuizButton(
                title: _manualQuizCompleted
                    ? "Technical Assessment Completed (${_applicationData?['manual_quiz_score'] ?? 0}%)"
                    : "Take Technical Assessment",
                subtitle: "Recruiter-created assessment",
                onPressed: _manualQuizCompleted ? null : _onManualQuizPressed,
                color: const Color(0xFF0A66C2),
                isCompleted: _manualQuizCompleted,
              ),
              if (_hasAssignedAiQuiz) const SizedBox(height: 12),
            ],
            if (_hasAssignedAiQuiz)
              _buildQuizButton(
                title: _aiQuizCompleted
                    ? "AI Assessment Completed (${_applicationData?['ai_quiz_score'] ?? 0}%)"
                    : "Take AI Assessment",
                subtitle: "AI-generated assessment",
                onPressed: _aiQuizCompleted ? null : _onAiQuizPressed,
                color: const Color(0xFF7C3AED), // Purple for AI
                isCompleted: _aiQuizCompleted,
              ),
          ],
        );
      },
    );
  }

  Widget _buildQuizButton({
    required String title,
    required String subtitle,
    required VoidCallback? onPressed,
    required Color color,
    required bool isCompleted,
  }) {
    return Container(
      width: double.infinity,
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(16),
        boxShadow: isCompleted
            ? []
            : [
                BoxShadow(
                  color: color.withValues(alpha: 0.3),
                  blurRadius: 20,
                  offset: const Offset(0, 8),
                ),
              ],
      ),
      child: ElevatedButton(
        onPressed: onPressed,
        style: ElevatedButton.styleFrom(
          backgroundColor: isCompleted ? Colors.grey[300] : color,
          foregroundColor: isCompleted ? Colors.grey[700] : Colors.white,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(16),
          ),
          elevation: 0,
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        ),
        child: Column(
          children: [
            Text(
              title,
              style: GoogleFonts.outfit(
                fontSize: 14,
                fontWeight: FontWeight.bold,
              ),
            ),
            if (!isCompleted)
              Text(
                subtitle,
                style: GoogleFonts.outfit(
                  fontSize: 11,
                  fontWeight: FontWeight.w500,
                  color: Colors.white70,
                ),
              ),
          ],
        ),
      ),
    );
  }

  void _onManualQuizPressed() {
    final appId = int.tryParse(_applicationData?['application_id']?.toString() ?? '');
    if (appId != null) {
      Navigator.push(
        context,
        MaterialPageRoute(
          builder: (_) => CandidateQuizPage(applicationId: appId, isAiQuiz: false),
        ),
      ).then((_) => _checkApplicationStatus());
    }
  }

  void _onAiQuizPressed() {
    final appId = int.tryParse(_applicationData?['application_id']?.toString() ?? '');
    if (appId != null) {
      Navigator.push(
        context,
        MaterialPageRoute(
          builder: (_) => CandidateQuizPage(applicationId: appId, isAiQuiz: true),
        ),
      ).then((_) => _checkApplicationStatus());
    }
  }
}
