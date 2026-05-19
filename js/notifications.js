// Push notification setup via Firebase Cloud Messaging.
// Stores per-device tokens at users/{uid}/fcmTokens/{token}.

const VAPID_KEY = 'BAa26BRj2zy9cHSkOSZDqQB_9Ys4GBUlyUWhnk_A_ErUv_cK355aFNhuaTFANFIWJAdikqQCNkgv4cbpoGQ6BKY';

const PREVIEW_MONTHLY_TOTAL_SOFT = 1000;
const PREVIEW_MONTHLY_TOTAL_HARD = 2000;
const PREVIEW_MONTHLY_FOOD = 400;
const PREVIEW_FOOD_CATEGORIES = new Set(['Food']);

// Save the token, then delete any other tokens registered to the same device
// (same userAgent), so refresh-token doesn't accumulate duplicates.
async function saveTokenAndDedupe(uid, token) {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Los_Angeles';
    const ua = navigator.userAgent;
    const tokensRef = window.firebaseDb.collection('users').doc(uid).collection('fcmTokens');
    await tokensRef.doc(token).set({
        token,
        userAgent: ua,
        tz,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true });

    const snap = await tokensRef.where('userAgent', '==', ua).get();
    const stale = snap.docs.filter(d => d.id !== token);
    await Promise.all(stale.map(d => d.ref.delete()));
    if (stale.length) console.log(`Removed ${stale.length} stale token(s) for this device`);
}

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
        if (!window.firebaseAuth?.currentUser) {
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

        await saveTokenAndDedupe(window.firebaseAuth.currentUser.uid, token);
        console.log('FCM token saved:', token.slice(0, 12) + '...');
        showNotification('Notifications enabled', 'success');
        updateNotificationsUI('granted');
    } catch (err) {
        console.error('enableNotifications failed:', err);
        showNotification('Failed: ' + (err.message || err), 'error');
    }
}

// Silently rotate the token on every app load when permission is already granted.
// iOS aggressively recycles APNs bindings; refreshing on each open keeps delivery
// reliable without the user tapping anything.
async function refreshFcmTokenSilently() {
    try {
        if (!('Notification' in window) || Notification.permission !== 'granted') return;
        if (typeof firebase === 'undefined' || !firebase.messaging) return;
        if (!window.firebaseAuth?.currentUser) return;
        const swReg = await navigator.serviceWorker.register('./firebase-messaging-sw.js');
        const messaging = firebase.messaging();
        const token = await messaging.getToken({ vapidKey: VAPID_KEY, serviceWorkerRegistration: swReg });
        if (!token) return;
        await saveTokenAndDedupe(window.firebaseAuth.currentUser.uid, token);
        console.log('FCM token refreshed silently');
    } catch (err) {
        console.warn('silent token refresh failed:', err.message);
    }
}

function updateNotificationsUI(permission) {
    const status = safeGetElement('notif-status');
    const btn = safeGetElement('enable-notif-btn');
    if (!status || !btn) return;
    if (permission === 'granted') {
        status.textContent = 'Enabled · refreshes automatically each visit';
        btn.textContent = 'Refresh now';
    } else if (permission === 'denied') {
        status.textContent = 'Blocked — enable in iOS Settings → Ledgr → Notifications';
        btn.textContent = 'Try again';
    } else {
        status.textContent = 'Not enabled on this device';
        btn.textContent = 'Enable Notifications';
    }
}

// --- Local preview ("fire now") ---
function previewLocalDateString() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function previewDaysLeft() {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate() - d.getDate() + 1;
}

function previewMonthName() {
    return new Date().toLocaleString('en-US', { month: 'long' });
}

function previewBuildContext() {
    const today = previewLocalDateString();
    const monthPrefix = today.slice(0, 7);
    const all = (window.expenseTracker?.expenses) || [];
    const month = all.filter(e => (e.date || '').startsWith(monthPrefix));
    const todays = month.filter(e => e.date === today);
    const sum = (arr, pred = () => true) => arr.reduce((s, e) => s + (pred(e) ? Number(e.amount || 0) : 0), 0);
    const isFood = e => PREVIEW_FOOD_CATEGORIES.has(e.category);
    const g = window.gamification?.data;
    return {
        todayTotal: sum(todays),
        todayFood: sum(todays, isFood),
        monthTotal: sum(month),
        monthFood: sum(month, isFood),
        daysLeft: previewDaysLeft(),
        todayCount: todays.length,
        monthName: previewMonthName(),
        streak: g?.streak?.current || 0,
        checkedIn: !!g?.dailyLog?.[today]?.checkedIn,
        mood: g?.dailyLog?.[today]?.mood || null
    };
}

const MOOD_LABEL = { 'no-spend': 'No Spend', essential: 'Essentials', wants: 'Wants' };

function previewMessage(slot, ctx) {
    const fmt = n => '$' + Math.round(n);
    const totalRoom = Math.max(0, PREVIEW_MONTHLY_TOTAL_SOFT - ctx.monthTotal);
    const foodRoom = Math.max(0, PREVIEW_MONTHLY_FOOD - ctx.monthFood);
    const dailyTotalTarget = Math.round(totalRoom / Math.max(1, ctx.daysLeft));
    const dailyFoodTarget = Math.round(foodRoom / Math.max(1, ctx.daysLeft));
    const overHard = ctx.monthTotal > PREVIEW_MONTHLY_TOTAL_HARD;
    const overSoft = ctx.monthTotal > PREVIEW_MONTHLY_TOTAL_SOFT;

    if (slot === 'morning') {
        if (overHard) {
            return {
                title: `Heads up — over your ${fmt(PREVIEW_MONTHLY_TOTAL_HARD)} cap`,
                body: `Tighten food today: ${fmt(dailyFoodTarget)} budget left\n${ctx.daysLeft} days to go in ${ctx.monthName}`
            };
        }
        return {
            title: `You can spend ${fmt(dailyTotalTarget)} today`,
            body: `${fmt(dailyFoodTarget)} of that on food\n${ctx.daysLeft} days left in ${ctx.monthName}`
        };
    }

    if (slot === 'afternoon') {
        if (ctx.todayCount === 0) {
            return {
                title: 'Quiet day so far',
                body: `Nothing logged yet\n${fmt(ctx.monthTotal)} of ${fmt(PREVIEW_MONTHLY_TOTAL_SOFT)} this month`
            };
        }
        return {
            title: `${fmt(ctx.todayTotal)} spent so far today`,
            body: `Food: ${fmt(ctx.todayFood)} of ${fmt(PREVIEW_MONTHLY_FOOD)} month cap\n${fmt(ctx.monthTotal)} of ${fmt(PREVIEW_MONTHLY_TOTAL_SOFT)} monthly target`
        };
    }

    // evening
    const paceWord = overHard ? 'over hard cap' : overSoft ? 'over pace' : 'under pace';
    if (!ctx.checkedIn) {
        return {
            title: 'Tag today before bed',
            body: `Tap to log: No Spend, Essentials, or Wants\n${ctx.streak ? `${ctx.streak} day streak going` : 'Start a streak tonight'}`
        };
    }
    const moodLabel = MOOD_LABEL[ctx.mood] || 'Logged';
    const streakBit = ctx.streak ? `${ctx.streak} day streak` : 'first day';
    return {
        title: `${fmt(ctx.todayTotal)} today — ${paceWord}`,
        body: `Tagged "${moodLabel}" — ${streakBit}\n${fmt(ctx.monthTotal)} of ${fmt(PREVIEW_MONTHLY_TOTAL_SOFT)} this month`
    };
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
window.refreshFcmTokenSilently = refreshFcmTokenSilently;
window.updateNotificationsUI = updateNotificationsUI;
window.fireNotificationPreview = fireNotificationPreview;

document.addEventListener('DOMContentLoaded', () => {
    if ('Notification' in window) updateNotificationsUI(Notification.permission);
});
