# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- `npm run dev` — Vite dev server (auto-opens browser). For a no-bundler equivalent, `python3 -m http.server 8000` works because the app loads scripts via `<script>` tags from `index.html`.
- `npm run build` / `npm run preview` — Vite production build / preview.
- `./test.sh` — Pre-commit smoke test. Runs Vite build, `node -c` syntax check on every JS file, verifies every `src=` and `href=` referenced in `index.html` exists, scans `onclick="fn("` handlers in HTML and confirms `function fn` exists in JS, and warns on `getElementById` calls whose ID is not in `index.html` and lacks a null guard. **Run before every commit** — there is no other lint/typecheck.
- Tailwind rebuild (only if you switch off the CDN): `npx tailwindcss -i styles/tailwind-input.css -o styles/tailwind.css --minify`. Note `index.html` currently loads Tailwind from `cdn.tailwindcss.com/3.4.1`; `.kiro/performance-rules.md` says to NEVER do this — treat any new work as restoring the local build.
- No unit-test runner is wired up. Files in `tests/` are standalone HTML/JS demos — open them in a browser; they are not run by `test.sh`.

## Architecture

This is a **vanilla-JS single-page PWA** — no framework, no module bundler at runtime. `index.html` loads scripts via classic `<script>` tags in a fixed order, so all JS files share the global `window` namespace. Order matters (from `index.html`): `defensive.js` → `config.js` → `utils.js` → `trips.js` → `forecast.js` → `trip-dashboard.js` → `merchant-frequency.js` → `auth.js` → `transaction-parser.js` → `smart-input.js` → `quick-add.js` → `gamification.js` → `email-parser.js` → `notifications.js`, then `script.js` last (via `<script src="script.js">` at end of body, after all `js/*.js`). When adding a script tag, keep dependencies earlier in the list, and `test.sh` verifies the file exists.

`index.html` is the whole UI: a fixed header, a **4-tab** bottom nav (Home/`dashboard`, Trips, Txns/`transactions`, History), and one `<div class="page-content">` per page that JS shows/hides via `showPage()`. Most page bodies are empty containers (`<div id="home-month-hero">`, `<div id="history-month-rail">`, …) that the renderers fill.

**Not loaded / dead code** (present in the repo but referenced by nothing — don't wire new features through them): root `main.js` (a Vite CSS entry that isn't the configured entry point).

### The ExpenseTracker class (`script.js`, ~4600 lines)

One monolithic class holds nearly all app state and rendering. Features are added as **prototype methods**, not class methods (`ExpenseTracker.prototype.renderStreaks = function() { ... }`). Match this style when adding features — see `.kiro/steering/project-context.md`.

Initialization is DOM-ready + try-catch (see `.kiro/defensive-implementation.md`). The instance is exposed as `window.expenseTracker`. Global functions at the bottom of `script.js` (e.g. `showPage`, `selectCategoryPill`) exist to be called from inline `onclick=` attributes in `index.html` — they delegate via `safeTrackerCall(method, ...args)`. **If you add an `onclick="foo("` to HTML, you MUST add a corresponding `function foo` in JS or `test.sh` will fail.**

### Trips subsystem (`js/trips.js`, `js/trip-dashboard.js`)

These are the independent feature modules split out of `script.js`. Each follows the same shape: an IIFE that defines a store class backed by both localStorage (offline) and Firestore (`users/{uid}/{collection}/{id}`), plus render/action functions attached to `window` for `onclick=` handlers. Data shapes are specced in `.kiro/specs/expense-tracker/design.md` (referenced as "spec §N" in file headers).

- **`trips.js`** → `window.tripsStore` (a `TripsStore`). Trip CRUD + state machine; trips at `users/{uid}/trips/{tripId}` and `localStorage['trips']`. `ExpenseTracker.getTripExpenses(id)` bridges expenses to a trip. `auth.js` calls `tripsStore.attachRealtime()` on sign-in to hydrate from Firestore.
- **`trip-dashboard.js`** — renders the Trip dashboard + Trips index from `window.tripsStore`.
- **`forecast.js`** → `window.Forecast` (pure month-end projection helper; used by the Home month hero in `renderHomeMonthHero`). **`merchant-frequency.js`** → `window.MerchantFrequency` (aggregates/normalizes merchant names, stripping `TST*`/`SQ *`/`PAYPAL *` prefixes; used by History's "Top regulars" in `renderHistoryTopRegulars`).

These modules read `window.expenseTracker` but are loaded *before* `script.js`, so they must tolerate it being undefined at load time and only touch it inside render/action callbacks (which fire after init).

> The **Plan tab** (a "Spending Planner" / wishlist feature — `js/plan-page.js`, `js/wishlist.js`, `window.wishlistStore`, the Settings "Savings target" slider, and `settings.savingsTargetRate`) was removed. Don't reintroduce references to it.

### Defensive coding (`js/defensive.js`)

The codebase uses safe wrappers (`safeGetElement`, `safeAddEventListener`, `safeQuerySelectorAll`, `safeTrackerCall`, `isTrackerReady`) instead of raw DOM/tracker access. Full rules in `.kiro/defensive-coding-rules.md`. New code MUST follow these patterns; `test.sh` warns on raw `getElementById` without a null guard.

### Data layer

- **Primary store: localStorage** with key shapes managed by `ExpenseTracker`. Works fully offline.
- **Cloud sync: Firestore** (`js/config.js`) — Firebase v8 compat SDK loaded from gstatic CDN. Real credentials are committed in `js/config.js` on purpose; don't rotate without coordinating.
- Auth via `js/auth.js` (Google sign-in, LOCAL persistence so sessions survive refresh).
- Gmail auto-import is an external Google Apps Script (`gmail-import/apps-script.js`) that writes directly to Firestore with `source: "chase-gmail"`. See `gmail-import/README.md`.
- Dates are stored as `YYYY-MM-DD` strings and parsed via `parseLocalDate()` to avoid UTC timezone shifts. Use this helper — never `new Date('YYYY-MM-DD')` directly (that parses as UTC midnight and shifts a day in negative timezones).
- **Timezone footgun, repeatedly hit**: every place that derives a "today" date string from `Date` MUST use the user's local time, never UTC. When adding an expense, the default date is the device's local `YYYY-MM-DD` (`new Date()` then read year/month/date components — not `.toISOString().slice(0,10)` which is UTC). For Gmail-imported transactions, Chase emails report ET; convert to UTC instant first, then read the device's local calendar parts (see `_parseDate` in `js/email-parser.js` for the canonical pattern). Past bugs have caused expenses logged at 11pm Pacific to appear on the next day.

### Transaction parsing (`js/transaction-parser.js`) — local, no LLM

Natural-language input like `100 at castilla on food 02/18` is parsed by a local regex
parser: `window.llmParser.parseTransaction()` → `fallbackParseMultiple()`. One transaction
per input line; extracts amount, description, category and date (including `yesterday` and
`MM/DD`). No network call on any path.

Dashboard insights come from `ExpenseTracker.prototype.templateInsights` in `script.js`,
cached in `localStorage['insights_cache']` per day.

> **Removed: the Gemini integration.** `js/llm-integration.js` (Gemini 2.0 Flash-Lite) and
> `js/overview-analysis.js` (`BehavioralAnalysisAI`) are deleted. The integration never
> worked — its constructor hardcoded `isConfigured = true` while the API key resolved to
> `''` (the committed key was stripped in `c83cd5c` and has since been revoked), so every
> parse fired a keyless request, took a 400, and fell through to the regex parser. Same for
> insights. Removing it deleted one failing round-trip per parse and a leaked API key that
> was still live in `overview-analysis.js` on a public repo.
>
> `window.llmParser` is kept as the global name so existing call sites keep working; the
> class behind it is `TransactionParser`. Don't reintroduce an LLM parse path without a
> server-side key — a browser-held API key on a public repo is what caused the leak.

### PWA (`sw.js`)

Network-first, cache-as-fallback service worker with a versioned cache name (currently `expense-tracker-v8` in `sw.js`). Bump the version when shipping cached-asset changes — old clients won't pick up new HTML/CSS/JS otherwise.

### Push notifications (FCM)

- **`firebase-messaging-sw.js`** (root) — separate SW from `sw.js`, runs `firebase.messaging().onBackgroundMessage`. Uses Firebase v8 `compat` SDK to match the rest of the app.
- **`js/notifications.js`** — `enableNotifications()` requests permission, registers the messaging SW, gets a token via `messaging.getToken({ vapidKey })`, writes to Firestore at `users/{uid}/fcmTokens/{token}`. The VAPID key is inlined.
- Settings page has a "Notifications" card with an Enable button. **Permission can only be requested in response to a user tap** (iOS rule) — never auto-prompt on page load.
- **iOS gotcha**: web push only works on iOS 16.4+ AND only after the PWA is added to Home Screen. In Safari directly, the permission prompt won't appear and `getToken()` will fail.
- **Sender**: the notification section of `gmail-import/apps-script.js`. Notifications are **event-driven**, not scheduled — see `docs/superpowers/specs/2026-08-01-event-driven-notifications-design.md`. Two events: (1) `processChaseEmails()` pushes **one** batched notification per 15-minute sync that actually imported something — never one per transaction, so a 50-row backlog sweep sends one push; the merchant name appears only when the batch is exactly 1. (2) One `sendEndOfDaySummary` trigger at 22:00 carrying the habit check-in prompt with `data.view = 'habit'`. A run that imported nothing sends nothing. Exactly-once comes free from the `processedIds` ledger — **don't add a second definition of "new"**. No quiet hours and no pending/accumulator state: batching already caps the rate at ~4/hour, and OS-level Do Not Disturb is the right layer for silencing.
- **Deploying the sender is a separate step.** The file in git is NOT the running code — `apps-script.js` only takes effect after `cd gmail-import && clasp push`. Then run `setupNotifications()` once in the Apps Script editor to retire the old triggers and create the 22:00 one. `firebase-messaging-sw.js` still ignores `payload.data` on `notificationclick` and always opens `./`; routing on `data.view` is a pending one-liner there.
- **The GitHub Actions sender was removed** (`.github/workflows/notifications.yml` + `scripts/send-notifications.js`, deleted 2026-08-01). It polled hourly and gated on `hour === SLOT`, so cron drift lost the slot — measured delivery was ~1 of 3 slots per day, once missing by 17 seconds because `npm install` pushed `node` past the hour boundary. Don't reintroduce a polling sender; the importer already knows what it imported. Recover the old code from git history if ever needed.
- **No repo secret is required any more.** The Apps Script authenticates with `ScriptApp.getOAuthToken()`; `FIREBASE_SERVICE_ACCOUNT` is obsolete and can be deleted from repo settings.
- **Two message templates, not twelve.** `buildSyncBatchMessage_` and `buildEndOfDayMessage_` in `apps-script.js`, both fed by `budgetParts_` so they can't disagree about the month position. The old 3-slot × 4-budget-state matrix (`buildNotificationMessage_`) is deleted. `js/notifications.js` mirrors both as `previewSyncBatchMessage` / `previewEndOfDayMessage` for the in-app "fire now" preview — **change one, change both**; `tools/test-notifications.js` asserts the two produce identical copy across five budget states.
- **`collapseKey` on every push.** Per-purpose (`ledgr-sync`, `ledgr-end-of-day`), set on all three platform blocks (`android.collapse_key`, `apns.headers['apns-collapse-id']`, `webpush.notification.tag`). Without it iOS **stacks** duplicates instead of superseding — this was the reported duplicate-push symptom. Any new push must set one.
- **A failed read sends NOTHING.** `fetchExpensesFromFirestore_`, `fetchGamification_` and `fetchFcmTokens_` all **throw** on unexpected failure, and `send_` aborts. Previously a swallowed Firestore 4xx became `return []` → `monthTotal = 0` → HEALTHY → a push announcing invented headroom, indistinguishable from a real one. Never derive a budget number from a failed query. (A 404 is the one benign case: no gamification doc / no tokens yet.)
- **Stale-token deletion matches the structured FCM error code only** (`classifyFcmError_`, `UNREGISTERED`). The old code substring-matched the raw body for `NOT_FOUND`/`UNREGISTERED`/`INVALID_ARGUMENT` — but FCM returns `INVALID_ARGUMENT` for a malformed *request* and `NOT_FOUND` for a wrong *project path*, so one typo in `projectId` wiped the entire `fcmTokens` collection in a single run. **Never delete a token on a request-shaped error.**
- **Retiring notification triggers**: use `retireFixedNotificationTriggers()`, never `stopAllTriggers()` — the latter also kills the 15-minute `processChaseEmails` trigger, which is now what sends sync notifications.
- **Tunable constants** live in `gmail-import/apps-script.js`: `MONTHLY_TOTAL_SOFT` ($1000), `MONTHLY_TOTAL_HARD` ($2000), `MONTHLY_FOOD` ($400), `FOOD_CATEGORIES`, plus `isBudgetRow_` (the one gate: not a trip row, not `excludeFromBudget`, `kind` absent-or-`variable`). `js/notifications.js` mirrors these exactly. **Two other copies still drift and are deliberately not owned by the notification code**: `script.js:911` defines `SOFT`/`HARD`/`FOOD` inline and `script.js:933` `_computeAimToday` duplicates the state machine (same numbers), but `script.js:904` computes `daysLeft` **excluding** today while both senders include it — so Home's "aim today" and the push's "$X/day left" divide by figures one apart (verified in-browser: Home said "30 days left" on Aug 1 where the sender says 31). Collapsing that means touching Home's headline number; do it deliberately, not as a side effect.
- **Unit harness**: `node tools/test-notifications.js` (~121 assertions). Loads `apps-script.js` with node's `vm` against stubbed Apps Script globals and re-execs itself with `TZ=America/New_York` to match `appsscript.json` — two of the fixed bugs only appear when the script zone and `NOTIFICATION_TZ` disagree. `test.sh` does **not** cover `apps-script.js`, so run this after any change to it.
- **Token lifecycle**: `enableNotifications()` and `refreshFcmTokenSilently()` both call `saveTokenAndDedupe()`, which writes the new token then deletes any other doc with the same `userAgent`. Auto-refresh runs on every authenticated app load (hooked from `js/auth.js`'s `onAuthStateChanged`). The Settings button label switches to "Refresh now" once permission is granted.
- **iOS APNs gotcha**: tokens go silently stale when iOS recycles a PWA's APNs binding (after reboots, idle periods, OS updates). FCM still reports `Sent` but the device never receives the push. The auto-refresh on app open is the workaround — opening Ledgr re-handshakes APNs and updates the Firestore token. Without that, users would have to tap Refresh manually.
- **Gamification cloud sync** (`js/gamification.js`): `save()` schedules a debounced (~2s) write to `users/{uid}/state/gamification`, and `hydrateFromCloud()` runs on auth so streak/check-in state follows the user across devices. The sender reads this doc to drive the 10pm push copy (checked-in vs. nudge-to-log, streak count, mood label).

## Conventions (from `.kiro/`)

- **Material Design 3 dark theme only.** No light-theme Tailwind classes (`text-gray-*`, `bg-gray-*`, `text-red-*`, `text-green-*`). Use inline styles with `var(--md-sys-color-*)` tokens or hex.
- **No emojis in UI** — use Material Symbols Rounded. Icon-only buttons need `aria-label`.
- Color palette: gradient `#667eea → #764ba2` for primary CTAs; muted coral `#cf6679` for negatives; primary blue for positives. Exception: Monthly Report pills use `#43e97b`.
- Touch targets ≥44px, all modals dismissible via backdrop tap + close button, currency formatted via `formatCurrency()` from `utils.js`.
- See `.kiro/ui-rules.md` (UI standards), `.kiro/performance-rules.md` (LCP <1s — defer non-critical scripts, async fonts), and `.kiro/defensive-coding-rules.md` (DOM/tracker access patterns).

## Working in this repo

- `script.js` is intentionally one big file — extending the existing `ExpenseTracker` prototype is preferred over creating a new module. Only split out into `js/*.js` for genuinely independent subsystems (auth, LLM, parsers).
- The user's `.kiro/steering/project-context.md` says "Ask user before pushing to git." Default to NOT running `git push`.
- `dist/` is build output — don't edit by hand.
