import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:recrutitn/core/theme/app_theme.dart';
import 'package:recrutitn/core/utils/snackbar_utils.dart';
import 'package:recrutitn/features/auth/presentation/bloc/auth_bloc.dart';
import 'package:recrutitn/features/auth/presentation/bloc/auth_event.dart';
import 'package:recrutitn/features/auth/presentation/bloc/auth_state.dart';
import 'package:recrutitn/l10n/app_localizations.dart';

class ChangePasswordPage extends StatefulWidget {
  const ChangePasswordPage({super.key});

  @override
  State<ChangePasswordPage> createState() => _ChangePasswordPageState();
}

class _ChangePasswordPageState extends State<ChangePasswordPage> {
  final _formKey = GlobalKey<FormState>();
  final _currentPasswordController = TextEditingController();
  final _newPasswordController = TextEditingController();
  final _confirmPasswordController = TextEditingController();

  bool _obscureCurrent = true;
  bool _obscureNew = true;
  bool _obscureConfirm = true;

  @override
  void initState() {
    super.initState();
    _newPasswordController.addListener(() => setState(() {}));
    _confirmPasswordController.addListener(() => setState(() {}));
  }

  @override
  void dispose() {
    _currentPasswordController.dispose();
    _newPasswordController.dispose();
    _confirmPasswordController.dispose();
    super.dispose();
  }

  double _calculateStrength() {
    final text = _newPasswordController.text;
    if (text.isEmpty) return 0.0;
    
    double strength = 0;
    if (text.length >= 8) strength += 0.3;
    if (text.contains(RegExp(r'[A-Z]'))) strength += 0.2;
    if (text.contains(RegExp(r'[a-z]'))) strength += 0.1;
    if (text.contains(RegExp(r'[0-9]'))) strength += 0.2;
    if (text.contains(RegExp(r'[!@#$%^&*(),.?":{}|<>]'))) strength += 0.2;
    
    return strength.clamp(0.0, 1.0);
  }

  void _onUpdatePressed() {
    if (_formKey.currentState!.validate()) {
      context.read<AuthBloc>().add(
            UpdatePasswordEvent(
              currentPassword: _currentPasswordController.text,
              newPassword: _newPasswordController.text,
            ),
          );
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context)!;
    final strength = _calculateStrength();

    return BlocListener<AuthBloc, AuthState>(
      listener: (context, state) {
        if (state is UpdatePasswordSuccess) {
          SnackBarUtils.showSuccess(context, l10n.passwordUpdatedSuccess);
          Navigator.pop(context);
        } else if (state is UpdatePasswordError) {
          SnackBarUtils.showError(context, state.message);
        }
      },
      child: Scaffold(
        backgroundColor: AppTheme.backgroundColor,
        body: CustomScrollView(
          physics: const BouncingScrollPhysics(),
          slivers: [
            _buildAppBar(context, l10n),
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 24.0, vertical: 8.0),
                child: Form(
                  key: _formKey,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      _buildHeroSection(l10n),
                      const SizedBox(height: 32),
                      _buildFormCard(l10n, strength),
                      const SizedBox(height: 40),
                      _buildActionButtons(l10n),
                      const SizedBox(height: 100),
                    ],
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildAppBar(BuildContext context, AppLocalizations l10n) {
    return SliverAppBar(
      pinned: true,
      backgroundColor: AppTheme.backgroundColor,
      elevation: 0,
      leading: Padding(
        padding: const EdgeInsets.all(8.0),
        child: Container(
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(12),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(alpha: 0.03),
                blurRadius: 10,
                offset: const Offset(0, 4),
              ),
            ],
          ),
          child: IconButton(
            icon: const Icon(Icons.arrow_back_ios_new_rounded, size: 18, color: AppTheme.textColor),
            onPressed: () => Navigator.pop(context),
          ),
        ),
      ),
      expandedHeight: 80,
      flexibleSpace: FlexibleSpaceBar(
        titlePadding: const EdgeInsets.only(bottom: 16),
        centerTitle: true,
        title: Text(
          l10n.changePassword,
          style: GoogleFonts.outfit(
            fontSize: 18,
            fontWeight: FontWeight.w700,
            color: AppTheme.textColor,
          ),
        ),
      ),
    );
  }

  Widget _buildHeroSection(AppLocalizations l10n) {
    return Center(
      child: Column(
        children: [
          Container(
            padding: const EdgeInsets.all(24),
            decoration: BoxDecoration(
              color: AppTheme.primaryColor.withValues(alpha: 0.05),
              shape: BoxShape.circle,
            ),
            child: Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: AppTheme.primaryColor.withValues(alpha: 0.1),
                shape: BoxShape.circle,
              ),
              child: const Icon(
                Icons.lock_reset_rounded,
                size: 48,
                color: AppTheme.primaryColor,
              ),
            ),
          ),
          const SizedBox(height: 24),
          Text(
            l10n.passwordSecurityInfo,
            textAlign: TextAlign.center,
            style: GoogleFonts.inter(
              fontSize: 14,
              color: AppTheme.subtextColor,
              height: 1.5,
              fontWeight: FontWeight.w500,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildFormCard(AppLocalizations l10n, double strength) {
    return Container(
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(28),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.02),
            blurRadius: 20,
            offset: const Offset(0, 10),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _buildLabel(l10n.currentPassword),
          _buildPasswordField(
            controller: _currentPasswordController,
            hintText: l10n.enterCurrentPassword,
            obscureText: _obscureCurrent,
            onToggle: () => setState(() => _obscureCurrent = !_obscureCurrent),
            validator: (value) {
              if (value == null || value.isEmpty) return l10n.enterCurrentPassword;
              return null;
            },
          ),
          const SizedBox(height: 28),
          _buildLabel(l10n.newPassword),
          _buildPasswordField(
            controller: _newPasswordController,
            hintText: l10n.passwordMinLength,
            obscureText: _obscureNew,
            onToggle: () => setState(() => _obscureNew = !_obscureNew),
            validator: (value) {
              if (value == null || value.isEmpty) return l10n.enterNewPassword;
              if (value.length < 8) return l10n.passwordMinLength;
              return null;
            },
          ),
          const SizedBox(height: 12),
          _buildStrengthMeter(strength),
          const SizedBox(height: 28),
          _buildLabel(l10n.confirmNewPassword),
          _buildPasswordField(
            controller: _confirmPasswordController,
            hintText: l10n.repeatNewPassword,
            obscureText: _obscureConfirm,
            onToggle: () => setState(() => _obscureConfirm = !_obscureConfirm),
            validator: (value) {
              if (value != _newPasswordController.text) return l10n.passwordsDoNotMatch;
              return null;
            },
          ),
          _buildMatchIndicator(l10n),
        ],
      ),
    );
  }

  Widget _buildStrengthMeter(double strength) {
    final l10n = AppLocalizations.of(context)!;
    Color color = Colors.redAccent;
    String label = l10n.strengthWeak;
    if (strength > 0.4) { color = Colors.orangeAccent; label = l10n.strengthFair; }
    if (strength > 0.7) { color = Colors.blueAccent; label = l10n.strengthGood; }
    if (strength >= 1.0) { color = const Color(0xFF10B981); label = l10n.strengthStrong; }

    return Column(
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(
              l10n.passwordStrength,
              style: GoogleFonts.inter(fontSize: 11, color: AppTheme.subtextColor, fontWeight: FontWeight.bold),
            ),
            Text(
              label,
              style: GoogleFonts.inter(fontSize: 11, color: color, fontWeight: FontWeight.w900, letterSpacing: 0.5),
            ),
          ],
        ),
        const SizedBox(height: 8),
        ClipRRect(
          borderRadius: BorderRadius.circular(10),
          child: LinearProgressIndicator(
            value: strength,
            minHeight: 6,
            backgroundColor: Colors.grey.shade100,
            valueColor: AlwaysStoppedAnimation<Color>(color),
          ),
        ),
      ],
    );
  }

  Widget _buildMatchIndicator(AppLocalizations l10n) {
    final newPass = _newPasswordController.text;
    final confirmPass = _confirmPasswordController.text;
    if (confirmPass.isEmpty) return const SizedBox.shrink();

    final isMatched = newPass == confirmPass && confirmPass.isNotEmpty;

    return Padding(
      padding: const EdgeInsets.only(top: 12),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 400),
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        decoration: BoxDecoration(
          color: isMatched ? const Color(0xFF10B981).withValues(alpha: 0.05) : Colors.redAccent.withValues(alpha: 0.05),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(
            color: isMatched ? const Color(0xFF10B981).withValues(alpha: 0.2) : Colors.redAccent.withValues(alpha: 0.2),
          ),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              isMatched ? Icons.verified_user_rounded : Icons.warning_amber_rounded,
              size: 14,
              color: isMatched ? const Color(0xFF10B981) : Colors.redAccent,
            ),
            const SizedBox(width: 8),
            Text(
              isMatched ? l10n.passwordsMatch : l10n.passwordsDoNotMatch,
              style: GoogleFonts.inter(
                fontSize: 12,
                fontWeight: FontWeight.w600,
                color: isMatched ? const Color(0xFF10B981) : Colors.redAccent,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildActionButtons(AppLocalizations l10n) {
    return BlocBuilder<AuthBloc, AuthState>(
      builder: (context, state) {
        final isLoading = state is AuthLoading;
        return Container(
          decoration: BoxDecoration(
            boxShadow: [
              BoxShadow(
                color: AppTheme.primaryColor.withValues(alpha: 0.25),
                blurRadius: 24,
                offset: const Offset(0, 8),
              ),
            ],
          ),
          child: ElevatedButton(
            onPressed: isLoading ? null : _onUpdatePressed,
            style: ElevatedButton.styleFrom(
              backgroundColor: AppTheme.primaryColor,
              minimumSize: const Size.fromHeight(64),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
              elevation: 0,
            ),
            child: isLoading
                ? const SizedBox(
                    height: 24,
                    width: 24,
                    child: CircularProgressIndicator(color: Colors.white, strokeWidth: 3),
                  )
                : Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Text(
                        l10n.updatePassword,
                        style: GoogleFonts.outfit(fontSize: 18, fontWeight: FontWeight.bold, color: Colors.white),
                      ),
                      const SizedBox(width: 12),
                      const Icon(Icons.arrow_forward_rounded, color: Colors.white, size: 20),
                    ],
                  ),
          ),
        );
      },
    );
  }

  Widget _buildLabel(String text) {
    return Padding(
      padding: const EdgeInsets.only(left: 2, bottom: 10),
      child: Text(
        text.toUpperCase(),
        style: GoogleFonts.outfit(
          fontSize: 11,
          fontWeight: FontWeight.w800,
          color: AppTheme.subtextColor,
          letterSpacing: 1.2,
        ),
      ),
    );
  }

  Widget _buildPasswordField({
    required TextEditingController controller,
    required String hintText,
    required bool obscureText,
    required VoidCallback onToggle,
    String? Function(String?)? validator,
  }) {
    return TextFormField(
      controller: controller,
      obscureText: obscureText,
      validator: validator,
      style: GoogleFonts.inter(fontSize: 15, color: AppTheme.textColor, fontWeight: FontWeight.w600),
      decoration: InputDecoration(
        hintText: hintText,
        hintStyle: GoogleFonts.inter(color: AppTheme.subtextColor.withValues(alpha: 0.4), fontWeight: FontWeight.normal),
        filled: true,
        fillColor: AppTheme.backgroundColor.withValues(alpha: 0.5),
        contentPadding: const EdgeInsets.symmetric(horizontal: 20, vertical: 20),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(18),
          borderSide: BorderSide.none,
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(18),
          borderSide: BorderSide(color: Colors.grey.shade100, width: 1.5),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(18),
          borderSide: const BorderSide(color: AppTheme.primaryColor, width: 2),
        ),
        errorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(18),
          borderSide: BorderSide(color: Colors.redAccent.withValues(alpha: 0.5), width: 1.5),
        ),
        suffixIcon: Padding(
          padding: const EdgeInsets.only(right: 8),
          child: IconButton(
            icon: AnimatedSwitcher(
              duration: const Duration(milliseconds: 300),
              child: Icon(
                obscureText ? Icons.visibility_off_outlined : Icons.visibility_outlined,
                key: ValueKey(obscureText),
                color: AppTheme.subtextColor,
                size: 22,
              ),
            ),
            onPressed: onToggle,
          ),
        ),
      ),
    );
  }
}
