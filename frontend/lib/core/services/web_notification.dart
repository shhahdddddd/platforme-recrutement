import 'dart:html' as html;

Future<void> showWebNotification({
  required String title,
  String? body,
}) async {
  if (!html.Notification.supported) return;

  if (html.Notification.permission != 'granted') {
    final permission = await html.Notification.requestPermission();
    if (permission != 'granted') return;
  }

  html.Notification(
    title,
    body: body ?? '',
  );
}

Future<bool> requestWebNotificationPermission() async {
  if (!html.Notification.supported) return false;

  if (html.Notification.permission == 'granted') {
    return true;
  }

  final permission = await html.Notification.requestPermission();
  return permission == 'granted';
}

bool isWebNotificationPermissionGranted() {
  if (!html.Notification.supported) return false;
  return html.Notification.permission == 'granted';
}
