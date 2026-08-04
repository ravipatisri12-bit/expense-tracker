// ============================================================================
// LEDGR DATA REPAIR
//
// Paste this whole file into the browser console with Ledgr open and signed in.
// Nothing mutates until you pass {confirm:true}.
//
// Why the naive "same date + description + amount" dedupe does NOT work here:
// the Apps Script importer and the in-app importer disagree on BOTH fields.
//
//   Jul 25  "SQ *KWALITY ICE CREA"  Food   $13.20   <- in-app (mail icon), correct
//   Jul 26  "KWALITY ICE CREA"      Other  $13.20   <- Apps Script copy
//
//   - date: the Apps Script used the email's ARRIVAL time (and formatted it in ET),
//     so alerts that landed after midnight got the next day.
//   - description: the Apps Script strips "SQ */TST*/DD *" processor prefixes.
//   - category: the stripped name missed the merchant map, so it fell back to Other.
//
// So matching is fuzzy: same amount, within N days, and equal AFTER normalizing the
// merchant name. Fuzzy matching alone is not safe though — buying the same boba on
// three consecutive days looks identical to one purchase imported three times.
//
// The discriminator is `source`. A genuine cross-importer duplicate is exactly one
// row with source==='gmail' (or manual) paired with one source==='chase-gmail'. Two
// 'gmail' rows on nearby days are two real purchases and are never touched.
// ============================================================================

// ---------- normalization ----------
window.__normMerchant = function (d) {
  return String(d || '')
    .toUpperCase()
    // Processor prefixes the two importers disagree about. Strip only the
    // "XX *" marker, never a following word — removing "DOORDASH" too would
    // collapse "DD *DOORDASH KWALITY" to "KWALITY" and wrongly match the
    // in-store "SQ *KWALITY ICE CREA", which is a different purchase.
    .replace(/^(SQ|SQU|TST|PP|PAY|DD)\s*\*+\s*/, '')
    .replace(/[^A-Z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
};

window.__dayNum = function (d) {
  const p = String(d).split('-');
  return Math.floor(Date.UTC(+p[0], +p[1] - 1, +p[2]) / 86400000);
};

// ---------- STEP 1: find cross-importer duplicates (READ ONLY) ----------
// Returns pairs where a chase-gmail row shadows a gmail/manual row.
window.findImportDuplicates = function (opts) {
  const dayWindow = (opts && opts.days) != null ? opts.days : 2;
  const t = window.expenseTracker;

  const script = t.expenses.filter(e => e.source === 'chase-gmail');
  const others = t.expenses.filter(e => e.source !== 'chase-gmail');

  const claimed = new Set();
  const pairs = [];

  script.forEach(s => {
    const sn = window.__normMerchant(s.description);
    if (!sn) return;
    // Best candidate: same amount, nearest date, matching normalized merchant.
    let best = null, bestGap = Infinity;
    others.forEach(o => {
      if (claimed.has(o.id)) return;
      if (Number(o.amount).toFixed(2) !== Number(s.amount).toFixed(2)) return;
      const gap = Math.abs(window.__dayNum(o.date) - window.__dayNum(s.date));
      if (gap > dayWindow) return;
      const on = window.__normMerchant(o.description);
      if (!on) return;
      const stem = Math.min(10, Math.min(on.length, sn.length));
      const match = on === sn || on.slice(0, stem) === sn.slice(0, stem);
      if (match && gap < bestGap) { best = o; bestGap = gap; }
    });
    if (best) { claimed.add(best.id); pairs.push({ keep: best, drop: s, gap: bestGap }); }
  });

  console.log('=== cross-importer duplicates ===');
  console.log('chase-gmail rows      :', script.length);
  console.log('matched to a real row :', pairs.length, '  <- these chase-gmail copies are removable');
  console.log('unmatched chase-gmail :', script.length - pairs.length, '  <- ONLY copy, do NOT delete');
  pairs.slice(0, 60).forEach(p => {
    console.log('  KEEP ' + p.keep.date + ' "' + p.keep.description + '" [' + p.keep.category + '] ' +
                (p.keep.source || 'manual') +
                '   DROP ' + p.drop.date + ' "' + p.drop.description + '" [' + p.drop.category + ']');
  });
  if (pairs.length > 60) console.log('  ... and ' + (pairs.length - 60) + ' more');

  const unmatched = script.filter(s => !pairs.some(p => p.drop.id === s.id));
  if (unmatched.length) {
    console.log('\n--- unmatched chase-gmail rows (KEEPING these; they are the only copy) ---');
    unmatched.slice(0, 40).forEach(e => console.log('  ' + e.date + ' "' + e.description + '" [' + e.category + '] $' + e.amount));
    if (unmatched.length > 40) console.log('  ... and ' + (unmatched.length - 40) + ' more');
  }
  return { pairs: pairs, unmatched: unmatched };
};

// ---------- STEP 2: delete the shadowed copies ----------
window.removeImportDuplicates = async function (opts) {
  const res = window.findImportDuplicates(opts);
  const victims = res.pairs.map(p => p.drop);
  if (!victims.length) { console.log('Nothing to remove.'); return { removed: 0 }; }

  if (!opts || opts.confirm !== true) {
    console.warn('\nDRY RUN — nothing deleted. To apply:');
    console.warn('  removeImportDuplicates({confirm:true})');
    console.warn('Adjust the window with {days:1} or {days:3} if the pairing looks wrong.');
    return { wouldRemove: victims.length };
  }

  const t = window.expenseTracker;
  if (window.currentUser && window.firebaseDb) {
    for (let i = 0; i < victims.length; i += 400) {
      const batch = window.firebaseDb.batch();
      victims.slice(i, i + 400).forEach(e => batch.delete(
        window.firebaseDb.collection('users').doc(window.currentUser.uid)
          .collection('expenses').doc(String(e.id))));
      await batch.commit();
    }
  }
  const gone = new Set(victims.map(e => String(e.id)));
  t.expenses = t.expenses.filter(e => !gone.has(String(e.id)));
  t.saveExpenses(); t.updateDashboard(); t.renderTransactions();
  console.log('Removed ' + victims.length + '. Now ' + t.expenses.length + ' transactions.');
  return { removed: victims.length, remaining: t.expenses.length };
};

// ---------- STEP 3: restore transactions deleted by the earlier cleanup ----------
window.__RESTORE = [];   // populated below

window.restoreLost = async function (opts) {
  const t = window.expenseTracker;
  // Match loosely so we don't re-add something already present under a variant name.
  const have = t.expenses.map(e => ({
    amt: Number(e.amount).toFixed(2), day: window.__dayNum(e.date), n: window.__normMerchant(e.description)
  }));
  const present = r => have.some(h =>
    h.amt === Number(r.amount).toFixed(2) &&
    Math.abs(h.day - window.__dayNum(r.date)) <= 2 &&
    h.n === window.__normMerchant(r.description));

  const missing = window.__RESTORE.filter(r => !present(r));
  if (!missing.length) { console.log('restoreLost: all present already.'); return { added: 0 }; }

  console.log('restoreLost: ' + missing.length + ' of ' + window.__RESTORE.length + ' missing, $' +
    missing.reduce((s, r) => s + r.amount, 0).toFixed(2));
  missing.forEach(r => console.log('   add ' + r.date + ' "' + r.description + '" [' + r.category + '] $' + r.amount));

  if (!opts || opts.confirm !== true) {
    console.warn('DRY RUN. Re-run as: restoreLost({confirm:true})');
    return { wouldAdd: missing.length };
  }

  const docs = missing.map((r, i) => ({
    id: 'rec_' + r.date.replace(/-/g, '') + '_' + i,
    amount: Number(r.amount), description: r.description,
    category: r.category || 'Other', date: r.date,
    timestamp: Date.now() + i, excludeFromBudget: false,
    source: 'restored', tripId: null
  }));
  t.addExpensesBatch(docs);
  console.log('Added ' + docs.length + '. Now ' + t.expenses.length + ' transactions.');
  return { added: docs.length, remaining: t.expenses.length };
};

// ---------- STEP 4: fix categories on rows the Apps Script guessed wrong ----------
// Copies the category from a matching in-app row onto any 'Other' chase-gmail row
// that survived (the unmatched ones — they're the only copy, so they stay).
window.fixOtherCategories = async function (opts) {
  const t = window.expenseTracker;
  const known = {};
  t.expenses.forEach(e => {
    if (e.category && e.category !== 'Other' && e.source !== 'chase-gmail') {
      known[window.__normMerchant(e.description)] = e.category;
    }
  });

  const fixes = [];
  t.expenses.forEach(e => {
    if (e.category && e.category !== 'Other') return;
    const c = known[window.__normMerchant(e.description)];
    if (c) fixes.push({ e: e, to: c });
  });

  if (!fixes.length) { console.log('No Other rows with a known category elsewhere.'); return { fixed: 0 }; }
  console.log(fixes.length + ' rows can be re-categorized from your own history:');
  fixes.slice(0, 60).forEach(f => console.log('  ' + f.e.date + ' "' + f.e.description + '"  Other -> ' + f.to));
  if (fixes.length > 60) console.log('  ... and ' + (fixes.length - 60) + ' more');

  if (!opts || opts.confirm !== true) {
    console.warn('DRY RUN. Re-run as: fixOtherCategories({confirm:true})');
    return { wouldFix: fixes.length };
  }

  fixes.forEach(f => { f.e.category = f.to; });
  if (window.currentUser && window.firebaseDb) {
    for (let i = 0; i < fixes.length; i += 400) {
      const batch = window.firebaseDb.batch();
      fixes.slice(i, i + 400).forEach(f => batch.set(
        window.firebaseDb.collection('users').doc(window.currentUser.uid)
          .collection('expenses').doc(String(f.e.id)), f.e));
      await batch.commit();
    }
  }
  t.saveExpenses(); t.updateDashboard(); t.renderTransactions();
  console.log('Re-categorized ' + fixes.length + '.');
  return { fixed: fixes.length };
};

// ---------- verify ----------
window.verifyState = function () {
  const t = window.expenseTracker;
  const bySource = {};
  t.expenses.forEach(e => { const s = e.source || '(manual)'; bySource[s] = (bySource[s] || 0) + 1; });
  const other = t.expenses.filter(e => !e.category || e.category === 'Other').length;
  const total = t.expenses.reduce((s, e) => s + Number(e.amount || 0), 0);
  console.log('rows        :', t.expenses.length);
  console.log('total $     :', total.toFixed(2));
  console.log('by source   :', bySource);
  console.log('category=Other:', other);
  const dup = window.findImportDuplicates({ days: 2 });
  console.log('remaining cross-importer dupes:', dup.pairs.length, '(target 0)');
  return { rows: t.expenses.length, total: +total.toFixed(2), bySource: bySource, otherCount: other };
};

console.log('Loaded. Run in order:');
console.log('  1) downloadBackup()');
console.log('  2) findImportDuplicates()            // read-only, review the pairing');
console.log('  3) removeImportDuplicates({confirm:true})');
console.log('  4) fixOtherCategories()              // dry run, then {confirm:true}');
console.log('  5) verifyState()');
