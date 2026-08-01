const GMAIL_LABEL = 'Chase Transactions';

// ===========================================================================
// ONE-SHOT SETUP
//
// Script properties and triggers are not exposed to clasp (or any MCP), but
// they ARE scriptable from inside Apps Script. So: paste your UID below, run
// setup() once, and read the log. It is idempotent — safe to re-run.
// ===========================================================================

const SETUP_FIREBASE_UID = 'PASTE_YOUR_FIREBASE_UID_HERE';
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

function categorize(merchant) {
  const map = getMerchantMap();
  const upper = merchant.toUpperCase();
  for (const [key, cat] of Object.entries(map)) {
    if (upper.includes(key) || key.includes(upper)) return cat;
  }
  return 'Other';
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

function processChaseEmails() {
  const label = GmailApp.getUserLabelByName(GMAIL_LABEL);
  if (!label) {
    Logger.log('Label "' + GMAIL_LABEL + '" not found');
    return;
  }

  const threads = label.getThreads().filter(t => t.isUnread());
  if (!threads.length) {
    Logger.log('No unread Chase emails');
    return;
  }

  let added = 0;
  let failed = 0;
  threads.forEach(thread => {
    const msg = thread.getMessages()[0];
    const parsed = parseChaseSubject(msg.getSubject());
    if (!parsed) return;

    const msgDate = msg.getDate();
    // Chase alerts report Eastern Time. Format in ET (not the script's timezone) so a
    // late-evening transaction doesn't land on the wrong calendar day.
    const date = Utilities.formatDate(msgDate, 'America/New_York', 'yyyy-MM-dd');

    const expense = {
      // Same scheme as js/email-parser.js so the two importers can't duplicate.
      id: 'gm_' + msg.getId(),
      gmailMessageId: msg.getId(),
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

    // Only mark read once the transaction is durably in Firestore. Previously this ran
    // unconditionally, so any failed write (quota, auth, network) silently dropped the
    // transaction forever — the email was read, so no later run would retry it.
    if (ok) {
      thread.markRead();
      added++;
    } else {
      failed++;
    }
  });

  Logger.log('Processed ' + added + ' Chase transactions' + (failed ? ' (' + failed + ' failed, left unread to retry)' : ''));
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
