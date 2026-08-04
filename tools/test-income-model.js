#!/usr/bin/env node
/**
 * Reusable harness for the income / fixed ledger model (phases 1 and 2).
 *
 * Spec: docs/superpowers/specs/2026-08-01-income-fixed-ledger-design.md
 *
 * Seeds localStorage with a fixed, realistic dataset, drives the real app in a
 * real browser, and reads the rendered Home + History numbers back out of the
 * DOM. Nothing here reimplements app logic — every number asserted is scraped
 * from what the page actually painted, so the harness cannot agree with a bug
 * that both it and the app share.
 *
 * Suites:
 *   (a) noop        — 40 rows with NO `kind`. Captures every Home + History
 *                     number. Run against the pre-change tree and the post-change
 *                     tree and diff: spendingRows() must be the identity function
 *                     on data with no `kind`. This is the phase-1 acceptance test.
 *   (b) newdata     — adds 1 income + 2 fixed rows dated in the CURRENT month and
 *                     asserts Home does not move while History picks them up.
 *   (c) fallback    — empty month -> settings estimate (estimated:true);
 *                     one row -> that row's sum (estimated:false); rows accumulate.
 *   (d) independence— income rows WITHOUT fixed rows: real income AND the fixed
 *                     estimate resolve simultaneously and independently.
 *   (e) txns        — PHASE 2. Income renders POSITIVE with a `+` and the primary
 *                     blue; fixed renders as a normal expense with a kind glyph;
 *                     variable markup is byte-unchanged; edit/delete/swipe still
 *                     work on all three kinds.
 *   (f) entry       — PHASE 2. The monthly entry card: names derived from LAST
 *                     month with BLANK amounts, accumulation, edit-not-duplicate,
 *                     blank-clears, and a PAST month being selected and fixed.
 *   (g) detail      — PHASE 2. History month detail shows income / fixed / real
 *                     savings and renders `(N items)` vs `(estimated)` correctly,
 *                     including a month that is mixed (real income, estimated fixed).
 *
 * Usage:
 *   node tools/test-income-model.js --baseline out.json     # capture (a) only
 *   node tools/test-income-model.js --compare base.json     # (a) diff + b,c,d
 *   node tools/test-income-model.js                         # run everything
 *
 * Options:
 *   --url <origin>        default http://localhost:5210
 *   --screenshot-dir <d>  default /tmp/ledgr-income-shots
 *   --headed              show the browser
 */

const fs = require('fs');
const path = require('path');
const { chromium } = require('/tmp/pwdrv/node_modules/playwright');

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

// ---------------------------------------------------------------------------
// Fixture
// ---------------------------------------------------------------------------

// "Today" is pinned by the caller's clock, but the fixture must land in known
// months relative to it, so month offsets are computed at runtime from local
// calendar parts (never a UTC ISO slice — that shifts a day in negative TZs).
function monthKey(offset) {
    const n = new Date();
    const d = new Date(n.getFullYear(), n.getMonth() - offset, 1);
    return { y: d.getFullYear(), m: d.getMonth() };
}

function dateIn(offset, day) {
    const { y, m } = monthKey(offset);
    const dim = new Date(y, m + 1, 0).getDate();
    const dd = Math.min(day, dim);
    return `${y}-${String(m + 1).padStart(2, '0')}-${String(dd).padStart(2, '0')}`;
}

// 40 rows with NO `kind` field, spread over the current month and the two
// before it. Amounts look like real data: mostly $5-$150 with a couple of large
// ones. A few rows carry excludeFromBudget, and a few carry a tripId, so the
// pre-existing filters are all exercised by the baseline.
function buildLegacyRows() {
    const spec = [
        // [monthOffset, day, amount, description, category, extra]
        [0, 2, 12.75, 'BLUE BOTTLE COFFEE', 'Coffee'],
        [0, 3, 64.2, 'TRADER JOES', 'Food'],
        [0, 4, 8.5, 'TST* SWEETGREEN', 'Food'],
        [0, 5, 145.99, 'COSTCO WHOLESALE', 'Shopping'],
        [0, 6, 22.4, 'UBER TRIP', 'Transportation'],
        [0, 8, 9.15, 'SQ *LOCAL BAKERY', 'Coffee'],
        [0, 9, 55.0, 'SHELL OIL', 'Transportation'],
        [0, 11, 31.87, 'CHIPOTLE', 'Food'],
        [0, 12, 1250.0, 'MOVERS DEPOSIT', 'Other', { excludeFromBudget: true }],
        [0, 14, 17.99, 'NETFLIX', 'Entertainment'],
        [0, 15, 78.3, 'WHOLE FOODS', 'Food'],
        [0, 16, 5.25, 'STARBUCKS', 'Coffee'],
        [0, 18, 42.6, 'TARGET', 'Shopping'],
        [0, 19, 120.0, 'AGI RENTERS CONDO INS', 'Bills'],
        [1, 2, 15.4, 'BLUE BOTTLE COFFEE', 'Coffee'],
        [1, 3, 92.11, 'SAFEWAY', 'Food'],
        [1, 5, 6.75, 'SQ *LOCAL BAKERY', 'Coffee'],
        [1, 6, 34.2, 'LYFT', 'Transportation'],
        [1, 7, 148.0, 'REI CO-OP', 'Shopping'],
        [1, 9, 27.5, 'TST* SWEETGREEN', 'Food'],
        [1, 10, 11.0, 'AMC THEATRES', 'Entertainment'],
        [1, 12, 63.45, 'TRADER JOES', 'Food'],
        [1, 14, 400.0, 'FLIGHT TO NYC', 'Transportation', { tripId: 'trip_fixture_1' }],
        [1, 15, 89.99, 'HOTEL NYC', 'Other', { tripId: 'trip_fixture_1' }],
        [1, 16, 46.2, 'NYC DINER', 'Food', { tripId: 'trip_fixture_1' }],
        [1, 18, 19.75, 'CVS PHARMACY', 'Other'],
        [1, 20, 7.4, 'STARBUCKS', 'Coffee'],
        [1, 22, 132.6, 'PG&E', 'Bills'],
        [2, 1, 13.2, 'BLUE BOTTLE COFFEE', 'Coffee'],
        [2, 3, 71.05, 'TRADER JOES', 'Food'],
        [2, 4, 24.99, 'SPOTIFY ANNUAL', 'Entertainment'],
        [2, 6, 58.4, 'SHELL OIL', 'Transportation'],
        [2, 8, 9.99, 'PAYPAL *NYTIMES', 'Other'],
        [2, 10, 103.75, 'COSTCO WHOLESALE', 'Shopping'],
        [2, 12, 38.6, 'CHIPOTLE', 'Food'],
        [2, 14, 6.5, 'SQ *LOCAL BAKERY', 'Coffee'],
        [2, 17, 875.0, 'DENTAL WORK', 'Other'],
        [2, 19, 44.25, 'WHOLE FOODS', 'Food'],
        [2, 21, 16.8, 'UBER TRIP', 'Transportation'],
        [2, 24, 128.4, 'PG&E', 'Bills'],
    ];
    return spec.map((r, i) => {
        const [off, day, amount, description, category, extra] = r;
        return Object.assign({
            id: 100000 + i,
            amount,
            description,
            category,
            date: dateIn(off, day),
            timestamp: 1750000000000 + i * 1000,
            excludeFromBudget: false,
            tripId: null,
            source: 'manual',
            // NOTE: deliberately NO `kind` field. This is the whole point of (a).
        }, extra || {});
    });
}

// A trip whose window covers the current month's 20th-24th. Used by (b) to prove
// backfillTripTags does not tag an income/fixed row that falls inside a trip.
function buildTrips() {
    return [{
        id: 'trip_fixture_1',
        name: 'NYC',
        budget: 1500,
        startDate: dateIn(0, 20),
        endDate: dateIn(0, 24),
        startedAt: null,
        endedAt: null,
        createdAt: 1750000000000,
        updatedAt: 1750000000000,
    }];
}

const SETTINGS = {
    income: 4000,
    incomeOverrides: {},
    rent: 1200,
    utilities: 150,
    insurance: 200,
    privacyMode: false,
    categories: ['Food', 'Transportation', 'Entertainment', 'Coffee', 'Shopping', 'Bills', 'Other'],
    goals: { Food: 300, Transportation: 200, Entertainment: 150, Coffee: 50, Shopping: 200, Bills: 400, Other: 100 },
};

// Signed rows for suite (b). Dated in the CURRENT month; the fixed rows sit on
// the 21st/22nd, i.e. INSIDE the fixture trip window, which is what makes the
// backfillTripTags assertion meaningful.
function buildSignedRows() {
    return [
        { id: 900001, amount: 4000, description: 'PAYCHECK', category: 'Other', date: dateIn(0, 15), timestamp: 1750900001000, excludeFromBudget: false, tripId: null, source: 'manual', kind: 'income' },
        { id: 900002, amount: 1200, description: 'RENT', category: 'Bills', date: dateIn(0, 21), timestamp: 1750900002000, excludeFromBudget: false, tripId: null, source: 'manual', kind: 'fixed' },
        { id: 900003, amount: 145, description: 'UTILITIES', category: 'Bills', date: dateIn(0, 22), timestamp: 1750900003000, excludeFromBudget: false, tripId: null, source: 'manual', kind: 'fixed' },
    ];
}

// ---------------------------------------------------------------------------
// Browser plumbing
// ---------------------------------------------------------------------------

function parseArgs(argv) {
    const o = { url: 'http://localhost:5210', shots: '/tmp/ledgr-income-shots', headed: false };
    for (let i = 2; i < argv.length; i++) {
        const a = argv[i];
        if (a === '--baseline') o.baseline = argv[++i];
        else if (a === '--compare') o.compare = argv[++i];
        else if (a === '--url') o.url = argv[++i];
        else if (a === '--screenshot-dir') o.shots = argv[++i];
        else if (a === '--headed') o.headed = true;
    }
    return o;
}

// Seed storage, then reload so the app boots from the seeded state. The app
// reads localStorage in the ExpenseTracker constructor, so seeding has to
// happen before the document script runs — hence addInitScript, not evaluate.
async function seed(page, url, { expenses, trips, settings }) {
    await page.addInitScript(({ e, t, s }) => {
        localStorage.clear();
        localStorage.setItem('expenses', JSON.stringify(e));
        localStorage.setItem('trips', JSON.stringify(t));
        localStorage.setItem('settings', JSON.stringify(s));
        // Keep the Gmail auto-import completely out of the test: it would race
        // the assertions and could write rows mid-run.
        localStorage.setItem('gmail_autosync_disabled', '1');
    }, { e: expenses, t: trips, s: settings });
    await page.goto(url, { waitUntil: 'load' });
    await page.waitForFunction(() => !!window.expenseTracker, null, { timeout: 15000 });
    await page.waitForTimeout(400);
}

// Everything the phase-1 no-op claim covers, scraped from the live DOM plus the
// handful of helper returns that have no DOM surface yet.
async function capture(page) {
    // Home
    await page.evaluate(() => window.showPage('dashboard'));
    await page.waitForTimeout(250);
    const home = await page.evaluate(() => {
        const txt = sel => (document.querySelector(sel)?.textContent || '').replace(/\s+/g, ' ').trim();
        const hero = document.querySelector('#home-month-hero');
        const cap = document.querySelector('#home-month-hero .cap-bar .fill');
        const paceCells = [...document.querySelectorAll('#home-month-hero .pace-cell')]
            .map(c => c.textContent.replace(/\s+/g, ' ').trim());
        return {
            heroMonthName: txt('#home-month-hero .month-name'),
            heroSpent: txt('#home-month-hero .month-spent'),
            heroOf: txt('#home-month-hero .month-of'),
            heroDayPill: txt('#home-month-hero .month-day-pill'),
            heroMeta: txt('#home-month-hero .month-meta'),
            capFillWidth: cap ? cap.style.width : null,
            pace: paceCells,
            forecast: txt('#home-month-hero .month-forecast'),
            composition: txt('#home-month-hero .month-composition'),
            insight: txt('#home-insight'),
            categories: txt('#home-categories'),
            trend: txt('#home-trend'),
            tripTeaser: txt('#home-trip-teaser'),
            heroPresent: !!hero,
        };
    });

    // History — capture every month of the current year, not just the default
    // selection, so a per-month regression can't hide behind the landing view.
    await page.evaluate(() => window.showPage('history'));
    // The card is collapsed by default; expand it before inspecting rows.
    await page.evaluate(() => { const b = document.querySelector('.le-toggle'); const c = document.querySelector('.ledger-entry'); if (b && c && !c.classList.contains('is-open')) b.click(); });
    await page.waitForTimeout(400);

    await page.waitForTimeout(250);
    const history = await page.evaluate(() => {
        const t = window.expenseTracker;
        const txt = sel => (document.querySelector(sel)?.textContent || '').replace(/\s+/g, ' ').trim();
        const out = {
            yearStats: txt('#history-year-stats'),
            yearShape: txt('#history-year-shape'),
            monthRail: txt('#history-month-rail'),
            categories: txt('#history-categories'),
            topRegulars: txt('#history-top-regulars'),
            pageMeta: txt('#history-page-meta'),
            monthDetail: {},
            barHeights: [...document.querySelectorAll('#history-year-shape .shape-bar')].map(b => b.style.height),
        };
        for (let m = 0; m < 12; m++) {
            window.onHistoryMonthSelect(m);
            out.monthDetail[m] = txt('#history-month-detail');
        }
        return out;
    });

    // Helper returns that phase 1 adds but does not yet surface in any DOM node.
    const helpers = await page.evaluate(() => {
        const t = window.expenseTracker;
        const now = new Date();
        const Y = now.getFullYear();
        // spendingRows/fixedFor/incomeFor do not exist in the pre-change tree, so
        // every new-helper read is optional. A baseline capture records null for
        // them and the diff drops those keys (see stripNewHelpers).
        const out = {
            year: Y,
            months: {},
            getYearIncome: t.getYearIncome(Y),
            spendingRowCount: t.spendingRows ? t.spendingRows().length : null,
            totalRowCount: t.expenses.length,
        };
        for (let m = 0; m < 12; m++) {
            out.months[m] = {
                fixed: t.fixedFor ? t.fixedFor(Y, m) : null,
                income: t.incomeFor ? t.incomeFor(Y, m) : null,
                regularCount: t.getRegularMonthExpenses(Y, m).length,
                regularSum: t.getRegularMonthExpenses(Y, m).reduce((s, e) => s + Number(e.amount || 0), 0),
            };
        }
        return out;
    });

    return { home, history, helpers };
}

// The pre-change tree has no fixedFor/incomeFor, so those keys are null in a
// baseline capture. Comparing them would be meaningless — the no-op claim is
// about numbers the USER can see, so drop helper-only keys from the diff.
function stripNewHelpers(snapshot) {
    const c = JSON.parse(JSON.stringify(snapshot));
    for (const m of Object.keys(c.helpers.months)) {
        delete c.helpers.months[m].fixed;
        delete c.helpers.months[m].income;
    }
    delete c.helpers.spendingRowCount; // null pre-change, a number after
    return c;
}

function flatten(obj, prefix = '', out = {}) {
    for (const [k, v] of Object.entries(obj)) {
        const key = prefix ? `${prefix}.${k}` : k;
        if (v && typeof v === 'object' && !Array.isArray(v)) flatten(v, key, out);
        else out[key] = Array.isArray(v) ? JSON.stringify(v) : v;
    }
    return out;
}

// ---------------------------------------------------------------------------
// Assertions
// ---------------------------------------------------------------------------

const results = [];
function assert(name, pass, detail) {
    results.push({ name, pass, detail });
    console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? `  — ${detail}` : ''}`);
}

function near(a, b, eps = 0.005) { return Math.abs(a - b) < eps; }

async function main() {
    const opts = parseArgs(process.argv);
    fs.mkdirSync(opts.shots, { recursive: true });

    const browser = await chromium.launch({ executablePath: CHROME, headless: !opts.headed });
    const ctx = await browser.newContext({ viewport: { width: 430, height: 1400 } });
    const page = await ctx.newPage();
    const consoleErrors = [];
    page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text()); });
    page.on('pageerror', e => consoleErrors.push('pageerror: ' + e.message));

    const legacy = buildLegacyRows();
    const trips = buildTrips();

    // ---------------- (a) NO-OP ----------------
    await seed(page, opts.url, { expenses: legacy, trips, settings: SETTINGS });
    const snapA = await capture(page);
    await page.evaluate(() => window.showPage('dashboard'));
    await page.waitForTimeout(200);
    await page.screenshot({ path: path.join(opts.shots, 'a-home-legacy.png'), fullPage: true });
    await page.evaluate(() => window.showPage('history'));
    // The card is collapsed by default; expand it before inspecting rows.
    await page.evaluate(() => { const b = document.querySelector('.le-toggle'); const c = document.querySelector('.ledger-entry'); if (b && c && !c.classList.contains('is-open')) b.click(); });
    await page.waitForTimeout(400);

    await page.waitForTimeout(200);
    await page.screenshot({ path: path.join(opts.shots, 'a-history-legacy.png'), fullPage: true });

    if (opts.baseline) {
        fs.writeFileSync(opts.baseline, JSON.stringify(snapA, null, 2));
        console.log(`\nBaseline written to ${opts.baseline}`);
        console.log(`rows=${snapA.helpers.totalRowCount} spendingRows=${snapA.helpers.spendingRowCount}`);
        await browser.close();
        return;
    }

    // Identity property, checkable without a baseline file.
    assert('(a) spendingRows() is identity on rows with no kind',
        snapA.helpers.spendingRowCount === snapA.helpers.totalRowCount,
        `${snapA.helpers.spendingRowCount}/${snapA.helpers.totalRowCount} rows`);

    if (opts.compare) {
        const base = JSON.parse(fs.readFileSync(opts.compare, 'utf8'));
        const A = flatten(stripNewHelpers(base));
        const B = flatten(stripNewHelpers(snapA));
        const keys = [...new Set([...Object.keys(A), ...Object.keys(B)])].sort();
        const diffs = keys.filter(k => String(A[k]) !== String(B[k]));
        assert('(a) every captured Home + History number is byte-identical to pre-change',
            diffs.length === 0,
            diffs.length ? `${diffs.length} differing key(s)` : `${keys.length} keys identical`);
        if (diffs.length) {
            console.log('\n  DIFFERING KEYS');
            for (const k of diffs) {
                console.log(`  ${k}\n    before: ${A[k]}\n    after : ${B[k]}`);
            }
        }
        // Side-by-side table of the headline numbers, always printed.
        const rows = [
            ['Home hero spent', base.home.heroSpent, snapA.home.heroSpent],
            ['Home hero caption', base.home.heroOf, snapA.home.heroOf],
            ['Home cap-bar fill', base.home.capFillWidth, snapA.home.capFillWidth],
            ['Home pace cells', JSON.stringify(base.home.pace), JSON.stringify(snapA.home.pace)],
            ['Home forecast', base.home.forecast, snapA.home.forecast],
            ['Home composition', base.home.composition, snapA.home.composition],
            ['Home insight', base.home.insight, snapA.home.insight],
            ['History year stats', base.history.yearStats, snapA.history.yearStats],
            ['History month rail', base.history.monthRail, snapA.history.monthRail],
            ['History categories', base.history.categories, snapA.history.categories],
            ['History top regulars', base.history.topRegulars, snapA.history.topRegulars],
            ['History bar heights', JSON.stringify(base.history.barHeights), JSON.stringify(snapA.history.barHeights)],
            ['getYearIncome(Y)', base.helpers.getYearIncome, snapA.helpers.getYearIncome],
            ['spendingRows count', base.helpers.spendingRowCount, snapA.helpers.spendingRowCount],
        ];
        console.log('\n  BEFORE / AFTER');
        for (const [label, before, after] of rows) {
            const same = String(before) === String(after);
            console.log(`  [${same ? 'same' : 'DIFF'}] ${label}`);
            console.log(`         before: ${String(before).slice(0, 220)}`);
            console.log(`         after : ${String(after).slice(0, 220)}`);
        }
        for (let m = 0; m < 12; m++) {
            const b = base.history.monthDetail[m], a = snapA.history.monthDetail[m];
            if (String(b) !== String(a)) console.log(`  [DIFF] month detail ${m}\n         before: ${b}\n         after : ${a}`);
        }
    }

    // ---------------- (b) NEW DATA ----------------
    const withSigned = legacy.concat(buildSignedRows());
    await seed(page, opts.url, { expenses: withSigned, trips, settings: SETTINGS });
    const snapB = await capture(page);
    await page.evaluate(() => window.showPage('dashboard'));
    await page.waitForTimeout(200);
    await page.screenshot({ path: path.join(opts.shots, 'b-home-signed.png'), fullPage: true });
    await page.evaluate(() => window.showPage('history'));
    // The card is collapsed by default; expand it before inspecting rows.
    await page.evaluate(() => { const b = document.querySelector('.le-toggle'); const c = document.querySelector('.ledger-entry'); if (b && c && !c.classList.contains('is-open')) b.click(); });
    await page.waitForTimeout(400);

    await page.waitForTimeout(200);
    await page.screenshot({ path: path.join(opts.shots, 'b-history-signed.png'), fullPage: true });

    assert('(b) Home hero month total does not move when income+fixed rows are added',
        snapB.home.heroSpent === snapA.home.heroSpent,
        `${snapA.home.heroSpent} -> ${snapB.home.heroSpent}`);
    assert('(b) Home cap bar does not move',
        snapB.home.capFillWidth === snapA.home.capFillWidth,
        `${snapA.home.capFillWidth} -> ${snapB.home.capFillWidth}`);
    assert('(b) Home aim-today / pace strip does not move',
        JSON.stringify(snapB.home.pace) === JSON.stringify(snapA.home.pace));
    assert('(b) Home forecast does not move',
        snapB.home.forecast === snapA.home.forecast,
        `${snapA.home.forecast} -> ${snapB.home.forecast}`);
    assert('(b) Home hero caption does not move',
        snapB.home.heroOf === snapA.home.heroOf);

    const now = new Date();
    const curM = now.getMonth();
    const bCur = snapB.helpers.months[curM];
    assert('(b) History month detail reports income 4000 from rows',
        bCur.income && near(bCur.income.total, 4000) && bCur.income.count === 1 && bCur.income.estimated === false,
        JSON.stringify(bCur.income));
    assert('(b) History month detail reports fixed 1345 with count 2',
        bCur.fixed && near(bCur.fixed.total, 1345) && bCur.fixed.count === 2 && bCur.fixed.estimated === false,
        JSON.stringify(bCur.fixed));

    const mf = await page.evaluate(() => {
        const t = window.expenseTracker;
        const list = window.MerchantFrequency.aggregate(t.expenses, new Date().getFullYear());
        return list.map(r => r.name);
    });
    assert('(b) merchant-frequency does not rank income/fixed rows',
        !mf.some(n => /paycheck|^rent$|^utilities$/i.test(n)),
        `top: ${mf.slice(0, 5).join(', ')}`);

    const tripCheck = await page.evaluate(() => {
        const t = window.expenseTracker;
        const ids = t.getTripExpenses('trip_fixture_1').map(e => e.id);
        return { ids, kinds: t.getTripExpenses('trip_fixture_1').map(e => e.kind || 'variable') };
    });
    assert('(b) getTripExpenses excludes income and fixed rows',
        !tripCheck.ids.includes(900002) && !tripCheck.ids.includes(900003) && tripCheck.kinds.every(k => k === 'variable'),
        `trip row ids: ${JSON.stringify(tripCheck.ids)}`);

    // backfillTripTags runs on every updateDashboard(). The two fixed rows are
    // dated inside the trip window, so if the gate were missing they would be
    // MUTATED with tripId — a stored-data corruption, not just a display bug.
    const backfill = await page.evaluate(() => {
        const t = window.expenseTracker;
        t.backfillTripTags();
        const stored = JSON.parse(localStorage.getItem('expenses') || '[]');
        const pick = id => stored.find(e => e.id === id);
        return {
            income: pick(900001) && pick(900001).tripId,
            rent: pick(900002) && pick(900002).tripId,
            utils: pick(900003) && pick(900003).tripId,
            // A variable row inside the same window SHOULD still get tagged,
            // proving the gate narrowed by kind and not by breaking the feature.
            controlTagged: stored.some(e => (e.kind || 'variable') === 'variable' && e.tripId === 'trip_fixture_1'),
        };
    });
    assert('(b) backfillTripTags does not tag income/fixed rows inside a trip window',
        backfill.income == null && backfill.rent == null && backfill.utils == null,
        `income=${backfill.income} rent=${backfill.rent} utils=${backfill.utils}`);
    assert('(b) backfillTripTags still tags variable rows (gate did not break the feature)',
        backfill.controlTagged === true);

    // ---------------- (c) FALLBACK ----------------
    // Month with zero fixed rows -> settings estimate, flagged estimated.
    const prevM = (curM + 11) % 12;
    const prev = snapB.helpers.months[prevM];
    assert('(c) month with zero fixed rows falls back to the settings estimate with estimated=true',
        prev.fixed.estimated === true && near(prev.fixed.total, 1550) && prev.fixed.count === 0,
        JSON.stringify(prev.fixed));

    // One fixed row -> that row's sum, estimated:false, NOT blank and NOT zero.
    const oneFixed = legacy.concat([buildSignedRows()[1]]);
    await seed(page, opts.url, { expenses: oneFixed, trips, settings: SETTINGS });
    const c1 = await page.evaluate(() => {
        const t = window.expenseTracker, n = new Date();
        return t.fixedFor(n.getFullYear(), n.getMonth());
    });
    assert('(c) month with ONE fixed row returns that row (1200), estimated=false, not blank/zero',
        near(c1.total, 1200) && c1.count === 1 && c1.estimated === false,
        JSON.stringify(c1));

    // Add the second -> accumulates to 1345.
    const twoFixed = legacy.concat([buildSignedRows()[1], buildSignedRows()[2]]);
    await seed(page, opts.url, { expenses: twoFixed, trips, settings: SETTINGS });
    const c2 = await page.evaluate(() => {
        const t = window.expenseTracker, n = new Date();
        return t.fixedFor(n.getFullYear(), n.getMonth());
    });
    assert('(c) fixed rows accumulate: 1200 -> 1345 after adding the second row',
        near(c2.total, 1345) && c2.count === 2 && c2.estimated === false,
        JSON.stringify(c2));

    // ---------------- (d) INDEPENDENCE PER TYPE ----------------
    const incomeOnly = legacy.concat([buildSignedRows()[0]]);
    await seed(page, opts.url, { expenses: incomeOnly, trips, settings: SETTINGS });
    const d = await page.evaluate(() => {
        const t = window.expenseTracker, n = new Date();
        const Y = n.getFullYear(), M = n.getMonth();
        return { income: t.incomeFor(Y, M), fixed: t.fixedFor(Y, M) };
    });
    assert('(d) income rows WITHOUT fixed rows: real income AND fixed estimate resolve independently',
        d.income.estimated === false && near(d.income.total, 4000) && d.income.count === 1 &&
        d.fixed.estimated === true && near(d.fixed.total, 1550) && d.fixed.count === 0,
        `income=${JSON.stringify(d.income)} fixed=${JSON.stringify(d.fixed)}`);
    await page.evaluate(() => window.showPage('history'));
    // The card is collapsed by default; expand it before inspecting rows.
    await page.evaluate(() => { const b = document.querySelector('.le-toggle'); const c = document.querySelector('.ledger-entry'); if (b && c && !c.classList.contains('is-open')) b.click(); });
    await page.waitForTimeout(400);

    await page.waitForTimeout(200);
    await page.screenshot({ path: path.join(opts.shots, 'd-history-income-only.png'), fullPage: true });

    // =======================================================================
    // PHASE 2
    // =======================================================================

    // ---------------- (e) TXNS SIGN + KIND GLYPH ----------------
    // The defect this fixes: an income row rendered as `-$4,000.00`, i.e. money IN
    // painted as an expense. Amounts stay positive in storage (spec §2), so the
    // sign is purely a rendering concern and belongs here.
    await seed(page, opts.url, { expenses: withSigned, trips, settings: SETTINGS });
    await page.evaluate(() => window.showPage('transactions'));
    await page.waitForTimeout(300);

    const txns = await page.evaluate(() => {
        const rows = [...document.querySelectorAll('.transaction-row')];
        const read = kind => rows.filter(r => r.dataset.kind === kind).map(r => ({
            amt: r.querySelector('.txn-amount')?.textContent?.trim(),
            color: r.querySelector('.txn-amount')?.style.color || '',
            glyph: r.querySelector('.kind-glyph')?.textContent?.trim() || null,
            sourceGlyphs: r.querySelectorAll('p.text-xs .material-symbols-rounded').length,
            edit: !!r.querySelector('button[onclick*="editExpense"]'),
            del: !!r.querySelector('button[onclick*="deleteExpense"]'),
            swipe: !!r.getAttribute('ontouchend'),
        }));
        // Day headers: a day holding a paycheque must not print it as a spend.
        const groups = [...document.querySelectorAll('#all-transactions > div.mb-2')]
            .filter(g => [...g.querySelectorAll('.transaction-row')].some(r => r.dataset.kind === 'income'))
            .map(g => (g.querySelector('.text-right')?.textContent || '').replace(/\s+/g, ' ').trim());
        return { income: read('income'), fixed: read('fixed'), variable: read('variable'), incomeDayHeaders: groups };
    });

    assert('(e) Txns: income renders POSITIVE (+$4,000.00), never with a leading minus',
        txns.income.length === 1 && /^\+\$4,000\.00$/.test(txns.income[0].amt),
        JSON.stringify(txns.income.map(r => r.amt)));
    assert('(e) Txns: income amount uses the primary blue, not the negative coral',
        txns.income.every(r => /primary/.test(r.color) && !/cf6679/i.test(r.color)),
        `color=${txns.income[0] && txns.income[0].color}`);
    assert('(e) Txns: income carries a distinct kind glyph (payments)',
        txns.income.every(r => r.glyph === 'payments'),
        `glyph=${txns.income[0] && txns.income[0].glyph}`);
    assert('(e) Txns: fixed renders like a normal expense (no sign) with its own glyph (event_repeat)',
        txns.fixed.length === 2 && txns.fixed.every(r => /^\$[\d,]+\.\d\d$/.test(r.amt) && r.glyph === 'event_repeat'),
        JSON.stringify(txns.fixed.map(r => `${r.amt} ${r.glyph}`)));
    // The regression guard for the 647 legacy rows: no kind means no glyph and no
    // sign prefix, so their markup is what it always was.
    assert('(e) Txns: variable rows are COMPLETELY unchanged — no kind glyph, no sign prefix',
        txns.variable.length === 40 &&
        txns.variable.every(r => r.glyph === null && /^\$[\d,]+\.\d\d$/.test(r.amt) && r.sourceGlyphs === 1),
        `${txns.variable.length} variable rows, glyphs=${new Set(txns.variable.map(r => r.glyph)).size === 1 ? 'none' : 'MIXED'}`);
    assert('(e) Txns: a day header containing income prints a separate +income line',
        txns.incomeDayHeaders.length === 1 && /\+\$4,000\.00/.test(txns.incomeDayHeaders[0]) &&
        !/-\$4,000/.test(txns.incomeDayHeaders[0]),
        JSON.stringify(txns.incomeDayHeaders));
    assert('(e) Txns: edit + delete + swipe handlers survive on ALL three kinds',
        ['income', 'fixed', 'variable'].every(k => txns[k].length > 0 && txns[k].every(r => r.edit && r.del && r.swipe)),
        'edit/delete/ontouchend present on income, fixed and variable');
    await page.screenshot({ path: path.join(opts.shots, 'e-txns-signed.png'), fullPage: false });

    // Edit and delete driven end to end on an income row — the buttons existing is
    // not the same as the flow working, and editExpense() must not drop `kind`.
    const crud = await page.evaluate(async () => {
        const t = window.expenseTracker;
        window.confirm = () => true;
        t.editExpense(900001);
        const open = !document.getElementById('edit-expense-modal').classList.contains('hidden');
        const prefill = document.getElementById('edit-amount').value;
        document.getElementById('edit-amount').value = '4100';
        await t.saveEditedExpense();
        const edited = t.expenses.find(e => e.id === 900001);
        const before = t.expenses.length;
        await t.deleteExpense(900003);
        return {
            open, prefill,
            kindKept: edited && edited.kind, amountAfter: edited && edited.amount,
            deleted: !t.expenses.some(e => e.id === 900003), rowsBefore: before, rowsAfter: t.expenses.length,
        };
    });
    assert('(e) Txns: editing an income row works and PRESERVES kind:income',
        crud.open && Number(crud.prefill) === 4000 && crud.kindKept === 'income' && crud.amountAfter === 4100,
        `modal=${crud.open} prefill=${crud.prefill} -> ${crud.amountAfter} kind=${crud.kindKept}`);
    assert('(e) Txns: deleting a fixed row works',
        crud.deleted && crud.rowsAfter === crud.rowsBefore - 1,
        `${crud.rowsBefore} -> ${crud.rowsAfter}`);

    // ---------------- (f) ENTRY CARD ----------------
    // Fixture: the PREVIOUS month carries four fixed names, the CURRENT month
    // carries rent only. That is the accumulation case ($1,200 -> $1,345) and the
    // "insurance skipped for months" case in one dataset.
    const prevMonthFixed = [
        { id: 910001, amount: 1200, description: 'Rent', category: 'Bills', date: dateIn(1, 1), timestamp: 1750910001000, excludeFromBudget: false, tripId: null, source: 'manual', kind: 'fixed' },
        { id: 910002, amount: 138.42, description: 'Utilities', category: 'Bills', date: dateIn(1, 12), timestamp: 1750910002000, excludeFromBudget: false, tripId: null, source: 'manual', kind: 'fixed' },
        { id: 910003, amount: 410, description: 'Car payment', category: 'Bills', date: dateIn(1, 5), timestamp: 1750910003000, excludeFromBudget: false, tripId: null, source: 'manual', kind: 'fixed' },
        { id: 910004, amount: 622.5, description: 'Insurance', category: 'Bills', date: dateIn(1, 8), timestamp: 1750910004000, excludeFromBudget: false, tripId: null, source: 'manual', kind: 'fixed' },
        { id: 910005, amount: 1200, description: 'Rent', category: 'Bills', date: dateIn(0, 1), timestamp: 1750910005000, excludeFromBudget: false, tripId: null, source: 'manual', kind: 'fixed' },
    ];
    await seed(page, opts.url, { expenses: legacy.concat(prevMonthFixed), trips, settings: SETTINGS });
    await page.evaluate(() => window.showPage('history'));
    // The card is collapsed by default; expand it before inspecting rows.
    await page.evaluate(() => { const b = document.querySelector('.le-toggle'); const c = document.querySelector('.ledger-entry'); if (b && c && !c.classList.contains('is-open')) b.click(); });
    await page.waitForTimeout(400);

    await page.waitForTimeout(400);

    const card = await page.evaluate(() => {
        const el = document.getElementById('history-ledger-entry');
        const rows = [...(el?.querySelectorAll('.le-row') || [])].map(r => ({
            name: (r.querySelector('.le-name-text')?.textContent || '').replace(/·.*$/, '').trim(),
            val: r.querySelector('input.le-amt')?.value,
            id: r.querySelector('input.le-amt')?.id,
            kind: r.querySelector('input.le-amt')?.dataset.kind,
        }));
        return {
            present: !!el, len: (el?.textContent || '').length, rows,
            hasAddFixed: !!el?.querySelector('button[onclick*="onLedgerAddRow(\'fixed\')"]'),
            hasAddIncome: !!el?.querySelector('button[onclick*="onLedgerAddRow(\'income\')"]'),
            hasPrev: !!el?.querySelector('button[onclick*="onLedgerMonthStep(-1)"]'),
            nextDisabled: el?.querySelector('button[onclick*="onLedgerMonthStep(1)"]')?.disabled,
        };
    });
    const fixedRows = card.rows.filter(r => r.kind === 'fixed');
    const incomeRows = card.rows.filter(r => r.kind === 'income');
    assert('(f) Entry card renders in History with a fixed section, an income section and Add affordances',
        card.present && card.len > 50 && fixedRows.length >= 4 && incomeRows.length >= 1 &&
        card.hasAddFixed && card.hasAddIncome,
        `fixed=${fixedRows.length} income=${incomeRows.length} addFixed=${card.hasAddFixed} addIncome=${card.hasAddIncome}`);
    assert('(f) Entry card derives names from LAST month\'s fixed rows (no stored template)',
        ['Rent', 'Utilities', 'Car payment', 'Insurance']
            .every(n => fixedRows.some(r => r.name.toLowerCase() === n.toLowerCase())),
        JSON.stringify(fixedRows.map(r => r.name)));
    assert('(f) Suggested-but-absent names come through with BLANK amounts (utilities vary, insurance is ~6-monthly)',
        ['Utilities', 'Car payment', 'Insurance']
            .every(n => fixedRows.find(r => r.name.toLowerCase() === n.toLowerCase())?.val === ''),
        JSON.stringify(fixedRows.map(r => `${r.name}=${JSON.stringify(r.val)}`)));
    assert('(f) An EXISTING row is pre-filled with its real amount so it edits in place',
        Number(fixedRows.find(r => /^rent$/i.test(r.name))?.val) === 1200,
        `Rent=${fixedRows.find(r => /^rent$/i.test(r.name))?.val}`);
    assert('(f) The month stepper can go back but not into the future',
        card.hasPrev && card.nextDisabled === true,
        `prev=${card.hasPrev} nextDisabled=${card.nextDisabled}`);

    const utilId = fixedRows.find(r => /utilities/i.test(r.name)).id;
    const readFixed = () => page.evaluate(() => {
        const t = window.expenseTracker, n = new Date();
        const f = t.fixedFor(n.getFullYear(), n.getMonth());
        const stored = JSON.parse(localStorage.getItem('expenses') || '[]')
            .filter(e => e.kind === 'fixed' && e.date.startsWith(`${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}`));
        return { total: f.total, count: f.count, estimated: f.estimated, stored: stored.map(e => ({ n: e.description, a: e.amount, d: e.date })) };
    });

    const f0 = await readFixed();
    assert('(f) Baseline: the current month holds rent only — $1,200, 1 item, not estimated',
        near(f0.total, 1200) && f0.count === 1 && f0.estimated === false, JSON.stringify(f0));

    // Type into the real input and blur, so the app's own onchange handler runs.
    const commit = async (id, value) => {
        await page.fill('#' + id, value);
        await page.evaluate(() => document.activeElement.blur());
        await page.waitForTimeout(600);
    };
    await commit(utilId, '145');
    const f1 = await readFixed();
    assert('(f) ACCUMULATION: entering utilities takes the month $1,200 -> $1,345 (2 items)',
        near(f1.total, 1345) && f1.count === 2 && f1.estimated === false, JSON.stringify({ total: f1.total, count: f1.count }));
    assert('(f) The write produced exactly ONE row, dated inside the month (no UTC shift, no overflow)',
        f1.stored.length === 2 && f1.stored.every(r => /^\d{4}-\d{2}-\d{2}$/.test(r.d)),
        JSON.stringify(f1.stored));

    // Re-entering the SAME name must update, not add a second row — a duplicate
    // would silently double the month total.
    const utilId2 = await page.evaluate(() => {
        const rows = [...document.querySelectorAll('#history-ledger-entry .le-row')];
        const r = rows.find(x => /utilities/i.test(x.querySelector('.le-name-text')?.textContent || ''));
        return r?.querySelector('input.le-amt')?.id;
    });
    await commit(utilId2, '160');
    const f2 = await readFixed();
    assert('(f) Editing an existing row UPDATES it ($1,360, still 2 items) rather than duplicating',
        near(f2.total, 1360) && f2.count === 2, JSON.stringify({ total: f2.total, count: f2.count }));

    await commit(utilId2, '');
    const f3 = await readFixed();
    assert('(f) A BLANK amount writes no row / clears an existing one (back to $1,200, 1 item)',
        near(f3.total, 1200) && f3.count === 1, JSON.stringify({ total: f3.total, count: f3.count }));

    // Income: a month can hold 1-2 paycheques and they accumulate the same way.
    const inc2 = await page.evaluate(async () => {
        const t = window.expenseTracker, n = new Date();
        const Y = n.getFullYear(), M = n.getMonth();
        const before = t.incomeFor(Y, M);
        await t.setLedgerRow('income', 'Paycheck', 2400, Y, M);
        await t.setLedgerRow('income', 'Paycheck 2', 2100, Y, M);
        const after = t.incomeFor(Y, M);
        return { before: { t: before.total, c: before.count, e: before.estimated }, after: { t: after.total, c: after.count, e: after.estimated } };
    });
    assert('(f) Income takes 1-2 paycheques per month and they accumulate to $4,500 (2 items)',
        inc2.before.e === true && near(inc2.after.t, 4500) && inc2.after.c === 2 && inc2.after.e === false,
        `${JSON.stringify(inc2.before)} -> ${JSON.stringify(inc2.after)}`);
    await page.evaluate(() => window.expenseTracker.renderHistoryPage());
    await page.waitForTimeout(300);
    await page.evaluate(() => document.getElementById('history-ledger-entry').scrollIntoView({ block: 'center' }));
    await page.screenshot({ path: path.join(opts.shots, 'f-entry-card.png'), fullPage: false });

    // A PAST month must be selectable and fixable — this is the Jan-Jul backfill.
    const past = await page.evaluate(async () => {
        window.onLedgerMonthStep(-1);
        window.onLedgerMonthStep(-1);   // two back: no rows there in this fixture
        const t = window.expenseTracker;
        const { year: Y, month: M } = t._historyState;
        const beforeF = t.fixedFor(Y, M), beforeI = t.incomeFor(Y, M);
        const label = document.querySelector('#history-ledger-entry .le-title')?.textContent?.trim();
        await t.setLedgerRow('fixed', 'Rent', 1150, Y, M);
        const afterF = t.fixedFor(Y, M);
        const stored = JSON.parse(localStorage.getItem('expenses') || '[]')
            .filter(e => e.kind === 'fixed' && e.date.startsWith(`${Y}-${String(M + 1).padStart(2, '0')}`));
        // Neighbour must be untouched: months resolve independently (spec §5).
        const nb = new Date(Y, M + 1, 1);
        const neighbour = t.fixedFor(nb.getFullYear(), nb.getMonth());
        return {
            Y, M, label,
            before: { f: { t: beforeF.total, c: beforeF.count, e: beforeF.estimated }, i: { c: beforeI.count, e: beforeI.estimated } },
            after: { t: afterF.total, c: afterF.count, e: afterF.estimated },
            stored: stored.map(e => e.date),
            neighbour: { t: neighbour.total, c: neighbour.count, e: neighbour.estimated },
        };
    });
    assert('(f) A PAST month can be selected from the entry card and starts out estimated',
        past.M !== new Date().getMonth() && !!past.label &&
        past.before.f.e === true && past.before.f.c === 0 && past.before.i.e === true,
        `"${past.label}" ${past.Y}-${past.M + 1} fixed=${JSON.stringify(past.before.f)}`);
    assert('(f) Entering a row FLIPS that past month from estimated to row-based',
        near(past.after.t, 1150) && past.after.c === 1 && past.after.e === false, JSON.stringify(past.after));
    assert('(f) The past-month row is dated inside its own month (day 1, never a UTC-shifted date)',
        past.stored.length === 1 && past.stored[0] === `${past.Y}-${String(past.M + 1).padStart(2, '0')}-01`,
        JSON.stringify(past.stored));
    assert('(f) Fixing one past month leaves its neighbour resolving independently',
        past.neighbour.c === 4 && past.neighbour.e === false, JSON.stringify(past.neighbour));

    // ---------------- (g) HISTORY MONTH DETAIL ----------------
    // Select the month with a full set of fixed rows, add real income to it, and
    // read the rendered card. Then strip the fixed rows and re-read: the same card
    // must switch that ONE line to "(estimated)" and leave income alone.
    const detail = await page.evaluate(async () => {
        const t = window.expenseTracker;
        const n = new Date();
        const d = new Date(n.getFullYear(), n.getMonth() - 1, 1);
        const Y = d.getFullYear(), M = d.getMonth();
        t._historyState.year = Y; t._historyState.month = M;
        await t.setLedgerRow('income', 'Paycheck', 2200, Y, M);
        await t.setLedgerRow('income', 'Paycheck 2', 2300, Y, M);
        t.renderHistoryPage();
        const read = () => (document.querySelector('#history-month-detail')?.textContent || '').replace(/\s+/g, ' ').trim();
        const actual = read();
        const f = t.fixedFor(Y, M), i = t.incomeFor(Y, M);
        const variable = t.spendingRows().filter(e => {
            const dd = t.parseLocalDate(e.date); return dd.getFullYear() === Y && dd.getMonth() === M;
        }).reduce((s, e) => s + Number(e.amount || 0), 0);
        // Now drop the fixed rows ONLY.
        const ids = t.kindRowsForMonth('fixed', Y, M).map(e => e.id);
        t.expenses = t.expenses.filter(e => !ids.includes(e.id));
        t.saveExpenses();
        t.renderHistoryPage();
        const mixed = read();
        return {
            Y, M, actual, mixed,
            fixed: { t: f.total, c: f.count, e: f.estimated },
            income: { t: i.total, c: i.count, e: i.estimated },
            variable,
            mixedFixed: t.fixedFor(Y, M).estimated, mixedIncome: t.incomeFor(Y, M).estimated,
        };
    });
    await page.waitForTimeout(300);

    assert('(g) History month detail surfaces Income, Fixed, Variable and Real savings',
        ['Income', 'Fixed', 'Variable', 'Real savings'].every(k => detail.actual.includes(k)),
        detail.actual.slice(0, 200));
    // NB: the comparison string has had ALL whitespace stripped, so the rendered
    // "(4 items)" arrives as "(4items)" — the pattern must not contain a space.
    assert('(g) A row-based month shows the ROW COUNT — "Fixed $2,397 (4 items)" style, not "(estimated)"',
        new RegExp(`Fixed\\$${Math.round(detail.fixed.t).toLocaleString()}\\(${detail.fixed.c}items?\\)`).test(detail.actual.replace(/\s/g, '')) &&
        !/\(estimated\)/.test(detail.actual),
        `fixed=${detail.fixed.t}/${detail.fixed.c} income=${detail.income.t}/${detail.income.c}`);
    const expectedSavings = Math.round(detail.income.t - detail.fixed.t - detail.variable);
    assert('(g) Real savings = income - fixed - variable, from ROWS not the settings guess',
        detail.actual.includes(`$${Math.abs(expectedSavings).toLocaleString()}`),
        `${Math.round(detail.income.t)} - ${Math.round(detail.fixed.t)} - ${Math.round(detail.variable)} = ${expectedSavings}`);
    assert('(g) MIXED month: Fixed flips to "(estimated)" while Income keeps its real item count',
        detail.mixedFixed === true && detail.mixedIncome === false &&
        (detail.mixed.match(/\(estimated\)/g) || []).length === 1 &&
        new RegExp(`Income\\$[\\d,]+\\(${detail.income.c}items?\\)`).test(detail.mixed.replace(/\s/g, '')),
        detail.mixed.slice(0, 220));
    await page.evaluate(() => document.getElementById('history-month-detail').scrollIntoView({ block: 'center' }));
    await page.screenshot({ path: path.join(opts.shots, 'g-month-detail.png'), fullPage: false });

    // Home must still be variable-only after all the phase-2 writes: the Home
    // redesign was cancelled, so the hero and its cap bar stay exactly as they are.
    await page.evaluate(() => window.showPage('dashboard'));
    await page.waitForTimeout(300);
    const homeAfter = await page.evaluate(() => {
        const t = window.expenseTracker, n = new Date();
        return {
            spent: (document.querySelector('#home-month-hero .month-spent')?.textContent || '').trim(),
            capBar: !!document.querySelector('#home-month-hero .cap-bar'),
            variable: Math.round(t.getRegularMonthExpenses(n.getFullYear(), n.getMonth())
                .reduce((s, e) => s + Number(e.amount || 0), 0)),
        };
    });
    assert('(g) Home hero still shows VARIABLE-only spend after the entry writes',
        homeAfter.spent.replace(/[^0-9]/g, '') === String(homeAfter.variable),
        `hero="${homeAfter.spent}" variable=${homeAfter.variable}`);
    assert('(g) Home keeps its cap bar (redesign cancelled — nothing restyled)',
        homeAfter.capBar === true);

    // A blank frame is a failure, so assert the pages actually painted.
    await page.evaluate(() => window.showPage('history'));
    // The card is collapsed by default; expand it before inspecting rows.
    await page.evaluate(() => { const b = document.querySelector('.le-toggle'); const c = document.querySelector('.ledger-entry'); if (b && c && !c.classList.contains('is-open')) b.click(); });
    await page.waitForTimeout(400);

    await page.waitForTimeout(250);
    const painted = await page.evaluate(() => ({
        history: (document.querySelector('#history-year-stats')?.textContent || '').length,
        rail: (document.querySelector('#history-month-rail')?.textContent || '').length,
    }));
    assert('render sanity: History painted non-empty content',
        painted.history > 20 && painted.rail > 20, JSON.stringify(painted));

    const realErrors = consoleErrors.filter(e => !/chrome-extension|favicon|firebase|Firestore|net::ERR/i.test(e));
    assert('no unexpected console errors', realErrors.length === 0,
        realErrors.length ? realErrors.slice(0, 5).join(' | ') : 'clean');

    await browser.close();

    const failed = results.filter(r => !r.pass);
    console.log(`\n${results.length - failed.length}/${results.length} assertions passed`);
    console.log(`screenshots: ${opts.shots}`);
    if (failed.length) {
        console.log('FAILED:');
        for (const f of failed) console.log(`  - ${f.name}`);
        process.exit(1);
    }
}

main().catch(e => { console.error(e); process.exit(1); });
