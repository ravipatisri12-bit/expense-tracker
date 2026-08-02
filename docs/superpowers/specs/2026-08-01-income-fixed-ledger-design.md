# Income & fixed expenses as ledger rows

**Date:** 2026-08-01
**Status:** approved, phase 1 scoped
**Core principle:** no data corruption. Every change here is additive; no existing row
is rewritten, no historical total is recomputed.

## Problem

Income and fixed monthly costs live in `settings` as four static numbers
(`script.js:229-248`):

```js
income: 4000, incomeOverrides: {}, rent: 1200, utilities: 150, insurance: 200
```

Three consequences:

1. **They aren't transactions.** They can't be seen, edited, or audited in the ledger.
2. **They're retroactive.** `getIncomeFor()` (`script.js:250`) resolves a month's income
   from *today's* settings, so changing `settings.income` silently rewrites March's
   savings figure. History is a re-derivation of current config, not a record.
3. **They don't match reality.** Utilities vary monthly; insurance bills every six
   months; a car payment may start mid-year. A single static number can't express any
   of that.

Verified against the data baseline (`expenses_2026-08-02_verified.csv`, 647 rows):
rent, utilities, insurance and car payments appear in **zero** rows. The only
recurring item present is `AGI Renters condo INS $15.17` (Jan 26, Mar 25). The
settings values were always parallel estimates, never ledger entries — so adding
them as rows is purely additive with no duplicate risk.

## Design

### 1. A `kind` field, absent meaning variable

```js
kind: 'variable' | 'fixed' | 'income'   // absent ⇒ 'variable'
```

All 647 existing rows classify as `variable` by omission. **Zero migration.**

`category` is untouched. Rent is `kind:'fixed', category:'Bills'`, so it still
aggregates into the existing category breakdowns. Overloading `category` with a
`fixed` value was rejected: `category` drives budgets, the donut chart and History
breakdowns, and `Bills` already holds 36 real rows.

### 2. Amounts stay positive; `kind` carries the sign

Income is `{ amount: 4000, kind: 'income' }`, not `-4000`. The UI renders the sign
and colour. Storing negatives would break:

- `js/email-parser.js:259` — rejects `amount <= 0`, silently dropping the row
- `script.js:3019`, `:3936` — negative values produce negative SVG arc sweeps and
  `stroke-dasharray`, i.e. broken geometry rather than a wrong number
- `script.js:1585` `exportCSV` — no sign column, so an export/reimport round-trip
  loses the distinction

### 3. One gate: `spendingRows()`

```js
ExpenseTracker.prototype.spendingRows = function (rows) {
    return (rows || this.expenses).filter(e => (e.kind || 'variable') === 'variable');
};
```

**Why a helper rather than 12 inline patches.** The codebase has exactly one existing
helper meaning "counts against my budget" — `getRegularMonthExpenses`
(`script.js:2324`) — and ~45 of ~50 sum sites don't call it, filtering ad-hoc inline.
An income row has `tripId: null` and `excludeFromBudget: false`, so it passes every
existing filter. A single named gate is checkable, and the next feature that adds a
sum has an obvious thing to call.

**Verification property:** while no row has a `kind`, `spendingRows()` is the identity
function. Phase 1 is therefore a provable no-op — assert identical totals against the
real dataset before any signed row exists.

### 4. Sites that must route through the gate

Not all ~50. Many inline filters already narrow enough that an income row cannot
reach them (e.g. `category === 'Food'`). These are the ones where it genuinely lands:

| Site | file:line | Failure if unfixed |
|---|---|---|
| `monthTotalRegular` | `script.js:907` | Home hero, cap bar, aim-today, forecast, insight all shift by the income amount |
| History year "Spent" | `script.js:4415` | folds income into spend; also double-counts fixed against `:4428` |
| History year bars | `script.js:4464` | one bar spikes, `max` squashes the rest |
| History month rail | `script.js:4523` | pill values wrong |
| History month detail | `script.js:4568-4570` | income counted under "Regular spending" |
| History categories | `script.js:4641` | income becomes a category, dilutes every `pct` |
| Top regulars | `js/merchant-frequency.js:31` | "Paycheck"/"Rent" become the top merchants by visit count |
| Notification sender A | `scripts/send-notifications.js:263` | `monthTotal` +$4000 ⇒ false "Over $2000 cap" push |
| Notification sender B | `gmail-import/apps-script.js:565` | same, separate deployment |
| Trip expenses | `script.js:2333` | trip budget math corrupted |
| `backfillTripTags` | `script.js:2348` | auto-tags an income row into any trip window containing its date — must skip non-variable rows |
| `renderTransactions` | `script.js:1187` | renders all rows; needs `+`/green styling, not exclusion |

### 5. Per-month fallback

A month's income and fixed totals are computed **from rows dated in that month**,
evaluated per month at read time and **independently per type**:

```
fixedFor(Y, M)  = rows.filter(kind==='fixed'  && inMonth).sum()
                  ⇒ if that set is EMPTY, fall back to _monthlyFixedTotal() from settings
incomeFor(Y, M) = rows.filter(kind==='income' && inMonth).sum()
                  ⇒ if that set is EMPTY, fall back to getIncomeFor(Y, M) from settings
```

Rows **accumulate**. Enter rent on the 3rd and utilities on the 18th and the month's
fixed total goes $1,200 → $1,345. There is no "complete set" to wait for, because the
app holds no template of what should exist. A month is never blank once it has one row.

Consequences of the rule:

- **Jan–Jul 2026** have no such rows, so they fall back to settings and are labelled
  **estimated** — exactly today's behaviour, unchanged.
- **Aug 2026 onward** uses real rows.
- **Any past month can be fixed later** by adding rows to it; that month flips to
  row-based automatically. No cutoff date is hardcoded, no migration step exists, and
  months are independent — Jan and Jul row-based while Feb–Jun stay estimated is valid.
- `settings.income` / `rent` / `utilities` / `insurance` remain in the schema **solely
  as the historical fallback**. Not editable for new data.

Display must show the row count so an in-progress month reads as incomplete rather
than wrong: `Fixed · $1,345 (2 items)` vs `Fixed · $1,550 (estimated)`.

### 6. Placement

- **Home stays variable-only.** The hero keeps its $1k soft / $2k hard targets over
  `spendingRows()`. Nothing about income or fixed appears on Home — consistent with the
  separate Home-simplification work.
- **History month detail** surfaces income, fixed, and real savings
  (`income − fixed − variable`) computed from data rather than a settings guess.
- **Txns list** shows income as a positive row and fixed as a normal row, each with a
  distinct source-style icon.

### 7. Dead code to delete, not port

These are the only live consumers of the income/fixed math, and all target DOM ids
absent from `index.html` (confirmed independently by both the data-model and Home
audits):

- `renderDailyPulse` (`script.js:696`) → `#daily-pulse-card` does not exist
- `renderTodayPanel` (`script.js:950`) → `#today-panel` does not exist
- `toggleFixedExpenses` (`script.js:3210`) → `#fixed-expenses-details` does not exist
- `updateHistoryView` (`script.js:1657`), `updateHistoryAnalytics` (`:1803`),
  `updateYearOverview` (`:1970`) → all target absent ids; throw and return early
- `getHistoricalData` (`script.js:1615`), `getYearData` (`:2017`) → consumed only by
  the above

Deleting these removes a large part of the income surface before any gate work.

### 8. Bug to fix in passing

`getYearIncome` (`script.js:4388`) reads flat `settings.income` and **ignores
`incomeOverrides` entirely**, so a per-month override never affects the History year
card. It disagrees with `getIncomeFor` (`script.js:250`).

## Phasing

**Phase 1 — provable no-op (this spec).**
Add `kind` (unused), add `spendingRows()`, route the 12 sites, delete the dead
consumers, add the per-month fallback helpers, fix `getYearIncome`. No entry UI, no
signed rows, no notification copy changes. Verify totals are byte-identical against
the verified dataset.

**Phase 2 — entry UI.** Month picker, derived name suggestions from last month's
`kind:'fixed'` rows with blank amounts, History surfacing, Txns styling.

**Phase 3 — notifications.** Consolidate to one sender and standardize copy. Tracked
separately; both senders must be gated before any income row reaches production.

## Verification

1. `./test.sh` passes (~4s; the only lint/typecheck).
2. `node -c` clean on every touched file, including `gmail-import/apps-script.js`
   which `test.sh` does not cover.
3. Load the verified 647-row dataset in a real browser and assert that every Home and
   History total is **identical** before and after. This is the phase-1 acceptance
   criterion: `spendingRows()` must be the identity function on data with no `kind`.
4. Then seed one `kind:'income'` and one `kind:'fixed'` row and assert the Home hero
   number does **not** move, while History month detail picks both up.
