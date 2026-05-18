// Push notification setup via Firebase Cloud Messaging.
// Stores per-device tokens at users/{uid}/fcmTokens/{token}.

const VAPID_KEY = 'BAa26BRj2zy9cHSkOSZDqQB_9Ys4GBUlyUWhnk_A_ErUv_cK355aFNhuaTFANFIWJAdikqQCNkgv4cbpoGQ6BKY';

async function enableNotifications() {
    try {
        if (!('Notification' in window) || !('serviceWorker' in navigator)) {
            showNotification('This browser does not support push notifications', 'error');
            return;
        }
        if (typeof firebase === 'undefined' || !firebase.messaging) {
            showNotification('Messaging SDK not loaded', 'error');
            return;
        }
        if (!window.firebaseAuth || !window.firebaseAuth.currentUser) {
            showNotification('Sign in first', 'error');
            return;
        }

        const permission = await Notification.requestPermission();
        if (permission !== 'granted') {
            showNotification('Notifications blocked. Enable in iOS Settings → Ledgr.', 'error');
            updateNotificationsUI(permission);
            return;
        }

        const swReg = await navigator.serviceWorker.register('./firebase-messaging-sw.js');
        const messaging = firebase.messaging();
        const token = await messaging.getToken({ vapidKey: VAPID_KEY, serviceWorkerRegistration: swReg });
        if (!token) {
            showNotification('Could not get a push token', 'error');
            return;
        }

        const uid = window.firebaseAuth.currentUser.uid;
        const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Los_Angeles';
        await window.firebaseDb
            .collection('users').doc(uid)
            .collection('fcmTokens').doc(token)
            .set({
                token,
                userAgent: navigator.userAgent,
                tz,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            }, { merge: true });

        console.log('FCM token saved:', token.slice(0, 12) + '...');
        showNotification('Notifications enabled', 'success');
        updateNotificationsUI('granted');
    } catch (err) {
        console.error('enableNotifications failed:', err);
        showNotification('Failed: ' + (err.message || err), 'error');
    }
}

function updateNotificationsUI(permission) {
    const status = safeGetElement('notif-status');
    const btn = safeGetElement('enable-notif-btn');
    if (!status || !btn) return;
    if (permission === 'granted') {
        status.textContent = 'Enabled on this device';
        btn.textContent = 'Refresh token';
    } else if (permission === 'denied') {
        status.textContent = 'Blocked — enable in iOS Settings → Ledgr → Notifications';
        btn.textContent = 'Try again';
    } else {
        status.textContent = 'Not enabled on this device';
        btn.textContent = 'Enable Notifications';
    }
}

window.enableNotifications = enableNotifications;
window.updateNotificationsUI = updateNotificationsUI;

document.addEventListener('DOMContentLoaded', () => {
    if ('Notification' in window) updateNotificationsUI(Notification.permission);
});
