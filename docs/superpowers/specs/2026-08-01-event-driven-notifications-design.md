# Event-driven notifications

**Date:** 2026-08-01
**Status:** approved
**Replaces:** the fixed 9am/6pm/10pm schedule in both senders

## Problem

Two senders do the same job on fixed schedules, and both are broken — in opposite ways.

**Sender A — GitHub Actions** (`.github/workflows/notifications.yml:4-5`) polls hourly
and gates on `hour === SLOT` (`scripts/send-notifications.js:235-238`). Measured from
run logs: **it delivers roughly 1 of 3 slots per day.** Hour 9 was skipped Jul 30 and
31; hour 18 was skipped Jul 30, 31 and Aug 1 — the last by **17 seconds**, because
`npm install` (167 packages) pushed `node` past the boundary at 02:00:17Z. Five runs
logged zero sends. The failure is inherent: an hourly poll with an equality gate loses
the slot whenever GitHub's queue slips past `:59`.

**Sender B — Apps Script** (`gmail-import/apps-script.js:543-545`) fires at fixed
9/18/22 with no hour gate, so it never misses a slot. But it fires **whether or not
anything happened**, and when it breaks it lies (see "Correctness repairs" below).

Neither sets an FCM `collapseKey`/`tag`, so iOS stacks both as separate notifications
— the reported duplicate-push symptom.

The deeper issue is that a fixed schedule is the wrong model. Notifications should
follow **events**: a transaction was imported, or the day ended.

## Design

### Sender: Apps Script only

`processChaseEmails()` already runs every 15 minutes and already knows exactly what it
imported. A separate hourly GitHub job polling for "did anything happen" is strictly
worse at a job the importer already does. Sender A is disabled.

**Exactly-once is already solved.** The `processedIds` ledger at
`users/{uid}/settings/gmail_sync` (added in commit 605c60f) means a transaction is new
precisely once, so a retried run cannot re-notify.

### Trigger 1 — batch per sync

One push per 15-minute cycle that imported anything, **regardless of transaction
count**. Not one per transaction.

Rationale: Chase already pushes an alert per transaction, so a per-transaction Ledgr
push would echo it seconds later. The unique value is the budget context Chase cannot
know. Batching also caps the rate at ~4/hour worst case and makes a backlog sweep
harmless by construction — a run that imports 50 historical transactions sends **one**
notification, not 50.

```
2 new · $27.45
$450 of $1,000 this month · $12/day left
```

Single transaction reads naturally with the same template:

```
1 new · $14.50 · Mendocino Farms
$450 of $1,000 this month · $12/day left
```

Include the merchant name only when the batch is exactly one.

### Trigger 2 — end of day

One 10pm trigger. Today's total, the count, month position, and the habit check-in
prompt. The prompt is the point: it drives the streak, and the notification is the
entry point.

```
$62 today · 4 transactions
$512 of $1,000 · tap to tag your day
```

The FCM payload carries a data key so tapping opens the habit card ready to log.

### No quiet hours

A sync notifies whenever it imported something, at any hour. Deliberately rejected:
holding overnight imports would need a `pendingNotifyCount` / `pendingNotifySum`
accumulator on the sync ledger plus a drain step on the first morning run — new
persistent state, a new failure mode if a drain is missed, and a second definition of
"what counts as new" alongside `processedIds`.

The cost of skipping it is bounded: batching already caps the rate at ~4/hour, and a
transaction only exists to import because Chase emailed about it — which means the
phone already buzzed once for that charge anyway. Overnight spending is rare, and the
OS-level Do Not Disturb / notification schedule is the right layer for silencing it,
not application logic.

### What does not notify

- **Manual entries.** You just typed it.
- **Syncs that imported nothing.** The overwhelming majority of the 96 daily runs.
- **Restored or edited rows.**

## Correctness repairs required by this choice

Keeping Apps Script means owning four confirmed defects. All must land with this work.

### 1. Silent fabrication — the worst one

`gmail-import/apps-script.js:678-681`:

```js
if (res.getResponseCode() >= 300) {
    Logger.log('Expense query failed: ' + …);
    return [];
}
```

Any Firestore 4xx becomes an empty array → `monthTotal = 0` → the target computes as
HEALTHY → it **confidently pushes "$33 to spend today" with invented numbers**,
indistinguishable from a real notification. Caught errors never trigger Apps Script's
failure email, and `"exceptionLogging": "STACKDRIVER"` captures nothing.

Fix: a failed read must **abort without sending**. Never send a budget number derived
from a failed query.

### 2. Destructive stale-token detection

`gmail-import/apps-script.js:765-772` substring-matches the raw FCM error body for
`NOT_FOUND` / `UNREGISTERED` / `INVALID_ARGUMENT`, then hard-deletes the token doc. But
FCM returns `INVALID_ARGUMENT` for a malformed *request* and `NOT_FOUND` for a wrong
*project path* — neither means the token is dead. **One typo in `projectId` returns
those for every token and wipes the entire `fcmTokens` collection in a single run**,
silently killing all push delivery until the user reopens the PWA.

Fix: match structured error codes only, the way `scripts/send-notifications.js:278-286`
does. Never delete on a request-shaped error.

### 3. `daysLeft` month-boundary bug

`gmail-import/apps-script.js:640-645` mixes two timezones:

```js
var today = parseInt(Utilities.formatDate(now, NOTIFICATION_TZ, 'dd'), 10);  // LA
var lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();  // script TZ = NY
```

`appsscript.json:2` declares `America/New_York` while `NOTIFICATION_TZ` is
`America/Los_Angeles`. On **Aug 31 22:00 PDT** it is already Sep 1 in ET, so
`getMonth()` returns September → `lastDay = 30` → `30 - 31 + 1 = 0 days left`. This is
the repo's recurring local-vs-implicit-timezone bug in a new disguise.

Fix: derive day, month and year from the same zone.

### 4. `excludeFromBudget` is never filtered

Neither sender references it, and Sender B structurally **cannot** — its REST parser
(`gmail-import/apps-script.js:688-693`) only reads `amount`, `category`, `date`,
`tripId`. The app's canonical helper does filter it (`script.js:2327`), so pushes
already overstate the month total versus Home. With a $420 excluded car repair, Home
says `$450 of $1,000` and the push says `$870 of $1,000`.

Fix: add the field to the REST parser and filter it. **This must land alongside the
income/fixed gate** or the two will disagree in a new way.

## Also in scope

- **`collapseKey`** on every push. Neither sender sets one; this is the actual cause of
  iOS stacking duplicates. Use a per-slot key so a replacement supersedes rather than
  stacks.
- **Collapse the budget model.** It exists in four copies today:
  `scripts/send-notifications.js:86-104`, `gmail-import/apps-script.js:632-638`,
  `js/notifications.js:145-161`, `script.js:933-939`. Event-driven removes the 12
  slot×state branches entirely (3 slots × 4 states), leaving ~2 templates.
- **Disable Sender A positively**, not by neglect: delete the `schedule:` block or the
  workflow file. Removing code from the repo does not stop a server-side trigger.
- **Retire the fixed triggers** with a targeted function — *not* `stopAllTriggers()`,
  which would also kill the 15-minute `processChaseEmails` importer.

## Interaction with the income/fixed work

Both senders sum `expenses[]` with no `kind` filter, so an income row would make
`monthTotal` jump ~$4,000 and instantly trip `HARD_OVER` — pushing "Over $2000 cap".
`gmail-import/apps-script.js:565` is one of the 12 sites gated in phase 1 of
`2026-08-01-income-fixed-ledger-design.md`. That gate must be in place before any
income row exists.

## Verification

1. `node -c` clean on `gmail-import/apps-script.js` (`test.sh` does not cover it).
2. Unit-test the message builder against a stubbed Apps Script global set, the way
   `/tmp/pwdrv/test-appsscript-logic.js` already does — assert batch-of-1 vs batch-of-N
   copy, the "imported nothing ⇒ send nothing" case, and the month-boundary `daysLeft` fix
   across Aug 31 / Feb 28.
3. Assert a failed Firestore read **sends nothing** rather than a HEALTHY message.
4. Assert a malformed-request FCM error does **not** delete a token.
5. `clasp push`, then run `processChaseEmails()` manually with one unread test email and
   confirm exactly one push arrives with correct copy.
6. Confirm in the Apps Script UI that the three old time-based triggers are gone and
   the 15-minute importer trigger remains.
