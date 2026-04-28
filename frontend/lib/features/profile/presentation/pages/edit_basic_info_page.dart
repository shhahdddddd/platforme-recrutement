import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/utils/snackbar_utils.dart';
import 'package:recrutitn/features/auth/domain/entities/user_entity.dart';
import 'package:recrutitn/features/auth/presentation/bloc/auth_bloc.dart';
import 'package:recrutitn/features/auth/presentation/bloc/auth_event.dart';
import 'package:recrutitn/features/auth/presentation/bloc/auth_state.dart';
import 'package:recrutitn/features/auth/presentation/widgets/custom_text_field.dart';
import 'package:recrutitn/l10n/app_localizations.dart';

// ── Design tokens ─────────────────────────────────────────────────────────────
class _C {
  static const bg          = Color(0xFFF4F7FF);
  static const cardBg      = Colors.white;
  static const inputBg     = Color(0xFFF0F4FF);
  static const darkBlue    = Color(0xFF0F2557);
  static const midBlue     = Color(0xFF1A3A8F);
  static const accent      = Color(0xFF1D4ED8);
  static const accentSoft  = Color(0xFF3B82F6);
  static const accentGlow  = Color(0xFF1E40AF);
  static const teal        = Color(0xFF0EA5E9);
  static const border      = Color(0xFFDBE5FF);
  static const inputBorder = Color(0xFFCDD8F6);
  static const textBody    = Color(0xFF334155);
  static const textMuted   = Color(0xFF94A3B8);
  static const error       = Color(0xFFEF4444);
}

class EditBasicInfoPage extends StatefulWidget {
  final UserEntity user;
  const EditBasicInfoPage({super.key, required this.user});

  @override
  State<EditBasicInfoPage> createState() => _EditBasicInfoPageState();
}

class _EditBasicInfoPageState extends State<EditBasicInfoPage>
    with SingleTickerProviderStateMixin {
  late TextEditingController _nameController;
  late TextEditingController _emailController;
  late TextEditingController _phoneController;
  late TextEditingController _bioController;
  String? _selectedLocation;
  bool _locationDropdownOpen = false;

  late final AnimationController _entryCtrl;
  late final Animation<double>   _fade;
  late final Animation<Offset>   _slide;

  final List<String> _tunisiaGovernorates = [
    'Ariana', 'Béja', 'Ben Arous', 'Bizerte', 'Gabès', 'Gafsa',
    'Jendouba', 'Kairouan', 'Kasserine', 'Kébili', 'Le Kef', 'Mahdia',
    'La Manouba', 'Médenine', 'Monastir', 'Nabeul', 'Sfax', 'Sidi Bouzid',
    'Siliana', 'Sousse', 'Tataouine', 'Tozeur', 'Tunis', 'Zaghouan',
  ];

  @override
  void initState() {
    super.initState();
    _nameController  = TextEditingController(text: widget.user.name);
    _emailController = TextEditingController(text: widget.user.email);
    _phoneController = TextEditingController(text: widget.user.phone);
    _bioController   = TextEditingController(text: widget.user.bio);

    if (widget.user.location != null &&
        _tunisiaGovernorates.contains(widget.user.location)) {
      _selectedLocation = widget.user.location;
    }

    _entryCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 700),
    );
    _fade  = CurvedAnimation(parent: _entryCtrl, curve: Curves.easeOut);
    _slide = Tween<Offset>(
      begin: const Offset(0, 0.04),
      end: Offset.zero,
    ).animate(CurvedAnimation(parent: _entryCtrl, curve: Curves.easeOut));
    _entryCtrl.forward();
  }

  @override
  void dispose() {
    _entryCtrl.dispose();
    _nameController.dispose();
    _emailController.dispose();
    _phoneController.dispose();
    _bioController.dispose();
    super.dispose();
  }

  void _onSave() {
    if (_nameController.text.trim().isEmpty) {
      SnackBarUtils.showError(context, AppLocalizations.of(context)!.nameRequired);
      return;
    }
    if (_emailController.text.trim().isEmpty) {
      SnackBarUtils.showError(context, AppLocalizations.of(context)!.emailRequired);
      return;
    }

    final phone = _phoneController.text.trim();
    String? digitsOnly;

    if (phone.isNotEmpty) {
      digitsOnly = phone.replaceAll(RegExp(r'[^\d]'), '');
      if (digitsOnly.length != 8) {
        SnackBarUtils.showError(context, 'Phone number must be exactly 8 digits');
        return;
      }
      final firstDigit = digitsOnly[0];
      if (!['2', '4', '5', '7', '9'].contains(firstDigit)) {
        SnackBarUtils.showError(
          context,
          'Number must start with 2, 4, 5, 7, or 9',
        );
        return;
      }
    }

    context.read<AuthBloc>().add(UpdateBasicInfoEvent(
      name: _nameController.text.trim(),
      email: _emailController.text.trim(),
      phone: digitsOnly,
      location: _selectedLocation,
      bio: _bioController.text.trim(),
    ));
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: _C.bg,
      appBar: _buildAppBar(),
      body: BlocListener<AuthBloc, AuthState>(
        listener: (context, state) {
          if (state is AuthAuthenticated) {
            SnackBarUtils.showSuccess(
              context,
              AppLocalizations.of(context)!.infoUpdated,
            );
            Navigator.pop(context);
          } else if (state is AuthError) {
            SnackBarUtils.showError(context, state.message);
          }
        },
        child: Stack(
          children: [
            // ── Subtle background blobs ──────────────────────────────────
            Positioned(
              top: -80, right: -60,
              child: _Blob(size: 260, color: _C.accentSoft.withValues(alpha: 0.07)),
            ),
            Positioned(
              bottom: -60, left: -50,
              child: _Blob(size: 220, color: _C.teal.withValues(alpha: 0.06)),
            ),

            SafeArea(
              child: FadeTransition(
                opacity: _fade,
                child: SlideTransition(
                  position: _slide,
                  child: SingleChildScrollView(
                    padding: const EdgeInsets.fromLTRB(24, 8, 24, 40),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        // ── Page hero ──────────────────────────────────
                        _buildPageHero(),

                        const SizedBox(height: 32),

                        // ── Form card ──────────────────────────────────
                        _buildFormCard(),

                        const SizedBox(height: 32),

                        // ── Save button ────────────────────────────────
                        BlocBuilder<AuthBloc, AuthState>(
                          builder: (context, state) {
                            final loading = state is AuthLoading;
                            return _PrimaryButton(
                              loading: loading,
                              onPressed: _onSave,
                              label: AppLocalizations.of(context)!.saveChanges,
                            );
                          },
                        ),

                        const SizedBox(height: 12),

                        // ── Cancel ─────────────────────────────────────
                        Center(
                          child: TextButton(
                            onPressed: () => Navigator.pop(context),
                            child: Text(
                              AppLocalizations.of(context)!.cancelButton,
                              style: GoogleFonts.outfit(
                                color: _C.textMuted,
                                fontWeight: FontWeight.w500,
                                fontSize: 14,
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
          ],
        ),
      ),
    );
  }

  PreferredSizeWidget _buildAppBar() {
    return AppBar(
      title: Text(
        AppLocalizations.of(context)!.editProfileTitle,
        style: GoogleFonts.outfit(
          fontWeight: FontWeight.w700,
          fontSize: 18,
          color: _C.darkBlue,
          letterSpacing: -0.3,
        ),
      ),
      centerTitle: true,
      elevation: 0,
      backgroundColor: _C.bg,
      surfaceTintColor: Colors.transparent,
      leading: Padding(
        padding: const EdgeInsets.only(left: 12),
        child: Material(
          color: _C.cardBg,
          borderRadius: BorderRadius.circular(12),
          child: InkWell(
            borderRadius: BorderRadius.circular(12),
            onTap: () => Navigator.pop(context),
            child: Container(
              padding: const EdgeInsets.all(9),
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: _C.border),
              ),
              child: const Icon(
                Icons.arrow_back_ios_new_rounded,
                size: 16,
                color: _C.midBlue,
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildPageHero() {
    return Center(
      child: Column(
        children: [
          // Concentric ring icon
          Stack(
            alignment: Alignment.center,
            children: [
              Container(
                width: 92,
                height: 92,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: _C.accentSoft.withValues(alpha: 0.08),
                ),
              ),
              Container(
                width: 72,
                height: 72,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: _C.accentSoft.withValues(alpha: 0.10),
                ),
              ),
              Container(
                width: 56,
                height: 56,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  gradient: const LinearGradient(
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                    colors: [_C.accentSoft, _C.accent],
                  ),
                  boxShadow: [
                    BoxShadow(
                      color: _C.accentGlow.withValues(alpha: 0.28),
                      blurRadius: 16,
                      offset: const Offset(0, 6),
                    ),
                  ],
                ),
                child: const Icon(
                  Icons.person_outline_rounded,
                  size: 24,
                  color: Colors.white,
                ),
              ),
            ],
          ),

          const SizedBox(height: 16),

          Text(
            AppLocalizations.of(context)!.basicInfo,
            style: GoogleFonts.outfit(
              fontSize: 22,
              fontWeight: FontWeight.w800,
              color: _C.darkBlue,
              letterSpacing: -0.4,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            AppLocalizations.of(context)!.basicInfoSubtitle,
            textAlign: TextAlign.center,
            style: GoogleFonts.outfit(
              fontSize: 13,
              color: _C.textMuted,
              height: 1.5,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildFormCard() {
    return Container(
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        color: _C.cardBg,
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: _C.border),
        boxShadow: [
          BoxShadow(
            color: _C.accentGlow.withValues(alpha: 0.06),
            blurRadius: 30,
            offset: const Offset(0, 12),
          ),
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.03),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _FieldLabel(AppLocalizations.of(context)!.fullName),
          const SizedBox(height: 7),
          _CleanField(
            controller: _nameController,
            hint: AppLocalizations.of(context)!.yourNameHint,
            icon: Icons.person_outline_rounded,
          ),
          const SizedBox(height: 20),

          _FieldLabel(AppLocalizations.of(context)!.email),
          const SizedBox(height: 7),
          _CleanField(
            controller: _emailController,
            hint: AppLocalizations.of(context)!.yourEmailHint,
            icon: Icons.alternate_email_rounded,
            keyboardType: TextInputType.emailAddress,
          ),
          const SizedBox(height: 20),

          _FieldLabel(AppLocalizations.of(context)!.phoneNumber),
          const SizedBox(height: 7),
          _CleanField(
            controller: _phoneController,
            hint: 'e.g. 55 123 456',
            icon: Icons.phone_outlined,
            keyboardType: TextInputType.phone,
            maxLength: 8,
            inputFormatters: [FilteringTextInputFormatter.digitsOnly],
          ),
          const SizedBox(height: 20),

          _FieldLabel(AppLocalizations.of(context)!.location),
          const SizedBox(height: 7),
          _buildLocationDropdown(),
          const SizedBox(height: 20),

          _FieldLabel("Bio"),
          const SizedBox(height: 7),
          _CleanField(
            controller: _bioController,
            hint: "Parlez-nous de vous...",
            icon: Icons.description_outlined,
            maxLines: 4,
          ),
        ],
      ),
    );
  }

  Widget _buildLocationDropdown() {
    return _CustomLocationDropdown(
      value: _selectedLocation,
      items: _tunisiaGovernorates,
      hint: AppLocalizations.of(context)!.selectCity,
      onChanged: (val) => setState(() => _selectedLocation = val),
    );
  }
}

// ── Custom Location Dropdown ──────────────────────────────────────────────────

class _CustomLocationDropdown extends StatefulWidget {
  const _CustomLocationDropdown({
    required this.value,
    required this.items,
    required this.hint,
    required this.onChanged,
  });
  final String? value;
  final List<String> items;
  final String hint;
  final ValueChanged<String?> onChanged;

  @override
  State<_CustomLocationDropdown> createState() => _CustomLocationDropdownState();
}

class _CustomLocationDropdownState extends State<_CustomLocationDropdown>
    with SingleTickerProviderStateMixin {
  bool _open = false;
  late AnimationController _animCtrl;
  late Animation<double> _expandAnim;
  late Animation<double> _fadeAnim;
  final _layerLink = LayerLink();
  OverlayEntry? _overlay;
  final _scrollCtrl = ScrollController();

  @override
  void initState() {
    super.initState();
    _animCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 220),
    );
    _expandAnim = CurvedAnimation(parent: _animCtrl, curve: Curves.easeOut);
    _fadeAnim   = CurvedAnimation(parent: _animCtrl, curve: Curves.easeOut);
  }

  @override
  void dispose() {
    _removeOverlay();
    _animCtrl.dispose();
    _scrollCtrl.dispose();
    super.dispose();
  }

  void _toggleDropdown() {
    if (_open) {
      _closeDropdown();
    } else {
      _openDropdown();
    }
  }

  void _openDropdown() {
    _overlay = _buildOverlay();
    Overlay.of(context).insert(_overlay!);
    _animCtrl.forward();
    setState(() => _open = true);
  }

  void _closeDropdown() {
    _animCtrl.reverse().then((_) {
      _removeOverlay();
      if (mounted) setState(() => _open = false);
    });
  }

  void _removeOverlay() {
    _overlay?.remove();
    _overlay = null;
  }

  void _selectItem(String item) {
    widget.onChanged(item);
    _closeDropdown();
  }

  OverlayEntry _buildOverlay() {
    final renderBox = context.findRenderObject() as RenderBox;
    final size      = renderBox.size;

    return OverlayEntry(
      builder: (_) => Positioned(
        width: size.width,
        child: CompositedTransformFollower(
          link: _layerLink,
          showWhenUnlinked: false,
          offset: Offset(0, size.height + 6),
          child: FadeTransition(
            opacity: _fadeAnim,
            child: SizeTransition(
              sizeFactor: _expandAnim,
              axisAlignment: -1,
              child: Material(
                color: Colors.transparent,
                child: Container(
                  constraints: const BoxConstraints(maxHeight: 280),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(color: _C.border, width: 1),
                    boxShadow: [
                      BoxShadow(
                        color: _C.accentGlow.withValues(alpha: 0.10),
                        blurRadius: 24,
                        offset: const Offset(0, 8),
                      ),
                      BoxShadow(
                        color: Colors.black.withValues(alpha: 0.05),
                        blurRadius: 8,
                        offset: const Offset(0, 2),
                      ),
                    ],
                  ),
                  child: ClipRRect(
                    borderRadius: BorderRadius.circular(16),
                    child: Scrollbar(
                      controller: _scrollCtrl,
                      thumbVisibility: true,
                      child: ListView.builder(
                        controller: _scrollCtrl,
                        padding: const EdgeInsets.symmetric(vertical: 6),
                        shrinkWrap: true,
                        itemCount: widget.items.length,
                        itemBuilder: (_, i) {
                          final item     = widget.items[i];
                          final selected = item == widget.value;
                          return _DropdownItem(
                            label: item,
                            selected: selected,
                            onTap: () => _selectItem(item),
                          );
                        },
                      ),
                    ),
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return CompositedTransformTarget(
      link: _layerLink,
      child: GestureDetector(
        onTap: _toggleDropdown,
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 180),
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 13),
          decoration: BoxDecoration(
            color: _C.inputBg,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(
              color: _open ? _C.accent : _C.inputBorder,
              width: _open ? 1.6 : 1.0,
            ),
          ),
          child: Row(
            children: [
              Icon(
                Icons.location_on_outlined,
                size: 19,
                color: _open ? _C.accent : _C.accent,
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Text(
                  widget.value ?? widget.hint,
                  style: GoogleFonts.outfit(
                    fontSize: 15,
                    fontWeight: FontWeight.w500,
                    color: widget.value != null ? _C.darkBlue : _C.textMuted,
                  ),
                ),
              ),
              AnimatedRotation(
                turns: _open ? 0.5 : 0,
                duration: const Duration(milliseconds: 220),
                curve: Curves.easeOut,
                child: Icon(
                  Icons.keyboard_arrow_down_rounded,
                  size: 20,
                  color: _open ? _C.accent : _C.textMuted,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _DropdownItem extends StatefulWidget {
  const _DropdownItem({
    required this.label,
    required this.selected,
    required this.onTap,
  });
  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  State<_DropdownItem> createState() => _DropdownItemState();
}

class _DropdownItemState extends State<_DropdownItem> {
  bool _hover = false;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: widget.onTap,
      onTapDown: (_) => setState(() => _hover = true),
      onTapUp: (_) => setState(() => _hover = false),
      onTapCancel: () => setState(() => _hover = false),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 120),
        margin: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 11),
        decoration: BoxDecoration(
          color: widget.selected
              ? _C.accent.withValues(alpha: 0.08)
              : _hover
                  ? _C.inputBg
                  : Colors.transparent,
          borderRadius: BorderRadius.circular(10),
        ),
        child: Row(
          children: [
            // Location pin chip
            Container(
              width: 28,
              height: 28,
              decoration: BoxDecoration(
                color: widget.selected
                    ? _C.accent.withValues(alpha: 0.12)
                    : _C.inputBg,
                borderRadius: BorderRadius.circular(8),
              ),
              child: Icon(
                Icons.location_on_outlined,
                size: 15,
                color: widget.selected ? _C.accent : _C.textMuted,
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Text(
                widget.label,
                style: GoogleFonts.outfit(
                  fontSize: 14,
                  fontWeight: widget.selected ? FontWeight.w700 : FontWeight.w500,
                  color: widget.selected ? _C.accent : _C.textBody,
                ),
              ),
            ),
            if (widget.selected)
              Container(
                width: 20,
                height: 20,
                decoration: BoxDecoration(
                  color: _C.accent,
                  shape: BoxShape.circle,
                ),
                child: const Icon(
                  Icons.check_rounded,
                  size: 12,
                  color: Colors.white,
                ),
              ),
          ],
        ),
      ),
    );
  }
}

// ── Shared helpers ────────────────────────────────────────────────────────────

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
        style: GoogleFonts.outfit(
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
    this.maxLength,
    this.maxLines = 1,
    this.inputFormatters,
    this.validator,
  });
  final TextEditingController controller;
  final String hint;
  final IconData icon;
  final TextInputType? keyboardType;
  final bool obscureText;
  final int? maxLength;
  final int? maxLines;
  final List<TextInputFormatter>? inputFormatters;
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
      maxLength: widget.maxLength,
      maxLines: widget.maxLines,
      inputFormatters: widget.inputFormatters,
      validator: widget.validator,
      style: GoogleFonts.outfit(
        color: _C.darkBlue,
        fontSize: 15,
        fontWeight: FontWeight.w500,
      ),
      decoration: InputDecoration(
        hintText: widget.hint,
        hintStyle: GoogleFonts.outfit(color: _C.textMuted, fontSize: 14),
        counterText: '',
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
                  style: GoogleFonts.outfit(
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
