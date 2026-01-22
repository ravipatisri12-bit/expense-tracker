# Firestore Sync Flow Diagram

## Data Flow Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     User Actions                                 │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
        ┌─────────────────────────────────────────┐
        │  Add/Edit/Delete Expense                │
        │  Update Settings (Income, Rent, etc.)   │
        └─────────────────────────────────────────┘
                              │
                              ▼
        ┌─────────────────────────────────────────┐
        │  ExpenseTracker Methods                 │
        │  - addExpense()                         │
        │  - editExpense()                        │
        │  - deleteExpense()                      │
        │  - updateIncome()                       │
        │  - updateFixedExpense()                 │
        └─────────────────────────────────────────┘
                              │
                              ▼
        ┌─────────────────────────────────────────┐
        │  Save to localStorage                   │
        │  - saveExpenses()                       │
        │  - saveSettings()                       │
        └─────────────────────────────────────────┘
                              │
                              ▼
        ┌─────────────────────────────────────────┐
        │  Check Authentication                   │
        │  if (getCurrentUser()) { ... }          │
        └─────────────────────────────────────────┘
                              │
                    ┌─────────┴─────────┐
                    │                   │
                    ▼                   ▼
            ┌───────────┐       ┌──────────────┐
            │ Signed In │       │ Not Signed In│
            └───────────┘       └──────────────┘
                    │                   │
                    ▼                   ▼
        ┌──────────────────┐    ┌──────────────┐
        │ syncToFirestore()│    │ Skip Sync    │
        └──────────────────┘    └──────────────┘
                    │
                    ▼
        ┌─────────────────────────────────────────┐
        │  Firebase Firestore                     │
        │  /users/{userId}/                       │
        │  {                                      │
        │    expenses: [...],                     │
        │    settings: {...},                     │
        │    lastUpdated: Timestamp               │
        │  }                                      │
        └─────────────────────────────────────────┘
```

---

## Sign-In Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                     User Signs In                                │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
        ┌─────────────────────────────────────────┐
        │  auth.js: signInWithGoogle()            │
        └─────────────────────────────────────────┘
                              │
                              ▼
        ┌─────────────────────────────────────────┐
        │  Firebase Authentication                │
        │  Returns user object with uid           │
        └─────────────────────────────────────────┘
                              │
                              ▼
        ┌─────────────────────────────────────────┐
        │  auth.js: onAuthStateChanged()          │
        │  Listener detects sign-in               │
        └─────────────────────────────────────────┘
                              │
                              ▼
        ┌─────────────────────────────────────────┐
        │  Call window.loadFromFirestore()        │
        └─────────────────────────────────────────┘
                              │
                              ▼
        ┌─────────────────────────────────────────┐
        │  ExpenseTracker.loadFromFirestore()     │
        │  - Fetch data from Firestore            │
        │  - Load expenses array                  │
        │  - Load settings object                 │
        └─────────────────────────────────────────┘
                              │
                              ▼
        ┌─────────────────────────────────────────┐
        │  Update UI                              │
        │  - updateDashboard()                    │
        │  - Show toast: "Data synced from cloud" │
        └─────────────────────────────────────────┘
                              │
                              ▼
        ┌─────────────────────────────────────────┐
        │  Backup to localStorage                 │
        │  - saveExpenses()                       │
        │  - saveSettings()                       │
        └─────────────────────────────────────────┘
```

---

## Error Handling Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                     Sync Attempt                                 │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
        ┌─────────────────────────────────────────┐
        │  Check Firestore Availability           │
        └─────────────────────────────────────────┘
                              │
                    ┌─────────┴─────────┐
                    │                   │
                    ▼                   ▼
            ┌───────────┐       ┌──────────────────┐
            │ Available │       │ Not Available    │
            └───────────┘       └──────────────────┘
                    │                   │
                    │                   ▼
                    │           ┌──────────────────┐
                    │           │ Log Warning      │
                    │           │ Skip Sync        │
                    │           └──────────────────┘
                    │
                    ▼
        ┌─────────────────────────────────────────┐
        │  Check User Authentication              │
        └─────────────────────────────────────────┘
                              │
                    ┌─────────┴─────────┐
                    │                   │
                    ▼                   ▼
            ┌───────────┐       ┌──────────────────┐
            │Authenticated│     │ Not Authenticated│
            └───────────┘       └──────────────────┘
                    │                   │
                    │                   ▼
                    │           ┌──────────────────┐
                    │           │ Log Warning      │
                    │           │ Skip Sync        │
                    │           └──────────────────┘
                    │
                    ▼
        ┌─────────────────────────────────────────┐
        │  Attempt Firestore Operation            │
        └─────────────────────────────────────────┘
                              │
                    ┌─────────┴─────────┐
                    │                   │
                    ▼                   ▼
            ┌───────────┐       ┌──────────────────┐
            │  Success  │       │     Error        │
            └───────────┘       └──────────────────┘
                    │                   │
                    ▼                   ▼
        ┌──────────────────┐    ┌──────────────────────────┐
        │ Log Success      │    │ Check Error Type         │
        │ Update lastSync  │    │ - permission-denied      │
        └──────────────────┘    │ - unavailable            │
                                │ - other                  │
                                └──────────────────────────┘
                                            │
                                            ▼
                                ┌──────────────────────────┐
                                │ Show Appropriate Toast   │
                                │ Fall Back to localStorage│
                                └──────────────────────────┘
```

---

## Multi-Device Sync Scenario

```
Device A                          Firestore                    Device B
────────                          ─────────                    ────────

User adds expense
      │
      ▼
saveExpenses()
      │
      ▼
syncToFirestore() ──────────────▶ Update
                                  /users/{uid}/
                                  expenses: [...]
                                  lastUpdated: T1
                                                                    │
                                                                    │
                                                    User signs in ◀─┘
                                                                    │
                                                                    ▼
                                                    loadFromFirestore()
                                                                    │
                                                                    ▼
                                                    Fetch data from
                                                    /users/{uid}/
                                                                    │
                                                                    ▼
                                                    Update UI with
                                                    synced expenses
                                                                    │
                                                                    ▼
                                                    Backup to
                                                    localStorage
```

---

## Offline/Online Transition

```
┌─────────────────────────────────────────────────────────────────┐
│                     User is Offline                              │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
        ┌─────────────────────────────────────────┐
        │  User adds/edits expenses               │
        └─────────────────────────────────────────┘
                              │
                              ▼
        ┌─────────────────────────────────────────┐
        │  Save to localStorage                   │
        │  (Sync attempt fails silently)          │
        └─────────────────────────────────────────┘
                              │
                              ▼
        ┌─────────────────────────────────────────┐
        │  Toast: "Network error. Saved locally"  │
        └─────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     User Comes Online                            │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
        ┌─────────────────────────────────────────┐
        │  User makes any change                  │
        │  (add expense, update settings)         │
        └─────────────────────────────────────────┘
                              │
                              ▼
        ┌─────────────────────────────────────────┐
        │  saveExpenses() / saveSettings()        │
        └─────────────────────────────────────────┘
                              │
                              ▼
        ┌─────────────────────────────────────────┐
        │  syncToFirestore()                      │
        │  (Now succeeds - network available)     │
        └─────────────────────────────────────────┘
                              │
                              ▼
        ┌─────────────────────────────────────────┐
        │  All local changes synced to cloud      │
        └─────────────────────────────────────────┘
```

---

## Key Integration Points

### 1. Auth State Change
- **File:** `js/auth.js`
- **Function:** `onAuthStateChanged()`
- **Trigger:** User signs in/out
- **Action:** Calls `window.loadFromFirestore()` on sign-in

### 2. Expense Operations
- **File:** `glass-ui-prototype/script.js`
- **Functions:** `addExpense()`, `editExpense()`, `deleteExpense()`
- **Trigger:** Any expense modification
- **Action:** Calls `saveExpenses()` → triggers `syncToFirestore()`

### 3. Settings Updates
- **File:** `glass-ui-prototype/script.js`
- **Functions:** `updateIncome()`, `updateFixedExpense()`, `addCategory()`, etc.
- **Trigger:** Any settings modification
- **Action:** Calls `saveSettings()` → triggers `syncToFirestore()`

---

## Data Consistency Strategy

1. **Primary Storage:** localStorage (always available)
2. **Cloud Backup:** Firestore (when authenticated)
3. **Sync Direction:** Bidirectional
   - Local → Cloud: On every data change
   - Cloud → Local: On sign-in
4. **Conflict Resolution:** Last-write-wins (based on lastUpdated timestamp)
5. **Offline Support:** Full functionality with localStorage
6. **Online Sync:** Automatic and transparent

---

## Security Considerations

### Firestore Security Rules (Required)

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users can only read/write their own data
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

### Data Privacy
- User data is isolated by `userId`
- Only authenticated users can access their own data
- No cross-user data access
- Privacy mode hides amounts in UI (not in storage)

---

## Performance Considerations

1. **Sync Frequency:** On every data change (not throttled)
2. **Data Size:** Small (expenses array + settings object)
3. **Network Impact:** Minimal (only syncs when online and authenticated)
4. **UI Responsiveness:** Non-blocking (async operations)
5. **Error Recovery:** Automatic retry on next data change

---

## Future Enhancements (Task 17.4)

- Offline detection and status indicator
- Sync conflict resolution UI
- Manual sync trigger button
- Sync history/log
- Batch sync optimization
- Real-time sync with Firestore listeners
