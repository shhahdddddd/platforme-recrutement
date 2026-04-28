import 'package:dio/dio.dart';
import 'package:recrutitn/core/constants/app_constants.dart';
import 'package:recrutitn/core/network/dio_ssl_config.dart';
import 'package:flutter/foundation.dart';

int _toInt(dynamic value, {int fallback = 0}) {
  if (value is int) return value;
  if (value is num) return value.toInt();
  final raw = value?.toString().trim();
  if (raw == null || raw.isEmpty || raw.toLowerCase() == 'null') {
    return fallback;
  }
  return int.tryParse(raw) ?? double.tryParse(raw)?.toInt() ?? fallback;
}

bool _toBool(dynamic value, {bool fallback = false}) {
  if (value is bool) return value;
  if (value is num) return value != 0;
  if (value is String) {
    final raw = value.trim().toLowerCase();
    if (raw == 'true' || raw == '1' || raw == 'yes') return true;
    if (raw == 'false' || raw == '0' || raw == 'no') return false;
  }
  return fallback;
}

String? _toNullableString(dynamic value) {
  if (value == null) return null;
  final raw = value.toString().trim();
  if (raw.isEmpty || raw.toLowerCase() == 'null') return null;
  return raw;
}

DateTime _parseDateTimeOrNow(dynamic value) {
  final raw = _toNullableString(value);
  if (raw == null) return DateTime.now();
  return DateTime.tryParse(raw) ?? DateTime.now();
}

DateTime? _parseNullableDateTime(dynamic value) {
  final raw = _toNullableString(value);
  if (raw == null) return null;
  return DateTime.tryParse(raw);
}

Map<String, dynamic>? _toMapOrNull(dynamic value) {
  if (value is Map<String, dynamic>) return value;
  if (value is Map) {
    return value.map((key, val) => MapEntry('$key', val));
  }
  return null;
}

/// Binome (Partner) invitation status
enum BinomeInvitationStatus { pending, accepted, rejected, cancelled }

/// Binome candidate model
class BinomeCandidate {
  final int id;
  final String firstName;
  final String lastName;
  final String? email;
  final String? picture;
  final int? userId;
  final bool isOnline;
  final String? lastSeenAt;

  BinomeCandidate({
    required this.id,
    required this.firstName,
    required this.lastName,
    this.email,
    this.picture,
    this.userId,
    this.isOnline = false,
    this.lastSeenAt,
  });

  factory BinomeCandidate.fromJson(Map<String, dynamic> json) {
    return BinomeCandidate(
      id: _toInt(json['id']),
      firstName: _toNullableString(json['first_name']) ?? '',
      lastName: _toNullableString(json['last_name']) ?? '',
      email: _toNullableString(json['email']),
      picture: _toNullableString(json['picture']),
      userId: json['user_id'] != null ? _toInt(json['user_id']) : null,
      isOnline: _toBool(json['is_online']),
      lastSeenAt: _toNullableString(json['last_seen_at']),
    );
  }

  String get fullName => '$firstName $lastName';
}

/// Binome invitation model
class BinomeInvitation {
  final int id;
  final BinomeInvitationStatus status;
  final bool isInviter;
  final String? invitedEmail;
  final BinomeCandidate? invitedCandidate;
  final String? message;
  final DateTime createdAt;
  final DateTime? respondedAt;
  final Map<String, dynamic>? jobOffer;
  final BinomeCandidate? otherCandidate;

  BinomeInvitation({
    required this.id,
    required this.status,
    required this.isInviter,
    this.invitedEmail,
    this.invitedCandidate,
    this.message,
    required this.createdAt,
    this.respondedAt,
    this.jobOffer,
    this.otherCandidate,
  });

  factory BinomeInvitation.fromJson(Map<String, dynamic> json) {
    final invitedCandidateMap = _toMapOrNull(json['invited_candidate']);
    final otherCandidateMap = _toMapOrNull(json['other_candidate']);
    return BinomeInvitation(
      id: _toInt(json['id']),
      status: _parseStatus(_toNullableString(json['status'])),
      isInviter: _toBool(json['is_inviter']),
      invitedEmail: _toNullableString(json['invited_email']),
      invitedCandidate: invitedCandidateMap != null
          ? BinomeCandidate.fromJson(invitedCandidateMap)
          : null,
      message: _toNullableString(json['message']),
      createdAt: _parseDateTimeOrNow(json['created_at']),
      respondedAt: _parseNullableDateTime(json['responded_at']),
      jobOffer: _toMapOrNull(json['job_offer']),
      otherCandidate: otherCandidateMap != null
          ? BinomeCandidate.fromJson(otherCandidateMap)
          : null,
    );
  }

  static BinomeInvitationStatus _parseStatus(String? status) {
    switch ((status ?? '').toLowerCase()) {
      case 'pending':
        return BinomeInvitationStatus.pending;
      case 'accepted':
        return BinomeInvitationStatus.accepted;
      case 'rejected':
        return BinomeInvitationStatus.rejected;
      case 'cancelled':
        return BinomeInvitationStatus.cancelled;
      default:
        return BinomeInvitationStatus.pending;
    }
  }

  bool get isPending => status == BinomeInvitationStatus.pending;
  bool get isAccepted => status == BinomeInvitationStatus.accepted;
  bool get isRejected => status == BinomeInvitationStatus.rejected;
}

/// Binome status response
class BinomeStatus {
  final bool hasBinome;
  final String conversationType;
  final BinomeCandidate? binomeCandidate;
  final BinomeInvitation? invitation;
  final bool canInvite;

  BinomeStatus({
    required this.hasBinome,
    required this.conversationType,
    this.binomeCandidate,
    this.invitation,
    required this.canInvite,
  });

  factory BinomeStatus.fromJson(Map<String, dynamic> json) {
    final binomeCandidateMap = _toMapOrNull(json['binome_candidate']);
    final invitationMap = _toMapOrNull(json['invitation']);
    return BinomeStatus(
      hasBinome: _toBool(json['has_binome']),
      conversationType: _toNullableString(json['conversation_type']) ?? 'solo',
      binomeCandidate: binomeCandidateMap != null
          ? BinomeCandidate.fromJson(binomeCandidateMap)
          : null,
      invitation: invitationMap != null
          ? BinomeInvitation.fromJson(invitationMap)
          : null,
      canInvite: _toBool(json['can_invite']),
    );
  }

  bool get isSolo => conversationType == 'solo';
  bool get isDuo => conversationType == 'duo';
  bool get hasPendingInvitation => invitation?.isPending ?? false;
}

/// Service for managing binome (partner) functionality
class BinomeService {
  final Dio _dio;

  BinomeService({Dio? dio}) : _dio = dio ?? _createFallbackDio();

  static Dio _createFallbackDio() {
    final dio = Dio(
      BaseOptions(
        connectTimeout: const Duration(seconds: 10),
        sendTimeout: const Duration(seconds: 10),
        receiveTimeout: const Duration(seconds: 15),
        headers: const {'Accept': 'application/json'},
      ),
    );
    configureLocalDevSsl(dio);
    return dio;
  }

  String get _baseUrl => AppConstants.apiBaseUrl;

  /// Get binome status for an application
  Future<BinomeStatus> getBinomeStatus(
    int applicationId, {
    required String token,
  }) async {
    final response = await _dio.get(
      '$_baseUrl/candidate/binome/applications/$applicationId/status',
      options: Options(headers: {'Authorization': 'Bearer $token'}),
    );

    if (response.data['success'] == true) {
      return BinomeStatus.fromJson(
        response.data['data'] as Map<String, dynamic>,
      );
    }

    throw Exception(response.data['message'] ?? 'Failed to get binome status');
  }

  /// Send a binome invitation
  Future<BinomeInvitation> sendInvitation(
    int applicationId, {
    required String email,
    String? message,
    required String token,
  }) async {
    final response = await _dio.post(
      '$_baseUrl/candidate/binome/applications/$applicationId/invite',
      data: {'email': email, 'message': message},
      options: Options(headers: {'Authorization': 'Bearer $token'}),
    );

    if (response.data['success'] == true) {
      return BinomeInvitation.fromJson(
        response.data['data']['invitation'] as Map<String, dynamic>,
      );
    }

    throw Exception(response.data['message'] ?? 'Failed to send invitation');
  }

  /// Accept a binome invitation
  Future<BinomeInvitation> acceptInvitation(
    int invitationId, {
    required String token,
  }) async {
    final response = await _dio.post(
      '$_baseUrl/candidate/binome/invitations/$invitationId/accept',
      options: Options(headers: {'Authorization': 'Bearer $token'}),
    );

    if (response.data['success'] == true) {
      return BinomeInvitation.fromJson(
        response.data['data']['invitation'] as Map<String, dynamic>,
      );
    }

    throw Exception(response.data['message'] ?? 'Failed to accept invitation');
  }

  /// Reject a binome invitation
  Future<void> rejectInvitation(
    int invitationId, {
    required String token,
  }) async {
    final response = await _dio.post(
      '$_baseUrl/candidate/binome/invitations/$invitationId/reject',
      options: Options(headers: {'Authorization': 'Bearer $token'}),
    );

    if (response.data['success'] != true) {
      throw Exception(
        response.data['message'] ?? 'Failed to reject invitation',
      );
    }
  }

  /// Cancel a sent invitation
  Future<void> cancelInvitation(
    int invitationId, {
    required String token,
  }) async {
    final response = await _dio.post(
      '$_baseUrl/candidate/binome/invitations/$invitationId/cancel',
      options: Options(headers: {'Authorization': 'Bearer $token'}),
    );

    if (response.data['success'] != true) {
      throw Exception(
        response.data['message'] ?? 'Failed to cancel invitation',
      );
    }
  }

  /// Remove a binome from conversation
  Future<void> removeBinome(int applicationId, {required String token}) async {
    final response = await _dio.post(
      '$_baseUrl/candidate/binome/applications/$applicationId/remove',
      options: Options(headers: {'Authorization': 'Bearer $token'}),
    );

    if (response.data['success'] != true) {
      throw Exception(response.data['message'] ?? 'Failed to remove binome');
    }
  }

  /// List all binome invitations
  Future<List<BinomeInvitation>> listInvitations({
    String? type, // 'sent', 'received', 'all'
    required String token,
  }) async {
    final response = await _dio.get(
      '$_baseUrl/candidate/binome/invitations',
      queryParameters: type != null ? {'type': type} : null,
      options: Options(headers: {'Authorization': 'Bearer $token'}),
    );

    if (response.data['success'] == true) {
      final List<dynamic> data = response.data['data'] as List<dynamic>;
      return data
          .map(
            (item) => BinomeInvitation.fromJson(item as Map<String, dynamic>),
          )
          .toList();
    }

    throw Exception(response.data['message'] ?? 'Failed to list invitations');
  }

  /// Get accepted candidates for the same internship (for binome autocomplete)
  Future<List<BinomeCandidate>> getAcceptedCandidates(
    int applicationId, {
    required String token,
  }) async {
    try {
      final response = await _dio.get(
        '$_baseUrl/candidate/binome/applications/$applicationId/accepted-candidates',
        options: Options(headers: {'Authorization': 'Bearer $token'}),
      );

      if (response.data['success'] == true) {
        final List<dynamic> data = response.data['data'] as List<dynamic>? ?? [];
        return data
            .map(
              (item) => BinomeCandidate.fromJson(item as Map<String, dynamic>),
            )
            .toList();
      }
      return [];
    } catch (e) {
      if (kDebugMode) {
        debugPrint('[Binome] accepted-candidates failed for app $applicationId: $e');
      }
      // Silently return empty list on error - autocomplete is optional
      return [];
    }
  }
}
