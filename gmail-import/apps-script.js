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

// The calendar the app displays. Dates must land on the USER's local day, not the
// script's timezone and not ET — this mirrors the rule in CLAUDE.md and _parseDate()
// in js/email-parser.js. An earlier version formatted in America/New_York, which
// pushed anything after 9pm Pacific onto the next day.
const DISPLAY_TZ = 'America/Los_Angeles';

/**
 * Resolve a transaction's date.
 *
 * Chase alert bodies carry the real transaction time, e.g.
 *   "Date   Apr 21, 2026 at 5:43 PM ET"
 * That instant is what we want, converted to the user's local calendar day. The
 * email's own arrival time (msg.getDate()) is only a fallback: alerts can arrive
 * hours later, so using it alone mis-dates late-evening purchases.
 *
 * @param {GmailMessage} msg
 * @param {Date} fallbackDate  msg.getDate()
 * @returns {string} YYYY-MM-DD in DISPLAY_TZ
 */
function extractTransactionDate_(msg, fallbackDate) {
  var body = '';
  try {
    body = msg.getPlainBody() || '';
  } catch (err) {
    body = '';
  }

  // "Apr 21, 2026 at 5:43 PM ET" — full timestamp with an explicit ET marker.
  var m = body.match(/(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+(\d{1,2}),?\s+(\d{4})\s+at\s+(\d{1,2}):(\d{2})\s*(AM|PM)\s*ET\b/i);
  if (m) {
    var MONTHS = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };
    var mon = MONTHS[m[1].toLowerCase().slice(0, 3)];
    var day = parseInt(m[2], 10), year = parseInt(m[3], 10);
    var hr = parseInt(m[4], 10), min = parseInt(m[5], 10);
    var ampm = m[6].toUpperCase();
    if (ampm === 'PM' && hr < 12) hr += 12;
    if (ampm === 'AM' && hr === 12) hr = 0;

    // Build the ET instant, then re-read it in DISPLAY_TZ. Utilities.formatDate does
    // the zone conversion, so DST is handled by the platform rather than by hand.
    var etOffsetHours = isEasternDaylight_(year, mon + 1, day) ? 4 : 5;
    var utcMs = Date.UTC(year, mon, day, hr + etOffsetHours, min);
    return Utilities.formatDate(new Date(utcMs), DISPLAY_TZ, 'yyyy-MM-dd');
  }

  // Date with no time, e.g. "Apr 21, 2026" — take it at face value; there is no
  // instant to convert, and the stated day is what the statement will show.
  m = body.match(/(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+(\d{1,2}),?\s+(\d{4})/);
  if (m) {
    var M2 = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
    var mm = M2[m[1].toLowerCase().slice(0, 3)];
    return m[3] + '-' + ('0' + mm).slice(-2) + '-' + ('0' + parseInt(m[2], 10)).slice(-2);
  }

  // Nothing parseable in the body — fall back to when the alert arrived.
  return Utilities.formatDate(fallbackDate, DISPLAY_TZ, 'yyyy-MM-dd');
}

/** US Eastern DST: second Sunday in March to first Sunday in November. */
function isEasternDaylight_(year, month, day) {
  if (month < 3 || month > 11) return false;
  if (month > 3 && month < 11) return true;
  if (month === 3) {
    var march1 = new Date(Date.UTC(year, 2, 1)).getUTCDay();
    var secondSunday = 1 + ((7 - march1) % 7) + 7;
    return day >= secondSunday;
  }
  var nov1 = new Date(Date.UTC(year, 10, 1)).getUTCDay();
  var firstSunday = 1 + ((7 - nov1) % 7);
  return day < firstSunday;
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
  // Batch accumulators for the event-driven push. `soleMerchant` is only ever read
  // when added === 1, so it does not matter which one wins for a multi-row batch.
  let addedTotal = 0;
  let soleMerchant = null;

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

      // Prefer the transaction date stated in the email body over the email's own
      // arrival time — Chase alerts can lag hours behind the purchase, which pushed
      // late-night transactions onto the following day.
      const date = extractTransactionDate_(msg, msgDate);

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
        addedTotal += Number(expense.amount) || 0;
        soleMerchant = expense.description;
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

  // Event-driven push (spec: 2026-08-01-event-driven-notifications-design.md).
  // ONE notification per sync that imported something — never one per transaction.
  // A run that imported nothing sends nothing, which is the overwhelming majority of
  // the ~96 daily runs. Exactly-once is already guaranteed by the processedIds ledger
  // above: a docId in the ledger is skipped, so a retried run cannot re-notify.
  //
  // Wrapped in try/catch on purpose: a notification failure must never make the
  // importer look failed, because the transactions are already durably in Firestore
  // and the emails are already marked read.
  if (added > 0) {
    try {
      notifySyncBatch_(config, { count: added, total: addedTotal, merchant: soleMerchant });
    } catch (err) {
      Logger.log('Batch notification failed (import itself succeeded): ' + err);
    }
  }
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
// EVENT-DRIVEN NOTIFICATIONS
//
// Spec: docs/superpowers/specs/2026-08-01-event-driven-notifications-design.md
//
// Two events, not three clock slots:
//
//   1. A SYNC THAT IMPORTED SOMETHING. processChaseEmails() already runs every
//      15 minutes and already knows exactly what it imported, so it notifies
//      itself. ONE push per run, regardless of how many rows landed — Chase
//      already alerts per transaction, and batching makes a 50-row backlog
//      sweep send one push instead of fifty. A run that imported nothing sends
//      nothing, which is the overwhelming majority of the ~96 daily runs.
//      Exactly-once comes free from the processedIds ledger; there is
//      deliberately no second definition of "new".
//
//   2. END OF DAY, 22:00. One time trigger, carrying the habit check-in prompt.
//
// No quiet hours: a sync notifies whenever it imported, at any hour. Holding
// overnight imports would need a pending-count accumulator on the sync ledger
// plus a drain step, i.e. new persistent state and a second definition of
// "new". OS-level Do Not Disturb is the right layer for silencing.
//
// Setup: run setupNotifications() once. It retires the three retired fixed
// triggers and creates the single 22:00 one. It never touches the 15-minute
// processChaseEmails trigger.
// ===========================================================================

// NO BUDGET MODEL. The soft ($1000) / hard ($2000) / food ($400) caps were
// arbitrary constants and have been removed from the product, so the push states
// the month total and nothing else — no targets, no "$X of $Y", no per-day
// allowance. That deleted getActiveTarget_(), budgetParts_(), the monthFood
// total, and the 4-state HEALTHY/SOFT_OVER/HARD_OVER/FOOD_OVER machine.
//
// Copies that still define caps and are deliberately NOT owned here:
// script.js:911 (SOFT/HARD/FOOD inline in updateDashboard) and script.js:933
// (_computeAimToday). Home still renders a cap bar and "aim today"; removing
// those is the Home redesign's job, not the sender's.
const NOTIFICATION_TZ = 'America/Los_Angeles';

// Per-purpose collapse keys. NEITHER sender set one, which is why iOS stacked
// duplicates instead of superseding them. A newer push with the same key
// replaces the older rather than adding to the pile.
const COLLAPSE_KEY_SYNC = 'ledgr-sync';
const COLLAPSE_KEY_END_OF_DAY = 'ledgr-end-of-day';

const END_OF_DAY_HOUR = 22;

/**
 * Delete ONLY the retired fixed-slot notification triggers.
 *
 * Deliberately targeted, and deliberately not stopAllTriggers(): that would also
 * delete the 15-minute processChaseEmails trigger, which is now the thing that
 * sends sync notifications in the first place. Killing it would silently stop
 * both importing AND notifying.
 *
 * @returns {number} how many were removed
 */
function retireFixedNotificationTriggers_() {
  var RETIRED = ['sendMorningNotification', 'sendAfternoonNotification', 'sendEveningNotification'];
  var removed = 0;
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (RETIRED.indexOf(t.getHandlerFunction()) >= 0) {
      ScriptApp.deleteTrigger(t);
      removed++;
    }
  });
  return removed;
}

/** Public wrapper — safe to run on its own to clean up an already-deployed script. */
function retireFixedNotificationTriggers() {
  var removed = retireFixedNotificationTriggers_();
  Logger.log('Removed ' + removed + ' retired fixed-slot notification trigger(s). ' +
             'The processChaseEmails importer trigger was NOT touched.');
}

function setupNotifications() {
  var retired = retireFixedNotificationTriggers_();

  // Collapse duplicates of the end-of-day trigger too — re-running setup should be
  // idempotent, not additive.
  var existing = ScriptApp.getProjectTriggers().filter(function (t) {
    return t.getHandlerFunction() === 'sendEndOfDaySummary';
  });
  existing.forEach(function (t) { ScriptApp.deleteTrigger(t); });

  ScriptApp.newTrigger('sendEndOfDaySummary')
    .timeBased().atHour(END_OF_DAY_HOUR).everyDays(1).inTimezone(NOTIFICATION_TZ).create();

  Logger.log('Retired ' + retired + ' fixed-slot trigger(s); removed ' + existing.length +
             ' duplicate end-of-day trigger(s).');
  Logger.log('One notification trigger now exists: sendEndOfDaySummary at ' +
             END_OF_DAY_HOUR + ':00 ' + NOTIFICATION_TZ + '.');
  Logger.log('Sync notifications need no trigger of their own — processChaseEmails sends them.');
}

// ---------------------------------------------------------------------------
// Budget context
// ---------------------------------------------------------------------------

/** The one gate meaning "this row counts against my monthly budget". */
function isBudgetRow_(e) {
  if (e.tripId) return false;              // trips have their own budget
  if (e.excludeFromBudget) return false;   // explicit user opt-out (script.js:2327)
  // Absent `kind` means 'variable' — see 2026-08-01-income-fixed-ledger-design.md §3.
  // Without this an income row would add ~$4,000 to monthTotal and instantly push
  // "over the $2,000 cap".
  if ((e.kind || 'variable') !== 'variable') return false;
  return true;
}

/**
 * Assemble everything the message builders need.
 *
 * THROWS if any underlying read failed. Callers must abort without sending: a
 * budget number derived from a failed query is indistinguishable from a real one,
 * which is exactly the bug this replaces (a swallowed 4xx made monthTotal 0, the
 * target compute HEALTHY, and the push confidently announce invented headroom).
 */
function buildBudgetContext_(config) {
  var now = new Date();
  var today = Utilities.formatDate(now, NOTIFICATION_TZ, 'yyyy-MM-dd');
  var monthStart = today.slice(0, 8) + '01';

  var expenses = fetchExpensesFromFirestore_(config, monthStart, today);
  var gamification = fetchGamification_(config);

  var monthRows = expenses.filter(isBudgetRow_);
  var todayRows = monthRows.filter(function (e) { return e.date === today; });
  var day = (gamification.dailyLog && gamification.dailyLog[today]) || null;

  // No food total and no daysLeft-derived allowance: with the caps gone there is
  // nothing to compare a food subtotal against. daysLeft is still carried because
  // daysLeftInMonth_ is the fixed-timezone helper and callers may want it later.
  return {
    today: today,
    todayTotal: sumExpenses_(todayRows),
    todayCount: todayRows.length,
    monthTotal: sumExpenses_(monthRows),
    daysLeft: daysLeftInMonth_(now),
    monthName: Utilities.formatDate(now, NOTIFICATION_TZ, 'MMMM'),
    streak: (gamification.streak && gamification.streak.current) || 0,
    checkedIn: !!(day && day.checkedIn),
    mood: (day && day.mood) || null
  };
}

/**
 * Days remaining in the month, INCLUDING today.
 *
 * All three components — year, month AND day — come from NOTIFICATION_TZ. The old
 * version read the day-of-month in America/Los_Angeles but derived the month and
 * year from getFullYear()/getMonth(), which Apps Script evaluates in the SCRIPT
 * timezone (appsscript.json declares America/New_York). At 22:00 PDT on Aug 31 it
 * was already Sep 1 in ET, so lastDay came back as September's 30 and the function
 * returned 30 - 31 + 1 = 0 days left. Date.UTC is used for the arithmetic so no
 * implicit local zone can leak back in.
 *
 * @param {Date} [now] injectable for tests
 */
function daysLeftInMonth_(now) {
  now = now || new Date();
  var y = parseInt(Utilities.formatDate(now, NOTIFICATION_TZ, 'yyyy'), 10);
  var m = parseInt(Utilities.formatDate(now, NOTIFICATION_TZ, 'MM'), 10);  // 1-12
  var d = parseInt(Utilities.formatDate(now, NOTIFICATION_TZ, 'dd'), 10);
  // Day 0 of month m (1-based) === last day of month m, because the Date month
  // argument is 0-based: Date.UTC(2026, 8, 0) is Aug 31, not Sep 0.
  var lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return lastDay - d + 1;
}

function sumExpenses_(arr) {
  return arr.reduce(function(sum, e) { return sum + (Number(e.amount) || 0); }, 0);
}

// ---------------------------------------------------------------------------
// Message copy — two templates, down from twelve (3 slots x 4 budget states)
// ---------------------------------------------------------------------------

/** 1234567 -> "1,234,567". Leaves any decimal part alone. */
function withCommas_(s) {
  return String(s).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}
/** Whole dollars, for budget positions: $1,000 */
function money0_(n) { return '$' + withCommas_(Math.round(Number(n) || 0)); }
/** Exact dollars and cents, for transaction amounts: $14.50 */
function money2_(n) { return '$' + withCommas_((Number(n) || 0).toFixed(2)); }

/**
 * The shared month-position phrase and its "what now" tail, so the sync batch and
 * the end-of-day summary can never disagree about where the month stands.
 */
/**
 * Copy for one sync that imported >= 1 transaction.
 *
 *   1 new · $14.50 · MENDOCINO FARMS
 *   $1,284 spent in August
 *
 *   2 new · $27.45
 *   $1,284 spent in August
 *
 * The merchant appears ONLY when the batch is exactly one — with two rows there is
 * no single honest name to show, and listing both blows the title width.
 *
 * No targets, no "$X of $Y", no per-day allowance: the soft/hard/food caps were
 * arbitrary constants and were removed from the product. The push states the
 * month total and nothing else.
 *
 * @param {{count:number, total:number, merchant:?string}} batch
 */
function buildSyncBatchMessage_(batch, ctx) {
  var title = batch.count + ' new · ' + money2_(batch.total);
  if (batch.count === 1 && batch.merchant) title += ' · ' + batch.merchant;
  return {
    title: title,
    body: money0_(ctx.monthTotal) + ' spent in ' + ctx.monthName
  };
}

/**
 * Copy for the 22:00 summary. The check-in prompt is the point: it drives the
 * streak, and the notification is the entry point.
 *
 *   $62 today · 4 transactions
 *   $1,284 spent in August · tap to tag your day
 */
function buildEndOfDayMessage_(ctx) {
  return {
    title: money0_(ctx.todayTotal) + ' today · ' + ctx.todayCount +
           (ctx.todayCount === 1 ? ' transaction' : ' transactions'),
    body: money0_(ctx.monthTotal) + ' spent in ' + ctx.monthName + ' · tap to tag your day'
  };
}

// ---------------------------------------------------------------------------
// Senders
// ---------------------------------------------------------------------------

/**
 * Called by processChaseEmails() when a run imported >= 1 transaction.
 * @param {{count:number, total:number, merchant:?string}} batch
 */
function notifySyncBatch_(config, batch) {
  if (!batch || !batch.count) return;   // belt and braces: nothing imported, nothing sent
  if (!config.uid) { Logger.log('Sync notification skipped: no UID configured'); return; }
  // view=transactions so a tap lands on the rows that just arrived.
  send_(config, buildSyncBatchMessage_, [batch], COLLAPSE_KEY_SYNC, { view: 'transactions' },
        'sync-batch(' + batch.count + ')');
}

/** 22:00 trigger handler. */
function sendEndOfDaySummary() {
  var config = getConfig();
  if (!config.uid) { Logger.log('No UID configured'); return; }
  // view=habit opens the habit card ready to log. NOTE: firebase-messaging-sw.js
  // currently ignores payload.data on notificationclick and always opens './' — it
  // needs to route on data.view for this to land on the card. Sending the key now so
  // the client change is a one-liner.
  send_(config, buildEndOfDayMessage_, [], COLLAPSE_KEY_END_OF_DAY, { view: 'habit' }, 'end-of-day');
}

/**
 * The single send path: gather everything, then broadcast.
 *
 * EVERY read happens inside this try. If any of them failed we abort WITHOUT
 * sending, because a push built on a failed read is indistinguishable from a real
 * one — that is the defect this replaces. Aborting is also why the token-list read
 * throws rather than returning []: "the read broke" must not look like "nobody is
 * subscribed", and it must certainly not be followed by a push.
 *
 * @param {function} builder    buildSyncBatchMessage_ or buildEndOfDayMessage_
 * @param {Array} leadingArgs   extra args the builder takes before ctx
 */
function send_(config, builder, leadingArgs, collapseKey, data, label) {
  var ctx, tokens;
  try {
    ctx = buildBudgetContext_(config);
    tokens = fetchFcmTokens_(config);
  } catch (err) {
    Logger.log('ABORT ' + label + ' — a required read failed, sending nothing: ' + err.message);
    return;
  }
  var msg = builder.apply(null, leadingArgs.concat([ctx]));
  broadcast_(config, msg, collapseKey, data, label, tokens);
}

/** Send one message to every registered token. */
function broadcast_(config, msg, collapseKey, data, label, tokens) {
  if (!tokens.length) { Logger.log(label + ': no registered tokens'); return; }

  var sent = 0, removed = 0, errors = 0;
  tokens.forEach(function (tokenData) {
    var result = sendFcmMessage_(config, tokenData.token, msg, collapseKey, data);
    if (result === 'sent') sent++;
    else if (result === 'stale') { deleteToken_(config, tokenData.docId); removed++; }
    else errors++;
  });

  Logger.log(label + ': sent ' + sent + ', removed ' + removed + ' unregistered token(s), ' +
             errors + ' error(s) | "' + msg.title + '" / "' + msg.body + '"');
  if (!sent && errors === tokens.length) {
    // Signature of a misconfiguration (bad projectId, revoked scope) rather than a
    // dead device. Worth shouting about precisely because nothing was deleted.
    Logger.log('WARNING: every token errored and none were deleted. Check FIREBASE_PROJECT_ID ' +
               'and the firebase.messaging OAuth scope before assuming the tokens are bad.');
  }
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

  // THROW, never `return []`. A swallowed 4xx used to become an empty array, so
  // monthTotal was 0, getActiveTarget_ computed HEALTHY, and the push confidently
  // announced invented headroom — indistinguishable from a real notification, and
  // invisible because a caught error never triggers Apps Script's failure email.
  if (res.getResponseCode() >= 300) {
    throw new Error('Expense query failed (' + res.getResponseCode() + '): ' +
                    res.getContentText().substring(0, 200));
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
      tripId: (f.tripId && f.tripId.stringValue) || null,
      // The parser previously mapped only amount/category/date/tripId, so it was
      // structurally incapable of filtering excludeFromBudget — pushes overstated the
      // month total versus Home, which does filter it (script.js:2327).
      excludeFromBudget: !!(f.excludeFromBudget && f.excludeFromBudget.booleanValue),
      // Absent means 'variable' (2026-08-01-income-fixed-ledger-design.md §1).
      kind: (f.kind && f.kind.stringValue) || 'variable'
    });
  });
  return expenses;
}

/**
 * Read the gamification doc.
 *
 * A 404 is legitimate — the user has never checked in, so there is no doc — and
 * yields an empty-but-valid result. Any OTHER failure THROWS: returning null on a
 * 403 or 500 silently rendered as "not checked in", so the end-of-day push would
 * nag someone who had already tagged their day and report a 0 streak they had not
 * lost.
 */
function fetchGamification_(config) {
  var url = 'https://firestore.googleapis.com/v1/projects/' + config.projectId +
    '/databases/(default)/documents/users/' + config.uid + '/state/gamification';
  var res = firestoreFetch(url);
  var code = res.getResponseCode();
  var empty = { streak: { current: 0 }, dailyLog: {} };
  if (code === 404) return empty;
  if (code !== 200) {
    throw new Error('Gamification read failed (' + code + '): ' +
                    res.getContentText().substring(0, 200));
  }
  var data = JSON.parse(res.getContentText());
  if (!data.fields) return empty;

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

/**
 * List registered tokens. A 404 means the collection is empty (nobody has enabled
 * push yet) — that is genuinely zero tokens. Any other failure THROWS rather than
 * silently reporting zero, because "the read broke" and "nobody is subscribed" are
 * very different states and the old code could not tell them apart.
 */
function fetchFcmTokens_(config) {
  var url = 'https://firestore.googleapis.com/v1/projects/' + config.projectId +
    '/databases/(default)/documents/users/' + config.uid + '/fcmTokens';
  var res = firestoreFetch(url);
  var code = res.getResponseCode();
  if (code === 404) return [];
  if (code !== 200) {
    throw new Error('Token list read failed (' + code + '): ' +
                    res.getContentText().substring(0, 200));
  }
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

// The ONLY FCM error code that means "this token is dead, delete it".
//
// The old check substring-matched the raw response body for NOT_FOUND /
// UNREGISTERED / INVALID_ARGUMENT and then hard-deleted the token doc. But FCM
// returns INVALID_ARGUMENT for a malformed REQUEST and NOT_FOUND for a wrong
// PROJECT PATH — neither says anything about the token. One typo in projectId
// therefore returned those for EVERY token and wiped the whole fcmTokens
// collection in a single run, silently killing all push delivery until the user
// happened to reopen the PWA. Substring matching made it worse still: the string
// "UNREGISTERED" appearing anywhere in a diagnostic message was enough.
//
// UNREGISTERED is token-shaped. It is the only one. This mirrors
// messaging/registration-token-not-registered, the check the retired Node sender
// used. Note that sender ALSO deleted on messaging/invalid-argument — that was
// the same bug in Admin-SDK clothing, and is deliberately not carried over.
const FCM_UNREGISTERED = 'UNREGISTERED';

/**
 * Classify an FCM failure from its STRUCTURED error, never from raw body text.
 *
 * @returns {'stale'|'error'}
 */
function classifyFcmError_(body) {
  var parsed;
  try {
    parsed = JSON.parse(body);
  } catch (err) {
    // Unparseable body: we have no idea what happened, so we certainly do not know
    // the token is dead. Never delete on a guess.
    return 'error';
  }

  var error = parsed && parsed.error;
  if (!error) return 'error';

  // The authoritative field is the FcmError detail, which carries the token-specific
  // errorCode. error.status is the transport-level code (INVALID_ARGUMENT, NOT_FOUND,
  // …) and is NOT a statement about the token.
  var details = error.details || [];
  for (var i = 0; i < details.length; i++) {
    var d = details[i] || {};
    var type = d['@type'] || '';
    if (type.indexOf('FcmError') >= 0 && d.errorCode === FCM_UNREGISTERED) return 'stale';
  }

  // Some responses omit details and report the token state in error.status directly.
  // Accept it there too, but ONLY for the exact token-shaped code — a request-shaped
  // status (INVALID_ARGUMENT, NOT_FOUND, PERMISSION_DENIED, …) stays an 'error'.
  if (error.status === FCM_UNREGISTERED) return 'stale';

  return 'error';
}

/**
 * @param {{title:string, body:string}} msg
 * @param {string} collapseKey  per-purpose, so a newer push supersedes the older
 * @param {Object} [data]       FCM data payload, e.g. { view: 'habit' }
 */
function sendFcmMessage_(config, token, msg, collapseKey, data) {
  var accessToken = ScriptApp.getOAuthToken();
  var url = 'https://fcm.googleapis.com/v1/projects/' + config.projectId + '/messages:send';
  var message = {
    token: token,
    notification: { title: msg.title, body: msg.body },
    // collapseKey is per-platform in the FCM v1 API. Android uses android.collapse_key;
    // Apple uses the apns-collapse-id header, which is what iOS reads to REPLACE a
    // shown notification instead of stacking a second one. webpush uses the
    // Notification `tag`, which is what a browser/PWA respects.
    android: { collapse_key: collapseKey },
    apns: { headers: { 'apns-collapse-id': collapseKey } },
    webpush: { notification: { tag: collapseKey } }
  };
  if (data) {
    // FCM requires every data value to be a string.
    var stringData = {};
    Object.keys(data).forEach(function (k) { stringData[k] = String(data[k]); });
    message.data = stringData;
  }

  var res = UrlFetchApp.fetch(url, {
    method: 'post',
    contentType: 'application/json',
    headers: { Authorization: 'Bearer ' + accessToken },
    payload: JSON.stringify({ message: message }),
    muteHttpExceptions: true
  });

  var code = res.getResponseCode();
  if (code === 200) return 'sent';

  var errBody = res.getContentText();
  var verdict = classifyFcmError_(errBody);
  if (verdict === 'stale') {
    Logger.log('FCM reports token UNREGISTERED — deleting: ...' + String(token).slice(-8));
    return 'stale';
  }
  Logger.log('FCM send failed (' + code + '), token KEPT: ' + errBody.substring(0, 300));
  return 'error';
}

function deleteToken_(config, docId) {
  var url = 'https://firestore.googleapis.com/v1/projects/' + config.projectId +
    '/databases/(default)/documents/users/' + config.uid + '/fcmTokens/' + docId;
  firestoreFetch(url, { method: 'delete' });
}

// ---------------------------------------------------------------------------
// Manual test entry points (run from the Apps Script editor)
// ---------------------------------------------------------------------------

/** Fire the real end-of-day summary now, against live data. */
function testNotification() {
  sendEndOfDaySummary();
}

/** Fire a fake 1-transaction sync batch now, against live budget data. */
function testSyncBatchNotification() {
  var config = getConfig();
  notifySyncBatch_(config, { count: 1, total: 14.5, merchant: 'MENDOCINO FARMS' });
}

/** Log both message bodies without sending anything. Safe to run any time. */
function previewNotificationCopy() {
  var config = getConfig();
  var ctx = buildBudgetContext_(config);   // throws if a read failed — that is the point
  var sync1 = buildSyncBatchMessage_({ count: 1, total: 14.5, merchant: 'MENDOCINO FARMS' }, ctx);
  var syncN = buildSyncBatchMessage_({ count: 2, total: 27.45, merchant: 'MENDOCINO FARMS' }, ctx);
  var eod = buildEndOfDayMessage_(ctx);
  Logger.log('batch of 1 : ' + sync1.title + ' / ' + sync1.body);
  Logger.log('batch of 2 : ' + syncN.title + ' / ' + syncN.body);
  Logger.log('end of day : ' + eod.title + ' / ' + eod.body);
  Logger.log('daysLeft=' + ctx.daysLeft + ' monthTotal=' + ctx.monthTotal + ' todayCount=' + ctx.todayCount);
}

// ===========================================================================
// STOP TRIGGERS
//
// stopGmailSync()   — removes only the processChaseEmails trigger
// stopAllTriggers() — removes ALL triggers (Gmail sync + notifications)
//
// To retire just the old fixed-slot notification triggers, use
// retireFixedNotificationTriggers() above — NOT stopAllTriggers(), which would
// also delete the 15-minute processChaseEmails trigger that now sends sync
// notifications.
// ===========================================================================

function stopGmailSync() {
  var removed = 0;
  ScriptApp.getProjectTriggers().forEach(function(t) {
    if (t.getHandlerFunction() === 'processChaseEmails') {
      ScriptApp.deleteTrigger(t);
      removed++;
    }
  });
  Logger.log('Stopped Gmail sync: removed ' + removed + ' trigger(s)');
}

// DANGER: this kills the importer too, and with it every sync notification.
// It is a full stop, not a notification cleanup. Run setup() afterwards to restore.
function stopAllTriggers() {
  var triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(function(t) {
    Logger.log('Deleting trigger: ' + t.getHandlerFunction());
    ScriptApp.deleteTrigger(t);
  });
  Logger.log('Stopped ALL triggers: removed ' + triggers.length + ' trigger(s)');
  Logger.log('This included the 15-minute processChaseEmails importer. Run setup() to restore it.');
}
