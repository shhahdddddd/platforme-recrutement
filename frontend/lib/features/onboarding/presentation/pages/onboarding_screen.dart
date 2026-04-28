import 'dart:math' as math;
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:shared_preferences/shared_preferences.dart';

// ─── DATA MODEL ───────────────────────────────────────────────────────────────

class OnboardingPageModel {
  final String title;
  final String description;
  final Widget illustration;

  const OnboardingPageModel({
    required this.title,
    required this.description,
    required this.illustration,
  });
}

// ─── DESIGN TOKENS ────────────────────────────────────────────────────────────

const Color kPrimary = Color(0xFF1A6BFF); // Electric Blue
const Color kNeutral900 = Color(0xFF0F1115);
const Color kNeutral500 = Color(0xFF6B7280);
const Color kNeutral100 = Color(0xFFF3F4F6);
const Color kWhite = Colors.white;

// ─── MAIN SCREEN ──────────────────────────────────────────────────────────────

class OnboardingScreen extends StatefulWidget {
  const OnboardingScreen({super.key});

  @override
  State<OnboardingScreen> createState() => _OnboardingScreenState();
}

class _OnboardingScreenState extends State<OnboardingScreen> {
  final PageController _pageController = PageController();
  int _currentPage = 0;

  void _onPageChanged(int page) => setState(() => _currentPage = page);

  void _nextPage() {
    if (_currentPage < 2) {
      _pageController.nextPage(
        duration: const Duration(milliseconds: 600),
        curve: Curves.easeInOutQuart,
      );
    } else {
      _completeOnboarding();
    }
  }

  void _previousPage() {
    if (_currentPage > 0) {
      _pageController.previousPage(
        duration: const Duration(milliseconds: 600),
        curve: Curves.easeInOutQuart,
      );
    }
  }

  Future<void> _completeOnboarding() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool('has_seen_onboarding', true);
    if (mounted) Navigator.of(context).pushReplacementNamed('/entry');
  }

  @override
  Widget build(BuildContext context) {
    final List<OnboardingPageModel> pages = [
      const OnboardingPageModel(
        title: 'Curated Roles\nFor You.',
        description:
            'Explore opportunities in Health, IT, Marketing, and more curated sectors.',
        illustration: _IndustryBubblesIllustration(),
      ),
      const OnboardingPageModel(
        title: 'Smart\nPrecision.',
        description:
            'Our algorithm aligns your profile with compatible roles in seconds.',
        illustration: _MatchingIllustration(),
      ),
      const OnboardingPageModel(
        title: 'Track Your\nJourney.',
        description:
            'Monitor every stage of your candidacy with real-time updates.',
        illustration: _TrackingIllustration(),
      ),
    ];

    return Scaffold(
      backgroundColor: kWhite,
      body: SafeArea(
        child: Column(
          children: [
            _buildAppBar(),
            Expanded(
              child: PageView.builder(
                controller: _pageController,
                physics: const NeverScrollableScrollPhysics(),
                onPageChanged: _onPageChanged,
                itemCount: pages.length,
                itemBuilder: (context, index) =>
                    _PageContent(model: pages[index], index: index),
              ),
            ),
            _buildNavigationArea(pages.length),
          ],
        ),
      ),
    );
  }

  Widget _buildAppBar() {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 16),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          RichText(
            text: TextSpan(
              style: GoogleFonts.spaceGrotesk(
                fontSize: 22,
                fontWeight: FontWeight.w800,
                letterSpacing: -0.5,
              ),
              children: const [
                TextSpan(
                  text: 'Recruti',
                  style: TextStyle(color: Colors.black),
                ),
                TextSpan(
                  text: 'TN',
                  style: TextStyle(color: kPrimary),
                ),
              ],
            ),
          ),
          if (_currentPage < 2)
            TextButton(
              onPressed: _completeOnboarding,
              child: Text(
                'Skip',
                style: GoogleFonts.inter(
                  color: kNeutral500,
                  fontWeight: FontWeight.w500,
                ),
              ),
            )
          else
            const SizedBox(width: 60),
        ],
      ),
    );
  }

  Widget _buildNavigationArea(int totalPages) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(24, 0, 24, 24),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: List.generate(
              totalPages,
              (index) => _buildIndicator(index == _currentPage),
            ),
          ),
          const SizedBox(height: 24),
          Row(
            children: [
              if (_currentPage > 0)
                Expanded(
                  child: OutlinedButton(
                    onPressed: _previousPage,
                    style: OutlinedButton.styleFrom(
                      padding: const EdgeInsets.symmetric(vertical: 20),
                      side: const BorderSide(color: kNeutral100),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(20),
                      ),
                    ),
                    child: Text(
                      'Back',
                      style: GoogleFonts.inter(
                        color: kNeutral900,
                        fontWeight: FontWeight.w600,
                        fontSize: 16,
                      ),
                    ),
                  ),
                ),
              if (_currentPage > 0) const SizedBox(width: 12),
              Expanded(
                child: ElevatedButton(
                  onPressed: _nextPage,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: kPrimary,
                    foregroundColor: kWhite,
                    padding: const EdgeInsets.symmetric(vertical: 20),
                    elevation: 0,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(20),
                    ),
                  ),
                  child: Text(
                    _currentPage == totalPages - 1 ? 'Get Started' : 'Continue',
                    style: GoogleFonts.inter(
                      fontWeight: FontWeight.w700,
                      fontSize: 16,
                    ),
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildIndicator(bool isActive) {
    return AnimatedContainer(
      duration: const Duration(milliseconds: 300),
      margin: const EdgeInsets.symmetric(horizontal: 4),
      height: 8,
      width: isActive ? 24 : 8,
      decoration: BoxDecoration(
        color: isActive ? kPrimary : kNeutral100,
        borderRadius: BorderRadius.circular(4),
      ),
    );
  }
}

class _PageContent extends StatelessWidget {
  final OnboardingPageModel model;
  final int index;

  const _PageContent({required this.model, required this.index});

  @override
  Widget build(BuildContext context) {
    final double topSpacing = index == 0 ? 80 : (index == 1 ? 68 : 56);
    final double illustrationMaxHeight = index == 2 ? 290 : 220;

    return SingleChildScrollView(
      physics: const BouncingScrollPhysics(),
      padding: const EdgeInsets.symmetric(horizontal: 24),
      child: Column(
        children: [
          SizedBox(height: topSpacing),
          ConstrainedBox(
            constraints: BoxConstraints(maxHeight: illustrationMaxHeight),
            child: SizedBox(width: double.infinity, child: model.illustration),
          ),
          const SizedBox(height: 16),
          Text(
            model.title,
            textAlign: TextAlign.center,
            style: GoogleFonts.outfit(
              color: kNeutral900,
              fontSize: 28,
              fontWeight: FontWeight.w800,
              height: 1.1,
              letterSpacing: -0.5,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            model.description,
            textAlign: TextAlign.center,
            style: GoogleFonts.inter(
              color: kNeutral500,
              fontSize: 14,
              height: 1.5,
            ),
          ),
          const SizedBox(height: 16),
        ],
      ),
    );
  }
}

// ─── ILLUSTRATIONS ────────────────────────────────────────────────────────────

class _IndustryBubblesIllustration extends StatefulWidget {
  const _IndustryBubblesIllustration();

  @override
  State<_IndustryBubblesIllustration> createState() =>
      _IndustryBubblesIllustrationState();
}

class _IndustryBubblesIllustrationState
    extends State<_IndustryBubblesIllustration>
    with TickerProviderStateMixin {
  late AnimationController _floatController;
  late AnimationController _rotateController;

  @override
  void initState() {
    super.initState();
    _floatController = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 3),
    )..repeat(reverse: true);

    _rotateController = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 20),
    )..repeat();
  }

  @override
  void dispose() {
    _floatController.dispose();
    _rotateController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final List<Map<String, dynamic>> industries = [
      {
        'icon': Icons.local_hospital_outlined,
        'color': Color(0xFFEF4444),
        'label': 'Health',
      },
      {
        'icon': Icons.computer_outlined,
        'color': Color(0xFF3B82F6),
        'label': 'IT',
      },
      {
        'icon': Icons.campaign_outlined,
        'color': Color(0xFFF59E0B),
        'label': 'Marketing',
      },
      {
        'icon': Icons.account_balance_outlined,
        'color': Color(0xFF6366F1),
        'label': 'Banking',
      },
      {
        'icon': Icons.brush_outlined,
        'color': Color(0xFFEC4899),
        'label': 'Design',
      },
      {
        'icon': Icons.shopping_bag_outlined,
        'color': Color(0xFF10B981),
        'label': 'Retail',
      },
    ];

    return OverflowBox(
      maxWidth: double.infinity,
      maxHeight: double.infinity,
      child: Stack(
        alignment: Alignment.center,
        children: [
          // Center Candidate Card
          _buildCenterCandidate(),

          // Bubbles in a circle - constrained radius
          ...List.generate(industries.length, (index) {
            final double baseAngle = (index / industries.length) * 2 * math.pi;
            return AnimatedBuilder(
              animation: Listenable.merge([
                _rotateController,
                _floatController,
              ]),
              builder: (context, child) {
                final double angle =
                    baseAngle + (_rotateController.value * 0.1);
                final double dist =
                    90 +
                    (math.sin(_floatController.value * math.pi + index) * 4);
                return Transform.translate(
                  offset: Offset(
                    math.cos(angle) * dist,
                    math.sin(angle) * dist,
                  ),
                  child: child,
                );
              },
              child: _buildBubble(industries[index]),
            );
          }),
        ],
      ),
    );
  }

  Widget _buildCenterCandidate() {
    return Container(
      width: 110,
      height: 110,
      decoration: BoxDecoration(
        color: kWhite,
        shape: BoxShape.circle,
        boxShadow: [
          BoxShadow(
            color: kPrimary.withOpacity(0.25),
            blurRadius: 30,
            spreadRadius: 5,
          ),
        ],
      ),
      child: const Center(
        child: Icon(Icons.person_pin_circle_rounded, size: 65, color: kPrimary),
      ),
    );
  }

  Widget _buildBubble(Map<String, dynamic> data) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: kWhite,
        shape: BoxShape.circle,
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.08),
            blurRadius: 20,
            offset: const Offset(0, 6),
          ),
        ],
      ),
      child: Icon(data['icon'], color: data['color'], size: 28),
    );
  }
}

class _MatchingIllustration extends StatefulWidget {
  const _MatchingIllustration();

  @override
  State<_MatchingIllustration> createState() => _MatchingIllustrationState();
}

class _MatchingIllustrationState extends State<_MatchingIllustration>
    with SingleTickerProviderStateMixin {
  late AnimationController _controller;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 4),
    )..repeat();
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return OverflowBox(
      maxWidth: double.infinity,
      maxHeight: double.infinity,
      child: Stack(
        alignment: Alignment.center,
        children: [
          // Pulsing background rings - smaller
          ...List.generate(3, (i) => _PulsingRing(delay: i * 0.33)),

          // Scan line effect - constrained range
          AnimatedBuilder(
            animation: _controller,
            builder: (context, child) {
              return Transform.translate(
                offset: Offset(0, -60 + (120 * _controller.value)),
                child: Container(
                  width: 120,
                  height: 2,
                  decoration: BoxDecoration(
                    gradient: LinearGradient(
                      colors: [
                        kPrimary.withOpacity(0),
                        kPrimary,
                        kPrimary.withOpacity(0),
                      ],
                    ),
                  ),
                ),
              );
            },
          ),

          const Icon(Icons.auto_awesome_rounded, size: 60, color: kPrimary),
        ],
      ),
    );
  }
}

class _PulsingRing extends StatefulWidget {
  final double delay;
  const _PulsingRing({required this.delay});

  @override
  State<_PulsingRing> createState() => _PulsingRingState();
}

class _PulsingRingState extends State<_PulsingRing>
    with SingleTickerProviderStateMixin {
  late AnimationController _controller;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 3),
    );
    Future.delayed(Duration(milliseconds: (widget.delay * 1000).toInt()), () {
      if (mounted) _controller.repeat();
    });
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _controller,
      builder: (context, child) {
        return Container(
          width: 50 + (80 * _controller.value),
          height: 50 + (80 * _controller.value),
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            border: Border.all(
              color: kPrimary.withOpacity(0.3 * (1 - _controller.value)),
              width: 1.5,
            ),
          ),
        );
      },
    );
  }
}

class _TrackingIllustration extends StatelessWidget {
  const _TrackingIllustration();

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: const [
          _TrackingStep(
            label: 'Application Received',
            status: 'Completed',
            icon: Icons.description_outlined,
          ),
          _TrackingStep(
            label: 'AI Matching Analysis',
            status: 'Completed',
            icon: Icons.smart_toy_outlined,
          ),
          _TrackingStep(
            label: 'Shortlisted for Interview',
            status: 'Processing',
            icon: Icons.event_available_outlined,
            isActive: true,
          ),
          _TrackingStep(
            label: 'Contract Finalization',
            status: 'Pending',
            icon: Icons.verified_user_outlined,
          ),
        ],
      ),
    );
  }
}

class _TrackingStep extends StatelessWidget {
  final String label;
  final String status;
  final IconData icon;
  final bool isActive;

  const _TrackingStep({
    required this.label,
    required this.status,
    required this.icon,
    this.isActive = false,
  });

  @override
  Widget build(BuildContext context) {
    final bool isCompleted = status == 'Completed';

    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 20, vertical: 4),
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(
        color: kWhite,
        borderRadius: BorderRadius.circular(12),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.04),
            blurRadius: 8,
            offset: const Offset(0, 3),
          ),
        ],
        border: isActive
            ? Border.all(color: kPrimary.withOpacity(0.3), width: 1)
            : null,
      ),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(
              color: isCompleted
                  ? Colors.green.withOpacity(0.1)
                  : (isActive ? kPrimary.withOpacity(0.1) : kNeutral100),
              shape: BoxShape.circle,
            ),
            child: Icon(
              isCompleted ? Icons.check : icon,
              size: 18,
              color: isCompleted
                  ? Colors.green
                  : (isActive ? kPrimary : kNeutral500),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  label,
                  style: GoogleFonts.inter(
                    fontSize: 14,
                    fontWeight: FontWeight.w600,
                    color: kNeutral900,
                  ),
                ),
                Text(
                  status,
                  style: GoogleFonts.inter(
                    fontSize: 11,
                    fontWeight: FontWeight.w500,
                    color: isCompleted
                        ? Colors.green
                        : (isActive ? kPrimary : kNeutral500),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
