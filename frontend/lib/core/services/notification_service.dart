import 'dart:async';
import 'dart:developer';
import 'dart:convert';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import '../../../features/auth/domain/usecases/update_fcm_token_usecase.dart';
import 'web_notification_stub.dart'
    if (dart.library.html) 'web_notification.dart';

class NotificationService {
  static const String _webVapidKey =
      'BKV9ngyoABcGMA7Vesptul0w9Ror_izYtPilVPr5ia-SI6Ykv7ZtvSTKDRVHx32D5Q5Rp9108mEw7ZXigeRBYfQ';
  static const String _tapIdKey = '_notification_tap_id';

  final UpdateFcmTokenUseCase? updateFcmTokenUseCase;

  NotificationService({this.updateFcmTokenUseCase});

  final FirebaseMessaging _fcm = FirebaseMessaging.instance;
  final FlutterLocalNotificationsPlugin _localNotifications =
      FlutterLocalNotificationsPlugin();

  final _notificationClickController = StreamController<Map<String, dynamic>>.broadcast();
  Stream<Map<String, dynamic>> get notificationTapStream => _notificationClickController.stream;
  final _notificationReceivedController =
      StreamController<Map<String, dynamic>>.broadcast();
  Stream<Map<String, dynamic>> get notificationReceivedStream =>
      _notificationReceivedController.stream;
  Map<String, dynamic>? _pendingTapPayload;
  int _nextTapId = 0;

  void _log(String message) {
    debugPrint(message);
    log(message);
  }

  Map<String, dynamic>? consumePendingNotificationTap() {
    final payload = _pendingTapPayload;
    _pendingTapPayload = null;
    if (payload == null) return null;
    return Map<String, dynamic>.from(payload);
  }

  void markNotificationTapHandled(Map<String, dynamic> payload) {
    if (_pendingTapPayload?[_tapIdKey] == payload[_tapIdKey]) {
      _pendingTapPayload = null;
    }
  }

  void _dispatchNotificationTap(Map<String, dynamic> payload) {
    final nextPayload = Map<String, dynamic>.from(payload);
    nextPayload[_tapIdKey] = ++_nextTapId;
    _pendingTapPayload = nextPayload;
    _notificationClickController.add(nextPayload);
  }

  Map<String, dynamic> _decodeTapPayload(String payload) {
    try {
      final decoded = jsonDecode(payload);
      if (decoded is Map<String, dynamic>) {
        return decoded;
      }
      if (decoded is Map) {
        return decoded.map((key, value) => MapEntry('$key', value));
      }
    } catch (_) {
      // Fall back to the raw payload when it is not JSON.
    }

    return {'type': 'local', 'payload': payload};
  }

  Future<void> initialize() async {
    try {
      // 🔹 Initialize local notifications (Mobile only)
      if (!kIsWeb) {
        const AndroidInitializationSettings androidInit =
            AndroidInitializationSettings('@mipmap/ic_launcher');

        const InitializationSettings initSettings =
            InitializationSettings(android: androidInit);

        await _localNotifications.initialize(
          settings: initSettings,
          onDidReceiveNotificationResponse:
              (NotificationResponse response) {
            _log('Notification tapped: ${response.payload}');
            if (response.payload != null) {
              _dispatchNotificationTap(_decodeTapPayload(response.payload!));
            }
          },
        );

        final launchDetails =
            await _localNotifications.getNotificationAppLaunchDetails();
        final launchResponse = launchDetails?.notificationResponse;
        if (launchDetails?.didNotificationLaunchApp == true &&
            launchResponse?.payload != null) {
          _dispatchNotificationTap(_decodeTapPayload(launchResponse!.payload!));
        }

        // 🔹 Create Android channel
        const AndroidNotificationChannel channel =
            AndroidNotificationChannel(
          'default_notification_channel',
          'Default Notifications',
          description: 'Default notification channel for the app',
          importance: Importance.high,
        );

        await _localNotifications
            .resolvePlatformSpecificImplementation<
                AndroidFlutterLocalNotificationsPlugin>()
            ?.createNotificationChannel(channel);

        if (defaultTargetPlatform == TargetPlatform.android) {
          await _localNotifications
              .resolvePlatformSpecificImplementation<
                  AndroidFlutterLocalNotificationsPlugin>()
              ?.requestNotificationsPermission();
        }
      }

      if (!kIsWeb &&
          (defaultTargetPlatform == TargetPlatform.iOS ||
              defaultTargetPlatform == TargetPlatform.macOS)) {
        await _fcm.setForegroundNotificationPresentationOptions(
          alert: true,
          badge: true,
          sound: true,
        );
      }

      // 🔹 Request permissions (mobile only; web uses user action)
      if (!kIsWeb) {
        NotificationSettings settings = await _fcm.requestPermission(
          alert: true,
          badge: true,
          sound: true,
        );

        if (settings.authorizationStatus ==
            AuthorizationStatus.authorized) {
        _log('User granted permission');
      } else {
        _log('User declined or has not accepted permission');
      }
      }

      // 🔹 Sync token (fire-and-forget so init doesn't block)
      unawaited(syncTokenToBackend());

      // 🔹 Foreground listener
      FirebaseMessaging.onMessage
          .listen(_handleForegroundMessage);

      // 🔹 Notification click listener
      FirebaseMessaging.onMessageOpenedApp
          .listen(_handleMessageOpenedApp);

      final initialMessage = await _fcm.getInitialMessage();
      if (initialMessage != null) {
        _dispatchNotificationTap(_messagePayload(initialMessage));
      }
    } catch (e) {
      _log('Notification service initialization failed: $e');
    }
  }

  Future<String?> getFCMToken() async {
    try {
      if (kIsWeb) {
        return await _fcm.getToken(vapidKey: _webVapidKey);
      }
      return await _fcm.getToken();
    } catch (e) {
      _log('Error getting FCM token: $e');
      return null;
    }
  }

  Future<bool> syncTokenToBackend({bool requestPermission = false}) async {
    try {
      if (kIsWeb) {
        if (requestPermission) {
          final granted = await requestWebNotificationPermission();
          if (!granted) {
          _log('Web notification permission not granted.');
          return false;
        }
      } else if (!isWebNotificationPermissionGranted()) {
        _log('Web notification permission not granted. Skipping token sync.');
        return false;
      }
    } else if (defaultTargetPlatform == TargetPlatform.android) {
        await _localNotifications
            .resolvePlatformSpecificImplementation<
                AndroidFlutterLocalNotificationsPlugin>()
            ?.requestNotificationsPermission();
      } else if (defaultTargetPlatform == TargetPlatform.iOS ||
          defaultTargetPlatform == TargetPlatform.macOS) {
        final settings = await _fcm.requestPermission(
          alert: true,
          badge: true,
          sound: true,
        );
        if (settings.authorizationStatus == AuthorizationStatus.denied) {
          _log('iOS notification permission denied.');
          return false;
        }
      }

      final token = await getFCMToken();
      if (token != null) {
        _log('FCM Token: $token');
        if (updateFcmTokenUseCase != null) {
          await updateFcmTokenUseCase!(token, _resolvePlatform());
        }
        return true;
      }
      return false;
    } catch (e) {
      _log('Error syncing FCM token: $e');
      return false;
    }
  }

  String _resolvePlatform() {
    if (kIsWeb) return 'web';
    switch (defaultTargetPlatform) {
      case TargetPlatform.android:
        return 'android';
      case TargetPlatform.iOS:
        return 'ios';
      case TargetPlatform.macOS:
        return 'macos';
      case TargetPlatform.windows:
        return 'windows';
      case TargetPlatform.linux:
        return 'linux';
      case TargetPlatform.fuchsia:
        return 'fuchsia';
    }
  }

  // 🔥 Foreground Notification Handler
  Future<void> _handleForegroundMessage(
      RemoteMessage message) async {
    _log(
      'Foreground message: title=${message.notification?.title} '
      'data=${message.data}',
    );
    _notificationReceivedController.add(_messagePayload(message));

    if (kIsWeb) {
      final title = message.notification?.title ??
          message.data['title']?.toString() ??
          'New notification';
      final body = message.notification?.body ??
          message.data['body']?.toString() ??
          '';
      await showWebNotification(title: title, body: body);
      return;
    }

    if (!kIsWeb) {
      RemoteNotification? notification =
          message.notification;
      AndroidNotification? android =
          message.notification?.android;

      if (notification != null && android != null) {
        await _localNotifications.show(
          id: notification.hashCode,
          title: notification.title,
          body: notification.body,
          notificationDetails: NotificationDetails(
            android: AndroidNotificationDetails(
              'default_notification_channel',
              'Default Notifications',
              channelDescription:
                  'Default notification channel for the app',
              importance: Importance.high,
              priority: Priority.high,
              icon: android.smallIcon,
              color: Colors.deepPurple,
            ),
          ),
          payload: jsonEncode(_messagePayload(message)),
        );
      }
    }
  }

  // 🔥 When user taps notification
  void _handleMessageOpenedApp(RemoteMessage message) {
    _log('App opened from notification: ${message.notification?.title}');
    _dispatchNotificationTap(_messagePayload(message));
  }

  Map<String, dynamic> _messagePayload(RemoteMessage message) {
    final payload = <String, dynamic>{...message.data};
    final title = message.notification?.title;
    final body = message.notification?.body;

    if (title != null && title.isNotEmpty) {
      payload.putIfAbsent('title', () => title);
    }
    if (body != null && body.isNotEmpty) {
      payload.putIfAbsent('body', () => body);
    }

    return payload;
  }
}

// 🔥 Global background handler (MUST be top-level)
@pragma('vm:entry-point')
Future<void> firebaseMessagingBackgroundHandler(
    RemoteMessage message) async {
  await Firebase.initializeApp();
  debugPrint('Handling background message: ${message.messageId}');
}
