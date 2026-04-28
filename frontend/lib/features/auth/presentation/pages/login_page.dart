import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:recrutitn/l10n/app_localizations.dart';
import '../../../../core/utils/snackbar_utils.dart';
import '../bloc/auth_bloc.dart';
import '../bloc/auth_event.dart';
import '../bloc/auth_state.dart';
import 'forgot_password_page.dart';
import 'signup_page.dart';
import '../../../home/presentation/pages/home_page.dart';

// ── Design tokens (shared with forgot_password_page.dart) ──────────────────
class _C {
  // Backgrounds
  static const bg         = Color(0xFFEEF4FF); // very light blue-tinted white matching image
  static const cardBg     = Colors.white;
  static const inputBg    = Color(0xFFF0F4FF);

  // Blues
  static const darkBlue   = Color(0xFF0F2557); // headlines, logo text
  static const midBlue    = Color(0xFF1A3A8F); // subheadings, labels
  static const accent     = Color(0xFF1D4ED8); // primary CTA
  static const accentSoft = Color(0xFF3B82F6); // gradient top / links
  static const accentGlow = Color(0xFF1E40AF); // shadow
  static const skyBlue    = Color(0xFF60A5FA); // decorative / light blobs
  static const teal       = Color(0xFF0EA5E9); // highlight dots

  // Neutrals
  static const border       = Color(0xFFDBE5FF);
  static const inputBorder  = Color(0xFFCDD8F6);
  static const textBody     = Color(0xFF334155);
  static const textMuted    = Color(0xFF94A3B8);
  static const error        = Color(0xFFEF4444);
}

class LoginPage extends StatefulWidget {
  const LoginPage({super.key});

  @override
  State<LoginPage> createState() => _LoginPageState();
}

class _LoginPageState extends State<LoginPage> with TickerProviderStateMixin {
  final _emailCtrl    = TextEditingController();
  final _passwordCtrl = TextEditingController();
  final _formKey      = GlobalKey<FormState>();

  late final AnimationController _floatCtrl;
  late final AnimationController _entryCtrl;
  late final AnimationController _pulseCtrl;
  late final AnimationController _shimmerCtrl;
  late final AnimationController _bounceCtrl;
  late final AnimationController _gradientCtrl;
  late final AnimationController _fieldStaggerCtrl;
  late final Animation<double>   _fade;
  late final Animation<Offset>   _slide;

  @override
  void initState() {
    super.initState();
    _floatCtrl = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 7),
    )..repeat(reverse: true);

    _entryCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 900),
    );
    _fade  = CurvedAnimation(parent: _entryCtrl, curve: Curves.easeOutCubic);
    _slide = Tween<Offset>(
      begin: const Offset(0, 0.12),
      end: Offset.zero,
    ).animate(CurvedAnimation(parent: _entryCtrl, curve: Curves.easeOutCubic));
    _entryCtrl.forward();

    _pulseCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1500),
    )..repeat(reverse: true);

    _shimmerCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 2000),
    )..repeat();

    // Bouncing dots animation
    _bounceCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1200),
    )..repeat();

    // Animated gradient background
    _gradientCtrl = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 15),
    )..repeat();

    // Staggered field entry
    _fieldStaggerCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1200),
    );
    Future.delayed(const Duration(milliseconds: 300), () {
      if (mounted) _fieldStaggerCtrl.forward();
    });
  }

  @override
  void dispose() {
    _floatCtrl.dispose();
    _entryCtrl.dispose();
    _pulseCtrl.dispose();
    _shimmerCtrl.dispose();
    _bounceCtrl.dispose();
    _gradientCtrl.dispose();
    _fieldStaggerCtrl.dispose();
    _emailCtrl.dispose();
    _passwordCtrl.dispose();
    super.dispose();
  }

  void _onLogin() {
    if (_formKey.currentState!.validate()) {
      context.read<AuthBloc>().add(LoginEvent(
        email: _emailCtrl.text.trim(),
        password: _passwordCtrl.text,
      ));
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: _C.bg,
      body: BlocConsumer<AuthBloc, AuthState>(
        listener: (context, state) {
          if (state is AuthAuthenticated) {
            SnackBarUtils.showSuccess(
              context,
              AppLocalizations.of(context)!.welcomeUser(state.user.name),
            );
            Navigator.pushReplacement(
              context,
              MaterialPageRoute(builder: (_) => HomePage(user: state.user)),
            );
          } else if (state is AuthError) {
            String msg = state.message;
            
            // Clean up common technical prefixes
            if (msg.contains('Exception: ')) {
              msg = msg.split('Exception: ').last;
            }
            if (msg.contains('ServerFailure: ')) {
              msg = msg.split('ServerFailure: ').last;
            }

            final loweredMsg = msg.toLowerCase();
            
            if (loweredMsg.contains('credentials') || 
                loweredMsg.contains('invalid') ||
                loweredMsg.contains('incorrect password')) {
              msg = 'Incorrect password.';
            } else if (loweredMsg.contains('user not found')) {
              msg = 'User not found.';
            }
            
            SnackBarUtils.showError(context, msg);
          }
        },
        builder: (context, state) {
          return Stack(
            children: [
              // ── Animated gradient background ───────────────────────────
              AnimatedBuilder(
                animation: _gradientCtrl,
                builder: (_, __) {
                  final value = _gradientCtrl.value;
                  return Container(
                    decoration: BoxDecoration(
                      gradient: LinearGradient(
                        begin: Alignment.topLeft,
                        end: Alignment.bottomRight,
                        colors: [
                          Color.lerp(const Color(0xFFEEF4FF), const Color(0xFFD6E3FF), math.sin(value * math.pi * 2))!,
                          Color.lerp(const Color(0xFFF0F7FF), const Color(0xFFE8EFFF), math.cos(value * math.pi * 2))!,
                        ],
                      ),
                    ),
                  );
                },
              ),

              // ── Floating animated orbs ───────────────────────────
              _AnimatedOrb(
                top: -60,
                left: -80,
                size: 280,
                colors: const [Color(0xFFD6E3FF), Color(0xFFB8D4FF)],
                animation: _floatCtrl,
                delay: 0,
              ),
              _AnimatedOrb(
                top: null,
                bottom: 120,
                left: -60,
                size: 180,
                colors: const [Color(0xFFD6E3FF), Color(0xFFE8EFFF)],
                animation: _floatCtrl,
                delay: 1.5,
              ),
              _AnimatedOrb(
                top: -40,
                right: -100,
                size: 320,
                colors: const [Color(0xFFD6E3FF), Color(0xFFC9DDFF)],
                animation: _floatCtrl,
                delay: 3,
              ),
              _AnimatedOrb(
                top: 140,
                right: -40,
                size: 140,
                colors: const [Color(0xFFE8EFFF), Color(0xFFD6E3FF)],
                animation: _floatCtrl,
                delay: 4.5,
              ),

              // ── Floating animated dots with bounce ─────────────────────────────────
              IgnorePointer(
                child: AnimatedBuilder(
                  animation: Listenable.merge([_floatCtrl, _bounceCtrl]),
                  builder: (_, __) {
                    final a  = _floatCtrl.value * 2 * math.pi;
                    final s1 = math.sin(a);
                    final s2 = math.cos(a + 1.0);
                    final b1 = math.sin(_bounceCtrl.value * math.pi);
                    final b2 = math.cos(_bounceCtrl.value * math.pi * 1.3);
                    return Stack(children: [
                      Positioned(
                        top: 300 + s1 * 10 + b1 * 5,
                        right: 28 + s2 * 8,
                        child: _BouncingDot(
                          size: 8,
                          color: _C.accentSoft.withValues(alpha: 0.35),
                          bounceValue: b1,
                        ),
                      ),
                      Positioned(
                        top: 380 + s2 * 9 + b2 * 4,
                        left: 24 + s1 * 7,
                        child: _BouncingDot(
                          size: 6,
                          color: _C.teal.withValues(alpha: 0.30),
                          bounceValue: b2,
                        ),
                      ),
                      Positioned(
                        top: 510 + s1 * 8 + b1 * 3,
                        right: 22 + s2 * 10,
                        child: _BouncingDot(
                          size: 5,
                          color: _C.midBlue.withValues(alpha: 0.25),
                          bounceValue: b1,
                        ),
                      ),
                      Positioned(
                        top: 440 + s2 * 7 + b2 * 6,
                        left: 30 + s1 * 8,
                        child: _BouncingDot(
                          size: 7,
                          color: _C.skyBlue.withValues(alpha: 0.28),
                          bounceValue: b2,
                        ),
                      ),
                    ]);
                  },
                ),
              ),

              // ── Main content ──────────────────────────────────────────
              SafeArea(
                child: FadeTransition(
                  opacity: _fade,
                  child: SlideTransition(
                    position: _slide,
                    child: SingleChildScrollView(
                      padding: const EdgeInsets.symmetric(horizontal: 28),
                      child: Form(
                        key: _formKey,
                        child: Column(
                          children: [
                            const SizedBox(height: 80),

                            // ── Logo ──────────────────────────────────
                            _LogoBadge(floatCtrl: _floatCtrl),

                            const SizedBox(height: 40),

                            // ── Form card with shimmer effect ─────────────────────────────
                            AnimatedBuilder(
                              animation: _shimmerCtrl,
                              builder: (context, _) {
                                final shimmerValue = _shimmerCtrl.value;
                                return Container(
                                  padding: const EdgeInsets.all(24),
                                  decoration: BoxDecoration(
                                    color: Colors.white.withValues(alpha: 0.95),
                                    borderRadius: BorderRadius.circular(28),
                                    border: Border.all(
                                      color: Colors.white.withValues(alpha: 0.5),
                                      width: 1.5,
                                    ),
                                    boxShadow: [
                                      BoxShadow(
                                        color: _C.accentGlow.withValues(alpha: 0.06 + (shimmerValue * 0.02)),
                                        blurRadius: 40,
                                        offset: const Offset(0, 12),
                                      ),
                                      BoxShadow(
                                        color: Colors.black.withValues(alpha: 0.03),
                                        blurRadius: 10,
                                        offset: const Offset(0, 4),
                                      ),
                                    ],
                                  ),
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      const _FieldLabel('Email'),
                                      const SizedBox(height: 7),
                                      _CleanField(
                                        controller: _emailCtrl,
                                        hint: AppLocalizations.of(context)!.emailHint,
                                        icon: Icons.alternate_email_rounded,
                                        keyboardType: TextInputType.emailAddress,
                                        validator: (v) =>
                                            v == null || v.trim().isEmpty
                                                ? AppLocalizations.of(context)!.emailRequired
                                                : null,
                                      ),
                                      const SizedBox(height: 20),
                                      const _FieldLabel('Password'),
                                      const SizedBox(height: 7),
                                      _CleanField(
                                        controller: _passwordCtrl,
                                        hint: AppLocalizations.of(context)!.passwordHint,
                                        icon: Icons.lock_outline_rounded,
                                        obscureText: true,
                                        validator: (v) => v == null || v.isEmpty
                                            ? AppLocalizations.of(context)!.passwordRequired
                                            : null,
                                      ),
                                      const SizedBox(height: 4),
                                      Align(
                                        alignment: Alignment.centerRight,
                                        child: TextButton(
                                          onPressed: () => Navigator.push(
                                            context,
                                            MaterialPageRoute(
                                              builder: (_) => const ForgotPasswordPage(),
                                            ),
                                          ),
                                          style: TextButton.styleFrom(
                                            padding: const EdgeInsets.symmetric(
                                              horizontal: 4, vertical: 6),
                                          ),
                                          child: const Text(
                                            'Forgot password?',
                                            style: TextStyle(
                                              color: _C.accent,
                                              fontSize: 13,
                                              fontWeight: FontWeight.w600,
                                            ),
                                          ),
                                        ),
                                      ),
                                    ],
                                  ),
                                );
                              },
                            ),

                            const SizedBox(height: 24),

                            // CTA with pulse animation
                            AnimatedBuilder(
                              animation: _pulseCtrl,
                              builder: (context, _) {
                                final pulseValue = _pulseCtrl.value;
                                return Transform.scale(
                                  scale: 1.0 + (pulseValue * 0.02),
                                  child: _PrimaryButton(
                                    loading: state is AuthLoading,
                                    onPressed: _onLogin,
                                    label: AppLocalizations.of(context)!.loginButton,
                                    pulseValue: pulseValue,
                                  ),
                                );
                              },
                            ),

                            const SizedBox(height: 22),

                            // ── Divider ───────────────────────────────
                            Row(children: [
                              Expanded(child: Divider(color: _C.border)),
                              Padding(
                                padding: const EdgeInsets.symmetric(horizontal: 12),
                                child: Text(
                                  'or',
                                  style: TextStyle(
                                    color: _C.textMuted,
                                    fontSize: 12,
                                    fontWeight: FontWeight.w500,
                                  ),
                                ),
                              ),
                              Expanded(child: Divider(color: _C.border)),
                            ]),

                            const SizedBox(height: 20),

                            // ── Sign up ───────────────────────────────
                            Row(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                Text(
                                  AppLocalizations.of(context)!.newHere,
                                  style: const TextStyle(
                                    color: _C.textBody,
                                    fontSize: 14,
                                    fontWeight: FontWeight.w500,
                                  ),
                                ),
                                TextButton(
                                  onPressed: () => Navigator.push(
                                    context,
                                    MaterialPageRoute(
                                      builder: (_) => const SignUpPage(),
                                    ),
                                  ),
                                  style: TextButton.styleFrom(
                                    padding: const EdgeInsets.symmetric(
                                      horizontal: 6, vertical: 0),
                                  ),
                                  child: const Text(
                                    'Sign up',
                                    style: TextStyle(
                                      color: _C.accent,
                                      fontSize: 14,
                                      fontWeight: FontWeight.w700,
                                    ),
                                  ),
                                ),
                              ],
                            ),

                            const SizedBox(height: 40),
                          ],
                        ),
                      ),
                    ),
                  ),
                ),
              ),
            ],
          );
        },
      ),
    );
  }
}

// ── Shared widgets ────────────────────────────────────────────────────────────

class _GlowBlob extends StatelessWidget {
  const _GlowBlob({required this.size, required this.color});
  final double size;
  final Color color;

  @override
  Widget build(BuildContext context) => Container(
        width: size,
        height: size,
        decoration: BoxDecoration(shape: BoxShape.circle, color: color),
      );
}

class _AnimDot extends StatelessWidget {
  const _AnimDot({required this.size, required this.color});
  final double size;
  final Color color;

  @override
  Widget build(BuildContext context) => Container(
        width: size,
        height: size,
        decoration: BoxDecoration(shape: BoxShape.circle, color: color),
      );
}

class _FieldLabel extends StatelessWidget {
  const _FieldLabel(this.text);
  final String text;

  @override
  Widget build(BuildContext context) => Text(
        text,
        style: const TextStyle(
          color: _C.midBlue,
          fontSize: 13,
          fontWeight: FontWeight.w600,
          letterSpacing: 0.1,
        ),
      );
}

class _CleanField extends StatefulWidget {
  const _CleanField({
    required this.controller,
    required this.hint,
    required this.icon,
    this.keyboardType,
    this.obscureText = false,
    this.validator,
  });
  final TextEditingController controller;
  final String hint;
  final IconData icon;
  final TextInputType? keyboardType;
  final bool obscureText;
  final String? Function(String?)? validator;

  @override
  State<_CleanField> createState() => _CleanFieldState();
}

class _CleanFieldState extends State<_CleanField> {
  bool _hidden = true;

  @override
  Widget build(BuildContext context) {
    return TextFormField(
      controller: widget.controller,
      keyboardType: widget.keyboardType,
      obscureText: widget.obscureText ? _hidden : false,
      validator: widget.validator,
      style: const TextStyle(
        color: _C.darkBlue,
        fontSize: 15,
        fontWeight: FontWeight.w500,
      ),
      decoration: InputDecoration(
        hintText: widget.hint,
        hintStyle: const TextStyle(color: _C.textMuted, fontSize: 14),
        prefixIcon: Icon(widget.icon, size: 19, color: _C.accent),
        suffixIcon: widget.obscureText
            ? GestureDetector(
                onTap: () => setState(() => _hidden = !_hidden),
                child: Icon(
                  _hidden ? Icons.visibility_off_outlined : Icons.visibility_outlined,
                  size: 18,
                  color: _C.textMuted,
                ),
              )
            : null,
        filled: true,
        fillColor: _C.inputBg,
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: _C.inputBorder),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: _C.inputBorder),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: _C.accent, width: 1.6),
        ),
        errorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: _C.error),
        ),
        focusedErrorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: _C.error, width: 1.6),
        ),
      ),
    );
  }
}

class _PrimaryButton extends StatelessWidget {
  const _PrimaryButton({
    required this.loading,
    required this.onPressed,
    required this.label,
    this.pulseValue = 0,
  });
  final bool loading;
  final VoidCallback onPressed;
  final String label;
  final double pulseValue;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: double.infinity,
      height: 54,
      child: DecoratedBox(
        decoration: BoxDecoration(
          gradient: loading
              ? null
              : const LinearGradient(
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                  colors: [_C.accentSoft, _C.accent],
                ),
          color: loading ? _C.inputBorder : null,
          borderRadius: BorderRadius.circular(14),
          boxShadow: loading
              ? []
              : [
                  BoxShadow(
                    color: _C.accentGlow.withValues(alpha: 0.32 + (pulseValue * 0.1)),
                    blurRadius: 20 + (pulseValue * 8),
                    offset: Offset(0, 8 + (pulseValue * 3)),
                  ),
                ],
        ),
        child: ElevatedButton(
          onPressed: loading ? null : onPressed,
          style: ElevatedButton.styleFrom(
            backgroundColor: Colors.transparent,
            shadowColor: Colors.transparent,
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(14),
            ),
          ),
          child: loading
              ? const SizedBox(
                  height: 20,
                  width: 20,
                  child: CircularProgressIndicator(
                    strokeWidth: 2,
                    color: Colors.white,
                  ),
                )
              : Text(
                  label,
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 16,
                    fontWeight: FontWeight.w700,
                    letterSpacing: 0.3,
                  ),
                ),
        ),
      ),
    );
  }
}

/// Logo badge matching the design image.
class _LogoBadge extends StatelessWidget {
  const _LogoBadge({required this.floatCtrl});
  final AnimationController floatCtrl;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: 160,
      height: 160,
      child: AnimatedBuilder(
        animation: floatCtrl,
        builder: (_, __) {
          final a  = floatCtrl.value * 2 * math.pi;
          final s1 = math.sin(a) * 0.03;
          final s2 = math.cos(a + 0.7) * 0.02;
          return Transform.scale(
            scale: 1.0 + s1,
            child: Transform.translate(
              offset: Offset(s2 * 5, s1 * 5),
              child: Container(
                width: 120,
                height: 120,
                decoration: BoxDecoration(
                  color: Colors.white,
                  shape: BoxShape.circle,
                  boxShadow: [
                    BoxShadow(
                      color: const Color(0xFF1E40AF).withValues(alpha: 0.08),
                      blurRadius: 40,
                      offset: const Offset(0, 8),
                    ),
                    BoxShadow(
                      color: const Color(0xFF3B82F6).withValues(alpha: 0.04),
                      blurRadius: 60,
                      spreadRadius: 4,
                    ),
                  ],
                ),
                child: Center(
                  child: RichText(
                    text: const TextSpan(
                      style: TextStyle(
                        fontSize: 24,
                        fontWeight: FontWeight.w800,
                        color: Color(0xFF1A1A2E),
                        letterSpacing: -0.5,
                      ),
                      children: [
                        TextSpan(text: 'Recruti'),
                        TextSpan(
                          text: 'TN',
                          style: TextStyle(
                            color: Color(0xFF3B82F6),
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ),
          );
        },
      ),
    );
  }
}

/// Animated orb with gradient that moves and pulses
class _AnimatedOrb extends StatelessWidget {
  const _AnimatedOrb({
    this.top,
    this.bottom,
    this.left,
    this.right,
    required this.size,
    required this.colors,
    required this.animation,
    required this.delay,
  });

  final double? top;
  final double? bottom;
  final double? left;
  final double? right;
  final double size;
  final List<Color> colors;
  final AnimationController animation;
  final double delay;

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: animation,
      builder: (_, __) {
        final a = animation.value * 2 * math.pi + delay;
        final scale = 1.0 + math.sin(a) * 0.08;
        final offsetX = math.cos(a * 0.7) * 8;
        final offsetY = math.sin(a * 0.5) * 6;

        return Positioned(
          top: top != null ? top! + offsetY : null,
          bottom: bottom,
          left: left != null ? left! + offsetX : null,
          right: right,
          child: Transform.scale(
            scale: scale,
            child: Container(
              width: size,
              height: size,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                gradient: RadialGradient(
                  colors: colors,
                  center: Alignment.center,
                  radius: 0.8,
                ),
                boxShadow: [
                  BoxShadow(
                    color: colors[0].withValues(alpha: 0.3),
                    blurRadius: 30,
                    spreadRadius: 5,
                  ),
                ],
              ),
            ),
          ),
        );
      },
    );
  }
}

/// Bouncing dot with scale animation
class _BouncingDot extends StatelessWidget {
  const _BouncingDot({
    required this.size,
    required this.color,
    required this.bounceValue,
  });

  final double size;
  final Color color;
  final double bounceValue;

  @override
  Widget build(BuildContext context) {
    final scale = 1.0 + bounceValue.abs() * 0.3;
    return Transform.scale(
      scale: scale,
      child: Container(
        width: size,
        height: size,
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          color: color,
          boxShadow: [
            BoxShadow(
              color: color.withValues(alpha: 0.4),
              blurRadius: size * 0.5,
              spreadRadius: size * 0.2,
            ),
          ],
        ),
      ),
    );
  }
} 
