import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:recrutitn/l10n/app_localizations.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/utils/snackbar_utils.dart';
import '../../../../widgets/custom_text_field.dart';
import '../../../../widgets/form_step_indicator.dart';
import '../../../../widgets/section_header.dart';
import '../bloc/auth_bloc.dart';
import '../bloc/auth_event.dart';
import '../bloc/auth_state.dart';
import 'complete_profile_candidat_page.dart';

class SignUpPage extends StatefulWidget {
  const SignUpPage({super.key});

  @override
  State<SignUpPage> createState() => _SignUpPageState();
}

class _SignUpPageState extends State<SignUpPage> with SingleTickerProviderStateMixin {
  final TextEditingController _nameController = TextEditingController();
  final TextEditingController _emailController = TextEditingController();
  final TextEditingController _passwordController = TextEditingController();
  final TextEditingController _confirmPasswordController =
      TextEditingController();

  final _formKey = GlobalKey<FormState>();

  bool _hasMinLength = false;
  bool _hasUppercase = false;
  bool _hasNumber = false;
  bool _hasSpecialChar = false;

  late AnimationController _entranceController;
  late Animation<double> _fadeAnimation;
  late Animation<Offset> _slideAnimation;

  @override
  void initState() {
    super.initState();
    _passwordController.addListener(_onPasswordChanged);

    _entranceController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1000),
    );

    _fadeAnimation = CurvedAnimation(
      parent: _entranceController,
      curve: Curves.easeIn,
    );

    _slideAnimation = Tween<Offset>(
      begin: const Offset(0, 0.05),
      end: Offset.zero,
    ).animate(CurvedAnimation(
      parent: _entranceController,
      curve: Curves.easeOutCubic,
    ));

    _entranceController.forward();
  }

  @override
  void dispose() {
    _passwordController.removeListener(_onPasswordChanged);
    _nameController.dispose();
    _emailController.dispose();
    _passwordController.dispose();
    _confirmPasswordController.dispose();
    _entranceController.dispose();
    super.dispose();
  }

  void _onPasswordChanged() {
    final value = _passwordController.text;
    setState(() {
      _hasMinLength = value.length >= 8;
      _hasUppercase = RegExp(r'[A-Z]').hasMatch(value);
      _hasNumber = RegExp(r'\d').hasMatch(value);
      _hasSpecialChar = RegExp(r'[^A-Za-z0-9]').hasMatch(value);
    });
  }

  void _onNext() {
    if (_formKey.currentState!.validate()) {
      if (_passwordController.text != _confirmPasswordController.text) {
        SnackBarUtils.showError(
          context,
          AppLocalizations.of(context)!.passwordsDoNotMatch,
        );
        return;
      }

      context.read<AuthBloc>().add(
        CheckEmailEvent(email: _normalizedEmail()),
      );
    }
  }

  void _navigateToNextPage() {
    final nextPage = CompleteProfileCandidatPage(
      name: _nameController.text.trim(),
      email: _normalizedEmail(),
      password: _passwordController.text,
      role: 'candidat',
    );

    Navigator.push(context, MaterialPageRoute(builder: (context) => nextPage));
  }

  String _normalizedEmail() {
    return _emailController.text.trim().toLowerCase();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppTheme.backgroundColor,
      appBar: AppBar(
        elevation: 0,
        backgroundColor: Colors.transparent,
      ),
      body: BlocConsumer<AuthBloc, AuthState>(
        listener: (context, state) {
          if (state is AuthEmailCheckResult) {
            if (state.exists) {
              SnackBarUtils.showError(
                context,
                AppLocalizations.of(context)!.emailInUse,
              );
            } else {
              _navigateToNextPage();
            }
          } else if (state is AuthError) {
            SnackBarUtils.showError(context, state.message);
          }
        },
        builder: (context, state) {
          return SafeArea(
            child: FadeTransition(
              opacity: _fadeAnimation,
              child: SlideTransition(
                position: _slideAnimation,
                child: SingleChildScrollView(
                  padding: const EdgeInsets.symmetric(horizontal: 24.0),
                  child: Form(
                    key: _formKey,
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const FormStepIndicator(currentStep: 1, totalSteps: 2),
                        SectionHeader(
                          title: AppLocalizations.of(context)!.letsStartTitle,
                          subtitle: AppLocalizations.of(context)!.letsStartSubtitle,
                          center: true,
                        ),
                        Container(
                          padding: const EdgeInsets.all(24),
                          decoration: BoxDecoration(
                            color: Colors.white,
                            borderRadius: BorderRadius.circular(28),
                            boxShadow: [
                              BoxShadow(
                                color: Colors.black.withValues(alpha: 0.04),
                                blurRadius: 24,
                                offset: const Offset(0, 12),
                              ),
                            ],
                          ),
                        child: Column(
                          children: [
                            CustomTextField(
                              controller: _nameController,
                              hintText: AppLocalizations.of(
                                context,
                              )!.fullNameHint,
                              prefixIcon: Icons.person_outline,
                              validator: (v) => v!.isEmpty
                                  ? AppLocalizations.of(context)!.nameRequired
                                  : null,
                            ),
                            const SizedBox(height: 8),
                            CustomTextField(
                              controller: _emailController,
                              hintText: AppLocalizations.of(context)!.emailHint,
                              prefixIcon: Icons.email_outlined,
                              keyboardType: TextInputType.emailAddress,
                              validator: (v) {
                                if (v == null || v.isEmpty) {
                                  return AppLocalizations.of(context)!.emailRequired;
                                }
                                if (!v.trim().toLowerCase().endsWith('@gmail.com')) {
                                  return "Veuillez utiliser une adresse Gmail (@gmail.com).";
                                }
                                return null;
                              },
                            ),
                            const SizedBox(height: 8),
                            CustomTextField(
                              controller: _passwordController,
                              hintText: AppLocalizations.of(
                                context,
                              )!.passwordHint,
                              prefixIcon: Icons.lock_outline,
                              obscureText: true,
                              autovalidateMode:
                                  AutovalidateMode.onUserInteraction,
                              validator: (v) =>
                                  v!.length < 8 ? AppLocalizations.of(context)!.passwordMinLength : null,
                            ),
                            const SizedBox(height: 10),
                            Wrap(
                              spacing: 8,
                              runSpacing: 8,
                              children: [
                                _buildPasswordRule(
                                  label: 'Minimum 8 characters',
                                  met: _hasMinLength,
                                ),
                                _buildPasswordRule(
                                  label: '1 uppercase letter',
                                  met: _hasUppercase,
                                ),
                                _buildPasswordRule(
                                  label: '1 number',
                                  met: _hasNumber,
                                ),
                                _buildPasswordRule(
                                  label: '1 special character',
                                  met: _hasSpecialChar,
                                ),
                              ],
                            ),
                            const SizedBox(height: 8),
                            CustomTextField(
                              controller: _confirmPasswordController,
                              hintText: AppLocalizations.of(
                                context,
                              )!.confirmPasswordHint,
                              prefixIcon: Icons.lock_clock_outlined,
                              obscureText: true,
                              autovalidateMode:
                                  AutovalidateMode.onUserInteraction,
                              validator: (v) {
                                if (v != _passwordController.text) {
                                  return AppLocalizations.of(
                                    context,
                                  )!.passwordsDoNotMatch;
                                }
                                return null;
                              },
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 32),

                    SizedBox(
                      width: double.infinity,
                      child: ElevatedButton(
                        onPressed: state is AuthLoading ? null : _onNext,
                        child: state is AuthLoading
                            ? const SizedBox(
                                height: 20,
                                width: 20,
                                child: CircularProgressIndicator(
                                  strokeWidth: 2,
                                  color: Colors.white,
                                ),
                              )
                            : Text(AppLocalizations.of(context)!.continueButton),
                      ),
                    ),
                    const SizedBox(height: 24),

                    Center(
                      child: TextButton(
                        onPressed: () => Navigator.pop(context),
                        child: RichText(
                          text: TextSpan(
                            text: AppLocalizations.of(
                              context,
                            )!.alreadyRegistered,
                            style: TextStyle(color: AppTheme.subtextColor),
                            children: [
                              TextSpan(
                                text: AppLocalizations.of(context)!.loginButton,
                                style: TextStyle(
                                  color: AppTheme.primaryColor,
                                  fontWeight: FontWeight.bold,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(height: 40),
                  ],
                ),
              ),
            ),
          ),
        ),
      );
    }
      ),
    );
  }

  Widget _buildPasswordRule({required String label, required bool met}) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: met ? const Color(0xFFE8F9EE) : const Color(0xFFF1F5F9),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(
            met ? Icons.check : Icons.radio_button_unchecked_rounded,
            size: 14,
            color: met ? const Color(0xFF16A34A) : const Color(0xFF64748B),
          ),
          const SizedBox(width: 6),
          Text(
            label,
            style: TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w600,
              color: met ? const Color(0xFF15803D) : const Color(0xFF64748B),
            ),
          ),
        ],
      ),
    );
  }
}
