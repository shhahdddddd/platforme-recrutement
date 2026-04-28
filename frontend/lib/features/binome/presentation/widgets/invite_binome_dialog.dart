import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:recrutitn/features/binome/services/binome_service.dart';
import 'package:recrutitn/core/utils/snackbar_utils.dart';

/// ===============================
/// Blue Theme Design Tokens
/// ===============================
class _DialogColors {
  static const Color background = Color(0xFFF8FAFC);
  static const Color surface = Color(0xFFFFFFFF);
  static const Color surfaceLight = Color(0xFFF1F5F9);
  static const Color card = Color(0xFFFFFFFF);
  static const Color accent = Color(0xFF3B82F6);
  static const Color accentLight = Color(0xFF60A5FA);
  static const Color accentGradientStart = Color(0xFF3B82F6);
  static const Color accentGradientEnd = Color(0xFF2563EB);
  static const Color textPrimary = Color(0xFF1E293B);
  static const Color textSecondary = Color(0xFF64748B);
  static const Color textMuted = Color(0xFF94A3B8);
  static const Color inputText = Color(0xFF000000);
  static const Color success = Color(0xFF10B981);
  static const Color error = Color(0xFFEF4444);
  static const Color border = Color(0xFFE2E8F0);
}

class InviteBinomeDialog extends StatefulWidget {
  final int applicationId;
  final String token;
  final BinomeService? binomeService;

  const InviteBinomeDialog({
    super.key,
    required this.applicationId,
    required this.token,
    this.binomeService,
  });

  @override
  State<InviteBinomeDialog> createState() => _InviteBinomeDialogState();
}

class _InviteBinomeDialogState extends State<InviteBinomeDialog>
    with TickerProviderStateMixin {
  final _emailController = TextEditingController();
  final _messageController = TextEditingController();
  final _formKey = GlobalKey<FormState>();
  final _emailFocusNode = FocusNode();
  bool _isLoading = false;
  bool _isEmailFocused = false;
  bool _isMessageFocused = false;

  // Autocomplete
  List<BinomeCandidate> _allCandidates = [];
  List<BinomeCandidate> _suggestions = [];
  bool _showSuggestions = false;
  bool _isLoadingCandidates = false;

  late final BinomeService _binomeService;
  late AnimationController _entranceController;
  late AnimationController _pulseController;
  late Animation<double> _fadeAnimation;
  late Animation<Offset> _slideAnimation;
  late Animation<double> _scaleAnimation;
  late Animation<double> _glowAnimation;

  @override
  void initState() {
    super.initState();
    _binomeService = widget.binomeService ?? BinomeService();

    // Load candidates for autocomplete
    _loadCandidates();

    // Listen for email text changes
    _emailController.addListener(_onEmailChanged);
    _emailFocusNode.addListener(_onEmailFocusChanged);

    _entranceController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 800),
    );

    _pulseController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 2000),
    )..repeat(reverse: true);

    _fadeAnimation = Tween<double>(begin: 0, end: 1).animate(
      CurvedAnimation(
        parent: _entranceController,
        curve: const Interval(0, 0.6, curve: Curves.easeOut),
      ),
    );

    _slideAnimation = Tween<Offset>(
      begin: const Offset(0, 0.3),
      end: Offset.zero,
    ).animate(
      CurvedAnimation(
        parent: _entranceController,
        curve: const Interval(0.1, 0.7, curve: Curves.easeOutBack),
      ),
    );

    _scaleAnimation = Tween<double>(begin: 0.9, end: 1).animate(
      CurvedAnimation(
        parent: _entranceController,
        curve: const Interval(0.1, 0.7, curve: Curves.easeOutBack),
      ),
    );

    _glowAnimation = Tween<double>(begin: 0.3, end: 0.8).animate(
      CurvedAnimation(
        parent: _pulseController,
        curve: Curves.easeInOut,
      ),
    );

    _entranceController.forward();
  }

  @override
  void dispose() {
    _emailController.removeListener(_onEmailChanged);
    _emailController.dispose();
    _emailFocusNode.removeListener(_onEmailFocusChanged);
    _emailFocusNode.dispose();
    _messageController.dispose();
    _entranceController.dispose();
    _pulseController.dispose();
    super.dispose();
  }

  Future<void> _loadCandidates() async {
    setState(() => _isLoadingCandidates = true);
    try {
      final candidates = await _binomeService.getAcceptedCandidates(
        widget.applicationId,
        token: widget.token,
      );
      if (mounted) {
        final typedText = _emailController.text.toLowerCase().trim();
        setState(() {
          _allCandidates = candidates;
          _isLoadingCandidates = false;
          if (typedText.length >= 1) {
            _suggestions = _allCandidates.where((candidate) {
              final fullName =
                  '${candidate.firstName} ${candidate.lastName}'.toLowerCase();
              final email = (candidate.email ?? '').toLowerCase();
              return fullName.contains(typedText) || email.contains(typedText);
            }).toList();
            _showSuggestions = true;
          }
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() => _isLoadingCandidates = false);
      }
      // Silently fail - autocomplete is optional
    }
  }

  void _onEmailChanged() {
    final text = _emailController.text.toLowerCase().trim();
    if (text.length >= 1) {
      setState(() {
        _suggestions = _allCandidates.where((candidate) {
          final fullName = '${candidate.firstName} ${candidate.lastName}'.toLowerCase();
          final email = (candidate.email ?? '').toLowerCase();
          return fullName.contains(text) || email.contains(text);
        }).toList();
        _showSuggestions = true;
      });
    } else {
      setState(() {
        _showSuggestions = false;
      });
    }
  }

  void _onEmailFocusChanged() {
    setState(() {
      _isEmailFocused = _emailFocusNode.hasFocus;
      if (!_emailFocusNode.hasFocus) {
        _showSuggestions = false;
      }
    });
  }

  void _onSuggestionSelected(BinomeCandidate candidate) {
    _emailController.text = candidate.email ?? '';
    setState(() {
      _showSuggestions = false;
    });
  }

  Future<void> _sendInvitation() async {
    if (!_formKey.currentState!.validate()) return;

    setState(() => _isLoading = true);

    try {
      await _binomeService.sendInvitation(
        widget.applicationId,
        email: _emailController.text.trim(),
        message: _messageController.text.trim().isNotEmpty
            ? _messageController.text.trim()
            : null,
        token: widget.token,
      );

      if (mounted) {
        SnackBarUtils.showSuccess(context, 'Invitation sent successfully!');
        Navigator.pop(context, true);
      }
    } catch (e) {
      if (mounted) {
        SnackBarUtils.showError(context, e.toString());
      }
    } finally {
      if (mounted) {
        setState(() => _isLoading = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final bool isNarrow = MediaQuery.of(context).size.width < 430;
    final double contentPadding = isNarrow ? 20 : 32;

    return Dialog(
      backgroundColor: Colors.transparent,
      insetPadding: const EdgeInsets.symmetric(horizontal: 24, vertical: 40),
      child: AnimatedBuilder(
        animation: _entranceController,
        builder: (context, child) {
          return FadeTransition(
            opacity: _fadeAnimation,
            child: SlideTransition(
              position: _slideAnimation,
              child: ScaleTransition(
                scale: _scaleAnimation,
                child: Container(
                  constraints: const BoxConstraints(maxWidth: 520, maxHeight: 700),
                  decoration: BoxDecoration(
                    color: _DialogColors.card,
                    borderRadius: BorderRadius.circular(28),
                    border: Border.all(
                      color: _DialogColors.border,
                      width: 1,
                    ),
                    boxShadow: [
                      BoxShadow(
                        color: _DialogColors.accent.withOpacity(0.15),
                        blurRadius: 30,
                        spreadRadius: 2,
                        offset: const Offset(0, 10),
                      ),
                    ],
                  ),
                  child: ClipRRect(
                    borderRadius: BorderRadius.circular(28),
                    child: Stack(
                      children: [
                        // Animated background glow
                        Positioned(
                          top: -100,
                          right: -100,
                          child: AnimatedBuilder(
                            animation: _pulseController,
                            builder: (context, child) {
                              return Container(
                                width: 300,
                                height: 300,
                                decoration: BoxDecoration(
                                  shape: BoxShape.circle,
                                  gradient: RadialGradient(
                                    colors: [
                                      _DialogColors.accent
                                          .withOpacity(0.1 * _glowAnimation.value),
                                      Colors.transparent,
                                    ],
                                  ),
                                ),
                              );
                            },
                          ),
                        ),
                        // Content
                        Padding(
                          padding: EdgeInsets.all(contentPadding),
                          child: Form(
                            key: _formKey,
                            child: SingleChildScrollView(
                              child: Column(
                              mainAxisSize: MainAxisSize.min,
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                // Animated Header Icon
                                Center(
                                  child: AnimatedBuilder(
                                    animation: _pulseController,
                                    builder: (context, child) {
                                      return Container(
                                        width: 80,
                                        height: 80,
                                        decoration: BoxDecoration(
                                          gradient: LinearGradient(
                                            begin: Alignment.topLeft,
                                            end: Alignment.bottomRight,
                                            colors: [
                                              _DialogColors.accentGradientStart,
                                              _DialogColors.accentGradientEnd,
                                            ],
                                          ),
                                          borderRadius: BorderRadius.circular(24),
                                          boxShadow: [
                                            BoxShadow(
                                              color: _DialogColors.accent
                                                  .withOpacity(0.5 * _glowAnimation.value),
                                              blurRadius: 30,
                                              spreadRadius: 5,
                                              offset: const Offset(0, 10),
                                            ),
                                          ],
                                        ),
                                        child: const Icon(
                                          Icons.group_add_rounded,
                                          color: Colors.white,
                                          size: 36,
                                        ),
                                      );
                                    },
                                  ),
                                ),
                                const SizedBox(height: 24),
                                // Title
                                Center(
                                  child: Text(
                                    'Invite Your Binome',
                                    style: GoogleFonts.outfit(
                                      fontSize: 28,
                                      fontWeight: FontWeight.w800,
                                      color: _DialogColors.textPrimary,
                                      letterSpacing: -0.5,
                                    ),
                                  ),
                                ),
                                const SizedBox(height: 12),
                                // Description
                                Center(
                                  child: Text(
                                    'Partner up with another candidate to collaborate on this internship. Together you\'ll chat with the recruiter as a team.',
                                    textAlign: TextAlign.center,
                                    style: GoogleFonts.outfit(
                                      fontSize: 15,
                                      color: _DialogColors.textSecondary,
                                      height: 1.6,
                                    ),
                                  ),
                                ),
                                const SizedBox(height: 32),
                                // Email Field with Autocomplete
                                Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    _buildAnimatedTextField(
                                      controller: _emailController,
                                      focusNode: _emailFocusNode,
                                      label: 'Email Address',
                                      hint: 'Type name or email (e.g. shahd)',
                                      icon: Icons.email_outlined,
                                      isFocused: _isEmailFocused,
                                      onFocusChange: (focused) {},
                                      validator: (value) {
                                        if (value == null || value.trim().isEmpty) {
                                          return 'Please enter an email address';
                                        }
                                        if (!RegExp(r'^[^@]+@[^@]+\.[^@]+').hasMatch(value)) {
                                          return 'Please enter a valid email address';
                                        }
                                        return null;
                                      },
                                    ),
                                    // Autocomplete Suggestions
                                    if (_showSuggestions || (_isEmailFocused && _isLoadingCandidates)) ...[
                                      const SizedBox(height: 8),
                                      Material(
                                        elevation: 8,
                                        borderRadius: BorderRadius.circular(12),
                                        child: Container(
                                          constraints: const BoxConstraints(maxHeight: 200),
                                          decoration: BoxDecoration(
                                            color: _DialogColors.card,
                                            borderRadius: BorderRadius.circular(12),
                                            border: Border.all(
                                              color: _DialogColors.border,
                                              width: 1,
                                            ),
                                          ),
                                          child: ClipRRect(
                                            borderRadius: BorderRadius.circular(12),
                                            child: _isLoadingCandidates
                                                ? const Center(
                                                    child: Padding(
                                                      padding: EdgeInsets.all(16),
                                                      child: CircularProgressIndicator(
                                                        strokeWidth: 2,
                                                      ),
                                                    ),
                                                  )
                                                : _suggestions.isEmpty
                                                    ? Center(
                                                        child: Padding(
                                                          padding: const EdgeInsets.all(16),
                                                          child: Text(
                                                            'No matches found',
                                                            style: GoogleFonts.outfit(
                                                              color: _DialogColors.textMuted,
                                                              fontSize: 14,
                                                            ),
                                                          ),
                                                        ),
                                                      )
                                                    : ListView.builder(
                                                        shrinkWrap: true,
                                                        itemCount: _suggestions.length,
                                                        itemBuilder: (context, index) {
                                                          final candidate = _suggestions[index];
                                                          return InkWell(
                                                            onTap: () => _onSuggestionSelected(candidate),
                                                            child: Container(
                                                              padding: const EdgeInsets.symmetric(
                                                                horizontal: 16,
                                                                vertical: 12,
                                                              ),
                                                              decoration: BoxDecoration(
                                                                border: index < _suggestions.length - 1
                                                                    ? Border(
                                                                        bottom: BorderSide(
                                                                          color: _DialogColors.border,
                                                                          width: 1,
                                                                        ),
                                                                      )
                                                                    : null,
                                                              ),
                                                              child: Row(
                                                                children: [
                                                                  // Avatar
                                                                  Container(
                                                                    width: 40,
                                                                    height: 40,
                                                                    decoration: BoxDecoration(
                                                                      gradient: LinearGradient(
                                                                        colors: [
                                                                          _DialogColors.accent,
                                                                          _DialogColors.accentGradientEnd,
                                                                        ],
                                                                      ),
                                                                      borderRadius: BorderRadius.circular(20),
                                                                    ),
                                                                    child: candidate.picture != null
                                                                        ? ClipOval(
                                                                            child: Image.network(
                                                                              candidate.picture!,
                                                                              fit: BoxFit.cover,
                                                                              errorBuilder: (_, __, ___) =>
                                                                                  Center(
                                                                                    child: Text(
                                                                                      candidate.firstName.isNotEmpty
                                                                                          ? candidate.firstName[0].toUpperCase()
                                                                                          : '?',
                                                                                      style: GoogleFonts.outfit(
                                                                                        color: Colors.white,
                                                                                        fontWeight: FontWeight.w700,
                                                                                        fontSize: 16,
                                                                                      ),
                                                                                    ),
                                                                                  ),
                                                                            ),
                                                                          )
                                                                        : Center(
                                                                            child: Text(
                                                                              candidate.firstName.isNotEmpty
                                                                                  ? candidate.firstName[0].toUpperCase()
                                                                                  : '?',
                                                                              style: GoogleFonts.outfit(
                                                                                color: Colors.white,
                                                                                fontWeight: FontWeight.w700,
                                                                                fontSize: 16,
                                                                              ),
                                                                            ),
                                                                          ),
                                                                  ),
                                                                  const SizedBox(width: 12),
                                                                  // Info
                                                                  Expanded(
                                                                    child: Column(
                                                                      crossAxisAlignment: CrossAxisAlignment.start,
                                                                      children: [
                                                                        Text(
                                                                          candidate.fullName,
                                                                          style: GoogleFonts.outfit(
                                                                            fontSize: 14,
                                                                            fontWeight: FontWeight.w600,
                                                                            color: _DialogColors.textPrimary,
                                                                          ),
                                                                        ),
                                                                        if (candidate.email != null)
                                                                          Text(
                                                                            candidate.email!,
                                                                            style: GoogleFonts.outfit(
                                                                              fontSize: 12,
                                                                              color: _DialogColors.textSecondary,
                                                                            ),
                                                                            overflow: TextOverflow.ellipsis,
                                                                          ),
                                                                      ],
                                                                    ),
                                                                  ),
                                                                ],
                                                              ),
                                                            ),
                                                          );
                                                        },
                                                      ),
                                          ),
                                        ),
                                      ),
                                    ],
                                  ],
                                ),
                                const SizedBox(height: 20),
                                // Message Field
                                _buildAnimatedTextField(
                                  controller: _messageController,
                                  label: 'Personal Message (Optional)',
                                  hint: 'Hey! Want to team up for this internship?',
                                  icon: Icons.message_outlined,
                                  isFocused: _isMessageFocused,
                                  onFocusChange: (focused) => setState(() => _isMessageFocused = focused),
                                  maxLines: 3,
                                  maxLength: 500,
                                ),
                                const SizedBox(height: 32),
                                // Buttons
                                Row(
                                  children: [
                                    Expanded(
                                      child: _buildGlassButton(
                                        onPressed: _isLoading ? null : () => Navigator.pop(context),
                                        label: 'Cancel',
                                        isPrimary: false,
                                      ),
                                    ),
                                    const SizedBox(width: 16),
                                    Expanded(
                                      child: _buildGlassButton(
                                        onPressed: _isLoading ? null : _sendInvitation,
                                        label: _isLoading ? 'Sending...' : 'Send Invite',
                                        isPrimary: true,
                                        isLoading: _isLoading,
                                      ),
                                    ),
                                  ],
                                ),
                              ],
                            ),
                            ),
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

  Widget _buildAnimatedTextField({
    required TextEditingController controller,
    FocusNode? focusNode,
    required String label,
    required String hint,
    required IconData icon,
    required bool isFocused,
    required ValueChanged<bool> onFocusChange,
    int? maxLines,
    int? maxLength,
    String? Function(String?)? validator,
  }) {
    return AnimatedContainer(
      duration: const Duration(milliseconds: 300),
      curve: Curves.easeOutCubic,
      decoration: BoxDecoration(
        color: _DialogColors.surfaceLight,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: isFocused
              ? _DialogColors.accent
              : _DialogColors.border,
          width: isFocused ? 2 : 1,
        ),
        boxShadow: isFocused
            ? [
                BoxShadow(
                  color: _DialogColors.accent.withOpacity(0.15),
                  blurRadius: 12,
                  spreadRadius: 1,
                ),
              ]
            : null,
      ),
      child: TextFormField(
        controller: controller,
        focusNode: focusNode,
        maxLines: maxLines ?? 1,
        maxLength: maxLength,
        style: GoogleFonts.outfit(
          fontSize: 15,
          color: _DialogColors.inputText, // Black text for input
          fontWeight: FontWeight.w500,
        ),
        decoration: InputDecoration(
          labelText: label,
          hintText: hint,
          hintStyle: GoogleFonts.outfit(
            color: _DialogColors.textMuted,
          ),
          labelStyle: GoogleFonts.outfit(
            color: isFocused ? _DialogColors.accent : _DialogColors.textSecondary,
            fontWeight: isFocused ? FontWeight.w600 : FontWeight.w500,
          ),
          prefixIcon: AnimatedContainer(
            duration: const Duration(milliseconds: 300),
            padding: const EdgeInsets.all(12),
            child: Icon(
              icon,
              color: isFocused ? _DialogColors.accent : _DialogColors.textMuted,
              size: 22,
            ),
          ),
          border: InputBorder.none,
          contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
          counterStyle: GoogleFonts.outfit(
            color: _DialogColors.textMuted,
            fontSize: 12,
          ),
        ),
        validator: validator,
        onChanged: (value) {
          // Handle focus state change
          if (focusNode != null) {
            onFocusChange(focusNode.hasFocus);
          }
        },
      ),
    );
  }

  Widget _buildGlassButton({
    required VoidCallback? onPressed,
    required String label,
    required bool isPrimary,
    bool isLoading = false,
  }) {
    return AnimatedContainer(
      duration: const Duration(milliseconds: 200),
      child: ElevatedButton(
        onPressed: onPressed,
        style: ElevatedButton.styleFrom(
          backgroundColor: isPrimary ? null : Colors.transparent,
          foregroundColor: isPrimary ? Colors.white : _DialogColors.textSecondary,
          padding: const EdgeInsets.symmetric(vertical: 16),
          elevation: isPrimary ? 0 : 0,
          shadowColor: Colors.transparent,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(16),
            side: isPrimary
                ? BorderSide.none
                : BorderSide(color: _DialogColors.accent.withOpacity(0.3)),
          ),
        ).copyWith(
          backgroundColor: WidgetStateProperty.resolveWith((states) {
            if (isPrimary) {
              return null; // Use gradient
            }
            return _DialogColors.surfaceLight.withOpacity(0.5);
          }),
        ),
        child: Container(
          decoration: isPrimary
              ? BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                    colors: [
                      _DialogColors.accentGradientStart,
                      _DialogColors.accentGradientEnd,
                    ],
                  ),
                  borderRadius: BorderRadius.circular(16),
                )
              : null,
          padding: isPrimary ? const EdgeInsets.symmetric(horizontal: 8) : EdgeInsets.zero,
          child: isLoading
              ? SizedBox(
                  width: 24,
                  height: 24,
                  child: CircularProgressIndicator(
                    strokeWidth: 2.5,
                    valueColor: AlwaysStoppedAnimation<Color>(
                      isPrimary ? Colors.white : _DialogColors.accentLight,
                    ),
                  ),
                )
              : Text(
                  label,
                  style: GoogleFonts.outfit(
                    fontSize: 16,
                    fontWeight: FontWeight.w700,
                    color: isPrimary ? Colors.white : _DialogColors.textPrimary,
                  ),
                ),
        ),
      ),
    );
  }
}
