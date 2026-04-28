import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'onboarding_screen.dart';

class WelcomeScreen extends StatefulWidget {
  const WelcomeScreen({super.key});

  @override
  State<WelcomeScreen> createState() => _WelcomeScreenState();
}

class _WelcomeScreenState extends State<WelcomeScreen>
    with TickerProviderStateMixin {
  late AnimationController _entranceController;
  late AnimationController _floatController;
  late AnimationController _pulseController;

  late List<Animation<double>> _bubbleAnimations;
  late Animation<double> _centerBubbleAnimation;
  late Animation<double> _textAnimation;
  late Animation<double> _buttonAnimation;

  @override
  void initState() {
    super.initState();
    _initAnimations();
  }

  void _initAnimations() {
    // Entrance animation controller
    _entranceController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1500),
    );

    // Floating animation controller (continuous)
    _floatController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 3000),
    )..repeat(reverse: true);

    // Pulse animation for center bubble
    _pulseController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1500),
    )..repeat(reverse: true);

    // Staggered bubble animations
    _bubbleAnimations = List.generate(6, (index) {
      return Tween<double>(begin: 0, end: 1).animate(
        CurvedAnimation(
          parent: _entranceController,
          curve: Interval(
            index * 0.1,
            0.6 + (index * 0.05),
            curve: Curves.elasticOut,
          ),
        ),
      );
    });

    // Center bubble animation
    _centerBubbleAnimation = Tween<double>(begin: 0, end: 1).animate(
      CurvedAnimation(
        parent: _entranceController,
        curve: const Interval(0, 0.5, curve: Curves.elasticOut),
      ),
    );

    // Text fade animation
    _textAnimation = Tween<double>(begin: 0, end: 1).animate(
      CurvedAnimation(
        parent: _entranceController,
        curve: const Interval(0.4, 0.8, curve: Curves.easeOut),
      ),
    );

    // Button slide animation
    _buttonAnimation = Tween<double>(begin: 50, end: 0).animate(
      CurvedAnimation(
        parent: _entranceController,
        curve: const Interval(0.6, 1, curve: Curves.easeOutBack),
      ),
    );

    // Start entrance animation
    _entranceController.forward();
  }

  @override
  void dispose() {
    _entranceController.dispose();
    _floatController.dispose();
    _pulseController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Container(
        decoration: BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [
              const Color(0xFFE0E7FF), // Light blue
              const Color(0xFFC7D2FE), // Slightly darker blue
            ],
          ),
        ),
        child: SafeArea(
          child: Column(
            children: [
              const SizedBox(height: 24),

              // Header - RecrutiTN (with fade animation)
              AnimatedBuilder(
                animation: _entranceController,
                builder: (context, child) {
                  return Opacity(
                    opacity: _textAnimation.value.clamp(0.0, 1.0),
                    child: child,
                  );
                },
                child: RichText(
                  text: TextSpan(
                    children: [
                      TextSpan(
                        text: 'Recruti',
                        style: GoogleFonts.outfit(
                          fontSize: 28,
                          fontWeight: FontWeight.bold,
                          color: Colors.white,
                        ),
                      ),
                      TextSpan(
                        text: 'TN',
                        style: GoogleFonts.outfit(
                          fontSize: 28,
                          fontWeight: FontWeight.bold,
                          color: const Color(0xFF2563EB),
                        ),
                      ),
                    ],
                  ),
                ),
              ),

              const SizedBox(height: 60),

              // Industry Bubbles Layout (with animations)
              _buildIndustryBubblesLayout(),

              const SizedBox(height: 48),

              // Title (with fade animation)
              AnimatedBuilder(
                animation: _entranceController,
                builder: (context, child) {
                  final textVal = _textAnimation.value.clamp(0.0, 1.0);
                  return Opacity(
                    opacity: textVal,
                    child: Transform.translate(
                      offset: Offset(0, 20 * (1 - textVal)),
                      child: child,
                    ),
                  );
                },
                child: Text(
                  'Your Career,\nAll in One Place',
                  textAlign: TextAlign.center,
                  style: GoogleFonts.outfit(
                    fontSize: 32,
                    fontWeight: FontWeight.bold,
                    color: const Color(0xFF1E40AF),
                    height: 1.2,
                  ),
                ),
              ),

              const SizedBox(height: 16),

              // Subtitle (with fade animation)
              AnimatedBuilder(
                animation: _entranceController,
                builder: (context, child) {
                  return Opacity(
                    opacity: _textAnimation.value,
                    child: child,
                  );
                },
                child: Text(
                  'Find the best opportunities.\nApply once. Get noticed faster.',
                  textAlign: TextAlign.center,
                  style: GoogleFonts.inter(
                    fontSize: 15,
                    fontWeight: FontWeight.w400,
                    color: const Color(0xFF64748B),
                    height: 1.5,
                  ),
                ),
              ),

              const Spacer(),

              // Page Indicator (with fade)
              AnimatedBuilder(
                animation: _entranceController,
                builder: (context, child) {
                  return Opacity(
                    opacity: _textAnimation.value,
                    child: child,
                  );
                },
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Container(
                      width: 24,
                      height: 8,
                      decoration: BoxDecoration(
                        color: const Color(0xFF2563EB),
                        borderRadius: BorderRadius.circular(4),
                      ),
                    ),
                    const SizedBox(width: 8),
                    Container(
                      width: 8,
                      height: 8,
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(4),
                      ),
                    ),
                  ],
                ),
              ),

              const SizedBox(height: 32),

              // Get Started Button (with slide animation)
              AnimatedBuilder(
                animation: _entranceController,
                builder: (context, child) {
                  return Transform.translate(
                    offset: Offset(0, _buttonAnimation.value),
                    child: Opacity(
                      opacity: (1 - (_buttonAnimation.value / 50)).clamp(0.0, 1.0),
                      child: child,
                    ),
                  );
                },
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 32),
                  child: SizedBox(
                    width: double.infinity,
                    height: 56,
                    child: ElevatedButton(
                      onPressed: () {
                        Navigator.of(context).push(
                          MaterialPageRoute(
                            builder: (context) => const OnboardingScreen(),
                          ),
                        );
                      },
                      style: ElevatedButton.styleFrom(
                        backgroundColor: Colors.white,
                        foregroundColor: const Color(0xFF2563EB),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(16),
                        ),
                        elevation: 0,
                      ),
                      child: Text(
                        'Get Started',
                        style: GoogleFonts.inter(
                          fontSize: 18,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ),
                  ),
                ),
              ),

              const SizedBox(height: 32),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildIndustryBubblesLayout() {
    final bubbles = [
      // Index 0: Center - User/Person
      _BubbleData(
        icon: Icons.person,
        label: null,
        position: const Offset(0, 0),
        isCenter: true,
      ),
      // Index 1: Top - IT
      _BubbleData(
        icon: Icons.computer,
        label: null,
        position: const Offset(0, -90),
        isCenter: false,
      ),
      // Index 2: Top Left - Healthcare
      _BubbleData(
        icon: Icons.local_hospital,
        label: null,
        position: const Offset(-90, -60),
        isCenter: false,
      ),
      // Index 3: Top Right - Finance
      _BubbleData(
        icon: Icons.account_balance,
        label: null,
        position: const Offset(90, -60),
        isCenter: false,
      ),
      // Index 4: Bottom Left - Engineering
      _BubbleData(
        icon: Icons.engineering,
        label: null,
        position: const Offset(-70, 60),
        isCenter: false,
      ),
      // Index 5: Bottom Right - Marketing
      _BubbleData(
        icon: Icons.campaign,
        label: null,
        position: const Offset(70, 60),
        isCenter: false,
      ),
    ];

    return SizedBox(
      width: 280,
      height: 280,
      child: Stack(
        alignment: Alignment.center,
        children: bubbles.asMap().entries.map((entry) {
          final index = entry.key;
          final bubble = entry.value;

          if (bubble.isCenter) {
            return _buildCenterBubble(bubble);
          }

          return _buildAnimatedBubble(
            index: index,
            bubble: bubble,
          );
        }).toList(),
      ),
    );
  }

  Widget _buildCenterBubble(_BubbleData bubble) {
    return AnimatedBuilder(
      animation: Listenable.merge([_centerBubbleAnimation, _pulseController]),
      builder: (context, child) {
        final animValue = _centerBubbleAnimation.value.clamp(0.0, 1.0);
        final scale = animValue * (1 + _pulseController.value * 0.05);
        return Transform.scale(
          scale: scale,
          child: Opacity(
            opacity: animValue,
            child: Container(
              width: 100,
              height: 100,
              decoration: BoxDecoration(
                color: const Color(0xFF2563EB),
                shape: BoxShape.circle,
                boxShadow: [
                  BoxShadow(
                    color: const Color(0xFF2563EB).withAlpha(77 + (_pulseController.value * 51).round()),
                    blurRadius: 20 + (_pulseController.value * 10),
                    offset: const Offset(0, 10),
                  ),
                ],
              ),
              child: Icon(
                bubble.icon,
                size: 50,
                color: Colors.white,
              ),
            ),
          ),
        );
      },
    );
  }

  Widget _buildAnimatedBubble({
    required int index,
    required _BubbleData bubble,
  }) {
    return AnimatedBuilder(
      animation: Listenable.merge([_bubbleAnimations[index], _floatController]),
      builder: (context, child) {
        final entranceScale = _bubbleAnimations[index].value;
        final floatOffset = _floatController.value * 8 * (index.isEven ? 1 : -1);

        return Transform.translate(
          offset: Offset(
            bubble.position.dx,
            bubble.position.dy + floatOffset,
          ),
          child: Transform.scale(
            scale: entranceScale,
            child: Opacity(
              opacity: entranceScale.clamp(0.0, 1.0),
              child: _buildIconBubble(
                icon: bubble.icon,
                label: bubble.label,
              ),
            ),
          ),
        );
      },
    );
  }

  Widget _buildIconBubble({
    required IconData icon,
    String? label,
  }) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: 56,
          height: 56,
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(16),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withAlpha(20),
                blurRadius: 12,
                offset: const Offset(0, 4),
              ),
            ],
          ),
          child: Icon(
            icon,
            size: 28,
            color: const Color(0xFF2563EB),
          ),
        ),
        if (label != null) ...[
          const SizedBox(height: 6),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(12),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withAlpha(13),
                  blurRadius: 8,
                  offset: const Offset(0, 2),
                ),
              ],
            ),
            child: Text(
              label,
              style: GoogleFonts.inter(
                fontSize: 12,
                fontWeight: FontWeight.w500,
                color: const Color(0xFF2563EB),
              ),
            ),
          ),
        ],
      ],
    );
  }
}

// Helper class for bubble data
class _BubbleData {
  final IconData icon;
  final String? label;
  final Offset position;
  final bool isCenter;

  _BubbleData({
    required this.icon,
    this.label,
    required this.position,
    required this.isCenter,
  });
}
