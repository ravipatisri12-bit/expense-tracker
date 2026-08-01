# Gmail → Ledgr Auto-Import Setup

## How It Works

```
Gmail label "Chase Transactions" (unread)
  → Apps Script (every 15 min)
    → Parse subject: "$14.50 transaction with MENDOCINO FARMS"
    → Match merchant to category from your Ledgr history
    → Write to Firestore → appears in Ledgr automatically
    → Mark email as read
```

## Setup Steps

### 1. Create the Apps Script

1. Go to [script.google.com](https://script.google.com) → **New Project**
2. Delete the default code, paste contents of `apps-script.js`
3. Rename project to "Ledgr Gmail Import"

### 2. Set Script Properties

Go to **Project Settings** (gear icon) → **Script Properties** → Add:

| Property | Value |
|---|---|
| `FIREBASE_UID` | Your Firebase user ID (find in browser console: `firebaseAuth.currentUser.uid`) |
| `FIREBASE_PROJECT_ID` | `personal-expense-tracker-7aa9c` |

### 3. Enable Firestore Access

The script writes to Firestore via REST API. Your Firestore security rules need to allow writes from the script. Two options:

**Option A: Add a Firestore rule for the script** (recommended)
Your existing rules likely require `request.auth != null`. Since Apps Script uses unauthenticated REST calls, add a temporary rule or use a Firebase service account.

**Option B: Use Firebase Admin SDK via Apps Script**
Add the [FirebaseApp library](https://github.com/nicholasgasior/gapps-firebase) to your Apps Script project for authenticated writes.

### 4. Build the Merchant Map

Run `buildMerchantMap()` once manually in the Apps Script editor. This reads your existing Ledgr transactions and builds a merchant→category lookup.

Re-run periodically (or add a daily trigger) to pick up new merchants you've categorized in Ledgr.

### 5. Set Up the Trigger

1. In Apps Script editor → **Triggers** (clock icon)
2. **Add Trigger**:
   - Function: `processChaseEmails`
   - Event source: Time-driven
   - Type: Minutes timer
   - Interval: Every 15 minutes

## How Categories Work

- Script reads your existing Ledgr expenses from Firestore
- Builds a map: `"MENDOCINO FARMS" → "Food"`, `"UBER" → "Transportation"`, etc.
- New Chase transactions are matched against this map
- Unknown merchants get `"Other"` — edit them in Ledgr, and next map rebuild learns the mapping

## Identifying Auto-Imported Transactions

All auto-imported expenses have `source: "chase-gmail"` field. You can filter on this in Ledgr to see which transactions came from Gmail vs manual entry.
