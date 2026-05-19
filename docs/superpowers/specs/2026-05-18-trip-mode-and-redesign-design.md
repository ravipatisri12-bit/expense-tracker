# Trip Mode + UI Redesign — Design Spec

**Date**: 2026-05-18
**Status**: Approved (in brainstorming)
**Scope**: New Trip Mode feature; redesign of Home, Add Expense, and History pages; minor widgets (forecast, merchant frequency); retire anti-portfolio.

---

## 1. Goals and non-goals

### In scope
- A first-class **Trip Mode** for tracking trip expenses against a trip-specific budget, separate from the monthly budget.
- Visual redesign of **Home**, **Trip Dashboard**, **Add Expense**, and **History** pages with a cohesive design language.
- **Forecast** widget (small line on home hero) and **merchant frequency** widget (history page).
- **Auto add** (existing Gmail import) moved from Add page to a primary CTA on home.
- Retire the **anti-portfolio / "Save"** entry point.
- Bottom nav reduced to 4 tabs: **Home / Trips / Txns / History** (no Add tab).
- Codify the design principle that the UI does not use stoplight (red/green) coloring on user spending — symbols and neutral gradients only.
- Codify the two-budget model: trips don't count toward monthly caps, but compose into year/month totals.

### Out of scope
- No changes to parsing logic, Gemini integration, category guessing, Firestore writes, or Gmail import internals. UI only.
- No changes to the Txns page (keeps existing styling).
- Wait-list / cooling-off, recurring bills tracker, subscriptions audit, heatmap calendar, receipt photo attach, iOS home-screen widget, per-trip CSV export — all deferred to backlog (Section 11).

### Non-goals (explicit)
- No "savings rate target" or judgment metrics.
- No social/leaderboard features.
- No bank/Plaid integration.

---

## 2. Two-budget model

The most important architectural decision in this spec: **expenses split into two buckets, never mixed in cap calculations**.

### The model

Each expense gets an optional `tripId` field (nullable string).

- **Regular expense**: `tripId == null`.
- **Trip expense**: `tripId == "<trip-id>"`.

### Aggregation rules

| Aggregation | Filter | Used by |
|---|---|---|
| Monthly cap math (`$1k soft / $2k hard`) | `tripId == null` only | Home hero, notifications, "aim today" target |
| Trip cap math (`per-trip budget`) | `tripId == thisTripId` only | Trip dashboard, trip notifications |
| Combined month total | All expenses in the month | Home hero composition line, History month total |
| Year total | All expenses in the year | History year stat card |
| Saved | `income(year) − all_expenses(year)` | History saved stat card |

### Why

The user's stated discipline goal ("under $1k soft, $2k hard, less on food") applies to **regular life spending**, not deliberate trip spending. Mixing trips into the monthly cap destroys the cap's signal — every month with a trip becomes a "fail."

Trips are intentional, planned outsized spending. They get their own budget and their own notifications. The combined total still appears as a derived informational number, but it's never the cap-check number.

### "Saved" definition

`Saved = income − all_expenses` (regular + trips).
This is the honest year-end answer to "did I live below my means." Trips reduce savings, which is reality.

---

## 3. Design system

### Palette

Two distinct gradient palettes for the two modes, with shared neutrals:

| Token | Value | Use |
|---|---|---|
| `--m-grad` | `linear-gradient(120deg, #667eea, #b66cff)` | Monthly mode (home, history, monthly notifications) |
| `--trip-grad` | `linear-gradient(120deg, #4facfe, #00f2fe)` | Trip mode (trip dashboard, trip teasers, trip notifications) |
| `--saved-grad` | `linear-gradient(120deg, #43e97b, #38f9d7)` | Saved card on history only |
| `--bg` | `#0a0c14` | App background |
| `--surface` | `#131520` | Cards |
| `--surface-2` | `#1c1f2c` | Elevated cards |
| `--on-surface` | `#e6e8f0` | Body text |
| `--on-surface-mute` | `#8b8fa3` | Secondary text |
| `--on-surface-faint` | `#4a4f63` | Tertiary / placeholders |
| `--line` / `--line-strong` | rgba alpha lines | Borders |
| `--good` | `#43e97b` | Saved rate pill, soft cap markers |
| `--warn` | `#ffb84d` | Over-budget trip cards (subtle) |
| `--bad` | `#ff7080` | Hard cap marker, error state |

### Typography

- **Inter Tight** (sans, weights 300–800) — body, labels, all UI chrome.
- **Fraunces** (serif, weights 300/500/700, optical sizing 9–144) — hero titles, big numbers (month name, dollar amounts in heroes), section titles.
- **JetBrains Mono** — small labels, eyebrows, day pills, monospace numbers in stats.

This is a **typography shift** from the existing Roboto-only app. Three families adds load but creates the editorial feel that lifts the app out of generic-finance-app territory. Font loading must use `font-display: swap` to avoid layout shift.

### Iconography

- **Material Symbols Rounded** (existing) — fill weight `'FILL' 1, 'wght' 500–700` for emphasis tiles, default for inline.
- **Monochrome Unicode glyphs** for notifications: `→ · ✓ ! ?` — never color emoji.

### Stoplight discipline

**The UI must not use red or green to judge user spending.** Numbers stay neutral. Progress bars stay gradient. Allowed exceptions:

- **Cap markers** (small ticks on monthly hero bar) may be subtly colored as labels, not judgments: green tick = soft cap line, red tick = hard cap line.
- **Saved card** uses a green tint because saving is unambiguously good — but the number itself is white-on-green-tint, not raw green.
- **Notification symbols** (`! ✓ → ?`) carry signal in monochrome.
- **Trip-over-budget cards in History** may carry a faint amber border (not red) — informational, not judgmental.

**Forbidden**:
- Big spending numbers turning red when over budget.
- Progress bars turning red when over capacity.
- Comparison deltas in big red text ("vs last month +$200").
- Category bars colored differently when "over."

Comparisons may be subtly tinted (`±` in muted accent color), but the dominant visual state remains neutral.

### Bar/ring shape

- **Home hero**: linear progress bar, dual-cap (soft + hard markers).
- **Trip hero**: linear progress bar (one budget).
- No ring SVGs in either hero — the existing budget ring is replaced.

---

## 4. Page: Home

Replaces the current dashboard layout end-to-end.

### Section flow (top to bottom)

1. **Status bar / app header** — brand glyph + LEDGR wordmark + user avatar (existing).
2. **Greeting band** — `Good morning, <Name>` in Fraunces italic; `MON · MAY 18` monospace day pill on the right.
3. **Monthly hero card**:
   - Eyebrow: `📅 Monthly view` (Material Symbol)
   - Big serif `May` + smaller `2026`
   - Day pill: `DAY 18 / 31` + meta `13 days left this month`
   - Big serif spent number: `$640`
   - Right-aligned: `of $1000 soft target / $360 left`
   - Linear progress bar with two markers: green tick at 50% labeled `$1k soft`, red tick at 100% labeled `$2k hard`. Progress fill is purple gradient, width = `monthTotal / MONTHLY_TOTAL_HARD * 100%`.
   - Three pace cells in a row: `Today's spend $42 / Avg per day $36 / Aim today $28` (last cell highlighted in violet)
   - **Forecast line** (new — see Section 7.1): `· At this rate May ends ~$1,180`
   - **Composition line** (when there are trip expenses this month): `+ $280 across 1 trip · TOTAL $920` in muted monospace
   - CTA row: `[+ Add]` (gradient, 1/2 width) and `[⚡ Auto add]` (outline, 1/2 width). Both ~13.5px text, white-space nowrap.
   - Sync status line below CTA row: `● Synced 9:14 AM · 3 new from inbox` — small monospace, green dot.
4. **Insight strip** — single-line tip or actionable nudge in a tinted card. (No Gemini calls; static templates from existing `templateInsights`.)
5. **Coming up — Trip teaser** *(visible only when a trip is upcoming or active)* — small cyan-tinted card showing trip name, date range, "STARTS IN 7 DAYS" or "DAY 3 / 7" status. Tap → trip dashboard.
6. **Daily habit** card — flame + streak count, BEST · 12 DAYS, 7-day mood tile row, three check-in buttons (No Spend / Essentials / Wants).
7. **Where it goes** — donut chart (SVG) + colored legend with category, $ amount, %. **Tap any category → Category Detail screen** (Section 4.4).
8. **Spending trend** — daily/weekly toggle, comparison line `vs same point last May −$172 lower` (always visible for stable layout, can be small subtle accent green/red — not full stoplight), bars with **dashed adaptive aim line** at the day's recovery target, today's bar glows. **Tap a bar → small white pill popover** showing `MAY 9 · $115`. Tap again or tap elsewhere to dismiss. Three stat cells below: Today / Best day / Worst day.
9. **Bottom nav** — 4 tabs: Home (active) / Trips / Txns / History.

### Removed from current home
- Recents transactions list (covered by Txns tab).
- AI Insights long card (replaced by the single Insight strip).
- Anti-portfolio "Save" button (feature retired — Section 9).

### Trip-mode swap

When a trip is **active** (current local date between `start_date` and `end_date`, or user has tapped "Start Trip"), home page does **not** swap entirely to Trip Dashboard. Instead:

- Trip teaser card moves to top (above hero) and expands to show "$280 of $500 budget · DAY 3 / 7 · view trip →".
- Tapping Trip teaser navigates to Trip Dashboard.
- Monthly hero card still visible below — regular spending math is independent of trip.
- Home is still the home page; trip is a parallel context.

This was simpler than swapping the whole home page (originally proposed) and matches the two-budget model — both budgets remain visible.

### 4.1 Pace target ("Aim today") math

```
remaining_soft   = max(0, MONTHLY_TOTAL_SOFT − monthTotalRegular)
remaining_food   = max(0, MONTHLY_FOOD − monthFoodRegular)
days_left        = days_remaining_in_month
aim_total        = round(remaining_soft / max(1, days_left))
aim_food         = round(remaining_food / max(1, days_left))
```

Adaptive: if soft cap is blown, switches to remaining hard cap room. Same logic as notifications (`getActiveTarget()` in send-notifications.js).

### 4.2 Forecast line

```
days_so_far    = day_of_month
days_in_month  = total days in current month
projection     = round(monthTotalRegular / max(1, days_so_far) × days_in_month)
display        = `at this rate ${monthName} ends ~$${projection}`
```

Refresh on each home page render.

### 4.3 Spending trend pace line position

The dashed aim line draws at vertical position:
```
y = max_bar_height − (aim_total / max_bar_height_value × max_bar_height_pixels)
```

In CSS terms: position the line at `top: (1 − aim/max_y) × 100%` of the chart wrapper. The pace label `aim · $28/day` sits at the line's right edge.

### 4.4 Category drill-down

Tapping a category on the Where-it-goes donut/legend navigates to a **Category Detail screen** (new sub-page):

- Header: back button, category name, monthly subtitle
- Big serif total for the selected month in this category
- Month picker arrows ← May 2026 →
- Same daily-rhythm bars but filtered to this category only
- Stats: avg per day (this category), top 3 merchants in this category, biggest single transaction
- Scrollable list of all transactions in this category for the selected month

(This screen is described but not separately mocked. Will be designed during implementation.)

---

## 5. Page: Trip Mode

### 5.1 Data model

```javascript
// users/{uid}/trips/{tripId}
{
  id: string,                 // generated, stable
  name: string,               // "New York"
  budget: number,             // 500 (USD)
  startDate: string,          // "2026-05-25" (YYYY-MM-DD)
  endDate: string,            // "2026-06-01" (YYYY-MM-DD)
  startedAt: timestamp|null,  // when user tapped "Start Trip" — null = auto-fallback to startDate
  endedAt: timestamp|null,    // when user tapped "End Trip" — null = auto-fallback to endDate
  createdAt: timestamp,
  updatedAt: timestamp
}
```

Each expense gains:
```javascript
// users/{uid}/expenses/{id}
{
  ...existing fields,
  tripId: string|null         // new field
}
```

### 5.2 Lifecycle / states

A trip is in one of four states, derived from `today`, `startDate`, `endDate`, `startedAt`, `endedAt`:

| State | Condition | Behavior |
|---|---|---|
| `UPCOMING` | `today < startDate` AND `startedAt == null` | Trip exists in Trips index. Home shows trip teaser with "STARTS IN N DAYS". No expenses tagged automatically yet. |
| `ACTIVE` | `(startedAt != null AND endedAt == null) OR (today ≥ startDate AND today ≤ endDate AND endedAt == null)` | Home shows expanded trip teaser. Trip dashboard reachable from Trips tab. New expenses with date in trip window auto-tagged. Notifications switch to trip-themed in addition to monthly. |
| `ENDED` | `endedAt != null OR today > endDate` | Trip moves to "Past" section in Trips index. Read-only by default; expenses retain `tripId`. |
| `DRAFT` | (rare — temporary state during creation flow before save) | n/a |

### 5.3 Auto-tagging logic

When a new expense is created:

```javascript
function pickTripIdForDate(expenseDate) {
  const activeTrip = trips.find(t =>
    isStateActive(t) &&
    expenseDate >= t.startDate &&
    expenseDate <= t.endDate
  );
  return activeTrip?.id || null;
}
```

Manual override on the Add Expense form (Section 6.3) lets the user opt-out per expense. Gmail-imported expenses run through the same logic by date.

### 5.4 Start/End tap behavior

- **Start Trip button** appears on the trip card / dashboard from `today >= startDate − 1 day`.
  - Tap before startDate → asks for confirmation, then sets `startedAt = now`. Today's expenses get retroactively eligible if their date is on or after `startedAt`.
  - Tap on or after startDate → simply sets `startedAt = now`.
- **End Trip button** appears once trip is active.
  - Tap → sets `endedAt = now`. Today's later expenses won't auto-tag.
  - Confirms before ending early.

If user never taps Start, fallback `effectiveStartedAt = startDate`. Same for end.

### 5.5 Trip Dashboard layout

Reachable from Trips tab → trip card → tap, or from home Trip Teaser tap.

Sections top-to-bottom:

1. **Header**: brand + ON TRIP cyan pill + tune icon.
2. **Trip hero card** (cyan-tinted gradient + skyline silhouette decoration):
   - Eyebrow: `EXPLORE · New York · Active`
   - Big Fraunces name `New York`
   - Day pill `DAY 03 / 07` + dates `May 25 — Jun 1, 2026`
   - Big serif spent + remaining: `$280 of $500 / $220 remaining`
   - Cyan progress bar with shimmer animation
   - Three pace cells: `Avg/day $93 / Ideal/day $71 / Aim today $55` (last highlighted)
3. **Insight strip** (cyan): `You're $66 over a steady pace. Aim under $55/day for the rest to land on budget.`
4. **Today** card with transactions for today (this trip only) + transaction count + sum.
5. **Add expense FAB** — full-width gradient button "Log a trip expense".
6. **Breakdown** — category bars for the trip (per-category totals).
7. **Daily rhythm** — 7 chunky bars, today glows cyan, future days dashed.
8. **End trip early** — outlined button, bottom of page.
9. **Bottom nav** (Trip tab does not exist; user navigates via Trips tab; visible nav is Home/Trips/Txns/History — Trips would be active).

### 5.6 Trips Index (separate page, the Trips tab content)

When you tap **Trips** in the bottom nav:

1. Title `Your trips` + subtitle `2026 · 5 trips planned` (or whatever the year shows)
2. **Year summary card**: `Spent on trips this year $1,847`, with stats row: `3 trips completed / 1 active right now / $2,500 total budget`.
3. **Active trip card** (cyan-tinted) with name, "DAY 3 / 7", `$280 / $500`, progress bar, chevron.
4. **Upcoming** (dashed amber): one card per upcoming trip, "in 18 days", `$0 / $300`.
5. **Past · 2026** (muted): cards for each completed trip, sorted recent-first. Over-budget trips have a faint amber border.

Tapping any trip card → Trip Dashboard for that trip (read-only for past trips).

A `+` button (top-right header) creates a new trip via a modal: name, budget, start date, end date.

### 5.7 Notification behavior during a trip

(Existing notification feature defined in earlier work; this spec only restates how trip mode interacts.)

When a trip is active for a user/device:
- **9am push** = morning trip pace nudge instead of monthly. Title: `→ $55 to spend on the trip today`. Body: `Day 3 of 7 / $446 left of $500 budget`. (Trip budget is a single number; no food sub-cap on trips.)
- **6pm push** = afternoon trip check. Title: `· $42 today, $20 on food`. Body: `Trip: $280 of $500 / 4 days left`.
- **10pm push** = end-of-day trip summary. Title: `✓ $54 today — under trip pace`. Body: `Day 3 done · $446 left of $500 budget`.

When trip ends, pushes return to monthly variants.

The send-notifications.js script branches on `trip mode active for this user`:
```
if (active_trip_for_user) {
  use trip-themed copy with trip budget math
} else {
  use monthly copy with regular-spending math
}
```

---

## 6. Page: Add Expense

### 6.1 Layout

The page is structured around Smart Input as the primary path, with manual entry collapsed by default.

Sections top-to-bottom:

1. **Page head**: `[X back]` + Fraunces title `Add expense` + spacer.
2. **Trip context banner** *(visible only when trip is active)*: cyan-tinted strip "✈ Auto-tagging to **New York** · day 3 of 7" with a subtle "Untag" toggle on the right. The submit button text flips to "Add to trip".
3. **Smart Input card** (purple-tinted hero):
   - Title row: gradient lightning glyph + "Type it naturally" + monospace `SMART · GEMINI` pill.
   - Textarea with multi-line placeholder showing 3 example lines.
   - **Live parse preview** below the textarea (described in 6.2).
   - Action row: `[Clear]` ghost + `[✓ Add 3 expenses]` primary gradient.
   - Examples chip row: `examples → 14 chipotle / uber 23 / 75 amazon 5/12` — tapping a chip prepends to textarea.
4. **Toggle pill**: `── [⚙ Use fields] ──` collapsed by default. Tap to expand manual fields.
5. **Manual form card** *(collapsed by default)*:
   - Amount field — Fraunces 38px serif input with floating "$" prefix (large and dramatic; signals this number matters).
   - Description text field.
   - When section: chip row `[Today (active)] [Yesterday] [Mon] [Sun] [📅]` — common-day chips with a calendar-pick chip at the end for full date picker.
   - Category section: 4-column grid of category tiles with tinted glyphs (Food / Coffee / Transit / Shop / Fun / Bills / Other). Active tile gets a violet ring.
   - Submit button: `[+ Add expense]` (or "Add to trip" when trip mode active) — gradient.
6. **Bottom nav** — Home / Trips / Txns / History (no tab active; Add page is transient).

### 6.2 Live parse preview

As the user types in the smart-input textarea (debounced, ~300ms after stop):

- Run existing parser (`smart-input.js` regex parser, not Gemini — keep it free) on each non-empty line.
- Render parsed rows below the textarea: `[$amount] [merchant + when meta] [category pill]`.
- Failed lines render in dashed amber with `?` and `"<line>" — couldn't pick a date` style messages.
- Successful rows update the action button label: `Add 3 expenses` (live count).

When the user taps "Add N expenses", the parser is run *one more time* through the same code path that exists today — no behavior change. The preview is **purely a UI affordance** that lets the user see what *will* happen before tapping.

If the user wants AI-quality parsing for ambiguous inputs, the existing Gemini fallback path runs only at submit time (current behavior). The preview shows regex-only results.

### 6.3 Trip auto-tag toggle

When a trip is active and the page is loaded:
- Banner shows at top with name + day counter.
- Submit button text reads "Add to trip" instead of "Add expense".
- All expenses created from this page are tagged with `tripId = activeTripId` automatically.
- The "Untag" link in the banner toggles a per-page session flag. When toggled:
  - Banner becomes muted: "Saving as regular expenses" with a "Re-tag" link.
  - Submit button reverts to "Add expense".
  - Created expenses get `tripId = null`.

This is a per-session toggle, not a per-expense toggle — keeps the UI simple. Per-expense override is available via the existing edit-expense modal after creation.

---

## 7. Page: History

### 7.1 Section flow

1. **Page header**: Fraunces `History` + monospace year on right.
2. **Year selector**: `← 2026 →` arrows, Fraunces year name. Right arrow disabled at current year.
3. **Two stat cards** (side-by-side):
   - **Spent · 2026** (purple-tinted) — Fraunces big number `$4,820`, sub `$402/mo avg · 5 mos`.
   - **Saved · 2026** (green-tinted) — Fraunces big number `$1,580`, top-right `24%` rate pill, sub `income $6,400`.
4. **Year shape card**:
   - Title `Year shape` + meta `12 months · spent`.
   - 12 vertical bars (one per month), past months solid purple gradient, future months dashed empty placeholders, selected month glows.
   - **Trip ticks**: small cyan slices on top of months that contained at least one trip — visual cue that this month had outsized travel spend.
   - 12 month labels below.
   - Foot row: `HIGH $1,247 APR / AVG $402/mo / LOW $390 JAN`.
5. **Month picker pill rail** (horizontally scrollable):
   - One pill per month: month abbreviation + monthly total.
   - Active month highlighted purple.
   - Empty (future) months show em-dash, faded.
   - Tapping a pill updates the Selected Month Detail card below.
6. **Selected month detail card** (purple-tinted):
   - Eyebrow: `SELECTED · 18 days in` (or "completed" / "upcoming")
   - Big Fraunces month name + year
   - Big serif total for that month: `$920` (combined regular + trip)
   - Right-aligned vs-prior-month: `+$580 vs Apr / ↑ 70% higher`
   - Composition rows below a divider:
     - `● Regular spending $640`
     - `● Trips · 1 $280`
7. **Where the year went** card (categories aggregated for the year):
   - Title + meta.
   - One row per category: dot + name + thin progress bar + amount + %.
   - **`Trips` is its own category bucket** in this list (cyan dot, e.g. 29% of year).
   - Sorted by amount descending.
8. **Top regulars** card (new — merchant frequency widget, see 7.2).
9. **Bottom nav** — Home / Trips / Txns / **History (active)**.

### 7.2 Merchant frequency widget — "Top regulars"

A card on History showing the user's most-frequent merchants for the year:

```
TOP REGULARS · 2026
☕ Starbucks       42 visits   $312
🥗 Mendocino       18 visits   $312
🚇 ORCA Transit    96 visits   $264
🛒 Whole Foods     14 visits   $890
🎬 Netflix         12 visits   $108
```

- Sorted by visit count descending (option A) or by spend (option B). I'll default to **visit count** to surface "the regulars" — the merchants you visit even when you don't realize.
- Up to 8 rows visible, "show more" expands.
- Implemented by aggregating `expenses` by `description` (case-insensitive, normalized — strip leading `TST*`/`SQ *` etc., similar to existing Apps Script logic).
- Tapping a row → filtered Txns view (later — note as future work).

### 7.3 Removed from current History

- "Trips this year" list — redundant with the Trips tab.
- "Top Categories" with month/year toggle — merged into single "Where the year went" with year-only data.
- `<details>` collapsible "2026 Overview" — replaced by always-visible Year shape + stat cards.
- The "vs Last Month" three-stat box (Change / Active / Average) — replaced by the Selected Month Detail card.

### 7.4 No insights

History has no insight strip, no narrative copy, no Gemini text. The page is for self-reflection through data. The user infers patterns; the app does not interpret.

---

## 8. Bottom nav

| Tab | Icon | Active state |
|---|---|---|
| Home | `home` | Default after login |
| Trips | `flight` | Trips index page |
| Txns | `receipt_long` | Existing transactions list (unchanged) |
| History | `history` | History redesign |

**No "Add" tab.** The Add Expense page is transient — reached only via the Home page's `[+ Add]` CTA, the Trip Dashboard's "Log a trip expense" button, or system shortcuts. The bottom nav remains visible on the Add page so users can navigate away without going through the X back button.

---

## 9. Anti-portfolio retirement

The "Save / anti-portfolio" feature is removed from the UX:

- **Index.html**: remove the Save button on home, the anti-portfolio modal, and any onclicks.
- **gamification.js**: remove `addAntiPortfolioEntry`, `getDailySavings`, `getTotalSavings`, `getRecentAntiPortfolio`, `checkSavingsAchievements`, and the savings-related achievement IDs (`saved-100`, `saved-500`, `saved-1k`).
- **Wins/insights logic in script.js**: remove any code that surfaces anti-portfolio totals.
- **localStorage**: existing `ledgr_gamification.antiPortfolio` array is preserved (not migrated/destroyed) for future revival via the wait-list feature in backlog.

---

## 10. "Auto add" rename + relocation

The existing Gmail Import card (currently on Add Expense page) becomes a one-tap CTA on Home, labeled **Auto add**:

- Removed entirely from Add Expense page.
- Replaces the "Save" button as the secondary CTA next to "+ Add" on the Home hero.
- Status line below the CTA row: `● Synced 9:14 AM · 3 new from inbox` — small monospace, green dot.
- Tapping `Auto add` triggers `window.emailParser.sync()` (existing function — no change).
- Reconnect popup behavior unchanged: when Gmail OAuth token has expired, the same `refreshGmailToken` flow runs (~1 popup, 2-tap experience). On success, sync runs.
- The "Reconnect Gmail" sub-button is no longer needed as a separate UI element — its functionality is folded into the auto-add tap (try sync → if 401, refresh token → retry sync → toast result).

---

## 11. Backlog (deferred to later specs)

These features came up during brainstorming but are explicitly **not** in this spec's scope. Each gets its own design pass when prioritized:

- **Wait-list / cooling-off** — log items to consider, wait N days, decide. Replaces anti-portfolio with a behavior-shaping mechanic. Likely v2.
- **Recurring bills tracker** — fixed obligations card, predictable monthly outgo, charge-incoming reminders.
- **Subscriptions audit** — yearly view of every subscription, "haven't used in 30 days" flag.
- **Spending heatmap calendar** — GitHub-style grid where each day is a cell, intensity by spend.
- **Time-of-day distribution** — when do you spend.
- **Receipt photo attach** — snap and store with the expense.
- **iOS Home Screen widget** — quick log + today's total. Limited PWA support so likely needs review.
- **Per-trip CSV/PDF export** — for work-trip reimbursement.
- **Category drill-down screen** — already mentioned in Section 4.4; design and implementation deferred.

---

## 12. Implementation notes (high-level)

### Data migrations

- Add `tripId` field to `users/{uid}/expenses/*`. Default `null`. No backfill needed.
- Add `users/{uid}/trips/*` collection.
- Existing localStorage `expenses` array gets `tripId: null` on legacy items via lazy migration on read.

### Code touches (high level)

| Area | Files | Type |
|---|---|---|
| Data model | `script.js` (`ExpenseTracker.expenses`, save/load methods) | Add `tripId` field |
| Trip CRUD | new `js/trips.js` | New |
| Trip dashboard rendering | new `js/trip-dashboard.js` | New |
| Home redesign | `index.html` (home section) + `script.js` (renderer methods) | Major restyle, no logic change beyond forecast/composition lines |
| Add page redesign | `index.html` (add-expense page) + `js/smart-input.js` (live preview) | Major restyle + new live-preview UI hook |
| History redesign | `index.html` (history page) + `script.js` (history renderers) | Major restyle, new merchant-frequency widget |
| Anti-portfolio retirement | `index.html`, `js/gamification.js`, `script.js` | Removal |
| Notifications branching | `scripts/send-notifications.js` + `js/notifications.js` | Add trip-mode branch using existing `getActiveTarget()` pattern |
| Bottom nav reduction | `index.html` | Remove Add tab |
| Auto add | `index.html` (move CTA), small handler in `script.js` | Move + rename |
| New fonts | `index.html` `<head>` | Add Fraunces + Inter Tight + JetBrains Mono links |

### Out-of-scope confirmations

- No changes to the Txns page.
- No changes to parsing (Gemini, regex).
- No changes to Firebase schema beyond the two new fields.
- No changes to Gmail import internals.
- No changes to PWA service worker.

### Testing expectations

- All four redesigned pages render in landscape and portrait at 393px (iPhone) without overflow.
- Smart Input live preview parses correctly with the existing test inputs (`tests/test-smart-input.html` etc.).
- Trip auto-tag picks the right trip when an expense's date overlaps a trip window.
- Trip auto-tag does not tag when no trip is active.
- Cap math correctly excludes `tripId != null` expenses from monthly soft/hard cap calculations.
- "Saved" stat correctly uses all-spending in numerator: `income(year) − sum(all_expenses)`.
- Notifications branch correctly between trip-themed and monthly-themed based on `is_trip_active(uid, today)`.

---

## 13. Open follow-ups

- **Category drill-down screen** — needs its own mini-design pass before implementation (described in 4.4 but not mocked).
- **Trip creation modal** — needs design (name, budget, dates, save flow).
- **Edit-trip and delete-trip** — read-only is the default for past trips, but users may want to edit/cancel an upcoming trip.
- **Per-trip notification budget thresholds** — currently the trip notifications use straight pace. Should "over trip budget" be a distinct push variant? Likely yes; defer to implementation.

---

## 14. Mocks

Mocks are in the repo at `mocks/`:

- `mocks/home-redesign.html` — Home page
- `mocks/trip-dashboard.html` — Trip Dashboard + Trips Index (two phone frames)
- `mocks/add-expense.html` — Add Expense (two states: typing-with-preview, trip-mode-with-fields-expanded)
- `mocks/history-redesign.html` — History page

Mocks are reference-only HTML+CSS; they share no JS with the app. They use Fraunces / Inter Tight / JetBrains Mono via Google Fonts, Material Symbols Rounded, and inline CSS variables matching the design system in Section 3.
