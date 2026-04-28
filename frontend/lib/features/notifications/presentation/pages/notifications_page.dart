import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:recrutitn/core/constants/app_constants.dart';
import 'package:recrutitn/injection_container.dart';
import 'package:recrutitn/features/messages/presentation/pages/candidate_chat_page.dart';
import 'package:recrutitn/features/quiz/presentation/pages/candidate_quiz_page.dart';
import 'package:intl/intl.dart';


class NotificationsPage extends StatefulWidget {
  const NotificationsPage({super.key});

  @override
  State<NotificationsPage> createState() => _NotificationsPageState();
}

class _NotificationsPageState extends State<NotificationsPage> {
  late Future<List<Map<String, dynamic>>> _notifications;

  @override
  void initState() {
    super.initState();
    _loadNotifications();
  }

  void _loadNotifications() {
    setState(() {
      _notifications = _fetchNotifications();
    });
  }

  Future<void> _markAsRead(int notificationId) async {
    final dio = sl<Dio>();
    try {
      await dio.post('${AppConstants.apiBaseUrl}/notifications/$notificationId/read');
    } catch (e) {
      debugPrint('Error marking notification as read: $e');
    }
  }

  Future<void> _markAllAsRead() async {
    final dio = sl<Dio>();
    try {
      await dio.post('${AppConstants.apiBaseUrl}/notifications/mark-all-read');
      _loadNotifications();
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('All notifications marked as read')),
      );
    } catch (e) {
      debugPrint('Error marking all notifications as read: $e');
    }
  }

  Future<List<Map<String, dynamic>>> _fetchNotifications() async {
    final dio = sl<Dio>();
    try {
      final response = await dio.get('${AppConstants.apiBaseUrl}/notifications');
      if (response.data != null && response.data['data'] != null) {
        return List<Map<String, dynamic>>.from(response.data['data']);
      }
    } catch (e) {
      debugPrint('Error fetching notifications: $e');
    }
    return [];
  }

  Map<String, dynamic> _mergedPayload(Map<String, dynamic> notification) {
    final nestedData = notification['data'];
    if (nestedData is Map) {
      return {...notification, ...Map<String, dynamic>.from(nestedData)};
    }
    return notification;
  }

  Future<bool> _openQuizIfAvailable(int applicationId, {bool preferAi = false}) async {
    if (applicationId <= 0) return false;

    final dio = sl<Dio>();
    try {
      final queryParams = preferAi ? '?prefer_ai=1' : '';
      await dio.get(
        '${AppConstants.apiBaseUrl}/candidate/applications/$applicationId/quiz$queryParams',
      );
      if (!mounted) return true;

      await Navigator.push(
        context,
        MaterialPageRoute(
          builder: (_) => CandidateQuizPage(
            applicationId: applicationId,
            isAiQuiz: preferAi,
          ),
        ),
      );
      return true;
    } catch (e) {
      debugPrint('Quiz open check failed for application $applicationId: $e');
      return false;
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        title: const Text(
          'Notifications',
          style: TextStyle(
            fontWeight: FontWeight.w900,
            fontSize: 20,
            letterSpacing: -0.8,
            color: Color(0xFF0F172A),
          ),
        ),
        backgroundColor: Colors.white,
        centerTitle: true,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new_rounded, size: 20, color: Color(0xFF0F172A)),
          onPressed: () => Navigator.pop(context),
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.done_all_rounded, size: 22, color: Color(0xFF64748B)),
            onPressed: _markAllAsRead,
          ),
          const SizedBox(width: 8),
        ],
      ),
      body: FutureBuilder<List<Map<String, dynamic>>>(
        future: _notifications,
        builder: (context, snapshot) {
          if (snapshot.connectionState == ConnectionState.waiting) {
            return const Center(child: CircularProgressIndicator(strokeWidth: 3, color: Color(0xFF0076C6)));
          }
          if (snapshot.hasError || !snapshot.hasData || snapshot.data!.isEmpty) {
            return _emptyState();
          }

          final list = snapshot.data!;
          return RefreshIndicator(
            color: const Color(0xFF0076C6),
            onRefresh: () async => _loadNotifications(),
            child: ListView.builder(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 30),
              itemCount: list.length,
              itemBuilder: (context, index) {
                final notif = list[index];
                return _notificationTile(context, notif);
              },
            ),
          );
        },
      ),
    );
  }

  Widget _emptyState() {
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            padding: const EdgeInsets.all(24),
            decoration: BoxDecoration(
              color: Colors.blue.withOpacity(0.05),
              shape: BoxShape.circle,
            ),
            child: Icon(Icons.notifications_off_outlined, size: 60, color: Colors.blue.withOpacity(0.2)),
          ),
          const SizedBox(height: 20),
          const Text(
            'Everything is up to date!',
            style: TextStyle(
              fontSize: 18,
              fontWeight: FontWeight.w900,
              color: Color(0xFF1E293B),
            ),
          ),
          const SizedBox(height: 8),
          const Text(
            'You have no new notifications.',
            style: TextStyle(
              fontSize: 14,
              color: Color(0xFF64748B),
              fontWeight: FontWeight.w500,
            ),
          ),
        ],
      ),
    );
  }

  Widget _notificationTile(BuildContext context, Map<String, dynamic> notif) {
    final payload = _mergedPayload(notif);
    final title = notif['title'] ?? 'Notification';
    final body = notif['body'] ?? '';
    final dateStr = notif['sent_at'] ?? notif['created_at'];
    final isRead = notif['is_read'] == true;
    
    String time = '';
    if (dateStr != null) {
      try {
        final dt = DateTime.parse(dateStr);
        time = DateFormat('dd MMM, HH:mm').format(dt);
      } catch (_) {}
    }

    final isInterview = title.toLowerCase().contains('entretien') ||
                        body.toLowerCase().contains('entretien') ||
                        title.toLowerCase().contains('interview');
    final type = (payload['type'] ?? '').toString().toUpperCase();
    final titleLower = title.toString().toLowerCase();
    final bodyLower = body.toString().toLowerCase();
    final isQuiz = type == 'QUIZ_READY' ||
        type == 'QUIZ_COMPLETED' ||
        titleLower.contains('quiz') ||
        titleLower.contains('assessment') ||
        bodyLower.contains('quiz') ||
        bodyLower.contains('assessment');
    final isAiQuiz = type == 'QUIZ_READY' ||
        payload['ai_generated'] == true ||
        payload['ai_generated'] == 'true';
    final isChat = type == 'INTERN_CHAT_MESSAGE' ||
        type == 'BINOME_INVITATION' ||
        type == 'BINOME_INVITATION_ACCEPTED' ||
        type == 'BINOME_INVITATION_REJECTED' ||
        titleLower.contains('message') ||
        bodyLower.contains('message');
    final applicationId = int.tryParse(
      (payload['application_id'] ?? payload['reference_id'] ?? '').toString(),
    );
    
    final isRejection = title.toLowerCase().contains('non retenue') || 
                        title.toLowerCase().contains('rejected') ||
                        body.toLowerCase().contains('non retenue') ||
                        (notif['type'] ?? '').toString() == 'APPLICATION_REJECTED';
    final isAcceptance = title.toLowerCase().contains('accepted') ||
                        body.toLowerCase().contains('accepted') ||
                        (notif['type'] ?? '').toString() == 'APPLICATION_ACCEPTED';

    return AnimatedContainer(
      duration: const Duration(milliseconds: 300),
      margin: const EdgeInsets.only(bottom: 12),
      decoration: BoxDecoration(
        color: isRead ? Colors.white : const Color(0xFFF1F5F9).withOpacity(0.5),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(
          color: isRead 
            ? const Color(0xFFE2E8F0) 
            : isRejection 
              ? const Color(0xFFEF4444).withOpacity(0.2)
              : isAcceptance
                ? const Color(0xFF10B981).withOpacity(0.2)
              : const Color(0xFF0076C6).withOpacity(0.2),
          width: isRead ? 1 : 1.5,
        ),
        boxShadow: [
          if (!isRead)
            BoxShadow(
              color: isRejection 
                ? const Color(0xFFEF4444).withOpacity(0.05)
                : isAcceptance
                  ? const Color(0xFF10B981).withOpacity(0.05)
                : const Color(0xFF0076C6).withOpacity(0.05),
              blurRadius: 10,
              offset: const Offset(0, 4),
            ),
        ],
      ),
        child: Material(
          color: Colors.transparent,
          child: InkWell(
          onTap: () async {
            // Mark as read when tapped
            if (notif['is_read'] != true && notif['id'] != null) {
              await _markAsRead(notif['id']);
            }
            if (!mounted) return;

            if (applicationId != null &&
                applicationId > 0 &&
                (isQuiz || isInterview)) {
              final opened = await _openQuizIfAvailable(applicationId, preferAi: isAiQuiz);
              if (opened) {
                return;
              }
            }
            if (applicationId != null && applicationId > 0 && isChat) {
              await Navigator.push(
                context,
                MaterialPageRoute(
                  builder: (_) => CandidateChatPage(
                    initialApplicationId: applicationId,
                  ),
                ),
              );
              return;
            }
            if (isQuiz) {
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(content: Text('This quiz notification is missing its application link.')),
              );
              return;
            }
            if (isInterview) {
              Navigator.pop(context);
            }
          },
          borderRadius: BorderRadius.circular(20),
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Icon Container
                Container(
                  width: 52,
                  height: 52,
                  decoration: BoxDecoration(
                    gradient: isRejection
                      ? const LinearGradient(colors: [Color(0xFFFCA5A5), Color(0xFFEF4444)])
                      : isAcceptance
                        ? const LinearGradient(colors: [Color(0xFF6EE7B7), Color(0xFF059669)])
                      : isQuiz
                        ? const LinearGradient(colors: [Color(0xFF60A5FA), Color(0xFF2563EB)])
                      : isInterview 
                        ? const LinearGradient(colors: [Color(0xFF2BBDFF), Color(0xFF0076C6)])
                        : LinearGradient(colors: [const Color(0xFFF1F5F9), const Color(0xFFE2E8F0)]),
                    borderRadius: BorderRadius.circular(16),
                  ),
                  child: Icon(
                    isRejection
                        ? Icons.cancel_rounded
                        : isAcceptance
                            ? Icons.verified_rounded
                        : isQuiz
                            ? Icons.quiz_rounded
                            : isInterview
                                ? Icons.calendar_month_rounded
                                : Icons.notifications_rounded,
                    color: isRejection || isAcceptance || isQuiz || isInterview ? Colors.white : const Color(0xFF64748B),
                    size: 24,
                  ),
                ),
                const SizedBox(width: 16),
                // Text Content
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Expanded(
                            child: Text(
                              title,
                              style: TextStyle(
                                fontWeight: FontWeight.w900,
                                fontSize: 15,
                                color: const Color(0xFF0F172A),
                                letterSpacing: -0.3,
                              ),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                          if (!isRead)
                            Container(
                              width: 8,
                              height: 8,
                              decoration: const BoxDecoration(
                                color: Color(0xFF0076C6),
                                shape: BoxShape.circle,
                              ),
                            ),
                        ],
                      ),
                      const SizedBox(height: 4),
                      Text(
                        body,
                        style: const TextStyle(
                          fontSize: 13,
                          color: Color(0xFF475569),
                          height: 1.4,
                          fontWeight: FontWeight.w500,
                        ),
                        maxLines: 3,
                        overflow: TextOverflow.ellipsis,
                      ),
                      const SizedBox(height: 10),
                      Text(
                        time,
                        style: TextStyle(
                          fontSize: 11,
                          color: const Color(0xFF94A3B8),
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
