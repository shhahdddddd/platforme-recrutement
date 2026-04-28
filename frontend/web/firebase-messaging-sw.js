importScripts('https://www.gstatic.com/firebasejs/11.0.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/11.0.1/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: 'AIzaSyApIdBvv-n58Yz4JkTLxqBX0KVJ4BSZQ7g',
  authDomain: 'recrutementpfe-31e97.firebaseapp.com',
  projectId: 'recrutementpfe-31e97',
  storageBucket: 'recrutementpfe-31e97.firebasestorage.app',
  messagingSenderId: '420887862296',
  appId: '1:420887862296:web:3b748cc58fe559299ef76d',
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const data = payload?.data || {};
  const notificationTitle =
    payload?.notification?.title || data.title || 'New notification';
  const notificationOptions = {
    body: payload?.notification?.body || data.body || '',
    icon: '/icons/Icon-192.png',
  };
  console.log('[FCM][SW] Background payload:', payload);
  self.registration.showNotification(notificationTitle, notificationOptions);
});
