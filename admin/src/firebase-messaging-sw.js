importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyBZ7ITs2HoftiCBQKUE9nYvAb9v47OLRCY",
  authDomain: "recrutementpfe-31e97.firebaseapp.com",
  projectId: "recrutementpfe-31e97",
  storageBucket: "recrutementpfe-31e97.firebasestorage.app",
  messagingSenderId: "420887862296",
  appId: "1:420887862296:web:3b748cc58fe559299ef76d"
});

const messaging = firebase.messaging();

// Handle background messages
messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message ', payload);

  const notificationTitle = payload.notification?.title || 'New Notification';
  const notificationOptions = {
    body: payload.notification?.body || '',
    icon: '/assets/icons/icon-192x192.png',
    badge: '/assets/icons/icon-72x72.png',
    tag: payload.data?.tag || 'default',
    requireInteraction: true,
    data: payload.data
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

// Handle notification click
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const notificationData = event.notification.data;
  let url = '/company/notifications';

  if (notificationData?.link) {
    url = notificationData.link;
  } else if (notificationData?.application_id) {
    url = `/company/applicants/${notificationData.application_id}`;
  } else if (notificationData?.job_id) {
    url = `/company/jobs/${notificationData.job_id}`;
  }

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // If a window client is already open, focus it and navigate
      for (const client of windowClients) {
        if (client.url.includes('localhost:4200') && 'focus' in client) {
          return client.focus().then(() => {
            if ('navigate' in client) {
              return client.navigate(url);
            }
          });
        }
      }
      // Otherwise, open a new window
      if (clients.openWindow) {
        return clients.openWindow(url);
      }
    })
  );
});
