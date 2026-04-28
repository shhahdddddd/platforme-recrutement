import 'dart:async';

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:intl/intl.dart';

import 'package:recrutitn/core/constants/app_constants.dart';
import 'package:recrutitn/injection_container.dart';

class CandidateQuizPage extends StatefulWidget {
  final int applicationId;
  final bool isAiQuiz; // If true, open AI quiz instead of manual quiz

  const CandidateQuizPage({
    super.key,
    required this.applicationId,
    this.isAiQuiz = false,
  });

  @override
  State<CandidateQuizPage> createState() => _CandidateQuizPageState();
}

class _CandidateQuizPageState extends State<CandidateQuizPage> {
  final Dio _dio = sl<Dio>();
  final TextEditingController _answerController = TextEditingController();
  Timer? _pollTimer;
  Timer? _assessmentTimer;

  Map<String, dynamic>? _quiz;
  Map<String, dynamic>? _report;
  String? _error;
  String? _selectedLabel;
  bool _loading = true;
  bool _starting = false;
  bool _submitting = false;
  bool _finalizing = false;
  bool _isAiQuizSession = false; // Track if this is an AI quiz session
  int _index = 0;
  int? _secondsLeft;

  @override
  void initState() {
    super.initState();
    _isAiQuizSession = widget.isAiQuiz; // Set from constructor parameter
    _loadQuiz();
  }

  @override
  void dispose() {
    _pollTimer?.cancel();
    _assessmentTimer?.cancel();
    _answerController.dispose();
    super.dispose();
  }

  Map<String, dynamic> get _session => _map(_quiz?['session']);
  Map<String, dynamic> get _application => _map(_quiz?['application']);
  List<Map<String, dynamic>> get _questions => _list(_quiz?['questions']);
  String get _status => (_session['status'] ?? '').toString().toLowerCase();
  bool get _manualCompletedButPendingAnswers =>
      _isManualQuiz &&
      _status == 'completed' &&
      _report == null &&
      _questions.isNotEmpty &&
      _questions.any((q) => !_hasAnswer(q));
  bool get _isActiveQuizFlow =>
      _status == 'in_progress' || 
      _manualCompletedButPendingAnswers ||
      (_questions.isNotEmpty && _questions.any((q) => !_hasAnswer(q)));
  int? get _timeLimit =>
      _int(_session['time_limit']) ??
      _int(_application['time_limit_minutes']) ??
      _int(_application['estimated_duration_minutes']);
  int? get _remainingSeconds => _int(_session['remaining_seconds']);
  bool get _isAwaitingCompletedReport =>
      _status == 'completed' &&
      _report == null &&
      !_manualCompletedButPendingAnswers;
  bool get _isManualQuiz =>
      _session['is_manual'] == true ||
      (_session['session_id'] ?? _session['id'] ?? '')
          .toString()
          .toLowerCase()
          .contains('manual');
  bool get _allQuestionsAnswered =>
      _questions.isNotEmpty && _questions.every(_hasAnswer);
  int get _answeredCount => _questions.where(_hasAnswer).length;

  Map<String, dynamic>? get _currentQuestion {
    if (_index < 0 || _index >= _questions.length) return null;
    return _questions[_index];
  }

  bool _hasAnswer(Map<String, dynamic> q) {
    final answerText = (q['answer_text'] ?? '').toString().trim();
    if (answerText.isNotEmpty) return true;
    final selectedChoice = (q['selected_choice'] ?? '').toString().trim();
    return selectedChoice.isNotEmpty;
  }

  Future<void> _loadQuiz() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final queryParams = _isAiQuizSession ? '?prefer_ai=1' : '';
      final res = await _dio.get(
        '${AppConstants.apiBaseUrl}/candidate/applications/${widget.applicationId}/quiz$queryParams',
      );
      final payload = _payload(res.data);
      if (!mounted) return;
      // Detect if this is an AI quiz session from the response
      final session = _mapOrNull(payload['session']);
      final isManual = session != null && (
          session['is_manual'] == true ||
          (session['session_id'] ?? session['id'] ?? '').toString().toLowerCase().contains('manual')
      );
      setState(() {
        _quiz = payload;
        _report = _mapOrNull(payload['report']);
        _isAiQuizSession = !isManual; // Set based on response
        _loading = false;
      });
      _sync();
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _error = _message(e, 'Unable to load the assessment.');
      });
    }
  }

  void _sync() {
    // Check if we're waiting for a completed report
    if (_isAwaitingCompletedReport) {
      _pollTimer?.cancel();
      _assessmentTimer?.cancel();
      setState(() => _secondsLeft = null);
      unawaited(_refreshReport());
      return;
    }
    
    // Check if quiz is fully completed with report
    if (_report != null) {
      _pollTimer?.cancel();
      _assessmentTimer?.cancel();
      setState(() => _secondsLeft = null);
      return;
    }
    
    // For active quiz flow, always navigate to next unanswered question
    // even if status says 'completed' - this handles AI quiz edge cases
    if (_isActiveQuizFlow || (_status == 'completed' && _report == null)) {
      _pollTimer?.cancel();
      _pollTimer = null;
      final next = _questions.indexWhere((q) => !_hasAnswer(q));
      
      if (next == -1) {
        // All questions answered - mark as complete
        _assessmentTimer?.cancel();
        _answerController.clear();
        setState(() {
          _index = _questions.length;
          _secondsLeft = null;
          _selectedLabel = null;
        });
        if (_isManualQuiz) {
          return;
        }
        _startPolling();
      } else {
        // Navigate to next unanswered question
        setState(() {
          _index = next;
          _answerController.text = (_questions[next]['answer_text'] ?? '')
              .toString();
          // Restore previously saved selection for the next question (if any).
          final savedChoice =
              (_questions[next]['selected_choice'] ?? '').toString();
          _selectedLabel = savedChoice.isEmpty ? null : savedChoice;
        });
        // Start timer for active quiz with unanswered questions
        _startAssessmentTimer();
        return;
      }
    }
    // Only cancel timer if not in active quiz flow
    _assessmentTimer?.cancel();
    setState(() => _secondsLeft = null);
  }

  void _startAssessmentTimer() {
    _assessmentTimer?.cancel();
    final backendRemaining = _remainingSeconds;
    final fallbackRemaining = (_timeLimit != null && _timeLimit! > 0)
        ? _timeLimit! * 60
        : null;
    final nextValue = backendRemaining ?? fallbackRemaining;
    if (nextValue == null || nextValue <= 0 || _currentQuestion == null) {
      setState(() => _secondsLeft = null);
      return;
    }

    final current = _secondsLeft;
    if (current == null ||
        (backendRemaining != null && (backendRemaining - current).abs() > 2)) {
      setState(() => _secondsLeft = nextValue);
    }

    _assessmentTimer = Timer.periodic(const Duration(seconds: 1), (timer) {
      if (!mounted) return timer.cancel();
      final next = (_secondsLeft ?? 0) - 1;
      if (next <= 0) {
        timer.cancel();
        setState(() => _secondsLeft = 0);
        unawaited(_loadQuiz());
        return;
      }
      setState(() => _secondsLeft = next);
    });
  }

  void _startPolling() {
    if (_pollTimer != null) return;
    _pollTimer = Timer.periodic(
      const Duration(seconds: 3),
      (_) => _refreshReport(),
    );
    unawaited(_refreshReport());
  }

  Future<void> _refreshReport() async {
    try {
      // Include prefer_ai=1 for AI quiz reports
      final queryParams = _isAiQuizSession ? '?prefer_ai=1' : '';
      final res = await _dio.get(
        '${AppConstants.apiBaseUrl}/candidate/applications/${widget.applicationId}/quiz/report$queryParams',
      );
      final payload = _payload(res.data);
      if (!mounted) return;
      final report = _mapOrNull(payload['report']);
      final status = (_map(payload['session'])['status'] ?? '')
          .toString()
          .toLowerCase();
      if (report != null || status == 'completed') {
        _pollTimer?.cancel();
        _pollTimer = null;
        setState(() {
          _quiz = {...?_quiz, ...payload};
          _report = report;
          _secondsLeft = null;
        });
      }
    } catch (_) {}
  }

  Future<void> _startAssessment() async {
    final ok =
        await showDialog<bool>(
          context: context,
          builder: (context) => AlertDialog(
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(28),
            ),
            title: Text(
              'Begin Technical Challenge?',
              style: GoogleFonts.outfit(fontWeight: FontWeight.w900),
            ),
            content: Text(
              'Once started, the full assessment timer begins immediately and cannot be extended. Ensure you have a stable connection before continuing.',
              style: GoogleFonts.outfit(fontSize: 16),
            ),
            actions: [
              TextButton(
                onPressed: () => Navigator.pop(context, false),
                child: Text(
                  'NOT YET',
                  style: GoogleFonts.outfit(
                    fontWeight: FontWeight.w800,
                    color: const Color(0xFF94A3B8),
                  ),
                ),
              ),
              FilledButton(
                onPressed: () => Navigator.pop(context, true),
                style: FilledButton.styleFrom(
                  backgroundColor: const Color(0xFF2563EB),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(16),
                  ),
                ),
                child: Text(
                  'COMMENCE',
                  style: GoogleFonts.outfit(fontWeight: FontWeight.w900),
                ),
              ),
            ],
          ),
        ) ??
        false;
    if (!ok || _starting) return;
    setState(() => _starting = true);
    try {
      // Pass prefer_ai=1 for AI quizzes to ensure correct quiz is started
      final queryParams = _isAiQuizSession ? '?prefer_ai=1' : '';
      await _dio.post(
        '${AppConstants.apiBaseUrl}/candidate/applications/${widget.applicationId}/quiz/start$queryParams',
      );
      if (!mounted) return;
      setState(() => _starting = false);
      await _loadQuiz();
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _starting = false;
        _error = _message(e, 'Failed to initialize session.');
      });
    }
  }

  Future<void> _submitAnswer({String? forced}) async {
    final q = _currentQuestion;
    if (q == null || _submitting) return;

    final choices = _list(q['choices_labeled']);
    final isMCQ = choices.isNotEmpty;

    final answer =
        forced ?? (isMCQ ? _selectedLabel : _answerController.text.trim());

    if (answer == null || answer.toString().isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            isMCQ
                ? 'Please select an option first.'
                : 'Please write an answer.',
          ),
        ),
      );
      return;
    }

    setState(() => _submitting = true);
    try {
      final payload = isMCQ
          ? {
              // Keep both keys for compatibility with manual + AI backends.
              'choice': answer,
              'answer': answer,
            }
          : {'answer': answer};

      await _dio.post(
        '${AppConstants.apiBaseUrl}/candidate/applications/${widget.applicationId}/quiz/questions/${q['id']}/answer',
        data: payload,
      );
      if (!mounted) return;
      setState(() {
        _submitting = false;
        _answerController.clear();
        _selectedLabel = null;
      });
      ScaffoldMessenger.of(context).hideCurrentSnackBar();
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Answer saved.'),
          duration: Duration(milliseconds: 900),
        ),
      );
      await _loadQuiz();
    } catch (e) {
      if (!mounted) return;
      setState(() => _submitting = false);
      final message = _message(e, 'Unable to submit the answer.');
      if (message.toLowerCase().contains('time limit')) {
        unawaited(_loadQuiz());
      }
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(message)));
    }
  }

  Future<void> _submitAssessment() async {
    if (_finalizing) return;
    final unansweredCount = _questions.where((q) => !_hasAnswer(q)).length;
    if (unansweredCount > 0) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            'Please answer all questions before submitting ($unansweredCount remaining).',
          ),
        ),
      );
      return;
    }

    setState(() => _finalizing = true);
    try {
      await _dio.post(
        '${AppConstants.apiBaseUrl}/candidate/applications/${widget.applicationId}/quiz/submit',
      );
      if (!mounted) return;
      setState(() => _finalizing = false);
      await _loadQuiz();
    } catch (e) {
      if (!mounted) return;
      setState(() => _finalizing = false);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(_message(e, 'Unable to submit assessment.'))),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Theme(
      data: Theme.of(context).copyWith(
        textTheme: GoogleFonts.outfitTextTheme(Theme.of(context).textTheme),
      ),
      child: Scaffold(
        backgroundColor: const Color(0xFF0F172A),
        appBar: AppBar(
          backgroundColor: Colors.transparent,
          elevation: 0,
          centerTitle: true,
          title: Text(
            'TECHNICAL CHALLENGE',
            style: GoogleFonts.outfit(
              color: Colors.white,
              fontWeight: FontWeight.w900,
              fontSize: 16,
              letterSpacing: 2,
            ),
          ),
          leading: IconButton(
            onPressed: () => Navigator.pop(context),
            icon: const Icon(
              Icons.arrow_back_ios_new_rounded,
              color: Colors.white,
              size: 18,
            ),
          ),
          actions: [
            if (!_loading && _status == 'in_progress' && _isManualQuiz)
              TextButton(
                onPressed: _finalizing || _submitting || !_allQuestionsAnswered
                    ? null
                    : _submitAssessment,
                child: Text(
                  'SUBMIT',
                  style: GoogleFonts.outfit(
                    color: _allQuestionsAnswered
                        ? Colors.white
                        : Colors.white.withValues(alpha: 0.55),
                    fontWeight: FontWeight.w900,
                    letterSpacing: 0.8,
                  ),
                ),
              ),
            IconButton(
              onPressed: _loading ? null : _loadQuiz,
              icon: const Icon(Icons.refresh_rounded, color: Colors.white),
            ),
          ],
        ),
        bottomNavigationBar:
            !_loading &&
                _error == null &&
                _isActiveQuizFlow
            ? _buildPersistentActionBar()
            : null,
        extendBodyBehindAppBar: true,
        body: Container(
          width: double.infinity,
          height: double.infinity,
          decoration: const BoxDecoration(
            gradient: LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: [Color(0xFF0F172A), Color(0xFF1E1B4B)],
            ),
          ),
          child: SafeArea(
            bottom: false,
            child: _loading
                ? const Center(
                    child: CircularProgressIndicator(color: Colors.white),
                  )
                : _error != null
                ? _stateCard(
                    Icons.cloud_off_rounded,
                    'Connection Trouble',
                    _error!,
                    action: FilledButton(
                      onPressed: _loadQuiz,
                      style: FilledButton.styleFrom(
                        backgroundColor: const Color(0xFF2563EB),
                        padding: const EdgeInsets.symmetric(vertical: 16),
                      ),
                      child: const Text('RETRY CONNECTION'),
                    ),
                  )
                : _report != null
                ? _buildReport()
                : _isAwaitingCompletedReport
                ? _stateCard(
                    Icons.analytics_rounded,
                    'Loading Result',
                    'Your assessment was submitted. The final report is being loaded now.',
                    action: FilledButton(
                      onPressed: _refreshReport,
                      style: FilledButton.styleFrom(
                        backgroundColor: const Color(0xFF2563EB),
                        padding: const EdgeInsets.symmetric(vertical: 16),
                      ),
                      child: const Text('REFRESH RESULT'),
                    ),
                  )
                : _status == 'ready'
                ? _buildInvitation()
                : _isActiveQuizFlow
                ? (_currentQuestion == null
                      ? (_isManualQuiz
                            ? _buildManualSubmitCard()
                            : _stateCard(
                                Icons.verified_user_rounded,
                                'Assessment Stamped',
                                'Your expertise is being evaluated. The full performance audit will appear here as soon as processing completes.',
                                isSuccess: true,
                              ))
                      : _buildQuestion())
                : _stateCard(
                    Icons.lock_person_rounded,
                    'Access Pending',
                    'This specialized assessment is currently being prepared for you. We will alert you once the gateway is open.',
                  ),
          ),
        ),
      ),
    );
  }

  Widget _buildInvitation() {
    final deadline = _format(
      _application['complete_by'] ?? _session['deadline'],
    );
    final jobTitle =
        (_application['job_title'] ?? _session['job_title'] ?? 'Role')
            .toString();
    final company = (_application['company_name'] ?? 'Company').toString();
    final estimatedDuration = _int(_application['estimated_duration_minutes']);
    return SingleChildScrollView(
      physics: const BouncingScrollPhysics(),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 30),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(32),
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(40),
                gradient: const LinearGradient(
                  colors: [Color(0xFF2563EB), Color(0xFF1D4ED8)],
                ),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    company,
                    style: GoogleFonts.outfit(
                      color: Colors.white70,
                      fontWeight: FontWeight.w700,
                      fontSize: 14,
                    ),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    jobTitle,
                    style: GoogleFonts.outfit(
                      color: Colors.white,
                      fontSize: 32,
                      fontWeight: FontWeight.w900,
                      height: 1.1,
                    ),
                  ),
                  const SizedBox(height: 24),
                  Wrap(
                    spacing: 12,
                    runSpacing: 12,
                    children: [
                      _chip(
                        '${_int(_session['num_questions']) ?? 0} Questions',
                        dark: true,
                      ),
                      if (_timeLimit != null)
                        _chip('$_timeLimit Min Total', dark: true),
                      if (estimatedDuration != null &&
                          estimatedDuration != _timeLimit)
                        _chip('$estimatedDuration Min Estimated', dark: true),
                      if (deadline != null)
                        _chip('Due $deadline', dark: true, emphasis: true),
                    ],
                  ),
                ],
              ),
            ),
            const SizedBox(height: 32),
            Container(
              padding: const EdgeInsets.all(32),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(36),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withValues(alpha: 0.05),
                    blurRadius: 40,
                    offset: const Offset(0, 20),
                  ),
                ],
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Preparation Guide',
                    style: GoogleFonts.outfit(
                      fontSize: 22,
                      fontWeight: FontWeight.w900,
                    ),
                  ),
                  const SizedBox(height: 20),
                  _guideItem(
                    Icons.timer_rounded,
                    'Focused Timing',
                    'The full quiz timer starts when you begin. Once time runs out, the assessment is submitted as-is.',
                  ),
                  _guideItem(
                    Icons.psychology_rounded,
                    'Honest Evaluation',
                    'This assessment tests your technical depth. Use your own knowledge.',
                  ),
                  _guideItem(
                    Icons.workspace_premium_rounded,
                    'Full Report',
                    'Once finalized, you will receive a comprehensive performance audit.',
                  ),
                  const SizedBox(height: 32),
                  SizedBox(
                    width: double.infinity,
                    child: ElevatedButton(
                      onPressed: _starting ? null : _startAssessment,
                      style: ElevatedButton.styleFrom(
                        minimumSize: const Size.fromHeight(70),
                        backgroundColor: const Color(0xFF2563EB),
                        foregroundColor: Colors.white,
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(24),
                        ),
                        elevation: 0,
                      ),
                      child: Text(
                        _starting ? 'PREPARING...' : 'BEGIN CHALLENGE',
                        style: GoogleFonts.outfit(
                          fontSize: 18,
                          fontWeight: FontWeight.w900,
                          letterSpacing: 1.2,
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _guideItem(IconData icon, String title, String desc) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 20),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(
              color: const Color(0xFFADD8E6),
              borderRadius: BorderRadius.circular(10),
            ),
            child: Icon(icon, size: 20, color: const Color(0xFF2196F3)),
          ),
          const SizedBox(width: 16),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: GoogleFonts.outfit(
                    fontWeight: FontWeight.w800,
                    fontSize: 15,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  desc,
                  style: GoogleFonts.outfit(
                    color: const Color(0xFF64748B),
                    fontSize: 13,
                    height: 1.4,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildQuestion() {
    final q = _currentQuestion;
    if (q == null) return const SizedBox.shrink();

    final total = _questions.length;
    final choices = _list(q['choices_labeled']);
    final isMCQ = choices.isNotEmpty;
    final progress = total == 0 ? 0.0 : (_index + 1) / total;

    return Column(
      children: [
        Expanded(
          child: SingleChildScrollView(
            key: ValueKey('q_$_index'),
            physics: const BouncingScrollPhysics(),
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 30),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Status & Progress Card
                  Container(
                    padding: const EdgeInsets.all(24),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(32),
                      boxShadow: [
                        BoxShadow(
                          color: const Color(0xFF0F172A).withValues(alpha: 0.05),
                          blurRadius: 40,
                          offset: const Offset(0, 20),
                        ),
                      ],
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Flexible(
                              child: Text(
                                'TESTING: Question ${_index + 1} of $total',
                                style: GoogleFonts.outfit(
                                  fontSize: 20,
                                  fontWeight: FontWeight.w900,
                                  color: const Color(0xFF0F172A),
                                  letterSpacing: -0.5,
                                ),
                                overflow: TextOverflow.ellipsis,
                              ),
                            ),
                            if (_secondsLeft != null)
                              Container(
                                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                                decoration: BoxDecoration(
                                  color: _secondsLeft! <= 60 ? const Color(0xFFFFF1F2) : const Color(0xFFF1F5F9),
                                  borderRadius: BorderRadius.circular(12),
                                ),
                                child: Row(
                                  mainAxisSize: MainAxisSize.min,
                                  children: [
                                    Icon(
                                      Icons.timer_outlined,
                                      size: 14,
                                      color: _secondsLeft! <= 60 ? const Color(0xFFBE123C) : const Color(0xFF64748B),
                                    ),
                                    const SizedBox(width: 6),
                                    Text(
                                      _clock(_secondsLeft!),
                                      style: GoogleFonts.jetBrainsMono(
                                        fontWeight: FontWeight.w800,
                                        fontSize: 12,
                                        color: _secondsLeft! <= 60 ? const Color(0xFFBE123C) : const Color(0xFF64748B),
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                          ],
                        ),
                        const SizedBox(height: 18),
                        ClipRRect(
                          borderRadius: BorderRadius.circular(10),
                          child: LinearProgressIndicator(
                            value: progress,
                            minHeight: 8,
                            backgroundColor: const Color(0xFFF1F5F9),
                            valueColor: const AlwaysStoppedAnimation(Color(0xFF2563EB)),
                          ),
                        ),
                        const SizedBox(height: 20),
                        Wrap(
                          spacing: 10,
                          runSpacing: 10,
                          children: [
                            _chip((q['skill_targeted'] ?? 'General').toString(), emphasis: true),
                            _chip((q['difficulty'] ?? 'mixed').toString().toUpperCase()),
                          ],
                        ),
                      ],
                    ),
                  ),

                  const SizedBox(height: 36),
                  Text(
                    (q['question_text'] ?? '').toString(),
                    style: GoogleFonts.outfit(
                      fontSize: 22,
                      fontWeight: FontWeight.w800,
                      height: 1.4,
                      color: Colors.white,
                      letterSpacing: -0.4,
                    ),
                  ),
                  const SizedBox(height: 40),

                  if (isMCQ) ...[
                    for (int choiceIndex = 0; choiceIndex < choices.length; choiceIndex++)
                      Builder(
                        builder: (context) {
                          final choice = choices[choiceIndex];
                          final label = _choiceLabel(choice, choiceIndex);
                          final text = _choiceText(choice);
                          final isSelected = _selectedLabel == label;

                          return Padding(
                            padding: const EdgeInsets.only(bottom: 16),
                            child: Material(
                              color: Colors.transparent,
                              child: InkWell(
                                onTap: _submitting
                                    ? null
                                    : () {
                                        setState(() {
                                          _selectedLabel = label;
                                        });
                                        // For MCQ, commit immediately so tap has a visible effect.
                                        unawaited(_submitAnswer(forced: label));
                                      },
                                borderRadius: BorderRadius.circular(24),
                                child: AnimatedContainer(
                                  duration: const Duration(milliseconds: 250),
                                  curve: Curves.easeOutCubic,
                                  padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 22),
                                  decoration: BoxDecoration(
                                    color: isSelected ? const Color(0xFF2563EB).withValues(alpha: 0.15) : Colors.white,
                                    borderRadius: BorderRadius.circular(24),
                                    border: Border.all(
                                      color: isSelected ? const Color(0xFF2563EB) : const Color(0xFFE2E8F0),
                                      width: isSelected ? 2.5 : 1,
                                    ),
                                  ),
                                  child: Row(
                                    children: [
                                      Container(
                                        width: 40,
                                        height: 40,
                                        decoration: BoxDecoration(
                                          color: isSelected ? const Color(0xFF2563EB) : const Color(0xFFF1F5F9),
                                          borderRadius: BorderRadius.circular(12),
                                        ),
                                        child: Center(
                                          child: Text(
                                            label,
                                            style: GoogleFonts.outfit(
                                              color: isSelected ? Colors.white : const Color(0xFF64748B),
                                              fontWeight: FontWeight.w900,
                                              fontSize: 16,
                                            ),
                                          ),
                                        ),
                                      ),
                                      const SizedBox(width: 20),
                                      Expanded(
                                        child: Text(
                                          text,
                                          style: GoogleFonts.outfit(
                                            fontSize: 17,
                                            fontWeight: isSelected ? FontWeight.w800 : FontWeight.w600,
                                            color: isSelected ? const Color(0xFF1E3A8A) : const Color(0xFF475569),
                                          ),
                                        ),
                                      ),
                                      if (isSelected)
                                        const Icon(
                                          Icons.check_circle_rounded,
                                          color: Color(0xFF2563EB),
                                          size: 20,
                                        ),
                                    ],
                                  ),
                                ),
                              ),
                            ),
                          );
                        },
                      ),
                  ] else ...[
                    Container(
                      decoration: BoxDecoration(
                        boxShadow: [
                          BoxShadow(
                            color: Colors.black.withValues(alpha: 0.03),
                            blurRadius: 30,
                            offset: const Offset(0, 10),
                          ),
                        ],
                      ),
                      child: TextField(
                        controller: _answerController,
                        minLines: 8,
                        maxLines: 12,
                        style: GoogleFonts.outfit(
                          fontSize: 17,
                          fontWeight: FontWeight.w600,
                          color: const Color(0xFF1E293B),
                        ),
                        decoration: InputDecoration(
                          hintText: 'Enter your expert response here...',
                          hintStyle: GoogleFonts.outfit(color: const Color(0xFF94A3B8), fontWeight: FontWeight.w500),
                          filled: true,
                          fillColor: Colors.white,
                          border: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(28),
                            borderSide: const BorderSide(color: Color(0xFFE2E8F0)),
                          ),
                          enabledBorder: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(28),
                            borderSide: const BorderSide(color: Color(0xFFE2E8F0)),
                          ),
                          focusedBorder: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(28),
                            borderSide: const BorderSide(color: Color(0xFF2563EB), width: 2.5),
                          ),
                          contentPadding: const EdgeInsets.all(28),
                        ),
                      ),
                    ),
                  ],

                  const SizedBox(height: 24),
                ],
              ),
            ),
          ),
        ),

        const SizedBox(height: 20),
      ],
    );
  }

  Widget _buildQuestionActions({required bool isMCQ}) {
    final canFinalize = _isManualQuiz && _allQuestionsAnswered && !_finalizing;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        ElevatedButton(
          onPressed: _submitting ? null : () => _submitAnswer(),
          style: ElevatedButton.styleFrom(
            minimumSize: const Size.fromHeight(58),
            backgroundColor: const Color(0xFF2563EB),
            disabledBackgroundColor: const Color(0xFF334155),
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(16),
            ),
          ),
          child: _submitting
              ? const SizedBox(
                  width: 22,
                  height: 22,
                  child: CircularProgressIndicator(
                    color: Colors.white,
                    strokeWidth: 2.5,
                  ),
                )
              : Text(
                  isMCQ ? 'SAVE SELECTION' : 'SAVE & NEXT',
                  style: GoogleFonts.outfit(
                    fontWeight: FontWeight.w900,
                    color: Colors.white,
                    fontSize: 16,
                    letterSpacing: 0.6,
                  ),
                ),
        ),
        if (_isManualQuiz) ...[
          const SizedBox(height: 12),
          FilledButton(
            onPressed: canFinalize ? _submitAssessment : null,
            style: FilledButton.styleFrom(
              minimumSize: const Size.fromHeight(52),
              backgroundColor: Colors.white.withValues(alpha: 0.14),
              disabledBackgroundColor: Colors.white.withValues(alpha: 0.08),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(12),
              ),
            ),
            child: _finalizing
                ? const SizedBox(
                    width: 20,
                    height: 20,
                    child: CircularProgressIndicator(
                      color: Colors.white,
                      strokeWidth: 2.2,
                    ),
                  )
                : Text(
                    _allQuestionsAnswered
                        ? 'SUBMIT ASSESSMENT'
                        : 'ANSWER ALL QUESTIONS TO SUBMIT',
                    style: GoogleFonts.outfit(
                      fontWeight: FontWeight.w800,
                      color: Colors.white,
                    ),
                  ),
          ),
        ],
      ],
    );
  }

  Widget _buildManualSubmitCard() {
    final total = _questions.length;
    final answered = _questions.where(_hasAnswer).length;
    final remaining = total - answered;

    return _stateCard(
      Icons.assignment_turned_in_rounded,
      remaining == 0 ? 'Ready To Submit' : 'Answers Missing',
      remaining == 0
          ? 'All answers are saved. Submit now to finalize and calculate your score.'
          : 'Please answer all questions before final submission. Remaining: $remaining.',
      action: FilledButton(
        onPressed: remaining == 0 && !_finalizing ? _submitAssessment : null,
        style: FilledButton.styleFrom(
          backgroundColor: const Color(0xFF2563EB),
          padding: const EdgeInsets.symmetric(vertical: 16),
        ),
        child: _finalizing
            ? const SizedBox(
                width: 18,
                height: 18,
                child: CircularProgressIndicator(
                  color: Colors.white,
                  strokeWidth: 2,
                ),
              )
            : const Text('SUBMIT ASSESSMENT'),
      ),
      isSuccess: remaining == 0,
    );
  }

  Widget _buildPersistentActionBar() {
    final total = _questions.length;
    final ready = _allQuestionsAnswered;
    final q = _currentQuestion;
    final isLast = _index + 1 == total;
    final isMCQ = q != null && _list(q['choices_labeled']).isNotEmpty;

    return SafeArea(
      top: false,
      child: Container(
        padding: const EdgeInsets.fromLTRB(20, 8, 20, 24),
        decoration: BoxDecoration(
          color: const Color(0xFF0F172A),
          border: Border(top: BorderSide(color: Colors.white.withValues(alpha: 0.1))),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            // PRIMARY ACTION: SAVE
            if (_index < total) 
              ElevatedButton(
                onPressed: (_submitting || (isMCQ && _selectedLabel == null)) ? null : () => _submitAnswer(),
                style: ElevatedButton.styleFrom(
                  minimumSize: const Size.fromHeight(64),
                  backgroundColor: const Color(0xFF2563EB),
                  disabledBackgroundColor: const Color(0xFF334155),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                ),
                child: _submitting
                  ? const SizedBox(width: 24, height: 24, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2.5))
                  : Text(isLast ? 'SAVE FINAL ANSWER' : 'SAVE & NEXT', style: GoogleFonts.outfit(fontWeight: FontWeight.w900, color: Colors.white, fontSize: 17)),
              ),
            
            // SECONDARY ACTION: FINAL SUBMIT (Manual quizzes only)
            if (_isManualQuiz && ready) ...[
              const SizedBox(height: 12),
              FilledButton(
                onPressed: _finalizing ? null : _submitAssessment,
                style: FilledButton.styleFrom(
                  minimumSize: const Size.fromHeight(52),
                  backgroundColor: Colors.white.withValues(alpha: 0.1),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                ),
                child: Text('SUBMIT ASSESSMENT', style: GoogleFonts.outfit(fontWeight: FontWeight.w800, color: Colors.indigoAccent)),
              ),
            ] else if (_index >= total) ...[
               Text('PROGRESS: $_answeredCount/$total answered', style: GoogleFonts.outfit(color: Colors.white54, fontSize: 13, fontWeight: FontWeight.w600)),
            ],
          ],
        ),
      ),
    );
  }

  Widget _buildReport() {
    final summary =
        (_report?['narrative_summary'] ??
                'Calculation complete. Your technical performance profile has been generated.')
            .toString();
    final score = _double(_report?['total_score']);
    final questions = _list(_report?['question_reports']);

    return SingleChildScrollView(
      physics: const BouncingScrollPhysics(),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 30),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Score Billboard
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(32),
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(40),
                gradient: const LinearGradient(
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                  colors: [Color(0xFF0F172A), Color(0xFF1E3A8A)],
                ),
                boxShadow: [
                  BoxShadow(
                    color: const Color(0xFF2563EB).withValues(alpha: 0.2),
                    blurRadius: 40,
                    offset: const Offset(0, 20),
                  ),
                ],
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'PERFORMANCE AUDIT',
                            style: GoogleFonts.outfit(
                              color: const Color(0xFF818CF8),
                              fontWeight: FontWeight.w900,
                              fontSize: 12,
                              letterSpacing: 2,
                            ),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            _isAiQuizSession ? 'AI Assessment' : 'Technical Assessment',
                            style: GoogleFonts.outfit(
                              color: Colors.white70,
                              fontWeight: FontWeight.w600,
                              fontSize: 10,
                              letterSpacing: 1,
                            ),
                          ),
                        ],
                      ),
                      IconButton(
                        onPressed: _refreshReport,
                        icon: const Icon(
                          Icons.refresh_rounded,
                          color: Colors.white70,
                          size: 20,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 24),
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.end,
                    children: [
                      Text(
                        score == null ? '--' : _formatScore(score),
                        style: GoogleFonts.outfit(
                          color: Colors.white,
                          fontSize: 72,
                          fontWeight: FontWeight.w900,
                          height: 0.8,
                        ),
                      ),
                      Padding(
                        padding: const EdgeInsets.only(bottom: 8, left: 4),
                        child: Text(
                          '%',
                          style: GoogleFonts.outfit(
                            color: const Color(0xFF818CF8),
                            fontSize: 28,
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 24),
                  Text(
                    summary,
                    style: GoogleFonts.outfit(
                      color: Colors.white.withValues(alpha: 0.8),
                      fontSize: 16,
                      height: 1.5,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 40),
            Text(
              'DETAILED BREAKDOWN',
              style: GoogleFonts.outfit(
                fontSize: 14,
                fontWeight: FontWeight.w900,
                color: Colors.white.withValues(alpha: 0.5),
                letterSpacing: 1.5,
              ),
            ),
            const SizedBox(height: 20),
            for (final item in questions)
              Container(
                width: double.infinity,
                margin: const EdgeInsets.only(bottom: 20),
                padding: const EdgeInsets.all(28),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(32),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black.withValues(alpha: 0.05),
                      blurRadius: 30,
                      offset: const Offset(0, 15),
                    ),
                  ],
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 12,
                            vertical: 6,
                          ),
                          decoration: BoxDecoration(
                            color: const Color(0xFFF1F5F9),
                            borderRadius: BorderRadius.circular(10),
                          ),
                          child: Text(
                            'Q${item['question_number'] ?? '-'}',
                            style: GoogleFonts.jetBrainsMono(
                              fontWeight: FontWeight.w900,
                              fontSize: 12,
                              color: const Color(0xFF64748B),
                            ),
                          ),
                        ),
                        const SizedBox(width: 16),
                        Expanded(
                          child: Text(
                            (item['question_text'] ?? '').toString(),
                            style: GoogleFonts.outfit(
                              fontWeight: FontWeight.w800,
                              fontSize: 17,
                              height: 1.4,
                              color: const Color(0xFF0F172A),
                            ),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 24),
                    const Divider(color: Color(0xFFF1F5F9)),
                    const SizedBox(height: 20),
                    Row(
                      children: [
                        _reportStat(
                          'SCORE',
                          '${_double(item['score'])?.toStringAsFixed(0) ?? '--'}%',
                          isBold: true,
                        ),
                        const SizedBox(width: 32),
                        if (item['skill_targeted'] != null)
                          _reportStat(
                            'SKILL',
                            item['skill_targeted'].toString().toUpperCase(),
                          ),
                      ],
                    ),
                    if (item['choices'] != null &&
                        (item['choices'] as List).isNotEmpty) ...[
                      const SizedBox(height: 24),
                      Text(
                        'RESPONSE OPTIONS',
                        style: GoogleFonts.outfit(
                          fontSize: 10,
                          fontWeight: FontWeight.w900,
                          color: const Color(0xFF94A3B8),
                          letterSpacing: 1.5,
                        ),
                      ),
                      const SizedBox(height: 12),
                      for (var i = 0; i < (item['choices'] as List).length; i++)
                        _buildChoiceOutcome(
                          label: String.fromCharCode(65 + i),
                          text: (item['choices'] as List)[i].toString(),
                          isCorrect:
                              String.fromCharCode(65 + i) ==
                              item['correct_choice']?.toString(),
                          isCandidateAnswer:
                              String.fromCharCode(65 + i) ==
                              item['answer_text']?.toString(),
                        ),
                    ] else if ((item['answer_text'] ?? '')
                        .toString()
                        .trim()
                        .isNotEmpty) ...[
                      const SizedBox(height: 24),
                      _reportField(
                        'YOUR SUBMISSION',
                        (item['answer_text'] ?? '').toString(),
                      ),
                    ],
                    if ((item['explanation'] ?? item['reasoning'] ?? '')
                        .toString()
                        .trim()
                        .isNotEmpty) ...[
                      const SizedBox(height: 20),
                      _reportField(
                        'EXPERT FEEDBACK',
                        (item['explanation'] ?? item['reasoning'] ?? '')
                            .toString(),
                        isHighlight: true,
                      ),
                    ],
                  ],
                ),
              ),
            const SizedBox(height: 40),
          ],
        ),
      ),
    );
  }

  Widget _reportStat(String label, String value, {bool isBold = false}) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: GoogleFonts.outfit(
            fontSize: 10,
            fontWeight: FontWeight.w900,
            color: const Color(0xFF94A3B8),
            letterSpacing: 1,
          ),
        ),
        const SizedBox(height: 4),
        Text(
          value,
          style: GoogleFonts.outfit(
            fontSize: 16,
            fontWeight: isBold ? FontWeight.w900 : FontWeight.w700,
            color: isBold ? const Color(0xFF2563EB) : const Color(0xFF1E293B),
          ),
        ),
      ],
    );
  }

  Widget _reportField(
    String label,
    String content, {
    bool isHighlight = false,
  }) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: isHighlight ? const Color(0xFFEEF2FF) : const Color(0xFFF8FAFC),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(
          color: isHighlight
              ? const Color(0xFFE0E7FF)
              : const Color(0xFFF1F5F9),
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            label,
            style: GoogleFonts.outfit(
              fontSize: 10,
              fontWeight: FontWeight.w900,
              color: isHighlight
                  ? const Color(0xFF2563EB)
                  : const Color(0xFF64748B),
              letterSpacing: 1,
            ),
          ),
          const SizedBox(height: 10),
          Text(
            content,
            style: GoogleFonts.outfit(
              fontSize: 14,
              height: 1.6,
              fontWeight: FontWeight.w600,
              color: const Color(0xFF334155),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildChoiceOutcome({
    required String label,
    required String text,
    required bool isCorrect,
    required bool isCandidateAnswer,
  }) {
    final Color bgColor = isCandidateAnswer
        ? const Color(0xFFF1F5F9)
        : Colors.transparent;

    final Color borderColor = isCandidateAnswer
        ? const Color(0xFF2563EB)
        : const Color(0xFFF1F5F9);

    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      decoration: BoxDecoration(
        color: bgColor,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: borderColor,
          width: isCandidateAnswer ? 2 : 1,
        ),
      ),
      child: Row(
        children: [
          Container(
            width: 28,
            height: 28,
            decoration: BoxDecoration(
              color: isCandidateAnswer
                  ? const Color(0xFF2563EB)
                  : const Color(0xFF94A3B8),
              borderRadius: BorderRadius.circular(8),
            ),
            child: Center(
              child: Text(
                label,
                style: GoogleFonts.outfit(
                  color: Colors.white,
                  fontWeight: FontWeight.w900,
                  fontSize: 12,
                ),
              ),
            ),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Text(
              text,
              style: GoogleFonts.outfit(
                fontSize: 14,
                fontWeight: isCandidateAnswer
                    ? FontWeight.w700
                    : FontWeight.w500,
                color: isCandidateAnswer
                    ? const Color(0xFF1E293B)
                    : const Color(0xFF475569),
              ),
            ),
          ),
          if (isCandidateAnswer)
            const Text(
              'SELECTED',
              style: TextStyle(
                fontSize: 8,
                fontWeight: FontWeight.w900,
                color: Color(0xFF2563EB),
                letterSpacing: 1,
              ),
            ),
        ],
      ),
    );
  }

  Widget _stateCard(
    IconData icon,
    String title,
    String subtitle, {
    Widget? action,
    bool isSuccess = false,
  }) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 32),
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 600),
          padding: const EdgeInsets.all(32),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(40),
            boxShadow: [
              BoxShadow(
                color:
                    (isSuccess
                            ? const Color(0xFF10B981)
                            : const Color(0xFF0076C6))
                        .withValues(alpha: 0.1),
                blurRadius: 50,
                offset: const Offset(0, 20),
              ),
            ],
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                padding: const EdgeInsets.all(20),
                decoration: BoxDecoration(
                  color:
                      (isSuccess
                              ? const Color(0xFF10B981)
                              : const Color(0xFFE0F2FE))
                          .withValues(alpha: 0.1),
                  shape: BoxShape.circle,
                ),
                child: Icon(
                  icon,
                  size: 54,
                  color: isSuccess
                      ? const Color(0xFF10B981)
                      : const Color(0xFF0076C6),
                ),
              ),
              const SizedBox(height: 32),
              Text(
                title,
                textAlign: TextAlign.center,
                style: GoogleFonts.outfit(
                  fontSize: 26,
                  fontWeight: FontWeight.w900,
                  color: const Color(0xFF0F172A),
                  letterSpacing: -0.5,
                ),
              ),
              const SizedBox(height: 16),
              Text(
                subtitle,
                textAlign: TextAlign.center,
                style: GoogleFonts.outfit(
                  height: 1.6,
                  fontSize: 16,
                  color: const Color(0xFF64748B),
                  fontWeight: FontWeight.w500,
                ),
              ),
              if (action != null) ...[
                const SizedBox(height: 36),
                SizedBox(width: double.infinity, child: action),
              ],
            ],
          ),
        ),
      ),
    );
  }

  Widget _chip(String label, {bool dark = false, bool emphasis = false}) {
    final bg = dark
        ? Colors.white.withValues(alpha: 0.15)
        : (emphasis ? const Color(0xFFFFF1F2) : const Color(0xFFF1F7FB));
    final fg = dark
        ? Colors.white
        : (emphasis ? const Color(0xFFBE123C) : const Color(0xFF385268));
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(
        label,
        style: TextStyle(color: fg, fontSize: 12, fontWeight: FontWeight.w800),
      ),
    );
  }

  String _choiceLabel(Map<String, dynamic> choice, int index) {
    final fromLabel = (choice['label'] ?? '').toString().trim();
    if (fromLabel.isNotEmpty) return fromLabel;

    final fromKey = (choice['key'] ?? '').toString().trim();
    if (fromKey.isNotEmpty) return fromKey;

    final fromOption = (choice['option'] ?? '').toString().trim();
    if (fromOption.isNotEmpty) return fromOption;

    final alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    if (index >= 0 && index < alphabet.length) {
      return alphabet[index];
    }
    return '${index + 1}';
  }

  String _choiceText(Map<String, dynamic> choice) {
    final fromText = (choice['text'] ?? '').toString().trim();
    if (fromText.isNotEmpty) return fromText;

    final fromChoice = (choice['choice'] ?? '').toString().trim();
    if (fromChoice.isNotEmpty) return fromChoice;

    final fromValue = (choice['value'] ?? '').toString().trim();
    if (fromValue.isNotEmpty) return fromValue;

    final fromOptionText = (choice['option_text'] ?? '').toString().trim();
    if (fromOptionText.isNotEmpty) return fromOptionText;

    return '';
  }

  Map<String, dynamic> _payload(dynamic raw) {
    if (raw is Map<String, dynamic>) {
      final data = raw['data'];
      if (data is Map<String, dynamic>) return data;
      if (data is Map) return Map<String, dynamic>.from(data);
      return raw;
    }
    if (raw is Map) return Map<String, dynamic>.from(raw);
    return <String, dynamic>{};
  }

  Map<String, dynamic> _map(dynamic value) =>
      _mapOrNull(value) ?? <String, dynamic>{};
  Map<String, dynamic>? _mapOrNull(dynamic value) =>
      value is Map ? Map<String, dynamic>.from(value) : null;
  List<Map<String, dynamic>> _list(dynamic value) => value is List
      ? value.whereType<Map>().map((e) => Map<String, dynamic>.from(e)).toList()
      : const [];
  int? _int(dynamic value) =>
      value is num ? value.toInt() : int.tryParse((value ?? '').toString());
  double? _double(dynamic value) => value is num
      ? value.toDouble()
      : double.tryParse((value ?? '').toString());
  String _message(Object error, String fallback) {
    if (error is DioException) {
      final data = error.response?.data;
      if (data is Map) {
        final value = data['error'] ?? data['message'];
        if (value is String && value.trim().isNotEmpty) {
          return value.trim();
        }
      }
      if (error.message != null && error.message!.trim().isNotEmpty) {
        return error.message!.trim();
      }
    }
    return fallback;
  }

  String? _format(dynamic value) => value == null
      ? null
      : (DateTime.tryParse(value.toString()) == null
            ? null
            : DateFormat(
                'dd MMM, HH:mm',
              ).format(DateTime.parse(value.toString()).toLocal()));

  String _formatScore(double value) {
    final fixed = value.toStringAsFixed(2);
    if (fixed.endsWith('00')) {
      return value.toStringAsFixed(0);
    }
    if (fixed.endsWith('0')) {
      return fixed.substring(0, fixed.length - 1);
    }
    return fixed;
  }

  String _clock(int seconds) =>
      '${(seconds ~/ 60).toString().padLeft(2, '0')}:${(seconds % 60).toString().padLeft(2, '0')}';
}
