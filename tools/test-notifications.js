// Unit harness for the event-driven notification logic in gmail-import/apps-script.js.
//
// That file runs on Google's servers and is NOT covered by ./test.sh, so this is the
// only automated check on it. It loads the real source with node's `vm` module against
// stubbed Apps Script globals — same pattern as /tmp/pwdrv/test-appsscript-logic.js —
// so there is no second copy of the logic to drift.
//
//   node tools/test-notifications.js
//
// The script timezone is forced to America/New_York to match appsscript.json, because
// two of the bugs under test only appear when the script zone and NOTIFICATION_TZ
// disagree. Re-exec with TZ set if we were not started that way.
if (process.env.TZ !== 'America/New_York') {
    require('child_process').execFileSync(
        process.execPath, [__filename],
        { stdio: 'inherit', env: Object.assign({}, process.env, { TZ: 'America/New_York' }) }
    );
    process.exit(0);
}

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const SRC = path.join(__dirname, '..', 'gmail-import', 'apps-script.js');
const source = fs.readFileSync(SRC, 'utf8');

const UID = 'u1';
const PROJECT = 'p1';

// ---------------------------------------------------------------------------
// Assertions
// ---------------------------------------------------------------------------
const failures = [];
function check(name, got, want) {
    const ok = JSON.stringify(got) === JSON.stringify(want);
    console.log((ok ? 'PASS  ' : 'FAIL  ') + name);
    if (!ok) {
        console.log('        got  ' + JSON.stringify(got));
        console.log('        want ' + JSON.stringify(want));
        failures.push(name);
    }
}
function section(s) { console.log('\n=== ' + s + ' ==='); }

// ---------------------------------------------------------------------------
// Apps Script stubs
// ---------------------------------------------------------------------------

// Real timezone conversion, so a formatDate in America/Los_Angeles genuinely differs
// from the process (script) zone. A fake that ignored the tz argument would make the
// timezone tests vacuous.
function formatDate(date, tz, fmt) {
    const parts = {};
    new Intl.DateTimeFormat('en-US', {
        timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', hour12: false
    }).formatToParts(date).forEach(p => { parts[p.type] = p.value; });
    const monthName = new Intl.DateTimeFormat('en-US', { timeZone: tz, month: 'long' }).format(date);
    switch (fmt) {
        case 'yyyy-MM-dd': return `${parts.year}-${parts.month}-${parts.day}`;
        case 'yyyy': return parts.year;
        case 'MM': return parts.month;
        case 'dd': return parts.day;
        case 'MMMM': return monthName;
        default: throw new Error('stub formatDate: unhandled format ' + fmt);
    }
}

/** Firestore/FCM response stub. */
function response(code, body) {
    return { getResponseCode: () => code, getContentText: () => (typeof body === 'string' ? body : JSON.stringify(body || {})) };
}

/** Firestore REST encoding of an expense row. */
function fsExpense(e) {
    const fields = {
        amount: { doubleValue: e.amount },
        category: { stringValue: e.category || 'Other' },
        date: { stringValue: e.date }
    };
    if (e.tripId) fields.tripId = { stringValue: e.tripId };
    if (e.excludeFromBudget !== undefined) fields.excludeFromBudget = { booleanValue: e.excludeFromBudget };
    if (e.kind) fields.kind = { stringValue: e.kind };
    return { document: { name: `projects/${PROJECT}/databases/(default)/documents/users/${UID}/expenses/x`, fields } };
}

/**
 * Build a fresh sandbox. `world` describes the fake backend; everything the harness
 * wants to observe lands on `world.log`.
 */
function makeSandbox(world) {
    world.log = { fcmSends: [], tokenDeletes: [], expenseWrites: [], ledgerSaves: [], logs: [] };
    const w = world;

    function route(url, options) {
        const method = ((options && options.method) || 'get').toLowerCase();

        if (url.indexOf('fcm.googleapis.com') >= 0) {
            const payload = JSON.parse(options.payload);
            w.log.fcmSends.push(payload.message);
            return w.fcmResponse ? w.fcmResponse(payload.message) : response(200, { name: 'ok' });
        }
        if (url.indexOf(':runQuery') >= 0) {
            if (w.expenseQueryStatus && w.expenseQueryStatus !== 200) {
                return response(w.expenseQueryStatus, { error: { code: w.expenseQueryStatus, status: 'PERMISSION_DENIED' } });
            }
            return response(200, (w.expenses || []).map(fsExpense));
        }
        if (url.indexOf('/state/gamification') >= 0) {
            if (w.gamificationStatus && w.gamificationStatus !== 200) return response(w.gamificationStatus, 'nope');
            return response(200, w.gamification || {});
        }
        if (url.indexOf('/fcmTokens/') >= 0 && method === 'delete') {
            w.log.tokenDeletes.push(url.split('/').pop());
            return response(200, {});
        }
        if (url.indexOf('/fcmTokens') >= 0) {
            if (w.tokenListStatus && w.tokenListStatus !== 200) return response(w.tokenListStatus, 'nope');
            return response(200, {
                documents: (w.tokens || []).map(t => ({
                    name: `projects/${PROJECT}/databases/(default)/documents/users/${UID}/fcmTokens/${t}`,
                    fields: { token: { stringValue: t } }
                }))
            });
        }
        if (url.indexOf('/settings/gmail_sync') >= 0) {
            if (method === 'patch') {
                w.log.ledgerSaves.push(JSON.parse(options.payload)
                    .fields.processedIds.arrayValue.values.map(v => v.stringValue));
                return response(200, {});
            }
            const ids = w.processedIds || [];
            if (!ids.length) return response(404, {});
            return response(200, { fields: { processedIds: { arrayValue: { values: ids.map(id => ({ stringValue: id })) } } } });
        }
        if (url.indexOf('/expenses') >= 0 && method === 'post') {
            w.log.expenseWrites.push(JSON.parse(options.payload).fields);
            return response(w.expenseWriteStatus || 200, {});
        }
        if (url.indexOf('/expenses') >= 0) return response(200, { documents: [] });

        throw new Error('unrouted URL in stub: ' + method + ' ' + url);
    }

    const sandbox = {
        console,
        Logger: { log: m => w.log.logs.push(String(m)) },
        PropertiesService: {
            getScriptProperties: () => ({
                getProperty: k => ({
                    FIREBASE_UID: UID,
                    FIREBASE_PROJECT_ID: PROJECT,
                    MERCHANT_MAP: JSON.stringify(w.merchantMap || {})
                }[k] || null),
                setProperty: () => {},
                setProperties: () => {}
            })
        },
        ScriptApp: {
            getOAuthToken: () => 'tok',
            getProjectTriggers: () => w.triggers || [],
            deleteTrigger: t => { w.triggers = (w.triggers || []).filter(x => x !== t); (w.deletedTriggers = w.deletedTriggers || []).push(t.getHandlerFunction()); },
            newTrigger: fn => {
                const b = {
                    timeBased: () => b, atHour: () => b, everyDays: () => b, everyMinutes: () => b, inTimezone: () => b,
                    create: () => { (w.createdTriggers = w.createdTriggers || []).push(fn); }
                };
                return b;
            }
        },
        UrlFetchApp: { fetch: route },
        GmailApp: { getUserLabelByName: () => w.label || null },
        Utilities: { formatDate },
        Session: { getScriptTimeZone: () => 'America/New_York' }
    };

    // `now` injection: the source reads `new Date()` in a couple of places, so shadow
    // the constructor inside the sandbox when a fixed clock is requested.
    if (w.now) {
        const RealDate = Date;
        const fixed = w.now.getTime();
        function FakeDate(...args) {
            if (!args.length) return new RealDate(fixed);
            return new RealDate(...args);
        }
        FakeDate.prototype = RealDate.prototype;
        FakeDate.now = () => fixed;
        FakeDate.UTC = RealDate.UTC;
        FakeDate.parse = RealDate.parse;
        sandbox.Date = FakeDate;
    }

    const ctx = vm.createContext(sandbox);
    vm.runInContext(source, ctx);
    return ctx;
}

/** Gmail thread/message stubs. */
function gmailLabel(threads) {
    return { getThreads: () => threads };
}
function gmailThread(messages) {
    const t = { _read: false, isUnread: () => true, getMessages: () => messages, markRead: () => { t._read = true; } };
    return t;
}
function gmailMessage(id, subject, body, date) {
    return { getId: () => id, getSubject: () => subject, getPlainBody: () => body, getDate: () => date };
}

// ===========================================================================
// (a) batch-of-1 copy includes the merchant, batch-of-N does not
// ===========================================================================
section('(a) sync batch copy: merchant only when count === 1');

// Aug 15 2026 12:00 PDT. daysLeft = 31 - 15 + 1 = 17 (today counts).
// monthTotal 450, HEALTHY, so dailyTotal = round((1000 - 450) / 17) = 32.
const AUG15 = new Date('2026-08-15T19:00:00Z');
const MONTH_450 = [
    { amount: 200, category: 'Shopping', date: '2026-08-02' },
    { amount: 250, category: 'Food', date: '2026-08-10' }
];

{
    const ctx = makeSandbox({ now: AUG15, expenses: MONTH_450, gamification: {} });
    const bctx = ctx.buildBudgetContext_({ uid: UID, projectId: PROJECT });

    check('daysLeft on Aug 15 includes today', bctx.daysLeft, 17);
    check('monthTotal', bctx.monthTotal, 450);

    const one = ctx.buildSyncBatchMessage_({ count: 1, total: 14.5, merchant: 'Mendocino Farms' }, bctx);
    check('batch of 1 title has merchant', one.title, '1 new · $14.50 · Mendocino Farms');
    check('batch of 1 body', one.body, '$450 spent in August');

    const two = ctx.buildSyncBatchMessage_({ count: 2, total: 27.45, merchant: 'Mendocino Farms' }, bctx);
    check('batch of 2 title omits merchant', two.title, '2 new · $27.45');
    check('batch of 2 body identical to batch of 1', two.body, one.body);
    check('batch of 2 title has no merchant substring', /Mendocino/.test(two.title), false);

    // Thousands separators must survive a four-figure amount.
    const big = ctx.buildSyncBatchMessage_({ count: 1, total: 1234.5, merchant: 'BIG STORE' }, bctx);
    check('batch amount formats thousands', big.title, '1 new · $1,234.50 · BIG STORE');
}

section('end-of-day copy');
{
    // $62 across 4 rows today, $450 earlier ⇒ $512 month total.
    const expenses = MONTH_450.concat([
        { amount: 20, category: 'Food', date: '2026-08-15' },
        { amount: 20, category: 'Food', date: '2026-08-15' },
        { amount: 12, category: 'Shopping', date: '2026-08-15' },
        { amount: 10, category: 'Shopping', date: '2026-08-15' }
    ]);
    const ctx = makeSandbox({ now: AUG15, expenses, gamification: {} });
    const bctx = ctx.buildBudgetContext_({ uid: UID, projectId: PROJECT });
    check('todayTotal', bctx.todayTotal, 62);
    check('todayCount', bctx.todayCount, 4);
    check('monthTotal', bctx.monthTotal, 512);

    const eod = ctx.buildEndOfDayMessage_(bctx);
    check('end-of-day title', eod.title, '$62 today · 4 transactions');
    check('end-of-day body carries the check-in prompt', eod.body, '$512 spent in August · tap to tag your day');

    // Singular/plural, because "1 transactions" reads broken.
    const oneTx = Object.assign({}, bctx, { todayTotal: 14, todayCount: 1 });
    check('end-of-day singular', ctx.buildEndOfDayMessage_(oneTx).title, '$14 today · 1 transaction');
}

section('end-of-day carries the habit data key + collapse key');
{
    const expenses = MONTH_450;
    const world = { now: AUG15, expenses, gamification: {}, tokens: ['tokA'] };
    const ctx = makeSandbox(world);
    ctx.sendEndOfDaySummary();
    check('one send', world.log.fcmSends.length, 1);
    const m = world.log.fcmSends[0] || {};
    check('data.view = habit', m.data && m.data.view, 'habit');
    check('apns collapse id', m.apns && m.apns.headers['apns-collapse-id'], 'ledgr-end-of-day');
    check('android collapse key', m.android && m.android.collapse_key, 'ledgr-end-of-day');
    check('webpush tag', m.webpush && m.webpush.notification.tag, 'ledgr-end-of-day');
}

section('sync batch collapse key differs from end-of-day');
{
    const world = { now: AUG15, expenses: MONTH_450, gamification: {}, tokens: ['tokA'] };
    const ctx = makeSandbox(world);
    ctx.notifySyncBatch_({ uid: UID, projectId: PROJECT }, { count: 1, total: 14.5, merchant: 'M' });
    const m = world.log.fcmSends[0] || {};
    check('sync collapse key', m.apns && m.apns.headers['apns-collapse-id'], 'ledgr-sync');
    check('sync collapse key is not the end-of-day one',
        (m.apns && m.apns.headers['apns-collapse-id']) === 'ledgr-end-of-day', false);
    check('sync data.view = transactions', m.data && m.data.view, 'transactions');
}

// ===========================================================================
// (b) a run importing nothing sends nothing
// ===========================================================================
section('(b) imported nothing ⇒ sent nothing');

const CHASE_SUBJECT = 'You made a $14.50 transaction with MENDOCINO FARMS';
const CHASE_BODY = 'Date   Aug 15, 2026 at 5:43 PM ET';

{
    // No unread threads at all.
    const world = { now: AUG15, expenses: MONTH_450, gamification: {}, tokens: ['tokA'], label: gmailLabel([]) };
    const ctx = makeSandbox(world);
    ctx.processChaseEmails();
    check('no unread mail ⇒ no push', world.log.fcmSends.length, 0);
}
{
    // Unread, but every message is already in the ledger (a retried run).
    const msg = gmailMessage('m1', CHASE_SUBJECT, CHASE_BODY, AUG15);
    const world = {
        now: AUG15, expenses: MONTH_450, gamification: {}, tokens: ['tokA'],
        processedIds: ['gm_m1'], label: gmailLabel([gmailThread([msg])])
    };
    const ctx = makeSandbox(world);
    ctx.processChaseEmails();
    check('already-in-ledger ⇒ no push (no re-notify on retry)', world.log.fcmSends.length, 0);
    check('already-in-ledger ⇒ no expense write', world.log.expenseWrites.length, 0);
}
{
    // Unread, but the subject is not a transaction alert.
    const msg = gmailMessage('m2', 'Your statement is ready', '', AUG15);
    const world = {
        now: AUG15, expenses: MONTH_450, gamification: {}, tokens: ['tokA'],
        label: gmailLabel([gmailThread([msg])])
    };
    const ctx = makeSandbox(world);
    ctx.processChaseEmails();
    check('unparseable subject ⇒ no push', world.log.fcmSends.length, 0);
}
{
    // A write failure imported nothing, so nothing is announced.
    const msg = gmailMessage('m3', CHASE_SUBJECT, CHASE_BODY, AUG15);
    const world = {
        now: AUG15, expenses: MONTH_450, gamification: {}, tokens: ['tokA'],
        expenseWriteStatus: 500, label: gmailLabel([gmailThread([msg])])
    };
    const ctx = makeSandbox(world);
    ctx.processChaseEmails();
    check('failed write ⇒ no push', world.log.fcmSends.length, 0);
}

section('ONE push per sync, not one per transaction');
{
    const msgs = [
        gmailMessage('m10', 'You made a $14.50 transaction with MENDOCINO FARMS', CHASE_BODY, AUG15),
        gmailMessage('m11', 'You made a $12.95 transaction with BLUE BOTTLE', CHASE_BODY, AUG15)
    ];
    const world = {
        now: AUG15, expenses: MONTH_450, gamification: {}, tokens: ['tokA'],
        label: gmailLabel([gmailThread(msgs)])
    };
    const ctx = makeSandbox(world);
    ctx.processChaseEmails();
    check('2 imported ⇒ exactly 1 push', world.log.fcmSends.length, 1);
    check('2 imported ⇒ 2 expense writes', world.log.expenseWrites.length, 2);
    const n = world.log.fcmSends[0].notification;
    check('batched title sums the batch', n.title, '2 new · $27.45');
    check('batched title omits merchant', /MENDOCINO|BLUE/.test(n.title), false);
}
{
    // A 50-row backlog sweep must still be one push.
    const msgs = [];
    for (let i = 0; i < 50; i++) msgs.push(gmailMessage('b' + i, 'You made a $1.00 transaction with SHOP ' + i, CHASE_BODY, AUG15));
    const world = {
        now: AUG15, expenses: MONTH_450, gamification: {}, tokens: ['tokA'],
        label: gmailLabel([gmailThread(msgs)])
    };
    const ctx = makeSandbox(world);
    ctx.processChaseEmails();
    check('50-row backlog ⇒ exactly 1 push', world.log.fcmSends.length, 1);
    check('50-row backlog title', world.log.fcmSends[0].notification.title, '50 new · $50.00');
}
{
    // Exactly one imported ⇒ the merchant appears, end to end.
    const msg = gmailMessage('m20', CHASE_SUBJECT, CHASE_BODY, AUG15);
    const world = {
        now: AUG15, expenses: MONTH_450, gamification: {}, tokens: ['tokA'],
        label: gmailLabel([gmailThread([msg])])
    };
    const ctx = makeSandbox(world);
    ctx.processChaseEmails();
    check('1 imported ⇒ 1 push', world.log.fcmSends.length, 1);
    check('1 imported title names the merchant',
        world.log.fcmSends[0].notification.title, '1 new · $14.50 · MENDOCINO FARMS');
}

// ===========================================================================
// (c) a Firestore 4xx sends NOTHING (not a HEALTHY message)
// ===========================================================================
section('(c) failed Firestore read ⇒ send nothing, never invented numbers');
{
    const world = { now: AUG15, expenseQueryStatus: 403, gamification: {}, tokens: ['tokA'] };
    const ctx = makeSandbox(world);
    ctx.sendEndOfDaySummary();
    check('403 on expense query ⇒ end-of-day sends nothing', world.log.fcmSends.length, 0);
    check('403 is logged as an abort', world.log.logs.some(l => /ABORT/.test(l)), true);
    // The old code returned [] here, so monthTotal was 0 and the target computed
    // HEALTHY — the push announced full headroom it had no evidence for.
    check('no push claims a budget position', world.log.logs.some(l => /of \$1,000/.test(l)), false);
}
{
    const world = { now: AUG15, expenseQueryStatus: 400, gamification: {}, tokens: ['tokA'] };
    const ctx = makeSandbox(world);
    ctx.notifySyncBatch_({ uid: UID, projectId: PROJECT }, { count: 1, total: 14.5, merchant: 'M' });
    check('400 on expense query ⇒ sync batch sends nothing', world.log.fcmSends.length, 0);
}
{
    // A notification failure must not make the import look failed: the rows are
    // already durably in Firestore and the email is already marked read.
    const msg = gmailMessage('m30', CHASE_SUBJECT, CHASE_BODY, AUG15);
    const thread = gmailThread([msg]);
    const world = {
        now: AUG15, expenseQueryStatus: 403, gamification: {}, tokens: ['tokA'],
        label: gmailLabel([thread])
    };
    const ctx = makeSandbox(world);
    ctx.processChaseEmails();
    check('import still succeeds when notification aborts', world.log.expenseWrites.length, 1);
    check('ledger still saved when notification aborts', world.log.ledgerSaves.length, 1);
    check('thread still marked read', thread._read, true);
    check('nothing sent', world.log.fcmSends.length, 0);
}
{
    const world = { now: AUG15, expenses: MONTH_450, gamificationStatus: 500, tokens: ['tokA'] };
    const ctx = makeSandbox(world);
    ctx.sendEndOfDaySummary();
    check('500 on gamification read ⇒ sends nothing', world.log.fcmSends.length, 0);
}
{
    // 404 on gamification is legitimate — never checked in — and must NOT abort.
    const world = { now: AUG15, expenses: MONTH_450, gamificationStatus: 404, tokens: ['tokA'] };
    const ctx = makeSandbox(world);
    ctx.sendEndOfDaySummary();
    check('404 on gamification still sends (no doc yet is valid)', world.log.fcmSends.length, 1);
}
{
    const world = { now: AUG15, expenses: MONTH_450, gamification: {}, tokenListStatus: 403 };
    const ctx = makeSandbox(world);
    ctx.sendEndOfDaySummary();
    check('403 on token list ⇒ sends nothing', world.log.fcmSends.length, 0);
}

// ===========================================================================
// (d) malformed-request FCM error keeps the token; genuine UNREGISTERED deletes it
// ===========================================================================
section('(d) stale-token detection matches the FCM error code, not the body text');

const FCM_ERR = {
    // FCM's response when the token is genuinely dead.
    unregistered: {
        error: {
            code: 404, message: 'Requested entity was not found.', status: 'NOT_FOUND',
            details: [{ '@type': 'type.googleapis.com/google.firebase.fcm.v1.FcmError', errorCode: 'UNREGISTERED' }]
        }
    },
    // Malformed request — says nothing about the token.
    invalidArgument: {
        error: {
            code: 400, message: 'Invalid value at \'message.notification\'', status: 'INVALID_ARGUMENT',
            details: [{ '@type': 'type.googleapis.com/google.rpc.BadRequest', fieldViolations: [{ field: 'message' }] }]
        }
    },
    // Wrong project path — one typo in projectId returns this for EVERY token.
    wrongProject: {
        error: { code: 404, message: 'Requested entity was not found.', status: 'NOT_FOUND' }
    },
    permissionDenied: {
        error: { code: 403, message: 'Permission denied on resource project.', status: 'PERMISSION_DENIED' }
    },
    // A diagnostic that merely mentions the word — the old substring match fired on this.
    mentionsWord: {
        error: {
            code: 400, message: 'The registration token is not a valid FCM token; it may be UNREGISTERED elsewhere.',
            status: 'INVALID_ARGUMENT'
        }
    },
    quota: { error: { code: 429, message: 'Quota exceeded.', status: 'RESOURCE_EXHAUSTED' } }
};

{
    const ctx = makeSandbox({});
    check('classify UNREGISTERED detail ⇒ stale', ctx.classifyFcmError_(JSON.stringify(FCM_ERR.unregistered)), 'stale');
    check('classify INVALID_ARGUMENT (bad request) ⇒ error', ctx.classifyFcmError_(JSON.stringify(FCM_ERR.invalidArgument)), 'error');
    check('classify NOT_FOUND (wrong project) ⇒ error', ctx.classifyFcmError_(JSON.stringify(FCM_ERR.wrongProject)), 'error');
    check('classify PERMISSION_DENIED ⇒ error', ctx.classifyFcmError_(JSON.stringify(FCM_ERR.permissionDenied)), 'error');
    check('classify RESOURCE_EXHAUSTED ⇒ error', ctx.classifyFcmError_(JSON.stringify(FCM_ERR.quota)), 'error');
    check('classify body that merely mentions UNREGISTERED ⇒ error', ctx.classifyFcmError_(JSON.stringify(FCM_ERR.mentionsWord)), 'error');
    check('classify unparseable body ⇒ error', ctx.classifyFcmError_('<html>502 Bad Gateway</html>'), 'error');
    check('classify empty body ⇒ error', ctx.classifyFcmError_(''), 'error');
}

{
    // Malformed request against three tokens: keep all three.
    const world = {
        now: AUG15, expenses: MONTH_450, gamification: {}, tokens: ['tokA', 'tokB', 'tokC'],
        fcmResponse: () => response(400, FCM_ERR.invalidArgument)
    };
    const ctx = makeSandbox(world);
    ctx.sendEndOfDaySummary();
    check('malformed request deletes NO tokens', world.log.tokenDeletes, []);
    check('all three were attempted', world.log.fcmSends.length, 3);
    check('misconfiguration is called out in the log',
        world.log.logs.some(l => /WARNING: every token errored/.test(l)), true);
}
{
    // The catastrophic case: a projectId typo used to wipe the collection.
    const world = {
        now: AUG15, expenses: MONTH_450, gamification: {}, tokens: ['tokA', 'tokB', 'tokC', 'tokD'],
        fcmResponse: () => response(404, FCM_ERR.wrongProject)
    };
    const ctx = makeSandbox(world);
    ctx.sendEndOfDaySummary();
    check('wrong project path deletes NO tokens', world.log.tokenDeletes, []);
}
{
    // A genuinely dead token is still cleaned up.
    const world = {
        now: AUG15, expenses: MONTH_450, gamification: {}, tokens: ['tokA', 'tokB'],
        fcmResponse: m => (m.token === 'tokA' ? response(404, FCM_ERR.unregistered) : response(200, { name: 'ok' }))
    };
    const ctx = makeSandbox(world);
    ctx.sendEndOfDaySummary();
    check('genuine UNREGISTERED deletes exactly that token', world.log.tokenDeletes, ['tokA']);
}
{
    // Mixed failure modes: only the UNREGISTERED one goes.
    const map = {
        tokA: response(404, FCM_ERR.unregistered),
        tokB: response(400, FCM_ERR.invalidArgument),
        tokC: response(403, FCM_ERR.permissionDenied),
        tokD: response(429, FCM_ERR.quota),
        tokE: response(400, FCM_ERR.mentionsWord)
    };
    const world = {
        now: AUG15, expenses: MONTH_450, gamification: {}, tokens: Object.keys(map),
        fcmResponse: m => map[m.token]
    };
    const ctx = makeSandbox(world);
    ctx.sendEndOfDaySummary();
    check('mixed errors delete only the UNREGISTERED token', world.log.tokenDeletes, ['tokA']);
}

// ===========================================================================
// (e) daysLeft is correct on Aug 31 22:00 PDT and Feb 28, script TZ = New York
// ===========================================================================
section('(e) daysLeftInMonth_ across month boundaries (script TZ = America/New_York)');

check('process TZ is New York (matches appsscript.json)',
    Intl.DateTimeFormat().resolvedOptions().timeZone, 'America/New_York');

// The bug being fixed, reproduced from the old formula: day-of-month in LA, but
// month/year via getFullYear()/getMonth(), which resolve in the SCRIPT zone.
function oldDaysLeft(now) {
    const day = parseInt(formatDate(now, 'America/Los_Angeles', 'dd'), 10);
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    return lastDay - day + 1;
}

const boundaries = [
    // Aug 31 2026 22:00 PDT === Sep 1 01:00 ET. LA day 31, Aug has 31 days ⇒ 1 left.
    { label: 'Aug 31 22:00 PDT', utc: '2026-09-01T05:00:00Z', want: 1, buggy: 0 },
    // Feb 28 2026 22:00 PST === Mar 1 01:00 ET. Feb 2026 has 28 days ⇒ 1 left.
    { label: 'Feb 28 22:00 PST (non-leap)', utc: '2026-03-01T06:00:00Z', want: 1, buggy: 4 },
    // Feb 28 2028 22:00 PST === Feb 29 01:00 ET. Feb 2028 has 29 days ⇒ 2 left.
    { label: 'Feb 28 22:00 PST (leap year)', utc: '2028-02-29T06:00:00Z', want: 2, buggy: 2 },
    // Dec 31 2026 22:00 PST === Jan 1 2027 01:00 ET — the year must come from LA too.
    { label: 'Dec 31 22:00 PST (year boundary)', utc: '2027-01-01T06:00:00Z', want: 1, buggy: 1 },
    // Jan 31 2026 22:00 PST === Feb 1 01:00 ET.
    { label: 'Jan 31 22:00 PST', utc: '2026-02-01T06:00:00Z', want: 1, buggy: -2 },
    // Apr 30 2026 22:00 PDT === May 1 01:00 EDT.
    { label: 'Apr 30 22:00 PDT', utc: '2026-05-01T05:00:00Z', want: 1, buggy: 2 },
    // Mid-month, both zones agree — a control.
    { label: 'Aug 15 12:00 PDT (control)', utc: '2026-08-15T19:00:00Z', want: 17, buggy: 17 },
    // First of the month.
    { label: 'Sep 1 09:00 PDT', utc: '2026-09-01T16:00:00Z', want: 30, buggy: 30 }
];

{
    const ctx = makeSandbox({});
    boundaries.forEach(b => {
        const now = new Date(b.utc);
        check('daysLeft ' + b.label, ctx.daysLeftInMonth_(now), b.want);
        // Prove the test would have caught the old bug where it actually differed.
        const old = oldDaysLeft(now);
        check('  (old formula returned ' + old + ' — regression guard)', old, b.buggy);
    });
    // A zero would make getActiveTarget_ divide by Math.max(1, 0) and quietly
    // misreport the daily allowance, which is how the bug stayed invisible.
    check('no boundary yields 0 days left',
        boundaries.every(b => ctx.daysLeftInMonth_(new Date(b.utc)) >= 1), true);
}

// ===========================================================================
// (f) excludeFromBudget rows are excluded from monthTotal
// ===========================================================================
section('(f) excludeFromBudget is filtered');
{
    const expenses = [
        { amount: 200, category: 'Shopping', date: '2026-08-02' },
        { amount: 250, category: 'Food', date: '2026-08-10' },
        { amount: 420, category: 'Transportation', date: '2026-08-12', excludeFromBudget: true }
    ];
    const ctx = makeSandbox({ now: AUG15, expenses, gamification: {} });
    const bctx = ctx.buildBudgetContext_({ uid: UID, projectId: PROJECT });
    // The spec's worked example: with a $420 excluded car repair, Home says
    // $450 of $1,000 and the push used to say $870 of $1,000.
    check('excluded row not in monthTotal', bctx.monthTotal, 450);
    check('parser exposes excludeFromBudget', ctx.fetchExpensesFromFirestore_({ uid: UID, projectId: PROJECT }, '2026-08-01', '2026-08-15')[2].excludeFromBudget, true);
    check('push body agrees with Home', ctx.buildEndOfDayMessage_(bctx).body, '$450 spent in August · tap to tag your day');
}
{
    // Excluded rows dated today must also drop out of the today figures.
    const expenses = [
        { amount: 20, category: 'Food', date: '2026-08-15' },
        { amount: 420, category: 'Transportation', date: '2026-08-15', excludeFromBudget: true }
    ];
    const ctx = makeSandbox({ now: AUG15, expenses, gamification: {} });
    const bctx = ctx.buildBudgetContext_({ uid: UID, projectId: PROJECT });
    check('excluded row not in todayTotal', bctx.todayTotal, 20);
    check('excluded row not in todayCount', bctx.todayCount, 1);
}
{
    // tripId still excludes, unchanged behaviour.
    const expenses = [
        { amount: 100, category: 'Food', date: '2026-08-10' },
        { amount: 900, category: 'Food', date: '2026-08-11', tripId: 'trip1' }
    ];
    const ctx = makeSandbox({ now: AUG15, expenses, gamification: {} });
    check('trip row not in monthTotal', ctx.buildBudgetContext_({ uid: UID, projectId: PROJECT }).monthTotal, 100);
}

// ===========================================================================
// (g) kind:'income' and kind:'fixed' are excluded from monthTotal
// ===========================================================================
section("(g) kind gate: only 'variable' (or absent) counts as spending");
{
    const expenses = [
        { amount: 200, category: 'Shopping', date: '2026-08-02' },                    // absent kind ⇒ variable
        { amount: 250, category: 'Food', date: '2026-08-10', kind: 'variable' },
        { amount: 4000, category: 'Other', date: '2026-08-01', kind: 'income' },
        { amount: 1200, category: 'Bills', date: '2026-08-01', kind: 'fixed' }
    ];
    const ctx = makeSandbox({ now: AUG15, expenses, gamification: {} });
    const bctx = ctx.buildBudgetContext_({ uid: UID, projectId: PROJECT });
    // Ungated, monthTotal would be 5,650 ⇒ HARD_OVER ⇒ a false "over the cap" push.
    check('income + fixed excluded from monthTotal', bctx.monthTotal, 450);
    check('absent kind counts as variable', ctx.isBudgetRow_({ amount: 1, date: 'x' }), true);
    check("explicit kind:'variable' counts", ctx.isBudgetRow_({ kind: 'variable' }), true);
    check("kind:'income' does not count", ctx.isBudgetRow_({ kind: 'income' }), false);
    check("kind:'fixed' does not count", ctx.isBudgetRow_({ kind: 'fixed' }), false);
    check('unknown future kind does not count (fail closed)', ctx.isBudgetRow_({ kind: 'refund' }), false);
    check('parser defaults kind to variable',
        ctx.fetchExpensesFromFirestore_({ uid: UID, projectId: PROJECT }, '2026-08-01', '2026-08-15')[0].kind, 'variable');
    check('income/excluded rows stay out of monthTotal (no cap states remain)', bctx.monthTotal, 450);
}
{
    // Income dated today must not inflate the end-of-day "today" figure either.
    const expenses = [
        { amount: 62, category: 'Food', date: '2026-08-15' },
        { amount: 4000, category: 'Other', date: '2026-08-15', kind: 'income' }
    ];
    const ctx = makeSandbox({ now: AUG15, expenses, gamification: {} });
    const bctx = ctx.buildBudgetContext_({ uid: UID, projectId: PROJECT });
    check('income excluded from todayTotal', bctx.todayTotal, 62);
    check('income excluded from todayCount', bctx.todayCount, 1);
    check('end-of-day title unaffected by income', ctx.buildEndOfDayMessage_(bctx).title, '$62 today · 1 transaction');
}

// ===========================================================================
// Trigger retirement — targeted, and the importer survives
// ===========================================================================
section('trigger retirement is targeted (the 15-minute importer must survive)');
{
    const trig = fn => ({ getHandlerFunction: () => fn });
    const world = {
        triggers: [
            trig('processChaseEmails'),
            trig('sendMorningNotification'),
            trig('sendAfternoonNotification'),
            trig('sendEveningNotification')
        ]
    };
    const ctx = makeSandbox(world);
    ctx.setupNotifications();
    check('deleted exactly the three retired slot triggers',
        (world.deletedTriggers || []).sort(),
        ['sendAfternoonNotification', 'sendEveningNotification', 'sendMorningNotification']);
    check('processChaseEmails trigger survives',
        world.triggers.some(t => t.getHandlerFunction() === 'processChaseEmails'), true);
    check('created the single end-of-day trigger', world.createdTriggers, ['sendEndOfDaySummary']);
}
{
    // Re-running setup must not accumulate duplicate end-of-day triggers.
    const trig = fn => ({ getHandlerFunction: () => fn });
    const world = { triggers: [trig('processChaseEmails'), trig('sendEndOfDaySummary')] };
    const ctx = makeSandbox(world);
    ctx.setupNotifications();
    check('setup is idempotent: old end-of-day trigger removed', world.deletedTriggers, ['sendEndOfDaySummary']);
    check('setup is idempotent: exactly one created', world.createdTriggers, ['sendEndOfDaySummary']);
    check('importer still survives',
        world.triggers.some(t => t.getHandlerFunction() === 'processChaseEmails'), true);
}
{
    const ctx = makeSandbox({});
    check('the retired slot handlers no longer exist', [
        typeof ctx.sendMorningNotification,
        typeof ctx.sendAfternoonNotification,
        typeof ctx.sendEveningNotification,
        typeof ctx.sendNotification_,
        typeof ctx.buildNotificationMessage_
    ], ['undefined', 'undefined', 'undefined', 'undefined', 'undefined']);
    check('the new handlers do exist', [
        typeof ctx.sendEndOfDaySummary,
        typeof ctx.notifySyncBatch_,
        typeof ctx.retireFixedNotificationTriggers
    ], ['function', 'function', 'function']);
}

// ===========================================================================
// Budget-model parity with js/notifications.js (the mirrored preview copy)
// ===========================================================================
section('js/notifications.js mirrors the same budget model and copy');
{
    const previewSrc = fs.readFileSync(path.join(__dirname, '..', 'js', 'notifications.js'), 'utf8');
    // Load only the pure helpers; the file's top level touches `document`, so give it one.
    const pctx = vm.createContext({ console, window: {}, navigator: {}, document: { addEventListener: () => {} }, Intl });
    vm.runInContext(previewSrc, pctx);

    const actx = makeSandbox({});
    // Top-level `const` in a vm context is a lexical binding, NOT a property of the
    // context object, so these have to be evaluated rather than read off the context.
    const read = (ctx, expr) => vm.runInContext(expr, ctx);
    // The caps are gone from both files. Assert that, so nobody quietly puts a
    // target back into push copy: the push states the month total and nothing else.
    const gone = (ctx, expr) => {
        try { read(ctx, expr); return false; } catch (e) { return true; }
    };
    check('sender defines no cap constants',
        ['MONTHLY_TOTAL_SOFT', 'MONTHLY_TOTAL_HARD', 'MONTHLY_FOOD', 'FOOD_CATEGORIES']
            .every(n => gone(actx, n)), true);
    check('preview defines no cap constants',
        ['PREVIEW_MONTHLY_TOTAL_SOFT', 'PREVIEW_MONTHLY_TOTAL_HARD', 'PREVIEW_MONTHLY_FOOD', 'PREVIEW_FOOD_CATEGORIES']
            .every(n => gone(pctx, n)), true);
    check('the budget state machine is gone from both',
        gone(actx, 'getActiveTarget_') && gone(pctx, 'previewActiveTarget'), true);
    check('preview collapse tags match the sender keys',
        [read(actx, 'COLLAPSE_KEY_SYNC'), read(actx, 'COLLAPSE_KEY_END_OF_DAY')],
        ['ledgr-sync', 'ledgr-end-of-day']);
    check('end-of-day hour is 22', read(actx, 'END_OF_DAY_HOUR'), 22);
    const cases = [
        { monthTotal: 450, monthFood: 100, daysLeft: 17, todayTotal: 62, todayCount: 4 },
        { monthTotal: 1400, monthFood: 500, daysLeft: 10, todayTotal: 88, todayCount: 3 },   // SOFT_OVER
        { monthTotal: 2500, monthFood: 900, daysLeft: 5, todayTotal: 0, todayCount: 0 },     // HARD_OVER
        { monthTotal: 600, monthFood: 450, daysLeft: 12, todayTotal: 41, todayCount: 1 },    // FOOD_OVER
        { monthTotal: 0, monthFood: 0, daysLeft: 31, todayTotal: 0, todayCount: 0 }
    ];
    cases.forEach((c, i) => {
        const a1 = actx.buildSyncBatchMessage_({ count: 1, total: 14.5, merchant: 'Mendocino Farms' }, c);
        const p1 = pctx.previewSyncBatchMessage({ count: 1, total: 14.5, merchant: 'Mendocino Farms' }, c);
        check('case ' + i + ': sync batch-of-1 copy identical', p1, a1);

        const aN = actx.buildSyncBatchMessage_({ count: 3, total: 99.99, merchant: 'Mendocino Farms' }, c);
        const pN = pctx.previewSyncBatchMessage({ count: 3, total: 99.99, merchant: 'Mendocino Farms' }, c);
        check('case ' + i + ': sync batch-of-N copy identical', pN, aN);

        check('case ' + i + ': end-of-day copy identical',
            pctx.previewEndOfDayMessage(c), actx.buildEndOfDayMessage_(c));
        check('case ' + i + ': budget state identical',
    pctx.previewEndOfDayMessage(c).body, actx.buildEndOfDayMessage_(c).body);
    });

    // The budget-row gate must agree too, or the preview would show a different total
    // from the push for the same data.
    [
        {}, { kind: 'variable' }, { kind: 'income' }, { kind: 'fixed' },
        { excludeFromBudget: true }, { tripId: 't1' }, { kind: 'refund' }
    ].forEach((row, i) => {
        check('row-gate case ' + i + ' agrees', pctx.previewIsBudgetRow(row), actx.isBudgetRow_(row));
    });
}

// ===========================================================================
// (h) TRANSACTION DATE PARSING — the repeated bug class in this repo
// ===========================================================================
//
// Chase alert bodies state the transaction time in Eastern Time. The imported
// row must land on the USER's local calendar day (DISPLAY_TZ), not ET and not
// the script's own zone. An earlier version formatted in America/New_York, which
// pushed anything after 9pm Pacific onto the next day.
//
// These cases pin both halves: the ET->local conversion, and the DST offset used
// to build the ET instant in the first place.
section('(h) transaction date: ET body -> user local day');

    const ctx = makeSandbox({});
    // Top-level `const`/`function` in a vm context are lexical bindings, not properties
    // of the context object, so they must be evaluated rather than read off it.
    const evalIn = (expr) => vm.runInContext(expr, ctx);
    const extract = evalIn('extractTransactionDate_');
    const isDst = evalIn('isEasternDaylight_');
    check('DISPLAY_TZ is the user zone, not ET', evalIn('DISPLAY_TZ'), 'America/Los_Angeles');

    const msg = (body) => ({ getPlainBody: () => body, getDate: () => new Date('2026-04-21T18:00:00Z') });
    const et = (s) => 'Amount $9.00\nDate  ' + s;
    const fallback = new Date('2026-04-21T18:00:00Z');

    // Pacific is 3h behind ET, so anything before 3:00 AM ET is still the previous
    // Pacific day. 3:00 AM ET is exactly midnight PT — the boundary itself.
    [
        ['midday, same day everywhere', 'Apr 21, 2026 at 5:43 PM ET', '2026-04-21'],
        ['11:30 PM ET is still the 21st in PT', 'Apr 21, 2026 at 11:30 PM ET', '2026-04-21'],
        ['1:15 AM ET -> previous Pacific day', 'Apr 22, 2026 at 1:15 AM ET', '2026-04-21'],
        ['2:59 AM ET -> previous Pacific day', 'Apr 22, 2026 at 2:59 AM ET', '2026-04-21'],
        ['3:01 AM ET -> that Pacific day', 'Apr 22, 2026 at 3:01 AM ET', '2026-04-22'],
        ['winter: 1 AM EST -> previous day', 'Jan 15, 2026 at 1:00 AM EST'.replace('EST', 'ET'), '2026-01-14'],
        ['year rollover: 2:59 AM ET Jan 1', 'Jan 1, 2027 at 2:59 AM ET', '2026-12-31'],
        ['year rollover: 3:01 AM ET Jan 1', 'Jan 1, 2027 at 3:01 AM ET', '2027-01-01'],
    ].forEach(([label, stamp, want]) => {
        check(label, extract(msg(et(stamp)), fallback), want);
    });

    // A body with a date but no time has no instant to convert — taken at face value.
    check('date-only body is not zone-shifted',
        extract(msg('Amount $12.00\nDate  Apr 21, 2026'), fallback), '2026-04-21');

    // Unparseable body -> email arrival time, still rendered in DISPLAY_TZ.
    const arrival = new Date('2026-04-22T05:00:00Z');   // 10pm PT Apr 21
    check('unparseable body falls back to arrival, in local zone',
        extract({ getPlainBody: () => 'nothing here', getDate: () => arrival }, arrival), '2026-04-21');

    // DST helper vs the IANA database, every day over four years. The offset feeds
    // the ET instant above, so a wrong answer here silently mis-dates rows.
    section('(h) isEasternDaylight_ vs IANA, 2025-2028');
    let mismatches = 0;
    for (const y of [2025, 2026, 2027, 2028]) {
        for (let m = 1; m <= 12; m++) {
            const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
            for (let d = 1; d <= last; d++) {
                // noon UTC is unambiguous for a date's zone name on both sides of a shift
                const name = new Intl.DateTimeFormat('en-US', {
                    timeZone: 'America/New_York', timeZoneName: 'short'
                }).format(new Date(Date.UTC(y, m - 1, d, 17)));
                if (isDst(y, m, d) !== /EDT/.test(name)) mismatches++;
            }
        }
    }
    check('agrees with IANA on all 1461 days', mismatches, 0);

// ---------------------------------------------------------------------------
console.log('\n' + (failures.length
    ? failures.length + ' FAILURE(S):\n  ' + failures.join('\n  ')
    : 'ALL PASS'));
process.exit(failures.length ? 1 : 0);
