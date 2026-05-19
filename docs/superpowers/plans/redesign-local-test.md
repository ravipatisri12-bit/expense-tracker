# Redesign — local-test summary

**Branch:** `redesign` (29 commits ahead of `main`, tag `redesign-complete` at HEAD).

## What changed
- New typography: Fraunces (serif), Inter Tight (sans), JetBrains Mono.
- Two-budget model: regular vs `tripId != null` expenses; monthly cap math excludes trip spend.
- New pages: Trip Dashboard, Trips Index. Bottom nav reduced to 4 tabs (Home / Trips / Txns / History).
- Redesigned: Home, Add Expense, History pages.
- Anti-portfolio "Save" feature retired.
- Auto-add (Gmail import) now lives on Home as a CTA, not a separate page.
- Notifications branch on active trip; new trip-themed copy at 9am / 6pm / 10pm.

## How to test locally
1. `npm run dev` — opens at http://localhost:5173
2. Walk through tabs: Home → Trips → Txns → History
3. Create a trip via Trips → `+`
4. Tap a trip card to open Trip Dashboard
5. Add expense from Home `+ Add` button (try both smart input and manual fields)
6. With trip active, banner appears on Add Expense page; submitted expenses route to trip total

## Known non-blocking notes
- `test.sh` shows ~30 unguarded-getElementById warnings (pre-existing legacy renderers; safely no-op when their DOM is absent).
- Live trip dashboard for ENDED trips shows the "aim under $X/day" message — cosmetic only.
- `next7` default in new-trip modal uses local time (fixed in track-c review).
- All real bugs found in review have been fixed.

## Pushing to remote
The branch is local-only. To push when ready:
```bash
git push -u origin redesign
```
Then open a PR or merge as desired.
