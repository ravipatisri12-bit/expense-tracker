# Spending Planner Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the "Plan" tab — a wishlist + savings-rate-aware month scheduler — per `docs/superpowers/specs/2026-05-19-spending-planner-design.md`.

**Architecture:** New `wishlistStore` global (mirrors `tripsStore`) holds wishlist items + headroom math + auto-placement. New `js/plan-page.js` renders `#plan-page` (header strip, calendar lane, expanded month detail, wishlist sections, FAB, modal). `script.js` gets a `_currentPlanMonth` selection, recompute hooks on settings/expense/trip changes, and a Settings slider for `savingsTargetRate`. The 5-tab nav adds "Plan" (warm yellow accent).

**Tech stack:** Vanilla JS, classic `<script>` tags (load order matters — `wishlist.js` loads before `plan-page.js`, both before `script.js`). Firebase v8 compat for sync. localStorage as primary store. CSS appended to `styles/main.css`. No build step at runtime.

---

## File map

| Path | Type | Purpose |
|---|---|---|
| `js/wishlist.js` | new | `WishlistStore` class — CRUD, `findSpot`, `computeHeadroom`, `projectedYearRate`, realtime sync |
| `js/plan-page.js` | new | `renderPlanPage`, `openWishModal`, `closeWishModal`, `submitWish`, `selectPlanMonth`, action handlers |
| `index.html` | modify | 5-tab nav, `#plan-page` shell, wish-add modal markup, `<script>` tags for new files |
| `styles/main.css` | append | `--plan-1`/`--plan-2`/`--plan-grad` tokens, `.plan-page` + `.plan-header` + `.lane` + `.month-card` + `.month-detail-card` + `.wl-card` + `.wl-row` + `.fab-plan` styles |
| `script.js` | modify | `getDefaultSettings` adds `savingsTargetRate: 0.50`, `loadSettings`/`saveSettings` wire the slider, `showPage` handles `'plan'`, `updateDashboard` notifies the wishlist store, target-rate slider markup |
| `js/auth.js` | modify | `wishlistStore.attachRealtime()` after sign-in (alongside `tripsStore.attachRealtime()`) |
| `sw.js` | modify | bump cache name `expense-tracker-v7` → `v8` so the new files ship |

---

## Phase A — Foundation (data layer + nav shell)

### Task A1: Create the `WishlistStore` (CRUD + state subscription)

**Files:**
- Create: `js/wishlist.js`

Implements the store skeleton: localStorage-backed array, subscribe pattern, CRUD, deterministic ID generator. Mirrors `js/trips.js`. No headroom math yet — that's Task A2.

- [ ] **Step 1: Create the store file**

```javascript
/**
 * Wishlist CRUD + state machine + headroom math + auto-placement.
 * Items live at users/{uid}/wishlist/{id} in Firestore and as
 * localStorage['wishlist'] for offline. Shape per spec §2.
 */
(function () {
    const LS_KEY = 'wishlist';

    function loadLocal() {
        try { return JSON.parse(localStorage.getItem(LS_KEY) || '[]'); }
        catch { return []; }
    }
    function saveLocal(items) {
        localStorage.setItem(LS_KEY, JSON.stringify(items));
    }
    function genId() {
        return 'w_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    }

    class WishlistStore {
        constructor() {
            this.items = loadLocal();
            this.listeners = [];
            this._unsub = null;
            this._headroomCache = null; // busted on every mutation / external recompute trigger
        }

        subscribe(fn) {
            this.listeners.push(fn);
            return () => { this.listeners = this.listeners.filter(l => l !== fn); };
        }
        _emit() { this._headroomCache = null; for (const l of this.listeners) l(this.items); }

        all() { return this.items.slice(); }
        getById(id) { return this.items.find(i => i.id === id) || null; }

        open() { return this.items.filter(i => i.status === 'open'); }
        bought() { return this.items.filter(i => i.status === 'bought'); }
        cancelled() { return this.items.filter(i => i.status === 'cancelled'); }
        unscheduled() { return this.items.filter(i => i.status === 'open' && !i.scheduledMonth); }
        scheduledIn(ym) { return this.items.filter(i => i.status === 'open' && i.scheduledMonth === ym); }

        async create({ name, cost, priority, notes }) {
            const item = {
                id: genId(),
                name: String(name || '').trim(),
                cost: Number(cost) || 0,
                priority: ['must', 'want', 'nice'].includes(priority) ? priority : 'want',
                scheduledMonth: null,
                status: 'open',
                notes: String(notes || '').trim(),
                createdAt: Date.now(),
                updatedAt: Date.now()
            };
            if (!item.name || item.cost <= 0) throw new Error('Wish needs a name and positive cost.');
            this.items.push(item);
            saveLocal(this.items);
            await this._writeRemote(item);
            this._emit();
            return item;
        }

        async update(id, patch) {
            const i = this.items.findIndex(x => x.id === id);
            if (i < 0) return null;
            this.items[i] = { ...this.items[i], ...patch, updatedAt: Date.now() };
            saveLocal(this.items);
            await this._writeRemote(this.items[i]);
            this._emit();
            return this.items[i];
        }

        async delete(id) {
            this.items = this.items.filter(x => x.id !== id);
            saveLocal(this.items);
            if (window.currentUser && window.firebaseDb) {
                try {
                    await window.firebaseDb.collection('users').doc(window.currentUser.uid)
                        .collection('wishlist').doc(id).delete();
                } catch (e) { console.error('wishlist.delete remote:', e); }
            }
            this._emit();
        }

        async _writeRemote(item) {
            if (!window.currentUser || !window.firebaseDb) return;
            try {
                await window.firebaseDb.collection('users').doc(window.currentUser.uid)
                    .collection('wishlist').doc(item.id).set(item);
            } catch (e) { console.error('wishlist._writeRemote:', e); }
        }

        attachRealtime() {
            if (!window.currentUser || !window.firebaseDb) return;
            if (this._unsub) this._unsub();
            this._unsub = window.firebaseDb.collection('users').doc(window.currentUser.uid)
                .collection('wishlist').onSnapshot(snap => {
                    this.items = snap.docs.map(d => d.data());
                    saveLocal(this.items);
                    this._emit();
                });
        }

        bustCache() { this._headroomCache = null; this._emit(); }
    }

    window.wishlistStore = new WishlistStore();
})();
```

- [ ] **Step 2: Wire the store into the page**

Edit `index.html`. Find the `<script src="js/trips.js"></script>` line (currently line ~23) and add a sibling tag right after it:

```html
    <script src="js/trips.js"></script>
    <script src="js/wishlist.js"></script>
    <script src="js/forecast.js"></script>
```

- [ ] **Step 3: Wire realtime sync into auth**

Edit `js/auth.js:219`. The current line reads:

```javascript
        if (window.tripsStore) window.tripsStore.attachRealtime();
```

Change to:

```javascript
        if (window.tripsStore) window.tripsStore.attachRealtime();
        if (window.wishlistStore) window.wishlistStore.attachRealtime();
```

- [ ] **Step 4: Smoke test**

Run `./test.sh` and expect PASS.

Then `npm run dev` and in DevTools console:

```js
window.wishlistStore.create({ name: 'Test', cost: 100, priority: 'want' })
window.wishlistStore.all()
```

Expected: returns the item with `id`, `status: 'open'`, `scheduledMonth: null`.

- [ ] **Step 5: Commit**

```bash
git add js/wishlist.js index.html js/auth.js
git commit -m "Plan: wishlistStore CRUD + realtime sync"
```

---

### Task A2: Add headroom math + `findSpot` + `projectedYearRate` to the store

**Files:**
- Modify: `js/wishlist.js` (append methods to `WishlistStore`)

Implements the math from spec §3 and the auto-placement from §5.1.

- [ ] **Step 1: Add helpers and `monthKey`**

In `js/wishlist.js`, inside the IIFE (above `class WishlistStore`), add:

```javascript
    function monthKey(d) {
        return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
    }
    function parseMonthKey(ym) {
        const [y, m] = ym.split('-').map(Number);
        return { year: y, month: m - 1 }; // month 0–11
    }
    function todayMonthKey() { return monthKey(new Date()); }
```

- [ ] **Step 2: Add `_typicalVariableMonth` (trailing-3-month avg of regular spend)**

Append inside the class:

```javascript
        _typicalVariableMonth() {
            const t = window.expenseTracker;
            if (!t) return 0;
            const now = new Date();
            const buckets = []; // last 3 completed/in-progress months including current
            for (let off = 0; off < 3; off++) {
                const d = new Date(now.getFullYear(), now.getMonth() - off, 1);
                const y = d.getFullYear(), m = d.getMonth();
                const sum = t.expenses.reduce((s, e) => {
                    if (e.tripId) return s; // regular only
                    const ed = t.parseLocalDate(e.date);
                    if (ed.getFullYear() === y && ed.getMonth() === m) return s + Number(e.amount || 0);
                    return s;
                }, 0);
                buckets.push(sum);
            }
            // Use only buckets that had any data; if none, fall back to income×(1-target).
            const nonZero = buckets.filter(v => v > 0);
            if (nonZero.length > 0) return nonZero.reduce((a, b) => a + b, 0) / nonZero.length;
            const income = (t.settings && t.settings.income) || 0;
            const target = (t.settings && t.settings.savingsTargetRate) || 0.50;
            return income * (1 - target);
        }
```

- [ ] **Step 3: Add `_fixedMonth`**

Append inside the class:

```javascript
        _fixedMonth() {
            const t = window.expenseTracker;
            if (!t || typeof t._monthlyFixedTotal !== 'function') return 0;
            return t._monthlyFixedTotal();
        }
```

- [ ] **Step 4: Add `computeHeadroom`**

Append inside the class:

```javascript
        // Returns array of { ym, label, year, month, income, fixed, typicalVariable, planted, headroom, plantedItems }
        // for currentMonth → Dec of currentYear. Cached on the instance.
        computeHeadroom() {
            if (this._headroomCache) return this._headroomCache;
            const t = window.expenseTracker;
            if (!t) return [];
            const income = (t.settings && t.settings.income) || 0;
            const fixed = this._fixedMonth();
            const typVar = this._typicalVariableMonth();
            const now = new Date();
            const months = [];
            for (let m = now.getMonth(); m <= 11; m++) {
                const ym = now.getFullYear() + '-' + String(m + 1).padStart(2, '0');
                const planted = this.scheduledIn(ym);
                const plantedSum = planted.reduce((s, i) => s + Number(i.cost || 0), 0);
                const headroom = income - fixed - typVar - plantedSum;
                const date = new Date(now.getFullYear(), m, 1);
                months.push({
                    ym,
                    label: date.toLocaleDateString('en-US', { month: 'short' }),
                    longLabel: date.toLocaleDateString('en-US', { month: 'long' }),
                    year: now.getFullYear(),
                    month: m,
                    income, fixed, typicalVariable: typVar,
                    planted: plantedSum,
                    headroom,
                    plantedItems: planted
                });
            }
            this._headroomCache = months;
            return months;
        }
```

- [ ] **Step 5: Add `projectedYearRate`**

Append inside the class:

```javascript
        // Projected savings rate for the current calendar year, including all
        // open scheduled items and a typical-variable extrapolation for remaining months.
        projectedYearRate() {
            const t = window.expenseTracker;
            if (!t) return 0;
            const income = (t.settings && t.settings.income) || 0;
            if (income <= 0) return 0;
            const now = new Date();
            const Y = now.getFullYear();
            const monthsElapsed = now.getMonth() + 1;
            const monthsRemaining = 12 - monthsElapsed;
            const yearIncome = income * 12;
            const loggedThisYear = t.expenses.reduce((s, e) => {
                const d = t.parseLocalDate(e.date);
                if (d.getFullYear() !== Y) return s;
                return s + Number(e.amount || 0);
            }, 0);
            const fixedYear = this._fixedMonth() * 12;
            const typVarRemaining = this._typicalVariableMonth() * monthsRemaining;
            const plantedSum = this.items
                .filter(i => i.status === 'open' && i.scheduledMonth && i.scheduledMonth.startsWith(Y + '-'))
                .reduce((s, i) => s + Number(i.cost || 0), 0);
            const yearSpend = loggedThisYear + fixedYear + typVarRemaining + plantedSum;
            return Math.max(0, (yearIncome - yearSpend) / yearIncome);
        }
```

- [ ] **Step 6: Add `findSpot` (auto-placement)**

Append inside the class:

```javascript
        // Walks months currentMonth → Dec, returns first ym where:
        //   headroom(ym) >= item.cost AND projected rate stays >= target
        // Does NOT mutate the item; caller decides whether to commit.
        findSpot(item) {
            const t = window.expenseTracker;
            if (!t) return null;
            const target = (t.settings && t.settings.savingsTargetRate) || 0.50;
            const months = this.computeHeadroom();
            for (const m of months) {
                if (m.headroom < item.cost) continue;
                // Hypothetical: place this item, recompute rate
                const before = item.scheduledMonth;
                item.scheduledMonth = m.ym; // temporary
                this._headroomCache = null;
                const rate = this.projectedYearRate();
                item.scheduledMonth = before; // restore
                this._headroomCache = null;
                if (rate >= target) return m.ym;
            }
            return null;
        }
```

- [ ] **Step 7: Smoke test in console**

```js
const w = await window.wishlistStore.create({ name: 'Test', cost: 100, priority: 'want' })
window.wishlistStore.computeHeadroom().slice(0,3)
window.wishlistStore.findSpot(w)
// then clean up
window.wishlistStore.delete(w.id)
```

Expected: `computeHeadroom` returns months from current month through Dec with numeric `headroom`. `findSpot` returns a `'YYYY-MM'` string (current month most likely).

- [ ] **Step 8: Commit**

```bash
git add js/wishlist.js
git commit -m "Plan: headroom math + projectedYearRate + findSpot"
```

---

### Task A3: Add 5-tab nav, `#plan-page` shell, wish modal markup, design tokens

**Files:**
- Modify: `index.html` (nav, page shells, modal markup)
- Modify: `styles/main.css` (append tokens + nav alignment)

- [ ] **Step 1: Convert nav to 5 tabs**

In `index.html`, replace the `<nav>` block (currently lines 64–72):

```html
    <!-- Bottom Navigation - 5 tabs -->
    <nav class="fixed bottom-0 left-0 right-0 z-50 safe-area-inset-bottom" style="background:var(--surface);border-top:1px solid var(--line)">
        <div class="grid grid-cols-5">
            <button id="nav-home" onclick="showPage('dashboard')" class="nav-btn flex flex-col items-center py-2"><span class="material-symbols-rounded">home</span><span class="text-xs">Home</span></button>
            <button id="nav-trips" onclick="showPage('trips')" class="nav-btn flex flex-col items-center py-2"><span class="material-symbols-rounded">flight</span><span class="text-xs">Trips</span></button>
            <button id="nav-plan" onclick="showPage('plan')" class="nav-btn flex flex-col items-center py-2"><span class="material-symbols-rounded">event_note</span><span class="text-xs">Plan</span></button>
            <button id="nav-txns" onclick="showPage('transactions')" class="nav-btn flex flex-col items-center py-2"><span class="material-symbols-rounded">receipt_long</span><span class="text-xs">Txns</span></button>
            <button id="nav-history" onclick="showPage('history')" class="nav-btn flex flex-col items-center py-2"><span class="material-symbols-rounded">history</span><span class="text-xs">History</span></button>
        </div>
    </nav>
```

- [ ] **Step 2: Add `#plan-page` shell**

In `index.html`, find the `<!-- HISTORY PAGE -->` block (currently around line 123). Insert this BEFORE it:

```html
    <!-- PLAN PAGE -->
    <div id="plan-page" class="page-content hidden">
        <div class="plan-page max-w-lg mx-auto px-4 pt-2 pb-24 flex flex-col gap-4">
            <div class="app-header" style="padding:8px 4px 4px"><h1 class="page-title f-serif">Plan</h1><div id="plan-page-meta" class="page-meta f-mono"></div></div>
            <div id="plan-header-strip"></div>
            <div id="plan-lane-section"></div>
            <div id="plan-month-detail" class="hidden"></div>
            <div id="plan-wishlist-section"></div>
        </div>
        <button id="plan-fab" class="fab-plan hidden" onclick="openWishModal()" aria-label="Add wish"><span class="material-symbols-rounded">add</span></button>
    </div>

    <!-- WISH ADD/EDIT MODAL -->
    <div id="wish-modal" class="hidden fixed inset-0 z-50 flex items-end" style="background:rgba(0,0,0,0.6)" onclick="if(event.target===this) closeWishModal()">
        <div id="wish-modal-card" class="w-full max-w-lg mx-auto" style="background:var(--surface);border-radius:28px 28px 0 0;padding:20px"></div>
    </div>
```

- [ ] **Step 3: Add Plan tokens + base CSS**

Append to the END of `styles/main.css`:

```css
/* ====================================================================
   PLAN — design tokens + page shell. Spec §4.
   ==================================================================== */
:root {
    --plan-1: #ffb84d;
    --plan-2: #ffd166;
    --plan-grad: linear-gradient(120deg, #ffb84d 0%, #ffd166 100%);
}

.nav-btn { color: var(--on-surface-faint); font-family: 'Inter Tight'; }
#nav-plan.active { color: var(--plan-1); }
#nav-plan.active .material-symbols-rounded { font-variation-settings: 'FILL' 1; }

.plan-page .app-header { display: flex; align-items: baseline; justify-content: space-between; }
.plan-page .page-title { font-size: 30px; line-height: 1; }
.plan-page .page-meta { font-size: 10px; color: var(--on-surface-faint); letter-spacing: 0.18em; text-transform: uppercase; }

/* Header strip (yellow-tinted, anchors the year target) */
.plan-header { padding: 18px; border-radius: 22px; background: rgba(255,184,77,0.08); border: 1px solid rgba(255,184,77,0.18); }
.plan-header .eyebrow { font-family: 'JetBrains Mono', monospace; font-size: 10px; letter-spacing: 0.22em; text-transform: uppercase; color: var(--plan-1); display: flex; align-items: center; gap: 6px; margin-bottom: 10px; }
.plan-header .headline { font-family: 'Fraunces', serif; font-size: 22px; line-height: 1.15; color: var(--md-sys-color-on-surface); }
.plan-header .headline .pct { background: var(--plan-grad); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; cursor: pointer; padding: 0 2px; }
.plan-header .meta { display: flex; gap: 6px; flex-wrap: wrap; align-items: center; margin-top: 12px; font-family: 'JetBrains Mono', monospace; font-size: 11px; color: var(--on-surface-faint); }
.plan-header .meta .delta-good { color: #43e97b; }
.plan-header .meta .delta-bad { color: #cf6679; }

/* Section labels */
.plan-section-head { display: flex; align-items: baseline; justify-content: space-between; margin: 4px 4px 0; }
.plan-section-head .title { font-family: 'Fraunces', serif; font-size: 18px; color: var(--md-sys-color-on-surface); }
.plan-section-head .meta { font-family: 'JetBrains Mono', monospace; font-size: 10px; letter-spacing: 0.16em; text-transform: uppercase; color: var(--on-surface-faint); }

/* Calendar lane */
.plan-lane { display: flex; gap: 10px; overflow-x: auto; padding: 4px 4px 12px; scroll-snap-type: x proximity; -webkit-overflow-scrolling: touch; }
.plan-lane::-webkit-scrollbar { display: none; }
.month-card { flex: 0 0 168px; padding: 14px; border-radius: 18px; background: var(--md-sys-color-surface-container); border: 1px solid var(--line); scroll-snap-align: start; cursor: pointer; transition: border-color 120ms ease, transform 120ms ease; }
.month-card.empty { border-style: dashed; }
.month-card.selected { border-color: var(--plan-1); box-shadow: 0 0 0 1px var(--plan-1); transform: translateY(-1px); }
.month-card .head { display: flex; align-items: baseline; justify-content: space-between; margin-bottom: 8px; }
.month-card .name { font-family: 'Fraunces', serif; font-size: 18px; color: var(--md-sys-color-on-surface); }
.month-card .yr { font-family: 'JetBrains Mono', monospace; font-size: 10px; color: var(--on-surface-faint); margin-left: 4px; }
.headroom-chip { display: inline-block; padding: 3px 8px; border-radius: 999px; font-family: 'JetBrains Mono', monospace; font-size: 10px; letter-spacing: 0.04em; }
.headroom-chip.good { background: rgba(255,184,77,0.18); color: var(--plan-1); }
.headroom-chip.warn { background: rgba(255,210,77,0.14); color: #ffd166; }
.headroom-chip.bad { background: rgba(207,102,121,0.18); color: #cf6679; }
.month-card .planted { display: flex; flex-direction: column; gap: 6px; margin: 10px 0; }
.month-card .pi { display: flex; align-items: center; gap: 6px; padding: 5px 8px; border-radius: 8px; background: rgba(255,255,255,0.04); border-left: 2px solid var(--plan-1); font-size: 11px; }
.month-card .pi.must { border-left-color: #cf6679; }
.month-card .pi.want { border-left-color: var(--plan-1); }
.month-card .pi.nice { border-left-color: var(--on-surface-faint); }
.month-card .pi .name { flex: 1; color: var(--md-sys-color-on-surface); font-family: 'Inter Tight'; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.month-card .pi .cost { font-family: 'JetBrains Mono', monospace; color: var(--on-surface-faint); }
.month-card .progress { height: 4px; background: rgba(255,255,255,0.06); border-radius: 999px; overflow: hidden; margin-top: 8px; }
.month-card .progress > span { display: block; height: 100%; background: var(--plan-grad); }
.month-card .footnote { font-family: 'JetBrains Mono', monospace; font-size: 10px; color: var(--on-surface-faint); margin-top: 6px; letter-spacing: 0.06em; }

/* Expanded month detail card */
.month-detail-card { padding: 20px; border-radius: 22px; background: var(--md-sys-color-surface-container); border: 1px solid var(--line); }
.month-detail-card .eyebrow { font-family: 'JetBrains Mono', monospace; font-size: 10px; letter-spacing: 0.22em; text-transform: uppercase; color: var(--plan-1); margin-bottom: 6px; }
.month-detail-card .name { font-family: 'Fraunces', serif; font-size: 26px; color: var(--md-sys-color-on-surface); margin-bottom: 16px; }
.month-detail-card .table { font-family: 'JetBrains Mono', monospace; font-size: 12px; color: var(--md-sys-color-on-surface); display: flex; flex-direction: column; gap: 4px; }
.month-detail-card .table .row { display: flex; justify-content: space-between; }
.month-detail-card .table .row.muted { color: var(--on-surface-faint); }
.month-detail-card .table .sep { border-top: 1px dashed var(--line); margin: 6px 0; }
.month-detail-card .table .total { font-weight: 600; }
.month-detail-card .table .total.good { color: var(--plan-1); }
.month-detail-card .items { margin-top: 14px; display: flex; flex-direction: column; gap: 6px; }
.month-detail-card .items .row { display: flex; align-items: center; gap: 8px; padding: 8px; border-radius: 10px; background: rgba(255,255,255,0.03); }
.month-detail-card .items .badge { padding: 2px 6px; border-radius: 999px; font-family: 'JetBrains Mono', monospace; font-size: 9px; letter-spacing: 0.06em; text-transform: uppercase; }
.month-detail-card .items .badge.must { background: rgba(207,102,121,0.18); color: #cf6679; }
.month-detail-card .items .badge.want { background: rgba(255,184,77,0.18); color: var(--plan-1); }
.month-detail-card .items .badge.nice { background: rgba(176,182,200,0.14); color: var(--on-surface-faint); }
.month-detail-card .items .name { flex: 1; font-family: 'Inter Tight'; }
.month-detail-card .items .cost { font-family: 'JetBrains Mono', monospace; }
.month-detail-card .items .x { background: transparent; border: 0; color: var(--on-surface-faint); cursor: pointer; padding: 2px 6px; }

/* Wishlist sections */
.wl-tabs { display: flex; gap: 6px; margin: 8px 4px 0; }
.wl-tabs button { flex: 1; padding: 8px 10px; border-radius: 999px; background: rgba(255,255,255,0.04); border: 1px solid transparent; color: var(--on-surface-faint); font-family: 'Inter Tight'; font-size: 12px; cursor: pointer; }
.wl-tabs button.active { background: rgba(255,184,77,0.14); color: var(--plan-1); border-color: rgba(255,184,77,0.3); }
.wl-section-label { font-family: 'JetBrains Mono', monospace; font-size: 10px; letter-spacing: 0.22em; text-transform: uppercase; color: var(--on-surface-faint); margin: 14px 4px 6px; }
.wl-card { background: var(--md-sys-color-surface-container); border: 1px solid var(--line); border-radius: 18px; padding: 4px 0; display: flex; flex-direction: column; }
.wl-row { display: flex; align-items: center; gap: 10px; padding: 12px 14px; border-bottom: 1px solid rgba(255,255,255,0.04); }
.wl-row:last-child { border-bottom: 0; }
.wl-row .badge { padding: 2px 6px; border-radius: 999px; font-family: 'JetBrains Mono', monospace; font-size: 9px; letter-spacing: 0.06em; text-transform: uppercase; flex-shrink: 0; }
.wl-row .badge.must { background: rgba(207,102,121,0.18); color: #cf6679; }
.wl-row .badge.want { background: rgba(255,184,77,0.18); color: var(--plan-1); }
.wl-row .badge.nice { background: rgba(176,182,200,0.14); color: var(--on-surface-faint); }
.wl-row .body { flex: 1; min-width: 0; }
.wl-row .body .name { font-family: 'Inter Tight'; font-size: 14px; color: var(--md-sys-color-on-surface); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.wl-row .body .note { font-size: 11px; color: var(--on-surface-faint); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.wl-row .cost { font-family: 'JetBrains Mono', monospace; font-size: 13px; color: var(--md-sys-color-on-surface); }
.wl-row .month-chip { padding: 3px 8px; border-radius: 999px; font-family: 'JetBrains Mono', monospace; font-size: 10px; background: rgba(255,184,77,0.14); color: var(--plan-1); cursor: pointer; }
.wl-row .find-spot { padding: 4px 10px; border-radius: 999px; font-family: 'JetBrains Mono', monospace; font-size: 10px; letter-spacing: 0.08em; background: var(--plan-grad); color: #1a103a; border: 0; cursor: pointer; }
.wl-row .find-spot.fail { background: rgba(207,102,121,0.18); color: #cf6679; }
.wl-row .actions { display: flex; gap: 4px; flex-shrink: 0; }
.wl-row .actions button { background: transparent; border: 0; color: var(--on-surface-faint); cursor: pointer; padding: 4px; border-radius: 999px; }
.wl-row .actions button:hover { color: var(--md-sys-color-on-surface); }
.wl-row.bought { opacity: 0.6; }
.wl-row.bought .done-chip { padding: 2px 6px; border-radius: 999px; font-family: 'JetBrains Mono', monospace; font-size: 9px; letter-spacing: 0.06em; background: rgba(67,233,123,0.14); color: #43e97b; }

/* FAB */
.fab-plan { position: fixed; bottom: 80px; right: 20px; width: 56px; height: 56px; border-radius: 999px; background: var(--plan-grad); color: #1a103a; border: 0; display: flex; align-items: center; justify-content: center; box-shadow: 0 12px 30px rgba(255,184,77,0.35); cursor: pointer; z-index: 40; }
.fab-plan .material-symbols-rounded { font-size: 26px; font-weight: 600; }

/* Wish modal */
.wish-modal-form { display: flex; flex-direction: column; gap: 14px; }
.wish-modal-form label { font-size: 11px; color: var(--on-surface-faint); letter-spacing: 0.06em; text-transform: uppercase; }
.wish-modal-form input[type="text"], .wish-modal-form input[type="number"], .wish-modal-form textarea { width: 100%; background: rgba(255,255,255,0.04); border: 1px solid var(--line); color: var(--md-sys-color-on-surface); padding: 12px 14px; border-radius: 12px; font-family: 'Inter Tight'; font-size: 14px; }
.wish-modal-form .pri-pills { display: flex; gap: 8px; }
.wish-modal-form .pri-pills button { flex: 1; padding: 10px; border-radius: 999px; background: rgba(255,255,255,0.04); border: 1px solid transparent; color: var(--on-surface-faint); font-family: 'Inter Tight'; font-size: 12px; cursor: pointer; text-transform: uppercase; letter-spacing: 0.08em; }
.wish-modal-form .pri-pills button.active { background: rgba(255,184,77,0.14); color: var(--plan-1); border-color: rgba(255,184,77,0.3); }
.wish-modal-form .actions { display: flex; gap: 10px; margin-top: 4px; }
.wish-modal-form .actions .primary { flex: 1; padding: 14px; border-radius: 14px; background: var(--plan-grad); color: #1a103a; border: 0; font-weight: 600; font-size: 14px; cursor: pointer; }
.wish-modal-form .actions .secondary { padding: 14px 18px; border-radius: 14px; background: rgba(255,255,255,0.04); color: var(--md-sys-color-on-surface); border: 0; font-size: 14px; cursor: pointer; }

/* Empty + warning states */
.plan-empty { padding: 32px 16px; text-align: center; color: var(--on-surface-faint); border-radius: 18px; background: rgba(255,255,255,0.02); border: 1px dashed var(--line); }
.plan-warn { padding: 14px; border-radius: 14px; background: rgba(207,102,121,0.10); border: 1px solid rgba(207,102,121,0.25); color: #cf6679; font-size: 13px; }
.plan-warn .icon { font-size: 16px; vertical-align: middle; margin-right: 6px; }
```

- [ ] **Step 4: Smoke test**

Run `./test.sh` and expect PASS.

`npm run dev`. Plan tab is visible at the bottom (5 columns). Tap it — page is empty (renderer not yet wired), but no console errors. Other tabs still work.

- [ ] **Step 5: Commit**

```bash
git add index.html styles/main.css
git commit -m "Plan: 5-tab nav, page shell, design tokens"
```

---

## Phase B — Page renderer

### Task B1: Render the Plan page (header strip, lane, wishlist sections, no detail card yet)

**Files:**
- Create: `js/plan-page.js`
- Modify: `index.html` (add `<script>` tag)

- [ ] **Step 1: Create the renderer file**

```javascript
/**
 * Plan page renderer + wishlist actions.
 * Reads from window.wishlistStore and window.expenseTracker.
 * Exposes globals: renderPlanPage, openWishModal, closeWishModal, submitWish,
 *   selectPlanMonth, onWishMarkBought, onWishCancel, onWishUncancel,
 *   onWishUnschedule, onWishFindSpot, onWishDelete, onWishEdit,
 *   onSavingsTargetEdit, switchWishTab.
 */
(function () {
    function $(id) { return document.getElementById(id); }
    function escapeHtml(s) { return String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
    function fmt(n) { return Math.round(Number(n) || 0).toLocaleString(); }
    function todayLocalYM() {
        const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0');
    }
    function ymLabel(ym) {
        const [y,m] = ym.split('-').map(Number);
        return new Date(y, m-1, 1).toLocaleDateString('en-US', { month: 'short' }).toUpperCase();
    }

    // Wishlist tab state — persisted on the tracker for re-renders
    function getWlTab() { return window.expenseTracker?._wlTab || 'open'; }
    function setWlTab(t) { if (window.expenseTracker) window.expenseTracker._wlTab = t; }

    function getCurrentPlanMonth() { return window.expenseTracker?._currentPlanMonth || null; }
    function setCurrentPlanMonth(ym) { if (window.expenseTracker) window.expenseTracker._currentPlanMonth = ym; }

    window.renderPlanPage = function () {
        renderHeaderStrip();
        renderLane();
        renderMonthDetail();
        renderWishlist();
        const fab = $('plan-fab'); if (fab) fab.classList.remove('hidden');
        // Page meta line
        const meta = $('plan-page-meta');
        if (meta) {
            const today = new Date();
            meta.textContent = today.toLocaleDateString('en-US',{month:'short',day:'numeric'}).toUpperCase() + ' · ‹ → DEC ›';
        }
    };

    function renderHeaderStrip() {
        const root = $('plan-header-strip'); if (!root) return;
        const t = window.expenseTracker, w = window.wishlistStore;
        if (!t || !w) { root.innerHTML = ''; return; }
        const target = (t.settings && t.settings.savingsTargetRate) || 0.50;
        const targetPct = Math.round(target * 100);
        const projected = w.projectedYearRate();
        const delta = projected - target;
        const deltaPct = Math.round(delta * 100 * 10) / 10; // tenths
        const deltaCls = delta >= 0 ? 'delta-good' : 'delta-bad';
        const deltaText = (delta >= 0 ? '+' : '') + deltaPct + 'pt';
        const open = w.open();
        const planted = open.filter(i => i.scheduledMonth).length;
        const unplaced = open.filter(i => !i.scheduledMonth).length;
        const incomeMissing = !(t.settings && t.settings.income > 0);
        if (incomeMissing) {
            root.innerHTML = `<div class="plan-header"><div class="eyebrow"><span class="material-symbols-rounded" style="font-size:14px">event_note</span> Spending planner</div><div class="headline">Set your monthly income in <a href="#" onclick="event.preventDefault();showPage('settings')" style="color:var(--plan-1);text-decoration:underline">Settings</a> to use the planner.</div></div>`;
            return;
        }
        root.innerHTML = `
<div class="plan-header">
    <div class="eyebrow"><span class="material-symbols-rounded" style="font-size:14px">event_note</span> Spending planner</div>
    <div class="headline">Targeting <span class="pct" onclick="onSavingsTargetEdit()">${targetPct}% saved</span> by Dec</div>
    <div class="meta">
        <span class="${deltaCls}">${delta >= 0 ? 'on track' : 'over'} ${deltaText} headroom</span>
        <span style="opacity:.5">·</span>
        <span>${planted} planted</span>
        <span style="opacity:.5">·</span>
        <span>${unplaced} unplaced</span>
    </div>
</div>`;
    }

    function renderLane() {
        const root = $('plan-lane-section'); if (!root) return;
        const w = window.wishlistStore; if (!w) { root.innerHTML = ''; return; }
        const months = w.computeHeadroom();
        const sel = getCurrentPlanMonth();
        const cards = months.map(m => {
            const cls = m.headroom >= 500 ? 'good' : m.headroom >= 0 ? 'warn' : 'bad';
            const empty = m.plantedItems.length === 0 ? 'empty' : '';
            const selectedCls = sel === m.ym ? 'selected' : '';
            const items = m.plantedItems.slice(0, 3).map(i => `<div class="pi ${i.priority}"><span class="name">${escapeHtml(i.name)}</span><span class="cost">$${fmt(i.cost)}</span></div>`).join('');
            const more = m.plantedItems.length > 3 ? `<div class="pi" style="border-left:0;background:transparent;color:var(--on-surface-faint);font-family:'JetBrains Mono';font-size:10px">+${m.plantedItems.length - 3} more</div>` : '';
            const afterCommit = m.income - m.fixed - m.typicalVariable - m.planted;
            const pctSaved = m.income > 0 ? Math.max(0, Math.round((afterCommit / m.income) * 100)) : 0;
            const progressW = Math.min(100, Math.max(0, pctSaved));
            return `
<div class="month-card ${empty} ${selectedCls}" onclick="selectPlanMonth('${m.ym}')">
    <div class="head"><span class="name">${m.label}<span class="yr">${m.year}</span></span><span class="headroom-chip ${cls}">${m.headroom >= 0 ? '+' : ''}$${fmt(m.headroom)}</span></div>
    <div class="planted">${items || '<div style="font-size:11px;color:var(--on-surface-faint);font-family:Inter Tight">no items</div>'}${more}</div>
    <div class="progress"><span style="width:${progressW}%"></span></div>
    <div class="footnote">${pctSaved}% saved</div>
</div>`;
        }).join('');
        root.innerHTML = `
<div class="plan-section-head"><span class="title">Months ahead</span><span class="meta">${months.length} mo</span></div>
<div class="plan-lane">${cards}</div>`;
    }

    function renderMonthDetail() {
        const root = $('plan-month-detail'); if (!root) return;
        const ym = getCurrentPlanMonth();
        const w = window.wishlistStore; if (!w) { root.classList.add('hidden'); return; }
        if (!ym) { root.classList.add('hidden'); root.innerHTML = ''; return; }
        const m = w.computeHeadroom().find(x => x.ym === ym);
        if (!m) { root.classList.add('hidden'); return; }
        root.classList.remove('hidden');
        const longLabel = m.longLabel.toUpperCase();
        const afterCommit = m.income - m.fixed - m.typicalVariable - m.planted;
        const afterCommitPct = m.income > 0 ? Math.round((afterCommit / m.income) * 100) : 0;
        const itemRows = m.plantedItems.map(i => `
<div class="row">
    <span class="badge ${i.priority}">${i.priority}</span>
    <span class="name">${escapeHtml(i.name)}</span>
    <span class="cost">$${fmt(i.cost)}</span>
    <button class="x" onclick="onWishUnschedule('${i.id}')" aria-label="Remove from this month"><span class="material-symbols-rounded" style="font-size:18px">close</span></button>
</div>`).join('');
        root.innerHTML = `
<div class="month-detail-card">
    <div class="eyebrow">EXPANDED · ${longLabel} ${m.year}</div>
    <div class="name">${m.longLabel}</div>
    <div class="table">
        <div class="row"><span>Income</span><span>$${fmt(m.income)}</span></div>
        <div class="row muted"><span>− Fixed</span><span>−$${fmt(m.fixed)}</span></div>
        <div class="row muted"><span>− Typical variable</span><span>−$${fmt(m.typicalVariable)}</span></div>
        <div class="sep"></div>
        <div class="row"><span>Available room</span><span>$${fmt(m.income - m.fixed - m.typicalVariable)}</span></div>
        ${m.plantedItems.map(i => `<div class="row muted"><span>− Planted: ${escapeHtml(i.name)}</span><span>−$${fmt(i.cost)}</span></div>`).join('')}
        <div class="sep"></div>
        <div class="row total ${afterCommit >= 0 ? 'good' : ''}"><span>After commitments</span><span>$${fmt(afterCommit)} (${afterCommitPct}%)</span></div>
    </div>
    ${itemRows ? `<div class="items">${itemRows}</div>` : ''}
</div>`;
    }

    function renderWishlist() {
        const root = $('plan-wishlist-section'); if (!root) return;
        const w = window.wishlistStore; if (!w) { root.innerHTML = ''; return; }
        const tab = getWlTab();
        const tabs = ['open', 'bought', 'cancelled'];
        const counts = { open: w.open().length, bought: w.bought().length, cancelled: w.cancelled().length };
        const tabBtns = tabs.map(t => `<button class="${tab === t ? 'active' : ''}" onclick="switchWishTab('${t}')">${t.charAt(0).toUpperCase()+t.slice(1)} · ${counts[t]}</button>`).join('');
        let body = '';
        if (tab === 'open') {
            const unsched = w.unscheduled();
            const sched = w.open().filter(i => i.scheduledMonth);
            // Sort scheduled by month
            sched.sort((a,b) => (a.scheduledMonth||'').localeCompare(b.scheduledMonth||''));
            const renderRow = (i) => {
                const m = i.scheduledMonth;
                const monthChip = m
                    ? `<span class="month-chip" onclick="selectPlanMonth('${m}');document.getElementById('plan-page').scrollIntoView({behavior:'smooth'})">${ymLabel(m)}</span>`
                    : `<button class="find-spot" onclick="onWishFindSpot('${i.id}')">FIND A SPOT</button>`;
                const note = i.notes ? `<div class="note">${escapeHtml(i.notes)}</div>` : '';
                return `
<div class="wl-row">
    <span class="badge ${i.priority}">${i.priority}</span>
    <div class="body"><div class="name">${escapeHtml(i.name)}</div>${note}</div>
    <span class="cost">$${fmt(i.cost)}</span>
    ${monthChip}
    <div class="actions">
        <button onclick="onWishMarkBought('${i.id}')" aria-label="Mark bought" title="Mark bought"><span class="material-symbols-rounded" style="font-size:18px">check</span></button>
        <button onclick="onWishEdit('${i.id}')" aria-label="More" title="Edit"><span class="material-symbols-rounded" style="font-size:18px">more_horiz</span></button>
    </div>
</div>`;
            };
            const unschedHtml = unsched.length === 0 ? '' : `<div class="wl-section-label">Unscheduled · ${unsched.length}</div><div class="wl-card">${unsched.map(renderRow).join('')}</div>`;
            const schedHtml = sched.length === 0 ? '' : `<div class="wl-section-label">Scheduled · ${sched.length}</div><div class="wl-card">${sched.map(renderRow).join('')}</div>`;
            body = unschedHtml + schedHtml;
            if (!body) body = `<div class="plan-empty">No wishes yet. Tap <strong>+</strong> to add one.</div>`;
        } else if (tab === 'bought') {
            const list = w.bought();
            body = list.length === 0
                ? `<div class="plan-empty">Nothing bought yet.</div>`
                : `<div class="wl-card">${list.map(i => `
<div class="wl-row bought">
    <span class="badge ${i.priority}">${i.priority}</span>
    <div class="body"><div class="name">${escapeHtml(i.name)}</div></div>
    <span class="cost">$${fmt(i.cost)}</span>
    <span class="done-chip">DONE</span>
    <div class="actions"><button onclick="onWishDelete('${i.id}')" aria-label="Delete"><span class="material-symbols-rounded" style="font-size:18px">delete</span></button></div>
</div>`).join('')}</div>`;
        } else {
            const list = w.cancelled();
            body = list.length === 0
                ? `<div class="plan-empty">No cancelled wishes.</div>`
                : `<div class="wl-card">${list.map(i => `
<div class="wl-row" style="opacity:0.6">
    <span class="badge ${i.priority}">${i.priority}</span>
    <div class="body"><div class="name">${escapeHtml(i.name)}</div></div>
    <span class="cost">$${fmt(i.cost)}</span>
    <div class="actions">
        <button onclick="onWishUncancel('${i.id}')" aria-label="Restore"><span class="material-symbols-rounded" style="font-size:18px">undo</span></button>
        <button onclick="onWishDelete('${i.id}')" aria-label="Delete"><span class="material-symbols-rounded" style="font-size:18px">delete</span></button>
    </div>
</div>`).join('')}</div>`;
        }
        root.innerHTML = `
<div class="plan-section-head"><span class="title">Wishlist</span></div>
<div class="wl-tabs">${tabBtns}</div>
${body}`;
    }

    window.switchWishTab = function (t) {
        if (!['open','bought','cancelled'].includes(t)) return;
        setWlTab(t);
        renderWishlist();
    };

    window.selectPlanMonth = function (ym) {
        const cur = getCurrentPlanMonth();
        setCurrentPlanMonth(cur === ym ? null : ym);
        renderLane();
        renderMonthDetail();
    };

    // Subscribe so any wishlistStore mutation re-renders the page.
    if (window.wishlistStore) {
        window.wishlistStore.subscribe(() => {
            if (window.expenseTracker && window.expenseTracker.currentPage === 'plan') {
                renderPlanPage();
            }
        });
    }
})();
```

- [ ] **Step 2: Wire the renderer into the page**

Edit `index.html`. After `<script src="js/trip-dashboard.js"></script>` (~line 25), add:

```html
    <script src="js/trip-dashboard.js"></script>
    <script src="js/plan-page.js"></script>
    <script src="js/merchant-frequency.js"></script>
```

- [ ] **Step 3: Wire `showPage` to render the Plan page**

Edit `script.js:309-317`. Replace the `map` object:

```javascript
        const map = {
            'dashboard': 'dashboard-page',
            'trips': 'trips-page',
            'trip-dashboard': 'trip-dashboard-page',
            'plan': 'plan-page',
            'transactions': 'transactions-page',
            'history': 'history-page',
            'add-expense': 'add-expense-page',
            'settings': 'settings-page'
        };
```

Then edit `script.js:325`:

```javascript
        const navBtnId = { dashboard: 'nav-home', trips: 'nav-trips', 'trip-dashboard': 'nav-trips', plan: 'nav-plan', transactions: 'nav-txns', history: 'nav-history' }[pageId];
```

Then below the existing renderer hooks (`script.js:331-334`), add a hook:

```javascript
        if (pageId === 'plan' && typeof renderPlanPage === 'function') renderPlanPage();
```

Also, hide the FAB when leaving Plan: at the very top of `showPage` (right after the trip clearing block), add:

```javascript
        if (pageId !== 'plan') {
            const fab = document.getElementById('plan-fab');
            if (fab) fab.classList.add('hidden');
        }
```

- [ ] **Step 4: Smoke test**

Run `./test.sh` and expect PASS.

`npm run dev`. Tap the Plan tab.
- Header strip shows "Targeting 50% saved by Dec" (or income empty state)
- Lane shows month cards from current month → Dec
- Wishlist section shows "No wishes yet. Tap + to add one." under Open tab
- FAB visible bottom-right

In console, create a wish and verify it appears unscheduled:

```js
window.wishlistStore.create({ name: 'iPad', cost: 400, priority: 'want' })
// page should re-render automatically; row should appear under "Unscheduled"
```

- [ ] **Step 5: Commit**

```bash
git add js/plan-page.js index.html script.js
git commit -m "Plan: page renderer (header strip, lane, wishlist sections)"
```

---

### Task B2: Wish add/edit modal + manual actions (mark bought, cancel, delete, edit, find a spot, unschedule)

**Files:**
- Modify: `js/plan-page.js` (append modal + action handlers)

- [ ] **Step 1: Append modal logic**

At the end of the IIFE in `js/plan-page.js`, BEFORE the closing `})();`, add:

```javascript
    // === Modal ===
    function getEditState() { return window.expenseTracker?._wishEditId || null; }
    function setEditState(id) { if (window.expenseTracker) window.expenseTracker._wishEditId = id; }
    function getModalPriority() { return window.expenseTracker?._wishModalPri || 'want'; }
    function setModalPriority(p) { if (window.expenseTracker) window.expenseTracker._wishModalPri = p; }

    function renderModal() {
        const card = $('wish-modal-card'); if (!card) return;
        const editId = getEditState();
        const item = editId ? window.wishlistStore.getById(editId) : null;
        const pri = item ? item.priority : (getModalPriority() || 'want');
        setModalPriority(pri);
        card.innerHTML = `
<form class="wish-modal-form" onsubmit="event.preventDefault();submitWish()">
    <div style="display:flex;align-items:center;justify-content:space-between"><h3 style="font-family:'Fraunces',serif;font-size:22px;color:var(--md-sys-color-on-surface);margin:0">${editId ? 'Edit wish' : 'Add a wish'}</h3><button type="button" onclick="closeWishModal()" style="background:transparent;border:0;color:var(--on-surface-faint);cursor:pointer"><span class="material-symbols-rounded">close</span></button></div>
    <div><label>Name</label><input type="text" id="wish-name" required maxlength="80" value="${item ? escapeHtml(item.name) : ''}" placeholder="e.g. New York trip"></div>
    <div><label>Cost</label><input type="number" id="wish-cost" required min="0.01" step="0.01" value="${item ? item.cost : ''}" placeholder="0"></div>
    <div><label>Priority</label>
        <div class="pri-pills">
            <button type="button" data-p="must" class="${pri==='must'?'active':''}" onclick="onWishPriPill('must')">Must</button>
            <button type="button" data-p="want" class="${pri==='want'?'active':''}" onclick="onWishPriPill('want')">Want</button>
            <button type="button" data-p="nice" class="${pri==='nice'?'active':''}" onclick="onWishPriPill('nice')">Nice</button>
        </div>
    </div>
    <div><label>Notes (optional)</label><textarea id="wish-notes" rows="2" maxlength="200">${item ? escapeHtml(item.notes||'') : ''}</textarea></div>
    <div class="actions">
        <button type="submit" class="primary">${editId ? 'Save' : 'Add'}</button>
        ${editId ? `<button type="button" class="secondary" onclick="onWishDelete('${editId}')">Delete</button>` : ''}
    </div>
</form>`;
        // Focus the name field
        setTimeout(() => { const n = $('wish-name'); if (n) n.focus(); }, 50);
    }

    window.openWishModal = function (editId) {
        const m = $('wish-modal'); if (!m) return;
        setEditState(editId || null);
        if (!editId) setModalPriority('want');
        renderModal();
        m.classList.remove('hidden');
    };

    window.closeWishModal = function () {
        const m = $('wish-modal'); if (!m) return;
        m.classList.add('hidden');
        setEditState(null);
    };

    window.onWishPriPill = function (p) {
        if (!['must','want','nice'].includes(p)) return;
        setModalPriority(p);
        renderModal();
    };

    window.submitWish = async function () {
        const name = $('wish-name')?.value.trim();
        const cost = parseFloat($('wish-cost')?.value);
        const notes = $('wish-notes')?.value.trim() || '';
        const priority = getModalPriority();
        if (!name || !cost || cost <= 0) return;
        const editId = getEditState();
        try {
            if (editId) {
                await window.wishlistStore.update(editId, { name, cost, priority, notes });
            } else {
                const item = await window.wishlistStore.create({ name, cost, priority, notes });
                // Auto-place
                const ym = window.wishlistStore.findSpot(item);
                if (ym) await window.wishlistStore.update(item.id, { scheduledMonth: ym });
            }
            window.closeWishModal();
        } catch (e) {
            alert(e.message || 'Could not save wish.');
        }
    };

    window.onWishMarkBought = async function (id) {
        await window.wishlistStore.update(id, { status: 'bought' });
    };
    window.onWishCancel = async function (id) {
        await window.wishlistStore.update(id, { status: 'cancelled' });
    };
    window.onWishUncancel = async function (id) {
        await window.wishlistStore.update(id, { status: 'open' });
    };
    window.onWishUnschedule = async function (id) {
        await window.wishlistStore.update(id, { scheduledMonth: null });
    };
    window.onWishDelete = async function (id) {
        if (!confirm('Delete this wish? This cannot be undone.')) return;
        await window.wishlistStore.delete(id);
        if (getEditState() === id) window.closeWishModal();
    };
    window.onWishEdit = function (id) { window.openWishModal(id); };
    window.onWishFindSpot = async function (id) {
        const item = window.wishlistStore.getById(id);
        if (!item) return;
        const ym = window.wishlistStore.findSpot(item);
        if (ym) {
            await window.wishlistStore.update(id, { scheduledMonth: ym });
        } else {
            alert(`"${item.name}" won't fit before Dec at current pace.\n\nIncrease income, cancel something, or wait.`);
        }
    };

    window.onSavingsTargetEdit = function () {
        const t = window.expenseTracker; if (!t) return;
        const cur = (t.settings && t.settings.savingsTargetRate) || 0.50;
        const input = prompt(`Savings target (30–70%):`, Math.round(cur * 100));
        if (input == null) return;
        let pct = parseFloat(input);
        if (!Number.isFinite(pct)) return;
        pct = Math.max(30, Math.min(70, pct));
        t.settings.savingsTargetRate = pct / 100;
        localStorage.setItem('settings', JSON.stringify(t.settings));
        if (window.currentUser && typeof t.saveSettingsToFirebase === 'function') t.saveSettingsToFirebase();
        if (window.wishlistStore) window.wishlistStore.bustCache();
        renderPlanPage();
    };
```

- [ ] **Step 2: Smoke test**

`npm run dev`. On Plan tab:
- Tap FAB → modal opens with Name / Cost / Priority pills / Notes
- Add "iPad" $400 want → row appears under Scheduled (some month)
- Tap "FIND A SPOT" on an unscheduled item → it gets a month chip
- Tap ✓ on a wish → moves to Bought tab
- Tap ⋯ → modal opens prefilled, edit and save → row updates
- In Bought tab: delete works
- Tap the gradient `50% saved` text → prompt opens, change to 60%, header updates

- [ ] **Step 3: Commit**

```bash
git add js/plan-page.js
git commit -m "Plan: wish modal + manual actions (bought/cancel/edit/delete/findSpot)"
```

---

## Phase C — Settings + recompute wiring + nav alignment

### Task C1: Settings — add `savingsTargetRate` default and Settings slider

**Files:**
- Modify: `script.js` (default settings, loadSettings, saveSettings)
- Modify: `index.html` (Settings card markup for the slider)

- [ ] **Step 1: Add the default**

Edit `script.js:228-235` (the `getDefaultSettings` block). Find the line:

```javascript
            incomeOverrides: {}, // { "YYYY-MM": amount } for one-off months
```

Right after it, add:

```javascript
            savingsTargetRate: 0.50, // 0.30–0.70 — anchors the Spending Planner. Spec §2.
```

- [ ] **Step 2: Add the Settings card markup**

Edit `index.html`. Find `<!-- Category Budgets (sliders) -->` (around line 192). Insert this BEFORE it:

```html
            <!-- Savings Target (Spending Planner) -->
            <div class="card p-5">
                <div class="flex items-center gap-2 mb-1">
                    <span class="material-symbols-rounded" style="color:#ffb84d;font-size:20px">event_note</span>
                    <h3 class="text-base font-medium" style="color:var(--md-sys-color-on-surface)">Savings target</h3>
                </div>
                <p class="text-xs mb-3 ml-7" style="color:var(--md-sys-color-outline)">Anchors the <a href="#" onclick="event.preventDefault();showPage('plan')" style="color:#ffb84d">Spending Planner</a>. We'll keep your year-end rate above this.</p>
                <div class="flex items-center gap-3 px-1">
                    <span class="text-xs" style="color:var(--md-sys-color-outline);font-family:'JetBrains Mono'">30%</span>
                    <input type="range" min="30" max="70" step="1" id="setting-savings-target" oninput="document.getElementById('savings-target-display').textContent=this.value+'%'" style="flex:1;accent-color:#ffb84d;height:4px">
                    <span class="text-xs" style="color:var(--md-sys-color-outline);font-family:'JetBrains Mono'">70%</span>
                </div>
                <div class="text-center text-sm font-semibold mt-2" style="color:#ffb84d" id="savings-target-display">50%</div>
            </div>
```

- [ ] **Step 3: Wire `loadSettings` and `saveSettings`**

Edit `script.js:1336` (inside `loadSettings`). After the `setting-income` line, add:

```javascript
        const tgt = document.getElementById('setting-savings-target');
        if (tgt) {
            const pct = Math.round(((this.settings.savingsTargetRate ?? 0.50) * 100));
            tgt.value = pct;
            const disp = document.getElementById('savings-target-display');
            if (disp) disp.textContent = pct + '%';
        }
```

Edit `script.js:1359` (inside `saveSettings`). After the `setting-income` line, add:

```javascript
        const tgtInput = document.getElementById('setting-savings-target');
        if (tgtInput) {
            const pct = parseInt(tgtInput.value, 10);
            if (Number.isFinite(pct)) this.settings.savingsTargetRate = Math.max(30, Math.min(70, pct)) / 100;
        }
```

After `this.updateDashboard();` line (~`script.js:1377`), add:

```javascript
        if (window.wishlistStore) window.wishlistStore.bustCache();
```

- [ ] **Step 4: Smoke test**

`npm run dev` → Settings tab. The slider shows 50% by default. Drag to 60%, label updates, hit Save Settings, return to Plan tab — header shows "Targeting 60% saved by Dec".

- [ ] **Step 5: Commit**

```bash
git add script.js index.html
git commit -m "Plan: savingsTargetRate setting + slider"
```

---

### Task C2: Recompute hooks — bust the wishlist cache when expenses/trips/settings change

**Files:**
- Modify: `script.js` (`updateDashboard` end-of-method hook)

The store has its own `_emit` that buster cache, but mutations from outside (new expense, new trip, settings save) don't go through it. We need to bust the cache and notify the Plan page if it's open.

- [ ] **Step 1: Add the hook to `updateDashboard`**

Find `updateDashboard` in `script.js`. Search for the end of the method body. Append (just before its closing `}`):

```javascript
        // Plan: recompute headroom math whenever the dashboard refreshes,
        // since that's our single point of "expenses/trips/settings may have changed".
        // Cache bust + re-render Plan if it's the active page. Spec §5.3.
        if (window.wishlistStore) {
            window.wishlistStore._headroomCache = null;
            if (this.currentPage === 'plan' && typeof renderPlanPage === 'function') {
                renderPlanPage();
            }
        }
```

(If `updateDashboard` doesn't exist with that exact name, search `grep -n "updateDashboard()" script.js` for the method definition. Insert the block as the last statement inside the method body.)

- [ ] **Step 2: Smoke test recompute**

`npm run dev`. With Plan tab open:
- Add a wish "iPad" $400 → it auto-places, header updates
- Switch to Add expense → log a $200 expense → switch back to Plan → typical-variable likely changes, lane chip values shift accordingly
- Switch to Trips → create a new trip → switch back to Plan → no crash; lane re-renders

- [ ] **Step 3: Commit**

```bash
git add script.js
git commit -m "Plan: bust headroom cache on every dashboard refresh"
```

---

### Task C3: Service worker cache bump

**Files:**
- Modify: `sw.js`

- [ ] **Step 1: Bump cache version**

Edit `sw.js`. Find the `CACHE_NAME = 'expense-tracker-v...'` line. Increment by one (e.g. `v7` → `v8`).

- [ ] **Step 2: Commit**

```bash
git add sw.js
git commit -m "Plan: bump SW cache to v8"
```

---

## Phase D — Edge cases + polish

### Task D1: "Won't fit before Dec" warning row + target-unreachable banner

**Files:**
- Modify: `js/plan-page.js`

When an item is unscheduled AND `findSpot` returns null, the row should show a red note instead of "FIND A SPOT" — and the header strip should show a target-unreachable amber banner.

- [ ] **Step 1: Replace `renderHeaderStrip` to add unreachable banner**

In `js/plan-page.js`, replace the `renderHeaderStrip` function entirely with this enhanced version:

```javascript
    function renderHeaderStrip() {
        const root = $('plan-header-strip'); if (!root) return;
        const t = window.expenseTracker, w = window.wishlistStore;
        if (!t || !w) { root.innerHTML = ''; return; }
        const target = (t.settings && t.settings.savingsTargetRate) || 0.50;
        const targetPct = Math.round(target * 100);
        const projected = w.projectedYearRate();
        const delta = projected - target;
        const deltaPct = Math.round(delta * 100 * 10) / 10;
        const deltaCls = delta >= 0 ? 'delta-good' : 'delta-bad';
        const deltaText = (delta >= 0 ? '+' : '') + deltaPct + 'pt';
        const open = w.open();
        const planted = open.filter(i => i.scheduledMonth).length;
        const unplaced = open.filter(i => !i.scheduledMonth).length;
        const incomeMissing = !(t.settings && t.settings.income > 0);
        if (incomeMissing) {
            root.innerHTML = `<div class="plan-header"><div class="eyebrow"><span class="material-symbols-rounded" style="font-size:14px">event_note</span> Spending planner</div><div class="headline">Set your monthly income in <a href="#" onclick="event.preventDefault();showPage('settings')" style="color:var(--plan-1);text-decoration:underline">Settings</a> to use the planner.</div></div>`;
            return;
        }
        // Target-unreachable check: even with zero wishlist, projected < target?
        const itemsBackup = w.items;
        const ratesNoWishes = (() => {
            // simulate: pretend no scheduled items
            const orig = itemsBackup.map(i => i.scheduledMonth);
            try {
                w.items = itemsBackup.map(i => ({ ...i, scheduledMonth: null }));
                w._headroomCache = null;
                return w.projectedYearRate();
            } finally {
                w.items = itemsBackup;
                w._headroomCache = null;
            }
        })();
        const unreachable = ratesNoWishes < target - 0.005; // tolerance
        const unreachableBanner = unreachable
            ? `<div class="meta" style="color:#ffd166;border-top:1px dashed rgba(255,210,77,0.3);padding-top:8px;margin-top:10px"><span class="material-symbols-rounded" style="font-size:14px">warning</span> Current pace ${Math.round(ratesNoWishes*100)}% — spending too high to reach ${targetPct}% even with no wishes</div>`
            : '';
        root.innerHTML = `
<div class="plan-header">
    <div class="eyebrow"><span class="material-symbols-rounded" style="font-size:14px">event_note</span> Spending planner</div>
    <div class="headline">Targeting <span class="pct" onclick="onSavingsTargetEdit()">${targetPct}% saved</span> by Dec</div>
    <div class="meta">
        <span class="${deltaCls}">${delta >= 0 ? 'on track' : 'over'} ${deltaText} headroom</span>
        <span style="opacity:.5">·</span>
        <span>${planted} planted</span>
        <span style="opacity:.5">·</span>
        <span>${unplaced} unplaced</span>
    </div>
    ${unreachableBanner}
</div>`;
    }
```

- [ ] **Step 2: In `renderWishlist`, mark unfittable unscheduled items**

In `js/plan-page.js`, inside `renderRow` (within `renderWishlist`), replace the `monthChip` ternary with this version that pre-checks fit:

```javascript
                let monthChip;
                if (m) {
                    monthChip = `<span class="month-chip" onclick="selectPlanMonth('${m}');document.getElementById('plan-page').scrollIntoView({behavior:'smooth'})">${ymLabel(m)}</span>`;
                } else {
                    const ymCandidate = window.wishlistStore.findSpot(i);
                    monthChip = ymCandidate
                        ? `<button class="find-spot" onclick="onWishFindSpot('${i.id}')">FIND A SPOT</button>`
                        : `<button class="find-spot fail" onclick="onWishFindSpot('${i.id}')" title="Won't fit before Dec at current pace">WON'T FIT</button>`;
                }
```

- [ ] **Step 3: Smoke test**

In console:

```js
// Force unreachable: set huge wishlist
for (let i=0; i<10; i++) await window.wishlistStore.create({ name:'Big '+i, cost:5000, priority:'want' })
```

Page should show:
- Most items ending up with "WON'T FIT" red label
- Header banner: "Current pace X% — spending too high to reach 50% even with no wishes"

Cleanup:

```js
for (const i of window.wishlistStore.all()) await window.wishlistStore.delete(i.id)
```

- [ ] **Step 4: Commit**

```bash
git add js/plan-page.js
git commit -m "Plan: target-unreachable banner + WON'T FIT row state"
```

---

### Task D2: Bumping prompt — when a `must` item doesn't fit, offer to move a lower-priority auto-placed item

**Files:**
- Modify: `js/wishlist.js` (add `findSpotWithBumping`)
- Modify: `js/plan-page.js` (use it in `onWishFindSpot` when priority is `must`)

Per spec §5.1, when `findSpot()` is called on a `must` item that doesn't fit AND a lower-priority auto-placed item in some month would free enough room if moved, prompt the user.

- [ ] **Step 1: Add `findSpotWithBumping` to the store**

Append inside `class WishlistStore` in `js/wishlist.js`:

```javascript
        // Searches for a "bump" — a lower-priority scheduled item whose removal
        // creates room for `mustItem` and whose new placement still satisfies
        // the target rate. Returns { mustYm, bumpItem, bumpYm } or null.
        findSpotWithBumping(mustItem) {
            const t = window.expenseTracker; if (!t) return null;
            const target = (t.settings && t.settings.savingsTargetRate) || 0.50;
            const pri = { must: 0, want: 1, nice: 2 };
            const months = this.computeHeadroom();
            // Candidate bumps: any scheduled item with lower priority than the must item
            const candidates = this.items.filter(i =>
                i.status === 'open' && i.scheduledMonth && pri[i.priority] > pri[mustItem.priority]
            );
            for (const m of months) {
                // For each candidate scheduled INTO this month, see if removing it makes room
                const bumpsHere = candidates.filter(c => c.scheduledMonth === m.ym);
                for (const bump of bumpsHere) {
                    const remaining = m.headroom + bump.cost; // freed up
                    if (remaining < mustItem.cost) continue;
                    // Need to also confirm we can still find a place for the bumped item
                    // and that overall projected rate stays >= target.
                    const origMust = mustItem.scheduledMonth;
                    const origBump = bump.scheduledMonth;
                    try {
                        mustItem.scheduledMonth = m.ym;
                        bump.scheduledMonth = null;
                        this._headroomCache = null;
                        const bumpTarget = this.findSpot(bump);
                        if (!bumpTarget) continue;
                        bump.scheduledMonth = bumpTarget;
                        this._headroomCache = null;
                        const rate = this.projectedYearRate();
                        if (rate >= target) {
                            return { mustYm: m.ym, bumpItem: { ...bump }, bumpYm: bumpTarget };
                        }
                    } finally {
                        mustItem.scheduledMonth = origMust;
                        bump.scheduledMonth = origBump;
                        this._headroomCache = null;
                    }
                }
            }
            return null;
        }
```

- [ ] **Step 2: Wire the prompt into the user action**

In `js/plan-page.js`, replace `window.onWishFindSpot` with this version:

```javascript
    window.onWishFindSpot = async function (id) {
        const item = window.wishlistStore.getById(id);
        if (!item) return;
        const ym = window.wishlistStore.findSpot(item);
        if (ym) {
            await window.wishlistStore.update(id, { scheduledMonth: ym });
            return;
        }
        // No straight fit. Try bumping if this is a must item.
        if (item.priority === 'must') {
            const bump = window.wishlistStore.findSpotWithBumping(item);
            if (bump) {
                const bumpItem = window.wishlistStore.getById(bump.bumpItem.id);
                const monthLabel = (ym) => ymLabel(ym);
                if (confirm(`"${item.name}" needs $${fmt(item.cost)}.\n${monthLabel(bump.mustYm)} is full.\n\nMove "${bumpItem.name}" ($${fmt(bumpItem.cost)}, ${bumpItem.priority}) to ${monthLabel(bump.bumpYm)} to make room?`)) {
                    await window.wishlistStore.update(bumpItem.id, { scheduledMonth: bump.bumpYm });
                    await window.wishlistStore.update(id, { scheduledMonth: bump.mustYm });
                    return;
                }
            }
        }
        alert(`"${item.name}" won't fit before Dec at current pace.\n\nIncrease income, cancel something, or wait.`);
    };
```

- [ ] **Step 3: Smoke test**

In console:

```js
// Pack a month, then introduce a must
await window.wishlistStore.create({ name:'iPad', cost:1500, priority:'want' })
await window.wishlistStore.create({ name:'NY trip', cost:1500, priority:'must' })
```

If the iPad lands in May and NY needs May, the bump prompt should fire. Confirm to apply.

- [ ] **Step 4: Commit**

```bash
git add js/wishlist.js js/plan-page.js
git commit -m "Plan: bump prompt for must items blocked by want/nice"
```

---

### Task D3: Past-dated `scheduledMonth` cleanup on month boundary

**Files:**
- Modify: `js/wishlist.js`

Per spec §5.3, when the month boundary crosses, items scheduled into a now-past month should be unscheduled (they were planned for May, May ended, the user didn't buy them — re-place them).

- [ ] **Step 1: Add `_sweepPastScheduled`**

Append inside `class WishlistStore`:

```javascript
        // Run on each computeHeadroom() call. If an open item's scheduledMonth
        // is now in the past, clear it so it shows up in Unscheduled instead
        // of being lost behind the lane (which only renders future months).
        _sweepPastScheduled() {
            const todayYM = (() => { const d = new Date(); return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0'); })();
            let changed = false;
            for (const i of this.items) {
                if (i.status === 'open' && i.scheduledMonth && i.scheduledMonth < todayYM) {
                    i.scheduledMonth = null;
                    i.updatedAt = Date.now();
                    changed = true;
                    this._writeRemote(i); // best-effort, not awaited
                }
            }
            if (changed) {
                saveLocal(this.items);
            }
        }
```

- [ ] **Step 2: Call it from `computeHeadroom`**

At the very top of `computeHeadroom` (before the cache check):

```javascript
        computeHeadroom() {
            this._sweepPastScheduled();
            if (this._headroomCache) return this._headroomCache;
            // ... rest unchanged
```

- [ ] **Step 3: Smoke test**

In console:

```js
// Manually plant a past month
const id = (await window.wishlistStore.create({ name:'Past', cost:50, priority:'nice' })).id
await window.wishlistStore.update(id, { scheduledMonth: '2026-01' })
window.wishlistStore.computeHeadroom() // should sweep
window.wishlistStore.getById(id).scheduledMonth // null
```

Cleanup: `await window.wishlistStore.delete(id)`.

- [ ] **Step 4: Commit**

```bash
git add js/wishlist.js
git commit -m "Plan: sweep past-dated scheduled items on recompute"
```

---

### Task D4: Item cost > single-month headroom — show in unscheduled with explanation

**Files:**
- Modify: `js/plan-page.js` (special-case the row label for oversized items)

- [ ] **Step 1: Detect oversized items**

In `js/plan-page.js`, inside `renderRow`, after computing `monthChip`, also compute a hint for oversized items:

Replace the unscheduled `monthChip` block (added in Task D1, Step 2) with:

```javascript
                let monthChip;
                if (m) {
                    monthChip = `<span class="month-chip" onclick="selectPlanMonth('${m}');document.getElementById('plan-page').scrollIntoView({behavior:'smooth'})">${ymLabel(m)}</span>`;
                } else {
                    const months = window.wishlistStore.computeHeadroom();
                    const maxHeadroom = months.reduce((mx, x) => Math.max(mx, x.headroom), 0);
                    if (i.cost > maxHeadroom && maxHeadroom > 0) {
                        monthChip = `<button class="find-spot fail" onclick="onWishFindSpot('${i.id}')" title="Cost exceeds any single-month headroom — split into two wishes or wait">TOO BIG</button>`;
                    } else {
                        const ymCandidate = window.wishlistStore.findSpot(i);
                        monthChip = ymCandidate
                            ? `<button class="find-spot" onclick="onWishFindSpot('${i.id}')">FIND A SPOT</button>`
                            : `<button class="find-spot fail" onclick="onWishFindSpot('${i.id}')" title="Won't fit before Dec at current pace">WON'T FIT</button>`;
                    }
                }
```

- [ ] **Step 2: Smoke test**

```js
await window.wishlistStore.create({ name:'House', cost:99999, priority:'want' })
```

Row should show "TOO BIG" red label. Tapping it triggers the existing alert.

Cleanup as above.

- [ ] **Step 3: Commit**

```bash
git add js/plan-page.js
git commit -m "Plan: TOO BIG state for oversized wishes"
```

---

## Phase E — Final verification

### Task E1: End-to-end test pass

- [ ] **Step 1: Run the smoke test**

```bash
./test.sh
```

Expected: all checks pass (build OK, JS syntax OK, no missing onclick handlers, no undeclared `getElementById` IDs).

- [ ] **Step 2: Browser checklist**

Run `npm run dev` and walk through each of these in turn:

1. **No income empty state.** Set income to 0 in Settings → Save → Plan → header strip says "Set your monthly income in Settings".
2. **Add wish auto-places.** Restore income (e.g. 8600) → Plan → FAB → "iPad" $400 want → row appears under Scheduled (current month most likely).
3. **Wish modal validation.** FAB → empty name and submit → does nothing. Add zero cost → does nothing.
4. **Edit.** ⋯ on a wish → modal opens with prefilled values → change cost to $500 → Save → row updates.
5. **Mark bought.** ✓ button → moves to Bought tab. Bought tab shows DONE chip.
6. **No expense created.** History → no $400 line for the iPad. (Spec §5.2.)
7. **Cancel + uncancel.** Edit a wish → make a new one, cancel via Bought tab? — actually, cancellation only happens from open via ⋯ → use Edit menu → Delete (we don't expose Cancel in the modal in v1). Use Cancelled tab to verify the empty state "No cancelled wishes." (User can manually call `wishlistStore.update(id, { status: 'cancelled' })` from console for now.)
8. **Manual move via lane.** Tap a month card → expanded card shows the item with `✕` → tap ✕ → item becomes unscheduled.
9. **Find a spot.** On unscheduled row, tap "FIND A SPOT" → it picks a month.
10. **Won't fit.** Add a $50,000 want → row says "WON'T FIT" or "TOO BIG". Header "current pace" banner shows.
11. **Bumping.** With `iPad` $400 want planted in May, add `NY trip` $9999 must → bump prompt fires for iPad.
12. **Target slider.** Tap gradient `50% saved` → enter 65 → header updates. Settings → slider position matches → Save → Plan reflects it.
13. **Recompute on expense.** Add a $300 expense → return to Plan → typical-variable in lane shifts.
14. **Recompute on trip.** Create a trip → no crash; lane re-renders.
15. **5-tab nav at 393px.** DevTools → set viewport to 393×852 → no overflow, all 5 tabs visible.
16. **Sign-in/out.** Sign out, refresh, sign back in → wishlist persists (Firestore). No duplicates.
17. **Past month sweep.** In console set a wish's `scheduledMonth` to a past month → next page render → item appears under Unscheduled.

- [ ] **Step 3: If all green, final commit**

If you made polish tweaks during the walkthrough, commit them:

```bash
git status
git add <changed files>
git commit -m "Plan: polish from end-to-end test"
```

If no tweaks: skip commit.

- [ ] **Step 4: Hand back to user**

Do NOT push. Report:
- Branch: `main` (commits NOT pushed)
- Spec: `docs/superpowers/specs/2026-05-19-spending-planner-design.md`
- Plan: `docs/superpowers/plans/2026-05-19-spending-planner.md`
- Mock: `mocks/spending-planner.html`
- Test results: list any failed walkthrough items

---

## Spec coverage check

| Spec section | Task |
|---|---|
| §1 Goals — wishlist with name/cost/priority/notes | A1 |
| §1 Goals — savings-rate target (0.30–0.70, default 0.50) | C1 |
| §1 Goals — auto-scheduling | A2 (`findSpot`) |
| §1 Goals — Plan tab as 5th nav | A3 |
| §1 Goals — calendar lane UI | B1 |
| §1 Goals — wishlist Open / Bought / Cancelled tabs, Unscheduled / Scheduled subgroups | B1 |
| §1 Goals — manual move/mark-bought/cancel/edit/delete | B2 |
| §1 Goals — recompute on ledger/settings/trip changes | C2 |
| §2 Mental model — item shape + storage path + store | A1 |
| §3 Headroom math — `_typicalVariableMonth`, `_fixedMonth`, `computeHeadroom`, `projectedYearRate` | A2 |
| §4 UI — bottom nav with Plan accent | A3 |
| §4 UI — page header + meta | A3 + B1 |
| §4 UI — header strip + tappable target | B1 + B2 (`onSavingsTargetEdit`) |
| §4 UI — months ahead lane with cards | B1 |
| §4 UI — month detail card with line table | B1 |
| §4 UI — wishlist with tabs and rows | B1 |
| §4 UI — FAB and modal | A3 (FAB markup) + B2 (modal) |
| §4.3 Visual tokens | A3 |
| §5.1 `findSpot` greedy first-fit | A2 |
| §5.1 Won't fit message | D1 |
| §5.1 Bumping prompt | D2 |
| §5.2 Manual operations | B2 |
| §5.3 Recompute triggers | C2 + store's own `_emit` busts cache on every mutation |
| §5.4 No income empty state | B1 (header strip branch) |
| §5.4 Target unreachable banner | D1 |
| §5.4 Item > single-month headroom | D4 |
| §5.4 Past-dated items don't appear in lane | D3 sweep + lane only renders current → Dec |
| §5.4 Bought trip doesn't auto-link | not implemented (deferred per §9) |
| §5.4 Multiple competing must items | A2 (`findSpot` + creation order) + D2 (bumping chain via repeated calls) |
| §5.5 Storage Firestore + localStorage + realtime | A1 + (auth.js wiring) |
| §5.5 Settings sync of `savingsTargetRate` | C1 |
| §6 Code structure file map | All tasks |
| §7 Migration — empty wishlist + default rate | A1 + C1 (defaults handle it) |
| §8 Testing | E1 |
