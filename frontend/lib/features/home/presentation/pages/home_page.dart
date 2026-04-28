import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:dio/dio.dart';
import 'package:recrutitn/l10n/app_localizations.dart';
import '../../../../core/constants/app_constants.dart';
import '../../../auth/domain/entities/user_entity.dart';
import '../../domain/entities/job_offer_entity.dart';
import '../../../auth/presentation/bloc/auth_bloc.dart';
import '../../../auth/presentation/bloc/auth_event.dart';
import '../../../auth/presentation/bloc/auth_state.dart';
import '../../../auth/presentation/pages/login_page.dart';
import '../bloc/home_bloc.dart';
import '../bloc/home_event.dart';
import '../bloc/home_state.dart';
import '../bloc/saved_jobs_bloc.dart';
import '../bloc/saved_jobs_state.dart';
import '../widgets/job_card.dart';
import '../widgets/candidate_card.dart';
import 'package:recrutitn/features/profile/presentation/pages/profile_page.dart';
import 'package:recrutitn/features/settings/presentation/pages/settings_page.dart';
import 'package:recrutitn/features/home/presentation/pages/favorites_page.dart';
import 'package:recrutitn/features/notifications/presentation/pages/notifications_page.dart';
import 'package:recrutitn/features/quiz/presentation/pages/candidate_quiz_page.dart';
import 'package:recrutitn/features/messages/presentation/pages/candidate_chat_page.dart';
import 'package:recrutitn/features/home/presentation/pages/apply_job_page.dart';
import 'package:recrutitn/injection_container.dart';
import 'package:recrutitn/core/services/notification_service.dart';

// â”€â”€â”€ Premium Design Tokens â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
class _P {
  static const Color bannerBlue = Color(0xFF0076C6);
  static const Color sky = Color(0xFF2BBDFF);
  static const Color skyLight = Color(0xFFE8F7FF);
  static const Color skyMid = Color(0xFFB3E6FF);
  static const Color ink = Color(0xFF0D1117);
  static const Color inkLight = Color(0xFF6B7280);
  static const Color inkFaint = Color(0xFFF3F8FC);
  static const Color white = Color(0xFFFFFFFF);
  static const Color border = Color(0xFFE2EDF5);

  static const double rXL = 28;
  static const double rM = 14;
  static const double rS = 10;
  static const double sidepad = 22;
}

class _CompanyApplicant {
  final int applicationId;
  final String name;
  final String specialty;
  final String location;
  final String jobTitle;
  final String status;
  final double matchScore;
  final double semanticScore;
  final double confidenceScore;
  final String explanation;
  final List<String> skills;

  const _CompanyApplicant({
    required this.applicationId,
    required this.name,
    required this.specialty,
    required this.location,
    required this.jobTitle,
    required this.status,
    required this.matchScore,
    required this.semanticScore,
    required this.confidenceScore,
    required this.explanation,
    required this.skills,
  });

  _CompanyApplicant copyWith({String? status}) {
    return _CompanyApplicant(
      applicationId: applicationId,
      name: name,
      specialty: specialty,
      location: location,
      jobTitle: jobTitle,
      status: status ?? this.status,
      matchScore: matchScore,
      semanticScore: semanticScore,
      confidenceScore: confidenceScore,
      explanation: explanation,
      skills: skills,
    );
  }

  static _CompanyApplicant fromJson(Map<String, dynamic> json) {
    final candidate = (json['candidate'] is Map)
        ? Map<String, dynamic>.from(json['candidate'] as Map)
        : <String, dynamic>{};
    final user = (candidate['user'] is Map)
        ? Map<String, dynamic>.from(candidate['user'] as Map)
        : <String, dynamic>{};
    final specialtyObj = (candidate['specialty'] is Map)
        ? Map<String, dynamic>.from(candidate['specialty'] as Map)
        : <String, dynamic>{};
    final jobOffer = (json['job_offer'] is Map)
        ? Map<String, dynamic>.from(json['job_offer'] as Map)
        : <String, dynamic>{};
    final explanationObj = (json['ai_explanation'] is Map)
        ? Map<String, dynamic>.from(json['ai_explanation'] as Map)
        : <String, dynamic>{};
    final explanationSummary =
        (explanationObj['summary'] ?? '').toString().trim();
    final aiError = (json['ai_error'] ?? '').toString().trim();

    final rawSkills = candidate['skills'];
    final parsedSkills = <String>[];
    if (rawSkills is List) {
      for (final entry in rawSkills) {
        if (entry is Map && entry['name'] != null) {
          parsedSkills.add(entry['name'].toString());
        } else if (entry is String) {
          parsedSkills.add(entry);
        }
      }
    }

    final fullName = (candidate['full_name'] ?? '').toString().trim();
    final firstName = (candidate['first_name'] ?? '').toString().trim();
    final lastName = (candidate['last_name'] ?? '').toString().trim();
    final fallbackName = [firstName, lastName]
        .where((part) => part.isNotEmpty)
        .join(' ')
        .trim();

    return _CompanyApplicant(
      applicationId: (json['id'] as num?)?.toInt() ?? 0,
      name: fullName.isNotEmpty
          ? fullName
          : (fallbackName.isNotEmpty ? fallbackName : 'Candidate'),
      specialty:
          (specialtyObj['name'] ?? candidate['specialite'] ?? 'No specialty')
              .toString(),
      location:
          (candidate['location'] ?? user['location'] ?? 'Unknown location')
              .toString(),
      jobTitle: (jobOffer['title'] ?? 'Untitled job').toString(),
      status: (json['status'] ?? 'pending').toString(),
      matchScore: _readScore(json['ai_match_score']),
      semanticScore: _readScore(json['ai_semantic_score']),
      confidenceScore: _readScore(json['ai_confidence_score']),
      explanation: explanationSummary.isNotEmpty ? explanationSummary : aiError,
      skills: parsedSkills,
    );
  }

  static double _readScore(dynamic value) {
    if (value is num) {
      final v = value.toDouble();
      if (v > 1) return (v / 100).clamp(0.0, 1.0);
      return v.clamp(0.0, 1.0);
    }
    if (value is String) {
      final parsed = double.tryParse(value.trim());
      if (parsed != null) {
        if (parsed > 1) return (parsed / 100).clamp(0.0, 1.0);
        return parsed.clamp(0.0, 1.0);
      }
    }
    return 0.0;
  }
}

class HomePage extends StatefulWidget {
  final UserEntity user;
  const HomePage({super.key, required this.user});

  @override
  State<HomePage> createState() => _HomePageState();
}

class _HomePageState extends State<HomePage>
    with SingleTickerProviderStateMixin {
  int _activeTab = 0;
  int _bottomNavIndex = 0;
  int _feedMotionSeed = 0;
  Set<int> _appliedJobIds = {};
  late AnimationController _fabController;
  late Animation<double> _fabScale;
  final TextEditingController _searchController = TextEditingController();
  String _searchQuery = '';
  bool _didFetchCompanyApplicants = false;
  bool _isLoadingCompanyApplicants = false;
  String? _companyApplicantsError;
  List<_CompanyApplicant> _companyApplicants = const [];
  final Set<int> _launchingInterviewIds = <int>{};
  StreamSubscription? _notifSubscription;
  StreamSubscription? _notifReceivedSubscription;
  int _unreadNotificationCount = 0;
  bool _drawerNavigationInProgress = false;
  final GlobalKey<ScaffoldState> _scaffoldKey = GlobalKey<ScaffoldState>();

  @override
  void initState() {
    super.initState();
    _fabController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 300),
    );
    _fabScale = CurvedAnimation(
      parent: _fabController,
      curve: Curves.elasticOut,
    );
    Future.delayed(const Duration(milliseconds: 600), () {
      if (mounted) _fabController.forward();
    });

    final notificationService = sl<NotificationService>();

    _notifSubscription = notificationService.notificationTapStream.listen((data) {
      if (!mounted) return;
      _handleNotificationClick(data);
      notificationService.markNotificationTapHandled(data);
    });
    _notifReceivedSubscription =
        notificationService.notificationReceivedStream.listen((_) {
          if (!mounted) return;
          setState(() {
            _unreadNotificationCount++;
          });
        });

    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      final pendingTap = notificationService.consumePendingNotificationTap();
      if (pendingTap != null) {
        _handleNotificationClick(pendingTap);
      }
    });

    _fetchAppliedJobIds();
    _loadUnreadNotificationCount();
  }

  Future<void> _fetchAppliedJobIds() async {
    final dio = sl<Dio>();
    try {
      final response = await dio.get(
        '${AppConstants.apiBaseUrl}/candidate/insights',
        options: Options(headers: {'Accept': 'application/json'}),
      );
      if (response.data is Map && response.data['data'] != null) {
        final data = response.data['data'];
        if (data['applied_jobs'] is List) {
          final Set<int> ids = {};
          for (final job in data['applied_jobs']) {
            final jobId = job['job_id'] ?? job['id'];
            if (jobId != null) {
              ids.add(int.parse(jobId.toString()));
            }
          }
          _log('Fetched ${_appliedJobIds.length} applied job IDs: $_appliedJobIds');
          if (mounted) {
            setState(() {
              _appliedJobIds = ids;
            });
          }
        } else {
          _log('applied_jobs is not a list in response');
        }
      } else {
        _log('Unexpected response structure from insights: ${response.data}');
      }
    } catch (e) {
      _log('Error fetching applied job IDs: $e');
    }
  }

  @override
  void dispose() {
    _fabController.dispose();
    _searchController.dispose();
    _notifSubscription?.cancel();
    _notifReceivedSubscription?.cancel();
    super.dispose();
  }

  Future<bool> _openQuizIfAvailable(int applicationId, {bool preferAi = false}) async {
    _log('Opening quiz for application $applicationId, preferAi: $preferAi');
    if (applicationId <= 0) {
      _log('Invalid applicationId: $applicationId');
      return false;
    }

    final dio = sl<Dio>();
    try {
      _log('Fetching quiz from API...');
      final queryParams = preferAi ? '?prefer_ai=1' : '';
      final response = await dio.get(
        '${AppConstants.apiBaseUrl}/candidate/applications/$applicationId/quiz$queryParams',
        options: Options(headers: {'Accept': 'application/json'}),
      );
      _log('Quiz API response: ${response.statusCode}');
      if (!mounted) return true;

      _log('Navigating to CandidateQuizPage with isAiQuiz: $preferAi...');
      await Navigator.push(
        context,
        MaterialPageRoute(
          builder: (_) => CandidateQuizPage(
            applicationId: applicationId,
            isAiQuiz: preferAi,
          ),
        ),
      );
      _log('Navigation complete');
      return true;
    } catch (e) {
      _log('Unable to open quiz for application $applicationId: $e');
      return false;
    }
  }

  Future<void> _handleNotificationClick(Map<String, dynamic> data) async {
    _log('Handling notification click: $data');
    final nestedData = data['data'];
    final payload = nestedData is Map
        ? {...Map<String, dynamic>.from(nestedData), ...data}
        : data;
    final type = payload['type']?.toString().toUpperCase();
    final title = payload['title']?.toString().toLowerCase() ?? '';
    final body = payload['body']?.toString().toLowerCase() ?? '';
    final applicationId = int.tryParse(
      (payload['application_id'] ?? payload['reference_id'] ?? '').toString(),
    );

    _log('Parsed notification - type: $type, applicationId: $applicationId, title: $title');

    final isQuizNotification = type == 'QUIZ_READY' ||
        type == 'QUIZ_COMPLETED' ||
        title.contains('quiz') ||
        title.contains('assessment') ||
        body.contains('quiz') ||
        body.contains('assessment');

    _log('isQuizNotification: $isQuizNotification');

    // Check if this is specifically an AI quiz notification
    final isAiQuizNotification = type == 'QUIZ_READY' ||
        payload['ai_generated'] == true ||
        payload['ai_generated'] == 'true';
    _log('isAiQuizNotification: $isAiQuizNotification');

    final isInterviewNotification = type == 'INTERVIEW_SCHEDULED' ||
        payload['title']?.toString().contains('entretien') == true ||
        payload['body']?.toString().contains('entretien') == true;
    final isChatNotification = type == 'INTERN_CHAT_MESSAGE' ||
        type == 'BINOME_INVITATION' ||
        type == 'BINOME_INVITATION_ACCEPTED' ||
        type == 'BINOME_INVITATION_REJECTED';

    if (applicationId != null &&
        applicationId > 0 &&
        (isQuizNotification || isInterviewNotification)) {
      final opened = await _openQuizIfAvailable(applicationId, preferAi: isAiQuizNotification);
      if (opened) {
        return;
      }
    }

    if (applicationId != null && applicationId > 0 && isChatNotification) {
      if (!mounted) return;
      await Navigator.push(
        context,
        MaterialPageRoute(
          builder: (_) => CandidateChatPage(
            initialApplicationId: applicationId,
          ),
        ),
      );
      return;
    }

    if (isInterviewNotification) {
      setState(() {
        _activeTab = 3; // Select "Already Applied" tab
        _feedMotionSeed++;
      });
    }
  }

  void _log(String msg) => debugPrint('[_HomePageState] $msg');

  Future<void> _loadUnreadNotificationCount() async {
    final dio = sl<Dio>();
    try {
      final response = await dio.get(
        '${AppConstants.apiBaseUrl}/notifications/unread-count',
        options: Options(headers: {'Accept': 'application/json'}),
      );
      final data = response.data is Map ? response.data['data'] : null;
      final count = data is Map ? data['unread_count'] : null;
      
      if (!mounted) return;
      setState(() {
        _unreadNotificationCount = count is int ? count : 0;
      });
    } catch (e) {
      _log('Error fetching unread notification count: $e');
    }
  }

  Future<void> _enableNotificationsFromUserAction() async {
    final ok = await sl<NotificationService>()
        .syncTokenToBackend(requestPermission: true);
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(
          ok
              ? 'Notifications enabled'
              : 'Notifications permission not granted',
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return BlocProvider(
      create: (context) => sl<HomeBloc>()..add(const FetchJobOffers()),
      child: BlocConsumer<AuthBloc, AuthState>(
        listener: (context, state) {
          if (state is AuthInitial) {
            Navigator.pushAndRemoveUntil(
              context,
              MaterialPageRoute(builder: (_) => const LoginPage()),
              (route) => false,
            );
          }
        },
        builder: (context, authState) {
          final user = (authState is AuthAuthenticated)
              ? authState.user
              : widget.user;
          final isCompany = user.role == 'entreprise';
          if (isCompany && !_didFetchCompanyApplicants) {
            _didFetchCompanyApplicants = true;
            _loadCompanyApplicants();
          }

          return AnnotatedRegion<SystemUiOverlayStyle>(
            value: SystemUiOverlayStyle.dark.copyWith(
              statusBarColor: Colors.transparent,
            ),
            child: Scaffold(
              key: _scaffoldKey,
              backgroundColor: _P.inkFaint,
              drawer: _buildDrawer(context, user),
              body: CustomScrollView(
                physics: const BouncingScrollPhysics(),
                slivers: [
                  _buildSliverHeader(context, user),
                  SliverToBoxAdapter(
                    child: _buildWelcomeBanner(context, user, isCompany),
                  ),
                  SliverToBoxAdapter(child: _buildSearchBar(isCompany)),
                  SliverToBoxAdapter(
                    child: _buildFilterTabs(context, isCompany),
                  ),
                  SliverToBoxAdapter(
                    child: Padding(
                      padding: const EdgeInsets.fromLTRB(
                        _P.sidepad,
                        24,
                        _P.sidepad,
                        12,
                      ),
                      child: _buildSectionLabel(
                        isCompany
                            ? (AppLocalizations.of(context)?.topTalents ??
                                'Top Talents')
                            : (AppLocalizations.of(context)?.recommendedOffers ??
                                'Recommended'),
                      ),
                    ),
                  ),
                  _buildContentList(context, user, isCompany),
                  const SliverToBoxAdapter(child: SizedBox(height: 120)),
                ],
              ),
              bottomNavigationBar: _buildBottomNavigation(context, user),
              floatingActionButton: isCompany ? _buildFAB(context) : null,
            ),
          );
        },
      ),
    );
  }

  Widget _buildSliverHeader(BuildContext context, UserEntity user) {
    return SliverAppBar(
      expandedHeight: 72,
      floating: true,
      pinned: true,
      snap: true,
      backgroundColor: _P.inkFaint,
      surfaceTintColor: Colors.transparent,
      elevation: 0,
      systemOverlayStyle: SystemUiOverlayStyle.dark,
      leading: Builder(
        builder: (ctx) => GestureDetector(
          onTap: () => Scaffold.of(ctx).openDrawer(),
          child: Container(
            margin: const EdgeInsets.all(10),
            decoration: BoxDecoration(
              color: _P.white,
              borderRadius: BorderRadius.circular(_P.rS),
              border: Border.all(color: _P.border),
              boxShadow: [
                BoxShadow(
                  color: _P.ink.withOpacity(0.05),
                  blurRadius: 8,
                  offset: const Offset(0, 3),
                ),
              ],
            ),
            child: const Icon(Icons.menu_rounded, color: _P.ink, size: 20),
          ),
        ),
      ),
      actions: [
        _buildNotifBell(),
        const SizedBox(width: 8),
        _buildAvatarButton(context, user),
        const SizedBox(width: _P.sidepad),
      ],
    );
  }

  Widget _buildNotifBell() {
    final badgeText = _unreadNotificationCount > 99
        ? '99+'
        : _unreadNotificationCount.toString();

    return GestureDetector(
      onTap: () {
        Navigator.push(
          context,
          MaterialPageRoute(builder: (_) => const NotificationsPage()),
        ).then((_) => _loadUnreadNotificationCount());
      },
      child: Stack(
        clipBehavior: Clip.none,
        children: [
          Container(
            width: 40,
            height: 40,
            margin: const EdgeInsets.only(top: 8),
            decoration: BoxDecoration(
              color: _P.white,
              borderRadius: BorderRadius.circular(_P.rS),
              border: Border.all(color: _P.border),
              boxShadow: [
                BoxShadow(
                  color: _P.ink.withOpacity(0.04),
                  blurRadius: 8,
                  offset: const Offset(0, 3),
                ),
              ],
            ),
            child: Center(
              child: Icon(
                _unreadNotificationCount > 0
                    ? Icons.notifications_rounded
                    : Icons.notifications_none_rounded,
                color: _P.ink,
                size: 20,
              ),
            ),
          ),
          if (_unreadNotificationCount > 0)
            Positioned(
              top: 2,
              right: -6,
              child: Container(
                constraints: const BoxConstraints(minWidth: 18, minHeight: 18),
                padding: const EdgeInsets.symmetric(horizontal: 5),
                decoration: BoxDecoration(
                  color: const Color(0xFFEF4444),
                  borderRadius: BorderRadius.circular(999),
                  border: Border.all(color: _P.white, width: 2),
                ),
                alignment: Alignment.center,
                child: Text(
                  badgeText,
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 10,
                    fontWeight: FontWeight.w900,
                    height: 1,
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }

  Widget _buildAvatarButton(BuildContext context, UserEntity user) {
    return GestureDetector(
      onTap: () => Navigator.push(
        context,
        MaterialPageRoute(builder: (_) => ProfilePage(user: user)),
      ),
      child: Container(
        width: 40,
        height: 40,
        margin: const EdgeInsets.only(top: 8),
        decoration: const BoxDecoration(shape: BoxShape.circle),
        child: ClipOval(
          child: user.photoPath != null
              ? Image.network(
                  user.photoPath!,
                  fit: BoxFit.cover,
                  errorBuilder: (_, __, ___) => _avatarInitial(user),
                )
              : _avatarInitial(user),
        ),
      ),
    );
  }

  Widget _avatarInitial(UserEntity user) {
    return Container(
      color: const Color(0xFFE2E8F0),
      child: Center(
        child: Text(
          user.name.isNotEmpty ? user.name[0].toUpperCase() : '?',
          style: const TextStyle(
            color: _P.ink,
            fontWeight: FontWeight.w800,
            fontSize: 16,
          ),
        ),
      ),
    );
  }

  Widget _buildWelcomeBanner(BuildContext context, UserEntity user, bool isCompany) {
    final first = user.name.trim().split(' ').first;
    return Container(
      margin: const EdgeInsets.fromLTRB(_P.sidepad, 8, _P.sidepad, 0),
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        color: _P.bannerBlue,
        borderRadius: BorderRadius.circular(_P.rXL),
        boxShadow: [
          BoxShadow(
            color: _P.sky.withOpacity(0.35),
            blurRadius: 28,
            offset: const Offset(0, 12),
          ),
        ],
      ),
      child: Row(
        children: [
          Expanded(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Hello, $first \u{1F44B}',
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 22,
                    fontWeight: FontWeight.w900,
                    letterSpacing: -0.6,
                  ),
                ),
                const SizedBox(height: 6),
                Text(
                  isCompany
                      ? 'Find your next star hire today.'
                      : 'Your dream job is one tap away.',
                  style: TextStyle(
                    color: Colors.white.withOpacity(0.82),
                    fontSize: 13,
                    fontWeight: FontWeight.w500,
                  ),
                ),
                const SizedBox(height: 16),
                _buildBannerPills(isCompany),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildBannerPills(bool isCompany) {
    final pills = isCompany
        ? [
            (Icons.people_alt_rounded, 'Top Talent'),
            (Icons.rocket_launch_rounded, 'AI Match'),
          ]
        : [
            (Icons.bolt_rounded, 'Fresh Jobs'),
            (Icons.tune_rounded, 'Smart Match'),
          ];

    return Row(
      children: pills
          .map(
            (p) => Padding(
              padding: const EdgeInsets.only(right: 8),
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                decoration: BoxDecoration(
                  color: Colors.white.withOpacity(0.18),
                  borderRadius: BorderRadius.circular(50),
                  border: Border.all(color: Colors.white.withOpacity(0.3)),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(p.$1, size: 12, color: Colors.white),
                    const SizedBox(width: 5),
                    Text(
                      p.$2,
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 11,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          )
          .toList(),
    );
  }

  Widget _buildSearchBar(bool isCompany) {
    if (isCompany) return const SizedBox(height: 8);

    return Padding(
      padding: const EdgeInsets.fromLTRB(_P.sidepad, 14, _P.sidepad, 2),
      child: Container(
        height: 48,
        decoration: BoxDecoration(
          color: _P.white,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: _P.border),
          boxShadow: [
            BoxShadow(
              color: _P.ink.withOpacity(0.04),
              blurRadius: 10,
              offset: const Offset(0, 4),
            ),
          ],
        ),
        child: TextField(
          controller: _searchController,
          onChanged: (value) {
            final next = value.trim();
            if (next == _searchQuery) return;
            setState(() {
              _searchQuery = next;
              _feedMotionSeed++;
            });
          },
          decoration: InputDecoration(
            border: InputBorder.none,
            hintText: 'Search jobs, companies, skills...',
            hintStyle: TextStyle(
              color: _P.inkLight.withOpacity(0.72),
              fontSize: 13.5,
              fontWeight: FontWeight.w500,
            ),
            prefixIcon: const Icon(Icons.search_rounded, color: Color(0xFF64748B), size: 20),
            suffixIcon: _searchQuery.isEmpty
                ? null
                : IconButton(
                    onPressed: () {
                      _searchController.clear();
                      setState(() {
                        _searchQuery = '';
                        _feedMotionSeed++;
                      });
                    },
                    icon: const Icon(Icons.close_rounded, color: Color(0xFF64748B), size: 18),
                  ),
          ),
        ),
      ),
    );
  }

  Widget _buildFilterTabs(BuildContext context, bool isCompany) {
    final tabs = isCompany
        ? ['All', 'Engineering', 'Design', 'Marketing']
        : ['All', 'Job', 'Internship', 'Already Applied'];

    return Padding(
      padding: const EdgeInsets.only(top: 20),
      child: Center(
        child: SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          padding: const EdgeInsets.symmetric(horizontal: _P.sidepad),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: List.generate(tabs.length, (i) {
              final active = _activeTab == i;
              
              return GestureDetector(
                onTap: () {
                  if (active) return;
                  setState(() {
                    _activeTab = i;
                    if (i == 3 && !isCompany) {
                      _fetchAppliedJobIds();
                    }
                    _feedMotionSeed++;
                  });
                },
                child: AnimatedContainer(
                  duration: const Duration(milliseconds: 220),
                  curve: Curves.easeInOut,
                  margin: const EdgeInsets.only(right: 10),
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                  decoration: BoxDecoration(
                    color: active ? _P.bannerBlue : _P.white,
                    borderRadius: BorderRadius.circular(50),
                    border: Border.all(color: active ? _P.bannerBlue : _P.border),
                    boxShadow: active
                        ? [
                            BoxShadow(
                              color: _P.bannerBlue.withOpacity(0.3),
                              blurRadius: 10,
                              offset: const Offset(0, 4),
                            ),
                          ]
                        : [],
                  ),
                  child: Text(
                    tabs[i],
                    style: TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w700,
                      color: active ? _P.white : _P.inkLight,
                    ),
                  ),
                ),
              );
            }),
          ),
        ),
      ),
    );
  }

  Widget _buildSectionLabel(String title) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(
          title,
          style: const TextStyle(
            fontSize: 18,
            fontWeight: FontWeight.w900,
            color: _P.ink,
            letterSpacing: -0.4,
          ),
        ),
        GestureDetector(
          onTap: () {
            setState(() {
              _activeTab = 0;
              _searchQuery = '';
              _searchController.clear();
              _feedMotionSeed++;
            });
            final authState = context.read<AuthBloc>().state;
            final currentRole = authState is AuthAuthenticated
                ? authState.user.role
                : widget.user.role;
            if (currentRole == 'entreprise') {
              _loadCompanyApplicants(forceRefresh: true);
            } else {
              context.read<HomeBloc>().add(const RefreshJobOffers());
            }
          },
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
            decoration: BoxDecoration(
              color: _P.skyLight,
              borderRadius: BorderRadius.circular(50),
            ),
            child: const Text(
              'View all',
              style: TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w700,
                color: _P.bannerBlue,
              ),
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildContentList(BuildContext context, UserEntity user, bool isCompany) {
    if (isCompany) {
      if (_isLoadingCompanyApplicants && _companyApplicants.isEmpty) {
        return const SliverToBoxAdapter(
          child: Padding(
            padding: EdgeInsets.symmetric(vertical: 60),
            child: Center(child: _PremiumLoader()),
          ),
        );
      }
      if (_companyApplicantsError != null && _companyApplicants.isEmpty) {
        return SliverToBoxAdapter(
          child: _EmptyState(
            icon: Icons.cloud_off_rounded,
            title: 'Cannot load applicants',
            subtitle: _companyApplicantsError!,
            action: ElevatedButton.icon(
              onPressed: () => _loadCompanyApplicants(forceRefresh: true),
              icon: const Icon(Icons.refresh_rounded, size: 16),
              label: const Text('Retry'),
              style: ElevatedButton.styleFrom(
                backgroundColor: _P.sky,
                foregroundColor: _P.white,
                elevation: 0,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
              ),
            ),
          ),
        );
      }
      if (_companyApplicants.isEmpty) {
        return const SliverToBoxAdapter(
          child: _EmptyState(
            icon: Icons.groups_2_outlined,
            title: 'No applicants yet',
            subtitle: 'Candidate applications will appear here.',
          ),
        );
      }
      return SliverPadding(
        padding: const EdgeInsets.symmetric(horizontal: _P.sidepad),
        sliver: SliverList(
          delegate: SliverChildBuilderDelegate((ctx, i) {
            final applicant = _companyApplicants[i];
            return CandidateCard(
              key: ValueKey('applicant_${applicant.applicationId}'),
              name: applicant.name,
              specialty: applicant.specialty,
              location: applicant.location,
              matchScore: applicant.matchScore,
              semanticScore: applicant.semanticScore,
              confidenceScore: applicant.confidenceScore,
              explanation: applicant.explanation,
              skills: applicant.skills.isNotEmpty ? applicant.skills : const ['No declared skills'],
              jobTitle: applicant.jobTitle,
              isLaunchingInterview: _launchingInterviewIds.contains(applicant.applicationId),
              launchInterviewLabel: applicant.status == 'viewed' ? 'Interview launched' : 'Lancer interview',
              onLaunchInterview: applicant.status == 'viewed' ? null : () => _launchInterview(applicant),
            );
          }, childCount: _companyApplicants.length),
        ),
      );
    }



    return SliverToBoxAdapter(
      child: BlocBuilder<HomeBloc, HomeState>(
        builder: (context, state) {
          if (state is HomeLoading) {
            return const Padding(
              padding: EdgeInsets.symmetric(vertical: 60),
              child: Center(child: _PremiumLoader()),
            );
          }
          if (state is HomeError) {
            return _EmptyState(
              icon: Icons.cloud_off_rounded,
              title: 'Connection issue',
              subtitle: state.message,
              action: ElevatedButton.icon(
                onPressed: () => context.read<HomeBloc>().add(const FetchJobOffers()),
                icon: const Icon(Icons.refresh_rounded, size: 16),
                label: const Text('Try again'),
                style: ElevatedButton.styleFrom(
                  backgroundColor: Color(0xFFE0F2FE),
                  foregroundColor: Color(0xFF0369A1),
                  elevation: 0,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
                ),
              ),
            );
          }
          if (state is HomeLoaded && state.jobOffers.isEmpty) {
            return const _EmptyState(
              icon: Icons.work_off_rounded,
              title: 'No offers yet',
              subtitle: 'Check back soon for new opportunities.',
            );
          }
          if (state is HomeLoaded) {
            final query = _searchQuery.toLowerCase();
            final filteredOffers = state.jobOffers.where((job) {
              final searchable = <String>[
                job.title,
                job.companyName,
                job.location,
                job.description,
                job.offerType,
                job.contractType,
                job.department,
                ...job.skills,
              ].where((value) => value.trim().isNotEmpty).join(' ').toLowerCase();
              final matchesSearch = query.isEmpty || searchable.contains(query);
              if (!matchesSearch) return false;

              if (_activeTab == 0) return true;

              final type = job.offerType.toLowerCase();
              final contract = job.contractType.toLowerCase();
              final isInternship =
                  type.contains('intern') || contract.contains('intern');

              if (_activeTab == 1) {
                return !isInternship;
              }
              if (_activeTab == 2) {
                return isInternship;
              }
              if (_activeTab == 3) {
                return _appliedJobIds.contains(job.id);
              }
              return true;
            }).toList();
            
            if (filteredOffers.isEmpty) {
              return _EmptyState(
                icon: Icons.search_off_rounded,
                title: 'No matching jobs',
                subtitle: 'Try another keyword or filter.',
              );
            }
            
            return Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16.0),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: filteredOffers.map((job) {
                  return _FeedStaggerReveal(
                    index: filteredOffers.indexOf(job),
                    seed: _feedMotionSeed,
                    child: GestureDetector(
                      onTap: () {
                        Navigator.push(
                          context,
                          MaterialPageRoute(
                            builder: (_) => ApplyJobPage(job: job),
                          ),
                        );
                      },
                      child: JobCard(
                        job: job,
                        title: job.title,
                        company: job.companyName,
                        location: job.location,
                        salary: job.budget > 0 ? ' TND' : 'Negotiable',
                        description: job.description,
                        datePosted: job.datePosted,
                        tags: [job.offerType, if (job.contractType.isNotEmpty) job.contractType, job.department],
                        logoUrl: job.companyLogo,
                      ),
                    ),
                  );
                }).toList(),
              ),
            );
          }
          return const SizedBox.shrink();
        },
      ),
    );
  }

  Future<void> _loadCompanyApplicants({bool forceRefresh = false}) async {
    if (_isLoadingCompanyApplicants) return;
    if (mounted) {
      setState(() {
        _isLoadingCompanyApplicants = true;
        if (forceRefresh) _companyApplicantsError = null;
      });
    }
    try {
      final response = await sl<Dio>().get('${AppConstants.apiBaseUrl}/company/applicants');
      final payload = response.data;
      final rawList = (payload is Map<String, dynamic>) ? payload['data'] : null;
      final applicants = <_CompanyApplicant>[];
      if (rawList is List) {
        for (final item in rawList) {
          if (item is Map<String, dynamic>) applicants.add(_CompanyApplicant.fromJson(item));
        }
      }
      applicants.sort((a, b) => b.matchScore.compareTo(a.matchScore));
      if (!mounted) return;
      setState(() {
        _companyApplicants = applicants;
        _companyApplicantsError = null;
        _isLoadingCompanyApplicants = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _companyApplicantsError = 'Unable to fetch applicants right now.';
        _isLoadingCompanyApplicants = false;
      });
    }
  }

  Future<void> _launchInterview(_CompanyApplicant applicant) async {
    if (_launchingInterviewIds.contains(applicant.applicationId)) return;
    setState(() => _launchingInterviewIds.add(applicant.applicationId));
    try {
      await sl<Dio>().post('${AppConstants.apiBaseUrl}/company/applications/${applicant.applicationId}/launch-interview');
      if (!mounted) return;
      setState(() {
        _companyApplicants = _companyApplicants.map((item) {
          if (item.applicationId == applicant.applicationId) return item.copyWith(status: 'viewed');
          return item;
        }).toList();
      });
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Interview launched for ${applicant.name}')));
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Failed to launch interview.')));
    } finally {
      if (mounted) setState(() => _launchingInterviewIds.remove(applicant.applicationId));
    }
  }

  Widget _buildFAB(BuildContext context) {
    return ScaleTransition(
      scale: _fabScale,
      child: Container(
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(18),
          gradient: const LinearGradient(colors: [Color(0xFF2BBDFF), Color(0xFF0076C6)]),
          boxShadow: [BoxShadow(color: _P.sky.withOpacity(0.45), blurRadius: 20, offset: const Offset(0, 8))],
        ),
        child: FloatingActionButton.extended(
          onPressed: () {},
          backgroundColor: Colors.transparent,
          elevation: 0,
          icon: const Icon(Icons.add_rounded, color: Colors.white, size: 20),
          label: const Text('Post Offer', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w800, fontSize: 14)),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(18)),
        ),
      ),
    );
  }

  Widget _buildBottomNavigation(BuildContext context, UserEntity user) {
    const messagesIndex = 1;
    final notificationsIndex = 2;
    final profileIndex = 3;

    return Container(
      height: 90,
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: const BorderRadius.only(
          topLeft: Radius.circular(30),
          topRight: Radius.circular(30),
        ),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.04),
            blurRadius: 20,
            offset: const Offset(0, -4),
          ),
        ],
      ),
      child: SafeArea(
        child: Row(
          mainAxisAlignment: MainAxisAlignment.spaceAround,
          children: [
            _bottomNavItem(
              index: 0,
              icon: Icons.home_rounded,
              activeIcon: Icons.home_rounded,
              onTap: () => _onBottomNavTap(0, user),
            ),
            _bottomNavItem(
              index: messagesIndex,
              icon: Icons.chat_bubble_outline_rounded,
              activeIcon: Icons.chat_bubble_rounded,
              onTap: () => _onBottomNavTap(messagesIndex, user),
            ),
            _bottomNavItem(
              index: notificationsIndex,
              icon: Icons.notifications_none_rounded,
              activeIcon: Icons.notifications_rounded,
              badgeCount: _unreadNotificationCount,
              onTap: () => _onBottomNavTap(notificationsIndex, user),
            ),
            _bottomNavItem(
              index: profileIndex,
              icon: Icons.person_outline_rounded,
              activeIcon: Icons.person_rounded,
              onTap: () => _onBottomNavTap(profileIndex, user),
            ),
          ],
        ),
      ),
    );
  }

  Widget _bottomNavItem({
    required int index,
    required IconData icon,
    required IconData activeIcon,
    required VoidCallback onTap,
    int badgeCount = 0,
  }) {
    final active = _bottomNavIndex == index;
    final badgeText = badgeCount > 99 ? '99+' : badgeCount.toString();
    
    return Expanded(
      child: InkWell(
        onTap: onTap,
        splashColor: Colors.transparent,
        highlightColor: Colors.transparent,
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Stack(
              clipBehavior: Clip.none,
              children: [
                Icon(
                  active ? activeIcon : icon,
                  size: 28,
                  color: active ? const Color(0xFF1C2434) : const Color(0xFF1C2434).withOpacity(0.5),
                ),
                if (badgeCount > 0)
                  Positioned(
                    top: -4,
                    right: -6,
                    child: Container(
                      padding: const EdgeInsets.all(2),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        shape: BoxShape.circle,
                      ),
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 2),
                        constraints: const BoxConstraints(minWidth: 16, minHeight: 16),
                        decoration: BoxDecoration(
                          color: const Color(0xFFEF4444),
                          borderRadius: BorderRadius.circular(10),
                        ),
                        child: Text(
                          badgeText,
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 9,
                            fontWeight: FontWeight.w900,
                          ),
                        ),
                      ),
                    ),
                  ),
              ],
            ),
            const SizedBox(height: 8),
            AnimatedContainer(
              duration: const Duration(milliseconds: 200),
              height: 3,
              width: active ? 24 : 0,
              decoration: BoxDecoration(
                color: const Color(0xFF4361EE),
                borderRadius: BorderRadius.circular(2),
              ),
            ),
          ],
        ),
      ),
    );
  }

  void _onBottomNavTap(int index, UserEntity user) {
    if (index == _bottomNavIndex) return;

    if (index == 0) {
      setState(() => _bottomNavIndex = 0);
      return;
    }

    setState(() => _bottomNavIndex = index);

    if (index == 1) { // Messages
      Navigator.push(context, MaterialPageRoute(builder: (_) => const CandidateChatPage())).then((_) {
        if (!mounted) return;
        setState(() => _bottomNavIndex = 0);
      });
      return;
    }

    if (index == 2) { // Notifications
      Navigator.push(context, MaterialPageRoute(builder: (_) => const NotificationsPage())).then((_) {
        if (!mounted) return;
        setState(() => _bottomNavIndex = 0);
        _loadUnreadNotificationCount();
      });
      return;
    }

    if (index == 3) { // Profile
      Navigator.push(context, MaterialPageRoute(builder: (_) => ProfilePage(user: user))).then((_) {
        if (!mounted) return;
        setState(() => _bottomNavIndex = 0);
      });
    }
  }

  Widget _buildDrawer(BuildContext context, UserEntity user) {
    return Drawer(
      backgroundColor: Colors.transparent,
      elevation: 0,
      width: MediaQuery.of(context).size.width * 0.82,
      child: _AnimatedDrawerContent(
        user: user,
        onNavAction: (action) {
          unawaited(_handleDrawerAction(action, user));
        },
      ),
    );
  }

  Future<void> _handleDrawerAction(_DrawerAction action, UserEntity user) async {
    if (_drawerNavigationInProgress) return;
    _drawerNavigationInProgress = true;
    try {
      final scaffoldState = _scaffoldKey.currentState;
      if (scaffoldState?.isDrawerOpen == true) {
        scaffoldState?.closeDrawer();
        await Future<void>.delayed(const Duration(milliseconds: 280));
      }

      if (action == _DrawerAction.close) {
        return;
      }

      if (action == _DrawerAction.logout) {
        if (!mounted) return;
        context.read<AuthBloc>().add(LogoutEvent());
        return;
      }

      if (!mounted) return;

      if (action == _DrawerAction.profile) {
        await Navigator.of(context).push(
          MaterialPageRoute(builder: (_) => ProfilePage(user: user)),
        );
        return;
      }

      if (action == _DrawerAction.favorites) {
        await Navigator.of(context).push(
          MaterialPageRoute(builder: (_) => const FavoritesPage()),
        );
        return;
      }

      if (action == _DrawerAction.marketInsights) {
        setState(() {
          _activeTab = 3; // Select "Already Applied" tab
          _feedMotionSeed++;
        });
        return;
      }

      if (action == _DrawerAction.settings) {
        await Navigator.of(context).push(
          MaterialPageRoute(builder: (_) => const SettingsPage()),
        );
        return;
      }

      if (action == _DrawerAction.messages) {
        await Navigator.of(context).push(
          MaterialPageRoute(builder: (_) => const CandidateChatPage()),
        );
      }
    } finally {
      _drawerNavigationInProgress = false;
    }
  }
}

enum _DrawerAction { close, profile, favorites, marketInsights, settings, messages, logout }

class _AnimatedDrawerContent extends StatefulWidget {
  final UserEntity user;
  final void Function(_DrawerAction) onNavAction;
  const _AnimatedDrawerContent({required this.user, required this.onNavAction});
  @override
  State<_AnimatedDrawerContent> createState() => _AnimatedDrawerContentState();
}

class _AnimatedDrawerContentState extends State<_AnimatedDrawerContent> with SingleTickerProviderStateMixin {
  late AnimationController _ctrl;
  late Animation<double> _fadeAnim;
  late Animation<Offset> _slideAnim;
  int? _hoveredIndex;

  @override
  void initState() {
    super.initState();
    _ctrl = AnimationController(vsync: this, duration: const Duration(milliseconds: 480));
    _fadeAnim = CurvedAnimation(parent: _ctrl, curve: Curves.easeOut);
    _slideAnim = Tween<Offset>(begin: const Offset(-0.06, 0), end: Offset.zero).animate(CurvedAnimation(parent: _ctrl, curve: Curves.easeOutCubic));
    _ctrl.forward();
  }

  @override
  void dispose() { _ctrl.dispose(); super.dispose(); }

  @override
  Widget build(BuildContext context) {
    return SlideTransition(
      position: _slideAnim,
      child: FadeTransition(
        opacity: _fadeAnim,
        child: Container(
          decoration: const BoxDecoration(
            color: Color(0xFFFAFCFF),
            borderRadius: BorderRadius.only(topRight: Radius.circular(32), bottomRight: Radius.circular(32)),
            boxShadow: [BoxShadow(color: Color(0x14000000), blurRadius: 40, offset: Offset(8, 0))],
          ),
          child: Column(
            children: [
              _buildHeader(),
              _buildDivider(),
              Expanded(
                child: BlocBuilder<SavedJobsBloc, SavedJobsState>(
                  builder: (ctx, savedState) {
                    final savedCount = savedState is SavedJobsLoaded ? savedState.savedJobs.length : 0;
                    return _buildNavList(savedCount);
                  },
                ),
              ),
              _buildFooter(),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildHeader() {
    final user = widget.user;
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.fromLTRB(24, 60, 24, 24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          Stack(
            children: [
              Container(
                width: 72, height: 72,
                decoration: BoxDecoration(shape: BoxShape.circle, color: Colors.white, boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.05), blurRadius: 10, offset: const Offset(0, 4))]),
                padding: const EdgeInsets.all(2),
                child: ClipOval(
                  child: user.photoPath != null
                      ? Image.network(user.photoPath!, fit: BoxFit.cover, errorBuilder: (_, __, ___) => _avatarFallback(user.name))
                      : _avatarFallback(user.name),
                ),
              ),
              Positioned(bottom: 2, right: 4, child: Container(width: 14, height: 14, decoration: BoxDecoration(color: const Color(0xFF22C55E), shape: BoxShape.circle, border: Border.all(color: const Color(0xFFFAFCFF), width: 2)))),
            ],
          ),
          const SizedBox(height: 16),
          Text(user.name, textAlign: TextAlign.center, style: GoogleFonts.outfit(fontSize: 20, fontWeight: FontWeight.w800, color: const Color(0xFF0D1117), letterSpacing: -0.5, height: 1.1)),
        ],
      ),
    );
  }

  Widget _avatarFallback(String name) {
    return Container(
      decoration: const BoxDecoration(gradient: LinearGradient(colors: [Color(0xFF60C8FF), Color(0xFF0076C6)], begin: Alignment.topLeft, end: Alignment.bottomRight)),
      child: Center(child: Text(name.isNotEmpty ? name[0].toUpperCase() : '?', style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w800, fontSize: 22))),
    );
  }

  Widget _buildDivider() {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 20),
      child: Container(height: 1, decoration: BoxDecoration(gradient: LinearGradient(colors: [Colors.transparent, const Color(0xFFE2EDF5), Colors.transparent]))),
    );
  }

  Widget _buildNavList(int savedCount) {
    final items = [
      _DrawerNavItem(icon: Icons.grid_view_rounded, label: 'Dashboard', action: _DrawerAction.close, isActive: true),
      _DrawerNavItem(icon: Icons.person_outline_rounded, label: 'My Profile', action: _DrawerAction.profile),
      _DrawerNavItem(icon: Icons.favorite_border_rounded, label: 'Favorites', action: _DrawerAction.favorites, badge: savedCount > 0 ? '$savedCount' : null),

      _DrawerNavItem(icon: Icons.chat_bubble_outline_rounded, label: 'Chats', action: _DrawerAction.messages),
      _DrawerNavItem(icon: Icons.settings_outlined, label: 'Settings', action: _DrawerAction.settings),
    ];
    return ListView.builder(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
      itemCount: items.length,
      itemBuilder: (ctx, i) {
        return _DrawerNavTile(
          item: items[i], index: i, isHovered: _hoveredIndex == i,
          onHoverChange: (h) => setState(() => _hoveredIndex = h ? i : null),
          onTap: () => widget.onNavAction(items[i].action),
          animationController: _ctrl,
        );
      },
    );
  }

  Widget _buildFooter() {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 0, 16, 32),
      child: Column(
        children: [
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 8),
            child: Container(height: 1, decoration: BoxDecoration(gradient: LinearGradient(colors: [Colors.transparent, const Color(0xFFE2EDF5), Colors.transparent]))),
          ),
          _LogoutTile(onTap: () => widget.onNavAction(_DrawerAction.logout)),
        ],
      ),
    );
  }
}

class _DrawerNavItem {
  final IconData icon; final String label; final _DrawerAction action; final bool isActive; final String? badge;
  const _DrawerNavItem({required this.icon, required this.label, required this.action, this.isActive = false, this.badge});
}

class _DrawerNavTile extends StatefulWidget {
  final _DrawerNavItem item; final int index; final bool isHovered; final void Function(bool) onHoverChange; final VoidCallback onTap; final AnimationController animationController;
  const _DrawerNavTile({required this.item, required this.index, required this.isHovered, required this.onHoverChange, required this.onTap, required this.animationController});
  @override State<_DrawerNavTile> createState() => _DrawerNavTileState();
}

class _DrawerNavTileState extends State<_DrawerNavTile> with SingleTickerProviderStateMixin {
  late Animation<double> _staggerAnim; bool _pressed = false;
  @override
  void initState() {
    super.initState();
    final start = (widget.index * 0.08).clamp(0.0, 0.6);
    _staggerAnim = CurvedAnimation(parent: widget.animationController, curve: Interval(start, (start + 0.4).clamp(0.0, 1.0), curve: Curves.easeOutCubic));
  }
  @override
  Widget build(BuildContext context) {
    final item = widget.item;
    return AnimatedBuilder(
      animation: _staggerAnim,
      builder: (ctx, child) {
        final t = _staggerAnim.value;
        return Opacity(opacity: t, child: Transform.translate(offset: Offset(-16 * (1 - t), 0), child: child));
      },
      child: GestureDetector(
        onTap: widget.onTap,
        onTapDown: (_) => setState(() => _pressed = true),
        onTapUp: (_) => setState(() => _pressed = false),
        onTapCancel: () => setState(() => _pressed = false),
        child: MouseRegion(
          onEnter: (_) => widget.onHoverChange(true), onExit: (_) => widget.onHoverChange(false),
          child: AnimatedContainer(
            duration: const Duration(milliseconds: 160), curve: Curves.easeOut, margin: const EdgeInsets.only(bottom: 2), padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
            decoration: BoxDecoration(color: item.isActive ? const Color(0xFFEBF5FF) : _pressed ? const Color(0xFFF0F8FF) : Colors.transparent, borderRadius: BorderRadius.circular(14), border: item.isActive ? Border.all(color: const Color(0xFFBEDEF7), width: 1) : Border.all(color: Colors.transparent)),
            child: Row(
              children: [
                AnimatedContainer(duration: const Duration(milliseconds: 160), width: 36, height: 36, decoration: BoxDecoration(color: item.isActive ? const Color(0xFF0076C6) : const Color(0xFFF1F5F9), borderRadius: BorderRadius.circular(10)), child: Center(child: Icon(item.icon, size: 17, color: item.isActive ? Colors.white : const Color(0xFF64748B)))),
                const SizedBox(width: 12),
                Expanded(child: Text(item.label, style: TextStyle(fontSize: 14, fontWeight: item.isActive ? FontWeight.w700 : FontWeight.w500, color: item.isActive ? const Color(0xFF0076C6) : const Color(0xFF374151), letterSpacing: -0.1))),
                if (item.badge != null) Container(padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2), decoration: BoxDecoration(color: item.isActive ? const Color(0xFF0076C6) : const Color(0xFFE8F7FF), borderRadius: BorderRadius.circular(20)), child: Text(item.badge!, style: TextStyle(fontSize: 10, fontWeight: FontWeight.w800, color: item.isActive ? Colors.white : const Color(0xFF0076C6))))
                else Icon(Icons.chevron_right_rounded, size: 16, color: item.isActive ? const Color(0xFF0076C6) : const Color(0xFFCBD5E1)),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _LogoutTile extends StatefulWidget {
  final VoidCallback onTap; const _LogoutTile({required this.onTap});
  @override State<_LogoutTile> createState() => _LogoutTileState();
}

class _LogoutTileState extends State<_LogoutTile> {
  bool _pressed = false;
  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: widget.onTap,
      onTapDown: (_) => setState(() => _pressed = true),
      onTapUp: (_) => setState(() => _pressed = false),
      onTapCancel: () => setState(() => _pressed = false),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 150), padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12), 
        decoration: BoxDecoration(color: _pressed ? const Color(0xFFFEF2F2) : const Color(0xFFFFF5F5), borderRadius: BorderRadius.circular(14), border: Border.all(color: _pressed ? const Color(0xFFFCA5A5) : const Color(0xFFFFE4E4))),
        child: Row(
          children: [
            Container(width: 36, height: 36, decoration: BoxDecoration(color: const Color(0xFFFFE4E4), borderRadius: BorderRadius.circular(10)), child: const Center(child: Icon(Icons.logout_rounded, size: 17, color: Color(0xFFEF4444)))),
            const SizedBox(width: 12),
            const Expanded(child: Text('Log out', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: Color(0xFFEF4444), letterSpacing: -0.1))),
            const Icon(Icons.chevron_right_rounded, size: 16, color: Color(0xFFFCA5A5)),
          ],
        ),
      ),
    );
  }
}

class _FeedStaggerReveal extends StatelessWidget {
  final int index; final int seed; final Widget child;
  const _FeedStaggerReveal({required this.index, required this.seed, required this.child});
  @override
  Widget build(BuildContext context) {
    return TweenAnimationBuilder<double>(
      key: ValueKey('feed_reveal_${seed}_$index'), tween: Tween(begin: 0, end: 1), duration: const Duration(milliseconds: 760), curve: Curves.easeOutCubic,
      builder: (context, value, _) {
        final start = (index * 0.085).clamp(0.0, 0.55);
        final local = ((value - start) / (1 - start)).clamp(0.0, 1.0);
        final dy = (1 - local) * 18;
        return Opacity(opacity: local, child: Transform.translate(offset: Offset(0, dy), child: child));
      },
    );
  }
}

class _PremiumLoader extends StatefulWidget {
  const _PremiumLoader();
  @override State<_PremiumLoader> createState() => _PremiumLoaderState();
}

class _PremiumLoaderState extends State<_PremiumLoader> with SingleTickerProviderStateMixin {
  late AnimationController _ctrl; late Animation<double> _anim;
  @override
  void initState() {
    super.initState();
    _ctrl = AnimationController(vsync: this, duration: const Duration(milliseconds: 900))..repeat(reverse: true);
    _anim = CurvedAnimation(parent: _ctrl, curve: Curves.easeInOut);
  }
  @override void dispose() { _ctrl.dispose(); super.dispose(); }
  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _anim,
      builder: (_, __) {
        return Container(
          width: 52, height: 52,
          decoration: BoxDecoration(color: Color.lerp(const Color(0xFFE8F7FF), const Color(0xFFB3E6FF), _anim.value), shape: BoxShape.circle),
          child: const Icon(Icons.work_rounded, color: Color(0xFF2BBDFF), size: 24),
        );
      },
    );
  }
}

class _EmptyState extends StatelessWidget {
  final IconData icon; final String title; final String subtitle; final Widget? action;
  const _EmptyState({required this.icon, required this.title, required this.subtitle, this.action});
  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 40, vertical: 48),
      child: Column(
        children: [
          Container(width: 80, height: 80, decoration: const BoxDecoration(color: Color(0xFFE8F7FF), shape: BoxShape.circle), child: Icon(icon, color: const Color(0xFF2BBDFF), size: 36)),
          const SizedBox(height: 20),
          Text(title, style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w800, color: Color(0xFF0D1117), letterSpacing: -0.3), textAlign: TextAlign.center),
          const SizedBox(height: 8),
          Text(subtitle, style: const TextStyle(fontSize: 14, color: Color(0xFF6B7280)), textAlign: TextAlign.center),
          if (action != null) ...[const SizedBox(height: 24), action!],
        ],
      ),
    );
  }
}
