/**
 * Seed realistic demo data into the LOCAL browser only.
 *
 * Paste this whole file into the Ledgr console. Nothing runs until you call a
 * function — see the printed menu at the end.
 *
 *   IMPORTANT — SIGN OUT FIRST, or use a private window.
 *   While signed in, ExpenseTracker mirrors writes to Firestore
 *   (users/{uid}/expenses), so seeding would push demo rows to your real cloud
 *   account and the realtime listener would pull them back. Signed out, this
 *   touches localStorage['expenses'] only.
 *
 * Covers every combination the new data model cares about:
 *   - kind absent          -> treated as 'variable' (the 647 real rows look like this)
 *   - kind:'fixed'         -> rent / utilities / car, varying month to month
 *   - kind:'income'        -> paycheques
 *   - excludeFromBudget    -> a big one-off that shouldn't count
 *   - tripId               -> trip rows, excluded from "regular" spend
 *   - source variants      -> manual / gmail / chase-gmail / restored (icon check)
 *
 * And it deliberately leaves ONE month with no fixed rows so you can see the
 * "estimated" fallback, and one with partial fixed rows so you can see accumulation.
 */

(function () {
    'use strict';

    // ---- local date helpers (never toISOString — that's UTC and shifts a day) ----
    const ymd = (y, m, d) => `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const now = new Date();
    const Y = now.getFullYear();
    const M = now.getMonth();          // current month index
    const today = now.getDate();

    let seq = 0;
    const row = (o) => Object.assign({
        id: 'demo_' + (Date.now() + (seq++)),
        amount: 0,
        description: '',
        category: 'Other',
        date: ymd(Y, M, 1),
        timestamp: Date.now() + seq,
        excludeFromBudget: false,
        tripId: null,
        source: 'manual'
    }, o);

    // ---- merchants that look like a real ledger --------------------------------
    const FOOD = [['Chipotle', 14.39], ['Mendocino Farms', 14.50], ['Desi Adda', 22.06],
                  ['Hui Lau Shan', 12.70], ['Qdoba', 12.97], ['Joes Pizza', 8.25],
                  ['Whole Foods', 38.07], ['India Metro Hyper', 11.84]];
    const COFFEE = [['Starbucks', 5.24], ['Woods Coffee', 6.18], ['Summit Cafe', 12.95],
                    ['Blue Bottle', 7.10]];
    const TRANSPORT = [['Uber', 21.56], ['Costco Gas', 85.06], ['MTA NYCT Paygo', 3.00],
                       ['Seattle Parking', 16.00]];
    const SHOP = [['Amazon.com', 23.58], ['HM.COM', 105.98], ['Levis Store 602', 76.43],
                  ['Sephora', 22.00]];
    const FUN = [['Cinemark', 19.33], ['Spotify', 11.99], ['Pacific Science Center', 21.00]];

    const pick = (arr, i) => arr[i % arr.length];

    /** Build a month of variable spending. dayCap lets the current month stop at today. */
    function variableMonth(y, m, count, dayCap) {
        const out = [];
        const lastDay = dayCap || new Date(y, m + 1, 0).getDate();
        for (let i = 0; i < count; i++) {
            const d = 1 + Math.floor((i / count) * (lastDay - 1));
            const bucket = i % 5;
            const [name, base] =
                bucket === 0 ? pick(FOOD, i) :
                bucket === 1 ? pick(COFFEE, i) :
                bucket === 2 ? pick(TRANSPORT, i) :
                bucket === 3 ? pick(SHOP, i) : pick(FUN, i);
            const category =
                bucket === 0 ? 'Food' : bucket === 1 ? 'Coffee' :
                bucket === 2 ? 'Transportation' : bucket === 3 ? 'Shopping' : 'Entertainment';
            // vary the amount a little so charts aren't flat
            const amount = Math.round((base * (0.75 + ((i * 37) % 50) / 100)) * 100) / 100;
            out.push(row({
                amount, description: name, category, date: ymd(y, m, d),
                // spread the source types so the row icons are all visible
                source: i % 7 === 0 ? 'gmail' : i % 11 === 0 ? 'chase-gmail' : 'manual'
            }));
        }
        return out;
    }

    // =======================================================================
    // 1. FULL — 4 months, every field combination
    // =======================================================================
    window.seedDemoData = function (opts) {
        const o = opts || {};
        if (window.currentUser && o.force !== true) {
            console.warn('You are SIGNED IN. Seeding would mirror demo rows to Firestore.');
            console.warn('Sign out (or use a private window), then re-run seedDemoData().');
            console.warn('To override anyway: seedDemoData({force:true})');
            return;
        }

        const rows = [];

        // three complete prior months + the current month up to today
        rows.push(...variableMonth(Y, M - 3, 34));
        rows.push(...variableMonth(Y, M - 2, 41));
        rows.push(...variableMonth(Y, M - 1, 38));
        rows.push(...variableMonth(Y, M, Math.max(6, Math.min(30, today * 2)), today));

        // ---- fixed costs -------------------------------------------------------
        // M-3: NONE  -> exercises the "estimated" settings fallback
        // M-2: rent + utilities + car
        // M-1: rent + utilities + car + insurance (the 6-month cadence lands here)
        // M  : rent only so far -> exercises accumulation, add utilities later
        const fixed = (m, items) => items.forEach(([name, amt, day]) => rows.push(row({
            amount: amt, description: name, category: 'Bills',
            date: ymd(Y, m, day), kind: 'fixed'
        })));
        fixed(M - 2, [['Rent', 1200, 1], ['Utilities', 138.42, 12], ['Car payment', 410, 5]]);
        fixed(M - 1, [['Rent', 1200, 1], ['Utilities', 164.90, 12], ['Car payment', 410, 5],
                      ['Insurance', 622.50, 8]]);
        fixed(M,     [['Rent', 1200, 1]]);

        // ---- income ------------------------------------------------------------
        // Two paycheques a month, and M-3 intentionally has none.
        const income = (m, amts) => amts.forEach(([amt, day]) => rows.push(row({
            amount: amt, description: 'Paycheck', category: 'Other',
            date: ymd(Y, m, day), kind: 'income'
        })));
        income(M - 2, [[2140.55, 15], [2140.55, 30]]);
        income(M - 1, [[2140.55, 15], [2298.10, 30]]);
        if (today >= 15) income(M, [[2298.10, 15]]);

        // ---- excludeFromBudget: a big one-off that must not count --------------
        rows.push(row({
            amount: 1519, description: 'Belred Oral Maxillofacial', category: 'Other',
            date: ymd(Y, M - 1, 9), excludeFromBudget: true, source: 'restored'
        }));

        // ---- a trip, with rows tagged to it ------------------------------------
        const tripId = 'demo_trip_1';
        const tripStart = ymd(Y, M - 1, 20), tripEnd = ymd(Y, M - 1, 24);
        [['Alaska Airlines', 328.40, 20, 'Transportation'],
         ['Hotel Ace', 214.00, 21, 'Other'],
         ['Stone Street Cafe', 18.75, 22, 'Food'],
         ['MoMA', 30.00, 23, 'Entertainment'],
         ['Uber', 41.20, 24, 'Transportation']].forEach(([n, a, d, c]) => rows.push(row({
            amount: a, description: n, category: c, date: ymd(Y, M - 1, d), tripId
        })));
        localStorage.setItem('trips', JSON.stringify([{
            id: tripId, name: 'Portland weekend', destination: 'Portland, OR',
            startDate: tripStart, endDate: tripEnd, budget: 1200,
            state: 'completed', createdAt: Date.now()
        }]));

        // ---- write -------------------------------------------------------------
        localStorage.setItem('expenses', JSON.stringify(rows));

        // ---- a streak so the habit card has something to show ------------------
        const log = {};
        const moods = ['no-spend', 'essential', 'essential', 'wants', 'essential', 'no-spend'];
        for (let back = 1; back <= 6; back++) {
            const d = new Date(); d.setDate(d.getDate() - back);
            log[ymd(d.getFullYear(), d.getMonth(), d.getDate())] =
                { logged: true, checkedIn: true, mood: moods[back % moods.length], underBudget: true };
        }
        localStorage.setItem('ledgr_gamification', JSON.stringify({
            xp: 240, level: 3,
            streak: { current: 0, best: 12, lastDate: null, freezeUsedOn: null },
            achievements: [], dailyLog: log, weeklyQuest: null, milestoneShownFor: 3
        }));

        const kinds = rows.reduce((a, r) => { const k = r.kind || 'variable'; a[k] = (a[k] || 0) + 1; return a; }, {});
        console.log('Seeded ' + rows.length + ' rows:', kinds);
        console.log('  1 trip, 1 excludeFromBudget row, 6 days of check-ins');
        console.log('  month -3 has NO fixed and NO income rows -> "estimated" fallback');
        console.log('  this month has rent only -> add utilities to watch it accumulate');
        console.log('Reload the page to pick it up.');
        return { rows: rows.length, kinds };
    };

    // =======================================================================
    // 2. MINIMAL — just enough to exercise kind, for a quick check
    // =======================================================================
    window.seedMinimal = function (opts) {
        const o = opts || {};
        if (window.currentUser && o.force !== true) {
            console.warn('Signed in — sign out first, or seedMinimal({force:true}).');
            return;
        }
        const rows = [
            row({ amount: 42.50, description: 'Trader Joes', category: 'Food', date: ymd(Y, M, Math.max(1, today - 2)) }),
            row({ amount: 6.25,  description: 'Blue Bottle', category: 'Coffee', date: ymd(Y, M, Math.max(1, today - 1)), source: 'gmail' }),
            row({ amount: 18.90, description: 'Chipotle', category: 'Food', date: ymd(Y, M, today) }),
            row({ amount: 1200,  description: 'Rent', category: 'Bills', date: ymd(Y, M, 1), kind: 'fixed' }),
            row({ amount: 145,   description: 'Utilities', category: 'Bills', date: ymd(Y, M, 12), kind: 'fixed' }),
            row({ amount: 4000,  description: 'Paycheck', category: 'Other', date: ymd(Y, M, 15), kind: 'income' }),
        ];
        localStorage.setItem('expenses', JSON.stringify(rows));
        console.log('Seeded 6 rows: 3 variable ($67.65), 2 fixed ($1,345), 1 income ($4,000).');
        console.log('Home should show $67.65 — NOT $5,412.65. Reload to check.');
        return rows.length;
    };

    // =======================================================================
    // 3. Inspect / clear
    // =======================================================================
    window.inspectDemoData = function () {
        const all = JSON.parse(localStorage.getItem('expenses') || '[]');
        const t = window.expenseTracker;
        const byKind = all.reduce((a, r) => { const k = r.kind || 'variable'; a[k] = (a[k] || 0) + 1; return a; }, {});
        const sum = (rs) => rs.reduce((s, r) => s + Number(r.amount || 0), 0);
        console.log('rows                :', all.length, byKind);
        console.log('variable total      : $' + sum(all.filter(r => (r.kind || 'variable') === 'variable')).toFixed(2));
        console.log('fixed total         : $' + sum(all.filter(r => r.kind === 'fixed')).toFixed(2));
        console.log('income total        : $' + sum(all.filter(r => r.kind === 'income')).toFixed(2));
        if (t && t.fixedFor) {
            console.log('fixedFor(this month):', JSON.stringify(t.fixedFor(Y, M)).slice(0, 120));
            console.log('incomeFor(this mo)  :', JSON.stringify(t.incomeFor(Y, M)).slice(0, 120));
            console.log('spendingRows()      :', t.spendingRows().length, 'of', t.expenses.length);
        }
        return { rows: all.length, byKind };
    };

    window.clearDemoData = function (opts) {
        if (!opts || opts.confirm !== true) {
            console.warn('This wipes localStorage expenses/trips/gamification.');
            console.warn('Run: clearDemoData({confirm:true})');
            return;
        }
        ['expenses', 'trips', 'ledgr_gamification', 'gmail_processed_ids', 'gmail_last_synced']
            .forEach(k => localStorage.removeItem(k));
        console.log('Cleared. Reload the page.');
    };

    console.log('%cLedgr demo seeder', 'font-weight:bold');
    console.log('SIGN OUT FIRST (or use a private window) — signed in, writes mirror to Firestore.');
    console.log('  seedDemoData()     4 months, every field combination, trip, streak');
    console.log('  seedMinimal()      6 rows, quick kind check');
    console.log('  inspectDemoData()  read-only summary');
    console.log('  clearDemoData({confirm:true})');
})();
