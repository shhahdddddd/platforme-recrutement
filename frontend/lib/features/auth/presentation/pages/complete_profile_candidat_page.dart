import 'dart:io';

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:image_picker/image_picker.dart';
import 'package:recrutitn/l10n/app_localizations.dart';
import '../../../../core/constants/app_constants.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/utils/snackbar_utils.dart';
import '../../../../widgets/custom_text_field.dart';
import '../../../../widgets/section_header.dart';
import '../../../../widgets/form_step_indicator.dart';
import '../../../../widgets/premium_dropdown.dart';
import '../../../../widgets/selection_cards.dart';
import '../bloc/auth_bloc.dart';
import '../bloc/auth_event.dart';
import '../bloc/auth_state.dart';
import 'login_page.dart';

class CompleteProfileCandidatPage extends StatefulWidget {
  final String name;
  final String email;
  final String password;
  final String role;

  const CompleteProfileCandidatPage({
    super.key,
    required this.name,
    required this.email,
    required this.password,
    required this.role,
  });

  @override
  State<CompleteProfileCandidatPage> createState() => _CompleteProfileCandidatPageState();
}

class _CompleteProfileCandidatPageState extends State<CompleteProfileCandidatPage> {
  final TextEditingController _phoneController = TextEditingController();
  final TextEditingController _bioController = TextEditingController();
  
  String? _selectedLocation;
  String? _selectedSpecialite;
  String? _photoPath;
  bool _isStudent = false;
  bool _isEngineer = false;

  void _onSignUp() {
    // Phone number validation for Tunisia (only if phone is provided)
    final phone = _phoneController.text.trim();
    String? digitsOnly;
    
    if (phone.isNotEmpty) {
      // Remove any non-digit characters (should already be digits only due to formatter)
      digitsOnly = phone.replaceAll(RegExp(r'[^\d]'), '');
      
      // Check if exactly 8 digits
      if (digitsOnly.length != 8) {
        SnackBarUtils.showError(context, 'Phone number must contain exactly 8 digits');
        return;
      }
      
      // Check if starts with 2, 4, 5, 7, or 9 (Tunisian prefixes)
      final firstDigit = digitsOnly[0];
      if (!['2', '4', '5', '7', '9'].contains(firstDigit)) {
        SnackBarUtils.showError(context, 'Phone number must start with 2 (Orange), 4 (Ooredoo), 5 (Tunisie Telecom), 7 (Landline), or 9');
        return;
      }
    }

    context.read<AuthBloc>().add(
          SignUpEvent(
            name: widget.name,
            email: widget.email,
            password: widget.password,
            role: widget.role,
            phone: digitsOnly, // Send digits if provided, null if empty
            location: _selectedLocation,
            specialite: _selectedSpecialite,
            bio: _bioController.text,
            isStudent: _isStudent,
            isEngineer: _isEngineer,
            photoPath: _photoPath,
          ),
        );
  }

  Widget _buildEnhancedPhotoPicker() {
    return StatefulBuilder(
      builder: (context, setState) {
        return Column(
          children: [
            GestureDetector(
              onTap: () async {
                final ImagePicker picker = ImagePicker();
                final XFile? pickedFile = await picker.pickImage(
                  source: ImageSource.gallery,
                  imageQuality: 85,
                );
                if (pickedFile != null) {
                  setState(() {
                    _photoPath = pickedFile.path;
                  });
                }
              },
              child: Container(
                width: 140,
                height: 140,
                decoration: BoxDecoration(
                  color: Colors.white,
                  shape: BoxShape.circle,
                  border: Border.all(
                    color: _photoPath != null
                        ? AppTheme.primaryColor
                        : AppTheme.primaryColor.withValues(alpha: 0.2),
                    width: _photoPath != null ? 3 : 2,
                  ),
                  boxShadow: [
                    BoxShadow(
                      color: AppTheme.primaryColor.withValues(alpha: 0.15),
                      blurRadius: 20,
                      spreadRadius: 2,
                      offset: const Offset(0, 8),
                    ),
                    BoxShadow(
                      color: Colors.black.withValues(alpha: 0.05),
                      blurRadius: 10,
                      offset: const Offset(0, 4),
                    ),
                  ],
                ),
                child: ClipOval(
                  child: _photoPath != null
                      ? kIsWeb
                          ? Image.network(
                              _photoPath!,
                              fit: BoxFit.cover,
                              width: 140,
                              height: 140,
                            )
                          : Image.file(
                              File(_photoPath!),
                              fit: BoxFit.cover,
                              width: 140,
                              height: 140,
                            )
                      : Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Container(
                              padding: const EdgeInsets.all(12),
                              decoration: BoxDecoration(
                                color: AppTheme.primaryColor.withValues(alpha: 0.1),
                                shape: BoxShape.circle,
                              ),
                              child: const Icon(
                                Icons.camera_alt_rounded,
                                size: 32,
                                color: AppTheme.primaryColor,
                              ),
                            ),
                            const SizedBox(height: 8),
                            Text(
                              AppLocalizations.of(context)!.photoOptional,
                              style: TextStyle(
                                color: AppTheme.subtextColor,
                                fontSize: 12,
                                fontWeight: FontWeight.w500,
                              ),
                            ),
                          ],
                        ),
                ),
              ),
            ),
            const SizedBox(height: 12),
            if (_photoPath != null)
              TextButton.icon(
                onPressed: () {
                  setState(() {
                    _photoPath = null;
                  });
                },
                icon: const Icon(
                  Icons.delete_outline,
                  size: 18,
                  color: Colors.red,
                ),
                label: const Text(
                  'Remove Photo',
                  style: TextStyle(
                    color: Colors.red,
                    fontSize: 13,
                    fontWeight: FontWeight.w500,
                  ),
                ),
              )
            else
              TextButton.icon(
                onPressed: () async {
                  final ImagePicker picker = ImagePicker();
                  final XFile? pickedFile = await picker.pickImage(
                    source: ImageSource.gallery,
                    imageQuality: 85,
                  );
                  if (pickedFile != null) {
                    setState(() {
                      _photoPath = pickedFile.path;
                    });
                  }
                },
                icon: const Icon(
                  Icons.add_photo_alternate_rounded,
                  size: 18,
                  color: AppTheme.primaryColor,
                ),
                label: Text(
                  'Add Photo',
                  style: TextStyle(
                    color: AppTheme.primaryColor,
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
          ],
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppTheme.backgroundColor,
      appBar: AppBar(
        leading: IconButton(
          icon: Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(
              color: Colors.white,
              shape: BoxShape.circle,
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withValues(alpha: 0.08),
                  blurRadius: 8,
                  offset: const Offset(0, 2),
                ),
              ],
            ),
            child: const Icon(
              Icons.arrow_back_ios_new_rounded,
              size: 18,
              color: AppTheme.primaryColor,
            ),
          ),
          onPressed: () => Navigator.of(context).pop(),
        ),
        title: Text(
          AppLocalizations.of(context)!.completeProfileTitle,
          style: const TextStyle(
            fontSize: 18,
            fontWeight: FontWeight.w600,
          ),
        ),
        centerTitle: true,
        elevation: 0,
        scrolledUnderElevation: 0,
        backgroundColor: AppTheme.backgroundColor,
      ),
      body: BlocConsumer<AuthBloc, AuthState>(
        listener: (context, state) {
          if (state is AuthSignUpSuccess) {
            SnackBarUtils.showSuccess(context, 'Profile created! Verify your email, then log in.');
            // Navigate to login page after successful profile creation
            Navigator.of(context).pushAndRemoveUntil(
              MaterialPageRoute(builder: (_) => const LoginPage()),
              (route) => false,
            );
          } else if (state is AuthError) {
             SnackBarUtils.showError(context, state.message);
          }
        },
        builder: (context, state) {
          return SafeArea(
            child: SingleChildScrollView(
              padding: const EdgeInsets.symmetric(horizontal: 24.0, vertical: 16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // 1. Step Indicator
                  TweenAnimationBuilder<double>(
                    tween: Tween(begin: 0.0, end: 1.0),
                    duration: const Duration(milliseconds: 600),
                    curve: Curves.easeOutBack,
                    builder: (context, value, child) {
                      return Transform.scale(scale: value, child: Opacity(opacity: value, child: child));
                    },
                    child: const FormStepIndicator(currentStep: 2, totalSteps: 2),
                  ),
                  const SizedBox(height: 8),

                  // 2. Header
                  TweenAnimationBuilder<double>(
                    tween: Tween(begin: 0.0, end: 1.0),
                    duration: const Duration(milliseconds: 800),
                    curve: Curves.easeOutCubic,
                    builder: (context, value, child) {
                      return Transform.translate(
                        offset: Offset(0, 20 * (1 - value)),
                        child: Opacity(opacity: value, child: child),
                      );
                    },
                    child: SectionHeader(
                      title: AppLocalizations.of(context)!.lastStepTitle,
                      subtitle: AppLocalizations.of(context)!.lastStepSubtitle,
                      center: true,
                      titleStyle: const TextStyle(
                        fontSize: 26,
                        fontWeight: FontWeight.w900,
                        color: AppTheme.textColor,
                        letterSpacing: -1,
                        fontFamily: 'Outfit',
                      ),
                    ),
                  ),

                  const SizedBox(height: 8),
                  
                  // 3. Photo Picker
                  TweenAnimationBuilder<double>(
                    tween: Tween(begin: 0.0, end: 1.0),
                    duration: const Duration(milliseconds: 1000),
                    curve: Curves.elasticOut,
                    builder: (context, value, child) {
                      return Transform.scale(scale: value, child: child);
                    },
                    child: Center(
                      child: _buildEnhancedPhotoPicker(),
                    ),
                  ),

                  const SizedBox(height: 48),

                  // 4. Personal Info Section
                  TweenAnimationBuilder<double>(
                    tween: Tween(begin: 0.0, end: 1.0),
                    duration: const Duration(milliseconds: 900),
                    curve: Curves.easeOutQuart,
                    builder: (context, value, child) {
                      return Opacity(
                        opacity: value,
                        child: Transform.translate(
                          offset: Offset(0, 40 * (1 - value)),
                          child: child,
                        ),
                      );
                    },
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        _buildSectionTitle("INFORMATIONS PERSONNELLES"),
                        const SizedBox(height: 16),
                        Container(
                          padding: const EdgeInsets.all(24),
                          decoration: BoxDecoration(
                            color: Colors.white,
                            borderRadius: BorderRadius.circular(28),
                            border: Border.all(color: Colors.white, width: 2),
                            boxShadow: [
                              BoxShadow(
                                color: AppTheme.textColor.withValues(alpha: 0.04),
                                blurRadius: 30,
                                offset: const Offset(0, 10),
                              ),
                            ],
                          ),
                          child: Column(
                            children: [
                              CustomTextField(
                                controller: _phoneController,
                                hintText: "2X XXX XXX ou 9X XXX XXX",
                                prefixIcon: Icons.phone_android_rounded,
                                keyboardType: TextInputType.phone,
                                prefixText: "+216 ",
                                maxLength: 8,
                                inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                                validator: (v) {
                                  if (v == null || v.isEmpty) return null;
                                  return v.length != 8 ? "Doit contenir 8 chiffres" : null;
                                },
                              ),
                              const SizedBox(height: 20),
                              PremiumDropdown<String>(
                                value: _selectedLocation,
                                label: AppLocalizations.of(context)!.location,
                                icon: Icons.location_on_rounded,
                                items: AppConstants.tunisiaStates,
                                onChanged: (v) => setState(() => _selectedLocation = v),
                              ),
                              const SizedBox(height: 20),
                              PremiumDropdown<String>(
                                value: _selectedSpecialite,
                                label: AppLocalizations.of(context)!.specialty,
                                icon: Icons.auto_awesome_rounded,
                                items: AppConstants.specialities,
                                onChanged: (v) => setState(() => _selectedSpecialite = v),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),

                  const SizedBox(height: 32),
                  
                  // 5. Qualifications Section
                  TweenAnimationBuilder<double>(
                    tween: Tween(begin: 0.0, end: 1.0),
                    duration: const Duration(milliseconds: 1100),
                    curve: Curves.easeOutQuart,
                    builder: (context, value, child) {
                      return Opacity(
                        opacity: value,
                        child: Transform.translate(
                          offset: Offset(0, 40 * (1 - value)),
                          child: child,
                        ),
                      );
                    },
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        _buildSectionTitle("YOUR STATUS AND EXPERIENCE"),
                        const SizedBox(height: 16),
                        Container(
                          padding: const EdgeInsets.all(24),
                          decoration: BoxDecoration(
                            color: Colors.white,
                            borderRadius: BorderRadius.circular(28),
                            boxShadow: [
                              BoxShadow(
                                color: AppTheme.textColor.withValues(alpha: 0.04),
                                blurRadius: 30,
                                offset: const Offset(10, 10),
                              ),
                            ],
                          ),
                          child: Column(
                            children: [
                              BinarySelectionRowNoYes(
                                question: AppLocalizations.of(context)!.isStudentQuestion,
                                value: _isStudent,
                                noLabel: AppLocalizations.of(context)!.no,
                                yesLabel: AppLocalizations.of(context)!.yes,
                                onChanged: (val) => setState(() => _isStudent = val),
                              ),
                              const SizedBox(height: 24),
                              BinarySelectionRowNoYes(
                                question: AppLocalizations.of(context)!.isEngineerQuestion,
                                value: _isEngineer,
                                noLabel: AppLocalizations.of(context)!.no,
                                yesLabel: AppLocalizations.of(context)!.yes,
                                onChanged: (val) => setState(() => _isEngineer = val),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),

                  const SizedBox(height: 32),
                  
                  // 6. Bio Section
                  TweenAnimationBuilder<double>(
                    tween: Tween(begin: 0.0, end: 1.0),
                    duration: const Duration(milliseconds: 1300),
                    curve: Curves.easeOutQuart,
                    builder: (context, value, child) {
                      return Opacity(
                        opacity: value,
                        child: Transform.translate(
                          offset: Offset(0, 40 * (1 - value)),
                          child: child,
                        ),
                      );
                    },
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        _buildSectionTitle("BIO & PRESENTATION"),
                        const SizedBox(height: 16),
                        CustomTextField(
                          controller: _bioController,
                          hintText: AppLocalizations.of(context)!.bioHint,
                          prefixIcon: Icons.auto_stories_rounded,
                          maxLines: 4,
                        ),
                      ],
                    ),
                  ),

                  const SizedBox(height: 48),
                  
                  // 7. Finalize Button
                  TweenAnimationBuilder<double>(
                    tween: Tween(begin: 0.0, end: 1.0),
                    duration: const Duration(milliseconds: 1500),
                    curve: Curves.easeOutBack,
                    builder: (context, value, child) {
                      return Transform.scale(scale: value, child: child);
                    },
                    child: Container(
                      decoration: BoxDecoration(
                        borderRadius: BorderRadius.circular(18),
                        gradient: const LinearGradient(
                          colors: [AppTheme.primaryColor, AppTheme.secondaryColor],
                        ),
                        boxShadow: [
                          BoxShadow(
                            color: AppTheme.primaryColor.withValues(alpha: 0.3),
                            blurRadius: 20,
                            offset: const Offset(0, 10),
                          ),
                        ],
                      ),
                      child: ElevatedButton(
                        onPressed: state is AuthLoading ? null : _onSignUp,
                        style: ElevatedButton.styleFrom(
                          backgroundColor: Colors.transparent,
                          shadowColor: Colors.transparent,
                          minimumSize: const Size.fromHeight(64),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(18),
                          ),
                        ),
                        child: state is AuthLoading 
                          ? const SizedBox(
                              height: 24, 
                              width: 24, 
                              child: CircularProgressIndicator(strokeWidth: 3, color: Colors.white)
                            )
                          : Text(
                              AppLocalizations.of(context)!.finalizeProfileButton.toUpperCase(),
                              style: const TextStyle(
                                fontSize: 16,
                                fontWeight: FontWeight.w800,
                                letterSpacing: 1.2,
                              ),
                            ),
                      ),
                    ),
                  ),
                  const SizedBox(height: 48),
                ],
              ),
            ),
          );
        },
      ),
    );
  }

  Widget _buildSectionTitle(String title) {
    return Padding(
      padding: const EdgeInsets.only(left: 4.0),
      child: Text(
        title,
        style: TextStyle(
          fontSize: 11,
          fontWeight: FontWeight.w800,
          color: AppTheme.primaryColor.withValues(alpha: 0.7),
          letterSpacing: 1.5,
        ),
      ),
    );
  }
}

