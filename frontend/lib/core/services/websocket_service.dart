import 'dart:async';
import 'dart:convert';
import 'dart:math';

import 'package:dio/dio.dart';
import 'package:web_socket_channel/web_socket_channel.dart';

/// WebSocket connection state
enum WebSocketState {
  disconnected,
  connecting,
  connected,
  error,
}

/// WebSocket message types for chat
enum WebSocketMessageType {
  messageSent,
  messageRead,
  presence,
  notification,
  connection,
  error,
  unknown,
}

/// WebSocket message model
class WebSocketMessage {
  final WebSocketMessageType type;
  final dynamic payload;
  final DateTime timestamp;

  WebSocketMessage({
    required this.type,
    required this.payload,
    required this.timestamp,
  });

  factory WebSocketMessage.fromEvent(
    String event,
    dynamic payload,
  ) {
    WebSocketMessageType type;
    switch (event) {
      case 'InternChatMessageSent':
        type = WebSocketMessageType.messageSent;
        break;
      case 'InternChatMessageRead':
        type = WebSocketMessageType.messageRead;
        break;
      case 'UserPresenceUpdated':
        type = WebSocketMessageType.presence;
        break;
      case 'UserNotificationCreated':
        type = WebSocketMessageType.notification;
        break;
      case 'connection':
        type = WebSocketMessageType.connection;
        break;
      case 'error':
        type = WebSocketMessageType.error;
        break;
      default:
        type = WebSocketMessageType.unknown;
    }

    return WebSocketMessage(
      type: type,
      payload: payload,
      timestamp: DateTime.now(),
    );
  }
}

/// Chat message payload from WebSocket
class ChatMessagePayload {
  final Map<String, dynamic> message;
  final Map<String, dynamic> conversation;

  ChatMessagePayload({
    required this.message,
    required this.conversation,
  });

  factory ChatMessagePayload.fromJson(Map<String, dynamic> json) {
    return ChatMessagePayload(
      message: json['message'] as Map<String, dynamic>? ?? {},
      conversation: json['conversation'] as Map<String, dynamic>? ?? {},
    );
  }
}

/// Message read receipt payload
class MessageReadPayload {
  final int conversationId;
  final int readerUserId;
  final List<int> messageIds;
  final String readAt;

  MessageReadPayload({
    required this.conversationId,
    required this.readerUserId,
    required this.messageIds,
    required this.readAt,
  });

  factory MessageReadPayload.fromJson(Map<String, dynamic> json) {
    return MessageReadPayload(
      conversationId: json['conversation_id'] as int? ?? 0,
      readerUserId: json['reader_user_id'] as int? ?? 0,
      messageIds: (json['message_ids'] as List<dynamic>? ?? [])
          .map((e) => e as int)
          .toList(),
      readAt: json['read_at'] as String? ?? '',
    );
  }
}

/// WebSocket service for real-time chat via Laravel Reverb.
class WebSocketService {
  static final WebSocketService _instance = WebSocketService._internal();

  factory WebSocketService({required Dio dio}) {
    _instance._dio = dio;
    return _instance;
  }

  WebSocketService._internal();

  static const String _reverbAppKey = 'recrutitn-websocket-key';
  static const String _presenceChannel = 'presence';

  late Dio _dio;
  WebSocketChannel? _channel;
  final _stateController = StreamController<WebSocketState>.broadcast();
  final _messageController = StreamController<WebSocketMessage>.broadcast();
  final _presenceController = StreamController<Map<String, dynamic>>.broadcast();

  Stream<WebSocketState> get stateStream => _stateController.stream;
  Stream<WebSocketMessage> get messageStream => _messageController.stream;
  Stream<Map<String, dynamic>> get presenceStream => _presenceController.stream;

  WebSocketState _currentState = WebSocketState.disconnected;
  WebSocketState get currentState => _currentState;

  String? _baseUrl;
  String? _socketId;
  bool _shouldReconnect = true;

  final Set<String> _desiredChannels = {};
  final Set<String> _activeChannels = {};

  Timer? _reconnectTimer;
  int _reconnectAttempts = 0;
  static const int _maxReconnectAttempts = 5;
  static const Duration _initialReconnectDelay = Duration(seconds: 1);

  /// Initialize with the API base URL.
  void initialize({required String baseUrl}) {
    _baseUrl = baseUrl;
  }

  /// Connect to the Reverb socket server with automatic reconnection.
  Future<void> connect() async {
    if (_baseUrl == null) {
      throw Exception('WebSocket not initialized. Call initialize() first.');
    }

    if (_currentState == WebSocketState.connected ||
        _currentState == WebSocketState.connecting) {
      return;
    }

    _shouldReconnect = true;
    _cancelReconnectTimer();
    _updateState(WebSocketState.connecting);

    try {
      _channel = WebSocketChannel.connect(
        _buildConnectionUri(),
      );

      _channel!.stream.listen(
        _onMessage,
        onError: _onError,
        onDone: _onDone,
        cancelOnError: false,
      );
    } catch (e) {
      _updateState(WebSocketState.error);
      _emitError('Failed to connect to WebSocket server', '$e');
      _scheduleReconnect();
    }
  }

  void disconnect() {
    _shouldReconnect = false;
    _cancelReconnectTimer();
    _desiredChannels.clear();
    _activeChannels.clear();
    _socketId = null;
    _channel?.sink.close();
    _channel = null;
    _updateState(WebSocketState.disconnected);
  }

  void subscribeToConversation(int conversationId) {
    _subscribeToChannel('chat.conversation.$conversationId');
  }

  void leaveConversation(int conversationId) {
    _leaveChannel('chat.conversation.$conversationId');
  }

  void subscribeToUserChannel(int userId) {
    _subscribeToChannel('user.$userId');
  }

  void leaveUserChannel(int userId) {
    _leaveChannel('user.$userId');
  }

  void subscribeToPresenceChannel() {
    _subscribeToChannel(_presenceChannel);
  }

  void leavePresenceChannel() {
    _leaveChannel(_presenceChannel);
  }

  void sendTypingIndicator(int conversationId, bool isTyping) {
    final logicalChannel = 'chat.conversation.$conversationId';
    final wireChannel = _wireChannelName(logicalChannel);
    if (_currentState != WebSocketState.connected ||
        !_activeChannels.contains(wireChannel)) {
      return;
    }

    _send({
      'event': 'client-typing',
      'channel': wireChannel,
      'data': jsonEncode({'is_typing': isTyping}),
    });
  }

  Future<void> reconnect() async {
    _shouldReconnect = true;
    _reconnectAttempts = 0;
    _cancelReconnectTimer();
    _activeChannels.clear();
    _socketId = null;
    _channel?.sink.close();
    _channel = null;
    _updateState(WebSocketState.disconnected);
    await Future.delayed(const Duration(milliseconds: 500));
    await connect();
  }

  void dispose() {
    _cancelReconnectTimer();
    disconnect();
    _stateController.close();
    _messageController.close();
    _presenceController.close();
  }

  Uri _buildConnectionUri() {
    final apiUri = Uri.parse(_baseUrl!);
    final originPath = apiUri.path.endsWith('/api')
        ? apiUri.path.substring(0, apiUri.path.length - 4)
        : apiUri.path;
    final normalizedPath = originPath.isEmpty ? '/' : originPath;
    final originUri = apiUri.replace(path: normalizedPath);
    final wsScheme = originUri.scheme == 'https' ? 'wss' : 'ws';

    return Uri(
      scheme: wsScheme,
      host: originUri.host,
      port: 8081,
      path: '/app/$_reverbAppKey',
      queryParameters: const {
        'protocol': '7',
        'client': 'flutter',
        'version': '1.0',
        'flash': 'false',
      },
    );
  }

  void _onMessage(dynamic rawMessage) {
    try {
      final json = jsonDecode(rawMessage as String) as Map<String, dynamic>;
      final event = json['event'] as String? ?? '';
      final payload = _decodePayload(json['data']);

      switch (event) {
        case 'pusher:connection_established':
          final data = _safeMap(payload);
          _socketId = data['socket_id'] as String?;
          _updateState(WebSocketState.connected);
          _reconnectAttempts = 0;
          _messageController.add(
            WebSocketMessage.fromEvent('connection', data),
          );
          unawaited(_resubscribeAll());
          return;
        case 'pusher:ping':
          _send({'event': 'pusher:pong', 'data': {}});
          return;
        case 'pusher:error':
          _emitError('Socket server returned an error', payload);
          return;
        case 'pusher_internal:subscription_succeeded':
        case 'pusher:subscription_succeeded':
          return;
        default:
          final message = WebSocketMessage.fromEvent(event, payload);
          _messageController.add(message);

          if (message.type == WebSocketMessageType.presence &&
              message.payload is Map<String, dynamic>) {
            _presenceController.add(message.payload as Map<String, dynamic>);
          }
          return;
      }
    } catch (e) {
      _emitError('Failed to parse socket message', '$e');
    }
  }

  void _onError(Object error) {
    _activeChannels.clear();
    _socketId = null;
    _updateState(WebSocketState.error);
    _emitError('WebSocket error', error);
    _scheduleReconnect();
  }

  void _onDone() {
    _activeChannels.clear();
    _socketId = null;
    _updateState(WebSocketState.disconnected);
    _scheduleReconnect();
  }

  void _subscribeToChannel(String logicalChannel) {
    _desiredChannels.add(logicalChannel);
    if (_currentState == WebSocketState.connected) {
      unawaited(_authorizeAndSubscribe(logicalChannel));
    }
  }

  void _leaveChannel(String logicalChannel) {
    _desiredChannels.remove(logicalChannel);
    final wireChannel = _wireChannelName(logicalChannel);

    if (_activeChannels.remove(wireChannel) &&
        _currentState == WebSocketState.connected) {
      _send({
        'event': 'pusher:unsubscribe',
        'data': {'channel': wireChannel},
      });
    }
  }

  Future<void> _resubscribeAll() async {
    for (final channel in _desiredChannels.toList()) {
      await _authorizeAndSubscribe(channel);
    }
  }

  Future<void> _authorizeAndSubscribe(String logicalChannel) async {
    if (_currentState != WebSocketState.connected || _socketId == null) {
      return;
    }

    final wireChannel = _wireChannelName(logicalChannel);
    if (_activeChannels.contains(wireChannel)) {
      return;
    }

    final subscribeData = <String, dynamic>{'channel': wireChannel};
    if (_requiresAuthorization(logicalChannel)) {
      final authPayload = await _authorizeChannel(wireChannel);
      if (authPayload == null) {
        return;
      }
      subscribeData.addAll(authPayload);
    }

    _send({
      'event': 'pusher:subscribe',
      'data': subscribeData,
    });
    _activeChannels.add(wireChannel);
  }

  Future<Map<String, dynamic>?> _authorizeChannel(String wireChannel) async {
    try {
      final response = await _dio.post(
        '${_baseUrl!}/broadcasting/auth',
        data: {
          'socket_id': _socketId,
          'channel_name': wireChannel,
        },
        options: Options(
          headers: const {'Accept': 'application/json'},
        ),
      );

      final payload = _safeMap(response.data);
      if (payload['auth'] == null) {
        throw Exception('Missing broadcast auth signature');
      }

      return payload;
    } catch (e) {
      _emitError('Channel authorization failed', {
        'channel': wireChannel,
        'details': '$e',
      });
      return null;
    }
  }

  bool _requiresAuthorization(String logicalChannel) {
    return logicalChannel == _presenceChannel ||
        logicalChannel.startsWith('chat.conversation.') ||
        logicalChannel.startsWith('user.');
  }

  String _wireChannelName(String logicalChannel) {
    if (!_requiresAuthorization(logicalChannel) ||
        logicalChannel.startsWith('private-')) {
      return logicalChannel;
    }

    return 'private-$logicalChannel';
  }

  dynamic _decodePayload(dynamic payload) {
    if (payload is String && payload.isNotEmpty) {
      try {
        return jsonDecode(payload);
      } catch (_) {
        return payload;
      }
    }

    return payload;
  }

  Map<String, dynamic> _safeMap(dynamic value) {
    if (value is Map<String, dynamic>) {
      return value;
    }
    if (value is Map) {
      return value.map((key, val) => MapEntry('$key', val));
    }
    return <String, dynamic>{};
  }

  void _scheduleReconnect() {
    _cancelReconnectTimer();

    if (!_shouldReconnect || _reconnectAttempts >= _maxReconnectAttempts) {
      return;
    }

    final delay = Duration(
      milliseconds: _initialReconnectDelay.inMilliseconds *
          pow(2, _reconnectAttempts).toInt(),
    );

    _reconnectTimer = Timer(delay, () {
      _reconnectAttempts++;
      connect();
    });
  }

  void _cancelReconnectTimer() {
    _reconnectTimer?.cancel();
    _reconnectTimer = null;
  }

  void _send(Map<String, dynamic> data) {
    _channel?.sink.add(jsonEncode(data));
  }

  void _updateState(WebSocketState state) {
    _currentState = state;
    _stateController.add(state);
  }

  void _emitError(String message, dynamic details) {
    _messageController.add(
      WebSocketMessage.fromEvent('error', {
        'message': message,
        'details': details,
      }),
    );
  }
}
