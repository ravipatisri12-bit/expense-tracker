// FCM background message handler. Runs as its own service worker, separate
// from sw.js (the app's caching SW). Both can coexist.
importScripts('https://www.gstatic.com/firebasejs/8.10.1/firebase-app.js');
importScripts('https://www.gstatic.com/firebasejs/8.10.1/firebase-messaging.js');

firebase.initializeApp({
    apiKey: 'AIzaSyDH_RMji5JG-IEP3uu-hapu7H7JKsR_SUA',
    authDomain: 'personal-expense-tracker-7aa9c.firebaseapp.com',
    projectId: 'personal-expense-tracker-7aa9c',
    storageBucket: 'personal-expense-tracker-7aa9c.firebasestorage.app',
    messagingSenderId: '893806575358',
    appId: '1:893806575358:web:fdd0b3d75a57122be4efaf'
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage(payload => {
    const title = (payload.notification && payload.notification.title) || 'Ledgr';
    const options = {
        body: (payload.notification && payload.notification.body) || '',
        icon: 'icon_192.png',
        badge: 'icon_128.png',
        data: payload.data || {}
    };
    self.registration.showNotification(title, options);
});

self.addEventListener('notificationclick', event => {
    event.notification.close();
    event.waitUntil(clients.openWindow('./'));
});
