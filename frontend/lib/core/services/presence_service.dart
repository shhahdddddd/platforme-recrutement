import 'dart:async';

import 'package:dio/dio.dart';

import '../constants/app_constants.dart';

/// Service for managing user online/offline presence
class PresenceService {
  final Dio _dio;
  Timer? _heartbeatTimer;
  
  PresenceService({required Dio dio}) : _dio = dio;

  /// Mark user as online
  Future<bool> markOnline() async {
    try {
      final response = await _dio.post(
        '${AppConstants.apiBaseUrl}/presence/online',
      );
      
      if (response.data['success'] == true) {
        // Start heartbeat
        _startHeartbeat();
        return true;
      }
      return false;
    } catch (e) {
      print('[Presence] Error marking online: $e');
      return false;
    }
  }

  /// Mark user as offline
  Future<bool> markOffline() async {
    _stopHeartbeat();
    
    try {
      final response = await _dio.post(
        '${AppConstants.apiBaseUrl}/presence/offline',
      );
      
      return response.data['success'] == true;
    } catch (e) {
      print('[Presence] Error marking offline: $e');
      return false;
    }
  }

  /// Get online status for multiple users
  Future<Map<int, UserPresence>> getUsersStatus(List<int> userIds) async {
    try {
      final response = await _dio.post(
        '${AppConstants.apiBaseUrl}/presence/status',
        data: {'user_ids': userIds},
      );
      
      if (response.data['success'] == true) {
        final List<dynamic> data = response.data['data'] ?? [];
        final Map<int, UserPresence> statuses = {};
        
        for (final item in data) {
          final userId = item['user_id'] as int? ?? 0;
          statuses[userId] = UserPresence(
            userId: userId,
            isOnline: item['is_online'] ?? false,
            lastSeenAt: item['last_seen_at'],
          );
        }
        
        return statuses;
      }
      return {};
    } catch (e) {
      print('[Presence] Error getting user status: $e');
      return {};
    }
  }

  /// Send heartbeat to maintain online status
  Future<void> sendHeartbeat() async {
    try {
      await _dio.post(
        '${AppConstants.apiBaseUrl}/presence/heartbeat',
      );
    } catch (e) {
      print('[Presence] Heartbeat failed: $e');
    }
  }

  /// Start periodic heartbeat
  void _startHeartbeat() {
    _stopHeartbeat();
    // Send heartbeat every 1 minute
    _heartbeatTimer = Timer.periodic(const Duration(minutes: 1), (_) {
      sendHeartbeat();
    });
  }

  /// Stop heartbeat timer
  void _stopHeartbeat() {
    _heartbeatTimer?.cancel();
    _heartbeatTimer = null;
  }

  /// Dispose resources
  void dispose() {
    _stopHeartbeat();
  }
}

/// User presence model
class UserPresence {
  final int userId;
  final bool isOnline;
  final String? lastSeenAt;

  UserPresence({
    required this.userId,
    required this.isOnline,
    this.lastSeenAt,
  });

  /// Get formatted last seen text
  String get lastSeenText {
    if (isOnline) return 'Online';
    if (lastSeenAt == null) return 'Offline';
    
    final lastSeen = DateTime.tryParse(lastSeenAt!);
    if (lastSeen == null) return 'Offline';
    
    final now = DateTime.now();
    final diff = now.difference(lastSeen);
    
    if (diff.inMinutes < 1) {
      return 'Just now';
    } else if (diff.inMinutes < 60) {
      return '${diff.inMinutes}m ago';
    } else if (diff.inHours < 24) {
      return '${diff.inHours}h ago';
    } else {
      return '${diff.inDays}d ago';
    }
  }
}
