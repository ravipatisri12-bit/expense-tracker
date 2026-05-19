# Spending Planner — Design Spec

**Date**: 2026-05-19
**Status**: Approved (in brainstorming)
**Scope**: New "Plan" feature — a deliberate purchase queue with a savings-rate target, scheduling items into upcoming months while keeping projected savings above the target.

---

## 1. Goals and non-goals

### In scope
- A **wishlist** of items (purchases, trips, experiences) with name, cost, priority, and optional notes.
- A **savings-rate target** (default 50%) that anchors the plan.
- **Auto-scheduling** of wishlist items into upcoming months based on monthly headroom math.
- A **Plan tab** added as the 5th item in the bottom nav: Home / Trips / Plan / Txns / History.
- A **calendar lane** UI showing months from "now" through December, each with planted items, headroom, and projected savings %.
- A **wishlist list view** with Open / Bought / Cancelled tabs, grouped by Unscheduled / Scheduled within Open.
- Manual move / mark-bought / cancel / edit / delete operations.
- Recompute triggered by ledger changes, settings changes, trip changes, or month boundary crossings.

### Out of scope (v1)
- Drag-and-drop within the lane (use the move menu instead).
- Auto-creating an expense when an item is marked `bought` — the user's actual spend flows in via Gmail import.
- Sub-categorizing items into types (trips vs. physical items vs. experiences). Items are flat with priority badges.
- Recurring wishlist items (e.g., "Vacation every year").
- Multi-user / shared wishlists.
- Push notifications about wish status.
- Splitting a single wish across multiple months.

### Non-goals (explicit)
- Not a category-cap enforcer. Per-category caps remain a separate concern.
- Not an income optimizer or financial-advice product. The math is descriptive, not prescriptive.
- Not a budgeting tool that blocks spending. We never gate or warn about real expenses based on the plan; the plan is intent, the ledger is reality.

---

## 2. Mental model

The user sets a **target savings rate** (e.g., 50%). The planner is a "house" — every wishlist item has to fit inside it, scheduled into a month where it can be paid for without sinking the year-end rate below target.

Each wishlist item:

```javascript
{
  id: 'w_<id>',                          // collision-free id (mirror nextExpenseId pattern)
  name: 'New York trip',                 // user-typed
  cost: 500,                             // dollars
  priority: 'must' | 'want' | 'nice',    // 3-tier
  scheduledMonth: 'YYYY-MM' | null,      // assigned month; null = unscheduled
  status: 'open' | 'bought' | 'cancelled',
  notes: '',                             // optional free text
  createdAt: timestamp,
  updatedAt: timestamp
}
```

Stored at `users/{uid}/wishlist/{id}` in Firestore + `localStorage['wishlist']` for offline. Single-source-of-truth store: `js/wishlist.js`, exposing `window.wishlistStore` (CRUD + subscribe pattern, mirrors `js/trips.js`).

A new settings field: `settings.savingsTargetRate` (number 0–1, default 0.50, configurable in Settings 0.30–0.70).

---

## 3. Headroom math

For each month from now → December:

```
incomeMonth          = settings.income                    // monthly income
fixedMonth           = rent + utilities + insurance       // from Settings
typicalVariableMonth = trailing-3-month avg of variable spend
                       (logged expenses with tripId == null)
plantedMonth         = sum of cost for wishlist items where scheduledMonth == this month AND status == 'open'

headroomMonth = incomeMonth − fixedMonth − typicalVariableMonth − plantedMonth
```

`headroomMonth` represents money still uncommitted in that month, after the typical variable spend baseline.

**Why trailing 3-month average for typical variable?** A hardcoded $1,500 lies if your trailing actual is $2,400. Trailing average reflects truth. As your spending changes, the planner adapts.

**Edge case — first 3 months of use:** if there isn't 3 months of data, use whatever's available (e.g., 1-month or 2-month avg). If zero data, default `typicalVariableMonth` to `incomeMonth × (1 − target)` (i.e., assume worst case at the target rate). This is conservative.

### Projected year-end savings rate

```
projectedYearRate(year) = (yearIncome − yearSpend) / yearIncome

where:
  yearIncome = settings.income × monthsElapsedInYear
  yearSpend  = loggedSpendThisYear + (typicalVariable × monthsRemaining) + plantedSum
  plantedSum = sum of (cost) for ALL open scheduled items with scheduledMonth in remaining months
  monthsRemaining = 12 − monthsElapsed
```

For the current calendar year only. Past years use actual data.

---

## 4. UI: the Plan page

Reachable via the 5th tab in the bottom nav. At 393px, each tab is 78px wide — labels stay legible, icons stay distinct.

### 4.1 Bottom nav

| Tab | Icon | Active accent |
|---|---|---|
| Home | `home` | `--m-1` violet |
| Trips | `flight` | `--trip-2` cyan |
| Plan | `event_note` | `--plan-1` warm yellow `#ffb84d` |
| Txns | `receipt_long` | `--m-1` violet |
| History | `history` | `--m-1` violet |

The Plan accent (warm yellow) is **deliberate**, not alarmist. Distinct from monthly violet (everyday), trip cyan (outsized), and saved green (good-news-only).

### 4.2 Page sections (top to bottom)

1. **Page header** — Fraunces "Plan" title + monospace meta line (`MAY 19 · ‹ → DEC ›`).
2. **Plan header strip** — yellow-tinted card:
   - Eyebrow: `📅 Spending planner`
   - Headline: `Targeting 50% saved by Dec` (the percentage is gradient + tappable to edit; opens a slider 30–70%)
   - Meta line: `on track +1.2pt headroom · 8 items planned · 3 unplaced`
     - "+1.2pt" is `currentProjectedYearRate − target`, in green when ≥ 0, amber when < 0
3. **Months ahead** section header + lane:
   - Horizontal scrollable row of month cards from `currentMonth` → `Dec`.
   - Each card width 168px, gap 10px.
   - Card content: month name (Fraunces) + year (mono small) / headroom chip (green/amber/red) / item rows (priority-tinted borders) / plan-yellow progress bar (showing `% saved` for that month) / footnote (`% saved`).
   - Empty months get a dashed border. Past months are not shown.
   - Tap a card → highlights it AND renders a **month-detail card** below the lane (in-page, not modal).
4. **Month detail card** (when a month is selected):
   - Eyebrow `EXPANDED · MAY 2026`
   - Fraunces month name
   - Mono table:
     ```
     Income                       $8,600
     − Fixed                     −$2,567
     − Typical variable          −$2,427
     ─────────────────────────────────
     Available room               $3,606
     − Planted: New York trip      −$500
     ─────────────────────────────────
     After commitments     $3,106 (36%)
     ```
   - Per-item rows below the table with priority badge, name, cost, and ✕ to unschedule.
5. **Wishlist** section header + tab strip (Open / Bought / Cancelled).
6. **Wishlist card**:
   - Subgroups within Open: `Unscheduled · N`, `Scheduled · N` (each prefaced by a divider label)
   - Each row: priority badge (`must` / `want` / `nice`) + name (with optional second-line note) + cost + month chip (or `FIND A SPOT` button if unscheduled) + actions ✓ / ⋯
   - Bought rows are muted with a green `DONE` chip; cancelled rows hidden by default but visible under their tab.
7. **FAB** — yellow `+` floating bottom-right (above bottom nav). Tap → bottom-sheet modal: name (text input), cost (number), priority (3 chip-pills: must/want/nice), notes (optional text). Submit → item lands in Unscheduled, planner immediately auto-suggests a month.

### 4.3 Visual tokens

```css
--plan-1: #ffb84d;              /* warm yellow */
--plan-2: #ffd166;              /* gold */
--plan-grad: linear-gradient(120deg, #ffb84d 0%, #ffd166 100%);
```

Used on:
- Plan tab active state
- Page header strip background tint + border
- FAB
- Headroom chips (when "comfortable")
- Wishlist scheduled month chips
- Plan progress bars in lane cards

---

## 5. Operations

### 5.1 Auto-placement: `findSpot(item)`

```
For each month from currentMonth → Dec, in order:
  if headroom(month) >= item.cost
     AND projectedYearRate({...with item planted in this month}) >= target:
       place item here, return month

return null  // no fit
```

Walks months in chronological order. First fit wins. Greedy by month order, not by tightness — earlier months get priority because users typically want to do things sooner.

**When nothing fits:** the item stays unscheduled with a red note: `Won't fit before Dec at current pace · increase income, cancel something, or wait`. No silent failure.

**Bumping (priority resolution):** when `findSpot()` is called on a `must` item that doesn't fit and there's a lower-priority `want` or `nice` item in some candidate month that *would* free enough room if moved, we prompt:

> "NY trip needs $500. July is full. Move iPad ($400, want) to Aug to make room?"
> [Cancel] [Bump iPad]

Only triggered when both items are auto-placed (the planner owns them). Manually-placed items are never bumped without explicit user action.

### 5.2 Manual operations

- **Move to month** — from wishlist row's `⋯` menu or from lane card's item ✕ → re-place.
- **Mark bought** — from wishlist row's ✓ button or `⋯` menu → status becomes `bought`. **Does NOT create an expense.** Real expense is expected to flow in via Gmail import.
- **Cancel** — sets status to `cancelled`. Item stays in archive.
- **Edit** — open the add modal pre-filled with the item.
- **Delete** — hard-removes (Firestore + local). Confirmation prompt.

When the user manually moves an item to a month where it does NOT fit, the lane card's headroom chip flips to amber/red and the header strip status updates (e.g., `on track +1.2pt` → `over by 0.4pt`). The action is never blocked; the cost is always shown.

### 5.3 Recompute triggers

Headroom math + auto-placement re-runs whenever:

| Event | Recompute |
|---|---|
| Wishlist item added / edited / deleted | yes |
| Item marked bought / cancelled / un-cancelled | yes |
| Item moved to a different month | yes |
| Trailing-3-month variable avg shifts (new expense logged anywhere) | yes — debounced ~500ms |
| `settings.income` / `settings.savingsTargetRate` / fixed obligations change | yes |
| Trip created / dates changed (affects monthly composition) | yes |
| Month boundary crosses midnight (current month becomes "past") | yes |

Recompute is cheap (≤12 months × handful of items). Done client-side on each render. The math runs in `wishlistStore.computeHeadroom(year)` and is cached on the store; cache busts on the events above.

### 5.4 Edge cases

| Case | Behavior |
|---|---|
| No income set | Empty state: "Set your monthly income in Settings to use the planner." Wishlist still works (no headroom math). |
| Target unreachable even with zero wishlist | Header strip flips to amber: `Targeting 50% saved · current pace 42% · spending $X/mo too high to reach 50%`. Don't lie. |
| Item cost > single month's headroom | Show in unscheduled with explanation. No automatic split across months in v1. Suggest the user manually split into two items. |
| Past-dated items | Never appear in the lane. Bought/Cancelled tabs only. |
| Item marked bought becomes a real Trip later | If the user creates a Trip via `tripsStore.create()` with the same name, no automatic linking in v1. Future enhancement. |
| Multiple unscheduled `must` items competing | `findSpot()` runs in priority then creation-time order. Bumping prompt may chain (rare). |

### 5.5 Storage and sync

- **Firestore:** `users/{uid}/wishlist/{id}` per item, `set()` with deterministic doc id (no duplicates on resync, mirrors expense pattern).
- **localStorage:** `wishlist` array (mirrored, lazy-migrate to add `tripId`-style new fields).
- **Realtime listener:** `wishlistStore.attachRealtime()` subscribes to the collection on sign-in, mirrors `tripsStore.attachRealtime()`.
- **Settings sync:** `settings.savingsTargetRate` flows through the existing `saveSettingsToFirebase()` path.

---

## 6. Code structure

| File | Type | Purpose |
|---|---|---|
| `index.html` | modify | Add `#plan-page` shell. Add 5th nav button. Add wishlist add-item modal markup. |
| `js/wishlist.js` | new | Wishlist CRUD + state machine + `findSpot` + `computeHeadroom`. Exposes `window.wishlistStore`. |
| `js/plan-page.js` | new | Renders `#plan-page` (header strip, lane, expanded month detail, wishlist sections, FAB, add-item modal). Mirrors `js/trip-dashboard.js` pattern. |
| `script.js` | modify | Add `_currentPlanMonth` state and renderer hook in `showPage()`. Settings UI gets a target-rate slider. `getYearIncome`/fixed helpers reused. |
| `js/auth.js` | modify | Call `wishlistStore.attachRealtime()` on sign-in (same pattern as `tripsStore.attachRealtime()`). |
| `styles/main.css` | append | Plan tokens (`--plan-1`, `--plan-2`, `--plan-grad`); page-level CSS for `.plan-header`, `.lane`, `.month-card`, `.month-detail-card`, `.wl-card`, `.wl-row`, `.wl-section-label`, `.fab`. |

The `#plan-page` shell in `index.html` follows the same pattern as `#trips-page`: empty container divs that the renderer fills.

---

## 7. Migration / backfill

- New users: empty wishlist, default `savingsTargetRate = 0.50`.
- Existing users on sign-in: same. The wishlist starts empty regardless of historical data.
- No Firestore migration needed — the `wishlist` subcollection is created on first write.
- The Settings save path adds `savingsTargetRate` to the `settings` doc; missing field → defaults to 0.50 on read.

---

## 8. Testing expectations

- Plan page renders at 393px without overflow (with 5-tab nav).
- Wishlist add modal saves an item to localStorage + Firestore (idempotent doc ids).
- `findSpot()` correctly chooses earliest fitting month and updates `scheduledMonth`.
- `findSpot()` returns null + shows "won't fit" UI when no month accommodates the item.
- Bump prompt fires only when the candidate is `must` AND blocking item is auto-placed AND moving it would create room.
- `projectedYearRate` matches the History card's saved-rate calc when wishlist is empty.
- Recompute re-runs when expenses are added/deleted (verifies subscription wiring).
- Items marked `bought` do NOT create an expense.
- Sign-in/sign-out preserves wishlist state via Firestore listener (no duplicates).
- Mobile vertical scroll within the page works while the lane scrolls horizontally.

---

## 9. Open follow-ups (deferred)

- **Trip linking:** marking a trip-style wishlist item as `bought` could prompt to create a Trip via `tripsStore.create()`. Useful but not v1.
- **Per-category caps inside the planner:** beyond a single month total, allow drilling down (Food, Coffee, etc.) per month. Requires per-category trailing averages.
- **Drag-and-drop in the lane:** would replace the move menu. Touch DnD is fiddly; defer.
- **Historical wish recap:** show what you wished for and bought vs. cancelled. "Out of 12 wishes this year, you bought 8 and cancelled 4." Useful for self-reflection. Consider for v2.
- **Notifications:** "Your iPad fits this month!" pings. Avoid until the data stabilizes — no point pinging a user about a wish that'll get unscheduled tomorrow.
- **Sharing / household:** multi-user wishlists. Not in v1.

---

## 10. Mock

A static reference mock lives at `mocks/spending-planner.html`. It uses the same fonts and tokens as the design system; it shares no JS with the app. View at `http://localhost:5174/mocks/spending-planner.html` while the dev server runs.
