/**
 * Audit / clean up the Gmail Apps Script import.
 *
 * Paste into the browser console with Ledgr open and signed in.
 * Nothing here writes until you explicitly call cleanupChaseGmail().
 *
 * Context: the Apps Script importer (gmail-import/apps-script.js) writes docs with
 * id "gm_<gmailMessageId>" and source:"chase-gmail". The in-app importer writes the
 * SAME id scheme but source:"gmail". Manual entries have no source. So writes are
 * attributable per-importer, and a bad Apps Script run is removable without
 * touching anything you typed by hand.
 */

// ---------------------------------------------------------------------------
// 1. READ-ONLY: what's actually in there?
// ---------------------------------------------------------------------------
window.auditGmailImport = function () {
    const all = window.expenseTracker.expenses;

    const bySource = {};
    all.forEach(e => {
        const k = e.source || '(manual)';
        bySource[k] = (bySource[k] || 0) + 1;
    });

    const gmPrefixed = all.filter(e => String(e.id).startsWith('gm_'));
    const chaseGmail = all.filter(e => e.source === 'chase-gmail');
    const inApp = all.filter(e => e.source === 'gmail');

    // Same transaction imported twice under different ids/sources:
    // match on amount + date + normalized description.
    const key = e => [Number(e.amount).toFixed(2), e.date, String(e.description || '').trim().toUpperCase()].join('|');
    const seen = {};
    all.forEach(e => { (seen[key(e)] = seen[key(e)] || []).push(e); });
    const dupeGroups = Object.entries(seen).filter(([, v]) => v.length > 1);

    console.log('=== Ledgr import audit ===');
    console.log('total transactions :', all.length);
    console.log('by source          :', bySource);
    console.log('gm_ prefixed ids   :', gmPrefixed.length);
    console.log('  source=chase-gmail (Apps Script):', chaseGmail.length);
    console.log('  source=gmail       (in-app)     :', inApp.length);
    console.log('duplicate groups   :', dupeGroups.length);

    if (dupeGroups.length) {
        console.log('\n--- duplicates (same amount+date+description) ---');
        dupeGroups.slice(0, 40).forEach(([k, v]) => {
            console.log(k, '->', v.map(e => `${e.id} [${e.source || 'manual'}]`).join('  '));
        });
        if (dupeGroups.length > 40) console.log(`... and ${dupeGroups.length - 40} more groups`);
    }

    // Dates far outside a plausible range are a sign the script imported very old
    // mail, or parsed dates wrong.
    const dates = chaseGmail.map(e => e.date).filter(Boolean).sort();
    if (dates.length) console.log('\nchase-gmail date range:', dates[0], '->', dates[dates.length - 1]);

    return { total: all.length, bySource, gmPrefixed: gmPrefixed.length, chaseGmail: chaseGmail.length, inApp: inApp.length, dupeGroups: dupeGroups.length };
};

// ---------------------------------------------------------------------------
// 2. DESTRUCTIVE: remove everything the Apps Script wrote.
//    Requires confirm:true so a stray paste can't wipe data.
// ---------------------------------------------------------------------------
window.cleanupChaseGmail = async function (opts) {
    const o = opts || {};
    if (o.confirm !== true) {
        console.warn('Refusing to run. Back up first with downloadBackup(), then call:');
        console.warn("  cleanupChaseGmail({ confirm: true })");
        return;
    }

    const t = window.expenseTracker;
    const victims = t.expenses.filter(e => e.source === 'chase-gmail');
    if (!victims.length) { console.log('Nothing with source="chase-gmail" to remove.'); return; }

    console.log(`Deleting ${victims.length} Apps Script imports...`);

    // Firestore first (source of truth), then local.
    if (window.currentUser && window.firebaseDb) {
        // Batches cap at 500 ops.
        for (let i = 0; i < victims.length; i += 400) {
            const batch = window.firebaseDb.batch();
            victims.slice(i, i + 400).forEach(e => {
                batch.delete(window.firebaseDb.collection('users').doc(window.currentUser.uid)
                    .collection('expenses').doc(String(e.id)));
            });
            await batch.commit();
            console.log(`  committed ${Math.min(i + 400, victims.length)}/${victims.length}`);
        }
    }

    const gone = new Set(victims.map(e => String(e.id)));
    t.expenses = t.expenses.filter(e => !gone.has(String(e.id)));
    t.saveExpenses();
    t.updateDashboard();
    t.renderTransactions();

    console.log(`Done. Removed ${victims.length}. Remaining: ${t.expenses.length}`);
    return { removed: victims.length, remaining: t.expenses.length };
};

// ---------------------------------------------------------------------------
// 3. Reset the in-app importer's ledger so it can re-import cleanly afterwards.
// ---------------------------------------------------------------------------
window.resetGmailSyncLedger = async function (opts) {
    if (!opts || opts.confirm !== true) {
        console.warn("Call resetGmailSyncLedger({ confirm: true }) to clear processedIds.");
        return;
    }
    localStorage.removeItem('gmail_processed_ids');
    localStorage.removeItem('gmail_last_synced');
    if (window.emailParser) window.emailParser._processedIds = [];
    if (window.currentUser && window.firebaseDb) {
        await window.firebaseDb.collection('users').doc(window.currentUser.uid)
            .collection('settings').doc('gmail_sync').set({ processedIds: [] }, { merge: true });
    }
    console.log('Gmail sync ledger cleared. Next sync will re-scan the last 30 days.');
};

console.log('Loaded. Run auditGmailImport() first — it only reads.');
