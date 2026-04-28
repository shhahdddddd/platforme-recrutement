importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

// Config synchronized with environment.ts
firebase.initializeApp({
    apiKey: "AIzaSyBZ7ITs2HoftiCBQKUE9nYvAb9v47OLRCY",
    authDomain: "recrutementpfe-31e97.firebaseapp.com",
    projectId: "recrutementpfe-31e97",
    storageBucket: "recrutementpfe-31e97.firebasestorage.app",
    messagingSenderId: "420887862296",
    appId: "1:420887862296:web:3b748cc58fe559299ef76d"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
    console.log('[SW] Background notification', payload);
    const title = payload.notification?.title || 'New Update';
    const options = {
        body: payload.notification?.body || 'Click to view details.',
        icon: '/favicon.ico',
        tag: 'recrutitn-general'
    };
    self.registration.showNotification(title, options);
});
