/**
 * Diagnose why a push that FCM reports as "sent" never arrives.
 *
 * Run this ON THE DEVICE that should receive the notification — the Home Screen
 * PWA, not desktop Safari. On iOS you can reach a console via Safari on a Mac:
 * Settings > Safari > Advanced > Web Inspector, then Develop > <device> > Ledgr.
 *
 *   await import('/tools/diagnose-push.js')     (or paste this file)
 *   diagnosePush()
 *
 * The sender side is already verified: FCM returns 200 and the OAuth scope is
 * present. Everything below is device-side, which is where the failure is.
 */
(function () {
    'use strict';

    window.diagnosePush = async function () {
        const line = (k, v, hint) => console.log(String(k).padEnd(26) + ': ' + v + (hint ? '   <-- ' + hint : ''));
        console.log('%cPush diagnostics', 'font-weight:bold;font-size:13px');

        // ---- 1. Is this even a context that can receive web push on iOS? -------
        const standalone = window.navigator.standalone === true ||
            window.matchMedia('(display-mode: standalone)').matches;
        line('installed as PWA', standalone,
            standalone ? '' : 'FATAL on iOS — web push ONLY works from the Home Screen icon');

        const ua = navigator.userAgent;
        const iosMatch = ua.match(/OS (\d+)[._](\d+)/);
        const isIOS = /iPhone|iPad|iPod/.test(ua);
        if (isIOS && iosMatch) {
            const maj = +iosMatch[1], min = +iosMatch[2];
            const ok = maj > 16 || (maj === 16 && min >= 4);
            line('iOS version', maj + '.' + min, ok ? '' : 'FATAL — web push needs iOS 16.4+');
        }
        line('userAgent', ua.slice(0, 78));

        // ---- 2. Permission --------------------------------------------------
        line('Notification.permission', typeof Notification !== 'undefined' ? Notification.permission : 'unsupported',
            (typeof Notification !== 'undefined' && Notification.permission === 'granted')
                ? '' : 'must be "granted" — check iOS Settings > Ledgr > Notifications');

        // ---- 3. Service workers --------------------------------------------
        const regs = await navigator.serviceWorker.getRegistrations();
        line('service workers', regs.length);
        regs.forEach((r, i) => {
            const sw = r.active || r.installing || r.waiting;
            console.log('   [' + i + '] scope=' + r.scope + '  script=' + (sw ? sw.scriptURL.split('/').pop() : '?') +
                '  state=' + (sw ? sw.state : '?'));
        });
        const msgSw = regs.find(r => (r.active || {}).scriptURL && /firebase-messaging-sw/.test(r.active.scriptURL));
        line('messaging SW registered', !!msgSw, msgSw ? '' : 'firebase-messaging-sw.js is NOT active — pushes have nowhere to land');

        // ---- 4. Push subscription — the real test --------------------------
        // A token can look fine to FCM while the browser-level subscription is gone.
        if (msgSw) {
            try {
                const sub = await msgSw.pushManager.getSubscription();
                line('pushManager subscription', sub ? 'present' : 'MISSING',
                    sub ? '' : 'the OS-level subscription is gone — this is why FCM says sent and nothing arrives');
                if (sub) line('  endpoint host', new URL(sub.endpoint).host);
            } catch (e) {
                line('pushManager', 'error: ' + e.message);
            }
        }

        // ---- 5. What tokens does Firestore hold for this user? --------------
        try {
            const uid = window.firebaseAuth?.currentUser?.uid;
            line('signed in', !!uid, uid ? '' : 'sign in first — tokens live under users/{uid}');
            if (uid) {
                const snap = await window.firebaseDb.collection('users').doc(uid).collection('fcmTokens').get();
                line('tokens in Firestore', snap.size, snap.size > 1 ? 'more than one device/binding registered' : '');
                snap.docs.forEach(d => {
                    const v = d.data();
                    console.log('   ...' + d.id.slice(-12) + '  tz=' + (v.tz || '?') +
                        '  ua=' + String(v.userAgent || '').slice(0, 46));
                });

                // Is THIS device's current token among them?
                if (typeof firebase !== 'undefined' && firebase.messaging && msgSw) {
                    try {
                        const cur = await firebase.messaging().getToken({
                            vapidKey: 'BAa26BRj2zy9cHSkOSZDqQB_9Ys4GBUlyUWhnk_A_ErUv_cK355aFNhuaTFANFIWJAdikqQCNkgv4cbpoGQ6BKY',
                            serviceWorkerRegistration: msgSw
                        });
                        const known = snap.docs.some(d => d.id === cur);
                        line('this device token stored', known,
                            known ? '' : 'the token this device would use is NOT in Firestore — the sender is pushing to dead bindings');
                        line('  this token', '...' + String(cur).slice(-12));
                    } catch (e) {
                        line('getToken()', 'FAILED: ' + e.message,
                            'a getToken failure here is the whole problem — APNs refused to issue a binding');
                    }
                }
            }
        } catch (e) {
            line('firestore', 'error: ' + e.message);
        }

        // ---- 6. Prove the display path works, independent of FCM -----------
        console.log('\nNext: run  testLocalNotification()  — shows a notification through the SAME');
        console.log('service worker but WITHOUT FCM. If that appears and the real push does not,');
        console.log('the break is in FCM->APNs delivery, not in permission or the SW.');
    };

    /** Fire a notification locally via the messaging SW. Bypasses FCM entirely. */
    window.testLocalNotification = async function () {
        const regs = await navigator.serviceWorker.getRegistrations();
        const reg = regs.find(r => (r.active || {}).scriptURL && /firebase-messaging-sw/.test(r.active.scriptURL)) || regs[0];
        if (!reg) { console.warn('no service worker registered'); return; }
        await reg.showNotification('Ledgr local test', {
            body: 'If you can see this, permission and the SW are fine.',
            icon: 'icon_192.png', badge: 'icon_128.png', tag: 'ledgr-local-test'
        });
        console.log('showNotification called — check your notification tray');
    };

    /** Clear every stored token, then re-register just this device. */
    window.resetPushTokens = async function (opts) {
        if (!opts || opts.confirm !== true) {
            console.warn('Deletes all fcmTokens docs and re-registers this device.');
            console.warn('Run: resetPushTokens({confirm:true})');
            return;
        }
        const uid = window.firebaseAuth?.currentUser?.uid;
        if (!uid) { console.warn('sign in first'); return; }
        const ref = window.firebaseDb.collection('users').doc(uid).collection('fcmTokens');
        const snap = await ref.get();
        await Promise.all(snap.docs.map(d => d.ref.delete()));
        console.log('deleted ' + snap.size + ' token(s)');
        if (typeof enableNotifications === 'function') {
            await enableNotifications();
            console.log('re-registered this device');
        } else {
            console.log('now tap Enable Notifications in Settings');
        }
    };

    console.log('%cLoaded.', 'font-weight:bold', 'Run diagnosePush() on the DEVICE that should receive pushes.');
    console.log('  diagnosePush()            what is broken');
    console.log('  testLocalNotification()   does the display path work at all');
    console.log('  resetPushTokens({confirm:true})');
})();
