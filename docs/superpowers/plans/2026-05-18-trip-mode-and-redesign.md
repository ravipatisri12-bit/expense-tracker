# Trip Mode + UI Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a first-class Trip Mode (separate budget) and redesign Home / Trip Dashboard / Add Expense / History pages to a Fraunces + Inter Tight + JetBrains Mono editorial system, while retiring the anti-portfolio "Save" feature.

**Architecture:** Vanilla-JS PWA with no module bundler at runtime. New behavior is added as `ExpenseTracker.prototype.*` methods (existing convention) plus one new file per major subsystem (`js/trips.js`, `js/trip-dashboard.js`, `js/forecast.js`, `js/merchant-frequency.js`). All four redesigned pages share a new design-token block in `styles/main.css`. The two-budget model (regular vs `tripId != null`) is implemented by adding ONE `tripId` field to expense records and routing all monthly cap math through new `getRegularMonthExpenses(year, month)` / `getTripExpenses(tripId)` helpers — every existing summation that reads `this.expenses` directly gets switched to those helpers. Notifications branch in `scripts/send-notifications.js` on `is_trip_active(uid, today)` using a new `fetchActiveTrip(uid, todayStr)` helper.

**Tech Stack:** HTML/CSS, vanilla JS (ES2020, no modules), Firebase v8 compat (Firestore + Auth + FCM messaging), Vite for build, Tailwind 3 (currently CDN), Material Symbols Rounded. New: Google Fonts Fraunces + Inter Tight + JetBrains Mono.

---

## Parallelization map

After **Phase 0 (Foundation)** is merged, five tracks can run in parallel because each lives in its own slice of `index.html` (a `<div id="…-page">` block) and its own renderer methods or files. Each track has a single owner section in `index.html` and never edits another track's code.

```
Phase 0 — Foundation (sequential, single agent)
  ├─ 0.1 Fonts + design tokens                 (styles/main.css head, index.html head)
  ├─ 0.2 tripId data model + helpers           (script.js)
  ├─ 0.3 trips.js CRUD                         (new js/trips.js)
  ├─ 0.4 Page skeletons (empty containers)     (index.html — adds #trip-dashboard-page, #trips-page; rewrites #dashboard-page, #add-expense-page, #history-page bodies to empty redesigned shells)
  ├─ 0.5 Bottom nav (4 tabs incl. Trips)       (index.html)
  ├─ 0.6 Anti-portfolio retirement             (index.html, gamification.js, script.js)
  └─ 0.7 Smoke test + commit                   (./test.sh)

Phase 1 — Parallel tracks (5 independent agents)
  ┌─ Track A: Home renderers                    (script.js prototype methods + js/forecast.js)
  ├─ Track B: Trip Mode renderers               (new js/trip-dashboard.js + script.js prototype methods)
  ├─ Track C: Add Expense redesign              (script.js prototype methods + js/smart-input.js live preview)
  ├─ Track D: History renderers                 (script.js prototype methods + js/merchant-frequency.js)
  └─ Track E: Notifications + auto-add CTA      (scripts/send-notifications.js + js/notifications.js + script.js)

Phase 2 — Integration (sequential)
  ├─ 2.1 Auto-tag Gmail imports                 (js/email-parser.js)
  ├─ 2.2 Cross-track manual smoke (393px viewport)
  ├─ 2.3 Service worker cache bump              (sw.js)
  └─ 2.4 Final ./test.sh + commit
```

**Why this split works:** Each track's renderers write into containers Phase 0 created. They don't share DOM IDs. They don't edit each other's `index.html` blocks. Track E's notifications code is in a separate Node script. Track A's `forecast.js` and Track D's `merchant-frequency.js` are isolated files. The shared mutation point — `getRegularMonthExpenses()` / `getTripExpenses()` — lands in Phase 0 and tracks consume it read-only.

**Conflict-prone surfaces (single-owner):**
- `script.js` `updateDashboard()` — Track A only.
- `script.js` history renderer methods — Track D only.
- `index.html` body — divided per page; only Phase 0 and Phase 2.3 (sw cache version) touch the head.

---

## File structure

| File | Owner | Purpose |
|---|---|---|
| `index.html` | Phase 0 | Add fonts, restructured page bodies, 4-tab nav. After Phase 0, only Tracks edit text inside *their* page block. |
| `styles/main.css` | Phase 0 | New `:root` design tokens (`--m-grad`, `--trip-grad`, `--saved-grad`, `--bg`, etc.) and shared component classes copied from mocks. |
| `script.js` | Phase 0 + Tracks A, B, D | Phase 0 adds `getRegularMonthExpenses()`, `getTripExpenses()`, `tripId` field, retires anti-portfolio call sites. Track A rewrites home renderers. Track B adds trip dashboard prototype methods. Track D rewrites history renderers. |
| `js/trips.js` | Phase 0 | New: trip CRUD (`createTrip`, `updateTrip`, `deleteTrip`, `loadTrips`, `getActiveTrip`, `getTripState`, `pickTripIdForDate`). Loads from Firestore + localStorage. Exposes `window.tripsStore`. |
| `js/trip-dashboard.js` | Track B | New: renders #trip-dashboard-page and #trips-page; create-trip modal; start/end trip handlers. |
| `js/forecast.js` | Track A | New: small helper that returns the projection number + display string for the home hero "at this rate" line. |
| `js/merchant-frequency.js` | Track D | New: aggregates expenses → top regulars list (visit count desc, normalized merchant). |
| `js/smart-input.js` | Track C | Adds debounced live-parse preview using existing regex parser; existing submit path unchanged. |
| `js/email-parser.js` | Phase 2 | Adds `tripId` to imported expense objects via `tripsStore.pickTripIdForDate(parsed.date)`. |
| `js/gamification.js` | Phase 0 | Removes `addAntiPortfolioEntry`, `getDailySavings`, `getTotalSavings`, `getRecentAntiPortfolio`, `checkSavingsAchievements`, savings achievement IDs. |
| `js/notifications.js` | Track E | Mirrors the 3 monthly + 3 trip notification preview strings; updates settings card. |
| `scripts/send-notifications.js` | Track E | Branches on active-trip-for-uid; adds `buildTripMessage(slot, tripCtx)`. |
| `sw.js` | Phase 2 | Bump cache name to `expense-tracker-v7`. |


---

# Phase 0 — Foundation (sequential, single agent)

> All Phase 0 tasks must land before any Phase 1 track starts. Commit between tasks. After Phase 0 finishes, the app boots, shows empty/skeleton states for the redesigned pages, and `./test.sh` passes.

---

### Task 0.1: Add fonts + design tokens

**Files:**
- Modify: `index.html` (head, lines 7-8 area)
- Modify: `styles/main.css` (top of file — add a new `:root` block above any existing one)

- [ ] **Step 1: Add font links to `index.html` head**

Find this in `index.html` (around line 7-8):
```html
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;500;700&display=swap">
    <link rel="stylesheet" href="https://fonts.googleapis.com/icon?family=Material+Symbols+Rounded&display=swap">
```

Replace with:
```html
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,300;9..144,500;9..144,700&family=Inter+Tight:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap">
    <link rel="stylesheet" href="https://fonts.googleapis.com/icon?family=Material+Symbols+Rounded&display=swap">
```

- [ ] **Step 2: Add design tokens to `styles/main.css`**

Open `styles/main.css` and add at the very top (above any existing rules):

```css
/* ===== Redesign tokens (2026-05) ===== */
:root {
  --bg: #0a0c14;
  --surface: #131520;
  --surface-2: #1c1f2c;
  --surface-3: #262a39;
  --on-surface: #e6e8f0;
  --on-surface-mute: #8b8fa3;
  --on-surface-faint: #4a4f63;
  --line: rgba(255,255,255,0.06);
  --line-strong: rgba(255,255,255,0.12);

  /* Monthly palette — violet / indigo */
  --m-1: #8b9eff;
  --m-2: #c79bff;
  --m-grad: linear-gradient(120deg, #667eea 0%, #b66cff 100%);
  --m-glow: 0 0 24px rgba(139,158,255,0.20);

  /* Trip palette — cyan */
  --trip-1: #4facfe;
  --trip-2: #00f2fe;
  --trip-grad: linear-gradient(120deg, #4facfe 0%, #00f2fe 100%);
  --trip-glow: 0 0 24px rgba(0, 242, 254, 0.18);

  /* Saved (history only) */
  --saved: #43e97b;
  --saved-grad: linear-gradient(120deg, #43e97b 0%, #38f9d7 100%);

  /* Categories */
  --cat-food: #ff9c66;
  --cat-coffee: #ffd166;
  --cat-transit: #66d9ff;
  --cat-shop: #7ee7c1;
  --cat-fun: #c89eff;
  --cat-bills: #b0b6c8;
  --cat-trips: #00f2fe;
  --cat-other: #8b8fa3;

  /* Status */
  --good: #43e97b;
  --warn: #ffb84d;
  --bad: #ff7080;
  --no-spend: #43e97b;
  --essential: #8b9eff;
  --wants: #ffb84d;
}

html.fonts-loaded body { font-family: 'Inter Tight', -apple-system, sans-serif; }
body { background: radial-gradient(1100px 600px at 0% -10%, rgba(102,126,234,0.10), transparent 55%), radial-gradient(900px 500px at 110% 30%, rgba(182,108,255,0.06), transparent 60%), var(--bg); color: var(--on-surface); }

.f-serif { font-family: 'Fraunces', serif; }
.f-mono { font-family: 'JetBrains Mono', monospace; }
```

- [ ] **Step 3: Verify build still passes**

Run: `./test.sh`
Expected: All tests ✅

- [ ] **Step 4: Commit**

```bash
git add index.html styles/main.css
git commit -m "Add Fraunces/Inter Tight/JetBrains Mono fonts + redesign tokens"
```

---

### Task 0.2: Add `tripId` field + cap-math helpers

**Files:**
- Modify: `script.js` (in `addExpense`, `addExpenseProgrammatically`, `addExpensesBatch`, `updateDashboard`)
- Test: open `tests/test-tripid-helpers.html` (new) in a browser to spot-check

- [ ] **Step 1: Write a manual test page**

Create `tests/test-tripid-helpers.html`:

```html
<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>tripId helper tests</title></head>
<body>
<pre id="out"></pre>
<script>
const fixtures = [
  { id: 1, amount: 100, date: '2026-05-01', category: 'Food', tripId: null },
  { id: 2, amount: 200, date: '2026-05-02', category: 'Food', tripId: null },
  { id: 3, amount: 300, date: '2026-05-25', category: 'Food', tripId: 'nyc' },
  { id: 4, amount: 50, date: '2026-04-15', category: 'Food', tripId: null }
];
function getRegularMonthExpenses(expenses, year, month) {
  return expenses.filter(e => {
    if (e.tripId != null) return false;
    const [y, m] = e.date.split('-').map(Number);
    return y === year && (m - 1) === month;
  });
}
function getTripExpenses(expenses, tripId) {
  return expenses.filter(e => e.tripId === tripId);
}
const reg = getRegularMonthExpenses(fixtures, 2026, 4); // May = month 4
const trip = getTripExpenses(fixtures, 'nyc');
const out = document.getElementById('out');
out.textContent =
  'Regular May total: ' + reg.reduce((s,e)=>s+e.amount,0) + ' (expect 300)\n' +
  'Trip nyc total: ' + trip.reduce((s,e)=>s+e.amount,0) + ' (expect 300)\n' +
  'Regular excludes trip: ' + (reg.find(e=>e.tripId) ? 'FAIL' : 'OK') + '\n';
</script>
</body></html>
```

- [ ] **Step 2: Run the test**

Open `tests/test-tripid-helpers.html` in a browser and confirm:
- `Regular May total: 300 (expect 300)`
- `Trip nyc total: 300 (expect 300)`
- `Regular excludes trip: OK`

- [ ] **Step 3: Add helper methods to `ExpenseTracker` in `script.js`**

Find the `parseLocalDate` method (around line 2326) and add these two prototype methods immediately after it (still inside the class):

```javascript
    getRegularMonthExpenses(year, month) {
        return this.expenses.filter(e => {
            if (e.tripId != null) return false;
            if (e.excludeFromBudget) return false;
            const d = this.parseLocalDate(e.date);
            return d.getFullYear() === year && d.getMonth() === month;
        });
    }

    getTripExpenses(tripId) {
        return this.expenses.filter(e => e.tripId === tripId);
    }

    getMonthCombinedExpenses(year, month) {
        return this.expenses.filter(e => {
            const d = this.parseLocalDate(e.date);
            return d.getFullYear() === year && d.getMonth() === month;
        });
    }
```

- [ ] **Step 4: Add `tripId: null` to manual `addExpense`**

Find `addExpense` (around line 341). In the `expense` object literal, add `tripId: null` so it reads:

```javascript
        const expense = {
            id: Date.now(),
            amount: amount,
            description: description,
            category: category,
            date: expenseDate,
            timestamp: Date.now(),
            excludeFromBudget: false,
            tripId: null
        };
```

The Track C work later overrides this when trip mode is active. For now, default null.

- [ ] **Step 5: Add `tripId: null` default to `addExpenseProgrammatically` and `addExpensesBatch`**

Find both methods (lines 391, 402) and ensure each pushed expense has `tripId` defaulted. Replace both methods with:

```javascript
    addExpenseProgrammatically(expense) {
        if (expense.tripId === undefined) expense.tripId = null;
        this.expenses.push(expense);
        if (currentUser) {
            this.saveExpenseToFirebase(expense);
        } else {
            this.saveExpenses();
        }
        this.updateDashboard();
        this.renderTransactions();
    }

    addExpensesBatch(expenses) {
        for (const e of expenses) {
            if (e.tripId === undefined) e.tripId = null;
        }
        this.expenses.push(...expenses);
        if (currentUser && expenses.length > 0) {
            const batch = db.batch();
            expenses.forEach(e => {
                const ref = db.collection('users').doc(currentUser.uid)
                    .collection('expenses').doc(e.id.toString());
                batch.set(ref, e);
            });
            batch.commit().catch(err => console.error('Batch write failed:', err));
        } else if (expenses.length > 0) {
            this.saveExpenses();
        }
        this.updateDashboard();
        this.renderTransactions();
    }
```

- [ ] **Step 6: Lazy-migrate legacy expenses on load**

Find where the tracker first reads `this.expenses` from localStorage (search for `localStorage.getItem('expenses')` in `script.js`). Immediately after parsing, normalize:

```javascript
this.expenses = this.expenses.map(e => (e.tripId === undefined ? { ...e, tripId: null } : e));
```

If the constructor loads expenses in multiple branches (signed in / signed out), apply the same map after each parse.

- [ ] **Step 7: Verify**

Run: `./test.sh`
Expected: All tests ✅

- [ ] **Step 8: Commit**

```bash
git add script.js tests/test-tripid-helpers.html
git commit -m "Add tripId field + getRegularMonthExpenses / getTripExpenses helpers"
```

---

### Task 0.3: Create `js/trips.js` CRUD module

**Files:**
- Create: `js/trips.js`
- Modify: `index.html` (script tag list)

- [ ] **Step 1: Create `js/trips.js`**

Write this file:

```javascript
/**
 * Trip CRUD + state machine.
 * Trips live at users/{uid}/trips/{tripId} in Firestore and as
 * localStorage['trips'] for offline. Data shape per spec §5.1.
 */
(function () {
    const LS_KEY = 'trips';

    function loadLocal() {
        try { return JSON.parse(localStorage.getItem(LS_KEY) || '[]'); }
        catch { return []; }
    }
    function saveLocal(trips) {
        localStorage.setItem(LS_KEY, JSON.stringify(trips));
    }
    function todayLocalDateString() {
        const d = new Date();
        return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    }
    function genId() {
        return 't_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    }

    class TripsStore {
        constructor() {
            this.trips = loadLocal();
            this.listeners = [];
            this._unsub = null;
        }

        subscribe(fn) {
            this.listeners.push(fn);
            return () => { this.listeners = this.listeners.filter(l => l !== fn); };
        }
        _emit() { for (const l of this.listeners) l(this.trips); }

        all() { return this.trips.slice(); }

        getById(id) { return this.trips.find(t => t.id === id) || null; }

        getState(trip, today = todayLocalDateString()) {
            if (!trip) return 'NONE';
            if (trip.endedAt) return 'ENDED';
            if (today > trip.endDate) return 'ENDED';
            if (trip.startedAt) return 'ACTIVE';
            if (today >= trip.startDate && today <= trip.endDate) return 'ACTIVE';
            if (today < trip.startDate) return 'UPCOMING';
            return 'ENDED';
        }

        getActiveTrip(today = todayLocalDateString()) {
            return this.trips.find(t => this.getState(t, today) === 'ACTIVE') || null;
        }

        getUpcomingTrips(today = todayLocalDateString()) {
            return this.trips.filter(t => this.getState(t, today) === 'UPCOMING');
        }

        getPastTrips(today = todayLocalDateString()) {
            return this.trips.filter(t => this.getState(t, today) === 'ENDED');
        }

        // Spec §5.3 — pick the active trip whose window contains the date.
        pickTripIdForDate(expenseDate, today = todayLocalDateString()) {
            const t = this.trips.find(t =>
                this.getState(t, today) === 'ACTIVE' &&
                expenseDate >= t.startDate &&
                expenseDate <= t.endDate
            );
            return t ? t.id : null;
        }

        async create({ name, budget, startDate, endDate }) {
            const trip = {
                id: genId(),
                name, budget: Number(budget),
                startDate, endDate,
                startedAt: null, endedAt: null,
                createdAt: Date.now(), updatedAt: Date.now()
            };
            this.trips.push(trip);
            saveLocal(this.trips);
            await this._writeRemote(trip);
            this._emit();
            return trip;
        }

        async update(id, patch) {
            const i = this.trips.findIndex(t => t.id === id);
            if (i < 0) return null;
            this.trips[i] = { ...this.trips[i], ...patch, updatedAt: Date.now() };
            saveLocal(this.trips);
            await this._writeRemote(this.trips[i]);
            this._emit();
            return this.trips[i];
        }

        async delete(id) {
            this.trips = this.trips.filter(t => t.id !== id);
            saveLocal(this.trips);
            if (window.currentUser && window.firebaseDb) {
                try {
                    await window.firebaseDb.collection('users').doc(window.currentUser.uid)
                        .collection('trips').doc(id).delete();
                } catch (e) { console.error('trips.delete remote:', e); }
            }
            this._emit();
        }

        async start(id) {
            return this.update(id, { startedAt: Date.now() });
        }

        async end(id) {
            return this.update(id, { endedAt: Date.now() });
        }

        async _writeRemote(trip) {
            if (!window.currentUser || !window.firebaseDb) return;
            try {
                await window.firebaseDb.collection('users').doc(window.currentUser.uid)
                    .collection('trips').doc(trip.id).set(trip);
            } catch (e) { console.error('trips._writeRemote:', e); }
        }

        // Hook from auth.js after sign-in.
        attachRealtime() {
            if (!window.currentUser || !window.firebaseDb) return;
            if (this._unsub) this._unsub();
            this._unsub = window.firebaseDb.collection('users').doc(window.currentUser.uid)
                .collection('trips').onSnapshot(snap => {
                    this.trips = snap.docs.map(d => d.data());
                    saveLocal(this.trips);
                    this._emit();
                });
        }
    }

    window.tripsStore = new TripsStore();
})();
```

- [ ] **Step 2: Wire into `index.html` script load order**

Find the script load block (around line 18-27 in `index.html`). Insert `<script src="js/trips.js"></script>` immediately after `js/utils.js`:

```html
    <script src="js/defensive.js"></script>
    <script src="js/config.js"></script>
    <script src="js/utils.js"></script>
    <script src="js/trips.js"></script>
    <script src="js/auth.js"></script>
```

- [ ] **Step 3: Hook realtime on sign-in**

In `js/auth.js`, find the `onAuthStateChanged` handler that runs after sign-in. After the line that sets `currentUser = user;`, add:

```javascript
                if (window.tripsStore) window.tripsStore.attachRealtime();
```

- [ ] **Step 4: Verify**

Run: `./test.sh`
Expected: All tests ✅. Open dev console: `window.tripsStore.all()` returns `[]`.

- [ ] **Step 5: Commit**

```bash
git add js/trips.js index.html js/auth.js
git commit -m "Add js/trips.js CRUD store with state machine + Firestore sync"
```

---

### Task 0.4: Restructure `index.html` page bodies (empty redesigned shells)

**Files:**
- Modify: `index.html` — replace the inner contents of `#dashboard-page`, `#add-expense-page`, `#history-page`. Add new `#trip-dashboard-page` and `#trips-page` blocks.

- [ ] **Step 1: Replace `#dashboard-page` body with redesigned shell**

Locate `<div id="dashboard-page" class="page-content">` (around line 90) and replace its entire inner contents with:

```html
        <div class="home-page max-w-lg mx-auto px-4 pt-2 pb-24">
            <div class="greeting">
                <div class="hi"></div>
                <div class="day"></div>
            </div>
            <div id="home-trip-teaser" class="hidden"></div>
            <div id="home-month-hero"></div>
            <div id="home-insight" class="hidden"></div>
            <div id="home-habit"></div>
            <div id="home-categories"></div>
            <div id="home-trend"></div>
            <div id="home-trend-popover" class="hidden"></div>
        </div>
```

- [ ] **Step 2: Replace `#add-expense-page` body**

Locate `<div id="add-expense-page" class="page-content hidden">` and replace its inner contents with:

```html
        <div class="add-page max-w-lg mx-auto pt-2 pb-24">
            <div class="page-head px-4">
                <button class="head-back" onclick="showPage('dashboard')" aria-label="Back"><span class="material-symbols-rounded">close</span></button>
                <div class="head-title">Add expense</div>
                <div class="head-spacer"></div>
            </div>
            <div class="add-page-body px-4 pt-6 flex flex-col gap-4">
                <div id="add-trip-banner" class="hidden"></div>
                <div id="add-smart-card"></div>
                <div id="add-toggle"></div>
                <div id="add-manual-card" class="hidden"></div>
            </div>
        </div>
```

- [ ] **Step 3: Replace `#history-page` body**

Locate `<div id="history-page" class="page-content hidden">` and replace its inner contents with:

```html
        <div class="history-page max-w-lg mx-auto px-4 pt-2 pb-24 flex flex-col gap-4">
            <div class="app-header" style="padding:8px 4px 4px"><h1 class="page-title f-serif">History</h1><div id="history-page-meta" class="page-meta f-mono"></div></div>
            <div id="history-year-selector"></div>
            <div id="history-year-stats"></div>
            <div id="history-year-shape"></div>
            <div id="history-month-rail"></div>
            <div id="history-month-detail"></div>
            <div id="history-categories"></div>
            <div id="history-top-regulars"></div>
        </div>
```

- [ ] **Step 4: Add `#trip-dashboard-page` block**

Immediately after the `#history-page` closing `</div>`, add:

```html
    <!-- TRIP DASHBOARD -->
    <div id="trip-dashboard-page" class="page-content hidden">
        <div class="trip-page max-w-lg mx-auto px-4 pt-2 pb-24">
            <div id="trip-dashboard-content"></div>
        </div>
    </div>
```

- [ ] **Step 5: Add `#trips-page` block**

Immediately after, add:

```html
    <!-- TRIPS INDEX -->
    <div id="trips-page" class="page-content hidden">
        <div class="trips-page max-w-lg mx-auto px-4 pt-2 pb-24">
            <div id="trips-page-content"></div>
        </div>
        <!-- New-trip modal -->
        <div id="new-trip-modal" class="hidden fixed inset-0 z-50 flex items-end" style="background:rgba(0,0,0,0.6)">
            <div id="new-trip-modal-card" class="w-full max-w-lg mx-auto" style="background:var(--surface);border-radius:28px 28px 0 0;padding:20px"></div>
        </div>
    </div>
```

- [ ] **Step 6: Verify**

Run: `./test.sh`
Expected: All tests ✅. Open `npm run dev`; click each tab; pages exist but render empty.

- [ ] **Step 7: Commit**

```bash
git add index.html
git commit -m "Restructure index.html into redesigned page shells + trip pages"
```

---

### Task 0.5: 4-tab bottom nav (add Trips, drop Add)

**Files:**
- Modify: `index.html` (the `<nav>` block near line 58)
- Modify: `script.js` `showPage()` (around line 299)

- [ ] **Step 1: Replace bottom nav**

Find the `<nav class="fixed bottom-0 ...` block and replace with:

```html
    <nav class="fixed bottom-0 left-0 right-0 z-50 safe-area-inset-bottom" style="background:var(--surface);border-top:1px solid var(--line)">
        <div class="grid grid-cols-4">
            <button id="nav-home" onclick="showPage('dashboard')" class="nav-btn flex flex-col items-center py-2"><span class="material-symbols-rounded">home</span><span class="text-xs">Home</span></button>
            <button id="nav-trips" onclick="showPage('trips')" class="nav-btn flex flex-col items-center py-2"><span class="material-symbols-rounded">flight</span><span class="text-xs">Trips</span></button>
            <button id="nav-txns" onclick="showPage('transactions')" class="nav-btn flex flex-col items-center py-2"><span class="material-symbols-rounded">receipt_long</span><span class="text-xs">Txns</span></button>
            <button id="nav-history" onclick="showPage('history')" class="nav-btn flex flex-col items-center py-2"><span class="material-symbols-rounded">history</span><span class="text-xs">History</span></button>
        </div>
    </nav>
```

- [ ] **Step 2: Update `showPage` to handle the new page IDs**

Find `showPage(pageId, ...)` (around line 299). Update the page-id → element-id map. Replace the body of `showPage` with:

```javascript
    showPage(pageId, clickedElement = null) {
        // pageId can be 'dashboard' | 'trips' | 'trip-dashboard' | 'transactions' | 'history' | 'add-expense' | 'settings'
        document.querySelectorAll('.page-content').forEach(page => { page.classList.add('hidden'); });
        const map = {
            'dashboard': 'dashboard-page',
            'trips': 'trips-page',
            'trip-dashboard': 'trip-dashboard-page',
            'transactions': 'transactions-page',
            'history': 'history-page',
            'add-expense': 'add-expense-page',
            'settings': 'settings-page'
        };
        const elId = map[pageId];
        if (elId) {
            const el = document.getElementById(elId);
            if (el) el.classList.remove('hidden');
        }
        // Update nav active state
        document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
        const navBtnId = { dashboard: 'nav-home', trips: 'nav-trips', 'trip-dashboard': 'nav-trips', transactions: 'nav-txns', history: 'nav-history' }[pageId];
        if (navBtnId) {
            const btn = document.getElementById(navBtnId);
            if (btn) btn.classList.add('active');
        }
        // Renderer hooks
        if (pageId === 'trips' && typeof renderTripsIndex === 'function') renderTripsIndex();
        if (pageId === 'trip-dashboard' && typeof renderTripDashboard === 'function') renderTripDashboard();
        if (pageId === 'history' && typeof renderHistoryPage === 'function') renderHistoryPage();
        if (pageId === 'add-expense' && typeof renderAddExpensePage === 'function') renderAddExpensePage();
        window.scrollTo({ top: 0, behavior: 'instant' });
    }
```

- [ ] **Step 3: Add `.nav-btn.active` styling to `styles/main.css`**

Append to `styles/main.css`:

```css
.nav-btn { color: var(--on-surface-faint); font-family: 'Inter Tight'; }
.nav-btn.active { color: var(--m-1); }
.nav-btn.active .material-symbols-rounded { font-variation-settings: 'FILL' 1; }
.nav-btn .material-symbols-rounded { font-size: 22px; }
```

- [ ] **Step 4: Verify**

Run: `./test.sh`
Expected: All tests ✅. `npm run dev` and click each tab. Active state moves.

- [ ] **Step 5: Commit**

```bash
git add index.html script.js styles/main.css
git commit -m "Reduce bottom nav to 4 tabs (Home/Trips/Txns/History)"
```

---

### Task 0.6: Retire anti-portfolio

**Files:**
- Modify: `index.html` — remove `#anti-portfolio-modal`, the Save button on home (already gone via Task 0.4 if you replaced the body, double-check there is no `openAntiPortfolio` `onclick=`).
- Modify: `js/gamification.js` — remove `addAntiPortfolioEntry`, `getDailySavings`, `getTotalSavings`, `getRecentAntiPortfolio`, `checkSavingsAchievements`, the `antiPortfolio: []` in `defaults()`, and savings achievement IDs (`saved-100`, `saved-500`, `saved-1k`).
- Modify: `script.js` — remove any reference to `getTotalSavings()` / `gamification.antiPortfolio`. Search for `totalAvoided` / `antiPortfolio` and remove.
- Modify: `index.html` — drop the global functions `openAntiPortfolio`, `closeAntiPortfolio`, `submitAntiPortfolio` declarations from `js/gamification.js`.

- [ ] **Step 1: Search for all anti-portfolio call sites**

Run: `grep -n "antiPortfolio\|AntiPortfolio\|saved-100\|saved-500\|saved-1k\|totalAvoided\|getTotalSavings\|getDailySavings\|getRecentAntiPortfolio\|checkSavingsAchievements" index.html script.js js/*.js`

Expected: list of 15-30 hits in `js/gamification.js` and `script.js`.

- [ ] **Step 2: Remove anti-portfolio modal from `index.html`**

Find `<div id="anti-portfolio-modal" ...>` (around line 77) and delete it through its closing `</div>`. If your Task 0.4 dashboard rewrite already removed the home Save button, confirm `grep -n "openAntiPortfolio" index.html` returns nothing.

- [ ] **Step 3: Edit `js/gamification.js` — remove fields**

In `defaults()` (around line 14), remove the `antiPortfolio: [],` line.

- [ ] **Step 4: Delete the five methods from `js/gamification.js`**

Delete each method block by name:
- `addAntiPortfolioEntry(...)` (line 108-area)
- `getDailySavings(...)` (line 123-area)
- `getTotalSavings()` (line 130-area)
- `getRecentAntiPortfolio(...)` (line 134-area)
- `checkSavingsAchievements()` (line 195-area)

- [ ] **Step 5: Remove savings achievement IDs**

Search `js/gamification.js` for `'saved-100'`, `'saved-500'`, `'saved-1k'`. Delete the achievement entries that contain them.

In `getStats()` (line 230-area), remove `totalSaved`, `todaySaved`, `antiPortfolioCount` keys.

- [ ] **Step 6: Remove the global functions**

At the bottom of `js/gamification.js`, find and delete:
- `function openAntiPortfolio()` block
- `function closeAntiPortfolio()` block
- `function submitAntiPortfolio()` block
- The `window.gamification.checkSavingsAchievements();` line inside `submitAntiPortfolio` is removed with that function.

- [ ] **Step 7: Remove anti-portfolio reads in `script.js`**

Find lines that reference `getTotalSavings()` / `antiPortfolio` (around line 657, etc.). Delete the variable assignment + any UI that depended on it. Example: if `script.js` line 657 has `const totalAvoided = window.gamification?.getTotalSavings() || 0;` plus subsequent uses, delete the whole block; if it gates UI, replace with the next renderer's static text or just remove the section.

If you can't find a sensible replacement copy, replace any `${totalAvoided}` reference in template strings with `''` so the code remains syntactically valid.

- [ ] **Step 8: Verify**

Run: `./test.sh`
Expected: All tests ✅. The onclick-handler check should NOT flag `openAntiPortfolio` (because the modal is gone).

Run: `grep -n "antiPortfolio\|AntiPortfolio\|getTotalSavings\|getDailySavings\|getRecentAntiPortfolio\|checkSavingsAchievements" index.html script.js js/*.js`
Expected: NO results.

- [ ] **Step 9: Commit**

```bash
git add index.html script.js js/gamification.js
git commit -m "Retire anti-portfolio Save feature (UI + methods + achievement IDs)"
```

---

### Task 0.7: Phase 0 final verification

- [ ] **Step 1: Build + smoke test**

Run: `./test.sh`
Expected: All tests ✅.

- [ ] **Step 2: Manual verification**

Run: `npm run dev`
Click through each bottom tab. Expected:
- Home: blank shells (greeting / month hero / habit / categories / trend) — empty containers, no JS errors in console.
- Trips: blank `#trips-page-content`.
- Txns: existing transactions list, untouched.
- History: blank shells.

`window.tripsStore.all()` returns `[]` in console.
`window.expenseTracker.getRegularMonthExpenses(2026, 4)` returns an array.

- [ ] **Step 3: Tag the foundation commit**

```bash
git tag phase-0-complete
```

---

# Phase 1 — Parallel tracks

> Tracks A–E run in parallel after Phase 0 is tagged. Each track owns its own files and `index.html` page block. Commit at the end of each task. Don't `git push` without user confirmation.

---

## Track A — Home page redesign

**Owner files:** `script.js` (home renderers + `updateDashboard`), `js/forecast.js` (new), `styles/main.css` (append home component styles), `index.html` `#dashboard-page` block only.

**Spec sections covered:** §4 (Home), §4.1 (Aim today math), §4.2 (Forecast), §4.3 (Trend pace line). §4.4 Category drill-down is deferred to a follow-up spec.

---

### Task A.1: Append home component styles

**Files:**
- Modify: `styles/main.css` (append at end)

- [ ] **Step 1: Append home styles**

Append these classes (1:1 from `mocks/home-redesign.html`) to the end of `styles/main.css`:

```css
/* ===== Home page ===== */
.home-page .greeting { display: flex; align-items: baseline; justify-content: space-between; padding: 0 4px 14px; }
.home-page .greeting .hi { font-family: 'Fraunces', serif; font-size: 22px; font-weight: 400; letter-spacing: -0.01em; }
.home-page .greeting .hi em { font-style: italic; font-weight: 500; background: var(--m-grad); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; }
.home-page .greeting .day { font-family: 'JetBrains Mono', monospace; font-size: 10.5px; text-transform: uppercase; letter-spacing: 0.16em; color: var(--on-surface-mute); }

.month-hero { position: relative; padding: 22px 22px 20px; border-radius: 28px; background: linear-gradient(160deg, rgba(102,126,234,0.16) 0%, rgba(182,108,255,0.04) 38%, transparent 70%), linear-gradient(180deg, var(--surface) 0%, var(--surface-2) 100%); border: 1px solid rgba(102,126,234,0.18); overflow: hidden; isolation: isolate; }
.month-hero::before { content: ""; position: absolute; inset: 0; background: radial-gradient(400px 200px at 80% -10%, rgba(182,108,255,0.18), transparent 70%), radial-gradient(300px 180px at -10% 110%, rgba(102,126,234,0.14), transparent 70%); pointer-events: none; }
.month-hero > * { position: relative; }
.month-eyebrow { display: flex; align-items: center; gap: 8px; font-family: 'JetBrains Mono', monospace; font-size: 10px; letter-spacing: 0.22em; text-transform: uppercase; color: var(--m-1); margin-bottom: 8px; }
.month-eyebrow .material-symbols-rounded { font-size: 13px; }
.month-name { font-family: 'Fraunces', serif; font-weight: 500; font-size: 38px; line-height: 1; letter-spacing: -0.02em; background: linear-gradient(180deg, #ffffff 0%, #d2c4ff 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
.month-name .year { font-size: 18px; color: var(--on-surface-mute); -webkit-text-fill-color: var(--on-surface-mute); background: none; font-weight: 400; letter-spacing: 0.04em; margin-left: 8px; }
.month-sub { display: flex; gap: 10px; align-items: center; margin-top: 10px; }
.month-day-pill { font-family: 'JetBrains Mono', monospace; font-size: 11px; font-weight: 500; background: rgba(255,255,255,0.06); border: 1px solid var(--line-strong); padding: 4px 8px; border-radius: 6px; }
.month-meta { font-size: 12.5px; color: var(--on-surface-mute); }
.month-numbers { margin-top: 20px; display: grid; grid-template-columns: 1fr auto; align-items: baseline; gap: 12px; }
.month-spent { font-family: 'Fraunces', serif; font-weight: 500; font-size: 60px; line-height: 1; letter-spacing: -0.03em; color: var(--on-surface); }
.month-spent .currency { font-size: 30px; color: var(--on-surface-mute); margin-right: 2px; vertical-align: 0.34em; font-family: 'Inter Tight', sans-serif; font-weight: 400; }
.month-of { font-size: 12.5px; color: var(--on-surface-mute); text-align: right; line-height: 1.5; }
.month-of strong { color: var(--on-surface); font-weight: 600; }
.cap-bar { margin-top: 18px; position: relative; height: 12px; border-radius: 999px; background: rgba(255,255,255,0.04); border: 1px solid var(--line); overflow: visible; }
.cap-bar .fill { position: absolute; left: 0; top: 0; bottom: 0; border-radius: 999px; background: var(--m-grad); box-shadow: 0 0 18px rgba(139,158,255,0.5); }
.cap-bar .marker-soft, .cap-bar .marker-hard { position: absolute; top: -4px; bottom: -4px; width: 2px; border-radius: 1px; }
.cap-bar .marker-soft { background: var(--good); }
.cap-bar .marker-hard { background: var(--bad); right: 0; }
.cap-bar .marker-soft::after, .cap-bar .marker-hard::after { position: absolute; top: -16px; font-family: 'JetBrains Mono', monospace; font-size: 9px; letter-spacing: 0.06em; white-space: nowrap; }
.cap-bar .marker-soft::after { content: "$1k soft"; left: 50%; transform: translateX(-50%); color: var(--good); }
.cap-bar .marker-hard::after { content: "$2k hard"; right: 0; color: var(--bad); }
.month-pace { margin-top: 28px; display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; }
.pace-cell { padding: 10px 12px; background: rgba(255,255,255,0.025); border: 1px solid var(--line); border-radius: 12px; }
.pace-cell .label { font-size: 9.5px; letter-spacing: 0.14em; text-transform: uppercase; color: var(--on-surface-mute); }
.pace-cell .value { font-family: 'JetBrains Mono', monospace; font-size: 16px; font-weight: 500; margin-top: 4px; }
.pace-cell.aim { border-color: rgba(139,158,255,0.25); background: rgba(139,158,255,0.05); }
.pace-cell.aim .value { color: var(--m-1); }
.month-forecast, .month-composition { margin-top: 10px; font-family: 'JetBrains Mono', monospace; font-size: 11px; color: var(--on-surface-mute); padding: 0 4px; }
.cta-row { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 16px; }
.cta-primary, .cta-secondary { display: flex; align-items: center; justify-content: center; gap: 6px; padding: 13px 10px; border-radius: 16px; font-weight: 600; font-size: 13.5px; border: 0; cursor: pointer; white-space: nowrap; }
.cta-primary { background: var(--m-grad); color: #1a103a; box-shadow: 0 8px 30px rgba(102,126,234,0.25); }
.cta-secondary { background: rgba(255,255,255,0.04); color: var(--m-1); border: 1px solid var(--line-strong); }
.cta-primary .material-symbols-rounded, .cta-secondary .material-symbols-rounded { font-size: 20px; font-variation-settings: 'FILL' 1, 'wght' 600; }
.sync-status { display: flex; align-items: center; gap: 6px; margin-top: 10px; padding: 0 4px; font-family: 'JetBrains Mono', monospace; font-size: 10.5px; letter-spacing: 0.04em; color: var(--on-surface-mute); }
.sync-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--good); box-shadow: 0 0 6px rgba(67,233,123,0.5); }
.sync-dot.warn { background: var(--warn); }
.insight { margin-top: 16px; display: grid; grid-template-columns: 26px 1fr; gap: 12px; align-items: start; padding: 14px 16px; background: linear-gradient(180deg, rgba(102,126,234,0.07), rgba(182,108,255,0.02)); border: 1px solid rgba(102,126,234,0.18); border-radius: 18px; }
.insight .material-symbols-rounded { color: var(--m-1); font-size: 22px; font-variation-settings: 'FILL' 1; }
.insight .text { font-size: 13px; line-height: 1.45; }
.insight .text strong { color: var(--m-1); font-weight: 600; }
.section-head { display: flex; align-items: baseline; justify-content: space-between; margin: 26px 4px 10px; }
.section-title { font-family: 'Fraunces', serif; font-weight: 500; font-size: 18px; letter-spacing: -0.01em; }
.section-meta { font-size: 11px; font-family: 'JetBrains Mono', monospace; color: var(--on-surface-mute); letter-spacing: 0.06em; text-transform: uppercase; }
.trip-teaser { display: grid; grid-template-columns: 36px 1fr auto; gap: 14px; align-items: center; padding: 14px 16px; border-radius: 20px; background: linear-gradient(120deg, rgba(0,242,254,0.08), rgba(79,172,254,0.03) 60%, transparent), var(--surface); border: 1px solid rgba(0,242,254,0.18); cursor: pointer; }
.trip-teaser .icon { width: 36px; height: 36px; border-radius: 10px; background: var(--trip-grad); display: flex; align-items: center; justify-content: center; }
.trip-teaser .icon .material-symbols-rounded { color: #001b1f; font-size: 20px; font-variation-settings: 'FILL' 1, 'wght' 600; }
.trip-teaser .body .name { font-family: 'Fraunces', serif; font-size: 16px; font-weight: 500; }
.trip-teaser .body .when { font-family: 'JetBrains Mono', monospace; font-size: 11px; color: var(--trip-2); letter-spacing: 0.04em; }
.habit-card { background: var(--surface); border: 1px solid var(--line); border-radius: 22px; padding: 16px 18px 18px; position: relative; overflow: hidden; }
.habit-card::after { content: ""; position: absolute; top: -40px; right: -40px; width: 160px; height: 160px; border-radius: 50%; background: radial-gradient(circle, rgba(255,156,102,0.10), transparent 70%); pointer-events: none; }
.habit-row { display: flex; align-items: center; justify-content: space-between; }
.habit-streak { display: flex; align-items: center; gap: 8px; }
.habit-streak .flame { width: 32px; height: 32px; border-radius: 9px; background: linear-gradient(135deg, rgba(255,156,102,0.16), rgba(255,209,102,0.06)); border: 1px solid rgba(255,156,102,0.22); display: flex; align-items: center; justify-content: center; }
.habit-streak .flame .material-symbols-rounded { color: var(--cat-food); font-size: 18px; font-variation-settings: 'FILL' 1; }
.habit-streak .num { font-family: 'Fraunces', serif; font-size: 22px; font-weight: 500; }
.habit-streak .num span { font-family: 'Inter Tight'; font-size: 11px; color: var(--on-surface-mute); margin-left: 4px; font-weight: 400; }
.habit-best { font-family: 'JetBrains Mono', monospace; font-size: 10px; letter-spacing: 0.1em; text-transform: uppercase; color: var(--on-surface-faint); }
.habit-week { display: grid; grid-template-columns: repeat(7, 1fr); gap: 6px; margin: 14px 0 0; }
.habit-tile { aspect-ratio: 1.2 / 1; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-family: 'JetBrains Mono', monospace; font-size: 11px; font-weight: 600; color: var(--on-surface-faint); background: rgba(255,255,255,0.03); border: 1px solid var(--line); position: relative; }
.habit-tile.no-spend { background: rgba(67,233,123,0.12); color: var(--no-spend); border-color: rgba(67,233,123,0.26); }
.habit-tile.essential { background: rgba(139,158,255,0.12); color: var(--essential); border-color: rgba(139,158,255,0.26); }
.habit-tile.wants { background: rgba(255,184,77,0.12); color: var(--wants); border-color: rgba(255,184,77,0.26); }
.habit-tile.today { box-shadow: 0 0 0 2px rgba(255,255,255,0.1) inset; }
.habit-day-label { font-family: 'Inter Tight'; font-size: 8px; letter-spacing: 0.06em; text-transform: uppercase; color: var(--on-surface-faint); position: absolute; bottom: 3px; font-weight: 500; }
.checkin { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 6px; margin-top: 14px; padding-top: 14px; border-top: 1px solid var(--line); }
.checkin button { padding: 10px 6px; border-radius: 12px; border: 1px solid; background: transparent; font-family: 'Inter Tight'; font-size: 12px; font-weight: 600; cursor: pointer; }
.checkin .ck-no { border-color: rgba(67,233,123,0.25); color: var(--no-spend); background: rgba(67,233,123,0.06); }
.checkin .ck-es { border-color: rgba(139,158,255,0.25); color: var(--essential); background: rgba(139,158,255,0.06); }
.checkin .ck-wt { border-color: rgba(255,184,77,0.25); color: var(--wants); background: rgba(255,184,77,0.06); }
.checkin button.suggested { box-shadow: 0 0 0 2px currentColor inset; }
.cat-card { background: var(--surface); border: 1px solid var(--line); border-radius: 22px; padding: 18px 20px; }
.cat-card .cat-row { display: grid; grid-template-columns: 110px 1fr; gap: 18px; align-items: center; }
.cat-card .donut { width: 110px; height: 110px; position: relative; }
.cat-card .donut svg { width: 100%; height: 100%; transform: rotate(-90deg); }
.cat-card .donut .center { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; }
.cat-card .donut .total { font-family: 'Fraunces', serif; font-size: 20px; font-weight: 500; }
.cat-card .donut .label { font-family: 'JetBrains Mono', monospace; font-size: 9px; letter-spacing: 0.14em; text-transform: uppercase; color: var(--on-surface-mute); }
.cat-card .cat-legend { display: flex; flex-direction: column; gap: 10px; }
.cat-card .cat-item { display: grid; grid-template-columns: 10px 1fr auto; gap: 10px; align-items: center; cursor: pointer; }
.cat-card .cat-item .swatch { width: 10px; height: 10px; border-radius: 3px; }
.cat-card .cat-item .name { font-size: 12.5px; }
.cat-card .cat-item .amt { font-family: 'JetBrains Mono', monospace; font-size: 12px; color: var(--on-surface-mute); }
.trend-card { background: var(--surface); border: 1px solid var(--line); border-radius: 22px; padding: 18px 20px 18px; }
.trend-toggle { display: inline-flex; background: rgba(255,255,255,0.04); border: 1px solid var(--line); border-radius: 10px; padding: 3px; margin-bottom: 14px; }
.trend-toggle button { background: transparent; border: 0; padding: 6px 14px; font-size: 11px; font-weight: 600; color: var(--on-surface-mute); letter-spacing: 0.06em; text-transform: uppercase; border-radius: 7px; cursor: pointer; font-family: 'Inter Tight'; }
.trend-toggle button.active { background: rgba(139,158,255,0.15); color: var(--m-1); }
.trend-compare { display: flex; align-items: baseline; gap: 8px; margin-bottom: 14px; font-size: 11.5px; color: var(--on-surface-mute); }
.trend-compare .delta { color: var(--good); font-weight: 600; font-family: 'JetBrains Mono', monospace; }
.trend-compare .delta.over { color: var(--bad); }
.trend-chart-wrap { position: relative; height: 110px; padding: 16px 0 12px; }
.trend-pace-line { position: absolute; left: 0; right: 0; height: 1px; border-top: 1px dashed rgba(139,158,255,0.4); z-index: 1; }
.trend-pace-label { position: absolute; right: 0; font-family: 'JetBrains Mono', monospace; font-size: 9px; color: var(--m-1); background: var(--surface); padding: 0 4px; letter-spacing: 0.04em; transform: translateY(-50%); }
.trend-bars { position: relative; height: 100%; display: grid; grid-template-columns: repeat(var(--cols, 31), 1fr); gap: 2px; align-items: end; z-index: 2; }
.trend-bars > .b { border-radius: 3px 3px 1px 1px; background: linear-gradient(180deg, rgba(139,158,255,0.85), rgba(102,85,200,0.45)); position: relative; cursor: pointer; }
.trend-bars > .b.future { background: rgba(255,255,255,0.04); border: 1px dashed var(--line-strong); border-bottom: 0; }
.trend-bars > .b.today { background: var(--m-grad); box-shadow: 0 0 12px rgba(139,158,255,0.5); }
.trend-bars > .b.tapped { background: linear-gradient(180deg, #ffffff, #c9d3ff); box-shadow: 0 0 14px rgba(255,255,255,0.4); }
.bar-popover { position: absolute; bottom: calc(100% + 8px); left: 50%; transform: translateX(-50%); background: rgba(255,255,255,0.95); color: #16182a; padding: 6px 10px; border-radius: 8px; white-space: nowrap; font-family: 'JetBrains Mono', monospace; font-size: 11px; font-weight: 600; box-shadow: 0 6px 20px rgba(0,0,0,0.4); z-index: 5; pointer-events: none; }
.bar-popover .day { color: #6e7383; font-weight: 500; margin-right: 6px; }
.bar-popover::after { content: ""; position: absolute; top: 100%; left: 50%; transform: translateX(-50%); width: 0; height: 0; border: 5px solid transparent; border-top-color: rgba(255,255,255,0.95); }
.trend-foot { display: flex; justify-content: space-between; font-family: 'JetBrains Mono', monospace; font-size: 9px; color: var(--on-surface-faint); letter-spacing: 0.08em; margin-top: 4px; }
.trend-stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1px; margin-top: 16px; padding-top: 14px; border-top: 1px solid var(--line); }
.trend-stat .lbl { font-family: 'JetBrains Mono', monospace; font-size: 9px; letter-spacing: 0.12em; text-transform: uppercase; color: var(--on-surface-mute); }
.trend-stat .val { font-family: 'Fraunces', serif; font-size: 16px; font-weight: 500; margin-top: 4px; }
.trend-stat .meta { font-size: 10px; color: var(--on-surface-faint); margin-top: 1px; font-family: 'JetBrains Mono', monospace; }
```

- [ ] **Step 2: Verify**

Run: `./test.sh` — All tests ✅.

- [ ] **Step 3: Commit**

```bash
git add styles/main.css
git commit -m "Home: append component CSS classes (mock 1:1)"
```

---

### Task A.2: Create `js/forecast.js`

**Files:**
- Create: `js/forecast.js`
- Modify: `index.html` (add script tag after `js/trips.js`)

- [ ] **Step 1: Write `js/forecast.js`**

```javascript
/** Forecast helper. Spec §4.2. */
(function () {
    function projection(monthTotalRegular, day, daysInMonth) {
        const safeDay = Math.max(1, day);
        return Math.round((monthTotalRegular / safeDay) * daysInMonth);
    }
    function display(monthName, monthTotalRegular, day, daysInMonth) {
        const p = projection(monthTotalRegular, day, daysInMonth);
        return `· At this rate ${monthName} ends ~$${p.toLocaleString()}`;
    }
    window.Forecast = { projection, display };
})();
```

- [ ] **Step 2: Wire in `index.html`**

After `<script src="js/trips.js"></script>` add `<script src="js/forecast.js"></script>`.

- [ ] **Step 3: Verify**

In browser console: `window.Forecast.projection(640, 18, 31)` → ~`1102`. `window.Forecast.display('May', 640, 18, 31)` → string starting with `· At this rate May ends ~`.

- [ ] **Step 4: Commit**

```bash
git add js/forecast.js index.html
git commit -m "Home: add forecast helper for hero projection line"
```

---

### Task A.3: Replace `updateDashboard` with home renderer pipeline

**Files:**
- Modify: `script.js` `updateDashboard()` (around line 885) and add `_computeAimToday`.

- [ ] **Step 1: Replace `updateDashboard` body**

```javascript
    updateDashboard() {
        const now = new Date();
        const Y = now.getFullYear();
        const M = now.getMonth();
        const monthName = now.toLocaleDateString('en-US', { month: 'long' });
        const dayOfMonth = now.getDate();
        const daysInMonth = new Date(Y, M + 1, 0).getDate();
        const daysLeft = daysInMonth - dayOfMonth;

        const regularThisMonth = this.getRegularMonthExpenses(Y, M);
        const monthTotalRegular = regularThisMonth.reduce((s, e) => s + Number(e.amount || 0), 0);
        const monthCombined = this.getMonthCombinedExpenses(Y, M).reduce((s, e) => s + Number(e.amount || 0), 0);
        const tripExpensesThisMonth = monthCombined - monthTotalRegular;

        const SOFT = 1000, HARD = 2000, FOOD = 400;
        const monthFood = regularThisMonth.filter(e => e.category === 'Food').reduce((s, e) => s + Number(e.amount || 0), 0);
        const aim = this._computeAimToday({ monthTotal: monthTotalRegular, monthFood, daysLeft, SOFT, HARD, FOOD });

        const todayStr = this.getLocalDateString(now);
        const todayTotal = regularThisMonth.filter(e => e.date === todayStr).reduce((s, e) => s + Number(e.amount || 0), 0);
        const avgPerDay = dayOfMonth > 0 ? Math.round(monthTotalRegular / dayOfMonth) : 0;

        try { this.renderHomeGreeting(now); } catch (e) { console.warn(e); }
        try { this.renderHomeMonthHero({ monthName, year: Y, dayOfMonth, daysInMonth, daysLeft, monthTotalRegular, todayTotal, avgPerDay, aim, tripExpensesThisMonth, SOFT, HARD }); } catch (e) { console.warn(e); }
        try { this.renderHomeInsight({ monthName, aim, monthTotalRegular, SOFT }); } catch (e) { console.warn(e); }
        try { this.renderHomeTripTeaser(); } catch (e) { console.warn(e); }
        try { this.renderHomeHabit(); } catch (e) { console.warn(e); }
        try { this.renderHomeCategories(regularThisMonth); } catch (e) { console.warn(e); }
        try { this.renderHomeTrend({ regularThisMonth, daysInMonth, dayOfMonth, monthName, aim }); } catch (e) { console.warn(e); }
    }

    _computeAimToday({ monthTotal, monthFood, daysLeft, SOFT, HARD, FOOD }) {
        const dl = Math.max(1, daysLeft);
        if (monthTotal > HARD) return { state: 'HARD_OVER', dailyTotal: 0, dailyFood: 0 };
        if (monthTotal > SOFT) return { state: 'SOFT_OVER', dailyTotal: Math.round((HARD - monthTotal) / dl), dailyFood: 0 };
        if (monthFood > FOOD) return { state: 'FOOD_OVER', dailyTotal: Math.round((SOFT - monthTotal) / dl), dailyFood: 0 };
        return { state: 'HEALTHY', dailyTotal: Math.round((SOFT - monthTotal) / dl), dailyFood: Math.round((FOOD - monthFood) / dl) };
    }
```

- [ ] **Step 2: Verify**

`./test.sh` — All ✅. App boots; renderers don't exist yet so home shows shells with `console.warn` lines. Subsequent A.4–A.10 tasks fill them in.

- [ ] **Step 3: Commit**

```bash
git add script.js
git commit -m "Home: rewire updateDashboard to renderer pipeline"
```

---

### Task A.4: Render greeting band

**Files:** Modify `script.js` (append prototype methods).

- [ ] **Step 1: Add prototype methods**

Append to `script.js` (after class):

```javascript
ExpenseTracker.prototype.renderHomeGreeting = function (now) {
    const root = document.querySelector('#dashboard-page .greeting');
    if (!root) return;
    const hour = now.getHours();
    const greet = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
    const name = (window.currentUser && window.currentUser.displayName) ? window.currentUser.displayName.split(' ')[0] : 'there';
    const dayLabel = now.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    root.querySelector('.hi').innerHTML = `${greet}, <em>${this._escapeHtml(name)}</em>`;
    root.querySelector('.day').textContent = dayLabel.replace(',', ' ·').toUpperCase();
};
ExpenseTracker.prototype._escapeHtml = function (s) {
    return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
};
```

- [ ] **Step 2: Verify**

`npm run dev` → greeting "Good morning, <Name>" + day pill "MON · MAY 18".

- [ ] **Step 3: Commit**

```bash
git add script.js
git commit -m "Home: render greeting band"
```

---

### Task A.5: Render monthly hero card

**Files:** Modify `script.js`.

- [ ] **Step 1: Add `renderHomeMonthHero` prototype**

```javascript
ExpenseTracker.prototype.renderHomeMonthHero = function (ctx) {
    const root = document.getElementById('home-month-hero');
    if (!root) return;
    const { monthName, year, dayOfMonth, daysInMonth, daysLeft, monthTotalRegular, todayTotal, avgPerDay, aim, tripExpensesThisMonth, SOFT, HARD } = ctx;
    const fillPct = Math.min(100, (monthTotalRegular / HARD) * 100);
    const softLeftPct = (SOFT / HARD) * 100;
    const overSoft = aim.state === 'HARD_OVER' || aim.state === 'SOFT_OVER';
    const ofText = overSoft
        ? `over <strong>$${SOFT.toLocaleString()}</strong> soft target<br><span style="opacity:.6">aim $${aim.dailyTotal}/day to stay under $${HARD}</span>`
        : `of <strong>$${SOFT.toLocaleString()}</strong> soft target<br><span style="opacity:.6">$${(SOFT - monthTotalRegular).toLocaleString()} left</span>`;
    const compositionLine = tripExpensesThisMonth > 0
        ? `<div class="month-composition">+ $${tripExpensesThisMonth.toLocaleString()} on trips · TOTAL $${(monthTotalRegular + tripExpensesThisMonth).toLocaleString()}</div>` : '';
    const forecastLine = window.Forecast
        ? `<div class="month-forecast">${window.Forecast.display(monthName, monthTotalRegular, dayOfMonth, daysInMonth)}</div>` : '';
    const lastSync = this._gmailLastSyncedLabel();

    root.innerHTML = `
<div class="month-hero">
    <div class="month-eyebrow"><span class="material-symbols-rounded">calendar_month</span> Monthly view</div>
    <div class="month-name">${monthName}<span class="year">${year}</span></div>
    <div class="month-sub">
        <div class="month-day-pill">DAY ${dayOfMonth} / ${daysInMonth}</div>
        <div class="month-meta">${daysLeft} days left this month</div>
    </div>
    <div class="month-numbers">
        <div class="month-spent"><span class="currency">$</span>${Math.round(monthTotalRegular).toLocaleString()}</div>
        <div class="month-of">${ofText}</div>
    </div>
    <div class="cap-bar">
        <div class="fill" style="width:${fillPct}%"></div>
        <div class="marker-soft" style="left:${softLeftPct}%"></div>
        <div class="marker-hard"></div>
    </div>
    <div class="month-pace">
        <div class="pace-cell"><div class="label">Today's spend</div><div class="value">$${Math.round(todayTotal)}</div></div>
        <div class="pace-cell"><div class="label">Avg / day</div><div class="value">$${avgPerDay}</div></div>
        <div class="pace-cell aim"><div class="label">Aim today</div><div class="value">$${aim.dailyTotal}</div></div>
    </div>
    ${forecastLine}
    ${compositionLine}
    <div class="cta-row">
        <button class="cta-primary" onclick="showPage('add-expense')"><span class="material-symbols-rounded">add</span> Add</button>
        <button class="cta-secondary" onclick="onAutoAddTap()"><span class="material-symbols-rounded">bolt</span> Auto add</button>
    </div>
    <div class="sync-status"><span class="sync-dot"></span> ${lastSync}</div>
</div>`;
};

ExpenseTracker.prototype._gmailLastSyncedLabel = function () {
    const ts = localStorage.getItem('gmail_last_synced');
    if (!ts) return 'Never synced';
    const d = new Date(ts);
    return `Synced ${d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`;
};

window.onAutoAddTap = window.onAutoAddTap || function () {
    if (window.emailParser && typeof window.emailParser.sync === 'function') window.emailParser.sync();
};
```

- [ ] **Step 2: Verify**

`npm run dev`. Hero renders. Tap `+ Add` → navigates. Tap `Auto add` → triggers Gmail sync.

- [ ] **Step 3: Commit**

```bash
git add script.js
git commit -m "Home: render monthly hero with dual-cap bar + pace + CTAs"
```

---

### Task A.6: Render insight strip

**Files:** Modify `script.js`.

- [ ] **Step 1: Add `renderHomeInsight`**

```javascript
ExpenseTracker.prototype.renderHomeInsight = function ({ monthName, aim, monthTotalRegular, SOFT }) {
    const root = document.getElementById('home-insight');
    if (!root) return;
    let msg;
    if (aim.state === 'HARD_OVER') msg = `You're over the hard cap. The rest of ${monthName} is reset territory — log every dollar.`;
    else if (aim.state === 'SOFT_OVER') msg = `Soft target blown. Stay under <strong>$${aim.dailyTotal}/day</strong> to land below the hard cap.`;
    else if (aim.state === 'FOOD_OVER') msg = `Food cap blown. Stay under <strong>$${aim.dailyTotal}/day total</strong> for the rest of ${monthName}.`;
    else msg = `Spending under <strong>$${aim.dailyTotal}</strong> today keeps ${monthName} under your $${SOFT.toLocaleString()} soft target.`;
    root.classList.remove('hidden');
    root.innerHTML = `<div class="insight"><span class="material-symbols-rounded">tips_and_updates</span><div class="text">${msg}</div></div>`;
};
```

- [ ] **Step 2: Commit**

```bash
git add script.js
git commit -m "Home: render insight strip with adaptive copy"
```

---

### Task A.7: Render trip teaser

**Files:** Modify `script.js`.

- [ ] **Step 1: Add `renderHomeTripTeaser` + helpers**

```javascript
ExpenseTracker.prototype.renderHomeTripTeaser = function () {
    const root = document.getElementById('home-trip-teaser');
    if (!root) return;
    if (!window.tripsStore) { root.classList.add('hidden'); return; }
    const today = this.getLocalDateString(new Date());
    const active = window.tripsStore.getActiveTrip(today);
    const upcoming = window.tripsStore.getUpcomingTrips(today).sort((a, b) => a.startDate.localeCompare(b.startDate))[0];
    const trip = active || upcoming;
    if (!trip) { root.classList.add('hidden'); return; }

    const state = window.tripsStore.getState(trip, today);
    let line2;
    if (state === 'ACTIVE') {
        const total = this.getTripExpenses(trip.id).reduce((s, e) => s + Number(e.amount || 0), 0);
        const day = this._tripDayNumber(trip, today);
        const totalDays = this._tripTotalDays(trip);
        line2 = `$${Math.round(total)} of $${trip.budget} · DAY ${day} / ${totalDays} · view trip →`;
    } else {
        const days = Math.max(0, Math.ceil((this.parseLocalDate(trip.startDate) - this.parseLocalDate(today)) / 86400000));
        line2 = `STARTS IN ${days} DAYS · ${this._formatTripDates(trip)}`;
    }
    root.classList.remove('hidden');
    root.innerHTML = `
<div class="section-head"><h2 class="section-title">Coming up</h2><a href="#" class="section-link" onclick="event.preventDefault();showPage('trips')">All trips →</a></div>
<div class="trip-teaser" onclick="window.tripsStore._focusTripId='${trip.id}';showPage('trip-dashboard')">
    <div class="icon"><span class="material-symbols-rounded">flight_takeoff</span></div>
    <div class="body"><div class="name">${this._escapeHtml(trip.name)}</div><div class="when">${line2}</div></div>
    <span class="chev material-symbols-rounded">chevron_right</span>
</div>`;
};

ExpenseTracker.prototype._tripDayNumber = function (trip, today) {
    const start = this.parseLocalDate(trip.startDate);
    const t = this.parseLocalDate(today);
    return Math.max(1, Math.floor((t - start) / 86400000) + 1);
};
ExpenseTracker.prototype._tripTotalDays = function (trip) {
    return Math.floor((this.parseLocalDate(trip.endDate) - this.parseLocalDate(trip.startDate)) / 86400000) + 1;
};
ExpenseTracker.prototype._formatTripDates = function (trip) {
    const fmt = d => this.parseLocalDate(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }).toUpperCase();
    return `${fmt(trip.startDate)} – ${fmt(trip.endDate)}`;
};
```

- [ ] **Step 2: Verify (with seeded trip)**

In console:
```javascript
window.tripsStore.create({ name: 'Test', budget: 500, startDate: '2026-05-25', endDate: '2026-06-01' });
window.expenseTracker.updateDashboard();
```
Teaser appears with "STARTS IN N DAYS · MAY 25 – JUN 1".

- [ ] **Step 3: Commit**

```bash
git add script.js
git commit -m "Home: render trip teaser (active or upcoming)"
```

---

### Task A.8: Render redesigned habit card

**Files:** Modify `script.js`.

- [ ] **Step 1: Add `renderHomeHabit`**

```javascript
ExpenseTracker.prototype.renderHomeHabit = function () {
    const root = document.getElementById('home-habit');
    if (!root) return;
    const g = window.gamification;
    const streak = g?.data?.streak?.current || 0;
    const best = g?.data?.streak?.longest || 0;
    const today = this.getLocalDateString(new Date());

    const days = [];
    for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const key = this.getLocalDateString(d);
        const log = g?.data?.dailyLog?.[key];
        days.push({
            num: d.getDate(),
            label: d.toLocaleDateString('en-US', { weekday: 'narrow' }).toUpperCase(),
            mood: log?.mood || null,
            isToday: key === today
        });
    }
    const tile = d => {
        const cls = ['habit-tile'];
        if (d.mood === 'no-spend') cls.push('no-spend');
        if (d.mood === 'essential') cls.push('essential');
        if (d.mood === 'wants') cls.push('wants');
        if (d.isToday) cls.push('today');
        return `<div class="${cls.join(' ')}">${d.num}<span class="habit-day-label">${d.label}</span></div>`;
    };
    const todayMood = g?.data?.dailyLog?.[today]?.mood;
    const cls = m => `ck-${m === 'no-spend' ? 'no' : m === 'essential' ? 'es' : 'wt'}` + (todayMood === m ? ' suggested' : '');

    root.innerHTML = `
<div class="section-head"><h2 class="section-title">Daily habit</h2><span class="section-meta">tap a day</span></div>
<div class="habit-card">
    <div class="habit-row">
        <div class="habit-streak">
            <div class="flame"><span class="material-symbols-rounded">local_fire_department</span></div>
            <div class="num">${streak} <span>day streak</span></div>
        </div>
        <div class="habit-best">BEST · ${best} DAYS</div>
    </div>
    <div class="habit-week">${days.map(tile).join('')}</div>
    <div class="checkin">
        <button class="${cls('no-spend')}" onclick="onHabitCheckin('no-spend')">No spend</button>
        <button class="${cls('essential')}" onclick="onHabitCheckin('essential')">Essentials</button>
        <button class="${cls('wants')}" onclick="onHabitCheckin('wants')">Wants</button>
    </div>
</div>`;
};

window.onHabitCheckin = function (mood) {
    if (!window.gamification) return;
    const today = window.expenseTracker.getLocalDateString(new Date());
    window.gamification.data.dailyLog = window.gamification.data.dailyLog || {};
    window.gamification.data.dailyLog[today] = { ...(window.gamification.data.dailyLog[today] || {}), mood, checkedIn: true };
    window.gamification.save();
    window.expenseTracker.renderHomeHabit();
};
```

- [ ] **Step 2: Commit**

```bash
git add script.js
git commit -m "Home: render redesigned habit card"
```

---

### Task A.9: Render category donut + legend

**Files:** Modify `script.js`.

- [ ] **Step 1: Add `_categoryColor` and `renderHomeCategories`**

```javascript
ExpenseTracker.prototype._categoryColor = function (name) {
    return {
        Food: '#ff9c66', Coffee: '#ffd166', Transit: '#66d9ff', Transportation: '#66d9ff',
        Shopping: '#7ee7c1', Shop: '#7ee7c1', Entertainment: '#c89eff', Fun: '#c89eff',
        Bills: '#b0b6c8', Other: '#8b8fa3'
    }[name] || '#8b8fa3';
};

ExpenseTracker.prototype.renderHomeCategories = function (monthExpenses) {
    const root = document.getElementById('home-categories');
    if (!root) return;
    const totals = {};
    let grand = 0;
    for (const e of monthExpenses) {
        totals[e.category] = (totals[e.category] || 0) + Number(e.amount || 0);
        grand += Number(e.amount || 0);
    }
    const ordered = Object.entries(totals).sort((a, b) => b[1] - a[1]);
    if (grand === 0) {
        root.innerHTML = `<div class="section-head"><h2 class="section-title">Where it goes</h2><span class="section-meta">no expenses yet</span></div><div class="cat-card"><div style="text-align:center;color:var(--on-surface-mute);padding:20px 0;font-size:13px">Add an expense to see your breakdown.</div></div>`;
        return;
    }
    let offset = 0;
    const arcs = ordered.map(([cat, amt]) => {
        const pct = Math.round((amt / grand) * 100);
        const seg = `<circle cx="18" cy="18" r="15.92" fill="none" stroke="${this._categoryColor(cat)}" stroke-width="3.6" stroke-dasharray="${pct} 100" stroke-dashoffset="-${offset}" stroke-linecap="round"/>`;
        offset += pct;
        return seg;
    }).join('');
    const legend = ordered.map(([cat, amt]) => {
        const pct = Math.round((amt / grand) * 100);
        return `<div class="cat-item" onclick="openCategoryFilter('${cat}')"><span class="swatch" style="background:${this._categoryColor(cat)}"></span><span class="name">${this._escapeHtml(cat)}</span><span class="amt">$${Math.round(amt)} · ${pct}%</span></div>`;
    }).join('');

    root.innerHTML = `
<div class="section-head"><h2 class="section-title">Where it goes</h2><span class="section-meta">this month</span></div>
<div class="cat-card"><div class="cat-row">
    <div class="donut"><svg viewBox="0 0 36 36"><circle cx="18" cy="18" r="15.92" fill="none" stroke="rgba(255,255,255,0.05)" stroke-width="3.6"/>${arcs}</svg><div class="center"><div class="total">$${Math.round(grand)}</div><div class="label">spent</div></div></div>
    <div class="cat-legend">${legend}</div>
</div></div>`;
};
```

- [ ] **Step 2: Commit**

```bash
git add script.js
git commit -m "Home: render category donut + legend with drill-down hooks"
```

---

### Task A.10: Render spending trend with adaptive aim line

**Files:** Modify `script.js`.

- [ ] **Step 1: Add `renderHomeTrend` + popover handler**

```javascript
ExpenseTracker.prototype.renderHomeTrend = function ({ regularThisMonth, daysInMonth, dayOfMonth, monthName, aim }) {
    const root = document.getElementById('home-trend');
    if (!root) return;
    const perDay = new Array(daysInMonth).fill(0);
    for (const e of regularThisMonth) {
        const d = this.parseLocalDate(e.date).getDate();
        if (d >= 1 && d <= daysInMonth) perDay[d - 1] += Number(e.amount || 0);
    }
    const max = Math.max(1, ...perDay);

    const Y = new Date().getFullYear() - 1;
    const M = new Date().getMonth();
    const lastYearTotalSamePoint = this.expenses
        .filter(e => e.tripId == null)
        .filter(e => { const d = this.parseLocalDate(e.date); return d.getFullYear() === Y && d.getMonth() === M && d.getDate() <= dayOfMonth; })
        .reduce((s, e) => s + Number(e.amount || 0), 0);
    const thisPointTotal = perDay.slice(0, dayOfMonth).reduce((s, v) => s + v, 0);
    const compareDelta = thisPointTotal - lastYearTotalSamePoint;
    const compareCls = compareDelta < 0 ? '' : 'over';
    const compareText = lastYearTotalSamePoint === 0
        ? `<span style="opacity:.7">vs same point last ${monthName}: no data</span>`
        : `<span>vs same point last ${monthName}:</span><span class="delta ${compareCls}">${compareDelta < 0 ? '−' : '+'}$${Math.abs(Math.round(compareDelta))} ${compareDelta < 0 ? 'lower' : 'higher'}</span>`;

    const aimY = aim.dailyTotal > 0 && max > 0 ? Math.max(0, Math.min(100, 100 - (aim.dailyTotal / max) * 100)) : 60;

    const bars = perDay.map((v, i) => {
        const day = i + 1;
        const h = Math.max(2, (v / max) * 100);
        let cls = 'b';
        if (day > dayOfMonth) cls += ' future';
        if (day === dayOfMonth) cls += ' today';
        return `<div class="${cls}" style="height:${day > dayOfMonth ? 14 : h}%" data-day="${day}" data-amt="${v}" onclick="showHomeTrendPopover(this)"></div>`;
    }).join('');

    const today = perDay[dayOfMonth - 1] || 0;
    const sliced = perDay.slice(0, Math.max(1, dayOfMonth));
    const bestIdx = sliced.map((v, i) => [v, i]).sort((a, b) => a[0] - b[0])[0] || [0, 0];
    const worstIdx = sliced.map((v, i) => [v, i]).sort((a, b) => b[0] - a[0])[0] || [0, 0];
    const todayDeltaText = today > aim.dailyTotal ? `+$${Math.round(today - aim.dailyTotal)} vs aim` : `−$${Math.round(aim.dailyTotal - today)} vs aim`;
    const monthAbbr = monthName.slice(0, 3).toUpperCase();

    root.innerHTML = `
<div class="section-head"><h2 class="section-title">Spending trend</h2><span class="section-meta">tap a bar</span></div>
<div class="trend-card">
    <div class="trend-toggle"><button class="active">Daily</button><button>Weekly</button></div>
    <div class="trend-compare">${compareText}</div>
    <div class="trend-chart-wrap">
        <div class="trend-pace-line" style="top:${aimY}%"><span class="trend-pace-label">aim · $${aim.dailyTotal}/day</span></div>
        <div class="trend-bars" style="--cols:${daysInMonth}">${bars}</div>
    </div>
    <div class="trend-foot">
        <span>${monthAbbr} 1</span>
        <span>${Math.round(daysInMonth / 2)}</span>
        <span style="color:var(--m-1)">today · ${dayOfMonth}</span>
        <span>${daysInMonth}</span>
    </div>
    <div class="trend-stats">
        <div class="trend-stat"><div class="lbl">Today</div><div class="val">$${Math.round(today)}</div><div class="meta">${todayDeltaText}</div></div>
        <div class="trend-stat"><div class="lbl">Best day</div><div class="val">$${Math.round(bestIdx[0])}</div><div class="meta">${monthName} ${bestIdx[1] + 1}</div></div>
        <div class="trend-stat"><div class="lbl">Worst day</div><div class="val">$${Math.round(worstIdx[0])}</div><div class="meta">${monthName} ${worstIdx[1] + 1}</div></div>
    </div>
</div>`;
};

window.showHomeTrendPopover = function (barEl) {
    document.querySelectorAll('#home-trend .trend-bars .b .bar-popover').forEach(p => p.remove());
    document.querySelectorAll('#home-trend .trend-bars .b').forEach(b => b.classList.remove('tapped'));
    barEl.classList.add('tapped');
    const day = barEl.dataset.day;
    const amt = Math.round(Number(barEl.dataset.amt));
    const monthAbbr = new Date().toLocaleDateString('en-US', { month: 'short' }).toUpperCase();
    barEl.insertAdjacentHTML('afterbegin', `<div class="bar-popover"><span class="day">${monthAbbr} ${day}</span>$${amt}</div>`);
    setTimeout(() => {
        document.addEventListener('click', dismissOnce, { once: true, capture: true });
    }, 0);
    function dismissOnce(e) {
        if (e.target.closest('.b') === barEl) return;
        barEl.classList.remove('tapped');
        const p = barEl.querySelector('.bar-popover'); if (p) p.remove();
    }
};
```

- [ ] **Step 2: Commit**

```bash
git add script.js
git commit -m "Home: render spending trend with adaptive aim line + bar popover"
```

---

### Task A.11: Track A final smoke test

- [ ] **Step 1: Build + manual smoke**

Run: `./test.sh` then `npm run dev`. At 393px width, Home shows: greeting → hero → insight → (teaser) → habit → categories → trend. Tapping `+ Add` navigates. Tapping `Auto add` runs Gmail sync.

- [ ] **Step 2: Tag**

```bash
git tag track-a-complete
```

---

## Track B — Trip Mode (Trip Dashboard + Trips Index)

**Owner files:** `js/trip-dashboard.js` (new), `script.js` (trip helpers prototype methods), `styles/main.css` (append trip styles), `index.html` `#trip-dashboard-page` and `#trips-page` blocks only.

**Spec sections covered:** §5 (Trip Mode), §5.4 (Start/End), §5.5 (Trip Dashboard), §5.6 (Trips Index).

---

### Task B.1: Append trip CSS

**Files:** Modify `styles/main.css`.

- [ ] **Step 1: Append**

Append (1:1 from `mocks/trip-dashboard.html`):

```css
/* ===== Trip dashboard ===== */
.trip-pill { display: inline-flex; align-items: center; gap: 6px; padding: 5px 10px 5px 8px; border-radius: 999px; background: rgba(0,242,254,0.08); border: 1px solid rgba(0,242,254,0.22); font-size: 10.5px; font-weight: 600; letter-spacing: 0.1em; text-transform: uppercase; color: var(--trip-2); }
.trip-pill::before { content: ""; width: 6px; height: 6px; border-radius: 50%; background: var(--trip-2); box-shadow: 0 0 8px var(--trip-2); animation: trip-pulse 1.6s ease-out infinite; }
@keyframes trip-pulse { 0% { transform: scale(1); opacity: 1; } 70% { transform: scale(1.6); opacity: 0; } 100% { transform: scale(1); opacity: 0; } }

.trip-hero { position: relative; padding: 22px 22px 20px; border-radius: 28px; background: linear-gradient(160deg, rgba(79,172,254,0.16) 0%, rgba(0,242,254,0.04) 38%, transparent 70%), linear-gradient(180deg, var(--surface) 0%, var(--surface-2) 100%); border: 1px solid rgba(0,242,254,0.18); overflow: hidden; isolation: isolate; }
.trip-hero > * { position: relative; z-index: 1; }
.trip-eyebrow { display: flex; align-items: center; gap: 8px; font-family: 'JetBrains Mono', monospace; font-size: 10px; letter-spacing: 0.22em; text-transform: uppercase; color: var(--trip-2); margin-bottom: 8px; }
.trip-eyebrow .material-symbols-rounded { font-size: 14px; }
.trip-name { font-family: 'Fraunces', serif; font-weight: 500; font-size: 36px; line-height: 1; letter-spacing: -0.02em; background: linear-gradient(180deg, #ffffff 0%, #c0eaff 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
.trip-sub { display: flex; gap: 12px; align-items: baseline; margin-top: 10px; }
.trip-day-counter { font-family: 'JetBrains Mono', monospace; font-size: 11px; font-weight: 500; background: rgba(255,255,255,0.06); border: 1px solid var(--line-strong); padding: 4px 8px; border-radius: 6px; }
.trip-dates { font-size: 12.5px; color: var(--on-surface-mute); }
.trip-numbers { margin-top: 22px; display: grid; grid-template-columns: 1fr auto; align-items: baseline; gap: 12px; }
.trip-spent { font-family: 'Fraunces', serif; font-weight: 500; font-size: 56px; line-height: 1; letter-spacing: -0.03em; }
.trip-spent .currency { font-size: 28px; color: var(--on-surface-mute); margin-right: 2px; vertical-align: 0.34em; font-family: 'Inter Tight', sans-serif; font-weight: 400; }
.trip-of { font-size: 13px; color: var(--on-surface-mute); text-align: right; }
.trip-of strong { color: var(--on-surface); font-weight: 600; }
.trip-bar-wrap { margin-top: 18px; position: relative; height: 10px; border-radius: 999px; background: rgba(255,255,255,0.04); overflow: hidden; border: 1px solid var(--line); }
.trip-bar { position: absolute; inset: 0; background: var(--trip-grad); border-radius: 999px; box-shadow: 0 0 18px rgba(0,242,254,0.4); }
.trip-bar::after { content: ""; position: absolute; inset: 0; background: linear-gradient(90deg, transparent 30%, rgba(255,255,255,0.5) 50%, transparent 70%); animation: trip-shimmer 2.4s ease-in-out infinite; }
@keyframes trip-shimmer { 0%,100% { transform: translateX(-30%); } 50% { transform: translateX(30%); } }
.trip-pace { margin-top: 14px; display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; }
.pace-cell.recovery { border-color: rgba(0,242,254,0.25); background: rgba(0,242,254,0.05); }
.pace-cell.recovery .value { color: var(--trip-2); }
.insight.trip { background: linear-gradient(180deg, rgba(79,172,254,0.07), rgba(0,242,254,0.02)); border-color: rgba(0,242,254,0.15); }
.insight.trip .material-symbols-rounded, .insight.trip .text strong { color: var(--trip-2); }
.today-card { background: var(--surface); border: 1px solid var(--line); border-radius: 22px; overflow: hidden; }
.today-row { display: grid; grid-template-columns: 36px 1fr auto; gap: 12px; align-items: center; padding: 14px 18px; border-bottom: 1px solid var(--line); }
.today-row:last-child { border-bottom: 0; }
.today-row .swatch { width: 36px; height: 36px; border-radius: 11px; display: flex; align-items: center; justify-content: center; }
.today-row .swatch .material-symbols-rounded { font-size: 20px; font-variation-settings: 'FILL' 1, 'wght' 500; }
.today-row .swatch.food { color: var(--cat-food); background: rgba(255,156,102,0.10); }
.today-row .swatch.transit { color: var(--cat-transit); background: rgba(102,217,255,0.10); }
.today-row .swatch.fun { color: var(--cat-fun); background: rgba(200,158,255,0.10); }
.today-row .swatch.shop { color: var(--cat-shop); background: rgba(126,231,193,0.10); }
.today-row .desc { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.today-row .desc .name { font-size: 14px; font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.today-row .desc .meta { font-size: 11px; color: var(--on-surface-mute); }
.today-row .amount { font-family: 'JetBrains Mono', monospace; font-size: 14px; font-weight: 500; }
.today-empty { text-align: center; padding: 22px 16px; color: var(--on-surface-mute); font-size: 13px; }
.add-fab { display: flex; align-items: center; justify-content: center; gap: 8px; margin-top: 16px; padding: 14px 18px; border-radius: 18px; background: var(--trip-grad); color: #001b1f; font-weight: 600; font-size: 14px; border: 0; width: 100%; box-shadow: 0 8px 30px rgba(0,242,254,0.25); cursor: pointer; }
.add-fab .material-symbols-rounded { font-size: 20px; font-variation-settings: 'FILL' 1, 'wght' 700; }
.breakdown { background: var(--surface); border: 1px solid var(--line); border-radius: 22px; padding: 18px 20px 8px; }
.bd-row { display: grid; grid-template-columns: 92px 1fr auto; gap: 12px; align-items: center; padding: 11px 0; border-bottom: 1px dashed rgba(255,255,255,0.04); }
.bd-row:last-child { border-bottom: 0; }
.bd-cat { display: flex; gap: 8px; align-items: center; font-size: 13px; }
.bd-cat .dot { width: 8px; height: 8px; border-radius: 50%; }
.bd-bar { height: 8px; border-radius: 999px; background: rgba(255,255,255,0.04); overflow: hidden; }
.bd-bar > span { display: block; height: 100%; border-radius: 999px; }
.bd-amount { font-family: 'JetBrains Mono', monospace; font-size: 12.5px; white-space: nowrap; }
.bd-amount .pct { color: var(--on-surface-mute); margin-left: 6px; font-size: 11px; }
.day-strip { background: var(--surface); border: 1px solid var(--line); border-radius: 22px; padding: 18px 20px 16px; }
.day-axis { display: grid; grid-template-columns: repeat(var(--days, 7), 1fr); gap: 8px; align-items: end; height: 110px; padding: 4px 0 6px; }
.day-bar-wrap { display: flex; flex-direction: column; align-items: center; gap: 6px; height: 100%; justify-content: end; }
.day-bar { width: 100%; border-radius: 8px 8px 4px 4px; background: linear-gradient(180deg, rgba(79,172,254,0.85), rgba(0,242,254,0.55)); position: relative; min-height: 4px; }
.day-bar.future { background: rgba(255,255,255,0.05); border: 1px dashed var(--line-strong); }
.day-bar.today { background: linear-gradient(180deg, #4facfe, #00f2fe); box-shadow: 0 0 16px rgba(0,242,254,0.45); }
.day-num { font-family: 'JetBrains Mono', monospace; font-size: 10px; color: var(--on-surface-mute); }
.day-num.today { color: var(--trip-2); font-weight: 600; }
.day-axis-foot { display: flex; justify-content: space-between; margin-top: 14px; font-size: 10.5px; color: var(--on-surface-mute); font-family: 'JetBrains Mono', monospace; letter-spacing: 0.05em; }
.end-trip { margin-top: 20px; display: flex; align-items: center; justify-content: center; gap: 8px; width: 100%; padding: 14px; border-radius: 16px; background: rgba(255,255,255,0.03); color: var(--on-surface-mute); font-size: 13px; font-weight: 500; border: 1px solid var(--line-strong); cursor: pointer; }
.start-trip { background: var(--trip-grad); color: #001b1f; border: 0; }

/* ===== Trips index ===== */
.trips-page .page-title { font-family: 'Fraunces', serif; font-size: 32px; font-weight: 500; letter-spacing: -0.02em; margin: 6px 4px 0; }
.trips-page .page-subtitle { font-size: 12px; color: var(--on-surface-mute); margin: 4px 4px 18px; font-family: 'JetBrains Mono', monospace; letter-spacing: 0.05em; text-transform: uppercase; }
.year-summary { background: linear-gradient(180deg, var(--surface), var(--surface-2)); border: 1px solid var(--line); border-radius: 24px; padding: 22px; margin-bottom: 18px; position: relative; overflow: hidden; }
.year-summary::before { content: ""; position: absolute; inset: 0; background: radial-gradient(600px 200px at 100% 0%, rgba(0,242,254,0.08), transparent); pointer-events: none; }
.ys-label { font-family: 'JetBrains Mono', monospace; font-size: 10px; text-transform: uppercase; letter-spacing: 0.18em; color: var(--on-surface-mute); }
.ys-num { font-family: 'Fraunces', serif; font-size: 44px; font-weight: 500; letter-spacing: -0.02em; margin-top: 4px; background: linear-gradient(180deg, #ffffff, #b6e8ff); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
.ys-num .currency { font-size: 22px; color: var(--on-surface-mute); -webkit-text-fill-color: var(--on-surface-mute); margin-right: 2px; vertical-align: 0.42em; font-family: 'Inter Tight'; font-weight: 400; }
.ys-row { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; margin-top: 16px; padding-top: 16px; border-top: 1px solid var(--line); }
.ys-cell .v { font-family: 'JetBrains Mono', monospace; font-size: 14px; }
.ys-cell .l { font-size: 10px; letter-spacing: 0.12em; text-transform: uppercase; color: var(--on-surface-mute); margin-top: 4px; }
.trip-card { position: relative; background: var(--surface); border: 1px solid var(--line); border-radius: 20px; padding: 18px; margin-bottom: 12px; overflow: hidden; cursor: pointer; }
.trip-card.active { border-color: rgba(0,242,254,0.32); background: linear-gradient(120deg, rgba(0,242,254,0.06), var(--surface) 60%); }
.trip-card .pill { display: inline-flex; align-items: center; gap: 5px; font-family: 'JetBrains Mono', monospace; font-size: 9.5px; letter-spacing: 0.16em; text-transform: uppercase; padding: 3px 8px; border-radius: 6px; }
.trip-card.active .pill { color: var(--trip-2); background: rgba(0,242,254,0.10); border: 1px solid rgba(0,242,254,0.25); }
.trip-card.upcoming .pill { color: var(--warn); background: rgba(255,184,77,0.08); border: 1px solid rgba(255,184,77,0.25); }
.trip-card.past .pill { color: var(--on-surface-mute); background: rgba(255,255,255,0.04); border: 1px solid var(--line); }
.trip-card .name { font-family: 'Fraunces', serif; font-size: 22px; font-weight: 500; letter-spacing: -0.01em; margin-top: 8px; }
.trip-card .meta { font-size: 11.5px; color: var(--on-surface-mute); margin-top: 2px; }
.trip-card .row { display: flex; align-items: end; justify-content: space-between; margin-top: 14px; gap: 12px; }
.trip-card .spent { font-family: 'JetBrains Mono', monospace; font-size: 18px; font-weight: 500; }
.trip-card .spent .of { color: var(--on-surface-mute); font-weight: 400; }
.trip-card .mini-bar { flex: 1; height: 4px; border-radius: 999px; background: rgba(255,255,255,0.05); overflow: hidden; margin-bottom: 6px; }
.trip-card .mini-bar > span { display: block; height: 100%; background: var(--trip-grad); border-radius: 999px; }
.trip-card.past .mini-bar > span { background: linear-gradient(120deg, #6e7383, #8b8fa3); }
.trip-card.upcoming .mini-bar > span { background: linear-gradient(120deg, #ffb84d, #ff9c66); }
.trip-card.past.over { border-color: rgba(255,184,77,0.25); }
.trip-card .chev { position: absolute; right: 14px; top: 18px; color: var(--on-surface-faint); }
.divider-label { font-family: 'JetBrains Mono', monospace; font-size: 10px; text-transform: uppercase; letter-spacing: 0.18em; color: var(--on-surface-faint); margin: 22px 6px 10px; display: flex; align-items: center; gap: 10px; }
.divider-label::after { content: ""; flex: 1; height: 1px; background: linear-gradient(to right, var(--line-strong), transparent); }

.new-trip-form { display: flex; flex-direction: column; gap: 12px; }
.new-trip-form input, .new-trip-form select { background: rgba(255,255,255,0.03); border: 1px solid var(--line-strong); border-radius: 12px; padding: 12px 14px; color: var(--on-surface); font-family: 'Inter Tight'; font-size: 14px; outline: none; }
.new-trip-form .row2 { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.new-trip-form button.primary { background: var(--trip-grad); color: #001b1f; border: 0; padding: 14px; border-radius: 14px; font-weight: 600; font-size: 14px; }
.new-trip-form button.ghost { background: transparent; border: 1px solid var(--line-strong); color: var(--on-surface-mute); padding: 14px; border-radius: 14px; font-size: 14px; }
```

- [ ] **Step 2: Commit**

```bash
git add styles/main.css
git commit -m "Trips: append CSS classes for dashboard + index (mock 1:1)"
```

---

### Task B.2: Create `js/trip-dashboard.js` skeleton + global functions

**Files:**
- Create: `js/trip-dashboard.js`
- Modify: `index.html` (script tag after `js/forecast.js`)

- [ ] **Step 1: Write skeleton**

```javascript
/**
 * Trip dashboard + Trips index renderers. Spec §5.5–§5.6.
 * Reads from window.tripsStore + window.expenseTracker.getTripExpenses(id).
 * Exposes globals: renderTripDashboard, renderTripsIndex, openNewTripModal, closeNewTripModal,
 *   submitNewTrip, onStartTrip, onEndTrip.
 */
(function () {
    function $(id) { return document.getElementById(id); }
    function escapeHtml(s) { return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
    function todayStr() { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0'); }
    function fmtRange(a, b) {
        const f = s => window.expenseTracker.parseLocalDate(s).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        const y = window.expenseTracker.parseLocalDate(b).getFullYear();
        return `${f(a)} – ${f(b)}, ${y}`;
    }
    function categoryColor(name) {
        return { Food: '#ff9c66', Coffee: '#ffd166', Transit: '#66d9ff', Transportation: '#66d9ff', Shopping: '#7ee7c1', Entertainment: '#c89eff', Bills: '#b0b6c8' }[name] || '#8b8fa3';
    }

    function pickTripForDashboard() {
        const today = todayStr();
        const focusId = window.tripsStore && window.tripsStore._focusTripId;
        if (focusId) { const t = window.tripsStore.getById(focusId); if (t) return t; }
        const active = window.tripsStore && window.tripsStore.getActiveTrip(today);
        if (active) return active;
        const upcoming = window.tripsStore && window.tripsStore.getUpcomingTrips(today)[0];
        return upcoming || null;
    }

    window.renderTripDashboard = function () {
        const root = $('trip-dashboard-content');
        if (!root) return;
        const trip = pickTripForDashboard();
        if (!trip) {
            root.innerHTML = `<div class="today-empty" style="padding:60px 16px"><span class="material-symbols-rounded" style="font-size:36px;color:var(--on-surface-faint)">flight_takeoff</span><div style="margin-top:12px">No trips yet. Tap the <strong>+</strong> in the Trips tab to create one.</div></div>`;
            return;
        }
        const today = todayStr();
        const state = window.tripsStore.getState(trip, today);
        const tripExpenses = window.expenseTracker.getTripExpenses(trip.id);
        const spent = tripExpenses.reduce((s, e) => s + Number(e.amount || 0), 0);
        const remaining = Math.max(0, trip.budget - spent);
        const totalDays = window.expenseTracker._tripTotalDays(trip);
        const dayN = state === 'UPCOMING' ? 0 : window.expenseTracker._tripDayNumber(trip, today);
        const cappedDayN = Math.min(dayN, totalDays);
        const fillPct = trip.budget > 0 ? Math.min(100, (spent / trip.budget) * 100) : 0;

        const avgPerDay = cappedDayN > 0 ? Math.round(spent / cappedDayN) : 0;
        const idealPerDay = totalDays > 0 ? Math.round(trip.budget / totalDays) : 0;
        const remainingDays = Math.max(1, totalDays - cappedDayN + 1);
        const aimToday = Math.max(0, Math.round(remaining / remainingDays));

        // Today's transactions for this trip
        const todays = tripExpenses.filter(e => e.date === today);
        const todayTotal = todays.reduce((s, e) => s + Number(e.amount || 0), 0);
        const txnRows = todays.length === 0
            ? `<div class="today-empty">Nothing logged today yet.</div>`
            : todays.map(e => {
                const sw = e.category === 'Food' ? 'food' : (e.category === 'Transit' || e.category === 'Transportation') ? 'transit' : (e.category === 'Entertainment' || e.category === 'Fun') ? 'fun' : 'shop';
                const icon = sw === 'food' ? 'restaurant' : sw === 'transit' ? 'subway' : sw === 'fun' ? 'museum' : 'shopping_bag';
                return `<div class="today-row"><div class="swatch ${sw}"><span class="material-symbols-rounded">${icon}</span></div><div class="desc"><span class="name">${escapeHtml(e.description || 'Expense')}</span><span class="meta">${escapeHtml(e.category || 'Other')}</span></div><div class="amount">$${Number(e.amount).toFixed(2)}</div></div>`;
            }).join('');

        // Breakdown
        const totals = {};
        for (const e of tripExpenses) totals[e.category] = (totals[e.category] || 0) + Number(e.amount || 0);
        const ordered = Object.entries(totals).sort((a, b) => b[1] - a[1]);
        const breakdownRows = ordered.length === 0 ? `<div class="today-empty">No expenses yet.</div>` : ordered.map(([cat, amt]) => {
            const pct = spent > 0 ? Math.round((amt / spent) * 100) : 0;
            return `<div class="bd-row"><div class="bd-cat"><span class="dot" style="background:${categoryColor(cat)}"></span>${escapeHtml(cat)}</div><div class="bd-bar"><span style="width:${pct}%;background:${categoryColor(cat)}"></span></div><div class="bd-amount">$${Math.round(amt)}<span class="pct">${pct}%</span></div></div>`;
        }).join('');

        // Daily rhythm
        const perDay = new Array(totalDays).fill(0);
        for (const e of tripExpenses) {
            const idx = Math.floor((window.expenseTracker.parseLocalDate(e.date) - window.expenseTracker.parseLocalDate(trip.startDate)) / 86400000);
            if (idx >= 0 && idx < totalDays) perDay[idx] += Number(e.amount || 0);
        }
        const maxDay = Math.max(1, ...perDay);
        const dayBars = perDay.map((v, i) => {
            const dnum = window.expenseTracker.parseLocalDate(trip.startDate);
            dnum.setDate(dnum.getDate() + i);
            const isToday = window.expenseTracker.getLocalDateString(dnum) === today;
            const isFuture = i >= cappedDayN;
            const cls = isFuture ? 'day-bar future' : isToday ? 'day-bar today' : 'day-bar';
            const h = isFuture ? 20 : Math.max(8, (v / maxDay) * 100);
            return `<div class="day-bar-wrap"><div class="${cls}" style="height:${h}%"></div><div class="day-num${isToday ? ' today' : ''}">${dnum.getDate()}</div></div>`;
        }).join('');

        // Action buttons
        let actionBtn = '';
        if (state === 'UPCOMING' || (state === 'ACTIVE' && !trip.startedAt)) {
            actionBtn = `<button class="end-trip start-trip" onclick="onStartTrip('${trip.id}')"><span class="material-symbols-rounded">play_arrow</span> Start Trip</button>`;
        } else if (state === 'ACTIVE') {
            actionBtn = `<button class="end-trip" onclick="onEndTrip('${trip.id}')"><span class="material-symbols-rounded">flag</span> End trip early</button>`;
        }

        const insightMsg = state === 'UPCOMING'
            ? `Trip starts ${fmtRange(trip.startDate, trip.endDate).split(',')[0]}. Tap <strong>Start Trip</strong> when you arrive.`
            : `Aim under <strong>$${aimToday}/day</strong> for the rest to land on budget.`;

        root.innerHTML = `
<div class="app-header">
    <div class="brand"><div class="glyph" style="background:var(--trip-grad)"><span class="material-symbols-rounded" style="color:#001b1f">flight_takeoff</span></div><div class="brand-name">LEDG<span class="accent" style="color:var(--trip-2)">R</span></div></div>
    ${state === 'ACTIVE' ? '<div class="trip-pill">on trip</div>' : ''}
    <button class="icon-btn" onclick="showPage('trips')" aria-label="All trips"><span class="material-symbols-rounded">list</span></button>
</div>
<div class="trip-hero">
    <div class="trip-eyebrow"><span class="material-symbols-rounded">explore</span> ${escapeHtml(trip.name)} · ${state}</div>
    <div class="trip-name">${escapeHtml(trip.name)}</div>
    <div class="trip-sub"><div class="trip-day-counter">DAY ${String(cappedDayN).padStart(2,'0')} / ${String(totalDays).padStart(2,'0')}</div><div class="trip-dates">${fmtRange(trip.startDate, trip.endDate)}</div></div>
    <div class="trip-numbers">
        <div class="trip-spent"><span class="currency">$</span>${Math.round(spent)}</div>
        <div class="trip-of">of <strong>$${trip.budget}</strong> budget<br><span style="opacity:0.6">$${Math.round(remaining)} remaining</span></div>
    </div>
    <div class="trip-bar-wrap"><div class="trip-bar" style="width:${fillPct}%"></div></div>
    <div class="trip-pace">
        <div class="pace-cell"><div class="label">Avg / day</div><div class="value">$${avgPerDay}</div></div>
        <div class="pace-cell"><div class="label">Ideal / day</div><div class="value">$${idealPerDay}</div></div>
        <div class="pace-cell recovery"><div class="label">Aim today</div><div class="value">$${aimToday}</div></div>
    </div>
</div>
<div class="insight trip"><span class="material-symbols-rounded">trending_up</span><div class="text">${insightMsg}</div></div>
<div class="section-head"><h2 class="section-title">Today</h2><span class="section-meta">${todays.length} txns · $${Math.round(todayTotal)}</span></div>
<div class="today-card">${txnRows}</div>
<button class="add-fab" onclick="window.tripsStore._focusTripId='${trip.id}';showPage('add-expense')"><span class="material-symbols-rounded">add</span> Log a trip expense</button>
<div class="section-head"><h2 class="section-title">Breakdown</h2><span class="section-meta">since day 1</span></div>
<div class="breakdown">${breakdownRows}</div>
<div class="section-head"><h2 class="section-title">Daily rhythm</h2><span class="section-meta">${cappedDayN} of ${totalDays}</span></div>
<div class="day-strip"><div class="day-axis" style="--days:${totalDays}">${dayBars}</div><div class="day-axis-foot"><span>day 1</span>${state === 'ACTIVE' ? '<span style="color:var(--trip-2)">today</span>' : ''}<span>day ${totalDays}</span></div></div>
${actionBtn}`;
    };

    window.renderTripsIndex = function () {
        const root = $('trips-page-content');
        if (!root) return;
        const today = todayStr();
        const all = window.tripsStore.all();
        const Y = new Date().getFullYear();
        const yearTrips = all.filter(t => t.startDate.startsWith(String(Y)) || t.endDate.startsWith(String(Y)));
        const active = yearTrips.filter(t => window.tripsStore.getState(t, today) === 'ACTIVE');
        const upcoming = yearTrips.filter(t => window.tripsStore.getState(t, today) === 'UPCOMING').sort((a, b) => a.startDate.localeCompare(b.startDate));
        const past = yearTrips.filter(t => window.tripsStore.getState(t, today) === 'ENDED').sort((a, b) => b.startDate.localeCompare(a.startDate));

        const totalBudget = yearTrips.reduce((s, t) => s + t.budget, 0);
        const yearSpend = yearTrips.reduce((s, t) => s + window.expenseTracker.getTripExpenses(t.id).reduce((ss, e) => ss + Number(e.amount || 0), 0), 0);

        function card(t, kind) {
            const spent = window.expenseTracker.getTripExpenses(t.id).reduce((s, e) => s + Number(e.amount || 0), 0);
            const pct = t.budget > 0 ? Math.min(100, (spent / t.budget) * 100) : 0;
            const over = spent > t.budget;
            const totalDays = window.expenseTracker._tripTotalDays(t);
            let pillTxt;
            if (kind === 'active') pillTxt = `active · day ${window.expenseTracker._tripDayNumber(t, today)} / ${totalDays}`;
            else if (kind === 'upcoming') {
                const n = Math.max(0, Math.ceil((window.expenseTracker.parseLocalDate(t.startDate) - window.expenseTracker.parseLocalDate(today)) / 86400000));
                pillTxt = `in ${n} days`;
            } else pillTxt = window.expenseTracker.parseLocalDate(t.startDate).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
            return `<div class="trip-card ${kind}${over ? ' over' : ''}" onclick="window.tripsStore._focusTripId='${t.id}';showPage('trip-dashboard')">
    <span class="pill">${pillTxt}</span>
    <div class="name">${escapeHtml(t.name)}</div>
    <div class="meta">${fmtRange(t.startDate, t.endDate)}</div>
    <div class="row"><div class="spent">$${Math.round(spent)}<span class="of"> / $${t.budget}</span></div><div class="mini-bar"><span style="width:${pct}%"></span></div></div>
    <span class="chev material-symbols-rounded">chevron_right</span>
</div>`;
        }

        root.innerHTML = `
<div class="app-header">
    <div class="brand"><div class="glyph" style="background:var(--trip-grad)"><span class="material-symbols-rounded" style="color:#001b1f">map</span></div><div class="brand-name">LEDG<span class="accent" style="color:var(--trip-2)">R</span></div></div>
    <button class="icon-btn" onclick="openNewTripModal()" aria-label="New trip"><span class="material-symbols-rounded">add</span></button>
</div>
<h1 class="page-title">Your trips</h1>
<div class="page-subtitle">${Y} · ${yearTrips.length} trip${yearTrips.length === 1 ? '' : 's'} planned</div>
<div class="year-summary">
    <div class="ys-label">Spent on trips this year</div>
    <div class="ys-num"><span class="currency">$</span>${Math.round(yearSpend).toLocaleString()}</div>
    <div class="ys-row">
        <div class="ys-cell"><div class="v">${past.length} trip${past.length === 1 ? '' : 's'}</div><div class="l">completed</div></div>
        <div class="ys-cell"><div class="v">${active.length} active</div><div class="l">right now</div></div>
        <div class="ys-cell"><div class="v">$${totalBudget.toLocaleString()}</div><div class="l">total budget</div></div>
    </div>
</div>
${active.map(t => card(t, 'active')).join('')}
${upcoming.length ? '<div class="divider-label">Upcoming</div>' + upcoming.map(t => card(t, 'upcoming')).join('') : ''}
${past.length ? `<div class="divider-label">Past · ${Y}</div>` + past.map(t => card(t, 'past')).join('') : ''}
${all.length === 0 ? `<div class="today-empty" style="padding:40px 16px"><div>No trips yet. Tap <strong>+</strong> above to plan one.</div></div>` : ''}`;
    };

    window.openNewTripModal = function () {
        const modal = $('new-trip-modal');
        const card = $('new-trip-modal-card');
        if (!modal || !card) return;
        const today = todayStr();
        const next7 = (() => { const d = new Date(); d.setDate(d.getDate() + 7); return d.toISOString().slice(0, 10); })();
        card.innerHTML = `
<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">
    <h3 class="f-serif" style="font-size:20px;font-weight:500">New trip</h3>
    <button class="icon-btn" onclick="closeNewTripModal()"><span class="material-symbols-rounded">close</span></button>
</div>
<form class="new-trip-form" onsubmit="event.preventDefault();submitNewTrip();">
    <input id="nt-name" placeholder="Trip name (e.g. New York)" required maxlength="40">
    <input id="nt-budget" type="number" step="1" min="1" placeholder="Budget ($)" required>
    <div class="row2"><input id="nt-start" type="date" value="${today}" required><input id="nt-end" type="date" value="${next7}" required></div>
    <button type="submit" class="primary">Create trip</button>
    <button type="button" class="ghost" onclick="closeNewTripModal()">Cancel</button>
</form>`;
        modal.classList.remove('hidden');
    };

    window.closeNewTripModal = function () {
        const modal = $('new-trip-modal'); if (modal) modal.classList.add('hidden');
    };

    window.submitNewTrip = async function () {
        const name = $('nt-name').value.trim();
        const budget = Number($('nt-budget').value);
        const startDate = $('nt-start').value;
        const endDate = $('nt-end').value;
        if (!name || !budget || !startDate || !endDate) return;
        if (endDate < startDate) { alert('End date must be on or after start date.'); return; }
        await window.tripsStore.create({ name, budget, startDate, endDate });
        window.closeNewTripModal();
        window.renderTripsIndex();
        if (window.expenseTracker) window.expenseTracker.updateDashboard();
    };

    window.onStartTrip = async function (id) {
        if (!confirm('Start this trip now?')) return;
        await window.tripsStore.start(id);
        window.renderTripDashboard();
        if (window.expenseTracker) window.expenseTracker.updateDashboard();
    };

    window.onEndTrip = async function (id) {
        if (!confirm('End this trip? Future expenses won\'t auto-tag to it.')) return;
        await window.tripsStore.end(id);
        window.renderTripDashboard();
        if (window.expenseTracker) window.expenseTracker.updateDashboard();
    };

    if (window.tripsStore) window.tripsStore.subscribe(() => {
        if (!document.getElementById('trips-page').classList.contains('hidden')) window.renderTripsIndex();
        if (!document.getElementById('trip-dashboard-page').classList.contains('hidden')) window.renderTripDashboard();
    });
})();
```

- [ ] **Step 2: Wire script tag**

In `index.html`, after `<script src="js/forecast.js"></script>` add `<script src="js/trip-dashboard.js"></script>`.

- [ ] **Step 3: Verify**

`./test.sh` — All ✅.
`npm run dev` → tap **Trips** tab → "Your trips" page with empty state. Tap `+` → modal opens. Submit a trip → it appears in the list. Tap the card → trip dashboard renders with hero, breakdown, daily rhythm, and a `Start Trip` button.

- [ ] **Step 4: Commit**

```bash
git add js/trip-dashboard.js index.html
git commit -m "Trips: add trip-dashboard + trips-index renderers + new-trip modal"
```

---

### Task B.3: Track B final smoke test

- [ ] **Step 1: Smoke**

Create a trip starting today. Verify:
- It shows as ACTIVE on Trips index.
- Trip dashboard shows DAY 01 / N counter.
- Tapping `End trip early` confirms and moves it to Past.
- Creating a future-dated trip shows it under Upcoming.
- Home page trip teaser updates after trip creation (`renderHomeTripTeaser` from Track A).

- [ ] **Step 2: Tag**

```bash
git tag track-b-complete
```

---

## Track C — Add Expense redesign

**Owner files:** `script.js` (add `renderAddExpensePage`), `js/smart-input.js` (live preview), `styles/main.css` (append add-expense styles), `index.html` `#add-expense-page` block only.

**Spec sections covered:** §6 (Add Expense), §6.1 (Layout), §6.2 (Live preview), §6.3 (Trip auto-tag toggle).

---

### Task C.1: Append add-expense CSS

**Files:** Modify `styles/main.css`.

- [ ] **Step 1: Append**

```css
/* ===== Add expense ===== */
.page-head { display: flex; align-items: center; justify-content: space-between; padding: 8px 16px 0; }
.head-back { width: 38px; height: 38px; border-radius: 50%; background: rgba(255,255,255,0.04); border: 1px solid var(--line); display: flex; align-items: center; justify-content: center; color: var(--on-surface); }
.head-title { font-family: 'Fraunces', serif; font-size: 20px; font-weight: 500; letter-spacing: -0.01em; }
.head-spacer { width: 38px; }
.trip-banner { display: flex; align-items: center; gap: 10px; padding: 10px 14px; border-radius: 12px; background: linear-gradient(120deg, rgba(0,242,254,0.08), rgba(79,172,254,0.02)); border: 1px solid rgba(0,242,254,0.22); font-size: 12px; color: var(--trip-2); }
.trip-banner.muted { background: rgba(255,255,255,0.03); border-color: var(--line-strong); color: var(--on-surface-mute); }
.trip-banner .toggle { margin-left: auto; font-family: 'JetBrains Mono', monospace; font-size: 9px; letter-spacing: 0.14em; text-transform: uppercase; color: var(--on-surface-mute); text-decoration: underline; cursor: pointer; }
.trip-banner strong { font-weight: 600; }
.trip-banner .material-symbols-rounded { font-size: 16px; }
.smart-card { background: linear-gradient(165deg, rgba(102,126,234,0.10), rgba(255,255,255,0.01) 60%), var(--surface); border: 1px solid rgba(102,126,234,0.18); border-radius: 24px; padding: 18px 18px 14px; position: relative; overflow: hidden; }
.smart-card::after { content: ""; position: absolute; top: -60px; right: -40px; width: 200px; height: 200px; background: radial-gradient(circle, rgba(182,108,255,0.10), transparent 70%); pointer-events: none; }
.smart-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; }
.smart-title { display: flex; align-items: center; gap: 8px; font-size: 13px; font-weight: 600; }
.smart-title .icon { width: 22px; height: 22px; border-radius: 7px; background: var(--m-grad); display: flex; align-items: center; justify-content: center; }
.smart-title .icon .material-symbols-rounded { font-size: 14px; color: #1a103a; font-variation-settings: 'FILL' 1, 'wght' 700; }
.smart-meta { font-family: 'JetBrains Mono', monospace; font-size: 9px; letter-spacing: 0.16em; text-transform: uppercase; color: var(--m-1); background: rgba(139,158,255,0.10); padding: 3px 7px; border-radius: 5px; border: 1px solid rgba(139,158,255,0.2); }
.smart-textarea { background: rgba(0,0,0,0.18); border: 1px solid var(--line); border-radius: 14px; padding: 12px 14px; font-family: 'Inter Tight'; font-size: 14px; line-height: 1.55; color: var(--on-surface); width: 100%; resize: none; outline: none; min-height: 120px; }
.smart-textarea::placeholder { color: var(--on-surface-faint); }
.smart-textarea:focus { border-color: rgba(139,158,255,0.4); box-shadow: 0 0 0 3px rgba(139,158,255,0.08); }
.parse-preview { margin-top: 14px; border-top: 1px dashed var(--line-strong); padding-top: 14px; }
.parse-preview .ph { display: flex; align-items: center; gap: 8px; font-family: 'JetBrains Mono', monospace; font-size: 9.5px; letter-spacing: 0.14em; text-transform: uppercase; color: var(--on-surface-mute); margin-bottom: 10px; }
.parse-preview .ph .pulse { width: 6px; height: 6px; border-radius: 50%; background: var(--m-1); animation: si-pulse 1.4s infinite ease-out; }
@keyframes si-pulse { 0% { box-shadow: 0 0 0 0 rgba(139,158,255,0.6); } 70% { box-shadow: 0 0 0 8px rgba(139,158,255,0); } 100% { box-shadow: 0 0 0 0 rgba(139,158,255,0); } }
.parse-row { display: grid; grid-template-columns: 60px 1fr auto; gap: 10px; align-items: center; padding: 10px 12px; border-radius: 12px; background: rgba(255,255,255,0.025); border: 1px solid var(--line); margin-bottom: 6px; }
.parse-row .amt { font-family: 'Fraunces', serif; font-size: 18px; font-weight: 500; }
.parse-row .desc { font-size: 12.5px; }
.parse-row .desc .when { display: block; font-size: 10px; color: var(--on-surface-mute); margin-top: 2px; font-family: 'JetBrains Mono', monospace; letter-spacing: 0.04em; }
.parse-row .cat-pill { font-size: 10.5px; font-weight: 600; padding: 4px 9px; border-radius: 7px; }
.parse-row .cat-pill.food { color: var(--cat-food); background: rgba(255,156,102,0.10); border: 1px solid rgba(255,156,102,0.22); }
.parse-row .cat-pill.coffee { color: var(--cat-coffee); background: rgba(255,209,102,0.10); border: 1px solid rgba(255,209,102,0.22); }
.parse-row .cat-pill.transit { color: var(--cat-transit); background: rgba(102,217,255,0.10); border: 1px solid rgba(102,217,255,0.22); }
.parse-row .cat-pill.shop { color: var(--cat-shop); background: rgba(126,231,193,0.10); border: 1px solid rgba(126,231,193,0.22); }
.parse-row .cat-pill.fun { color: var(--cat-fun); background: rgba(200,158,255,0.10); border: 1px solid rgba(200,158,255,0.22); }
.parse-row .cat-pill.bills { color: var(--cat-bills); background: rgba(176,182,200,0.10); border: 1px solid rgba(176,182,200,0.22); }
.parse-row .cat-pill.other { color: var(--cat-other); background: rgba(139,143,163,0.10); border: 1px solid rgba(139,143,163,0.22); }
.parse-row.unparsed { background: rgba(255,184,77,0.04); border: 1px dashed rgba(255,184,77,0.3); }
.parse-row.unparsed .amt { color: var(--warn); font-family: 'JetBrains Mono', monospace; font-size: 12px; font-weight: 500; }
.parse-row.unparsed .desc { color: var(--warn); }
.smart-actions { display: flex; gap: 10px; margin-top: 14px; }
.smart-actions .ghost { padding: 12px 14px; border-radius: 14px; background: transparent; border: 1px solid var(--line-strong); color: var(--on-surface-mute); font-size: 13px; font-weight: 500; display: flex; align-items: center; gap: 6px; }
.smart-actions .primary { flex: 1; padding: 12px 14px; border-radius: 14px; background: var(--m-grad); color: #1a103a; font-size: 14px; font-weight: 600; border: 0; display: flex; align-items: center; justify-content: center; gap: 6px; box-shadow: 0 6px 24px rgba(102,126,234,0.25); }
.smart-actions .primary[disabled] { opacity: 0.5; }
.smart-examples { margin-top: 12px; display: flex; gap: 6px; flex-wrap: wrap; }
.smart-examples .ex { font-family: 'JetBrains Mono', monospace; font-size: 10.5px; color: var(--on-surface-mute); padding: 4px 8px; border-radius: 6px; background: rgba(255,255,255,0.03); border: 1px solid var(--line); cursor: pointer; }
.or-toggle { display: flex; align-items: center; gap: 10px; margin: 4px 4px; }
.or-toggle .line { flex: 1; height: 1px; background: var(--line-strong); }
.or-toggle button { display: inline-flex; align-items: center; gap: 6px; padding: 6px 12px; border-radius: 999px; background: rgba(255,255,255,0.03); border: 1px solid var(--line-strong); color: var(--on-surface-mute); font-family: 'JetBrains Mono', monospace; font-size: 10px; letter-spacing: 0.14em; text-transform: uppercase; cursor: pointer; }
.or-toggle button.expanded { color: var(--m-1); border-color: rgba(139,158,255,0.3); background: rgba(139,158,255,0.06); }
.manual-card { background: var(--surface); border: 1px solid var(--line); border-radius: 24px; padding: 20px; }
.manual-row { margin-bottom: 16px; }
.manual-row:last-of-type { margin-bottom: 0; }
.manual-label { display: block; font-family: 'JetBrains Mono', monospace; font-size: 9.5px; text-transform: uppercase; letter-spacing: 0.16em; color: var(--on-surface-mute); margin-bottom: 8px; }
.amount-field { display: flex; align-items: baseline; gap: 4px; padding: 14px 18px; background: rgba(255,255,255,0.03); border: 1px solid var(--line-strong); border-radius: 16px; }
.amount-field .currency { font-family: 'Fraunces', serif; font-size: 24px; font-weight: 400; color: var(--on-surface-mute); }
.amount-field input { flex: 1; background: transparent; border: 0; outline: 0; font-family: 'Fraunces', serif; font-weight: 500; font-size: 38px; color: var(--on-surface); letter-spacing: -0.02em; width: 100%; caret-color: var(--m-1); }
.amount-field input::placeholder { color: var(--on-surface-faint); }
.text-field { width: 100%; padding: 13px 16px; background: rgba(255,255,255,0.03); border: 1px solid var(--line-strong); border-radius: 14px; color: var(--on-surface); font-family: 'Inter Tight'; font-size: 14px; outline: none; }
.date-chips { display: flex; gap: 6px; flex-wrap: wrap; }
.chip { padding: 8px 14px; border-radius: 999px; background: rgba(255,255,255,0.03); border: 1px solid var(--line-strong); color: var(--on-surface); font-size: 12.5px; font-weight: 500; display: inline-flex; align-items: center; gap: 6px; cursor: pointer; }
.chip.active { background: rgba(139,158,255,0.12); color: var(--m-1); border-color: rgba(139,158,255,0.4); }
.chip-pick { width: 38px; height: 38px; border-radius: 50%; display: flex; align-items: center; justify-content: center; background: rgba(255,255,255,0.03); border: 1px solid var(--line-strong); color: var(--on-surface-mute); position: relative; cursor: pointer; }
.chip-pick input { position: absolute; inset: 0; opacity: 0; cursor: pointer; }
.cat-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; }
.cat-tile { display: flex; flex-direction: column; align-items: center; gap: 6px; padding: 12px 6px 10px; border-radius: 14px; background: rgba(255,255,255,0.025); border: 1px solid var(--line); font-size: 11px; font-weight: 500; cursor: pointer; }
.cat-tile .glyph { width: 36px; height: 36px; border-radius: 11px; display: flex; align-items: center; justify-content: center; }
.cat-tile .glyph .material-symbols-rounded { font-size: 20px; font-variation-settings: 'FILL' 1, 'wght' 500; }
.cat-tile.active { border-color: rgba(139,158,255,0.4); background: rgba(139,158,255,0.08); box-shadow: 0 0 0 3px rgba(139,158,255,0.06); }
.cat-tile.food .glyph { color: var(--cat-food); background: rgba(255,156,102,0.12); }
.cat-tile.coffee .glyph { color: var(--cat-coffee); background: rgba(255,209,102,0.12); }
.cat-tile.transit .glyph { color: var(--cat-transit); background: rgba(102,217,255,0.12); }
.cat-tile.shop .glyph { color: var(--cat-shop); background: rgba(126,231,193,0.12); }
.cat-tile.fun .glyph { color: var(--cat-fun); background: rgba(200,158,255,0.12); }
.cat-tile.bills .glyph { color: var(--cat-bills); background: rgba(176,182,200,0.12); }
.cat-tile.other .glyph { color: var(--cat-other); background: rgba(139,143,163,0.12); }
.submit-fab { width: 100%; padding: 16px; border-radius: 18px; background: var(--m-grad); color: #1a103a; font-weight: 600; font-size: 15px; border: 0; display: flex; align-items: center; justify-content: center; gap: 8px; box-shadow: 0 8px 30px rgba(102,126,234,0.25); cursor: pointer; }
.submit-fab.trip { background: var(--trip-grad); color: #001b1f; }
```

- [ ] **Step 2: Commit**

```bash
git add styles/main.css
git commit -m "Add expense: append CSS classes (mock 1:1)"
```

---

### Task C.2: Render add-expense page (smart card + manual collapsed)

**Files:** Modify `script.js` to add `renderAddExpensePage` and supporting prototype methods.

- [ ] **Step 1: Add renderer**

Append to `script.js`:

```javascript
ExpenseTracker.prototype.renderAddExpensePage = function () {
    const trip = window.tripsStore && window.tripsStore.getActiveTrip(this.getLocalDateString(new Date()));
    this._addPageState = this._addPageState || {};
    if (this._addPageState.untag === undefined) this._addPageState.untag = false;
    const tagging = trip && !this._addPageState.untag;

    this._renderAddTripBanner(trip, tagging);
    this._renderSmartCard();
    this._renderAddToggle();
    this._renderManualCard(tagging);
};

ExpenseTracker.prototype._renderAddTripBanner = function (trip, tagging) {
    const root = document.getElementById('add-trip-banner');
    if (!root) return;
    if (!trip) { root.classList.add('hidden'); root.innerHTML = ''; return; }
    root.classList.remove('hidden');
    const day = this._tripDayNumber(trip, this.getLocalDateString(new Date()));
    const totalDays = this._tripTotalDays(trip);
    if (tagging) {
        root.innerHTML = `<div class="trip-banner"><span class="material-symbols-rounded">flight</span> Auto-tagging to <strong>${this._escapeHtml(trip.name)}</strong> · day ${day} of ${totalDays} <span class="toggle" onclick="onToggleTripTag()">Untag</span></div>`;
    } else {
        root.innerHTML = `<div class="trip-banner muted"><span class="material-symbols-rounded">block</span> Saving as regular expenses <span class="toggle" onclick="onToggleTripTag()">Re-tag</span></div>`;
    }
};

window.onToggleTripTag = function () {
    if (!window.expenseTracker._addPageState) window.expenseTracker._addPageState = { untag: false };
    window.expenseTracker._addPageState.untag = !window.expenseTracker._addPageState.untag;
    window.expenseTracker.renderAddExpensePage();
};

ExpenseTracker.prototype._renderSmartCard = function () {
    const root = document.getElementById('add-smart-card');
    if (!root) return;
    root.innerHTML = `
<div class="smart-card">
    <div class="smart-head">
        <div class="smart-title"><div class="icon"><span class="material-symbols-rounded">bolt</span></div> Type it naturally</div>
        <div class="smart-meta">SMART · GEMINI</div>
    </div>
    <textarea id="smart-input" class="smart-textarea" rows="4" placeholder="One per line — example:&#10;&#10;14 joes pizza&#10;subway 8&#10;moma 30 yesterday"></textarea>
    <div id="smart-parse-preview" class="parse-preview hidden"></div>
    <div class="smart-actions">
        <button class="ghost" id="smart-clear-btn" onclick="onSmartClear()"><span class="material-symbols-rounded">backspace</span> Clear</button>
        <button class="primary" id="parse-smart-input"><span class="material-symbols-rounded">check</span> <span id="smart-cta-label">Add expenses</span></button>
    </div>
    <div class="smart-examples">
        <span class="ex" style="color:var(--on-surface-faint)">examples →</span>
        <span class="ex" onclick="onSmartExampleTap('14 chipotle')">14 chipotle</span>
        <span class="ex" onclick="onSmartExampleTap('uber 23')">uber 23</span>
        <span class="ex" onclick="onSmartExampleTap('75 amazon 5/12')">75 amazon 5/12</span>
    </div>
</div>`;
    if (window.smartInput && typeof window.smartInput.attachLivePreview === 'function') {
        window.smartInput.attachLivePreview();
    }
};

window.onSmartClear = function () {
    const ta = document.getElementById('smart-input');
    if (ta) { ta.value = ''; ta.dispatchEvent(new Event('input')); ta.focus(); }
};
window.onSmartExampleTap = function (txt) {
    const ta = document.getElementById('smart-input'); if (!ta) return;
    ta.value = (ta.value ? ta.value.trimEnd() + '\n' : '') + txt;
    ta.dispatchEvent(new Event('input'));
    ta.focus();
};

ExpenseTracker.prototype._renderAddToggle = function () {
    const root = document.getElementById('add-toggle');
    if (!root) return;
    const expanded = this._addPageState && this._addPageState.manualOpen;
    root.innerHTML = `
<div class="or-toggle">
    <div class="line"></div>
    <button class="${expanded ? 'expanded' : ''}" onclick="onToggleManualForm()"><span class="material-symbols-rounded">${expanded ? 'expand_less' : 'tune'}</span> ${expanded ? 'Hide fields' : 'Use fields'}</button>
    <div class="line"></div>
</div>`;
};

window.onToggleManualForm = function () {
    const t = window.expenseTracker;
    t._addPageState = t._addPageState || {};
    t._addPageState.manualOpen = !t._addPageState.manualOpen;
    t._renderAddToggle();
    const card = document.getElementById('add-manual-card');
    if (card) card.classList.toggle('hidden', !t._addPageState.manualOpen);
    if (t._addPageState.manualOpen) t._renderManualCard(t._addPageState.tagging || false);
};

ExpenseTracker.prototype._renderManualCard = function (tagging) {
    const root = document.getElementById('add-manual-card');
    if (!root) return;
    if (!this._addPageState.manualOpen) { root.classList.add('hidden'); return; }
    root.classList.remove('hidden');
    const today = this.getLocalDateString(new Date());
    const yest = (() => { const d = new Date(); d.setDate(d.getDate() - 1); return this.getLocalDateString(d); })();
    const named = (offset) => { const d = new Date(); d.setDate(d.getDate() - offset); return { date: this.getLocalDateString(d), label: d.toLocaleDateString('en-US', { weekday: 'short' }) }; };
    const chips = [
        { date: today, label: 'Today', icon: 'today' },
        { date: yest, label: 'Yesterday' },
        named(2), named(3)
    ];
    const sel = this._addPageState.date || today;
    const chipHtml = chips.map(c => `<span class="chip ${c.date === sel ? 'active' : ''}" onclick="onPickAddDate('${c.date}')">${c.icon ? `<span class="material-symbols-rounded">${c.icon}</span>` : ''}${c.label}</span>`).join('');
    const cats = [
        ['Food', 'food', 'restaurant'], ['Coffee', 'coffee', 'local_cafe'], ['Transit', 'transit', 'directions_subway'],
        ['Shopping', 'shop', 'shopping_bag'], ['Entertainment', 'fun', 'movie'], ['Bills', 'bills', 'receipt'], ['Other', 'other', 'more_horiz']
    ];
    const selCat = this._addPageState.category || '';
    const catHtml = cats.map(([name, cls, icon]) => `<div class="cat-tile ${cls} ${selCat === name ? 'active' : ''}" onclick="onPickAddCategory('${name}')"><div class="glyph"><span class="material-symbols-rounded">${icon}</span></div>${name === 'Entertainment' ? 'Fun' : name === 'Shopping' ? 'Shop' : name}</div>`).join('');
    const submitText = tagging ? 'Add to trip' : 'Add expense';
    const submitCls = tagging ? 'submit-fab trip' : 'submit-fab';
    root.innerHTML = `
<div class="manual-card">
    <div class="manual-row"><label class="manual-label">Amount</label><div class="amount-field"><span class="currency">$</span><input type="number" id="manual-amount" step="0.01" placeholder="0" inputmode="decimal"></div></div>
    <div class="manual-row"><label class="manual-label">Description</label><input id="manual-desc" type="text" class="text-field" placeholder="What did you spend on?"></div>
    <div class="manual-row"><label class="manual-label">When</label><div class="date-chips">${chipHtml}<label class="chip-pick"><span class="material-symbols-rounded">calendar_month</span><input type="date" id="manual-date-picker" value="${sel}" onchange="onPickAddDate(this.value)"></label></div></div>
    <div class="manual-row"><label class="manual-label">Category</label><div class="cat-grid">${catHtml}</div></div>
    <button class="${submitCls}" onclick="onManualSubmit()"><span class="material-symbols-rounded">add</span> ${submitText}</button>
</div>`;
};

window.onPickAddDate = function (date) {
    window.expenseTracker._addPageState.date = date;
    window.expenseTracker._renderManualCard(window.expenseTracker._addPageState.tagging || false);
};
window.onPickAddCategory = function (cat) {
    window.expenseTracker._addPageState.category = cat;
    const tagging = !!(window.tripsStore && window.tripsStore.getActiveTrip(window.expenseTracker.getLocalDateString(new Date())) && !window.expenseTracker._addPageState.untag);
    window.expenseTracker._renderManualCard(tagging);
};
window.onManualSubmit = async function () {
    const t = window.expenseTracker;
    const amount = parseFloat(document.getElementById('manual-amount').value);
    const description = document.getElementById('manual-desc').value.trim();
    const category = t._addPageState.category;
    const date = t._addPageState.date || t.getLocalDateString(new Date());
    if (!amount || !description || !category) { alert('Amount, description, and category are required.'); return; }
    const activeTrip = window.tripsStore && window.tripsStore.getActiveTrip(t.getLocalDateString(new Date()));
    const tripId = (activeTrip && !t._addPageState.untag) ? activeTrip.id : null;
    const expense = { id: Date.now(), amount, description, category, date, timestamp: Date.now(), excludeFromBudget: false, tripId };
    t.expenses.push(expense);
    t.saveExpenses();
    if (window.currentUser) await t.saveExpenseToFirebase(expense);
    t._addPageState.category = '';
    document.getElementById('manual-amount').value = '';
    document.getElementById('manual-desc').value = '';
    if (window.gamification) { window.gamification.addXP(5, 'expense-logged'); window.gamification.updateStreak(); }
    showNotification('Expense added!', 'success');
    t.updateDashboard();
    t.renderTransactions();
    t.showPage(tripId ? 'trip-dashboard' : 'dashboard');
};
```

- [ ] **Step 2: Wire `showPage('add-expense')` to call this renderer**

Already wired in Phase 0 Task 0.5 via the `if (pageId === 'add-expense' && typeof renderAddExpensePage === 'function')`. Add this global wrapper at the bottom of `script.js`:

```javascript
window.renderAddExpensePage = function () { if (window.expenseTracker) window.expenseTracker.renderAddExpensePage(); };
```

- [ ] **Step 3: Verify**

`npm run dev`, tap `+ Add` on home → page shows: head, smart-card, "Use fields" toggle. Tap toggle → manual card expands with amount/desc/date-chips/category-tiles. Submit a manual expense → dashboard refreshes.

- [ ] **Step 4: Commit**

```bash
git add script.js
git commit -m "Add expense: render redesigned page (smart + manual collapsed)"
```

---

### Task C.3: Live parse preview in `js/smart-input.js`

**Files:** Modify `js/smart-input.js`.

- [ ] **Step 1: Add live preview methods to SmartTransactionInput**

Inside the class definition (or as prototype additions), add:

```javascript
    attachLivePreview() {
        const ta = document.getElementById('smart-input');
        const preview = document.getElementById('smart-parse-preview');
        const ctaLabel = document.getElementById('smart-cta-label');
        const submitBtn = document.getElementById('parse-smart-input');
        if (!ta || !preview) return;
        let timer = null;
        const render = () => {
            const text = ta.value;
            if (!text.trim()) {
                preview.classList.add('hidden');
                if (ctaLabel) ctaLabel.textContent = 'Add expenses';
                if (submitBtn) submitBtn.disabled = true;
                return;
            }
            preview.classList.remove('hidden');
            // Use existing regex parser; never call Gemini for live preview.
            const parsed = window.llmParser.fallbackParseMultiple(text);
            const lines = text.split('\n').map(s => s.trim()).filter(Boolean);
            const ok = parsed.filter(p => p.amount && p.amount > 0);
            const failed = lines.length - ok.length;
            const rows = parsed.map(p => {
                if (!p.amount || p.amount <= 0) {
                    return `<div class="parse-row unparsed"><span class="amt">?</span><span class="desc">"${p.description}" — couldn't parse</span><span style="color:var(--warn);font-size:18px">!</span></div>`;
                }
                const cls = (p.category || 'other').toLowerCase().replace(/transportation/, 'transit').replace(/shopping/, 'shop').replace(/entertainment/, 'fun');
                const todayStr = new Date().toISOString().slice(0, 10);
                const yest = (() => { const d = new Date(); d.setDate(d.getDate() - 1); return d.toISOString().slice(0, 10); })();
                const whenLabel = p.date === todayStr ? 'TODAY' : p.date === yest ? 'YESTERDAY' : new Date(p.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }).toUpperCase();
                return `<div class="parse-row"><span class="amt">$${p.amount}</span><span class="desc">${p.description}<span class="when">${whenLabel}</span></span><span class="cat-pill ${cls}">${p.category}</span></div>`;
            }).join('');
            preview.innerHTML = `<div class="ph"><span class="pulse"></span> Parsed live · ${ok.length} of ${lines.length}</div>${rows}`;
            if (ctaLabel) ctaLabel.textContent = ok.length === 0 ? 'Add expenses' : `Add ${ok.length} expense${ok.length === 1 ? '' : 's'}`;
            if (submitBtn) submitBtn.disabled = ok.length === 0;
        };
        ta.addEventListener('input', () => {
            clearTimeout(timer);
            timer = setTimeout(render, 300);
        });
        // Re-attach submit (renderAddExpensePage replaced the button)
        if (submitBtn && !submitBtn.dataset.bound) {
            submitBtn.dataset.bound = '1';
            submitBtn.addEventListener('click', async () => {
                await this.parseAndAddMultiple(ta.value);
            });
        }
        render();
    }
```

- [ ] **Step 2: Verify**

On Add Expense, type `12 mendocino farms\n4.50 dutch bros\nsubway 8 yesterday`. Preview shows three rows with $-amounts, merchant, when label, category pill. CTA label updates to "Add 3 expenses". Submit creates 3 expenses.

- [ ] **Step 3: Commit**

```bash
git add js/smart-input.js
git commit -m "Smart input: add debounced live parse preview"
```

---

### Task C.4: Track C smoke

- [ ] **Step 1: Smoke**

- Trip banner appears only when an active trip exists. Untag/Re-tag toggles flip text + submit button.
- Smart input live-previews 3-line entry.
- Manual collapse + expand works.
- Submitted expense correctly carries `tripId` when banner is in tagging state, `null` otherwise.
- Verify in console: `window.expenseTracker.expenses.find(e => e.tripId)` finds the tagged record.

- [ ] **Step 2: Tag**

```bash
git tag track-c-complete
```

---

## Track D — History redesign

**Owner files:** `script.js` (history renderer prototype methods + `renderHistoryPage` global), `js/merchant-frequency.js` (new), `styles/main.css` (append history styles), `index.html` `#history-page` block only.

**Spec sections covered:** §7.1 (Section flow), §7.2 (Top regulars), §7.3 (removed sections — already removed by Phase 0 page rewrite).

---

### Task D.1: Append history CSS

**Files:** Modify `styles/main.css`.

- [ ] **Step 1: Append**

```css
/* ===== History ===== */
.history-page .page-title { font-family: 'Fraunces', serif; font-size: 28px; font-weight: 500; letter-spacing: -0.02em; }
.history-page .page-meta { font-size: 10px; letter-spacing: 0.16em; text-transform: uppercase; color: var(--on-surface-mute); }
.year-selector { display: flex; align-items: center; justify-content: center; gap: 14px; padding: 4px 0; }
.year-selector button { width: 28px; height: 28px; border-radius: 50%; border: 1px solid var(--line); background: rgba(255,255,255,0.03); color: var(--on-surface-mute); display: flex; align-items: center; justify-content: center; cursor: pointer; }
.year-selector button[disabled] { opacity: 0.3; cursor: default; }
.year-selector button .material-symbols-rounded { font-size: 16px; }
.year-name { font-family: 'Fraunces', serif; font-size: 22px; font-weight: 500; }
.year-stats { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.stat-card { position: relative; padding: 18px; border-radius: 22px; background: var(--surface); border: 1px solid var(--line); overflow: hidden; }
.stat-card.spent { background: linear-gradient(160deg, rgba(102,126,234,0.10), rgba(255,255,255,0) 60%), var(--surface); border-color: rgba(102,126,234,0.18); }
.stat-card.saved { background: linear-gradient(160deg, rgba(67,233,123,0.10), rgba(255,255,255,0) 60%), var(--surface); border-color: rgba(67,233,123,0.18); }
.stat-card .lbl { font-family: 'JetBrains Mono', monospace; font-size: 9px; letter-spacing: 0.18em; text-transform: uppercase; color: var(--on-surface-mute); }
.stat-card .num { font-family: 'Fraunces', serif; font-size: 30px; font-weight: 500; letter-spacing: -0.025em; margin-top: 6px; line-height: 1; }
.stat-card .num .currency { font-family: 'Inter Tight', sans-serif; font-size: 16px; color: var(--on-surface-mute); vertical-align: 0.4em; margin-right: 2px; font-weight: 400; }
.stat-card.spent .num { background: linear-gradient(180deg, #ffffff, #d2c4ff); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
.stat-card.saved .num { background: linear-gradient(180deg, #ffffff, #b8f0d2); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
.stat-card .sub { font-family: 'JetBrains Mono', monospace; font-size: 10.5px; color: var(--on-surface-mute); margin-top: 8px; }
.stat-card .rate { position: absolute; top: 18px; right: 18px; font-family: 'JetBrains Mono', monospace; font-size: 10px; font-weight: 600; color: var(--saved); background: rgba(67,233,123,0.10); padding: 3px 8px; border-radius: 6px; }
.year-shape { background: var(--surface); border: 1px solid var(--line); border-radius: 22px; padding: 18px 18px 14px; }
.shape-head { display: flex; align-items: baseline; justify-content: space-between; margin-bottom: 14px; }
.shape-title { font-family: 'Fraunces', serif; font-size: 16px; font-weight: 500; }
.shape-meta { font-family: 'JetBrains Mono', monospace; font-size: 10px; color: var(--on-surface-mute); text-transform: uppercase; }
.shape-bars { display: grid; grid-template-columns: repeat(12, 1fr); gap: 6px; align-items: end; height: 100px; margin-bottom: 6px; }
.shape-col { height: 100%; display: flex; flex-direction: column; justify-content: end; position: relative; cursor: pointer; }
.shape-bar { border-radius: 4px 4px 1px 1px; background: linear-gradient(180deg, var(--m-1), #6655c8); position: relative; min-height: 3px; }
.shape-bar.empty { background: rgba(255,255,255,0.04); border: 1px dashed var(--line-strong); border-bottom: 0; }
.shape-col.selected .shape-bar { background: var(--m-grad); box-shadow: 0 0 14px rgba(139,158,255,0.45); }
.shape-col .trip-cap { position: absolute; left: 0; right: 0; height: 3px; background: var(--trip-grad); border-radius: 2px; bottom: var(--trip-bottom, 0); pointer-events: none; }
.shape-labels { display: grid; grid-template-columns: repeat(12, 1fr); gap: 6px; margin-top: 8px; }
.shape-labels span { text-align: center; font-family: 'JetBrains Mono', monospace; font-size: 9px; color: var(--on-surface-faint); }
.shape-labels span.selected { color: var(--m-1); font-weight: 600; }
.shape-foot { display: flex; justify-content: space-between; font-family: 'JetBrains Mono', monospace; font-size: 10px; color: var(--on-surface-mute); margin-top: 14px; padding-top: 14px; border-top: 1px solid var(--line); }
.shape-foot .item { display: flex; flex-direction: column; gap: 2px; }
.shape-foot .item .v { color: var(--on-surface); font-weight: 500; }
.month-rail { margin: 0 -16px; padding: 4px 16px 8px; overflow-x: auto; white-space: nowrap; scrollbar-width: none; }
.month-rail::-webkit-scrollbar { display: none; }
.month-rail .pill { display: inline-flex; flex-direction: column; align-items: center; gap: 2px; padding: 8px 14px; margin-right: 6px; border-radius: 14px; background: rgba(255,255,255,0.03); border: 1px solid var(--line); cursor: pointer; min-width: 60px; }
.month-rail .pill .m { font-family: 'JetBrains Mono', monospace; font-size: 11px; font-weight: 600; }
.month-rail .pill .v { font-family: 'JetBrains Mono', monospace; font-size: 9.5px; color: var(--on-surface-faint); }
.month-rail .pill.empty { opacity: 0.5; }
.month-rail .pill.active { background: rgba(139,158,255,0.12); border-color: rgba(139,158,255,0.4); box-shadow: 0 0 0 3px rgba(139,158,255,0.06); }
.month-rail .pill.active .m, .month-rail .pill.active .v { color: var(--m-1); }
.month-detail { background: var(--surface); border: 1px solid var(--line); border-radius: 22px; padding: 22px; position: relative; overflow: hidden; }
.month-detail::before { content: ""; position: absolute; top: -60px; right: -60px; width: 200px; height: 200px; background: radial-gradient(circle, rgba(102,126,234,0.10), transparent 70%); pointer-events: none; }
.md-eyebrow { font-family: 'JetBrains Mono', monospace; font-size: 10px; letter-spacing: 0.18em; text-transform: uppercase; color: var(--m-1); }
.md-name { font-family: 'Fraunces', serif; font-size: 32px; font-weight: 500; letter-spacing: -0.02em; margin-top: 6px; background: linear-gradient(180deg, #ffffff, #d2c4ff); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
.md-name .yr { font-family: 'Inter Tight'; font-size: 16px; font-weight: 400; -webkit-text-fill-color: var(--on-surface-mute); margin-left: 6px; }
.md-numbers { margin-top: 20px; display: grid; grid-template-columns: 1fr auto; align-items: baseline; }
.md-total { font-family: 'Fraunces', serif; font-size: 50px; font-weight: 500; letter-spacing: -0.03em; line-height: 1; }
.md-total .currency { font-family: 'Inter Tight'; font-size: 24px; color: var(--on-surface-mute); vertical-align: 0.36em; margin-right: 2px; font-weight: 400; }
.md-vs { text-align: right; font-family: 'JetBrains Mono', monospace; font-size: 11px; color: var(--on-surface-mute); }
.md-vs strong { color: var(--on-surface); font-weight: 600; display: block; }
.md-breakdown { margin-top: 12px; display: flex; flex-direction: column; gap: 4px; padding-top: 14px; border-top: 1px solid var(--line); }
.md-breakdown .row { display: flex; align-items: center; gap: 8px; font-family: 'JetBrains Mono', monospace; font-size: 11.5px; }
.md-breakdown .row .swatch { width: 6px; height: 6px; border-radius: 50%; }
.md-breakdown .row .name { color: var(--on-surface-mute); flex: 1; }
.md-breakdown .row .amt { color: var(--on-surface); }
.cat-card.history { background: var(--surface); border: 1px solid var(--line); border-radius: 22px; padding: 18px 20px 8px; display: block; }
.cat-card.history .cat-head { display: flex; align-items: baseline; justify-content: space-between; margin-bottom: 12px; }
.cat-card.history .cat-head .title { font-family: 'Fraunces', serif; font-size: 16px; font-weight: 500; }
.cat-card.history .cat-head .meta { font-family: 'JetBrains Mono', monospace; font-size: 10px; color: var(--on-surface-mute); }
.cat-card.history .h-row { display: grid; grid-template-columns: 110px 1fr auto; gap: 12px; align-items: center; padding: 10px 0; border-bottom: 1px dashed rgba(255,255,255,0.03); }
.cat-card.history .h-row:last-child { border-bottom: 0; }
.cat-card.history .h-name { display: flex; gap: 8px; align-items: center; font-size: 12.5px; }
.cat-card.history .h-name .dot { width: 8px; height: 8px; border-radius: 50%; }
.cat-card.history .h-bar { height: 7px; border-radius: 999px; background: rgba(255,255,255,0.04); overflow: hidden; }
.cat-card.history .h-bar > span { display: block; height: 100%; border-radius: 999px; }
.cat-card.history .h-amt { font-family: 'JetBrains Mono', monospace; font-size: 12px; }
.cat-card.history .h-amt .pct { color: var(--on-surface-mute); margin-left: 6px; font-size: 11px; }

.regulars-card { background: var(--surface); border: 1px solid var(--line); border-radius: 22px; padding: 18px 20px; display: flex; flex-direction: column; gap: 8px; }
.regulars-card .head { display: flex; align-items: baseline; justify-content: space-between; }
.regulars-card .head .title { font-family: 'Fraunces', serif; font-size: 16px; font-weight: 500; }
.regulars-card .head .meta { font-family: 'JetBrains Mono', monospace; font-size: 10px; color: var(--on-surface-mute); text-transform: uppercase; letter-spacing: 0.06em; }
.regulars-card .row { display: grid; grid-template-columns: 24px 1fr auto auto; gap: 10px; align-items: center; padding: 8px 0; border-bottom: 1px dashed rgba(255,255,255,0.04); }
.regulars-card .row:last-child { border-bottom: 0; }
.regulars-card .row .ic { font-family: 'JetBrains Mono', monospace; color: var(--on-surface-mute); font-size: 14px; }
.regulars-card .row .nm { font-size: 13px; }
.regulars-card .row .ct { font-family: 'JetBrains Mono', monospace; font-size: 11px; color: var(--on-surface-mute); }
.regulars-card .row .amt { font-family: 'JetBrains Mono', monospace; font-size: 12px; }
.regulars-card .more { font-family: 'JetBrains Mono', monospace; font-size: 10px; color: var(--m-1); cursor: pointer; padding-top: 6px; text-align: center; }
```

- [ ] **Step 2: Commit**

```bash
git add styles/main.css
git commit -m "History: append CSS classes (mock 1:1)"
```

---

### Task D.2: Create `js/merchant-frequency.js`

**Files:**
- Create: `js/merchant-frequency.js`
- Modify: `index.html` (script tag after `js/forecast.js`)

- [ ] **Step 1: Write `js/merchant-frequency.js`**

```javascript
/**
 * Merchant frequency aggregation. Spec §7.2.
 * Sorted by visit count desc by default. Normalizes merchant names by
 * stripping common payment-processor prefixes ('TST*', 'SQ *', 'TST* ', 'PAYPAL *')
 * and lowercasing for the dedupe key, but keeping the title-case original for display.
 */
(function () {
    function normalizeKey(s) {
        return String(s || '')
            .replace(/^TST\*\s*/i, '')
            .replace(/^SQ\s*\*\s*/i, '')
            .replace(/^PAYPAL\s*\*\s*/i, '')
            .replace(/[#]\d+\s*$/, '')
            .replace(/\s+/g, ' ')
            .trim()
            .toLowerCase();
    }
    function titleCase(s) {
        return String(s || '').toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
    }
    function aggregate(expenses, year) {
        const map = new Map();
        for (const e of expenses) {
            if (!e.description) continue;
            if (year != null && !String(e.date).startsWith(String(year))) continue;
            const key = normalizeKey(e.description);
            if (!key) continue;
            if (!map.has(key)) map.set(key, { name: titleCase(key), key, visits: 0, total: 0, sample: e.description, category: e.category });
            const r = map.get(key);
            r.visits += 1;
            r.total += Number(e.amount || 0);
        }
        return [...map.values()].sort((a, b) => b.visits - a.visits || b.total - a.total);
    }
    window.MerchantFrequency = { aggregate, normalizeKey };
})();
```

- [ ] **Step 2: Wire script tag**

In `index.html`, after `<script src="js/trip-dashboard.js"></script>`, add `<script src="js/merchant-frequency.js"></script>`.

- [ ] **Step 3: Verify**

In console: `window.MerchantFrequency.aggregate([{description:'TST* Mendocino', amount:12, date:'2026-05-01'},{description:'mendocino farms', amount:18, date:'2026-05-02'}], 2026)` returns `[{ name: 'Mendocino', visits: 2, total: 30, ... }]`.

- [ ] **Step 4: Commit**

```bash
git add js/merchant-frequency.js index.html
git commit -m "History: add merchant-frequency aggregator"
```

---

### Task D.3: `renderHistoryPage` orchestrator + state

**Files:** Modify `script.js`.

- [ ] **Step 1: Add state + orchestrator**

```javascript
ExpenseTracker.prototype._historyState = null;
ExpenseTracker.prototype._initHistoryState = function () {
    if (!this._historyState) {
        const now = new Date();
        this._historyState = { year: now.getFullYear(), month: now.getMonth() };
    }
};
ExpenseTracker.prototype.renderHistoryPage = function () {
    this._initHistoryState();
    this.renderHistoryYearSelector();
    this.renderHistoryYearStats();
    this.renderHistoryYearShape();
    this.renderHistoryMonthRail();
    this.renderHistoryMonthDetail();
    this.renderHistoryCategories();
    this.renderHistoryTopRegulars();
    const meta = document.getElementById('history-page-meta');
    if (meta) meta.textContent = String(this._historyState.year);
};
window.renderHistoryPage = function () { if (window.expenseTracker) window.expenseTracker.renderHistoryPage(); };

window.onHistoryYearStep = function (delta) {
    const t = window.expenseTracker; if (!t) return;
    t._initHistoryState();
    const next = t._historyState.year + delta;
    if (next > new Date().getFullYear()) return;
    t._historyState.year = next;
    t._historyState.month = next === new Date().getFullYear() ? new Date().getMonth() : 0;
    t.renderHistoryPage();
};
window.onHistoryMonthSelect = function (month) {
    const t = window.expenseTracker; if (!t) return;
    t._historyState.month = month;
    t.renderHistoryMonthRail();
    t.renderHistoryMonthDetail();
    t.renderHistoryYearShape();
};
```

- [ ] **Step 2: Commit**

```bash
git add script.js
git commit -m "History: scaffolding for renderHistoryPage + state"
```

---

### Task D.4: Render year selector + year stat cards

**Files:** Modify `script.js`.

- [ ] **Step 1: Add renderers**

```javascript
ExpenseTracker.prototype.renderHistoryYearSelector = function () {
    const root = document.getElementById('history-year-selector');
    if (!root) return;
    const Y = this._historyState.year;
    const max = new Date().getFullYear();
    root.innerHTML = `
<div class="year-selector">
    <button onclick="onHistoryYearStep(-1)"><span class="material-symbols-rounded">chevron_left</span></button>
    <span class="year-name">${Y}</span>
    <button onclick="onHistoryYearStep(1)" ${Y >= max ? 'disabled' : ''}><span class="material-symbols-rounded">chevron_right</span></button>
</div>`;
};

ExpenseTracker.prototype.renderHistoryYearStats = function () {
    const root = document.getElementById('history-year-stats');
    if (!root) return;
    const Y = this._historyState.year;
    const all = this.expenses.filter(e => this.parseLocalDate(e.date).getFullYear() === Y);
    const totalSpent = all.reduce((s, e) => s + Number(e.amount || 0), 0);
    const monthsActive = new Set(all.map(e => this.parseLocalDate(e.date).getMonth())).size;
    const avgPerMo = monthsActive > 0 ? Math.round(totalSpent / monthsActive) : 0;
    const income = (this.getYearIncome ? this.getYearIncome(Y) : 0) || 0;
    const saved = income - totalSpent;
    const rate = income > 0 ? Math.max(0, Math.round((saved / income) * 100)) : 0;
    root.innerHTML = `
<div class="year-stats">
    <div class="stat-card spent">
        <div class="lbl">Spent · ${Y}</div>
        <div class="num"><span class="currency">$</span>${Math.round(totalSpent).toLocaleString()}</div>
        <div class="sub">$${avgPerMo.toLocaleString()}/mo avg · ${monthsActive} mo${monthsActive === 1 ? '' : 's'}</div>
    </div>
    <div class="stat-card saved">
        ${income > 0 ? `<div class="rate">${rate}%</div>` : ''}
        <div class="lbl">Saved · ${Y}</div>
        <div class="num"><span class="currency">$</span>${Math.round(Math.max(0, saved)).toLocaleString()}</div>
        <div class="sub">${income > 0 ? `income $${income.toLocaleString()}` : 'set income in Settings'}</div>
    </div>
</div>`;
};
```

- [ ] **Step 2: Add `getYearIncome` if it doesn't exist**

Search `script.js` for `getYearIncome`. If absent, add:

```javascript
ExpenseTracker.prototype.getYearIncome = function (year) {
    const monthly = (this.settings && this.settings.income) || 0;
    if (monthly <= 0) return 0;
    const now = new Date();
    if (year === now.getFullYear()) return monthly * (now.getMonth() + 1);
    if (year < now.getFullYear()) return monthly * 12;
    return 0;
};
```

(Spec §2 defines `Saved = income − all_expenses`. We use the user's stored monthly income; multiply by months elapsed for current year, 12 for completed past years.)

- [ ] **Step 3: Commit**

```bash
git add script.js
git commit -m "History: render year selector + Spent/Saved stat cards"
```

---

### Task D.5: Render year shape (12 bars + trip ticks)

**Files:** Modify `script.js`.

- [ ] **Step 1: Add `renderHistoryYearShape`**

```javascript
ExpenseTracker.prototype.renderHistoryYearShape = function () {
    const root = document.getElementById('history-year-shape');
    if (!root) return;
    const Y = this._historyState.year;
    const sel = this._historyState.month;
    const now = new Date();
    const totals = new Array(12).fill(0);
    const tripPart = new Array(12).fill(0);
    for (const e of this.expenses) {
        const d = this.parseLocalDate(e.date);
        if (d.getFullYear() !== Y) continue;
        const m = d.getMonth();
        totals[m] += Number(e.amount || 0);
        if (e.tripId != null) tripPart[m] += Number(e.amount || 0);
    }
    const max = Math.max(1, ...totals);
    const isFuture = m => Y > now.getFullYear() || (Y === now.getFullYear() && m > now.getMonth());

    const cols = totals.map((v, m) => {
        const future = isFuture(m);
        const h = future ? 14 : Math.max(6, (v / max) * 100);
        const tripPct = totals[m] > 0 ? (tripPart[m] / totals[m]) * h : 0;
        const trip = tripPart[m] > 0 ? `<div class="trip-cap" style="--trip-bottom:${h - tripPct}%;height:${Math.max(2, tripPct * 0.5)}%"></div>` : '';
        const cls = `shape-col ${m === sel ? 'selected' : ''}`;
        const barCls = future ? 'shape-bar empty' : 'shape-bar';
        return `<div class="${cls}" onclick="onHistoryMonthSelect(${m})"><div class="${barCls}" style="height:${h}%"></div>${trip}</div>`;
    }).join('');

    const labels = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC']
        .map((l, m) => `<span class="${m === sel ? 'selected' : ''}">${l}</span>`).join('');

    const past = totals.slice(0, Y < now.getFullYear() ? 12 : now.getMonth() + 1);
    const high = past.length ? Math.max(...past) : 0;
    const highIdx = past.indexOf(high);
    const low = past.length ? Math.min(...past.filter(v => v > 0)) : 0;
    const lowIdx = past.indexOf(low);
    const sumPast = past.reduce((s, v) => s + v, 0);
    const avg = past.length ? Math.round(sumPast / past.length) : 0;
    const monthName = i => ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'][i] || '';

    root.innerHTML = `
<div class="year-shape">
    <div class="shape-head"><div class="shape-title">Year shape</div><div class="shape-meta">12 months · spent</div></div>
    <div class="shape-bars">${cols}</div>
    <div class="shape-labels">${labels}</div>
    <div class="shape-foot">
        <div class="item"><span>HIGH</span><span class="v">$${Math.round(high)} ${highIdx >= 0 ? '· ' + monthName(highIdx) : ''}</span></div>
        <div class="item" style="text-align:center"><span>AVG</span><span class="v">$${avg}/mo</span></div>
        <div class="item" style="text-align:right"><span>LOW</span><span class="v">$${Math.round(low)} ${lowIdx >= 0 ? '· ' + monthName(lowIdx) : ''}</span></div>
    </div>
</div>`;
};
```

- [ ] **Step 2: Commit**

```bash
git add script.js
git commit -m "History: render year shape with trip ticks"
```

---

### Task D.6: Render month rail + selected month detail

**Files:** Modify `script.js`.

- [ ] **Step 1: Add renderers**

```javascript
ExpenseTracker.prototype.renderHistoryMonthRail = function () {
    const root = document.getElementById('history-month-rail');
    if (!root) return;
    const Y = this._historyState.year;
    const sel = this._historyState.month;
    const now = new Date();
    const totals = new Array(12).fill(0);
    for (const e of this.expenses) {
        const d = this.parseLocalDate(e.date);
        if (d.getFullYear() === Y) totals[d.getMonth()] += Number(e.amount || 0);
    }
    const labels = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
    const isFuture = m => Y > now.getFullYear() || (Y === now.getFullYear() && m > now.getMonth());
    const pills = labels.map((l, m) => {
        const empty = isFuture(m);
        const active = m === sel;
        const v = empty ? '—' : `$${Math.round(totals[m]).toLocaleString()}`;
        return `<div class="pill ${active ? 'active' : ''} ${empty ? 'empty' : ''}" onclick="onHistoryMonthSelect(${m})"><span class="m">${l}</span><span class="v">${v}</span></div>`;
    }).join('');
    root.innerHTML = `<div class="month-rail">${pills}</div>`;
};

ExpenseTracker.prototype.renderHistoryMonthDetail = function () {
    const root = document.getElementById('history-month-detail');
    if (!root) return;
    const Y = this._historyState.year;
    const M = this._historyState.month;
    const now = new Date();
    const monthName = new Date(Y, M, 1).toLocaleDateString('en-US', { month: 'long' });

    const monthAll = this.expenses.filter(e => {
        const d = this.parseLocalDate(e.date); return d.getFullYear() === Y && d.getMonth() === M;
    });
    const total = monthAll.reduce((s, e) => s + Number(e.amount || 0), 0);
    const regular = monthAll.filter(e => e.tripId == null).reduce((s, e) => s + Number(e.amount || 0), 0);
    const tripTotal = total - regular;
    const tripCount = new Set(monthAll.filter(e => e.tripId != null).map(e => e.tripId)).size;

    // vs prior month
    const prevY = M === 0 ? Y - 1 : Y;
    const prevM = M === 0 ? 11 : M - 1;
    const prevTotal = this.expenses
        .filter(e => { const d = this.parseLocalDate(e.date); return d.getFullYear() === prevY && d.getMonth() === prevM; })
        .reduce((s, e) => s + Number(e.amount || 0), 0);
    const prevName = new Date(prevY, prevM, 1).toLocaleDateString('en-US', { month: 'short' });
    let vsLine = '';
    if (prevTotal > 0) {
        const delta = total - prevTotal;
        const pct = Math.round(Math.abs(delta) / prevTotal * 100);
        vsLine = `<strong>${delta >= 0 ? '+' : '−'}$${Math.abs(Math.round(delta)).toLocaleString()} vs ${prevName}</strong><span style="opacity:.7">${delta >= 0 ? '↑' : '↓'} ${pct}% ${delta >= 0 ? 'higher' : 'lower'}</span>`;
    }

    let eyebrow;
    if (Y < now.getFullYear() || (Y === now.getFullYear() && M < now.getMonth())) eyebrow = 'COMPLETED';
    else if (Y === now.getFullYear() && M === now.getMonth()) eyebrow = `SELECTED · ${now.getDate()} days in`;
    else eyebrow = 'UPCOMING';

    root.innerHTML = `
<div class="month-detail">
    <div class="md-eyebrow">${eyebrow}</div>
    <div class="md-name">${monthName}<span class="yr">${Y}</span></div>
    <div class="md-numbers"><div class="md-total"><span class="currency">$</span>${Math.round(total).toLocaleString()}</div><div class="md-vs">${vsLine}</div></div>
    ${(regular > 0 || tripTotal > 0) ? `<div class="md-breakdown">
        <div class="row"><span class="swatch" style="background:var(--m-1)"></span><span class="name">Regular spending</span><span class="amt">$${Math.round(regular).toLocaleString()}</span></div>
        ${tripTotal > 0 ? `<div class="row"><span class="swatch" style="background:var(--trip-2)"></span><span class="name">Trips · ${tripCount}</span><span class="amt">$${Math.round(tripTotal).toLocaleString()}</span></div>` : ''}
    </div>` : ''}
</div>`;
};
```

- [ ] **Step 2: Commit**

```bash
git add script.js
git commit -m "History: render month rail + selected-month detail"
```

---

### Task D.7: Render "Where the year went" (categories) + Top regulars

**Files:** Modify `script.js`.

- [ ] **Step 1: Add renderers**

```javascript
ExpenseTracker.prototype.renderHistoryCategories = function () {
    const root = document.getElementById('history-categories');
    if (!root) return;
    const Y = this._historyState.year;
    const yearAll = this.expenses.filter(e => this.parseLocalDate(e.date).getFullYear() === Y);
    const totals = {};
    let grand = 0;
    for (const e of yearAll) {
        const key = e.tripId != null ? 'Trips' : (e.category || 'Other');
        totals[key] = (totals[key] || 0) + Number(e.amount || 0);
        grand += Number(e.amount || 0);
    }
    const ordered = Object.entries(totals).sort((a, b) => b[1] - a[1]);
    const color = name => name === 'Trips' ? '#00f2fe' : this._categoryColor(name);
    const rows = ordered.length === 0
        ? `<div style="text-align:center;padding:20px 0;color:var(--on-surface-mute);font-size:13px">No expenses for ${Y} yet.</div>`
        : ordered.map(([name, amt]) => {
            const pct = grand > 0 ? Math.round((amt / grand) * 100) : 0;
            return `<div class="h-row"><div class="h-name"><span class="dot" style="background:${color(name)}"></span>${this._escapeHtml(name)}</div><div class="h-bar"><span style="width:${pct}%;background:${color(name)}"></span></div><div class="h-amt">$${Math.round(amt).toLocaleString()}<span class="pct">${pct}%</span></div></div>`;
        }).join('');
    root.innerHTML = `<div class="cat-card history"><div class="cat-head"><div class="title">Where the year went</div><div class="meta">${Y} · all spend</div></div>${rows}</div>`;
};

ExpenseTracker.prototype.renderHistoryTopRegulars = function () {
    const root = document.getElementById('history-top-regulars');
    if (!root) return;
    if (!window.MerchantFrequency) { root.innerHTML = ''; return; }
    const Y = this._historyState.year;
    const list = window.MerchantFrequency.aggregate(this.expenses, Y);
    if (list.length === 0) { root.innerHTML = ''; return; }
    const top = list.slice(0, 8);
    const rows = top.map(r => `<div class="row"><span class="ic">·</span><span class="nm">${this._escapeHtml(r.name)}</span><span class="ct">${r.visits} visits</span><span class="amt">$${Math.round(r.total).toLocaleString()}</span></div>`).join('');
    const more = list.length > 8 ? `<div class="more">+ ${list.length - 8} more</div>` : '';
    root.innerHTML = `<div class="regulars-card"><div class="head"><div class="title">Top regulars</div><div class="meta">${Y} · by visits</div></div>${rows}${more}</div>`;
};
```

- [ ] **Step 2: Commit**

```bash
git add script.js
git commit -m "History: render Where-the-year-went categories + Top regulars"
```

---

### Task D.8: Track D smoke

- [ ] **Step 1: Smoke**

`npm run dev` → History tab. Year selector flips. Year stat cards show Spent + Saved. Year shape draws 12 bars (current year months past now, dashed for future). Tapping a month bar updates the rail + month detail. Trip ticks appear on months with trip expenses. Top regulars list shows after seeding a few duplicate descriptions.

- [ ] **Step 2: Tag**

```bash
git tag track-d-complete
```

---

## Track E — Notifications branching + Auto-add CTA polish

**Owner files:** `scripts/send-notifications.js`, `js/notifications.js`, optionally `script.js` for `onAutoAddTap`.

**Spec sections covered:** §5.7 (notification behavior during a trip), §10 (Auto add rename + relocation).

---

### Task E.1: Add trip-mode branch to `scripts/send-notifications.js`

**Files:** Modify `scripts/send-notifications.js`.

- [ ] **Step 1: Add `fetchActiveTrip` + `buildTripMessage`**

Inside `scripts/send-notifications.js`, add these two helpers before `processToken`:

```javascript
async function fetchActiveTrip(uid, today) {
    try {
        const snap = await db.collection('users').doc(uid).collection('trips').get();
        if (snap.empty) return null;
        for (const doc of snap.docs) {
            const t = doc.data();
            if (t.endedAt) continue;
            if (today > t.endDate) continue;
            if (t.startedAt) return t;
            if (today >= t.startDate && today <= t.endDate) return t;
        }
        return null;
    } catch (e) {
        console.error('fetchActiveTrip failed:', e.message);
        return null;
    }
}

async function fetchTripExpenses(uid, tripId) {
    const snap = await db.collection('users').doc(uid).collection('expenses')
        .where('tripId', '==', tripId).get();
    return snap.docs.map(d => d.data());
}

function buildTripMessage(slot, ctx) {
    // ctx: { trip, tripSpent, today, todayTotal, daysLeft, totalDays, dayNum }
    const remaining = Math.max(0, ctx.trip.budget - ctx.tripSpent);
    const idealRest = Math.max(1, ctx.totalDays - ctx.dayNum + 1);
    const aim = Math.round(remaining / idealRest);
    if (slot === SLOT_BUDGET_ROOM) {
        return {
            title: `→ $${aim} to spend on the trip today`,
            body: `Day ${ctx.dayNum} of ${ctx.totalDays} · $${Math.round(remaining)} left of $${ctx.trip.budget} budget`
        };
    }
    if (slot === SLOT_AFTERNOON) {
        const todayLine = ctx.todayTotal > 0 ? `· $${Math.round(ctx.todayTotal)} today` : `· $0 today so far`;
        return {
            title: todayLine,
            body: `${ctx.trip.name}: $${Math.round(ctx.tripSpent)} of $${ctx.trip.budget} · ${ctx.daysLeft} days left`
        };
    }
    // evening
    const symbol = ctx.tripSpent > ctx.trip.budget ? '!' : ctx.todayTotal <= aim ? '✓' : '·';
    const word = ctx.tripSpent > ctx.trip.budget ? 'over trip budget' : ctx.todayTotal <= aim ? 'under trip pace' : 'over trip pace';
    return {
        title: `${symbol} $${Math.round(ctx.todayTotal)} today — ${word}`,
        body: `Day ${ctx.dayNum} done · $${Math.round(remaining)} left of $${ctx.trip.budget} budget`
    };
}
```

- [ ] **Step 2: Branch in `processToken`**

Replace the body of `processToken` so that, after fetching `ctx` for the regular path, it checks for an active trip and overrides the message if one exists:

```javascript
async function processToken(uid, tokenDoc, gamification, forceSlot) {
    const data = tokenDoc.data();
    const tz = data.tz || 'America/Los_Angeles';
    const hour = forceSlot ?? localHour(tz);
    if (hour !== SLOT_BUDGET_ROOM && hour !== SLOT_AFTERNOON && hour !== SLOT_END_OF_DAY) return;

    const today = localDateString(tz);
    const monthStart = startOfMonthString(tz);
    const expenses = await fetchUserExpenses(uid, monthStart, today);
    const todayExpenses = expenses.filter(e => e.date === today);

    const trip = await fetchActiveTrip(uid, today);
    let title, body;
    if (trip) {
        const tripExpenses = await fetchTripExpenses(uid, trip.id);
        const tripSpent = tripExpenses.reduce((s, e) => s + Number(e.amount || 0), 0);
        const todayTripTotal = tripExpenses.filter(e => e.date === today).reduce((s, e) => s + Number(e.amount || 0), 0);
        const totalDays = Math.floor((new Date(trip.endDate) - new Date(trip.startDate)) / 86400000) + 1;
        const dayNum = Math.max(1, Math.floor((new Date(today) - new Date(trip.startDate)) / 86400000) + 1);
        const cappedDay = Math.min(dayNum, totalDays);
        const daysLeft = Math.max(0, totalDays - cappedDay);
        const ctx = { trip, tripSpent, today, todayTotal: todayTripTotal, daysLeft, totalDays, dayNum: cappedDay };
        ({ title, body } = buildTripMessage(hour, ctx));
    } else {
        // Spec §2 — monthly cap math excludes trip expenses.
        const regularThisMonth = expenses.filter(e => e.tripId == null);
        const ctx = {
            todayTotal: sumExpenses(todayExpenses.filter(e => e.tripId == null)),
            todayFood: sumExpenses(todayExpenses.filter(e => e.tripId == null), isFood),
            monthTotal: sumExpenses(regularThisMonth),
            monthFood: sumExpenses(regularThisMonth, isFood),
            daysLeft: daysLeftInMonth(tz),
            todayCount: todayExpenses.length,
            monthName: localMonthName(tz),
            streak: gamification?.streak?.current || 0,
            checkedIn: !!gamification?.dailyLog?.[today]?.checkedIn,
            mood: gamification?.dailyLog?.[today]?.mood || null
        };
        ({ title, body } = buildMessage(hour, ctx));
    }

    try {
        await messaging.send({ token: data.token, notification: { title, body } });
        console.log(`Sent ${hour}h to ${uid} / ${data.token.slice(0, 12)}…${trip ? ' (trip)' : ''}`);
    } catch (err) {
        const code = err.errorInfo?.code;
        if (code === 'messaging/registration-token-not-registered' || code === 'messaging/invalid-argument') {
            await tokenDoc.ref.delete();
            console.log(`Removed stale token for ${uid}: ${code}`);
        } else {
            console.error(`Send failed for ${uid}:`, err.message);
        }
    }
}
```

- [ ] **Step 3: Verify locally with FORCE_SLOT**

```bash
cd scripts
FIREBASE_SERVICE_ACCOUNT="$(cat /path/to/service-account.json)" FORCE_SLOT=morning node send-notifications.js
```

(Skip if you don't have local creds — the workflow will exercise this in CI.)

- [ ] **Step 4: Commit**

```bash
git add scripts/send-notifications.js
git commit -m "Notifications: branch on active trip with trip-themed copy"
```

---

### Task E.2: Mirror trip preview strings in `js/notifications.js`

**Files:** Modify `js/notifications.js`.

- [ ] **Step 1: Read current preview function**

Search `js/notifications.js` for `fireNotificationPreview` (or similar). The function builds preview titles/bodies that match the production sender. Add a parallel trip-preview branch.

- [ ] **Step 2: Add `_buildTripPreview` mirroring sender logic**

Inside `js/notifications.js`, add (or update existing preview builder):

```javascript
function _activeTripForPreview() {
    if (!window.tripsStore) return null;
    const today = (() => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0'); })();
    return window.tripsStore.getActiveTrip(today);
}
function _buildTripPreview(slot, trip) {
    const today = (() => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0'); })();
    const expenses = window.expenseTracker.getTripExpenses(trip.id);
    const tripSpent = expenses.reduce((s, e) => s + Number(e.amount || 0), 0);
    const todayTotal = expenses.filter(e => e.date === today).reduce((s, e) => s + Number(e.amount || 0), 0);
    const totalDays = window.expenseTracker._tripTotalDays(trip);
    const dayNum = Math.min(totalDays, window.expenseTracker._tripDayNumber(trip, today));
    const remaining = Math.max(0, trip.budget - tripSpent);
    const aim = Math.round(remaining / Math.max(1, totalDays - dayNum + 1));
    if (slot === 'morning') return { title: `→ $${aim} to spend on the trip today`, body: `Day ${dayNum} of ${totalDays} · $${Math.round(remaining)} left of $${trip.budget} budget` };
    if (slot === 'afternoon') return { title: todayTotal > 0 ? `· $${Math.round(todayTotal)} today` : `· $0 today so far`, body: `${trip.name}: $${Math.round(tripSpent)} of $${trip.budget} · ${Math.max(0, totalDays - dayNum)} days left` };
    const symbol = tripSpent > trip.budget ? '!' : todayTotal <= aim ? '✓' : '·';
    const word = tripSpent > trip.budget ? 'over trip budget' : todayTotal <= aim ? 'under trip pace' : 'over trip pace';
    return { title: `${symbol} $${Math.round(todayTotal)} today — ${word}`, body: `Day ${dayNum} done · $${Math.round(remaining)} left of $${trip.budget} budget` };
}
```

In your existing `fireNotificationPreview(slot)` function, before falling back to the monthly preview, do:

```javascript
const trip = _activeTripForPreview();
if (trip) {
    const { title, body } = _buildTripPreview(slot, trip);
    // ... existing toast/Notification.show with title+body ...
    return;
}
```

- [ ] **Step 3: Commit**

```bash
git add js/notifications.js
git commit -m "Notifications: mirror trip preview strings in client"
```

---

### Task E.3: Auto-add CTA on home → handler

**Files:** Modify `script.js` (overwrite `onAutoAddTap` set in Track A).

- [ ] **Step 1: Replace `onAutoAddTap` with the full Auto-add UX**

Find the `window.onAutoAddTap` stub from Track A and replace with:

```javascript
window.onAutoAddTap = async function () {
    const dot = document.querySelector('#dashboard-page .sync-dot');
    const status = document.querySelector('#dashboard-page .sync-status');
    if (status) status.querySelector('span:not(.sync-dot)') ? status.lastChild.textContent = ' Syncing…' : (status.textContent = ' Syncing…');
    if (!window.emailParser || !window.emailParser.sync) {
        if (typeof showNotification === 'function') showNotification('Gmail import not available', 'error');
        return;
    }
    try {
        await window.emailParser.sync();
    } catch (e) {
        // sync() handles 401 internally via refreshGmailToken; bubble any other error.
        console.error('Auto-add sync error:', e);
        if (dot) dot.classList.add('warn');
        if (typeof showNotification === 'function') showNotification('Sync failed', 'error');
        return;
    }
    if (window.expenseTracker) window.expenseTracker.updateDashboard();
};
```

- [ ] **Step 2: Verify**

Tap "Auto add" on the home hero → existing Gmail sync flow runs (toast for new transactions, reconnect popup if 401). Sync timestamp updates on next dashboard render.

- [ ] **Step 3: Commit**

```bash
git add script.js
git commit -m "Auto-add: full home CTA handler with status feedback"
```

---

### Task E.4: Track E smoke

- [ ] **Step 1: Smoke**

- Tap "Auto add" on home; if signed in, sync runs; status line updates.
- With an active trip, `fireNotificationPreview('morning')` produces the trip-themed copy in the local toast.
- `cd scripts && FORCE_SLOT=morning node send-notifications.js` (with creds) shows trip copy in console for the test user.

- [ ] **Step 2: Tag**

```bash
git tag track-e-complete
```

---

# Phase 2 — Integration

> Run after all five tracks merge. Sequential, single agent.

---

### Task 2.1: Auto-tag Gmail-imported expenses

**Files:** Modify `js/email-parser.js`.

- [ ] **Step 1: Patch the `toAdd` push**

Find the push site (around line 382 in `js/email-parser.js`):

```javascript
                toAdd.push({
                    id: Date.now() + Math.floor(Math.random() * 10000),
                    amount: parseFloat(parsed.amount),
                    description: parsed.merchant,
                    category: parsed.category || 'Other',
                    date: parsed.date,
                    timestamp: Date.now(),
                    excludeFromBudget: false,
                    source: 'gmail'
                });
```

Replace with:

```javascript
                const tripId = (window.tripsStore && window.tripsStore.pickTripIdForDate)
                    ? window.tripsStore.pickTripIdForDate(parsed.date) : null;
                toAdd.push({
                    id: Date.now() + Math.floor(Math.random() * 10000),
                    amount: parseFloat(parsed.amount),
                    description: parsed.merchant,
                    category: parsed.category || 'Other',
                    date: parsed.date,
                    timestamp: Date.now(),
                    excludeFromBudget: false,
                    source: 'gmail',
                    tripId
                });
```

- [ ] **Step 2: Verify**

Create a trip whose window contains "today". Run `window.emailParser.sync()` (with seeded fixtures or a real Gmail connection). Newly imported expenses with date in trip window have `tripId` set; outside the window have `tripId: null`.

- [ ] **Step 3: Commit**

```bash
git add js/email-parser.js
git commit -m "Email parser: auto-tag imported expenses with active tripId"
```

---

### Task 2.2: Cross-track manual smoke at 393px viewport

- [ ] **Step 1: Open dev server**

`npm run dev`. Open in Chrome DevTools, set device to "iPhone 14" (or width 393px).

- [ ] **Step 2: Walk through each page**

Verify (no JS errors in console, no horizontal scroll):

- **Home** (no trip): greeting / hero / insight / habit / categories / trend.
- **Home** (with active trip): trip teaser appears above hero with "$X of $Y · DAY n / N · view trip →".
- **Trips index**: empty state, then create trip via `+`, see Active/Upcoming/Past sections.
- **Trip dashboard**: hero + insight + Today + Add FAB + Breakdown + Daily rhythm + End trip.
- **Add Expense** (no trip): smart card + Use fields toggle. Submit a manual expense; navigates back to home.
- **Add Expense** (with active trip): cyan trip banner; submit text "Add to trip"; tagged record appears on Trip dashboard, NOT in monthly hero total.
- **Txns**: untouched.
- **History**: year selector / stat cards / year shape / month rail / month detail / Where the year went / Top regulars.

- [ ] **Step 3: Verify two-budget invariants**

In console:
```javascript
const Y = 2026, M = new Date().getMonth();
const reg = window.expenseTracker.getRegularMonthExpenses(Y, M).reduce((s,e)=>s+e.amount,0);
const trip = window.expenseTracker.getTripExpenses(window.tripsStore.getActiveTrip().id).reduce((s,e)=>s+e.amount,0);
console.log({reg, trip});
```
Expected: `reg` matches the home hero number; `trip` matches the trip dashboard number; the two sums never overlap.

- [ ] **Step 4: Run test.sh**

```bash
./test.sh
```
Expected: All ✅, no warnings about unguarded `getElementById`.

- [ ] **Step 5: If anything fails, fix in track-owner files only and re-commit**

---

### Task 2.3: Bump service worker cache

**Files:** Modify `sw.js`.

- [ ] **Step 1: Bump cache version**

Find the cache name `expense-tracker-v6` in `sw.js`. Change to `expense-tracker-v7`.

- [ ] **Step 2: Verify**

Reload in browser (DevTools → Application → Service Workers → Update on reload). New cache name applies; old cache evicts.

- [ ] **Step 3: Commit**

```bash
git add sw.js
git commit -m "PWA: bump service worker cache to v7 for redesign assets"
```

---

### Task 2.4: Final test.sh + tag

- [ ] **Step 1: Final smoke**

```bash
./test.sh
```

- [ ] **Step 2: Tag**

```bash
git tag redesign-complete
```

- [ ] **Step 3: Stop**

Do NOT `git push` without explicit user instruction (per `.kiro/steering/project-context.md`).

---

# Appendix — Spec coverage map

| Spec section | Covered by |
|---|---|
| §1 Goals | All tracks |
| §2 Two-budget model | Phase 0.2 (helpers), Track A.5 (hero excludes trip), Track D.6 (month detail composition), Track E.1 (notif math) |
| §3 Design system (palette, typography, iconography, stoplight) | Phase 0.1 (tokens + fonts), all CSS appends in tracks |
| §3 Bar/ring shape replacement | Track A.5 (linear cap-bar, no ring SVG) |
| §4 Home page sections 1–9 | Track A.4–A.10 |
| §4.1 Aim today math | Phase 0.2 + Track A.3 (`_computeAimToday`) |
| §4.2 Forecast | Track A.2 (`js/forecast.js`) + A.5 |
| §4.3 Trend pace line | Track A.10 |
| §4.4 Category drill-down | Marked deferred in plan header (legend rows still tappable to existing modal) |
| §5.1 Trip data model | Phase 0.3 (`js/trips.js`) |
| §5.2 Lifecycle / states | Phase 0.3 (`getState`) |
| §5.3 Auto-tagging logic | Phase 0.3 (`pickTripIdForDate`), Track C.2 (manual submit), Phase 2.1 (Gmail) |
| §5.4 Start/End behavior | Track B.2 (`onStartTrip`, `onEndTrip`) |
| §5.5 Trip Dashboard | Track B.2 |
| §5.6 Trips Index | Track B.2 |
| §5.7 Notifications during a trip | Track E.1 + E.2 |
| §6 Add Expense layout | Track C.2 |
| §6.2 Live parse preview | Track C.3 |
| §6.3 Trip auto-tag toggle | Track C.2 |
| §7 History sections 1–9 | Track D.4–D.7 |
| §7.2 Top regulars | Track D.2 + D.7 |
| §7.3 Removed sections | Phase 0.4 page-body rewrite |
| §7.4 No insights | Track D never adds an insight strip on history |
| §8 Bottom nav (4 tabs) | Phase 0.5 |
| §9 Anti-portfolio retirement | Phase 0.6 |
| §10 Auto-add rename + relocation | Track A.5 (CTA) + Track E.3 (handler) |
| §12 Data migrations | Phase 0.2 (lazy `tripId: null` on read) |
| §12 Testing expectations | Phase 2.2 |






