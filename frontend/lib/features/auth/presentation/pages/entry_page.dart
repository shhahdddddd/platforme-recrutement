import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:recrutitn/l10n/app_localizations.dart';
import 'login_page.dart';

class EntryPage extends StatefulWidget {
  const EntryPage({super.key});

  @override
  State<EntryPage> createState() => _EntryPageState();
}

class _EntryPageState extends State<EntryPage>
    with SingleTickerProviderStateMixin {
  late final AnimationController _floatController;

  @override
  void initState() {
    super.initState();
    _floatController = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 6),
    )..repeat(reverse: true);
  }

  @override
  void dispose() {
    _floatController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context)!;
    return Scaffold(
      body: Stack(
        children: [
          Container(
            decoration: const BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.topCenter,
                end: Alignment.bottomCenter,
                colors: [Color(0xFF5E74C9), Color(0xFF2A3B75)],
              ),
            ),
          ),
          AnimatedBuilder(
            animation: _floatController,
            builder: (context, _) {
              final t = _floatController.value;
              final a = t * 2 * math.pi;
              final wave = math.sin(a);
              final wave2 = math.sin(a + (math.pi / 2));
              final wave3 = math.cos(a * 0.8);
              return Stack(
                children: [
                  _bubble(
                    top: -44 + (wave * 10),
                    left: -48 + (wave2 * 8),
                    size: 170,
                    scale: 1 + (wave * 0.03),
                    colors: const [Color(0xFF243A84), Color(0xFF1A2D6A)],
                  ),
                  _bubble(
                    top: 62 + (wave2 * 11),
                    right: -72 + (wave * 7),
                    size: 220,
                    scale: 1 + (wave2 * 0.025),
                    colors: const [Color(0xFF7D90DA), Color(0xFF5E74C9)],
                  ),
                  _bubble(
                    top: 152 + (wave3 * 12),
                    right: 38 + (wave2 * 6),
                    size: 86,
                    scale: 1 + (wave3 * 0.05),
                    colors: const [Color(0xFFD6E2FF), Color(0xFF8FA8ED)],
                  ),
                  _bubble(
                    bottom: 164 + (wave * 11),
                    left: 20 + (wave3 * 6),
                    size: 56,
                    scale: 1 + (wave * 0.06),
                    colors: const [Color(0xFFE6EEFF), Color(0xFFA8BBF0)],
                  ),
                  _bubble(
                    bottom: 40 + (wave2 * 10),
                    left: 44 + (wave * 7),
                    size: 110,
                    scale: 1 + (wave2 * 0.04),
                    colors: const [Color(0xFF22428A), Color(0xFF152B62)],
                  ),
                ],
              );
            },
          ),
          SafeArea(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(24, 0, 24, 20),
              child: Column(
                children: [
                  const Spacer(),
                  Text(
                    l10n.welcomeBackTitle,
                    textAlign: TextAlign.center,
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 40,
                      fontWeight: FontWeight.w800,
                      letterSpacing: -0.7,
                    ),
                  ),
                  const SizedBox(height: 12),
                  Text(
                    l10n.welcomeBackSubtitle,
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      color: Colors.white.withValues(alpha: 0.88),
                      fontSize: 16,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                  const Spacer(),
                  Align(
                    alignment: Alignment.centerRight,
                    child: _buildContinueCta(),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _bubble({
    double? top,
    double? right,
    double? bottom,
    double? left,
    required double size,
    double scale = 1,
    required List<Color> colors,
  }) {
    return Positioned(
      top: top,
      right: right,
      bottom: bottom,
      left: left,
      child: Transform.scale(
        scale: scale,
        child: Container(
          width: size,
          height: size,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            gradient: LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: colors,
            ),
            boxShadow: [
              BoxShadow(
                color: const Color(0xFF0F1F4D).withValues(alpha: 0.28),
                blurRadius: 24,
                offset: const Offset(0, 12),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildContinueCta() {
    void goToLogin() {
      Navigator.push(
        context,
        MaterialPageRoute(builder: (_) => const LoginPage()),
      );
    }

    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTap: goToLogin,
      onHorizontalDragEnd: (_) => goToLogin(),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 8),
        decoration: BoxDecoration(
          color: Colors.white.withValues(alpha: 0.96),
          borderRadius: BorderRadius.circular(28),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.14),
              blurRadius: 18,
              offset: const Offset(0, 8),
            ),
          ],
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            const SizedBox(width: 14),
            Text(
              'Continue',
              style: TextStyle(
                color: const Color(0xFF1E2A56).withValues(alpha: 0.78),
                fontWeight: FontWeight.w700,
                fontSize: 18,
              ),
            ),
            const SizedBox(width: 12),
            Container(
              width: 44,
              height: 44,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                gradient: const LinearGradient(
                  colors: [Color(0xFFEAF1FF), Color(0xFFAFC6FF)],
                ),
                boxShadow: [
                  BoxShadow(
                    color: const Color(0xFF8FAAF0).withValues(alpha: 0.42),
                    blurRadius: 10,
                    offset: const Offset(0, 4),
                  ),
                ],
              ),
              child: const Icon(
                Icons.arrow_forward_rounded,
                color: Color(0xFF4D67A8),
                size: 23,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
