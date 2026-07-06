# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- `npm run dev` — Vite dev server (auto-opens browser). For a no-bundler equivalent, `python3 -m http.server 8000` works because the app loads scripts via `<script>` tags from `index.html`.
- `npm run build` / `npm run preview` — Vite production build / preview.
- `./test.sh` — Pre-commit smoke test. Runs Vite build, `node -c` syntax check on every JS file, verifies every `src=` and `href=` referenced in `index.html` exists, scans `onclick="fn("` handlers in HTML and confirms `function fn` exists in JS, and warns on `getElementById` calls whose ID is not in `index.html` and lacks a null guard. **Run before every commit** — there is no other lint/typecheck.
- Tailwind rebuild (only if you switch off the CDN): `npx tailwindcss -i styles/tailwind-input.css -o styles/tailwind.css --minify`. Note `index.html` currently loads Tailwind from `cdn.tailwindcss.com/3.4.1`; `.kiro/performance-rules.md` says to NEVER do this — treat any new work as restoring the local build.
- No unit-test runner is wired up. Files in `tests/` are standalone HTML/JS demos — open them in a browser; they are not run by `test.sh`.

## Architecture

This is a **vanilla-JS single-page PWA** — no framework, no module bundler at runtime. `index.html` loads scripts via classic `<script>` tags in a fixed order, so all JS files share the global `window` namespace. Order matters (from `index.html`): `defensive.js` → `config.js` → `utils.js` → `trips.js` → `forecast.js` → `trip-dashboard.js` → `merchant-frequency.js` → `auth.js` → `llm-integration.js` → `smart-input.js` → `quick-add.js` → `gamification.js` → `email-parser.js` → `notifications.js`, then `script.js` last (via `<script src="script.js">` at end of body, after all `js/*.js`). When adding a script tag, keep dependencies earlier in the list, and `test.sh` verifies the file exists.

`index.html` is the whole UI: a fixed header, a **4-tab** bottom nav (Home/`dashboard`, Trips, Txns/`transactions`, History), and one `<div class="page-content">` per page that JS shows/hides via `showPage()`. Most page bodies are empty containers (`<div id="home-month-hero">`, `<div id="history-month-rail">`, …) that the renderers fill.

**Not loaded / dead code** (present in the repo but referenced by nothing — don't wire new features through them): `js/overview-analysis.js` (`BehavioralAnalysisAI`) and root `main.js` (a Vite CSS entry that isn't the configured entry point).

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

### LLM integration (`js/llm-integration.js`)

Gemini 2.0 Flash-Lite for two things: (1) parsing natural-language expense input like `100 at castilla on food 02/18`, and (2) generating spending insights on the dashboard. Both fall back to local logic when the API key is missing or fails:
- Input parsing falls back to a regex parser in `smart-input.js`.
- Insights fall back to `ExpenseTracker.prototype.templateInsights` in `script.js`.

Insights are cached per `day + expense count` to limit API calls.

### PWA (`sw.js`)

Network-first, cache-as-fallback service worker with a versioned cache name (currently `expense-tracker-v8` in `sw.js`). Bump the version when shipping cached-asset changes — old clients won't pick up new HTML/CSS/JS otherwise.

### Push notifications (FCM)

- **`firebase-messaging-sw.js`** (root) — separate SW from `sw.js`, runs `firebase.messaging().onBackgroundMessage`. Uses Firebase v8 `compat` SDK to match the rest of the app.
- **`js/notifications.js`** — `enableNotifications()` requests permission, registers the messaging SW, gets a token via `messaging.getToken({ vapidKey })`, writes to Firestore at `users/{uid}/fcmTokens/{token}`. The VAPID key is inlined.
- Settings page has a "Notifications" card with an Enable button. **Permission can only be requested in response to a user tap** (iOS rule) — never auto-prompt on page load.
- **iOS gotcha**: web push only works on iOS 16.4+ AND only after the PWA is added to Home Screen. In Safari directly, the permission prompt won't appear and `getToken()` will fail.
- **Sender**: `.github/workflows/notifications.yml` runs hourly. It executes `scripts/send-notifications.js` (Node, isolated `package.json` so the PWA's deps don't get polluted with `firebase-admin`). The script reads each registered token's stored `tz`, computes the device's local hour, and sends one of three messages at 9am / 6pm / 10pm local time. Stale tokens are auto-deleted from Firestore.
- **Required GitHub repo secret**: `FIREBASE_SERVICE_ACCOUNT` — full JSON of a service-account key from Firebase Console → Project Settings → Service Accounts → Generate new private key. Paste the entire JSON as the secret value. Without this the workflow fails immediately.
- **Tunable constants** in `scripts/send-notifications.js`: `MONTHLY_TOTAL_SOFT` ($1000), `MONTHLY_TOTAL_HARD` ($2000), `MONTHLY_FOOD` ($400), `FOOD_CATEGORIES`. These are not in app Settings yet — keep mirrored copies in `js/notifications.js` (preview path).
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
