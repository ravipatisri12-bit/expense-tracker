// Push notification setup via Firebase Cloud Messaging.
// Stores per-device tokens at users/{uid}/fcmTokens/{token}.

const VAPID_KEY = 'BAa26BRj2zy9cHSkOSZDqQB_9Ys4GBUlyUWhnk_A_ErUv_cK355aFNhuaTFANFIWJAdikqQCNkgv4cbpoGQ6BKY';

// MIRROR of the budget model in gmail-import/apps-script.js. This file only
// PREVIEWS notifications locally ("fire now"); the real sender is the Apps Script.
// The two must produce byte-identical copy for the same inputs — change one,
// change both. Spec: docs/superpowers/specs/2026-08-01-event-driven-notifications-design.md
//
// Known drift in the two copies neither file owns: script.js:911 defines
// SOFT/HARD/FOOD inline and script.js:933 `_computeAimToday` duplicates the state
// machine (same numbers), but script.js:904 computes daysLeft EXCLUDING today while
// both senders include it. Left alone deliberately — see the note in apps-script.js.

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

// Days remaining INCLUDING today, matching daysLeftInMonth_() in apps-script.js.
// Derived from local calendar parts, never from a UTC string.
function previewDaysLeft() {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate() - d.getDate() + 1;
}

function previewMonthName() {
    return new Date().toLocaleString('en-US', { month: 'long' });
}

// The one gate meaning "this row counts against my monthly budget".
// Mirrors isBudgetRow_() in apps-script.js exactly.
function previewIsBudgetRow(e) {
    if (e.tripId) return false;
    if (e.excludeFromBudget) return false;
    if ((e.kind || 'variable') !== 'variable') return false;
    return true;
}

function previewBuildContext() {
    const today = previewLocalDateString();
    const monthPrefix = today.slice(0, 7);
    const all = (window.expenseTracker?.expenses) || [];
    const month = all.filter(e => (e.date || '').startsWith(monthPrefix)).filter(previewIsBudgetRow);
    const todays = month.filter(e => e.date === today);
    const sum = (arr) => arr.reduce((s, e) => s + Number(e.amount || 0), 0);
    const g = window.gamification?.data;
    // No food total: with the caps gone there is nothing to compare it against.
    return {
        todayTotal: sum(todays),
        monthTotal: sum(month),
        daysLeft: previewDaysLeft(),
        todayCount: todays.length,
        monthName: previewMonthName(),
        streak: g?.streak?.current || 0,
        checkedIn: !!g?.dailyLog?.[today]?.checkedIn,
        mood: g?.dailyLog?.[today]?.mood || null
    };
}

// Number formatting, mirroring money0_/money2_ in apps-script.js. Whole dollars for
// month totals, exact cents for transaction amounts.
const previewMoney0 = n => '$' + Math.round(Number(n) || 0).toLocaleString('en-US');
const previewMoney2 = n => '$' + (Number(n) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// One sync that imported >= 1 transaction. Merchant only when the batch is exactly 1.
// Mirrors buildSyncBatchMessage_ in apps-script.js.
function previewSyncBatchMessage(batch, ctx) {
    let title = `${batch.count} new · ${previewMoney2(batch.total)}`;
    if (batch.count === 1 && batch.merchant) title += ` · ${batch.merchant}`;
    return { title, body: `${previewMoney0(ctx.monthTotal)} spent in ${ctx.monthName}` };
}

// The 22:00 summary, carrying the habit check-in prompt.
// Mirrors buildEndOfDayMessage_ in apps-script.js.
function previewEndOfDayMessage(ctx) {
    return {
        title: `${previewMoney0(ctx.todayTotal)} today · ${ctx.todayCount} ${ctx.todayCount === 1 ? 'transaction' : 'transactions'}`,
        body: `${previewMoney0(ctx.monthTotal)} spent in ${ctx.monthName} · tap to tag your day`
    };
}

function _activeTripForPreview() {
    if (!window.tripsStore) return null;
    const today = (() => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0'); })();
    return window.tripsStore.getActiveTrip(today);
}

// Trip-themed variants of the same two templates. Preview-only: the Apps Script
// sender has no trip branch, so nothing here needs a mirror on that side.
function _buildTripPreview(kind, trip, batch) {
    if (!window.expenseTracker) return { title: trip.name, body: 'App not ready' };
    const today = (() => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0'); })();
    const expenses = window.expenseTracker.getTripExpenses(trip.id);
    const tripSpent = expenses.reduce((s, e) => s + Number(e.amount || 0), 0);
    const todayTotal = expenses.filter(e => e.date === today).reduce((s, e) => s + Number(e.amount || 0), 0);
    const totalDays = window.expenseTracker._tripTotalDays(trip);
    const dayNum = Math.min(totalDays, window.expenseTracker._tripDayNumber(trip, today));
    const remaining = Math.max(0, trip.budget - tripSpent);
    const daysLeft = Math.max(1, totalDays - dayNum + 1);
    const aim = Math.round(remaining / daysLeft);
    const position = `${previewMoney0(tripSpent)} of ${previewMoney0(trip.budget)}`;
    if (kind === 'sync') {
        let title = `${batch.count} new · ${previewMoney2(batch.total)}`;
        if (batch.count === 1 && batch.merchant) title += ` · ${batch.merchant}`;
        return { title, body: `${trip.name}: ${position} · ${previewMoney0(aim)}/day left` };
    }
    return {
        title: `${previewMoney0(todayTotal)} today · day ${dayNum} of ${totalDays}`,
        body: `${trip.name}: ${position} · tap to tag your day`
    };
}

/**
 * Local "fire now" preview of the real push copy.
 * @param {'sync'|'end-of-day'} kind
 * @param {{count:number,total:number,merchant:?string}} [batch] only used for 'sync'
 */
async function fireNotificationPreview(kind = 'end-of-day', batch = { count: 1, total: 14.5, merchant: 'Mendocino Farms' }) {
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
        const trip = _activeTripForPreview();
        let title, body;
        if (trip) {
            ({ title, body } = _buildTripPreview(kind, trip, batch));
        } else {
            const ctx = previewBuildContext();
            ({ title, body } = kind === 'sync'
                ? previewSyncBatchMessage(batch, ctx)
                : previewEndOfDayMessage(ctx));
        }
        const reg = await navigator.serviceWorker.getRegistration('./firebase-messaging-sw.js')
            || await navigator.serviceWorker.ready;
        // Same per-purpose collapse keys the real sender uses (COLLAPSE_KEY_SYNC /
        // COLLAPSE_KEY_END_OF_DAY in apps-script.js), so a preview supersedes an
        // earlier preview of the same kind instead of stacking.
        const tag = kind === 'sync' ? 'ledgr-sync' : 'ledgr-end-of-day';
        await reg.showNotification(title, { body, icon: 'icon_192.png', badge: 'icon_128.png', tag });
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
