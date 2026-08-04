/**
 * Exercise the fixed/income model before the Phase 2 UI exists.
 *
 * Paste into the Ledgr console (or `await import('/tools/try-fixed-income.js')`).
 * These are the console equivalents of the buttons Phase 2 will add, so you can
 * test the CROSS-MONTH behaviour now: add rent to any month, watch it accumulate,
 * and see when a month falls back to the settings estimate.
 *
 * Sign out first, or these mirror to Firestore.
 */
(function () {
    'use strict';

    const t = () => window.expenseTracker;
    const M = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const pad = (n) => String(n).padStart(2, '0');

    /** Month arg is 1-12 (human), converted to 0-11 internally. */
    function norm(year, month1) {
        const now = new Date();
        return {
            y: year || now.getFullYear(),
            m: (month1 ? month1 - 1 : now.getMonth())
        };
    }

    /**
     * Add or UPDATE one fixed cost for a month. Re-running with the same name
     * overwrites rather than duplicating — the id is derived from name+month,
     * which is how the Phase 2 form will behave when you edit an amount.
     *
     *   addFixed('Rent', 1200)              // this month
     *   addFixed('Utilities', 138.42)       // accumulates
     *   addFixed('Insurance', 622.50, 2026, 6)  // June
     */
    window.addFixed = function (name, amount, year, month1) {
        const { y, m } = norm(year, month1);
        return upsert('fixed', name, amount, y, m, 'Bills');
    };

    /**
     *   addIncome('Paycheck', 2140.55)
     *   addIncome('Paycheck 2', 2140.55)    // two paycheques in a month
     */
    window.addIncome = function (name, amount, year, month1) {
        const { y, m } = norm(year, month1);
        return upsert('income', name, amount, y, m, 'Other');
    };

    function upsert(kind, name, amount, y, m, category) {
        const tr = t();
        if (!tr) { console.warn('expenseTracker not ready'); return; }
        // Day 1 for fixed, day 15 for income — arbitrary but stable.
        const day = kind === 'income' ? 15 : 1;
        const date = `${y}-${pad(m + 1)}-${pad(day)}`;
        const id = `${kind}_${y}${pad(m + 1)}_${name.toLowerCase().replace(/[^a-z0-9]+/g, '')}`;

        const existing = tr.expenses.find(e => String(e.id) === id);
        if (existing) {
            existing.amount = Number(amount);
            tr.saveExpenses();
            if (window.currentUser) tr.saveExpenseToFirebase(existing);
            tr.updateDashboard(); tr.renderTransactions();
            console.log(`updated ${kind} "${name}" -> $${amount} for ${M[m]} ${y}`);
        } else {
            tr.addExpensesBatch([{
                id, amount: Number(amount), description: name, category,
                date, timestamp: Date.now(), excludeFromBudget: false,
                tripId: null, source: 'manual', kind
            }]);
            console.log(`added ${kind} "${name}" $${amount} to ${M[m]} ${y}`);
        }
        return showMonth(y, m + 1);
    }

    /** Remove one, to test that a month can fall back to "estimated" again. */
    window.removeFixed = function (name, year, month1) {
        const { y, m } = norm(year, month1);
        const id = `fixed_${y}${pad(m + 1)}_${name.toLowerCase().replace(/[^a-z0-9]+/g, '')}`;
        const tr = t();
        const before = tr.expenses.length;
        tr.expenses = tr.expenses.filter(e => String(e.id) !== id);
        tr.saveExpenses(); tr.updateDashboard(); tr.renderTransactions();
        console.log(before === tr.expenses.length ? `no fixed row "${name}" in ${M[m]} ${y}` : `removed "${name}"`);
        return showMonth(y, m + 1);
    };

    /** The month's full picture: what the Phase 2 History panel will render. */
    window.showMonth = function (year, month1) {
        const { y, m } = norm(year, month1);
        const tr = t();
        const fx = tr.fixedFor(y, m);
        const inc = tr.incomeFor(y, m);
        const variable = tr.spendingRows()
            .filter(e => { const d = tr.parseLocalDate(e.date); return d.getFullYear() === y && d.getMonth() === m; })
            .reduce((s, e) => s + Number(e.amount || 0), 0);
        const savings = inc.total - fx.total - variable;

        const tag = (o) => o.estimated ? '(estimated from Settings)' : `(${o.count} row${o.count === 1 ? '' : 's'})`;
        console.log(`\n=== ${M[m]} ${y} ===`);
        console.log(`  income    $${inc.total.toFixed(2).padStart(10)}  ${tag(inc)}`);
        console.log(`  fixed     $${fx.total.toFixed(2).padStart(10)}  ${tag(fx)}`);
        console.log(`  variable  $${variable.toFixed(2).padStart(10)}  (spendingRows only)`);
        console.log(`  savings   $${savings.toFixed(2).padStart(10)}  = income - fixed - variable`);
        if (fx.rows.length) console.log('  fixed items:', fx.rows.map(r => `${r.description} $${r.amount}`).join(', '));
        if (inc.rows.length) console.log('  income items:', inc.rows.map(r => `${r.description} $${r.amount}`).join(', '));
        return { income: inc.total, fixed: fx.total, variable: +variable.toFixed(2), savings: +savings.toFixed(2),
                 incomeEstimated: inc.estimated, fixedEstimated: fx.estimated };
    };

    /** Side-by-side across a range, so cross-month behaviour is visible at once. */
    window.showYear = function (year) {
        const y = year || new Date().getFullYear();
        const tr = t();
        console.log(`\n=== ${y} ===`);
        console.log('      income      fixed   variable    savings   src');
        const out = [];
        for (let m = 0; m < 12; m++) {
            const fx = tr.fixedFor(y, m), inc = tr.incomeFor(y, m);
            const v = tr.spendingRows()
                .filter(e => { const d = tr.parseLocalDate(e.date); return d.getFullYear() === y && d.getMonth() === m; })
                .reduce((s, e) => s + Number(e.amount || 0), 0);
            if (!fx.total && !inc.total && !v) continue;
            const src = (fx.estimated ? 'F=est ' : 'F=row ') + (inc.estimated ? 'I=est' : 'I=row');
            console.log(`${M[m]}  ${fmt(inc.total)} ${fmt(fx.total)} ${fmt(v)} ${fmt(inc.total - fx.total - v)}   ${src}`);
            out.push({ month: M[m], income: inc.total, fixed: fx.total, variable: +v.toFixed(2) });
        }
        console.log('\nF=row / I=row means real rows exist. F=est means it fell back to Settings.');
        return out;
    };
    const fmt = (n) => ('$' + Math.round(n).toLocaleString('en-US')).padStart(10);

    console.log('%cFixed / income console controls', 'font-weight:bold');
    console.log('  addFixed("Rent", 1200)                  add or update, this month');
    console.log('  addFixed("Utilities", 138.42)           watch it accumulate');
    console.log('  addFixed("Insurance", 622.50, 2026, 6)  a specific month (1-12)');
    console.log('  addIncome("Paycheck", 2140.55)');
    console.log('  removeFixed("Utilities")                back to fewer rows');
    console.log('  showMonth()          this month; showMonth(2026, 5) for May');
    console.log('  showYear()           every month side by side');
})();
