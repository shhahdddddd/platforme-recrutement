import 'dart:async';

import 'package:dio/dio.dart';
import 'package:file_picker/file_picker.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';

import 'package:recrutitn/features/auth/data/datasources/auth_local_data_source.dart';
import 'package:recrutitn/features/binome/presentation/widgets/invite_binome_dialog.dart';
import 'package:recrutitn/features/binome/services/binome_service.dart';
import 'package:recrutitn/features/messages/presentation/pages/conversation_members_page.dart';
import '../../../../core/constants/app_constants.dart';
import '../../../../core/services/websocket_service.dart';
import '../../../../core/services/presence_service.dart';
import '../../../../injection_container.dart';

// Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ Design Tokens Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬

class _Colors {
  // Base
  static const white = Color(0xFFFFFFFF);
  static const background = Color(0xFFF5F4F1); // warm off-white
  static const surface = Color(0xFFFFFFFF);
  static const surfaceElevated = Color(0xFFFAF9F7);

  // Text
  static const textPrimary = Color(0xFF18181B);
  static const textSecondary = Color(0xFF71717A);
  static const textTertiary = Color(0xFFA1A1AA);

  // Borders
  static const border = Color(0xFFE4E4E7);
  static const borderLight = Color(0xFFF4F4F5);

  // Accent Ã¢â‚¬â€œ slate blue, professional & restrained
  static const accent = Color(0xFF3B5BDB);
  static const accentLight = Color(0xFFEEF2FF);
  static const accentMuted = Color(0xFF748FFC);

  // Status
  static const online = Color(0xFF22C55E);
  static const onlineBg = Color(0xFFDCFCE7);
  static const unreadBadge = Color(0xFF3B5BDB);

  // Message bubbles
  static const bubbleSelf = Color(0xFF3B5BDB);
  static const bubbleOther = Color(0xFFFFFFFF);
  static const bubbleSelfText = Color(0xFFFFFFFF);
  static const bubbleOtherText = Color(0xFF18181B);

  // Selected conversation
  static const selectedBg = Color(0xFFEEF2FF);
  static const selectedBorder = Color(0xFFBFD7FF);
}

class _Radius {
  static const sm = BorderRadius.all(Radius.circular(8));
  static const md = BorderRadius.all(Radius.circular(12));
  static const lg = BorderRadius.all(Radius.circular(16));
  static const xl = BorderRadius.all(Radius.circular(20));
  static const full = BorderRadius.all(Radius.circular(100));
}

class _Spacing {
  static const xs = 4.0;
  static const sm = 8.0;
  static const md = 16.0;
  static const lg = 24.0;
  static const xl = 32.0;
}

// Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ Typography helpers Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬

TextStyle _t({
  double size = 14,
  FontWeight weight = FontWeight.w400,
  Color color = _Colors.textPrimary,
  double height = 1.5,
  double? letterSpacing,
}) =>
    GoogleFonts.dmSans(
      fontSize: size,
      fontWeight: weight,
      color: color,
      height: height,
      letterSpacing: letterSpacing,
    );

// Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ Page Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬

class CandidateChatPage extends StatefulWidget {
  final int? initialApplicationId;
  const CandidateChatPage({super.key, this.initialApplicationId});

  @override
  State<CandidateChatPage> createState() => _CandidateChatPageState();
}

class _CandidateChatPageState extends State<CandidateChatPage>
    with TickerProviderStateMixin {
  final Dio _dio = sl<Dio>();
  final AuthLocalDataSource _authLocalDataSource = sl<AuthLocalDataSource>();
  final BinomeService _binomeService = BinomeService(dio: sl<Dio>());
  final WebSocketService _wsService = sl<WebSocketService>();
  final PresenceService _presenceService = sl<PresenceService>();
  final TextEditingController _searchController = TextEditingController();
  final TextEditingController _messageController = TextEditingController();
  final ScrollController _scrollController = ScrollController();
  final FocusNode _inputFocusNode = FocusNode();

  StreamSubscription<WebSocketState>? _wsStateSubscription;
  StreamSubscription<WebSocketMessage>? _wsMessageSubscription;
  StreamSubscription<Map<String, dynamic>>? _presenceSubscription;
  Timer? _fallbackPollTimer;

  bool _loadingConversations = true;
  bool _loadingMessages = false;
  bool _sending = false;
  bool _fetchingConversations = false;
  bool _fetchingMessages = false;
  bool _wsConnected = false;
  String? _error;
  bool _subscriptionDialogVisible = false;
  bool _hasShownSubscriptionDialogForCurrentLock = false;

  List<Map<String, dynamic>> _conversations = [];
  List<Map<String, dynamic>> _messages = [];
  Map<String, dynamic>? _selectedConversation;
  int? _selectedApplicationId;
  String? _authToken;
  Map<int, int> _conversationIdMap = {};
  final Map<int, BinomeStatus> _binomeStatusByApplication = {};
  final Set<int> _loadingBinomeApplications = <int>{};
  bool _hasInitialLoaded = false;
  PlatformFile? _selectedAttachment;
  String _activeFilterTab = 'all';
  Map<int, UserPresence> _userPresence = {};

  // Animation
  late AnimationController _inputFocusController;
  late Animation<double> _inputBorderAnim;

  @override
  void initState() {
    super.initState();
    _inputFocusController = AnimationController(
      duration: const Duration(milliseconds: 200),
      vsync: this,
    );
    _inputBorderAnim = Tween<double>(begin: 0, end: 1).animate(
      CurvedAnimation(parent: _inputFocusController, curve: Curves.easeOut),
    );
    _inputFocusNode.addListener(() {
      if (_inputFocusNode.hasFocus) {
        _inputFocusController.forward();
      } else {
        _inputFocusController.reverse();
      }
    });

    _searchController.addListener(() {
      if (mounted) setState(() {});
    });
    _messageController.addListener(() {
      if (mounted) setState(() {});
    });

    _initializeWebSocket();
    unawaited(_loadAuthToken());
    unawaited(_loadConversations(
      showLoader: true,
      preselectApplicationId: widget.initialApplicationId,
    ));
    _startFallbackPolling();
  }

  // Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ WebSocket Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬

  void _initializeWebSocket() {
    _wsService.initialize(baseUrl: AppConstants.apiBaseUrl);
    _connectWebSocket();

    _wsStateSubscription = _wsService.stateStream.listen((state) {
      if (!mounted) return;
      setState(() => _wsConnected = state == WebSocketState.connected);
      if (state == WebSocketState.connected) {
        _stopFallbackPolling();
        _subscribeToConversations();
      } else {
        _startFallbackPolling();
      }
    });

    _wsMessageSubscription = _wsService.messageStream.listen((message) {
      if (!mounted) return;
      _handleWebSocketMessage(message);
    });

    _presenceSubscription = _wsService.presenceStream.listen((presence) {
      if (!mounted) return;
      _handlePresenceUpdate(presence);
    });

    _presenceService.markOnline();
  }

  void _handlePresenceUpdate(Map<String, dynamic> presence) {
    final userId = presence['user_id'] as int?;
    final isOnline = presence['is_online'] as bool? ?? false;
    final lastSeenAt = presence['last_seen_at'] as String?;
    if (userId != null) {
      setState(() {
        _userPresence[userId] = UserPresence(
          userId: userId,
          isOnline: isOnline,
          lastSeenAt: lastSeenAt,
        );
      });
    }
  }

  UserPresence? _getRecruiterPresence(Map<String, dynamic> recruiter) {
    final userId = recruiter['user_id'] as int?;
    if (userId == null) return null;
    return _userPresence[userId];
  }

  void _connectWebSocket() async {
    try {
      await _wsService.connect();
    } catch (e) {
      debugPrint('[WebSocket] Connection failed: $e');
    }
  }

  void _subscribeToConversations() {
    for (final entry in _conversationIdMap.entries) {
      _wsService.subscribeToConversation(entry.value);
    }
    final currentConversationId = _getCurrentConversationId();
    if (currentConversationId != null) {
      _wsService.subscribeToConversation(currentConversationId);
    }
    _wsService.subscribeToPresenceChannel();
  }

  Future<void> _loadPresenceStatuses(List<int> userIds) async {
    try {
      final statuses = await _presenceService.getUsersStatus(userIds);
      if (!mounted) return;
      setState(() => _userPresence = {..._userPresence, ...statuses});
    } catch (e) {
      debugPrint('[Presence] Error loading statuses: $e');
    }
  }

  void _handleWebSocketMessage(WebSocketMessage message) {
    switch (message.type) {
      case WebSocketMessageType.messageSent:
        _handleIncomingMessage(ChatMessagePayload.fromJson(message.payload));
        break;
      case WebSocketMessageType.messageRead:
        _handleReadReceipt(MessageReadPayload.fromJson(message.payload));
        break;
      default:
        break;
    }
  }

  void _handleIncomingMessage(ChatMessagePayload payload) {
    final message = payload.message;
    final conversation = payload.conversation;

    final conversationIndex = _conversations.indexWhere(
      (c) => c['application_id'] == conversation['application_id'],
    );

    if (conversationIndex != -1) {
      setState(() {
        _conversations[conversationIndex]['last_message'] = {
          'id': message['id'],
          'message': message['message'],
          'sender_user_id': message['sender_user_id'],
          'created_at': message['created_at'],
          'preview': _messagePreview(message),
          'attachment': _safeMap(message['attachment']),
        };
        _conversations[conversationIndex]['last_activity_at'] =
            message['created_at'];

        if (_selectedApplicationId != conversation['application_id']) {
          final currentUnread =
              _conversations[conversationIndex]['unread_count'] ?? 0;
          _conversations[conversationIndex]['unread_count'] = currentUnread + 1;
        }

        _conversations.sort((a, b) {
          final dateA =
              DateTime.tryParse(a['last_activity_at'] ?? a['applied_at'] ?? '') ??
                  DateTime(1970);
          final dateB =
              DateTime.tryParse(b['last_activity_at'] ?? b['applied_at'] ?? '') ??
                  DateTime(1970);
          return dateB.compareTo(dateA);
        });
      });
    }

    if (_selectedApplicationId == conversation['application_id']) {
      final isDuplicate = _messages.any((m) => m['id'] == message['id']);
      if (!isDuplicate) {
        setState(() {
          _messages.add({
            'id': message['id'],
            'message': message['message'],
            'created_at': message['created_at'],
            'read_at': message['read_at'],
            'sender_user_id': message['sender_user_id'],
            'receiver_user_id': message['receiver_user_id'],
            'is_mine': false,
            'attachment': _safeMap(message['attachment']),
            'sender': message['sender'],
          });
        });
        _scrollToBottomSoon();
        _markMessagesAsRead(conversation['application_id']);
      }
    }
  }

  void _handleReadReceipt(MessageReadPayload payload) {
    setState(() {
      for (final messageId in payload.messageIds) {
        final messageIndex = _messages.indexWhere((m) => m['id'] == messageId);
        if (messageIndex != -1) {
          _messages[messageIndex]['read_at'] = payload.readAt;
        }
      }
    });
  }

  int? _getCurrentConversationId() {
    if (_selectedApplicationId == null) return null;
    return _conversationIdMap[_selectedApplicationId];
  }

  // Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ Data Loading Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬

  Future<void> _loadAuthToken() async {
    try {
      final token = await _authLocalDataSource.getLastToken();
      if (!mounted) return;
      setState(() => _authToken = token);
      final applicationId = _selectedApplicationId;
      if (applicationId != null) {
        unawaited(_loadBinomeStatus(applicationId, force: true));
      }
    } catch (e) {
      debugPrint('[Binome] Failed to resolve auth token: $e');
    }
  }

  Future<void> _loadBinomeStatus(int applicationId,
      {bool force = false}) async {
    if (!force && _loadingBinomeApplications.contains(applicationId)) return;

    String? token = _authToken;
    if (token == null || token.isEmpty) {
      token = await _authLocalDataSource.getLastToken();
      if (token != null && token.isNotEmpty && mounted) {
        setState(() => _authToken = token);
      }
    }
    if (token == null || token.isEmpty) return;

    _loadingBinomeApplications.add(applicationId);
    try {
      final status =
          await _binomeService.getBinomeStatus(applicationId, token: token);
      if (!mounted) return;
      setState(() => _binomeStatusByApplication[applicationId] = status);
    } catch (e) {
      debugPrint('[Binome] Failed to load status for app $applicationId: $e');
    } finally {
      _loadingBinomeApplications.remove(applicationId);
    }
  }

  Future<void> _onBinomeChanged() async {
    final previousApplicationId = _selectedApplicationId;
    if (previousApplicationId == null) return;
    await _loadConversations(preselectApplicationId: previousApplicationId);
    final refreshedApplicationId = _selectedApplicationId;
    if (refreshedApplicationId == null) return;
    await _loadMessages(refreshedApplicationId);
    await _loadBinomeStatus(refreshedApplicationId, force: true);
  }

  @override
  void dispose() {
    _wsStateSubscription?.cancel();
    _wsMessageSubscription?.cancel();
    _presenceSubscription?.cancel();
    _fallbackPollTimer?.cancel();
    _presenceService.markOffline();
    _presenceService.dispose();
    _wsService.disconnect();
    _scrollController.dispose();
    _searchController.dispose();
    _messageController.dispose();
    _inputFocusNode.dispose();
    _inputFocusController.dispose();
    super.dispose();
  }

  Future<void> _loadConversations(
      {bool showLoader = false, int? preselectApplicationId}) async {
    if (_fetchingConversations) return;
    _fetchingConversations = true;
    if (!mounted) {
      _fetchingConversations = false;
      return;
    }
    if (showLoader) setState(() => _loadingConversations = true);

    try {
      final response = await _dio.get(
        '${AppConstants.apiBaseUrl}/candidate/intern-chat/conversations',
        options: Options(
          receiveTimeout: const Duration(seconds: 15),
          sendTimeout: const Duration(seconds: 10),
        ),
      );
      final rawData = response.data;
      final root = _safeMap(rawData);
      final rawItems = root['data'];
      final items = () {
        if (rawItems is List) return _safeList(rawItems);
        final nested = _safeMap(rawItems);
        return _safeList(
            nested['items'] ?? nested['data'] ?? nested['conversations']);
      }();

      final conversationMap = <int, int>{};
      for (final item in items) {
        final appId = _applicationIdFromItem(item);
        final convId = _toInt(item['conversation_id']);
        if (appId != null && convId != null) conversationMap[appId] = convId;
      }
      _conversationIdMap = conversationMap;

      if (_wsConnected) {
        for (final entry in conversationMap.entries) {
          _wsService.subscribeToConversation(entry.value);
        }
      }

      final userIds = items
          .map((item) => _toInt(_safeMap(item['recruiter'])['user_id']))
          .where((id) => id != null)
          .cast<int>()
          .toList();
      if (userIds.isNotEmpty) _loadPresenceStatuses(userIds);

      final selectedNow = _selectedApplicationId;
      int? nextSelected = selectedNow;

      final hasCurrent = nextSelected != null &&
          items.any((item) => _applicationIdFromItem(item) == nextSelected);

      if (!mounted) return;

      bool autoSelect = false;
      if (!_hasInitialLoaded) {
        final isWide = MediaQuery.of(context).size.width >= 920;
        if (isWide && _selectedApplicationId == null) autoSelect = true;
        _hasInitialLoaded = true;
      }

      if (!hasCurrent) {
        if (preselectApplicationId != null &&
            items.any((item) =>
                _applicationIdFromItem(item) == preselectApplicationId)) {
          nextSelected = preselectApplicationId;
        } else if (autoSelect && items.isNotEmpty) {
          nextSelected = _applicationIdFromItem(items.first);
        } else if (selectedNow != null &&
            !items.any((i) => _applicationIdFromItem(i) == selectedNow)) {
          nextSelected =
              items.isNotEmpty ? _applicationIdFromItem(items.first) : null;
        } else {
          nextSelected = selectedNow;
        }
      }

      if (!mounted) return;
      Map<String, dynamic>? nextConversation;
      if (nextSelected != null) {
        for (final item in items) {
          if (_applicationIdFromItem(item) == nextSelected) {
            nextConversation = item;
            break;
          }
        }
      }

      setState(() {
        _error = null;
        _loadingConversations = false;
        _conversations = items;
        _selectedApplicationId = nextSelected;
        _selectedConversation = nextConversation ?? _selectedConversation;
        if (nextSelected == null) {
          _selectedConversation = null;
          _messages = [];
          _loadingMessages = false;
        }
      });
      _hasShownSubscriptionDialogForCurrentLock = false;

      if (nextSelected != null) unawaited(_loadBinomeStatus(nextSelected));

      if (nextSelected != null &&
          (selectedNow != nextSelected || _messages.isEmpty)) {
        await _loadMessages(nextSelected,
            showLoader: showLoader && _messages.isEmpty);
        await _markMessagesAsRead(nextSelected);
      }
    } on DioException catch (e) {
      if (!mounted) return;
      final errorMessage =
          _extractErrorMessage(e, fallback: 'Unable to load conversations.');
      setState(() {
        _loadingConversations = false;
        _error = errorMessage;
      });
      _handleSubscriptionRestrictionError(errorMessage);
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _loadingConversations = false;
        _error = 'Unable to load conversations.';
      });
      _handleSubscriptionRestrictionError(_error ?? '');
    } finally {
      _fetchingConversations = false;
    }
  }

  Future<void> _loadMessages(int applicationId,
      {bool showLoader = false}) async {
    if (_fetchingMessages) return;
    _fetchingMessages = true;
    if (!mounted) {
      _fetchingMessages = false;
      return;
    }
    if (showLoader) setState(() => _loadingMessages = true);

    final requestedApplicationId = applicationId;
    try {
      final response = await _dio.get(
        '${AppConstants.apiBaseUrl}/candidate/intern-chat/conversations/$applicationId/messages',
        options: Options(
          receiveTimeout: const Duration(seconds: 15),
          sendTimeout: const Duration(seconds: 10),
        ),
      );
      final payload = _safeMap(_safeMap(response.data)['data']);
      final conversation = _safeMap(payload['conversation']);
      final messages = _safeList(payload['messages']);

      if (!mounted) return;
      if (_selectedApplicationId != requestedApplicationId) {
        _fetchingMessages = false;
        return;
      }
      setState(() {
        _error = null;
        _loadingMessages = false;
        _messages = messages;
        if (conversation.isNotEmpty) _selectedConversation = conversation;
      });
      _hasShownSubscriptionDialogForCurrentLock = false;
      _scrollToBottomSoon();
    } on DioException catch (e) {
      if (!mounted) return;
      if (_selectedApplicationId != requestedApplicationId) {
        _fetchingMessages = false;
        return;
      }
      final errorMessage =
          _extractErrorMessage(e, fallback: 'Unable to load messages.');
      setState(() {
        _loadingMessages = false;
        _error = errorMessage;
      });
      _handleSubscriptionRestrictionError(errorMessage);
      if (!_isSubscriptionRestrictedMessage(errorMessage)) {
        _showSnack(errorMessage);
      }
    } catch (e) {
      if (!mounted) return;
      if (_selectedApplicationId != requestedApplicationId) {
        _fetchingMessages = false;
        return;
      }
      setState(() {
        _loadingMessages = false;
        _error = 'Unable to load messages.';
      });
      _handleSubscriptionRestrictionError(_error ?? '');
      _showSnack('Unable to load messages. Please try again.');
    } finally {
      _fetchingMessages = false;
    }
  }

  // Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ Actions Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬

  Future<void> _sendMessage() async {
    final applicationId = _selectedApplicationId;
    final text = _messageController.text.trim();
    final attachment = _selectedAttachment;
    if (_sending) return;
    if (applicationId == null) {
      _showSnack('Select a conversation first.');
      return;
    }
    if (text.isEmpty && attachment == null) return;

    setState(() => _sending = true);
    try {
      final formData = FormData.fromMap({
        if (text.isNotEmpty) 'message': text,
        if (attachment != null)
          'attachment': kIsWeb
              ? MultipartFile.fromBytes(
                  attachment.bytes ?? <int>[],
                  filename: attachment.name,
                )
              : await MultipartFile.fromFile(
                  attachment.path!,
                  filename: attachment.name,
                ),
      });

      await _dio.post(
        '${AppConstants.apiBaseUrl}/candidate/intern-chat/conversations/$applicationId/messages',
        data: formData,
      );

      if (!mounted) return;
      _messageController.clear();
      setState(() {
        _sending = false;
        _selectedAttachment = null;
      });

      await _loadMessages(applicationId);
      await _loadConversations();
    } on DioException catch (e) {
      if (!mounted) return;
      setState(() => _sending = false);
      _showSnack(_extractErrorMessage(e, fallback: 'Failed to send message.'));
    } catch (_) {
      if (!mounted) return;
      setState(() => _sending = false);
      _showSnack('Failed to send message.');
    }
  }

  Future<void> _pickAttachment() async {
    try {
      final result = await FilePicker.platform.pickFiles(
        type: FileType.custom,
        allowedExtensions: const ['pdf', 'doc', 'docx'],
        withData: true,
      );
      if (result == null || result.files.isEmpty || !mounted) return;

      final file = result.files.single;
      final extension = _fileExtension(file.name);
      if (extension != 'pdf' && extension != 'doc' && extension != 'docx') {
        _showSnack('Only PDF, DOC, and DOCX files are allowed.');
        return;
      }
      if (file.size > 10 * 1024 * 1024) {
        _showSnack('Attachment must be 10 MB or smaller.');
        return;
      }
      if (kIsWeb && (file.bytes == null || file.bytes!.isEmpty)) {
        _showSnack('Unable to read the selected file.');
        return;
      }
      if (!kIsWeb && (file.path == null || file.path!.isEmpty)) {
        _showSnack('Unable to access the selected file.');
        return;
      }
      setState(() => _selectedAttachment = file);
    } catch (_) {
      _showSnack('Unable to pick attachment.');
    }
  }

  void _clearSelectedAttachment() {
    if (!mounted) return;
    setState(() => _selectedAttachment = null);
  }

  Future<void> _copyAttachmentLink(Map<String, dynamic> attachment) async {
    final url = _string(attachment['download_url']).trim();
    if (url.isEmpty) {
      _showSnack('Attachment link is not available yet.');
      return;
    }
    await Clipboard.setData(ClipboardData(text: url));
    _showSnack('Link copied to clipboard');
  }

  void _selectConversation(Map<String, dynamic> item) {
    if (_sending) return;
    final appId = _applicationIdFromItem(item);
    if (appId == null) {
      _showSnack('Unable to open this chat. Missing application id.');
      return;
    }
    if (_selectedApplicationId == appId) {
      unawaited(_loadMessages(appId));
      return;
    }

    final prevConversationId = _getCurrentConversationId();
    if (prevConversationId != null) {
      _wsService.leaveConversation(prevConversationId);
    }

    setState(() {
      _selectedApplicationId = appId;
      _selectedConversation = item;
      _loadingMessages = true;
      _selectedAttachment = null;
    });

    final convId = _toInt(item['conversation_id']);
    if (convId != null) {
      _conversationIdMap[appId] = convId;
      if (_wsConnected) _wsService.subscribeToConversation(convId);
    }

    unawaited(_loadBinomeStatus(appId));
    unawaited(_loadMessages(appId, showLoader: true));
    unawaited(_markMessagesAsRead(appId));
  }

  Future<void> _markMessagesAsRead(int applicationId) async {
    try {
      await _dio.post(
        '${AppConstants.apiBaseUrl}/candidate/intern-chat/conversations/$applicationId/read',
      );
      setState(() {
        final index = _conversations
            .indexWhere((c) => _applicationIdFromItem(c) == applicationId);
        if (index != -1) _conversations[index]['unread_count'] = 0;
      });
    } catch (e) {
      debugPrint('[Chat] Failed to mark messages as read: $e');
    }
  }

  void _startFallbackPolling() {
    if (_fallbackPollTimer != null) return;
    _fallbackPollTimer = Timer.periodic(const Duration(seconds: 5), (_) {
      if (_wsConnected || !mounted) {
        _stopFallbackPolling();
        return;
      }
      unawaited(_loadConversations());
      final selectedId = _selectedApplicationId;
      if (selectedId != null) unawaited(_loadMessages(selectedId));
    });
  }

  void _stopFallbackPolling() {
    _fallbackPollTimer?.cancel();
    _fallbackPollTimer = null;
  }

  void _handleBackTap(bool isWide) {
    if (!isWide && _selectedApplicationId != null) {
      setState(() {
        _selectedApplicationId = null;
        _selectedConversation = null;
        _messages = [];
        _loadingMessages = false;
      });
      return;
    }
    if (Navigator.of(context).canPop()) Navigator.of(context).pop();
  }

  void _showSnack(String message) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message, style: _t(size: 13, color: Colors.white)),
        backgroundColor: _Colors.textPrimary,
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(borderRadius: _Radius.md),
        margin: const EdgeInsets.all(12),
        duration: const Duration(seconds: 2),
      ),
    );
  }

  void _handleSubscriptionRestrictionError(String message) {
    final isRestricted = _isSubscriptionRestrictedMessage(message);
    if (!isRestricted) {
      _hasShownSubscriptionDialogForCurrentLock = false;
      return;
    }

    if (_subscriptionDialogVisible || _hasShownSubscriptionDialogForCurrentLock) {
      return;
    }

    _hasShownSubscriptionDialogForCurrentLock = true;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted || _subscriptionDialogVisible) return;
      unawaited(_showSubscriptionRequiredDialog());
    });
  }

  Future<void> _showSubscriptionRequiredDialog() async {
    if (!mounted || _subscriptionDialogVisible) return;
    _subscriptionDialogVisible = true;

    try {
      await showGeneralDialog<void>(
        context: context,
        barrierDismissible: true,
        barrierLabel: 'Subscription required',
        barrierColor: Colors.black.withOpacity(0.50),
        transitionDuration: const Duration(milliseconds: 260),
        pageBuilder: (context, _, __) {
          final isWide = MediaQuery.of(context).size.width >= 600;
          return SafeArea(
            child: Center(
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 24),
                child: Material(
                  color: Colors.transparent,
                  child: Container(
                    constraints: BoxConstraints(maxWidth: isWide ? 470 : 380),
                    decoration: BoxDecoration(
                      gradient: const LinearGradient(
                        colors: [
                          Color(0xFFF6FAFF),
                          Color(0xFFFFFFFF),
                          Color(0xFFF3F8FF),
                        ],
                        begin: Alignment.topLeft,
                        end: Alignment.bottomRight,
                      ),
                      borderRadius: BorderRadius.circular(28),
                      border: Border.all(color: _Colors.accent.withOpacity(0.30)),
                      boxShadow: [
                        BoxShadow(
                          color: _Colors.accent.withOpacity(0.22),
                          blurRadius: 38,
                          offset: const Offset(0, 16),
                        ),
                        BoxShadow(
                          color: Colors.black.withOpacity(0.06),
                          blurRadius: 14,
                          offset: const Offset(0, 4),
                        ),
                      ],
                    ),
                    child: Stack(
                      children: [
                        Positioned(
                          right: -34,
                          top: -34,
                          child: Container(
                            width: 140,
                            height: 140,
                            decoration: BoxDecoration(
                              shape: BoxShape.circle,
                              color: _Colors.accent.withOpacity(0.08),
                            ),
                          ),
                        ),
                        Column(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Padding(
                              padding: const EdgeInsets.fromLTRB(20, 16, 20, 18),
                              child: Column(
                                mainAxisSize: MainAxisSize.min,
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Row(
                                    children: [
                                      Container(
                                        width: 56,
                                        height: 56,
                                        decoration: BoxDecoration(
                                          gradient: const LinearGradient(
                                            colors: [
                                              Color(0xFFEAF1FF),
                                              Color(0xFFDCE9FF),
                                            ],
                                            begin: Alignment.topLeft,
                                            end: Alignment.bottomRight,
                                          ),
                                          borderRadius: BorderRadius.circular(16),
                                          border: Border.all(
                                            color: _Colors.accent.withOpacity(0.20),
                                          ),
                                        ),
                                        child: const Icon(
                                          Icons.workspace_premium_rounded,
                                          size: 30,
                                          color: _Colors.accent,
                                        ),
                                      ),
                                      const SizedBox(width: 12),
                                      Expanded(
                                        child: Column(
                                          crossAxisAlignment: CrossAxisAlignment.start,
                                          children: [
                                            Container(
                                              padding: const EdgeInsets.symmetric(
                                                horizontal: 10,
                                                vertical: 4,
                                              ),
                                              decoration: BoxDecoration(
                                                color: _Colors.accentLight,
                                                borderRadius: _Radius.full,
                                              ),
                                              child: Text(
                                                'Premium Access',
                                                style: _t(
                                                  size: 11,
                                                  weight: FontWeight.w700,
                                                  color: _Colors.accent,
                                                  height: 1.2,
                                                ),
                                              ),
                                            ),
                                            const SizedBox(height: 6),
                                            Text(
                                              'Chat System Locked',
                                              style: _t(
                                                size: 19,
                                                weight: FontWeight.w700,
                                                color: _Colors.textPrimary,
                                                height: 1.12,
                                              ),
                                            ),
                                          ],
                                        ),
                                      ),
                                      IconButton(
                                        onPressed: () => Navigator.of(context).pop(),
                                        splashRadius: 20,
                                        icon: const Icon(
                                          Icons.close_rounded,
                                          size: 20,
                                          color: _Colors.textSecondary,
                                        ),
                                      ),
                                    ],
                                  ),
                                  const SizedBox(height: 14),
                                  Text(
                                    'The Chat System feature is not included in the company\'s current subscription plan.',
                                    style: _t(
                                      size: 13,
                                      color: _Colors.textSecondary,
                                      height: 1.5,
                                    ),
                                  ),
                                  const SizedBox(height: 14),
                                  Container(
                                    width: double.infinity,
                                    padding: const EdgeInsets.all(12),
                                    decoration: BoxDecoration(
                                      color: _Colors.white,
                                      borderRadius: _Radius.md,
                                      border: Border.all(
                                        color: _Colors.accent.withOpacity(0.16),
                                      ),
                                    ),
                                    child: Row(
                                      children: [
                                        const Icon(
                                          Icons.admin_panel_settings_outlined,
                                          size: 16,
                                          color: _Colors.accent,
                                        ),
                                        const SizedBox(width: 8),
                                        Expanded(
                                          child: Text(
                                            'Please contact your company administrator for subscription access.',
                                            style: _t(
                                              size: 12,
                                              color: _Colors.textSecondary,
                                              height: 1.35,
                                            ),
                                          ),
                                        ),
                                      ],
                                    ),
                                  ),
                                  const SizedBox(height: 14),
                                  SizedBox(
                                    width: double.infinity,
                                    child: ElevatedButton.icon(
                                      onPressed: () => Navigator.of(context).pop(),
                                      icon: const Icon(Icons.check_rounded, size: 18),
                                      label: Text(
                                        'Understood',
                                        style: _t(
                                          size: 13,
                                          weight: FontWeight.w600,
                                          color: Colors.white,
                                        ),
                                      ),
                                      style: ElevatedButton.styleFrom(
                                        backgroundColor: _Colors.accent,
                                        foregroundColor: Colors.white,
                                        elevation: 0,
                                        padding: const EdgeInsets.symmetric(vertical: 12),
                                        shape: RoundedRectangleBorder(
                                          borderRadius: BorderRadius.circular(12),
                                        ),
                                      ),
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ),
          );
        },
        transitionBuilder: (context, animation, secondaryAnimation, child) {
          final curved = CurvedAnimation(
            parent: animation,
            curve: Curves.easeOutCubic,
            reverseCurve: Curves.easeInCubic,
          );
          return FadeTransition(
            opacity: curved,
            child: ScaleTransition(
              scale: Tween<double>(begin: 0.94, end: 1.0).animate(curved),
              child: child,
            ),
          );
        },
      );
    } finally {
      _subscriptionDialogVisible = false;
    }
  }

  void _scrollToBottomSoon() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!_scrollController.hasClients) return;
      _scrollController.jumpTo(_scrollController.position.maxScrollExtent);
    });
  }

  // Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ Computed Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬

  List<Map<String, dynamic>> get _filteredConversations {
    final q = _searchController.text.trim().toLowerCase();
    final base = _activeFilterTab == 'unread'
        ? _conversations
            .where((item) => (_toInt(item['unread_count']) ?? 0) > 0)
            .toList()
        : _conversations;
    if (q.isEmpty) return base;
    return base.where((item) {
      final recruiter = _recruiterFromItem(item);
      final offer = _safeMap(item['job_offer']);
      final name = _recruiterLabel(recruiter).toLowerCase();
      final email = _string(recruiter['email']).toLowerCase();
      final title = _string(offer['title']).toLowerCase();
      return name.contains(q) || email.contains(q) || title.contains(q);
    }).toList();
  }

  // Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ Build Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬

  @override
  Widget build(BuildContext context) {
    final isWide = MediaQuery.of(context).size.width >= 920;
    final interceptBackToConversationList =
        !isWide && _selectedApplicationId != null;

    final currentConversation = _selectedConversation ?? <String, dynamic>{};
    final offer = _safeMap(currentConversation['job_offer']);
    final offerTitle =
        _string(offer['title']).isNotEmpty ? _string(offer['title']) : 'Chat';
    final companyName = _string(offer['company_name']);

    return PopScope(
      canPop: !interceptBackToConversationList,
      onPopInvokedWithResult: (didPop, _) {
        if (didPop) return;
        if (interceptBackToConversationList) _handleBackTap(isWide);
      },
      child: Scaffold(
        backgroundColor: _Colors.background,
        appBar: _selectedApplicationId != null && !isWide
            ? _buildMobileConversationAppBar(offerTitle, companyName, isWide)
            : _buildMainAppBar(),
        body: isWide
            ? Row(
                children: [
                  SizedBox(width: 340, child: _buildConversationPane()),
                  Container(width: 1, color: _Colors.border),
                  Expanded(child: _buildMessagePane()),
                ],
              )
            : (_selectedApplicationId == null
                ? _buildConversationPane()
                : _buildMessagePane()),
      ),
    );
  }

  PreferredSizeWidget _buildMainAppBar() {
    final canPop = Navigator.of(context).canPop();
    return AppBar(
      elevation: 0,
      backgroundColor: _Colors.surface,
      surfaceTintColor: Colors.transparent,
      automaticallyImplyLeading: false,
      leadingWidth: canPop ? 58 : null,
      leading: canPop
          ? _buildStyledBackButton(
              onPressed: () => Navigator.of(context).pop(),
            )
          : null,
      titleSpacing: canPop ? 8 : 16,
      title: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Messages',
            style: _t(
              size: 17,
              weight: FontWeight.w700,
              color: _Colors.textPrimary,
              height: 1.1,
            ),
          ),
          Text(
            'Conversation List',
            style: _t(
              size: 11,
              color: _Colors.textSecondary,
              weight: FontWeight.w500,
              height: 1.2,
            ),
          ),
        ],
      ),
      bottom: PreferredSize(
        preferredSize: const Size.fromHeight(1),
        child: Container(height: 1, color: _Colors.border),
      ),
    );
  }

  Widget _buildStyledBackButton({required VoidCallback onPressed}) {
    return Padding(
      padding: const EdgeInsets.only(left: 8),
      child: IconButton(
        onPressed: onPressed,
        padding: EdgeInsets.zero,
        splashRadius: 22,
        icon: Container(
          padding: const EdgeInsets.all(10),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(14),
            border: Border.all(
              color: _Colors.border,
              width: 1,
            ),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withOpacity(0.05),
                blurRadius: 8,
                offset: const Offset(0, 2),
              ),
            ],
          ),
          child: const Icon(
            Icons.arrow_back_ios_new_rounded,
            size: 18,
            color: _Colors.textPrimary,
          ),
        ),
      ),
    );
  }

  PreferredSizeWidget _buildMobileConversationAppBar(
      String title, String subtitle, bool isWide) {
    final currentConversation = _selectedConversation ?? <String, dynamic>{};
    final recruiter = _recruiterFromItem(currentConversation);
    final recruiterPresence = _getRecruiterPresence(recruiter);
    final isOnline = recruiterPresence?.isOnline ?? false;

    return AppBar(
      elevation: 0,
      backgroundColor: _Colors.surface,
      surfaceTintColor: Colors.transparent,
      leadingWidth: 58,
      leading: _buildStyledBackButton(
        onPressed: () => _handleBackTap(isWide),
      ),
      title: Row(
        children: [
          Stack(
            children: [
              _buildAvatar(recruiter, 18),
              Positioned(
                right: 0,
                bottom: 0,
                child: Container(
                  width: 10,
                  height: 10,
                  decoration: BoxDecoration(
                    color: isOnline ? _Colors.online : _Colors.textTertiary,
                    shape: BoxShape.circle,
                    border: Border.all(color: _Colors.surface, width: 1.5),
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title,
                    style: _t(
                        size: 14,
                        weight: FontWeight.w600,
                        color: _Colors.textPrimary,
                        height: 1.2),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis),
                if (subtitle.isNotEmpty) ...[
                  const SizedBox(height: 1),
                  Text(subtitle,
                      style: _t(size: 12, color: _Colors.textSecondary, height: 1.2),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis),
                ],
              ],
            ),
          ),
        ],
      ),
      actions: [
        if (_selectedApplicationId != null) ...[
          if (_canInviteCurrentConversationBinome()) ...[
            IconButton(
              onPressed: () => _showInviteDialog(context),
              icon: const Icon(Icons.add_circle_outline_rounded, size: 20),
              color: _Colors.textSecondary,
              tooltip: 'Invite binome',
            ),
          ],
          const SizedBox(width: 4),
          // Member Icon
          IconButton(
            onPressed: _navigateToMembersPage,
            icon: const Icon(Icons.group_outlined, size: 20),
            color: _Colors.textSecondary,
            tooltip: 'View members',
          ),
        ],
      ],
      bottom: PreferredSize(
        preferredSize: const Size.fromHeight(1),
        child: Container(height: 1, color: _Colors.border),
      ),
    );
  }

  // Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ Conversation pane Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬

  Widget _buildConversationPane() {
    if (_loadingConversations) {
      return const Center(
        child: CircularProgressIndicator(
          valueColor: AlwaysStoppedAnimation<Color>(_Colors.accent),
          strokeWidth: 2,
        ),
      );
    }

    if (_error != null && _conversations.isEmpty) {
      return _buildConversationErrorState(_error!);
    }

    final items = _filteredConversations;

    return Container(
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          colors: [_Colors.surface, Color(0xFFF8FAFF)],
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
        ),
      ),
      child: Column(
        children: [
          _buildConversationPaneHeader(),
          Expanded(
            child: items.isEmpty ? _buildEmptyState() : _buildConversationList(items),
          ),
        ],
      ),
    );
  }

  Widget _buildConversationPaneHeader() {
    final totalUnread =
        _conversations.fold<int>(0, (sum, c) => sum + (_toInt(c['unread_count']) ?? 0));

    return Column(
      children: [
        // Search bar
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 14, 16, 12),
          child: Container(
            height: 44,
            decoration: BoxDecoration(
              color: _Colors.white,
              borderRadius: _Radius.full,
              border: Border.all(color: _Colors.border),
              boxShadow: [
                BoxShadow(
                  color: _Colors.accent.withOpacity(0.05),
                  blurRadius: 10,
                  offset: const Offset(0, 4),
                ),
              ],
            ),
            child: TextField(
              controller: _searchController,
              style: _t(size: 14, color: _Colors.textPrimary),
              decoration: InputDecoration(
                prefixIcon: const Padding(
                  padding: EdgeInsets.only(left: 14, right: 8),
                  child: Icon(Icons.search_rounded,
                      size: 18, color: _Colors.textTertiary),
                ),
                prefixIconConstraints:
                    const BoxConstraints(minWidth: 0, minHeight: 0),
                hintText: 'Search conversations...',
                hintStyle: _t(size: 14, color: _Colors.textTertiary),
                border: InputBorder.none,
                contentPadding:
                    const EdgeInsets.symmetric(vertical: 10, horizontal: 0),
              ),
            ),
          ),
        ),
        // Filter tabs
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              _filterTab('all', 'All'),
              const SizedBox(width: 8),
              _filterTab(
                'unread',
                totalUnread > 0 ? 'Unread - $totalUnread' : 'Unread',
              ),
            ],
          ),
        ),
        Container(height: 1, color: _Colors.borderLight),
      ],
    );
  }
  Widget _filterTab(String key, String label) {
    final active = _activeFilterTab == key;
    return GestureDetector(
      onTap: () => setState(() => _activeFilterTab = key),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 150),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
        decoration: BoxDecoration(
          color: active ? _Colors.accentLight : Colors.transparent,
          borderRadius: _Radius.full,
        ),
        child: Text(
          label,
          style: _t(
            size: 13,
            weight: active ? FontWeight.w600 : FontWeight.w400,
            color: active ? _Colors.accent : _Colors.textSecondary,
          ),
        ),
      ),
    );
  }

  Widget _buildEmptyState() {
    return Center(
      child: Container(
        margin: const EdgeInsets.all(18),
        padding: const EdgeInsets.fromLTRB(20, 20, 20, 18),
        decoration: BoxDecoration(
          color: _Colors.white,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: _Colors.border),
          boxShadow: [
            BoxShadow(
              color: _Colors.accent.withOpacity(0.06),
              blurRadius: 16,
              offset: const Offset(0, 6),
            ),
          ],
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 58,
              height: 58,
              decoration: BoxDecoration(
                color: _Colors.accentLight,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: _Colors.accent.withOpacity(0.15)),
              ),
              child: const Icon(
                Icons.chat_outlined,
                size: 28,
                color: _Colors.accent,
              ),
            ),
            const SizedBox(height: 14),
            Text(
              _activeFilterTab == 'unread'
                  ? 'All caught up!'
                  : 'No conversations yet',
              style: _t(
                size: 16,
                weight: FontWeight.w600,
                color: _Colors.textPrimary,
              ),
            ),
            const SizedBox(height: 5),
            Text(
              _activeFilterTab == 'unread'
                  ? 'You have no unread messages right now.'
                  : 'Once recruiters message you, they appear here.',
              textAlign: TextAlign.center,
              style: _t(size: 13, color: _Colors.textSecondary, height: 1.4),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildConversationErrorState(String errorText) {
    if (_isSubscriptionRestrictedMessage(errorText)) {
      final isWide = MediaQuery.of(context).size.width >= 920;
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(18),
          child: ConstrainedBox(
            constraints: BoxConstraints(maxWidth: isWide ? 500 : 380),
            child: Container(
              padding: const EdgeInsets.fromLTRB(18, 18, 18, 16),
              decoration: BoxDecoration(
                color: _Colors.surface,
                borderRadius: _Radius.xl,
                border: Border.all(color: _Colors.border),
              ),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Container(
                        width: 42,
                        height: 42,
                        decoration: BoxDecoration(
                          color: _Colors.accentLight,
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: const Icon(
                          Icons.lock_outline_rounded,
                          size: 22,
                          color: _Colors.accent,
                        ),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Text(
                          'Chat System is locked for this plan.',
                          style: _t(
                            size: 14,
                            weight: FontWeight.w600,
                            color: _Colors.textPrimary,
                            height: 1.25,
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 10),
                  Text(
                    'The Chat System feature is not included in the company\'s current subscription plan.',
                    style: _t(size: 12, color: _Colors.textSecondary, height: 1.4),
                  ),
                  const SizedBox(height: 12),
                  SizedBox(
                    width: double.infinity,
                    child: OutlinedButton.icon(
                      onPressed: () {
                        if (_subscriptionDialogVisible) return;
                        unawaited(_showSubscriptionRequiredDialog());
                      },
                      icon: const Icon(Icons.workspace_premium_rounded, size: 16),
                      label: Text(
                        'Open Details Dialog',
                        style: _t(
                          size: 12,
                          weight: FontWeight.w600,
                          color: _Colors.accent,
                        ),
                      ),
                      style: OutlinedButton.styleFrom(
                        foregroundColor: _Colors.accent,
                        side: BorderSide(color: _Colors.accent.withOpacity(0.28)),
                        padding: const EdgeInsets.symmetric(vertical: 11),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(12),
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      );
    }

    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.wifi_off_rounded, size: 40, color: _Colors.textTertiary),
            const SizedBox(height: 12),
            Text(
              errorText,
              textAlign: TextAlign.center,
              style: _t(size: 14, color: _Colors.textSecondary),
            ),
          ],
        ),
      ),
    );
  }

  bool _isSubscriptionRestrictedMessage(String message) {
    final normalized = message.toLowerCase();
    return normalized.contains('chat system') &&
        normalized.contains('subscription') &&
        (normalized.contains('upgrade') ||
            normalized.contains('not included in your current subscription'));
  }

  Widget _buildConversationList(List<Map<String, dynamic>> items) {
    return ListView.builder(
      padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 8),
      itemCount: items.length,
      itemBuilder: (context, index) {
        final item = items[index];
        final recruiter = _recruiterFromItem(item);
        final offer = _safeMap(item['job_offer']);
        final lastMessage = _safeMap(item['last_message']);
        final lastPreview = _conversationPreview(lastMessage);
        final appId = _applicationIdFromItem(item);
        final selected = appId != null && appId == _selectedApplicationId;
        final unreadCount = _toInt(item['unread_count']) ?? 0;
        final recruiterPresence = _getRecruiterPresence(recruiter);
        final isOnline = recruiterPresence?.isOnline ?? false;
        final hasAttachment = _safeMap(lastMessage['attachment']).isNotEmpty;

        return TweenAnimationBuilder<double>(
          tween: Tween(begin: 0.0, end: 1.0),
          duration: Duration(milliseconds: 300 + (index * 50)),
          curve: Curves.easeOutCubic,
          builder: (context, value, child) {
            return Transform.translate(
              offset: Offset(0, 20 * (1 - value)),
              child: Opacity(
                opacity: value,
                child: child,
              ),
            );
          },
          child: _buildConversationTile(
            recruiter: recruiter,
            offer: offer,
            lastPreview: lastPreview,
            lastMessage: lastMessage,
            unreadCount: unreadCount,
            isOnline: isOnline,
            isSelected: selected,
            hasAttachment: hasAttachment,
            onTap: () => _selectConversation(item),
          ),
        );
      },
    );
  }

  Widget _buildConversationTile({
    required Map<String, dynamic> recruiter,
    required Map<String, dynamic> offer,
    required String lastPreview,
    required Map<String, dynamic> lastMessage,
    required int unreadCount,
    required bool isOnline,
    required bool isSelected,
    required bool hasAttachment,
    required VoidCallback onTap,
  }) {
    return AnimatedContainer(
      duration: const Duration(milliseconds: 200),
      curve: Curves.easeOutCubic,
      margin: const EdgeInsets.symmetric(horizontal: 4, vertical: 4),
      decoration: BoxDecoration(
        color: isSelected ? _Colors.accentLight : _Colors.surface,
        borderRadius: _Radius.lg,
        border: Border.all(
          color: isSelected ? _Colors.accent.withOpacity(0.3) : _Colors.borderLight,
          width: isSelected ? 1.5 : 1,
        ),
        boxShadow: isSelected
            ? [
                BoxShadow(
                  color: _Colors.accent.withOpacity(0.08),
                  blurRadius: 12,
                  offset: const Offset(0, 4),
                ),
              ]
            : [
                BoxShadow(
                  color: Colors.black.withOpacity(0.02),
                  blurRadius: 4,
                  offset: const Offset(0, 2),
                ),
              ],
      ),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: onTap,
          borderRadius: _Radius.lg,
          child: AnimatedPadding(
            duration: const Duration(milliseconds: 200),
            padding: EdgeInsets.symmetric(
              horizontal: 16,
              vertical: isSelected ? 16 : 14,
            ),
            child: Row(
              children: [
                // Avatar with animated online status
                Stack(
                  children: [
                    AnimatedContainer(
                      duration: const Duration(milliseconds: 300),
                      curve: Curves.easeOutCubic,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        boxShadow: isSelected
                            ? [
                                BoxShadow(
                                  color: _Colors.accent.withOpacity(0.2),
                                  blurRadius: 8,
                                  spreadRadius: 2,
                                ),
                              ]
                            : [],
                      ),
                      child: _buildAvatar(recruiter, 24),
                    ),
                    Positioned(
                      right: 0,
                      bottom: 0,
                      child: AnimatedContainer(
                        duration: const Duration(milliseconds: 300),
                        width: 12,
                        height: 12,
                        decoration: BoxDecoration(
                          color: isOnline ? _Colors.online : _Colors.textTertiary,
                          shape: BoxShape.circle,
                          border: Border.all(color: _Colors.surface, width: 2),
                          boxShadow: isOnline
                              ? [
                                  BoxShadow(
                                    color: _Colors.online.withOpacity(0.4),
                                    blurRadius: 6,
                                    spreadRadius: 1,
                                  ),
                                ]
                              : [],
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(width: 14),
                // Content
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Expanded(
                            child: Text(
                              _recruiterLabel(recruiter),
                              style: _t(
                                size: 14,
                                weight: unreadCount > 0
                                    ? FontWeight.w600
                                    : FontWeight.w500,
                                color: _Colors.textPrimary,
                                height: 1.2,
                              ),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                          const SizedBox(width: 8),
                          AnimatedDefaultTextStyle(
                            duration: const Duration(milliseconds: 200),
                            style: _t(
                              size: 11,
                              color: unreadCount > 0
                                  ? _Colors.accent
                                  : _Colors.textTertiary,
                              weight: unreadCount > 0
                                  ? FontWeight.w500
                                  : FontWeight.w400,
                            ),
                            child: Text(
                              _formatMessageTime(
                                  _string(lastMessage['created_at'])),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 3),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                        decoration: BoxDecoration(
                          color: isSelected
                              ? _Colors.accent.withOpacity(0.12)
                              : _Colors.accentLight,
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: Text(
                          _string(offer['title']).isNotEmpty
                              ? _string(offer['title'])
                              : 'Internship',
                          style: _t(
                            size: 11,
                            color: _Colors.accent,
                            weight: FontWeight.w600,
                            height: 1.2,
                          ),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                      const SizedBox(height: 7),
                      Row(
                        children: [
                          if (hasAttachment) ...[
                            Icon(Icons.attach_file_rounded,
                                size: 12,
                                color: isSelected
                                    ? _Colors.accentMuted
                                    : _Colors.textTertiary),
                            const SizedBox(width: 3),
                          ],
                          Expanded(
                            child: Text(
                              lastPreview.isNotEmpty
                                  ? lastPreview
                                  : 'Start the conversation',
                              style: _t(
                                size: 13,
                                color: unreadCount > 0
                                    ? _Colors.textPrimary
                                    : _Colors.textSecondary,
                                weight: unreadCount > 0
                                    ? FontWeight.w500
                                    : FontWeight.w400,
                              ),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                          if (unreadCount == 0) ...[
                            const SizedBox(width: 6),
                            Icon(
                              Icons.chevron_right_rounded,
                              size: 16,
                              color: _Colors.textTertiary,
                            ),
                          ],
                          if (unreadCount > 0) ...[
                            const SizedBox(width: 8),
                            TweenAnimationBuilder<double>(
                              tween: Tween(begin: 0.5, end: 1.0),
                              duration: const Duration(milliseconds: 400),
                              curve: Curves.elasticOut,
                              builder: (context, scale, child) {
                                return Transform.scale(
                                  scale: scale,
                                  child: child,
                                );
                              },
                              child: Container(
                                padding: const EdgeInsets.symmetric(
                                    horizontal: 8, vertical: 4),
                                decoration: BoxDecoration(
                                  gradient: const LinearGradient(
                                    colors: [_Colors.accent, _Colors.accentMuted],
                                    begin: Alignment.topLeft,
                                    end: Alignment.bottomRight,
                                  ),
                                  borderRadius: _Radius.full,
                                  boxShadow: [
                                    BoxShadow(
                                      color: _Colors.accent.withOpacity(0.3),
                                      blurRadius: 6,
                                      offset: const Offset(0, 2),
                                    ),
                                  ],
                                ),
                                child: Text(
                                  unreadCount > 99 ? '99+' : '$unreadCount',
                                  style: _t(
                                      size: 11,
                                      weight: FontWeight.w600,
                                      color: Colors.white,
                                      height: 1.2),
                                ),
                              ),
                            ),
                          ],
                        ],
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

  // Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ Message pane Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬

  Widget _buildMessagePane() {
    final isWide = MediaQuery.of(context).size.width >= 920;
    final applicationId = _selectedApplicationId;

    if (applicationId == null) {
      return Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 64,
              height: 64,
              decoration: BoxDecoration(
                color: _Colors.background,
                borderRadius: _Radius.xl,
                border: Border.all(color: _Colors.border),
              ),
              child: const Icon(Icons.chat_bubble_outline_rounded,
                  size: 28, color: _Colors.textTertiary),
            ),
            const SizedBox(height: 16),
            Text('Select a conversation',
                style: _t(
                    size: 16,
                    weight: FontWeight.w500,
                    color: _Colors.textSecondary)),
            const SizedBox(height: 4),
            Text('Choose from the list to start chatting.',
                style: _t(size: 13, color: _Colors.textTertiary)),
          ],
        ),
      );
    }

    final currentConversation = _selectedConversation ?? <String, dynamic>{};
    final recruiter = _recruiterFromItem(currentConversation);
    final offer = _safeMap(currentConversation['job_offer']);
    final candidate = _safeMap(currentConversation['candidate']);
    final binome = _safeMap(currentConversation['binome']);
    final offerTitle =
        _string(offer['title']).isNotEmpty ? _string(offer['title']) : 'Internship';
    final companyName = _string(offer['company_name']);
    final recruiterPresence = _getRecruiterPresence(recruiter);
    final isOnline = recruiterPresence?.isOnline ?? false;

    return Column(
      children: [
        // Wide layout header
        if (isWide) _buildMessagePaneHeader(
          recruiter: recruiter,
          offerTitle: offerTitle,
          companyName: companyName,
          isOnline: isOnline,
          candidate: candidate,
          binome: binome,
        ),

        // Messages + Input
        Expanded(
          child: Column(
            children: [
              Expanded(child: _buildMessagesList()),
              _buildMessageInput(),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildMessagePaneHeader({
    required Map<String, dynamic> recruiter,
    required String offerTitle,
    required String companyName,
    required bool isOnline,
    required Map<String, dynamic> candidate,
    required Map<String, dynamic> binome,
  }) {
    return Container(
      color: _Colors.surface,
      padding: const EdgeInsets.fromLTRB(20, 14, 16, 14),
      child: Row(
        children: [
          Stack(
            children: [
              _buildAvatar(recruiter, 20),
              Positioned(
                right: 0,
                bottom: 0,
                child: Container(
                  width: 11,
                  height: 11,
                  decoration: BoxDecoration(
                    color: isOnline ? _Colors.online : _Colors.textTertiary,
                    shape: BoxShape.circle,
                    border: Border.all(color: _Colors.surface, width: 1.5),
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  offerTitle,
                  style: _t(
                      size: 15,
                      weight: FontWeight.w600,
                      color: _Colors.textPrimary,
                      height: 1.2),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
                const SizedBox(height: 2),
                Row(
                  children: [
                    if (isOnline)
                      Container(
                        width: 6,
                        height: 6,
                        margin: const EdgeInsets.only(right: 5),
                        decoration: const BoxDecoration(
                          color: _Colors.online,
                          shape: BoxShape.circle,
                        ),
                      ),
                    Text(
                      isOnline
                          ? 'Online'
                          : (companyName.isNotEmpty
                              ? companyName
                              : _recruiterLabel(recruiter)),
                      style: _t(
                          size: 12,
                          color: isOnline
                              ? _Colors.online
                              : _Colors.textSecondary),
                    ),
                  ],
                ),
              ],
            ),
          ),
          // Members button
          if (candidate.isNotEmpty || binome.isNotEmpty)
            TextButton.icon(
              onPressed: _navigateToMembersPage,
              icon: const Icon(Icons.people_outline_rounded, size: 16),
              label: Text('Members',
                  style: _t(
                      size: 13,
                      weight: FontWeight.w500,
                      color: _Colors.textSecondary)),
              style: TextButton.styleFrom(
                foregroundColor: _Colors.textSecondary,
                padding:
                    const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                shape: RoundedRectangleBorder(
                  borderRadius: _Radius.md,
                  side: const BorderSide(color: _Colors.border),
                ),
              ),
            ),
          if (_canInviteCurrentConversationBinome()) ...[
            const SizedBox(width: 2),
            IconButton(
              onPressed: () => _showInviteDialog(context),
              icon: const Icon(Icons.add_circle_outline_rounded, size: 20),
              color: _Colors.textSecondary,
              tooltip: 'Invite binome',
            ),
          ],
          const SizedBox(width: 4),
          IconButton(
            onPressed: _navigateToMembersPage,
            icon: const Icon(Icons.more_vert_rounded, size: 20),
            color: _Colors.textSecondary,
            tooltip: 'Options',
          ),
        ],
      ),
    );
  }

  Widget _buildMessagesList() {
    if (_loadingMessages) {
      return const Center(
        child: CircularProgressIndicator(
          valueColor: AlwaysStoppedAnimation<Color>(_Colors.accent),
          strokeWidth: 2,
        ),
      );
    }
    if (_messages.isEmpty) {
      return Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.chat_bubble_outline_rounded,
                size: 36, color: _Colors.textTertiary),
            const SizedBox(height: 12),
            Text('No messages yet',
                style:
                    _t(size: 15, weight: FontWeight.w500, color: _Colors.textSecondary)),
            const SizedBox(height: 4),
            Text('Say hello to start the conversation.',
                style: _t(size: 13, color: _Colors.textTertiary)),
          ],
        ),
      );
    }

    return ListView.builder(
        controller: _scrollController,
        padding: const EdgeInsets.fromLTRB(16, 20, 16, 8),
        itemCount: _messages.length,
        itemBuilder: (context, index) {
          final message = _messages[index];
          final isMine = message['is_mine'] == true;
          final attachment = _safeMap(message['attachment']);
          final isRead = message['read_at'] != null;

          // Show date separator if needed
          final showDate = index == 0 ||
              _isDifferentDay(
                _string(_messages[index - 1]['created_at']),
                _string(message['created_at']),
              );

          return Column(
            children: [
              if (showDate)
                _buildDateSeparator(_string(message['created_at'])),
              _buildMessageBubble(
                message: message,
                isMine: isMine,
                attachment: attachment,
                isRead: isRead,
              ),
            ],
          );
        },
      );
  }

  bool _isDifferentDay(String isoA, String isoB) {
    if (isoA.isEmpty || isoB.isEmpty) return false;
    try {
      final a = DateTime.parse(isoA).toLocal();
      final b = DateTime.parse(isoB).toLocal();
      return a.year != b.year || a.month != b.month || a.day != b.day;
    } catch (_) {
      return false;
    }
  }

  Widget _buildDateSeparator(String isoString) {
    String label = '';
    try {
      final dt = DateTime.parse(isoString).toLocal();
      final now = DateTime.now();
      final diff = DateTime(now.year, now.month, now.day)
          .difference(DateTime(dt.year, dt.month, dt.day))
          .inDays;
      if (diff == 0) {
        label = 'Today';
      } else if (diff == 1) {
        label = 'Yesterday';
      } else {
        label = '${dt.day} ${_getMonthAbbrev(dt.month)} ${dt.year}';
      }
    } catch (_) {
      return const SizedBox.shrink();
    }

    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 16),
      child: Row(
        children: [
          const Expanded(child: Divider(color: _Colors.border, height: 1)),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 12),
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
              decoration: BoxDecoration(
                color: _Colors.surface,
                borderRadius: BorderRadius.circular(12),
              ),
              child: Text(label,
                  style: _t(size: 11, color: _Colors.textTertiary, weight: FontWeight.w500,
                      letterSpacing: 0.3)),
            ),
          ),
          const Expanded(child: Divider(color: _Colors.border, height: 1)),
        ],
      ),
    );
  }

  Widget _buildMessageBubble({
    required Map<String, dynamic> message,
    required bool isMine,
    required Map<String, dynamic> attachment,
    required bool isRead,
  }) {
    final text = _string(message['message']).trim();
    final senderName = _messageSenderName(message, isMine: isMine);
    final screenWidth = MediaQuery.of(context).size.width;
    final maxBubbleWidth = (screenWidth * (screenWidth < 520 ? 0.78 : 0.64))
        .clamp(260.0, 380.0)
        .toDouble();
    final bubbleGradient = isMine
        ? const LinearGradient(
            colors: [_Colors.accent, _Colors.accentMuted],
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
          )
        : null;

    return Padding(
      padding: EdgeInsets.only(
        bottom: 6,
        left: isMine ? 64 : 0,
        right: isMine ? 0 : 64,
      ),
      child: Align(
        alignment: isMine ? Alignment.centerRight : Alignment.centerLeft,
        child: Column(
          crossAxisAlignment:
              isMine ? CrossAxisAlignment.end : CrossAxisAlignment.start,
          children: [
            Container(
              constraints: BoxConstraints(maxWidth: maxBubbleWidth),
              decoration: BoxDecoration(
                color: isMine ? null : _Colors.surfaceElevated,
                gradient: bubbleGradient,
                borderRadius: BorderRadius.only(
                  topLeft: const Radius.circular(20),
                  topRight: const Radius.circular(20),
                  bottomLeft: Radius.circular(isMine ? 20 : 6),
                  bottomRight: Radius.circular(isMine ? 6 : 20),
                ),
                border: Border.all(
                  color: isMine
                      ? Colors.white.withOpacity(0.18)
                      : _Colors.border.withOpacity(0.9),
                  width: 1,
                ),
                boxShadow: [
                  BoxShadow(
                    color: isMine
                        ? _Colors.accent.withOpacity(0.20)
                        : Colors.black.withOpacity(0.05),
                    blurRadius: isMine ? 14 : 10,
                    offset: const Offset(0, 4),
                  ),
                ],
              ),
              padding: const EdgeInsets.fromLTRB(14, 11, 14, 10),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    senderName,
                    style: _t(
                      size: 11,
                      weight: FontWeight.w700,
                      color: isMine
                          ? Colors.white.withOpacity(0.86)
                          : _Colors.textSecondary,
                      letterSpacing: 0.2,
                    ),
                  ),
                  if (text.isNotEmpty || attachment.isNotEmpty) const SizedBox(height: 5),
                  if (text.isNotEmpty)
                    Text(
                      text,
                      style: _t(
                        size: 14,
                        color: isMine
                            ? _Colors.bubbleSelfText
                            : _Colors.bubbleOtherText,
                        height: 1.5,
                      ),
                    ),
                  if (attachment.isNotEmpty) ...[
                    if (text.isNotEmpty) const SizedBox(height: 10),
                    _buildAttachmentPreview(attachment, isMine),
                  ],
                ],
              ),
            ),
            Padding(
              padding: const EdgeInsets.only(top: 4, left: 4, right: 4),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    _formatTime(_string(message['created_at'])),
                    style: _t(
                      size: 11,
                      color: _Colors.textTertiary,
                      weight: FontWeight.w500,
                    ),
                  ),
                  if (isMine) ...[
                    const SizedBox(width: 4),
                    Icon(
                      isRead
                          ? Icons.done_all_rounded
                          : Icons.done_rounded,
                      size: 12,
                      color: isRead ? _Colors.accent : _Colors.textTertiary,
                    ),
                  ],
                ],
              ),
            ),
            const SizedBox(height: 6),
          ],
        ),
      ),
    );
  }

  Widget _buildAttachmentPreview(
      Map<String, dynamic> attachment, bool isMine) {
    return GestureDetector(
      onTap: () => _copyAttachmentLink(attachment),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 9),
        decoration: BoxDecoration(
          color: isMine
              ? Colors.white.withOpacity(0.14)
              : Colors.white,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(
            color: isMine
                ? Colors.white.withOpacity(0.26)
                : _Colors.accent.withOpacity(0.20),
          ),
          boxShadow: isMine
              ? null
              : [
                  BoxShadow(
                    color: _Colors.accent.withOpacity(0.08),
                    blurRadius: 10,
                    offset: const Offset(0, 4),
                  ),
                ],
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 28,
              height: 28,
              decoration: BoxDecoration(
                color: isMine
                    ? Colors.white.withOpacity(0.16)
                    : _Colors.accentLight,
                borderRadius: BorderRadius.circular(8),
              ),
              child: Icon(
                Icons.insert_drive_file_outlined,
                size: 16,
                color: isMine ? Colors.white.withOpacity(0.92) : _Colors.accent,
              ),
            ),
            const SizedBox(width: 9),
            Flexible(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    _string(attachment['original_name']),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: _t(
                      size: 12,
                      weight: FontWeight.w600,
                      color: isMine ? Colors.white : _Colors.textPrimary,
                    ),
                  ),
                  const SizedBox(height: 1),
                  Text(
                    _attachmentLabel(attachment),
                    style: _t(
                      size: 11,
                      color: isMine
                          ? Colors.white.withOpacity(0.7)
                          : _Colors.textSecondary,
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(width: 6),
            Icon(
              Icons.copy_rounded,
              size: 14,
              color: isMine ? Colors.white.withOpacity(0.7) : _Colors.textTertiary,
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildMessageInput() {
    final hasContent = _messageController.text.trim().isNotEmpty ||
        _selectedAttachment != null;

    return Container(
      color: _Colors.surface,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(height: 1, color: _Colors.border),
          // Attachment preview
          if (_selectedAttachment != null)
            Container(
              margin: const EdgeInsets.fromLTRB(16, 12, 16, 0),
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
              decoration: BoxDecoration(
                color: _Colors.accentLight,
                borderRadius: _Radius.md,
                border: Border.all(color: _Colors.accent.withOpacity(0.2)),
              ),
              child: Row(
                children: [
                  const Icon(Icons.attach_file_rounded,
                      size: 16, color: _Colors.accent),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          _selectedAttachment!.name,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: _t(
                              size: 13,
                              weight: FontWeight.w500,
                              color: _Colors.textPrimary),
                        ),
                        Text(
                          _selectedAttachmentLabel(),
                          style: _t(size: 11, color: _Colors.textSecondary),
                        ),
                      ],
                    ),
                  ),
                  GestureDetector(
                    onTap: _sending ? null : _clearSelectedAttachment,
                    child: const Icon(Icons.close_rounded,
                        size: 16, color: _Colors.textTertiary),
                  ),
                ],
              ),
            ),

          // Input row
          SafeArea(
            top: false,
            child: Padding(
              padding: const EdgeInsets.fromLTRB(12, 10, 12, 12),
              child: Container(
                decoration: BoxDecoration(
                  color: _Colors.background,
                  borderRadius: _Radius.xl,
                  border: Border.all(color: _Colors.border),
                ),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    // Attachment button
                    Padding(
                      padding: const EdgeInsets.fromLTRB(6, 8, 0, 8),
                      child: IconButton(
                        constraints: const BoxConstraints.tightFor(width: 36, height: 36),
                        padding: EdgeInsets.zero,
                        splashRadius: 18,
                        tooltip: _selectedAttachment == null
                            ? 'Attach file'
                            : 'Change attachment',
                        onPressed: _sending ? null : _pickAttachment,
                        icon: Icon(
                          Icons.attach_file_rounded,
                          size: 20,
                          color: _selectedAttachment != null
                              ? _Colors.accent
                              : _Colors.textSecondary,
                        ),
                      ),
                    ),
                    // Text field
                    Expanded(
                      child: TextField(
                        controller: _messageController,
                        focusNode: _inputFocusNode,
                        minLines: 1,
                        maxLines: 5,
                        textInputAction: TextInputAction.send,
                        onSubmitted: (_) => _sendMessage(),
                        style:
                            _t(size: 14, color: _Colors.textPrimary, height: 1.4),
                        decoration: InputDecoration(
                          hintText: 'Write a messageÃ¢â‚¬Â¦',
                          hintStyle:
                              _t(size: 14, color: _Colors.textTertiary, height: 1.4),
                          filled: false,
                          border: InputBorder.none,
                          contentPadding: const EdgeInsets.fromLTRB(12, 12, 12, 12),
                        ),
                      ),
                    ),
                    // Send button
                    Padding(
                      padding: const EdgeInsets.fromLTRB(0, 8, 8, 8),
                      child: GestureDetector(
                        onTap: (_sending || !hasContent) ? null : _sendMessage,
                        child: AnimatedContainer(
                          duration: const Duration(milliseconds: 200),
                          width: 36,
                          height: 36,
                          decoration: BoxDecoration(
                            color: hasContent && !_sending
                                ? _Colors.accent
                                : _Colors.border,
                            borderRadius: _Radius.full,
                          ),
                          child: _sending
                              ? const Center(
                                  child: SizedBox(
                                    width: 16,
                                    height: 16,
                                    child: CircularProgressIndicator(
                                      strokeWidth: 2,
                                      valueColor: AlwaysStoppedAnimation<Color>(
                                          Colors.white),
                                    ),
                                  ),
                                )
                              : const Icon(Icons.arrow_upward_rounded,
                                  size: 18, color: Colors.white),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  // Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ Avatar Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬

  Widget _buildAvatar(Map<String, dynamic> recruiter, double radius) {
    final pictureUrl = _string(recruiter['picture']);
    final label = _recruiterLabel(recruiter);
    final letter = label.isNotEmpty ? label[0].toUpperCase() : '?';

    if (pictureUrl.isNotEmpty) {
      return ClipOval(
        child: Image.network(
          pictureUrl,
          width: radius * 2,
          height: radius * 2,
          fit: BoxFit.cover,
          errorBuilder: (_, __, ___) => _fallbackAvatar(letter, radius),
        ),
      );
    }
    return _fallbackAvatar(letter, radius);
  }

  Widget _fallbackAvatar(String letter, double radius) {
    // Generate a consistent color from the letter
    final colors = [
      const Color(0xFF3B5BDB),
      const Color(0xFF0EA5E9),
      const Color(0xFF8B5CF6),
      const Color(0xFF059669),
      const Color(0xFFD97706),
      const Color(0xFFDC2626),
    ];
    final color = colors[letter.codeUnitAt(0) % colors.length];

    return Container(
      width: radius * 2,
      height: radius * 2,
      decoration: BoxDecoration(
        color: color,
        shape: BoxShape.circle,
      ),
      alignment: Alignment.center,
      child: Text(
        letter,
        style: _t(
          size: radius * 0.75,
          weight: FontWeight.w600,
          color: Colors.white,
          height: 1,
        ),
      ),
    );
  }

  // Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ Navigation Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬

  void _navigateToMembersPage() {
    final currentConversation = _selectedConversation ?? <String, dynamic>{};
    final recruiter = _recruiterFromItem(currentConversation);
    final recruiterPresence = _getRecruiterPresence(recruiter);

    Navigator.of(context).push(
      PageRouteBuilder(
        pageBuilder: (context, animation, secondaryAnimation) =>
            ConversationMembersPage(
          conversation: currentConversation,
          recruiterPresence: {
            'is_online': recruiterPresence?.isOnline ?? false,
            'last_seen': recruiterPresence?.lastSeenAt,
            'last_seen_text': recruiterPresence?.lastSeenText ?? 'Offline',
          },
        ),
        transitionsBuilder: (context, animation, secondaryAnimation, child) {
          final tween = Tween(begin: const Offset(1.0, 0.0), end: Offset.zero)
              .chain(CurveTween(curve: Curves.easeInOutCubic));
          return SlideTransition(
              position: animation.drive(tween), child: child);
        },
        transitionDuration: const Duration(milliseconds: 350),
      ),
    );
  }

  bool _canInviteCurrentConversationBinome() {
    final applicationId = _selectedApplicationId;
    if (applicationId == null) return false;
    final status = _binomeStatusByApplication[applicationId];
    // Show invite action while status is loading, then respect backend capability.
    if (status == null) return true;
    return status.canInvite;
  }

  Future<void> _showInviteDialog(BuildContext context) async {
    final applicationId = _selectedApplicationId;
    if (applicationId == null) return;

    final status = _binomeStatusByApplication[applicationId];
    if (status != null && !status.canInvite) {
      if (status.hasBinome) {
        _showSnack('You already have a binome for this internship.');
      } else if (status.hasPendingInvitation) {
        _showSnack('You already have a pending binome invitation.');
      } else {
        _showSnack('You cannot invite a binome for this conversation.');
      }
      return;
    }

    String? token = _authToken;
    if (token == null || token.isEmpty) {
      token = await _authLocalDataSource.getLastToken();
      if (!mounted) return;
      if (token != null && token.isNotEmpty) {
        setState(() => _authToken = token);
      }
    }
    if (token == null || token.isEmpty) return;

    final result = await showDialog<bool>(
      context: context,
      builder: (context) => InviteBinomeDialog(
        applicationId: applicationId,
        token: token!,
        binomeService: _binomeService,
      ),
    );

    if (result == true && mounted) {
      unawaited(_onBinomeChanged());
    }
  }

  // Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ Helpers Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬

  String _conversationPreview(Map<String, dynamic> lastMessage) {
    final preview = _string(lastMessage['preview']).trim();
    if (preview.isNotEmpty) return preview;
    return _messagePreview(lastMessage);
  }

  String _messagePreview(Map<String, dynamic> message) {
    final text = _string(message['message']).trim();
    if (text.isNotEmpty) return text;
    final attachment = _safeMap(message['attachment']);
    final attachmentName = _string(attachment['original_name']).trim();
    if (attachmentName.isNotEmpty) return 'Ã°Å¸â€œÅ½ $attachmentName';
    return '';
  }

  String _attachmentLabel(Map<String, dynamic> attachment) {
    final extension = _string(attachment['extension']).trim().toUpperCase();
    final fallback =
        _fileExtension(_string(attachment['original_name']))?.toUpperCase();
    final label = extension.isNotEmpty
        ? extension
        : (fallback?.isNotEmpty == true ? fallback! : 'FILE');
    final size = _formatFileSize(_toInt(attachment['file_size']) ?? 0);
    return '$label Ã‚Â· $size';
  }

  String _selectedAttachmentLabel() {
    final file = _selectedAttachment;
    if (file == null) return '';
    final extension = _fileExtension(file.name)?.toUpperCase() ?? 'FILE';
    return '$extension Ã‚Â· ${_formatFileSize(file.size)}';
  }

  String _formatFileSize(int bytes) {
    if (bytes <= 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB'];
    double size = bytes.toDouble();
    var unitIndex = 0;
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }
    final decimals = size >= 10 || unitIndex == 0 ? 0 : 1;
    return '${size.toStringAsFixed(decimals)} ${units[unitIndex]}';
  }

  String? _fileExtension(String fileName) {
    final normalized = fileName.trim();
    final dotIndex = normalized.lastIndexOf('.');
    if (dotIndex == -1 || dotIndex == normalized.length - 1) return null;
    return normalized.substring(dotIndex + 1).toLowerCase();
  }

  Map<String, dynamic> _recruiterFromItem(Map<String, dynamic> item) {
    final recruiter = _safeMap(item['recruiter']);
    if (recruiter.isNotEmpty) return recruiter;
    return _safeMap(item['responsible_recruiter']);
  }

  String _recruiterLabel(Map<String, dynamic> recruiter) {
    final fullName = _string(recruiter['full_name']).trim();
    if (fullName.isNotEmpty) return fullName;
    final email = _string(recruiter['email']).trim();
    if (email.isNotEmpty) return email;
    final id = _toInt(recruiter['id']);
    if (id != null) return 'Recruiter #$id';
    return 'Recruiter';
  }

  String _messageSenderName(Map<String, dynamic> message,
      {required bool isMine}) {
    if (isMine) return 'You';

    final senderUserId = _toInt(message['sender_user_id']);
    final conversation = _selectedConversation ?? <String, dynamic>{};

    final candidate = _safeMap(conversation['candidate']);
    final candidateUserId = _toInt(candidate['user_id']);
    if (senderUserId != null &&
        candidateUserId != null &&
        senderUserId == candidateUserId) {
      return _participantLabel(candidate, fallback: 'Candidate');
    }

    final binome = _safeMap(conversation['binome']);
    final binomeUserId = _toInt(binome['user_id']);
    if (senderUserId != null &&
        binomeUserId != null &&
        senderUserId == binomeUserId) {
      return _participantLabel(binome, fallback: 'Binome');
    }

    final recruiter = _recruiterFromItem(conversation);
    final recruiterUserId = _toInt(recruiter['user_id']);
    if (senderUserId != null &&
        recruiterUserId != null &&
        senderUserId == recruiterUserId) {
      return _recruiterLabel(recruiter);
    }

    return _fallbackSenderLabel(message);
  }

  String _participantLabel(Map<String, dynamic> participant,
      {required String fallback}) {
    final firstName = _string(participant['first_name']).trim();
    final lastName = _string(participant['last_name']).trim();
    final fullName = [firstName, lastName]
        .where((part) => part.isNotEmpty)
        .join(' ')
        .trim();
    if (fullName.isNotEmpty) return fullName;

    final explicitFullName = _string(participant['full_name']).trim();
    if (explicitFullName.isNotEmpty) return explicitFullName;

    final email = _string(participant['email']).trim();
    if (email.isNotEmpty) return email;

    return fallback;
  }

  String _fallbackSenderLabel(Map<String, dynamic> message) {
    final sender = _safeMap(message['sender']);
    final email = _string(sender['email']).trim();
    if (email.isNotEmpty) return email;

    final role = _string(sender['role']).trim().toLowerCase();
    if (role == 'candidate' || role == 'candidat') return 'Candidate';
    if (role == 'recruiter' || role == 'recruteur') return 'Recruiter';
    if (role == 'company' || role == 'company_admin') return 'Company';
    return 'Participant';
  }

  Map<String, dynamic> _safeMap(dynamic value) {
    if (value is Map<String, dynamic>) return value;
    if (value is Map) return value.map((key, val) => MapEntry('$key', val));
    return <String, dynamic>{};
  }

  List<Map<String, dynamic>> _safeList(dynamic value) {
    if (value is! List) return <Map<String, dynamic>>[];
    return value.map<Map<String, dynamic>>((item) => _safeMap(item)).toList();
  }

  int? _toInt(dynamic value) {
    if (value is int) return value;
    if (value is num) return value.toInt();
    final raw = '$value'.trim();
    if (raw.isEmpty || raw.toLowerCase() == 'null') return null;
    return int.tryParse(raw) ?? double.tryParse(raw)?.toInt();
  }

  int? _applicationIdFromItem(Map<String, dynamic> item) {
    return _toInt(item['application_id']) ??
        _toInt(item['applicationId']) ??
        _toInt(item['id']) ??
        _toInt(_safeMap(item['application'])['id']);
  }

  String _string(dynamic value) {
    if (value == null) return '';
    return '$value';
  }

  String _formatTime(String isoString) {
    if (isoString.isEmpty) return '';
    try {
      final dt = DateTime.parse(isoString).toLocal();
      final hour = dt.hour.toString().padLeft(2, '0');
      final minute = dt.minute.toString().padLeft(2, '0');
      return '$hour:$minute';
    } catch (_) {
      return '';
    }
  }

  String _formatMessageTime(String isoString) {
    if (isoString.isEmpty) return '';
    try {
      final dt = DateTime.parse(isoString).toLocal();
      final now = DateTime.now();
      final today = DateTime(now.year, now.month, now.day);
      final messageDay = DateTime(dt.year, dt.month, dt.day);
      final diff = today.difference(messageDay).inDays;

      if (diff == 0) {
        return '${dt.hour.toString().padLeft(2, '0')}:${dt.minute.toString().padLeft(2, '0')}';
      } else if (diff == 1) {
        return 'Yesterday';
      } else if (diff < 7) {
        const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        return days[dt.weekday % 7];
      } else {
        return '${dt.day} ${_getMonthAbbrev(dt.month)}';
      }
    } catch (_) {
      return '';
    }
  }

  String _getMonthAbbrev(int month) {
    const months = [
      '',
      'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
    ];
    return months[month];
  }

  String _extractErrorMessage(DioException error, {required String fallback}) {
    final data = error.response?.data;
    if (data is Map) {
      final message = data['message'] ?? data['error'];
      if (message != null && '$message'.trim().isNotEmpty) return '$message';
    }
    return fallback;
  }
}
