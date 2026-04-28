import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:recrutitn/core/theme/app_theme.dart';
import 'package:recrutitn/core/utils/snackbar_utils.dart';
import 'package:recrutitn/core/constants/app_constants.dart';
import 'package:recrutitn/features/auth/presentation/bloc/auth_bloc.dart';
import 'package:recrutitn/features/auth/presentation/bloc/auth_event.dart';
import 'package:recrutitn/features/auth/presentation/bloc/auth_state.dart';
import 'package:recrutitn/features/auth/presentation/pages/login_page.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:dio/dio.dart';
import 'package:recrutitn/l10n/app_localizations.dart';
import 'package:recrutitn/core/localization/locale_controller.dart';
import 'change_password_page.dart';

class SettingsPage extends StatefulWidget {
  const SettingsPage({super.key});

  @override
  State<SettingsPage> createState() => _SettingsPageState();
}

class _SettingsPageState extends State<SettingsPage> {
  @override
  Widget build(BuildContext context) {
    final languageCode = _currentLanguageCode(context);

    return Scaffold(
      backgroundColor: const Color(0xFFF8F9FA), // Very light cool gray
      appBar: AppBar(
        title: Text(
          AppLocalizations.of(context)!.settings,
          style: GoogleFonts.outfit(
            fontWeight: FontWeight.bold,
            color: AppTheme.textColor,
          ),
        ),
        backgroundColor: Colors.white,
        elevation: 0,
        centerTitle: true,
        leading: IconButton(
          icon: const Icon(
            Icons.arrow_back_ios_new_rounded,
            color: AppTheme.textColor,
            size: 20,
          ),
          onPressed: () => Navigator.pop(context),
        ),
      ),
      body: SingleChildScrollView(
        physics: const BouncingScrollPhysics(),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const SizedBox(height: 16),
            _buildSectionHeader(AppLocalizations.of(context)!.accountSecurity),
            _buildSettingsCard([
              _buildSettingsTile(
                icon: Icons.lock_outline_rounded,
                title: AppLocalizations.of(context)!.changePassword,
                subtitle: AppLocalizations.of(context)!.changePasswordSubtitle,
                onTap: () {
                  Navigator.push(
                    context,
                    MaterialPageRoute(
                      builder: (context) => const ChangePasswordPage(),
                    ),
                  );
                },
              ),
              _buildSettingsTile(
                icon: Icons.verified_user_outlined,
                title: AppLocalizations.of(context)!.emailVerification,
                subtitle: AppLocalizations.of(context)!.emailVerifiedSubtitle,
                trailing: const Icon(
                  Icons.check_circle,
                  color: Colors.green,
                  size: 20,
                ),
                onTap: () {},
              ),
            ]),
            const SizedBox(height: 24),
            _buildSectionHeader(AppLocalizations.of(context)!.preferences),
            _buildSettingsCard([
              _buildSettingsTile(
                icon: Icons.language_rounded,
                title: AppLocalizations.of(context)!.appLanguage,
                subtitle: AppLocalizations.of(
                  context,
                )!.currentLanguage(_languageLabel(languageCode)),
                trailing: DropdownButtonHideUnderline(
                  child: DropdownButton<String>(
                    value: languageCode,
                    borderRadius: BorderRadius.circular(12),
                    items: const [
                      DropdownMenuItem(value: 'en', child: Text('English')),
                      DropdownMenuItem(value: 'fr', child: Text('Francais')),
                      DropdownMenuItem(value: 'ar', child: Text('Arabic')),
                    ],
                    onChanged: (val) async {
                      if (val == null) return;
                      await _changeLanguage(val);
                    },
                  ),
                ),
                onTap: _showLanguagePicker,
              ),
            ]),
            const SizedBox(height: 40),
            Center(
              child: Text(
                "Version 1.0.0",
                style: GoogleFonts.inter(
                  color: AppTheme.subtextColor.withValues(alpha: 0.5),
                  fontSize: 12,
                ),
              ),
            ),
            const SizedBox(height: 40),
          ],
        ),
      ),
    );
  }

  Widget _buildSectionHeader(String title) {
    return Padding(
      padding: const EdgeInsets.only(left: 24, bottom: 12),
      child: Text(
        title,
        style: GoogleFonts.outfit(
          fontSize: 12,
          fontWeight: FontWeight.w700,
          color: AppTheme.subtextColor,
          letterSpacing: 1.2,
        ),
      ),
    );
  }

  Widget _buildSettingsCard(List<Widget> children) {
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.03),
            blurRadius: 10,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Column(children: children),
    );
  }

  Widget _buildSettingsTile({
    required IconData icon,
    required String title,
    required String subtitle,
    VoidCallback? onTap,
    Widget? trailing,
    Color? titleColor,
    Color? iconColor,
  }) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(16),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
          child: Row(
            children: [
              Container(
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  color: (iconColor ?? AppTheme.primaryColor).withValues(
                    alpha: 0.08,
                  ),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Icon(
                  icon,
                  color: iconColor ?? AppTheme.primaryColor,
                  size: 22,
                ),
              ),
              const SizedBox(width: 16),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      title,
                      style: GoogleFonts.inter(
                        fontSize: 15,
                        fontWeight: FontWeight.w600,
                        color: titleColor ?? AppTheme.textColor,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      subtitle,
                      style: GoogleFonts.inter(
                        fontSize: 12,
                        color: AppTheme.subtextColor,
                      ),
                    ),
                  ],
                ),
              ),
              trailing ??
                  const Icon(
                    Icons.arrow_forward_ios_rounded,
                    color: Colors.grey,
                    size: 14,
                  ),
            ],
          ),
        ),
      ),
    );
  }

  String _languageLabel(String code) {
    switch (code) {
      case 'ar':
        return 'العربية';
      case 'fr':
        return 'Français';
      default:
        return 'English';
    }
  }

  String _currentLanguageCode(BuildContext context) {
    final code = Localizations.localeOf(context).languageCode;
    switch (code) {
      case 'ar':
      case 'fr':
      case 'en':
        return code;
      default:
        return 'en';
    }
  }

  Future<void> _changeLanguage(String languageCode) async {
    if (languageCode == _currentLanguageCode(context)) return;

    await LocaleController.instance.setLocale(languageCode);
    if (!mounted) return;

    final l10n = AppLocalizations.of(context)!;
    SnackBarUtils.showInfo(
      context,
      l10n.languageChanged(_languageLabel(languageCode)),
    );
  }

  void _showLanguagePicker() {
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) {
        return SafeArea(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const SizedBox(height: 12),
              ListTile(
                leading: const Text(
                  'EN',
                  style: TextStyle(fontWeight: FontWeight.w800),
                ),
                title: const Text('English'),
                trailing: _currentLanguageCode(context) == 'en'
                    ? const Icon(
                        Icons.check_rounded,
                        color: AppTheme.primaryColor,
                      )
                    : null,
                onTap: () async {
                  Navigator.pop(ctx);
                  await _changeLanguage('en');
                },
              ),
              ListTile(
                leading: const Text(
                  'FR',
                  style: TextStyle(fontWeight: FontWeight.w800),
                ),
                title: const Text('Français'),
                trailing: _currentLanguageCode(context) == 'fr'
                    ? const Icon(
                        Icons.check_rounded,
                        color: AppTheme.primaryColor,
                      )
                    : null,
                onTap: () async {
                  Navigator.pop(ctx);
                  await _changeLanguage('fr');
                },
              ),
              ListTile(
                leading: const Text(
                  'AR',
                  style: TextStyle(fontWeight: FontWeight.w800),
                ),
                title: const Text('العربية'),
                trailing: _currentLanguageCode(context) == 'ar'
                    ? const Icon(
                        Icons.check_rounded,
                        color: AppTheme.primaryColor,
                      )
                    : null,
                onTap: () async {
                  Navigator.pop(ctx);
                  await _changeLanguage('ar');
                },
              ),
              const SizedBox(height: 10),
            ],
          ),
        );
      },
    );
  }

  Future<void> _deactivateAccount() async {
    try {
      final dio = Dio();
      final authBloc = context.read<AuthBloc>();
      final state = authBloc.state;

      if (state is! AuthAuthenticated) {
        if (mounted) {
          SnackBarUtils.showError(
            context,
            "${AppLocalizations.of(context)!.error}: User not authenticated",
          );
        }
        return;
      }

      final token = state.user.token;

      final response = await dio.post(
        '${AppConstants.apiBaseUrl}/auth/deactivate',
        options: Options(
          headers: {
            'Authorization': 'Bearer $token',
            'Accept': 'application/json',
          },
        ),
      );

      if (response.statusCode == 200 && mounted) {
        // Log out the user
        authBloc.add(LogoutEvent());

        // Navigate to login page
        Navigator.of(context).pushAndRemoveUntil(
          MaterialPageRoute(builder: (_) => const LoginPage()),
          (route) => false,
        );

        SnackBarUtils.showSuccess(
          context,
          AppLocalizations.of(context)!.accountDeactivated,
        );
      }
    } catch (e) {
      if (mounted) {
        SnackBarUtils.showError(context, AppLocalizations.of(context)!.error);
      }
    }
  }

  void _showConfirmationDialog(
    String title,
    String content,
    String actionText,
    VoidCallback onConfirm, {
    bool isDestructive = false,
    IconData? icon,
  }) {
    final accentColor = isDestructive
        ? const Color(0xFFDC2626)
        : AppTheme.primaryColor;

    showDialog(
      context: context,
      barrierColor: Colors.black.withValues(alpha: 0.45),
      builder: (context) => Dialog(
        elevation: 0,
        backgroundColor: Colors.transparent,
        insetPadding: const EdgeInsets.symmetric(horizontal: 20, vertical: 24),
        child: Container(
          constraints: const BoxConstraints(maxWidth: 440),
          padding: const EdgeInsets.fromLTRB(22, 22, 22, 18),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(24),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(alpha: 0.16),
                blurRadius: 24,
                offset: const Offset(0, 16),
              ),
            ],
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Container(
                    width: 44,
                    height: 44,
                    decoration: BoxDecoration(
                      color: accentColor.withValues(alpha: 0.12),
                      borderRadius: BorderRadius.circular(14),
                    ),
                    child: Icon(
                      icon ?? Icons.warning_amber_rounded,
                      color: accentColor,
                      size: 24,
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Text(
                      title,
                      style: GoogleFonts.outfit(
                        fontSize: 26,
                        fontWeight: FontWeight.w800,
                        color: AppTheme.textColor,
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 16),
              Text(
                content,
                style: GoogleFonts.inter(
                  fontSize: 16,
                  height: 1.45,
                  color: AppTheme.subtextColor,
                  fontWeight: FontWeight.w500,
                ),
              ),
              const SizedBox(height: 24),
              Row(
                children: [
                  Expanded(
                    child: OutlinedButton(
                      onPressed: () => Navigator.pop(context),
                      style: OutlinedButton.styleFrom(
                        minimumSize: const Size.fromHeight(48),
                        side: BorderSide(
                          color: AppTheme.subtextColor.withValues(alpha: 0.25),
                        ),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(14),
                        ),
                      ),
                      child: Text(
                        AppLocalizations.of(context)!.cancelButton,
                        style: GoogleFonts.inter(
                          color: AppTheme.subtextColor,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: ElevatedButton(
                      onPressed: () {
                        Navigator.pop(context);
                        onConfirm();
                      },
                      style: ElevatedButton.styleFrom(
                        minimumSize: const Size.fromHeight(48),
                        backgroundColor: accentColor,
                        foregroundColor: Colors.white,
                        elevation: 0,
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(14),
                        ),
                      ),
                      child: Text(
                        actionText,
                        style: GoogleFonts.inter(
                          fontWeight: FontWeight.w700,
                          fontSize: 15,
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}
