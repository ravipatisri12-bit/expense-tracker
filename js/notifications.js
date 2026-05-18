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

// --- Local preview ("fire now") ---
// Mirrors scripts/send-notifications.js logic but uses in-memory expense data
// and the local Notification API, so taps fire instantly without going through FCM.
const PREVIEW_MONTHLY_TOTAL_SOFT = 1000;
const PREVIEW_MONTHLY_TOTAL_HARD = 2000;
const PREVIEW_MONTHLY_FOOD = 400;
const PREVIEW_FOOD_CATEGORIES = new Set(['Food']);

function previewLocalDateString() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function previewDaysLeft() {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate() - d.getDate() + 1;
}

function previewBuildContext() {
    const today = previewLocalDateString();
    const monthPrefix = today.slice(0, 7);
    const all = (window.expenseTracker && window.expenseTracker.expenses) || [];
    const month = all.filter(e => (e.date || '').startsWith(monthPrefix));
    const todays = month.filter(e => e.date === today);
    const sum = (arr, pred = () => true) => arr.reduce((s, e) => s + (pred(e) ? Number(e.amount || 0) : 0), 0);
    const isFood = e => PREVIEW_FOOD_CATEGORIES.has(e.category);
    const foodDays = new Set(month.filter(isFood).map(e => e.date));
    let streak = 0;
    const cursor = new Date(today + 'T00:00:00');
    while (streak <= 365) {
        const ds = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}-${String(cursor.getDate()).padStart(2, '0')}`;
        if (foodDays.has(ds)) break;
        streak++;
        cursor.setDate(cursor.getDate() - 1);
    }
    return {
        todayTotal: sum(todays),
        todayFood: sum(todays, isFood),
        monthTotal: sum(month),
        monthFood: sum(month, isFood),
        daysLeft: previewDaysLeft(),
        streak,
        todayCount: todays.length
    };
}

function previewMessage(slot, ctx) {
    const fmt = n => '$' + Math.round(n);
    const totalRoom = Math.max(0, PREVIEW_MONTHLY_TOTAL_SOFT - ctx.monthTotal);
    const foodRoom = Math.max(0, PREVIEW_MONTHLY_FOOD - ctx.monthFood);
    const dailyTotalTarget = Math.round(totalRoom / Math.max(1, ctx.daysLeft));
    const dailyFoodTarget = Math.round(foodRoom / Math.max(1, ctx.daysLeft));
    if (slot === 'morning') {
        return { title: 'Daily target', body: `Room: ${fmt(dailyTotalTarget)} total · ${fmt(dailyFoodTarget)} food\n${ctx.daysLeft} days left in month` };
    }
    if (slot === 'afternoon') {
        return { title: 'Day so far', body: `Today: ${fmt(ctx.todayTotal)} · food ${fmt(ctx.todayFood)}\nMonth: ${fmt(ctx.monthTotal)} of ${fmt(PREVIEW_MONTHLY_TOTAL_SOFT)}` };
    }
    const noSpend = ctx.todayCount === 0 ? ' · no-spend day' : '';
    let pace;
    if (ctx.monthTotal > PREVIEW_MONTHLY_TOTAL_HARD) pace = 'Over hard cap';
    else if (ctx.monthTotal > PREVIEW_MONTHLY_TOTAL_SOFT) pace = 'Over soft pace';
    else pace = 'Under pace';
    return { title: 'Day done', body: `${fmt(ctx.todayTotal)} today · food ${fmt(ctx.todayFood)}${noSpend}\nStreak: Day ${ctx.streak} · ${pace}` };
}

async function fireNotificationPreview(slot = 'evening') {
    try {
        if (!('Notification' in window) || !('serviceWorker' in navigator)) {
            showNotification('Notifications not supported here', 'error');
            return;
        }
        if (Notification.permission !== 'granted') {
            const p = await Notification.requestPermission();
            if (p !== 'granted') {
                showNotification('Enable notifications in Settings first', 'error');
                return;
            }
        }
        const ctx = previewBuildContext();
        const { title, body } = previewMessage(slot, ctx);
        const reg = await navigator.serviceWorker.getRegistration('./firebase-messaging-sw.js')
            || await navigator.serviceWorker.ready;
        await reg.showNotification(title, { body, icon: 'icon_192.png', badge: 'icon_128.png', tag: 'ledgr-preview' });
    } catch (err) {
        console.error('fireNotificationPreview failed:', err);
        showNotification('Preview failed: ' + (err.message || err), 'error');
    }
}

window.enableNotifications = enableNotifications;
window.updateNotificationsUI = updateNotificationsUI;
window.fireNotificationPreview = fireNotificationPreview;

document.addEventListener('DOMContentLoaded', () => {
    if ('Notification' in window) updateNotificationsUI(Notification.permission);
});
