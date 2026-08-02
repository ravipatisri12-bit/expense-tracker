const GMAIL_LABEL = 'Chase Transactions'; // v2: +notifications

// ===========================================================================
// ONE-SHOT SETUP
//
// Script properties and triggers are not exposed to clasp (or any MCP), but
// they ARE scriptable from inside Apps Script. So: paste your UID below, run
// setup() once, and read the log. It is idempotent — safe to re-run.
// ===========================================================================

const SETUP_FIREBASE_UID = '3SewIOKelsYJPg8Cp8nkkM0fl9v2';
const SETUP_FIREBASE_PROJECT_ID = 'personal-expense-tracker-7aa9c';

function setup() {
  const log = [];
  const fail = [];

  // --- 1. Script properties -------------------------------------------------
  if (!SETUP_FIREBASE_UID || SETUP_FIREBASE_UID === 'PASTE_YOUR_FIREBASE_UID_HERE') {
    fail.push('SETUP_FIREBASE_UID is not set. Get it by running firebaseAuth.currentUser.uid ' +
              'in the browser console while signed in to Ledgr, paste it at the top of this file, re-run setup().');
  } else {
    PropertiesService.getScriptProperties().setProperties({
      FIREBASE_UID: SETUP_FIREBASE_UID,
      FIREBASE_PROJECT_ID: SETUP_FIREBASE_PROJECT_ID,
    });
    log.push('OK   properties set (uid ...' + SETUP_FIREBASE_UID.slice(-6) + ', project ' + SETUP_FIREBASE_PROJECT_ID + ')');
  }

  // --- 2. Firestore reachability (catches missing datastore scope / IAM) ----
  if (!fail.length) {
    try {
      const url = 'https://firestore.googleapis.com/v1/projects/' + SETUP_FIREBASE_PROJECT_ID +
                  '/databases/(default)/documents/users/' + SETUP_FIREBASE_UID + '/expenses?pageSize=1';
      const code = firestoreFetch(url).getResponseCode();
      if (code === 200) {
        log.push('OK   Firestore reachable (200)');
      } else if (code === 401 || code === 403) {
        fail.push('Firestore returned ' + code + '. Two likely causes: (a) appsscript.json is missing the ' +
                  '"https://www.googleapis.com/auth/datastore" oauthScope — add it, save, re-run and re-approve; ' +
                  '(b) this Google account lacks IAM access to the Firebase project (needs Owner/Editor/Cloud Datastore User).');
      } else {
        fail.push('Firestore returned ' + code + '. A 404 usually means FIREBASE_UID or FIREBASE_PROJECT_ID is wrong.');
      }
    } catch (err) {
      fail.push('Firestore call threw: ' + err);
    }
  }

  // --- 3. Gmail label -------------------------------------------------------
  let label = GmailApp.getUserLabelByName(GMAIL_LABEL);
  if (!label) {
    label = GmailApp.createLabel(GMAIL_LABEL);
    log.push('OK   created Gmail label "' + GMAIL_LABEL + '"');
  } else {
    log.push('OK   Gmail label "' + GMAIL_LABEL + '" exists');
  }
  const unread = label.getThreads().filter(function (t) { return t.isUnread(); }).length;
  log.push('     ' + unread + ' unread thread(s) in that label' +
           (unread === 0 ? ' — apply the label to some Chase alerts and mark them unread to test' : ''));

  // --- 4. Merchant map ------------------------------------------------------
  if (!fail.length) {
    try {
      const map = buildMerchantMap();
      const n = Object.keys(map).length;
      log.push('OK   merchant map built (' + n + ' entries)' +
               (n === 0 ? ' — empty, so imports will be categorized "Other" until you have categorized expenses' : ''));
    } catch (err) {
      fail.push('buildMerchantMap failed: ' + err);
    }
  }

  // --- 5. 15-minute trigger -------------------------------------------------
  const existing = ScriptApp.getProjectTriggers().filter(function (t) {
    return t.getHandlerFunction() === 'processChaseEmails';
  });
  if (existing.length > 1) {
    // Collapse duplicates — extras cause redundant runs.
    existing.slice(1).forEach(function (t) { ScriptApp.deleteTrigger(t); });
    log.push('OK   removed ' + (existing.length - 1) + ' duplicate trigger(s)');
  }
  if (existing.length === 0) {
    ScriptApp.newTrigger('processChaseEmails').timeBased().everyMinutes(15).create();
    log.push('OK   created 15-minute trigger for processChaseEmails');
  } else {
    log.push('OK   trigger already present');
  }

  // --- Report ---------------------------------------------------------------
  Logger.log('===== Ledgr Gmail import setup =====');
  log.forEach(function (l) { Logger.log(l); });
  if (fail.length) {
    Logger.log('');
    Logger.log('----- ACTION REQUIRED -----');
    fail.forEach(function (f) { Logger.log('FAIL ' + f); });
    Logger.log('Fix the above, then run setup() again.');
  } else {
    Logger.log('');
    Logger.log('Setup complete. Run processChaseEmails() now to import, then open Ledgr');
    Logger.log('WITHOUT tapping sync — the transactions should appear on their own.');
  }
  return { ok: fail.length === 0, log: log, fail: fail };
}

function getConfig() {
  const props = PropertiesService.getScriptProperties();
  return {
    uid: props.getProperty('FIREBASE_UID'),
    projectId: props.getProperty('FIREBASE_PROJECT_ID'),
  };
}

function firestoreFetch(url, options) {
  const token = ScriptApp.getOAuthToken();
  options = options || {};
  options.headers = { Authorization: 'Bearer ' + token };
  options.muteHttpExceptions = true;
  return UrlFetchApp.fetch(url, options);
}

// ===========================================================================
// PROCESSED-ID LEDGER (tombstones)
//
// The read/unread flag on an email is NOT a durable record of "already imported".
// If a thread is ever marked unread again — manually, by a filter, by a client
// sync quirk — and the user had DELETED that transaction in Ledgr, the doc no
// longer exists, so the create-only 409 guard can't fire and the transaction
// silently comes back.
//
// This ledger is the durable record. It lives at
// users/{uid}/settings/gmail_sync.processedIds — the SAME doc the in-app importer
// uses (js/email-parser.js), so both importers share one source of truth and a
// delete stays deleted regardless of which one saw the email first.
// ===========================================================================

const SYNC_LEDGER_LIMIT = 2000;   // keep the doc small; oldest ids fall off

function ledgerUrl_(config) {
  return 'https://firestore.googleapis.com/v1/projects/' + config.projectId +
         '/databases/(default)/documents/users/' + config.uid + '/settings/gmail_sync';
}

/**
 * Read the processed-id ledger.
 * @returns {Object} { ids: string[], set: Object } — set is an id->true lookup
 */
function loadProcessedIds_(config) {
  const res = firestoreFetch(ledgerUrl_(config));
  const ids = [];
  if (res.getResponseCode() === 200) {
    const data = JSON.parse(res.getContentText());
    const arr = data.fields && data.fields.processedIds && data.fields.processedIds.arrayValue;
    const values = (arr && arr.values) || [];
    values.forEach(function (v) { if (v.stringValue) ids.push(v.stringValue); });
  } else if (res.getResponseCode() !== 404) {
    // 404 just means "first run, no ledger yet". Anything else is a real problem:
    // proceeding would treat every email as new and risk re-importing deletes.
    throw new Error('Could not read sync ledger (' + res.getResponseCode() + '): ' +
                    res.getContentText().substring(0, 200));
  }
  const set = {};
  ids.forEach(function (id) { set[id] = true; });
  return { ids: ids, set: set };
}

/**
 * Persist the ledger, newest ids last, capped at SYNC_LEDGER_LIMIT.
 * merge:true so we never clobber other fields in the gmail_sync doc.
 */
function saveProcessedIds_(config, ids) {
  const capped = ids.slice(-SYNC_LEDGER_LIMIT);
  const url = ledgerUrl_(config) + '?updateMask.fieldPaths=processedIds';
  const res = firestoreFetch(url, {
    method: 'patch',
    contentType: 'application/json',
    payload: JSON.stringify({
      fields: {
        processedIds: {
          arrayValue: { values: capped.map(function (id) { return { stringValue: id }; }) }
        }
      }
    }),
  });
  if (res.getResponseCode() >= 300) {
    Logger.log('WARNING: failed to save sync ledger (' + res.getResponseCode() + '): ' +
               res.getContentText().substring(0, 200));
    return false;
  }
  return true;
}

function parseChaseSubject(subject) {
  const match = subject.match(/You made a \$([\d,.]+) transaction with (.+)/i);
  if (!match) return null;
  const amount = parseFloat(match[1].replace(',', ''));
  const merchant = match[2].trim().replace(/^(TST\*|SQ \*|SQU\*|PP\*|PAY\*)\s*/i, '').trim();
  return { amount, merchant };
}

function buildMerchantMap() {
  const config = getConfig();
  const url = `https://firestore.googleapis.com/v1/projects/${config.projectId}/databases/(default)/documents/users/${config.uid}/expenses?pageSize=500`;
  const res = firestoreFetch(url);
  const data = JSON.parse(res.getContentText());

  const map = {};
  (data.documents || []).forEach(doc => {
    const fields = doc.fields;
    if (fields.description && fields.category) {
      const desc = (fields.description.stringValue || '').toUpperCase();
      const cat = fields.category.stringValue;
      if (desc && cat) map[desc] = cat;
    }
  });

  PropertiesService.getScriptProperties().setProperty('MERCHANT_MAP', JSON.stringify(map));
  Logger.log('Built merchant map with ' + Object.keys(map).length + ' entries');
  return map;
}

function getMerchantMap() {
  const raw = PropertiesService.getScriptProperties().getProperty('MERCHANT_MAP');
  return raw ? JSON.parse(raw) : {};
}

// Minimum key length for substring matching. Below this, a short stored description
// like "SQ" or "AMZ" would match a huge number of unrelated merchants.
const MERCHANT_MIN_MATCH = 4;

function categorize(merchant) {
  const map = getMerchantMap();
  const upper = merchant.toUpperCase().trim();
  if (!upper) return 'Other';

  // 1. Exact match wins outright.
  if (map[upper]) return map[upper];

  // 2. Longest substring match, so "WHOLE FOODS MARKET" beats "FOOD". The previous
  //    version returned the FIRST match in arbitrary object order and matched
  //    bidirectionally at any length, so a 2-char stored description could
  //    mis-categorize nearly everything.
  let best = null, bestLen = 0;
  for (const key of Object.keys(map)) {
    if (key.length < MERCHANT_MIN_MATCH) continue;
    if (upper.indexOf(key) >= 0 && key.length > bestLen) {
      best = map[key];
      bestLen = key.length;
    }
  }
  return best || 'Other';
}

function writeExpenseToFirestore(expense) {
  const config = getConfig();
  // Same "gm_<gmailMessageId>" scheme the in-app importer uses (js/email-parser.js).
  // Both paths therefore write the SAME doc for the same email — a re-import is an
  // idempotent overwrite, not a duplicate transaction.
  const docId = expense.id.toString();
  const url = `https://firestore.googleapis.com/v1/projects/${config.projectId}/databases/(default)/documents/users/${config.uid}/expenses?documentId=${docId}`;

  const firestoreDoc = {
    fields: {
      id: { stringValue: expense.id },
      amount: { doubleValue: expense.amount },
      description: { stringValue: expense.description },
      category: { stringValue: expense.category },
      date: { stringValue: expense.date },
      timestamp: { integerValue: expense.timestamp },
      excludeFromBudget: { booleanValue: false },
      source: { stringValue: 'chase-gmail' },
      gmailMessageId: { stringValue: expense.gmailMessageId },
    }
  };

  const res = firestoreFetch(url, {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(firestoreDoc),
  });

  const code = res.getResponseCode();
  // 409 = doc already exists => the in-app importer already captured this email.
  // That's the dedupe working as intended, not a failure.
  if (code === 409) {
    Logger.log('Already imported (409), skipping: ' + expense.description);
    return true;
  }
  if (code >= 300) {
    Logger.log('Firestore write FAILED ' + code + ': ' + res.getContentText().substring(0, 300));
    return false;   // caller must NOT mark the email read, so the next run retries
  }
  Logger.log('Firestore write: ' + code + ' - ' + expense.description);
  return true;
}

// Never import mail older than this. The in-app importer bounds its search with
// newer_than:30d; this had NO bound, so applying the label to a folder of historical
// Chase mail imported years of it in one run.
const MAX_IMPORT_AGE_DAYS = 45;

function processChaseEmails() {
  const label = GmailApp.getUserLabelByName(GMAIL_LABEL);
  if (!label) {
    Logger.log('Label "' + GMAIL_LABEL + '" not found');
    return;
  }

  const config = getConfig();
  if (!config.uid || !config.projectId) {
    Logger.log('Not configured — run setup() first');
    return;
  }

  // Load the durable ledger FIRST. If it can't be read we abort rather than risk
  // re-importing transactions the user deliberately deleted.
  let ledger;
  try {
    ledger = loadProcessedIds_(config);
  } catch (err) {
    Logger.log('ABORT: ' + err.message);
    return;
  }

  const threads = label.getThreads().filter(t => t.isUnread());
  if (!threads.length) {
    Logger.log('No unread Chase emails');
    return;
  }

  const cutoff = Date.now() - MAX_IMPORT_AGE_DAYS * 24 * 60 * 60 * 1000;
  let added = 0, failed = 0, skippedLedger = 0, skippedOld = 0, skippedUnparsed = 0;
  const newIds = [];

  threads.forEach(thread => {
    // Every message in the thread, not just [0] — Chase can group alerts into one
    // thread, and the old code silently dropped every message after the first.
    const messages = thread.getMessages();
    let threadFullyHandled = true;

    messages.forEach(msg => {
      const msgId = msg.getId();
      const docId = 'gm_' + msgId;

      // Durable dedupe: covers deleted transactions, which the 409 check cannot.
      if (ledger.set[docId]) { skippedLedger++; return; }

      const msgDate = msg.getDate();
      if (msgDate.getTime() < cutoff) { skippedOld++; return; }

      const parsed = parseChaseSubject(msg.getSubject());
      if (!parsed) { skippedUnparsed++; return; }

      // Chase alerts report Eastern Time. Format in ET (not the script's timezone) so a
      // late-evening transaction doesn't land on the wrong calendar day.
      const date = Utilities.formatDate(msgDate, 'America/New_York', 'yyyy-MM-dd');

      const expense = {
        // Same scheme as js/email-parser.js so the two importers can't duplicate.
        id: docId,
        gmailMessageId: msgId,
        amount: parsed.amount,
        description: parsed.merchant,
        category: categorize(parsed.merchant),
        date: date,
        timestamp: Date.now(),
      };

      var ok = false;
      try {
        ok = writeExpenseToFirestore(expense);
      } catch (err) {
        Logger.log('Write threw for "' + expense.description + '": ' + err);
        ok = false;
      }

      if (ok) {
        newIds.push(docId);
        added++;
      } else {
        failed++;
        threadFullyHandled = false;   // leave unread so the next run retries
      }
    });

    // Only mark read once every message in the thread is durably in Firestore.
    // Previously this ran unconditionally, so a failed write (quota, auth, network)
    // silently dropped the transaction forever — the email was read, so no later
    // run would retry it.
    if (threadFullyHandled) thread.markRead();
  });

  // Persist the ledger even on partial success, so what DID import is recorded.
  if (newIds.length) {
    saveProcessedIds_(config, ledger.ids.concat(newIds));
  }

  Logger.log('Imported ' + added +
             ' | skipped: ' + skippedLedger + ' already-imported, ' + skippedOld + ' older than ' +
             MAX_IMPORT_AGE_DAYS + 'd, ' + skippedUnparsed + ' unparsed' +
             (failed ? ' | ' + failed + ' FAILED (left unread to retry)' : ''));
}

/**
 * Backfill the ledger from what's already in Firestore.
 *
 * Run this ONCE after deploying these changes: it records every existing gm_* expense
 * as processed, so the new ledger starts consistent with reality instead of treating
 * everything as fresh.
 */
function backfillProcessedIds() {
  const config = getConfig();
  const url = 'https://firestore.googleapis.com/v1/projects/' + config.projectId +
              '/databases/(default)/documents/users/' + config.uid + '/expenses?pageSize=1000';
  const res = firestoreFetch(url);
  if (res.getResponseCode() !== 200) {
    Logger.log('Failed to read expenses: ' + res.getResponseCode());
    return;
  }
  const data = JSON.parse(res.getContentText());
  const ids = [];
  (data.documents || []).forEach(function (doc) {
    const name = doc.name.split('/').pop();
    if (name.indexOf('gm_') === 0) ids.push(name);
  });

  const existing = loadProcessedIds_(config);
  const merged = existing.ids.slice();
  ids.forEach(function (id) { if (!existing.set[id]) merged.push(id); });

  saveProcessedIds_(config, merged);
  Logger.log('Ledger backfilled: ' + ids.length + ' gm_* expenses found, ledger now ' + merged.length + ' ids');
}

function testFirestoreRead() {
  const config = getConfig();
  Logger.log('UID: ' + config.uid);
  Logger.log('Project: ' + config.projectId);

  const url = `https://firestore.googleapis.com/v1/projects/${config.projectId}/databases/(default)/documents/users/${config.uid}/expenses?pageSize=5`;
  const res = firestoreFetch(url);
  Logger.log('Status: ' + res.getResponseCode());
  Logger.log('Response: ' + res.getContentText().substring(0, 500));
}

// ===========================================================================
// DAILY NOTIFICATIONS
//
// Sends FCM push notifications 3x daily (morning, afternoon, evening).
// Replaces the GitHub Actions sender with a reliable Apps Script trigger.
//
// Setup: run setupNotifications() once to create the 3 time-based triggers.
// ===========================================================================

const MONTHLY_TOTAL_SOFT = 1000;
const MONTHLY_TOTAL_HARD = 2000;
const MONTHLY_FOOD = 400;
const FOOD_CATEGORIES = ['Food'];

const NOTIFICATION_TZ = 'America/Los_Angeles';

function setupNotifications() {
  ScriptApp.getProjectTriggers().forEach(function(t) {
    var fn = t.getHandlerFunction();
    if (fn === 'sendMorningNotification' || fn === 'sendAfternoonNotification' || fn === 'sendEveningNotification') {
      ScriptApp.deleteTrigger(t);
    }
  });

  ScriptApp.newTrigger('sendMorningNotification').timeBased().atHour(9).everyDays(1).inTimezone(NOTIFICATION_TZ).create();
  ScriptApp.newTrigger('sendAfternoonNotification').timeBased().atHour(18).everyDays(1).inTimezone(NOTIFICATION_TZ).create();
  ScriptApp.newTrigger('sendEveningNotification').timeBased().atHour(22).everyDays(1).inTimezone(NOTIFICATION_TZ).create();

  Logger.log('Notification triggers created: 9 AM, 6 PM, 10 PM ' + NOTIFICATION_TZ);
}

function sendMorningNotification() { sendNotification_('morning'); }
function sendAfternoonNotification() { sendNotification_('afternoon'); }
function sendEveningNotification() { sendNotification_('evening'); }

function sendNotification_(slot) {
  var config = getConfig();
  if (!config.uid) { Logger.log('No UID configured'); return; }

  var today = Utilities.formatDate(new Date(), NOTIFICATION_TZ, 'yyyy-MM-dd');
  var monthStart = today.slice(0, 8) + '01';

  var expenses = fetchExpensesFromFirestore_(config, monthStart, today);
  var todayExpenses = expenses.filter(function(e) { return e.date === today; });
  var gamification = fetchGamification_(config);

  var monthTotal = sumExpenses_(expenses.filter(function(e) { return !e.tripId; }));
  var monthFood = sumExpenses_(expenses.filter(function(e) { return !e.tripId && FOOD_CATEGORIES.indexOf(e.category) >= 0; }));
  var todayRegular = todayExpenses.filter(function(e) { return !e.tripId; });
  var todayTotal = sumExpenses_(todayRegular);
  var todayFood = sumExpenses_(todayRegular.filter(function(e) { return FOOD_CATEGORIES.indexOf(e.category) >= 0; }));

  var ctx = {
    todayTotal: todayTotal,
    todayFood: todayFood,
    monthTotal: monthTotal,
    monthFood: monthFood,
    daysLeft: daysLeftInMonth_(),
    todayCount: todayRegular.length,
    monthName: Utilities.formatDate(new Date(), NOTIFICATION_TZ, 'MMMM'),
    streak: (gamification && gamification.streak && gamification.streak.current) || 0,
    checkedIn: !!(gamification && gamification.dailyLog && gamification.dailyLog[today] && gamification.dailyLog[today].checkedIn),
    mood: (gamification && gamification.dailyLog && gamification.dailyLog[today] && gamification.dailyLog[today].mood) || null
  };

  var msg = buildNotificationMessage_(slot, ctx);

  var tokens = fetchFcmTokens_(config);
  var sent = 0, removed = 0;
  tokens.forEach(function(tokenData) {
    var result = sendFcmMessage_(config, tokenData.token, msg.title, msg.body);
    if (result === 'sent') sent++;
    else if (result === 'stale') { deleteToken_(config, tokenData.docId); removed++; }
  });

  Logger.log(slot + ': sent ' + sent + ', removed ' + removed + ' stale token(s)');
}

function buildNotificationMessage_(slot, ctx) {
  var t = getActiveTarget_(ctx);

  if (slot === 'morning') {
    if (t.state === 'HARD_OVER') return { title: '! Over $' + MONTHLY_TOTAL_HARD + ' cap', body: ctx.daysLeft + ' days to wrap up ' + ctx.monthName };
    if (t.state === 'SOFT_OVER') return { title: '! Over $' + MONTHLY_TOTAL_SOFT + ' — aim $' + t.dailyTotal + '/day', body: 'Stay under $' + MONTHLY_TOTAL_HARD + ' hard cap · ' + ctx.daysLeft + ' days left' };
    if (t.state === 'FOOD_OVER') return { title: '→ $' + t.dailyTotal + ' to spend today', body: 'Food cap hit — needs only · ' + ctx.daysLeft + ' days left' };
    return { title: '→ $' + t.dailyTotal + ' to spend today', body: '$' + t.dailyFood + ' of that on food · ' + ctx.daysLeft + ' days left' };
  }

  if (slot === 'afternoon') {
    var todayLine = ctx.todayCount === 0 ? '$0 today so far' : '$' + Math.round(ctx.todayTotal) + ' today, $' + Math.round(ctx.todayFood) + ' on food';
    if (t.state === 'HARD_OVER') return { title: '! ' + todayLine, body: '$' + Math.round(ctx.monthTotal) + ' of $' + MONTHLY_TOTAL_HARD + ' hard ceiling' };
    if (t.state === 'SOFT_OVER') return { title: '! ' + todayLine, body: '$' + Math.round(ctx.monthTotal) + ' of $' + MONTHLY_TOTAL_HARD + ' — aim $' + t.dailyTotal + '/day' };
    if (t.state === 'FOOD_OVER') return { title: todayLine, body: 'Food cap hit · $' + Math.round(ctx.monthTotal) + ' of $' + MONTHLY_TOTAL_SOFT + ' this month' };
    var room = t.dailyTotal * ctx.daysLeft;
    return { title: todayLine, body: '$' + Math.round(ctx.monthTotal) + ' of $' + MONTHLY_TOTAL_SOFT + ' · $' + room + ' left, ' + ctx.daysLeft + ' days' };
  }

  // evening
  if (!ctx.checkedIn) {
    var streakLine = ctx.streak ? ctx.streak + ' day streak going' : 'Start a streak tonight';
    return { title: '? $' + Math.round(ctx.todayTotal) + ' today — tag it', body: 'Tap: No Spend, Essentials, or Wants · ' + streakLine };
  }
  var moodLabels = { 'no-spend': 'No Spend', essential: 'Essentials', wants: 'Wants' };
  var moodLabel = moodLabels[ctx.mood] || 'Logged';
  var streakBit = ctx.streak ? ctx.streak + ' day streak' : 'first day';
  var symbol, paceWord;
  if (t.state === 'HARD_OVER') { symbol = '!'; paceWord = 'over hard cap'; }
  else if (t.state === 'SOFT_OVER') { symbol = '!'; paceWord = 'over $' + MONTHLY_TOTAL_SOFT; }
  else if (t.state === 'FOOD_OVER') { symbol = '·'; paceWord = 'food cap hit'; }
  else { symbol = '✓'; paceWord = 'under pace'; }
  return { title: symbol + ' $' + Math.round(ctx.todayTotal) + ' today — ' + paceWord, body: 'Tagged "' + moodLabel + '" — ' + streakBit + ' · $' + Math.round(ctx.monthTotal) + ' of $' + MONTHLY_TOTAL_SOFT };
}

function getActiveTarget_(ctx) {
  var dl = Math.max(1, ctx.daysLeft);
  if (ctx.monthTotal > MONTHLY_TOTAL_HARD) return { state: 'HARD_OVER', dailyTotal: 0, dailyFood: 0 };
  if (ctx.monthTotal > MONTHLY_TOTAL_SOFT) return { state: 'SOFT_OVER', dailyTotal: Math.round((MONTHLY_TOTAL_HARD - ctx.monthTotal) / dl), dailyFood: 0 };
  if (ctx.monthFood > MONTHLY_FOOD) return { state: 'FOOD_OVER', dailyTotal: Math.round((MONTHLY_TOTAL_SOFT - ctx.monthTotal) / dl), dailyFood: 0 };
  return { state: 'HEALTHY', dailyTotal: Math.round((MONTHLY_TOTAL_SOFT - ctx.monthTotal) / dl), dailyFood: Math.round((MONTHLY_FOOD - ctx.monthFood) / dl) };
}

function daysLeftInMonth_() {
  var now = new Date();
  var today = parseInt(Utilities.formatDate(now, NOTIFICATION_TZ, 'dd'), 10);
  var lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  return lastDay - today + 1;
}

function sumExpenses_(arr) {
  return arr.reduce(function(sum, e) { return sum + (Number(e.amount) || 0); }, 0);
}

function fetchExpensesFromFirestore_(config, fromDate, toDate) {
  var url = 'https://firestore.googleapis.com/v1/projects/' + config.projectId +
    '/databases/(default)/documents/users/' + config.uid + ':runQuery';
  var query = {
    structuredQuery: {
      from: [{ collectionId: 'expenses' }],
      where: {
        compositeFilter: {
          op: 'AND',
          filters: [
            { fieldFilter: { field: { fieldPath: 'date' }, op: 'GREATER_THAN_OR_EQUAL', value: { stringValue: fromDate } } },
            { fieldFilter: { field: { fieldPath: 'date' }, op: 'LESS_THAN_OR_EQUAL', value: { stringValue: toDate } } }
          ]
        }
      },
      limit: 1000
    }
  };

  var res = UrlFetchApp.fetch(url, {
    method: 'post',
    contentType: 'application/json',
    headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() },
    payload: JSON.stringify(query),
    muteHttpExceptions: true
  });

  if (res.getResponseCode() >= 300) {
    Logger.log('Expense query failed: ' + res.getResponseCode() + ' ' + res.getContentText().substring(0, 200));
    return [];
  }

  var results = JSON.parse(res.getContentText());
  var expenses = [];
  results.forEach(function(row) {
    if (!row.document) return;
    var f = row.document.fields;
    expenses.push({
      amount: (f.amount && (f.amount.doubleValue || parseFloat(f.amount.integerValue || '0'))) || 0,
      category: (f.category && f.category.stringValue) || 'Other',
      date: (f.date && f.date.stringValue) || '',
      tripId: (f.tripId && f.tripId.stringValue) || null
    });
  });
  return expenses;
}

function fetchGamification_(config) {
  var url = 'https://firestore.googleapis.com/v1/projects/' + config.projectId +
    '/databases/(default)/documents/users/' + config.uid + '/state/gamification';
  var res = firestoreFetch(url);
  if (res.getResponseCode() !== 200) return null;
  var data = JSON.parse(res.getContentText());
  if (!data.fields) return null;

  var fields = data.fields;
  var result = { streak: { current: 0 }, dailyLog: {} };

  if (fields.streak && fields.streak.mapValue && fields.streak.mapValue.fields) {
    var s = fields.streak.mapValue.fields;
    result.streak.current = parseInt((s.current && (s.current.integerValue || s.current.doubleValue)) || '0', 10);
  }

  if (fields.dailyLog && fields.dailyLog.mapValue && fields.dailyLog.mapValue.fields) {
    var log = fields.dailyLog.mapValue.fields;
    Object.keys(log).forEach(function(date) {
      if (log[date].mapValue && log[date].mapValue.fields) {
        var entry = log[date].mapValue.fields;
        result.dailyLog[date] = {
          checkedIn: !!(entry.checkedIn && entry.checkedIn.booleanValue),
          mood: (entry.mood && entry.mood.stringValue) || null
        };
      }
    });
  }

  return result;
}

function fetchFcmTokens_(config) {
  var url = 'https://firestore.googleapis.com/v1/projects/' + config.projectId +
    '/databases/(default)/documents/users/' + config.uid + '/fcmTokens';
  var res = firestoreFetch(url);
  if (res.getResponseCode() !== 200) return [];
  var data = JSON.parse(res.getContentText());
  if (!data.documents) return [];

  return data.documents.map(function(doc) {
    var parts = doc.name.split('/');
    return {
      docId: parts[parts.length - 1],
      token: (doc.fields.token && doc.fields.token.stringValue) || parts[parts.length - 1]
    };
  });
}

function sendFcmMessage_(config, token, title, body) {
  var accessToken = ScriptApp.getOAuthToken();
  var url = 'https://fcm.googleapis.com/v1/projects/' + config.projectId + '/messages:send';
  var payload = {
    message: {
      token: token,
      notification: { title: title, body: body }
    }
  };

  var res = UrlFetchApp.fetch(url, {
    method: 'post',
    contentType: 'application/json',
    headers: { Authorization: 'Bearer ' + accessToken },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  });

  var code = res.getResponseCode();
  if (code === 200) return 'sent';
  var errBody = res.getContentText();
  if (errBody.indexOf('NOT_FOUND') >= 0 || errBody.indexOf('UNREGISTERED') >= 0 || errBody.indexOf('INVALID_ARGUMENT') >= 0) {
    return 'stale';
  }
  Logger.log('FCM send failed (' + code + '): ' + errBody.substring(0, 200));
  return 'error';
}

function deleteToken_(config, docId) {
  var url = 'https://firestore.googleapis.com/v1/projects/' + config.projectId +
    '/databases/(default)/documents/users/' + config.uid + '/fcmTokens/' + docId;
  firestoreFetch(url, { method: 'delete' });
}

function testNotification() {
  sendNotification_('morning');
}
