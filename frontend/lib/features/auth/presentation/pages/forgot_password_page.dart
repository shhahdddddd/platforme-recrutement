import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:recrutitn/l10n/app_localizations.dart';
import '../../../../core/utils/snackbar_utils.dart';
import '../bloc/auth_bloc.dart';
import '../bloc/auth_event.dart';
import '../bloc/auth_state.dart';

// ── Design tokens (keep in sync with login_page.dart) ─────────────────────
class _C {
  static const bg           = Color(0xFFF4F7FF);
  static const cardBg       = Colors.white;
  static const inputBg      = Color(0xFFF0F4FF);
  static const darkBlue     = Color(0xFF0F2557);
  static const midBlue      = Color(0xFF1A3A8F);
  static const accent       = Color(0xFF1D4ED8);
  static const accentSoft   = Color(0xFF3B82F6);
  static const accentGlow   = Color(0xFF1E40AF);
  static const skyBlue      = Color(0xFF60A5FA);
  static const teal         = Color(0xFF0EA5E9);
  static const border       = Color(0xFFDBE5FF);
  static const inputBorder  = Color(0xFFCDD8F6);
  static const textBody     = Color(0xFF334155);
  static const textMuted    = Color(0xFF94A3B8);
  static const error        = Color(0xFFEF4444);
  static const success      = Color(0xFF22C55E);
  static final accentLight  = const Color(0xFF1D4ED8).withOpacity(0.1);
}

// ── Forgot Password Steps ──────────────────────────────────────────────────
enum _ForgotPasswordStep { email, otp, password }

class ForgotPasswordPage extends StatefulWidget {
  const ForgotPasswordPage({super.key});

  @override
  State<ForgotPasswordPage> createState() => _ForgotPasswordPageState();
}

class _ForgotPasswordPageState extends State<ForgotPasswordPage>
    with SingleTickerProviderStateMixin {
  final _emailCtrl    = TextEditingController();
  final _otpCtrl      = TextEditingController();
  final _newPassCtrl  = TextEditingController();
  final _confPassCtrl = TextEditingController();
  final _formKey      = GlobalKey<FormState>();

  late final AnimationController _entryCtrl;
  late final Animation<double>   _fade;
  late final Animation<Offset>   _slide;

  // Multi-step flow state
  _ForgotPasswordStep _currentStep = _ForgotPasswordStep.email;
  String _savedEmail = '';
  
  // OTP timer state
  Timer? _otpTimer;
  int _otpRemainingSeconds = 300;
  bool _canResendOtp = false;
  static const int _otpExpirySeconds = 300; // 5 minutes

  @override
  void initState() {
    super.initState();
    _entryCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 700),
    );
    _fade  = CurvedAnimation(parent: _entryCtrl, curve: Curves.easeOut);
    _slide = Tween<Offset>(
      begin: const Offset(0, 0.05),
      end: Offset.zero,
    ).animate(CurvedAnimation(parent: _entryCtrl, curve: Curves.easeOut));
    _entryCtrl.forward();
  }

  @override
  void dispose() {
    _otpTimer?.cancel();
    _entryCtrl.dispose();
    _emailCtrl.dispose();
    _otpCtrl.dispose();
    _newPassCtrl.dispose();
    _confPassCtrl.dispose();
    super.dispose();
  }

  void _startOtpTimer() {
    _otpTimer?.cancel();
    setState(() {
      _otpRemainingSeconds = _otpExpirySeconds;
      _canResendOtp = false;
    });
    
    _otpTimer = Timer.periodic(const Duration(seconds: 1), (timer) {
      if (mounted) {
        setState(() {
          if (_otpRemainingSeconds > 0) {
            _otpRemainingSeconds--;
          } else {
            _canResendOtp = true;
            timer.cancel();
          }
        });
      }
    });
  }

  String _formatOtpTimer() {
    final minutes = _otpRemainingSeconds ~/ 60;
    final seconds = _otpRemainingSeconds % 60;
    return '${minutes.toString().padLeft(2, '0')}:${seconds.toString().padLeft(2, '0')}';
  }

  void _onEmailSubmit() {
    if (_formKey.currentState!.validate()) {
      final email = _emailCtrl.text.trim();
      _savedEmail = email;
      context.read<AuthBloc>().add(CheckEmailEvent(email: email));
    }
  }

  void _onSendOtp() {
    context.read<AuthBloc>().add(SendOtpEvent(email: _savedEmail));
    _startOtpTimer();
  }

  void _onVerifyOtp() {
    if (_formKey.currentState!.validate()) {
      context.read<AuthBloc>().add(VerifyOtpEvent(
        email: _savedEmail,
        otp: _otpCtrl.text.trim(),
      ));
    }
  }

  void _onResetPassword() {
    if (_formKey.currentState!.validate()) {
      if (_newPassCtrl.text != _confPassCtrl.text) {
        SnackBarUtils.showError(
          context,
          AppLocalizations.of(context)!.passwordsDoNotMatch,
        );
        return;
      }
      context.read<AuthBloc>().add(ResetPasswordEvent(
        email: _savedEmail,
        newPassword: _newPassCtrl.text,
      ));
    }
  }

  void _goToStep(_ForgotPasswordStep step) {
    setState(() {
      _currentStep = step;
    });
    _entryCtrl.forward(from: 0);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: _C.bg,
      body: BlocConsumer<AuthBloc, AuthState>(
        listener: (context, state) {
          if (state is AuthPasswordResetSuccess) {
            SnackBarUtils.showSuccess(
              context,
              AppLocalizations.of(context)!.resetPasswordSuccess,
            );
            Navigator.pop(context);
          } else if (state is AuthEmailCheckResult) {
            if (state.exists) {
              _onSendOtp();
              _goToStep(_ForgotPasswordStep.otp);
            } else {
              SnackBarUtils.showError(
                context,
                'No account found with this email address',
              );
            }
          } else if (state is AuthOtpSent) {
            SnackBarUtils.showSuccess(
              context,
              'Verification code sent to your email',
            );
          } else if (state is AuthOtpVerified) {
            SnackBarUtils.showSuccess(
              context,
              'Code verified successfully',
            );
            _goToStep(_ForgotPasswordStep.password);
          } else if (state is AuthOtpError) {
            SnackBarUtils.showError(context, state.message);
          } else if (state is AuthError) {
            SnackBarUtils.showError(context, state.message);
          }
        },
        builder: (context, state) {
          return Stack(
            children: [
              // ── Background blobs ───────────────────────────────────────
              Positioned(
                top: -100, right: -70,
                child: _Blob(size: 310, color: _C.accentSoft.withValues(alpha: 0.10)),
              ),
              Positioned(
                top: 100, right: 40,
                child: _Blob(size: 80, color: _C.teal.withValues(alpha: 0.08)),
              ),
              Positioned(
                bottom: -90, left: -60,
                child: _Blob(size: 280, color: _C.skyBlue.withValues(alpha: 0.09)),
              ),

              // ── Content ────────────────────────────────────────────────
              SafeArea(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Premium Header Bar
                    Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                      child: Row(
                        children: [
                          // Back button
                          GestureDetector(
                            onTap: () {
                              if (_currentStep == _ForgotPasswordStep.email) {
                                Navigator.pop(context);
                              } else if (_currentStep == _ForgotPasswordStep.otp) {
                                _goToStep(_ForgotPasswordStep.email);
                              } else {
                                _goToStep(_ForgotPasswordStep.otp);
                              }
                            },
                            child: Container(
                              width: 44,
                              height: 44,
                              decoration: BoxDecoration(
                                color: _C.cardBg,
                                borderRadius: BorderRadius.circular(14),
                                border: Border.all(color: _C.border),
                                boxShadow: [
                                  BoxShadow(
                                    color: _C.darkBlue.withOpacity(0.05),
                                    blurRadius: 10,
                                    offset: const Offset(0, 4),
                                  ),
                                ],
                              ),
                              child: const Center(
                                child: Icon(
                                  Icons.chevron_left_rounded,
                                  size: 26,
                                  color: _C.darkBlue,
                                ),
                              ),
                            ),
                          ),
                          const Spacer(),
                          // Step indicator
                          _buildStepIndicator(),
                          const Spacer(),
                          const SizedBox(width: 44),
                        ],
                      ),
                    ),

                    Expanded(
                      child: Center(
                        child: SingleChildScrollView(
                          padding: const EdgeInsets.symmetric(horizontal: 28),
                          child: FadeTransition(
                            opacity: _fade,
                            child: SlideTransition(
                              position: _slide,
                              child: _buildCurrentStep(state),
                            ),
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          );
        },
      ),
    );
  }

  // ── Step Builder Methods ────────────────────────────────────────────────────

  Widget _buildStepIndicator() {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        _stepDot(0),
        const SizedBox(width: 8),
        _stepLine(0),
        const SizedBox(width: 8),
        _stepDot(1),
        const SizedBox(width: 8),
        _stepLine(1),
        const SizedBox(width: 8),
        _stepDot(2),
      ],
    );
  }

  Widget _stepDot(int index) {
    final int currentIndex = _currentStep.index;
    final bool isActive = index <= currentIndex;
    final bool isCurrent = index == currentIndex;
    
    return Container(
      width: isCurrent ? 12 : 8,
      height: isCurrent ? 12 : 8,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        color: isActive ? _C.accent : _C.border,
        border: isCurrent ? Border.all(color: _C.cardBg, width: 2) : null,
        boxShadow: isCurrent ? [
          BoxShadow(
            color: _C.accent.withOpacity(0.4),
            blurRadius: 8,
            spreadRadius: 2,
          ),
        ] : null,
      ),
    );
  }

  Widget _stepLine(int index) {
    final int currentIndex = _currentStep.index;
    final bool isActive = index < currentIndex;
    
    return Container(
      width: 24,
      height: 2,
      decoration: BoxDecoration(
        color: isActive ? _C.accent : _C.border,
        borderRadius: BorderRadius.circular(1),
      ),
    );
  }

  Widget _buildCurrentStep(AuthState state) {
    switch (_currentStep) {
      case _ForgotPasswordStep.email:
        return _buildEmailStep(state);
      case _ForgotPasswordStep.otp:
        return _buildOtpStep(state);
      case _ForgotPasswordStep.password:
        return _buildPasswordStep(state);
    }
  }

  Widget _buildEmailStep(AuthState state) {
    return Form(
      key: _formKey,
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const SizedBox(height: 28),
          _buildHeroIcon(Icons.alternate_email_rounded),
          const SizedBox(height: 28),
          Text(
            'Enter your email',
            textAlign: TextAlign.center,
            style: TextStyle(
              color: _C.darkBlue,
              fontSize: 22,
              fontWeight: FontWeight.w700,
            ),
          ),
          const SizedBox(height: 12),
          Text(
            'We will send a verification code to your email address',
            textAlign: TextAlign.center,
            style: TextStyle(
              color: _C.textMuted,
              fontSize: 14,
              fontWeight: FontWeight.w500,
              height: 1.5,
            ),
          ),
          const SizedBox(height: 30),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 20),
            decoration: BoxDecoration(
              color: _C.cardBg,
              borderRadius: BorderRadius.circular(24),
              border: Border.all(color: _C.border),
              boxShadow: [
                BoxShadow(
                  color: _C.accentGlow.withValues(alpha: 0.07),
                  blurRadius: 32,
                  offset: const Offset(0, 12),
                ),
              ],
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const _FieldLabel('Email Address'),
                const SizedBox(height: 7),
                _CleanField(
                  controller: _emailCtrl,
                  hint: 'your@email.com',
                  icon: Icons.email_outlined,
                  keyboardType: TextInputType.emailAddress,
                  validator: (v) {
                    if (v == null || v.isEmpty) {
                      return 'Please enter your email';
                    }
                    if (!RegExp(r'^[^@]+@[^@]+\.[^@]+').hasMatch(v)) {
                      return 'Please enter a valid email';
                    }
                    return null;
                  },
                ),
              ],
            ),
          ),
          const SizedBox(height: 28),
          _PrimaryButton(
            loading: state is AuthLoading,
            onPressed: _onEmailSubmit,
            label: 'Continue',
          ),
          const SizedBox(height: 14),
          Center(
            child: TextButton(
              onPressed: () => Navigator.pop(context),
              child: const Text(
                'Back to Login',
                style: TextStyle(
                  color: _C.textMuted,
                  fontSize: 14,
                  fontWeight: FontWeight.w500,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildOtpStep(AuthState state) {
    return Form(
      key: _formKey,
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const SizedBox(height: 28),
          _buildHeroIcon(Icons.mark_email_read_outlined),
          const SizedBox(height: 28),
          Text(
            'Verify your email',
            textAlign: TextAlign.center,
            style: TextStyle(
              color: _C.darkBlue,
              fontSize: 22,
              fontWeight: FontWeight.w700,
            ),
          ),
          const SizedBox(height: 12),
          Text(
            'Enter the 6-digit code sent to\n$_savedEmail',
            textAlign: TextAlign.center,
            style: TextStyle(
              color: _C.textMuted,
              fontSize: 14,
              fontWeight: FontWeight.w500,
              height: 1.5,
            ),
          ),
          const SizedBox(height: 30),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 20),
            decoration: BoxDecoration(
              color: _C.cardBg,
              borderRadius: BorderRadius.circular(24),
              border: Border.all(color: _C.border),
              boxShadow: [
                BoxShadow(
                  color: _C.accentGlow.withValues(alpha: 0.07),
                  blurRadius: 32,
                  offset: const Offset(0, 12),
                ),
              ],
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const _FieldLabel('Verification Code'),
                const SizedBox(height: 7),
                _CleanField(
                  controller: _otpCtrl,
                  hint: '000000',
                  icon: Icons.confirmation_number_outlined,
                  keyboardType: TextInputType.number,
                  validator: (v) {
                    if (v == null || v.isEmpty) {
                      return 'Please enter the verification code';
                    }
                    if (v.length < 6) {
                      return 'Code must be 6 digits';
                    }
                    return null;
                  },
                ),
                const SizedBox(height: 16),
                Container(
                  padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 16),
                  decoration: BoxDecoration(
                    color: _otpRemainingSeconds < 60 
                        ? _C.error.withOpacity(0.1) 
                        : _C.accentLight,
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(
                      color: _otpRemainingSeconds < 60 
                          ? _C.error.withOpacity(0.3) 
                          : _C.border,
                    ),
                  ),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(
                        Icons.timer_outlined,
                        size: 18,
                        color: _otpRemainingSeconds < 60 ? _C.error : _C.accent,
                      ),
                      const SizedBox(width: 8),
                      Text(
                        _canResendOtp 
                            ? 'Code expired' 
                            : 'Code expires in: ${_formatOtpTimer()}',
                        style: TextStyle(
                          color: _otpRemainingSeconds < 60 ? _C.error : _C.accent,
                          fontSize: 14,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 28),
          _PrimaryButton(
            loading: state is AuthLoading,
            onPressed: _canResendOtp ? _onSendOtp : _onVerifyOtp,
            label: _canResendOtp ? 'Resend Code' : 'Verify Code',
          ),
          const SizedBox(height: 14),
          if (_canResendOtp)
            Center(
              child: TextButton(
                onPressed: () => _goToStep(_ForgotPasswordStep.email),
                child: const Text(
                  'Use different email',
                  style: TextStyle(
                    color: _C.textMuted,
                    fontSize: 14,
                    fontWeight: FontWeight.w500,
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }

  Widget _buildPasswordStep(AuthState state) {
    return Form(
      key: _formKey,
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const SizedBox(height: 28),
          _buildHeroIcon(Icons.lock_reset_rounded),
          const SizedBox(height: 28),
          Text(
            'Create new password',
            textAlign: TextAlign.center,
            style: TextStyle(
              color: _C.darkBlue,
              fontSize: 22,
              fontWeight: FontWeight.w700,
            ),
          ),
          const SizedBox(height: 12),
          Text(
            'Your identity has been verified. Set your new password.',
            textAlign: TextAlign.center,
            style: TextStyle(
              color: _C.textMuted,
              fontSize: 14,
              fontWeight: FontWeight.w500,
              height: 1.5,
            ),
          ),
          const SizedBox(height: 30),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 20),
            decoration: BoxDecoration(
              color: _C.cardBg,
              borderRadius: BorderRadius.circular(24),
              border: Border.all(color: _C.border),
              boxShadow: [
                BoxShadow(
                  color: _C.accentGlow.withValues(alpha: 0.07),
                  blurRadius: 32,
                  offset: const Offset(0, 12),
                ),
              ],
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const _FieldLabel('New Password'),
                const SizedBox(height: 7),
                _CleanField(
                  controller: _newPassCtrl,
                  hint: 'Minimum 8 characters',
                  icon: Icons.lock_outline_rounded,
                  obscureText: true,
                  validator: (v) {
                    if (v == null || v.isEmpty) {
                      return 'Please enter a password';
                    }
                    if (v.length < 8) {
                      return 'Password must be at least 8 characters';
                    }
                    return null;
                  },
                ),
                const SizedBox(height: 20),
                const _FieldLabel('Confirm Password'),
                const SizedBox(height: 7),
                _CleanField(
                  controller: _confPassCtrl,
                  hint: 'Re-enter your password',
                  icon: Icons.lock_person_outlined,
                  obscureText: true,
                  validator: (v) {
                    if (v == null || v.isEmpty) {
                      return 'Please confirm your password';
                    }
                    if (v != _newPassCtrl.text) {
                      return 'Passwords do not match';
                    }
                    return null;
                  },
                ),
              ],
            ),
          ),
          const SizedBox(height: 28),
          _PrimaryButton(
            loading: state is AuthLoading,
            onPressed: _onResetPassword,
            label: 'Reset Password',
          ),
          const SizedBox(height: 14),
          Center(
            child: TextButton(
              onPressed: () => _goToStep(_ForgotPasswordStep.otp),
              child: const Text(
                'Back',
                style: TextStyle(
                  color: _C.textMuted,
                  fontSize: 14,
                  fontWeight: FontWeight.w500,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildHeroIcon(IconData icon) {
    return Center(
      child: Stack(
        alignment: Alignment.center,
        children: [
          Container(
            width: 100,
            height: 100,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: _C.accentSoft.withValues(alpha: 0.10),
            ),
          ),
          Container(
            width: 78,
            height: 78,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: _C.accentSoft.withValues(alpha: 0.12),
            ),
          ),
          Container(
            width: 60,
            height: 60,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              gradient: const LinearGradient(
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
                colors: [_C.accentSoft, _C.accent],
              ),
              boxShadow: [
                BoxShadow(
                  color: _C.accentGlow.withValues(alpha: 0.30),
                  blurRadius: 20,
                  offset: const Offset(0, 8),
                ),
              ],
            ),
            child: Icon(
              icon,
              size: 26,
              color: Colors.white,
            ),
          ),
        ],
      ),
    );
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

class _Blob extends StatelessWidget {
  const _Blob({required this.size, required this.color});
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
  });
  final bool loading;
  final VoidCallback onPressed;
  final String label;

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
                    color: _C.accentGlow.withValues(alpha: 0.30),
                    blurRadius: 20,
                    offset: const Offset(0, 8),
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
