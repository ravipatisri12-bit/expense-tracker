# Glass UI Fixes - Implementation Plan

## Status: In Progress

### Completed Fixes

#### 1. ✅ Gauge Size and Negative Signs
- **File**: `glass-ui-prototype/index.html` and `styles.css`
- **Changes**:
  - Increased gauge size from 200px to 280px
  - Removed negative signs from amount displays
  - Updated `updateGauge()` to use real data instead of mock data

#### 2. ✅ Privacy Mode - Selective Hiding
- **File**: `glass-ui-prototype/script.js`
- **Changes**:
  - Modified `formatAmount(amount, hideInPrivacy = false)` to accept a parameter
  - Only hide income and savings when `hideInPrivacy = true`
  - Keep all expenses visible regardless of privacy mode

### In Progress

#### 3. 🔄 Remove Duplicate Summary Cards from Home
- **File**: `glass-ui-prototype/index.html`
- **Changes Needed**:
  - Remove the 4 mini-cards from home page (Income, Expenses, Variable, Savings)
  - Keep them only in Overview page
  - Home should focus on gauge and recent transactions

#### 4. 🔄 Transactions Page Redesign
- **File**: `glass-ui-prototype/index.html` and `script.js`
- **Changes Needed**:
  - Remove filter dialogue box
  - Create date-grouped transaction list
  - Show date on left with transaction count
  - Show total sum for day on right
  - List transactions below each date
  - Add Export CSV button at top

#### 5. 🔄 Sign-In Functionality
- **Files**: `glass-ui-prototype/index.html` and new `auth.js`
- **Changes Needed**:
  - Add sign-in button in header
  - Implement Google Sign-In with Firebase
  - Show user avatar when signed in
  - Add sign-out option

### Pending

#### 6. ⏳ Firebase Data Integration
- Load existing data from Firestore on sign-in
- Sync local storage with Firebase
- Show loading states

#### 7. ⏳ Add Transactions by Date
- Ensure date input works properly
- Default to today
- Allow past/future dates

#### 8. ⏳ View All Button Navigation
- Make button navigate to transactions page
- Show proper summary

#### 9. ⏳ Detailed Add Form
- Keep Quick Add for home
- Make Add section have full form with all fields visible

## Key Code Changes

### formatAmount Method (COMPLETED)
```javascript
formatAmount(amount, hideInPrivacy = false) {
    if (this.settings.privacyMode && hideInPrivacy) {
        return '****';
    }
    return `${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
```

### Usage Examples
```javascript
// Income - should be hidden in privacy mode
this.formatAmount(income, true)

// Savings - should be hidden in privacy mode  
this.formatAmount(savings, true)

// Expenses - should always be visible
this.formatAmount(expenses, false)

// Variable expenses - should always be visible
this.formatAmount(variableExpenses, false)
```

### Gauge Size Changes (COMPLETED)
```css
.spending-gauge {
    width: 280px;  /* was 200px */
    height: 280px; /* was 200px */
}
```

## Testing Checklist

- [x] Privacy mode only hides income/savings
- [x] Gauge displays large numbers properly
- [x] No negative signs on amounts (except where appropriate)
- [ ] No duplicate cards on home page
- [ ] Transactions page shows date-grouped list
- [ ] Sign-in/sign-out works
- [ ] Can add transactions with custom dates
- [ ] View All navigates correctly
- [ ] Firebase data loads on sign-in
- [ ] CSV export works

## Next Steps

1. Update all `formatAmount()` calls to use the new parameter
2. Remove duplicate summary cards from home page HTML
3. Redesign transactions page with date grouping
4. Add sign-in UI and Firebase authentication
5. Test all changes thoroughly
