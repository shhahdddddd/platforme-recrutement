import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:recrutitn/core/theme/app_theme.dart';
import 'package:recrutitn/features/binome/services/binome_service.dart';
import 'package:recrutitn/features/binome/presentation/widgets/invite_binome_dialog.dart';
import 'package:recrutitn/core/utils/snackbar_utils.dart';

/// Widget to display binome information or invite option
class BinomeInfoWidget extends StatelessWidget {
  final int applicationId;
  final String token;
  final BinomeStatus? binomeStatus;
  final VoidCallback? onBinomeChanged;
  final bool isCompact;
  final BinomeService? binomeService;

  const BinomeInfoWidget({
    super.key,
    required this.applicationId,
    required this.token,
    this.binomeStatus,
    this.onBinomeChanged,
    this.isCompact = false,
    this.binomeService,
  });

  @override
  Widget build(BuildContext context) {
    if (binomeStatus == null) {
      return const SizedBox.shrink();
    }

    // Show binome partner info if we have a binome
    if (binomeStatus!.hasBinome && binomeStatus!.binomeCandidate != null) {
      return _buildBinomeCard(context);
    }

    // Show pending invitation status
    if (binomeStatus!.hasPendingInvitation) {
      return _buildPendingCard(context);
    }

    // Show invite button if candidate can invite a binome.
    if (binomeStatus!.canInvite) {
      return _buildInviteButton(context);
    }

    return const SizedBox.shrink();
  }

  Widget _buildBinomeCard(BuildContext context) {
    final binome = binomeStatus!.binomeCandidate!;

    if (isCompact) {
      return Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        decoration: BoxDecoration(
          color: Colors.green.shade50,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: Colors.green.shade200),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              Icons.group_rounded,
              size: 16,
              color: Colors.green.shade700,
            ),
            const SizedBox(width: 6),
            Text(
              'Binome: ${binome.firstName}',
              style: GoogleFonts.inter(
                fontSize: 12,
                fontWeight: FontWeight.w600,
                color: Colors.green.shade700,
              ),
            ),
          ],
        ),
      );
    }

    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.green.shade50,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: Colors.green.shade200),
      ),
      child: Row(
        children: [
          Container(
            width: 48,
            height: 48,
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(12),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withOpacity(0.05),
                  blurRadius: 4,
                  offset: const Offset(0, 2),
                ),
              ],
            ),
            child: binome.picture != null
                ? ClipRRect(
                    borderRadius: BorderRadius.circular(12),
                    child: Image.network(
                      binome.picture!,
                      fit: BoxFit.cover,
                      errorBuilder: (_, __, ___) => _buildFallbackAvatar(binome),
                    ),
                  )
                : _buildFallbackAvatar(binome),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Your Binome Partner',
                  style: GoogleFonts.inter(
                    fontSize: 12,
                    color: Colors.green.shade700,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  binome.fullName,
                  style: GoogleFonts.inter(
                    fontSize: 15,
                    fontWeight: FontWeight.w700,
                    color: AppTheme.textColor,
                  ),
                ),
                if (binome.email != null)
                  Text(
                    binome.email!,
                    style: GoogleFonts.inter(
                      fontSize: 12,
                      color: AppTheme.subtextColor,
                    ),
                  ),
              ],
            ),
          ),
          _buildOnlineIndicator(binome.isOnline),
        ],
      ),
    );
  }

  Widget _buildFallbackAvatar(BinomeCandidate binome) {
    return Center(
      child: Text(
        binome.firstName.isNotEmpty ? binome.firstName[0].toUpperCase() : '?',
        style: GoogleFonts.outfit(
          fontSize: 20,
          fontWeight: FontWeight.bold,
          color: AppTheme.primaryColor,
        ),
      ),
    );
  }

  Widget _buildOnlineIndicator(bool isOnline) {
    return Container(
      width: 12,
      height: 12,
      decoration: BoxDecoration(
        color: isOnline ? Colors.green.shade400 : Colors.grey.shade400,
        shape: BoxShape.circle,
        border: Border.all(color: Colors.white, width: 2),
      ),
    );
  }

  Widget _buildPendingCard(BuildContext context) {
    final invitation = binomeStatus!.invitation!;
    final isInviter = invitation.isInviter;

    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.orange.shade50,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: Colors.orange.shade200),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(
                Icons.pending_outlined,
                color: Colors.orange.shade700,
                size: 20,
              ),
              const SizedBox(width: 8),
              Text(
                isInviter ? 'Invitation Sent' : 'Invitation Received',
                style: GoogleFonts.inter(
                  fontSize: 14,
                  fontWeight: FontWeight.w700,
                  color: Colors.orange.shade700,
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Text(
            isInviter
                ? 'Waiting for ${invitation.invitedCandidate?.firstName ?? invitation.invitedEmail} to respond...'
                : '${invitation.otherCandidate?.fullName ?? 'Someone'} wants to be your binome partner for this internship.',
            style: GoogleFonts.inter(
              fontSize: 13,
              color: AppTheme.subtextColor,
            ),
          ),
          if (!isInviter) ...[
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(
                  child: OutlinedButton(
                    onPressed: () => _rejectInvitation(context),
                    style: OutlinedButton.styleFrom(
                      side: BorderSide(color: Colors.grey.shade300),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(8),
                      ),
                    ),
                    child: Text(
                      'Decline',
                      style: GoogleFonts.inter(
                        fontWeight: FontWeight.w600,
                        color: AppTheme.subtextColor,
                      ),
                    ),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: ElevatedButton(
                    onPressed: () => _acceptInvitation(context),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: Colors.green.shade600,
                      foregroundColor: Colors.white,
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(8),
                      ),
                    ),
                    child: Text(
                      'Accept',
                      style: GoogleFonts.inter(
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildInviteButton(BuildContext context) {
    if (isCompact) {
      return InkWell(
        onTap: () => _showInviteDialog(context),
        child: Container(
          width: 36,
          height: 36,
          decoration: BoxDecoration(
            color: AppTheme.primaryColor,
            borderRadius: BorderRadius.circular(18),
            boxShadow: [
              BoxShadow(
                color: AppTheme.primaryColor.withOpacity(0.3),
                blurRadius: 8,
                offset: const Offset(0, 2),
              ),
            ],
          ),
          child: const Icon(
            Icons.add,
            size: 20,
            color: Colors.white,
          ),
        ),
      );
    }

    return InkWell(
      onTap: () => _showInviteDialog(context),
      child: Container(
        width: 48,
        height: 48,
        margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
        decoration: BoxDecoration(
          color: AppTheme.primaryColor,
          borderRadius: BorderRadius.circular(24),
          boxShadow: [
            BoxShadow(
              color: AppTheme.primaryColor.withOpacity(0.3),
              blurRadius: 10,
              offset: const Offset(0, 3),
            ),
          ],
        ),
        child: const Icon(
          Icons.add,
          size: 24,
          color: Colors.white,
        ),
      ),
    );
  }

  Future<void> _showInviteDialog(BuildContext context) async {
    final service = binomeService ?? BinomeService();
    final result = await showDialog<bool>(
      context: context,
      builder: (context) => InviteBinomeDialog(
        applicationId: applicationId,
        token: token,
        binomeService: service,
      ),
    );

    if (result == true) {
      onBinomeChanged?.call();
    }
  }

  Future<void> _acceptInvitation(BuildContext context) async {
    try {
      final service = binomeService ?? BinomeService();
      await service.acceptInvitation(
        binomeStatus!.invitation!.id,
        token: token,
      );

      if (context.mounted) {
        SnackBarUtils.showSuccess(context, 'You are now binome partners!');
        onBinomeChanged?.call();
      }
    } catch (e) {
      if (context.mounted) {
        SnackBarUtils.showError(context, e.toString());
      }
    }
  }

  Future<void> _rejectInvitation(BuildContext context) async {
    try {
      final service = binomeService ?? BinomeService();
      await service.rejectInvitation(
        binomeStatus!.invitation!.id,
        token: token,
      );

      if (context.mounted) {
        SnackBarUtils.showInfo(context, 'Invitation declined');
        onBinomeChanged?.call();
      }
    } catch (e) {
      if (context.mounted) {
        SnackBarUtils.showError(context, e.toString());
      }
    }
  }
}
