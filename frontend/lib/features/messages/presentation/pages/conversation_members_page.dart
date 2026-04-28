import 'dart:math' show pi;
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';

/// ===============================
/// Light Theme Design Tokens
/// ===============================
class _PremiumColors {
  static const Color background = Color(0xFFFFFFFF);
  static const Color surface = Color(0xFFFFFFFF);
  static const Color card = Color(0xFFFFFFFF);
  static const Color accent = Color(0xFF3B82F6);
  static const Color accentLight = Color(0xFF60A5FA);
  static const Color online = Color(0xFF10B981);
  static const Color offline = Color(0xFF94A3B8);
  static const Color textPrimary = Color(0xFF1E293B);
  static const Color textSecondary = Color(0xFF64748B);
  static const Color textMuted = Color(0xFF94A3B8);
  static const Color recruiter = Color(0xFF3B82F6);
  static const Color candidate = Color(0xFF10B981);
  static const Color binome = Color(0xFFF59E0B);
  static const Color border = Color(0xFFE2E8F0);
}

class _PremiumSpacing {
  static const double xs = 4;
  static const double sm = 8;
  static const double md = 16;
  static const double lg = 24;
  static const double xl = 32;
}

/// ===============================
/// Conversation Members Page - Premium Edition
/// ===============================
class ConversationMembersPage extends StatefulWidget {
  final Map<String, dynamic> conversation;
  final Map<String, dynamic> recruiterPresence;

  const ConversationMembersPage({
    super.key,
    required this.conversation,
    required this.recruiterPresence,
  });

  @override
  State<ConversationMembersPage> createState() => _ConversationMembersPageState();
}

class _ConversationMembersPageState extends State<ConversationMembersPage>
    with TickerProviderStateMixin {
  late AnimationController _pageController;
  late AnimationController _pulseController;
  late List<Animation<Offset>> _slideAnimations;
  late List<Animation<double>> _fadeAnimations;
  late List<Animation<double>> _scaleAnimations;
  late Animation<double> _headerAnimation;
  late Animation<double> _glowAnimation;
  bool _isLoaded = false;

  @override
  void initState() {
    super.initState();
    SystemChrome.setSystemUIOverlayStyle(
      const SystemUiOverlayStyle(
        statusBarColor: Colors.transparent,
        statusBarIconBrightness: Brightness.dark,
        systemNavigationBarColor: _PremiumColors.background,
        systemNavigationBarIconBrightness: Brightness.dark,
      ),
    );

    _pageController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1200),
    );

    _pulseController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 2000),
    )..repeat(reverse: true);

    final memberCount = _getMembers().length;
    
    // Staggered entrance animations
    _slideAnimations = List.generate(
      memberCount,
      (index) => Tween<Offset>(
        begin: const Offset(0, 0.5),
        end: Offset.zero,
      ).animate(
        CurvedAnimation(
          parent: _pageController,
          curve: Interval(
            0.3 + (index * 0.12),
            0.7 + (index * 0.12),
            curve: Curves.easeOutBack,
          ),
        ),
      ),
    );

    _fadeAnimations = List.generate(
      memberCount,
      (index) => Tween<double>(begin: 0, end: 1).animate(
        CurvedAnimation(
          parent: _pageController,
          curve: Interval(
            0.3 + (index * 0.12),
            0.6 + (index * 0.12),
            curve: Curves.easeOut,
          ),
        ),
      ),
    );

    _scaleAnimations = List.generate(
      memberCount,
      (index) => Tween<double>(begin: 0.8, end: 1).animate(
        CurvedAnimation(
          parent: _pageController,
          curve: Interval(
            0.3 + (index * 0.12),
            0.7 + (index * 0.12),
            curve: Curves.easeOutBack,
          ),
        ),
      ),
    );

    // Header animation
    _headerAnimation = Tween<double>(begin: 0, end: 1).animate(
      CurvedAnimation(
        parent: _pageController,
        curve: const Interval(0, 0.4, curve: Curves.easeOutCubic),
      ),
    );

    // Glow animation
    _glowAnimation = Tween<double>(begin: 0.3, end: 0.8).animate(
      CurvedAnimation(
        parent: _pulseController,
        curve: Curves.easeInOut,
      ),
    );

    Future.delayed(const Duration(milliseconds: 100), () {
      setState(() => _isLoaded = true);
      _pageController.forward();
    });
  }

  @override
  void dispose() {
    _pageController.dispose();
    _pulseController.dispose();
    super.dispose();
  }

  List<MemberData> _getMembers() {
    final members = <MemberData>[];
    final recruiter = _safeMap(widget.conversation['recruiter']);
    final candidate = _safeMap(widget.conversation['candidate']);
    final binome = _safeMap(widget.conversation['binome']);
    final offer = _safeMap(widget.conversation['job_offer']);

    if (recruiter.isNotEmpty) {
      final isOnline = widget.recruiterPresence['is_online'] ?? false;
      final lastSeen = widget.recruiterPresence['last_seen_text'] ?? 'Offline';
      members.add(MemberData(
        id: _toInt(recruiter['id']) ?? 0,
        name: _recruiterLabel(recruiter),
        subtitle: _string(offer['company_name']).isNotEmpty
            ? '${_string(offer['company_name'])} • Recruiter'
            : 'Recruiter',
        pictureUrl: _string(recruiter['picture']),
        isOnline: isOnline,
        lastSeen: lastSeen,
        role: MemberRole.recruiter,
        gradientColors: const [Color(0xFF3B82F6), Color(0xFF06B6D4)],
        icon: Icons.business_center_rounded,
      ));
    }

    if (candidate.isNotEmpty) {
      members.add(MemberData(
        id: _toInt(candidate['id']) ?? 0,
        name: '${_string(candidate['first_name'])} ${_string(candidate['last_name'])}'.trim(),
        subtitle: 'Candidate • You',
        pictureUrl: _string(candidate['picture']),
        isOnline: true,
        lastSeen: 'Online',
        role: MemberRole.candidate,
        gradientColors: const [Color(0xFF10B981), Color(0xFF34D399)],
        icon: Icons.person_rounded,
      ));
    }

    if (binome.isNotEmpty) {
      members.add(MemberData(
        id: _toInt(binome['id']) ?? 0,
        name: '${_string(binome['first_name'])} ${_string(binome['last_name'])}'.trim(),
        subtitle: 'Binome Partner',
        pictureUrl: _string(binome['picture']),
        isOnline: binome['is_online'] == true,
        lastSeen: binome['is_online'] == true ? 'Online' : 'Offline',
        role: MemberRole.binome,
        gradientColors: const [Color(0xFFF59E0B), Color(0xFFFBBF24)],
        icon: Icons.group_rounded,
      ));
    }

    return members;
  }

  @override
  Widget build(BuildContext context) {
    final members = _getMembers();

    return Scaffold(
      backgroundColor: _PremiumColors.background,
      extendBodyBehindAppBar: true,
      appBar: AppBar(
        elevation: 0,
        backgroundColor: Colors.transparent,
        foregroundColor: _PremiumColors.textPrimary,
        title: AnimatedBuilder(
          animation: _headerAnimation,
          builder: (context, child) => Opacity(
            opacity: _headerAnimation.value,
            child: Transform.translate(
              offset: Offset(0, 20 * (1 - _headerAnimation.value)),
              child: Text(
                'Team Members',
                style: GoogleFonts.outfit(
                  fontSize: 24,
                  fontWeight: FontWeight.w800,
                  color: _PremiumColors.textPrimary,
                  letterSpacing: -0.5,
                ),
              ),
            ),
          ),
        ),
        leading: AnimatedBuilder(
          animation: _headerAnimation,
          builder: (context, child) => Opacity(
            opacity: _headerAnimation.value,
            child: IconButton(
              onPressed: () => Navigator.of(context).pop(),
              icon: Container(
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  color: _PremiumColors.surface,
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(
                    color: _PremiumColors.border,
                    width: 1,
                  ),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black.withOpacity(0.05),
                      blurRadius: 8,
                      offset: const Offset(0, 2),
                    ),
                  ],
                ),
                child: const Icon(
                  Icons.arrow_back_ios_new_rounded,
                  size: 18,
                  color: _PremiumColors.textPrimary,
                ),
              ),
            ),
          ),
        ),
      ),
      body: CustomScrollView(
        physics: const BouncingScrollPhysics(),
        slivers: [
          // Top spacing
          const SliverToBoxAdapter(child: SizedBox(height: 108)),

          // Member cards
          SliverPadding(
            padding: const EdgeInsets.fromLTRB(20, 12, 20, 40),
            sliver: SliverList(
              delegate: SliverChildBuilderDelegate(
                (context, index) {
                  final member = members[index];
                  return AnimatedBuilder(
                    animation: _pageController,
                    builder: (context, child) {
                      return FadeTransition(
                        opacity: _fadeAnimations[index],
                        child: SlideTransition(
                          position: _slideAnimations[index],
                          child: ScaleTransition(
                            scale: _scaleAnimations[index],
                            child: _PremiumMemberCard(
                              member: member,
                              pulseController: _pulseController,
                              glowAnimation: _glowAnimation,
                            ),
                          ),
                        ),
                      );
                    },
                  );
                },
                childCount: members.length,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Map<String, dynamic> _safeMap(dynamic value) {
    if (value is Map<String, dynamic>) return value;
    if (value is Map) {
      try {
        return value.cast<String, dynamic>();
      } catch (_) {
        return {};
      }
    }
    return {};
  }

  String _string(dynamic value) {
    if (value == null) return '';
    return '$value';
  }

  int? _toInt(dynamic value) {
    if (value == null) return null;
    if (value is int) return value;
    if (value is num) return value.toInt();
    final raw = '$value'.trim();
    if (raw.isEmpty || raw.toLowerCase() == 'null') return null;
    return int.tryParse(raw) ?? double.tryParse(raw)?.toInt();
  }

  String _recruiterLabel(Map<String, dynamic> recruiter) {
    final firstName = _string(recruiter['first_name']).trim();
    final lastName = _string(recruiter['last_name']).trim();
    final companyName = _string(recruiter['company_name']).trim();

    if (firstName.isNotEmpty || lastName.isNotEmpty) {
      return '$firstName $lastName'.trim();
    }
    if (companyName.isNotEmpty) return companyName;
    return 'Recruiter';
  }
}

/// ===============================
/// Premium Member Card with Animations
/// ===============================
class _PremiumMemberCard extends StatefulWidget {
  final MemberData member;
  final AnimationController pulseController;
  final Animation<double> glowAnimation;

  const _PremiumMemberCard({
    required this.member,
    required this.pulseController,
    required this.glowAnimation,
  });

  @override
  State<_PremiumMemberCard> createState() => _PremiumMemberCardState();
}

class _PremiumMemberCardState extends State<_PremiumMemberCard> {
  bool _isHovered = false;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTapDown: (_) => setState(() => _isHovered = true),
      onTapUp: (_) => setState(() => _isHovered = false),
      onTapCancel: () => setState(() => _isHovered = false),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 300),
        curve: Curves.easeOutCubic,
        margin: const EdgeInsets.only(bottom: 16),
        transform: Matrix4.identity()
          ..translate(0.0, _isHovered ? -4.0 : 0.0, 0.0),
        decoration: BoxDecoration(
          color: _PremiumColors.card,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(
            color: _isHovered
                ? widget.member.gradientColors[0].withOpacity(0.5)
                : _PremiumColors.border,
            width: _isHovered ? 2 : 1,
          ),
          boxShadow: [
            BoxShadow(
              color: widget.member.gradientColors[0].withOpacity(
                _isHovered ? 0.15 : 0.05,
              ),
              blurRadius: _isHovered ? 20 : 10,
              offset: const Offset(0, 4),
            ),
          ],
        ),
        child: Padding(
              padding: const EdgeInsets.all(20),
              child: Row(
                children: [
                  // Animated Avatar with glow
                  AnimatedBuilder(
                    animation: widget.pulseController,
                    builder: (context, child) {
                      final pulseValue = widget.member.isOnline
                          ? 1.0 + (0.1 * widget.glowAnimation.value)
                          : 1.0;
                      return Container(
                        width: 64,
                        height: 64,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          boxShadow: widget.member.isOnline
                              ? [
                                  BoxShadow(
                                    color: widget.member.gradientColors[0]
                                        .withOpacity(0.5 * widget.glowAnimation.value),
                                    blurRadius: 20,
                                    spreadRadius: 2,
                                  ),
                                ]
                              : null,
                        ),
                        child: Transform.scale(
                          scale: pulseValue,
                          child: _AvatarWithGradient(
                            member: widget.member,
                          ),
                        ),
                      );
                    },
                  ),
                  const SizedBox(width: 18),
                  // Info
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            Expanded(
                              child: Text(
                                widget.member.name.isNotEmpty
                                    ? widget.member.name
                                    : 'Unknown',
                                style: GoogleFonts.outfit(
                                  fontSize: 17,
                                  fontWeight: FontWeight.w700,
                                  color: _PremiumColors.textPrimary,
                                  letterSpacing: -0.3,
                                ),
                              ),
                            ),
                            // Role badge with gradient
                            Container(
                              padding: const EdgeInsets.symmetric(
                                horizontal: 12,
                                vertical: 6,
                              ),
                              decoration: BoxDecoration(
                                gradient: LinearGradient(
                                  colors: [
                                    widget.member.gradientColors[0].withOpacity(0.2),
                                    widget.member.gradientColors[1].withOpacity(0.1),
                                  ],
                                ),
                                borderRadius: BorderRadius.circular(20),
                                border: Border.all(
                                  color: widget.member.gradientColors[0].withOpacity(0.3),
                                  width: 1,
                                ),
                              ),
                              child: Row(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  Icon(
                                    widget.member.icon,
                                    size: 14,
                                    color: widget.member.gradientColors[0],
                                  ),
                                  const SizedBox(width: 6),
                                  Text(
                                    _getRoleLabel(widget.member.role),
                                    style: GoogleFonts.outfit(
                                      fontSize: 12,
                                      fontWeight: FontWeight.w700,
                                      color: widget.member.gradientColors[0],
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 6),
                        Text(
                          widget.member.subtitle,
                          style: GoogleFonts.outfit(
                            fontSize: 13,
                            fontWeight: FontWeight.w500,
                            color: _PremiumColors.textSecondary,
                          ),
                        ),
                        const SizedBox(height: 10),
                        // Online status with animated dot
                        Row(
                          children: [
                            AnimatedBuilder(
                              animation: widget.pulseController,
                              builder: (context, child) {
                                return Container(
                                  width: 10,
                                  height: 10,
                                  decoration: BoxDecoration(
                                    color: widget.member.isOnline
                                        ? _PremiumColors.online
                                        : _PremiumColors.offline,
                                    shape: BoxShape.circle,
                                    boxShadow: widget.member.isOnline
                                        ? [
                                            BoxShadow(
                                              color: _PremiumColors.online
                                                  .withOpacity(0.6 * widget.glowAnimation.value),
                                              blurRadius: 8,
                                              spreadRadius: 2,
                                            ),
                                          ]
                                        : null,
                                  ),
                                );
                              },
                            ),
                            const SizedBox(width: 8),
                            Text(
                              widget.member.isOnline
                                  ? 'Online now'
                                  : widget.member.lastSeen,
                              style: GoogleFonts.outfit(
                                fontSize: 12,
                                fontWeight: FontWeight.w600,
                                color: widget.member.isOnline
                                    ? _PremiumColors.online
                                    : _PremiumColors.textMuted,
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                ],
              ),
        ),
      ),
    );
  }

  String _getRoleLabel(MemberRole role) {
    switch (role) {
      case MemberRole.recruiter:
        return 'Recruiter';
      case MemberRole.candidate:
        return 'You';
      case MemberRole.binome:
        return 'Binome';
    }
  }
}

/// ===============================
/// Avatar with Gradient Border
/// ===============================
class _AvatarWithGradient extends StatelessWidget {
  final MemberData member;

  const _AvatarWithGradient({required this.member});

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: member.gradientColors,
        ),
        border: Border.all(
          color: member.gradientColors[0].withOpacity(0.5),
          width: 3,
        ),
      ),
      child: member.pictureUrl.isNotEmpty
          ? ClipOval(
              child: Image.network(
                member.pictureUrl,
                width: 64,
                height: 64,
                fit: BoxFit.cover,
              ),
            )
          : Container(
              width: 64,
              height: 64,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                gradient: LinearGradient(
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                  colors: member.gradientColors,
                ),
              ),
              child: Center(
                child: Text(
                  member.name.isNotEmpty
                      ? member.name[0].toUpperCase()
                      : '?',
                  style: GoogleFonts.outfit(
                    fontSize: 28,
                    fontWeight: FontWeight.w800,
                    color: Colors.white,
                  ),
                ),
              ),
            ),
    );
  }
}

/// ===============================
/// Enums & Data Classes
/// ===============================
enum MemberRole { recruiter, candidate, binome }

class MemberData {
  final int id;
  final String name;
  final String subtitle;
  final String pictureUrl;
  final bool isOnline;
  final String lastSeen;
  final MemberRole role;
  final List<Color> gradientColors;
  final IconData icon;

  MemberData({
    required this.id,
    required this.name,
    required this.subtitle,
    required this.pictureUrl,
    required this.isOnline,
    required this.lastSeen,
    required this.role,
    required this.gradientColors,
    required this.icon,
  });
}
