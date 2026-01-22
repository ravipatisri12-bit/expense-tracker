# Checkpoint 5: Manual Testing Checklist

## Overview
This document provides a comprehensive manual testing checklist for verifying the core functionality implemented in Tasks 1-4.

## Test Environment
- Browser: Chrome/Safari/Firefox
- Device: Desktop and Mobile (375px viewport)
- LocalStorage: Enabled

---

## Test 1: Adding Expenses Through Form ✓

### Steps:
1. Open `index.html` in browser
2. Click on "Add" in bottom navigation
3. Fill out the expense form:
   - Amount: `25.50`
   - Description: `Lunch at Chipotle`
   - Category: `Food`
   - Date: Today's date
4. Click "Add Expense" button

### Expected Results:
- ✓ Form accepts positive amount
- ✓ Form accepts non-empty description
- ✓ Expense is added to the list
- ✓ Success toast message appears
- ✓ Form is cleared after submission
- ✓ Dashboard updates immediately

### Validation Tests:
- Try entering negative amount → Should show error
- Try entering empty description → Should show error
- Try submitting without category → Should show error

---

## Test 2: Dashboard Updates Correctly ✓

### Steps:
1. Navigate to Home page
2. Observe the dashboard summary cards
3. Add a new expense (e.g., $50 Coffee)
4. Return to Home page

### Expected Results:
- ✓ Total Income displays correctly (from settings)
- ✓ Total Expenses updates after adding expense
- ✓ Variable Expenses calculated correctly
- ✓ Savings calculated correctly (Income - Total Expenses)
- ✓ Budget Left calculated correctly
- ✓ Daily Average displays
- ✓ Weekly Spending displays
- ✓ All numbers animate smoothly

### Calculation Verification:
```
Given:
- Income: $5,000
- Fixed Expenses: $2,000 (Rent: $1,500 + Utilities: $200 + Insurance: $300)
- Variable Expenses: (Total Expenses - Fixed Expenses)

Expected:
- Variable Budget = Income - Fixed = $5,000 - $2,000 = $3,000
- Budget Left = Variable Budget - Variable Expenses
- Savings = Income - Total Expenses
```

---

## Test 3: Gauge Updates with Correct Colors ✓

### Steps:
1. Start with empty expenses
2. Add expenses to reach different spending thresholds
3. Observe gauge color and status message changes

### Test Cases:

#### Case 1: Under 70% (Green - "On track")
- Add expenses totaling $1,500 (50% of $3,000 variable budget)
- **Expected**: Green gauge, "On track for month"

#### Case 2: 70-90% (Yellow - "Approaching limit")
- Add expenses totaling $2,400 (80% of $3,000 variable budget)
- **Expected**: Yellow gauge, "Approaching limit"

#### Case 3: Over 90% (Red - "Over budget")
- Add expenses totaling $2,800 (93% of $3,000 variable budget)
- **Expected**: Red gauge, "Over budget"

### Gauge Visual Verification:
- ✓ Arc fills proportionally to percentage
- ✓ Spent amount displays correctly
- ✓ Budget total displays correctly
- ✓ Percentage displays correctly
- ✓ Status indicator dot pulses
- ✓ Smooth animation (0.6s transition)

---

## Test 4: Data Persists in LocalStorage ✓

### Steps:
1. Add 3-5 expenses through the form
2. Update settings (income, fixed expenses)
3. Close the browser tab
4. Reopen `index.html`

### Expected Results:
- ✓ All expenses are still visible
- ✓ Settings are preserved
- ✓ Dashboard calculations are correct
- ✓ Gauge reflects saved data
- ✓ Recent transactions list shows saved expenses

### LocalStorage Verification:
Open browser DevTools → Application → Local Storage → Check:
- `glassui_expenses` key exists with array of expenses
- `glassui_settings` key exists with settings object

### Immediate Persistence Test:
1. Add an expense
2. Immediately check LocalStorage (before page reload)
3. **Expected**: Data is saved instantly

---

## Test 5: Quick Add Modal ✓

### Steps:
1. Click "Quick Add Expense" button on home page
2. Follow the 3-step modal flow:
   - Step 1: Enter description or click suggestion
   - Step 2: Enter amount
   - Step 3: Review and confirm

### Expected Results:
- ✓ Modal opens with glass effect
- ✓ Step 1: Description input works
- ✓ Step 1: Category suggestions work
- ✓ Step 2: Amount input validates positive numbers
- ✓ Step 3: Summary displays correctly
- ✓ "Add Expense" button saves and closes modal
- ✓ Dashboard updates immediately
- ✓ Success toast appears

---

## Test 6: Transaction List ✓

### Steps:
1. Add multiple expenses
2. View Recent transactions on Home page
3. Check transaction details

### Expected Results:
- ✓ Shows last 10 expenses
- ✓ Displays in reverse chronological order (newest first)
- ✓ Shows category emoji
- ✓ Shows description
- ✓ Shows relative time ("2 hours ago", "Yesterday")
- ✓ Shows amount in red with minus sign
- ✓ Edit and delete buttons visible
- ✓ Stagger animation on load

---

## Test 7: Navigation ✓

### Steps:
1. Click each navigation item in bottom bar
2. Verify page transitions

### Expected Results:
- ✓ Home → Shows dashboard and gauge
- ✓ Overview → Shows category breakdown and stats
- ✓ Add → Shows expense form (or opens Quick Add modal)
- ✓ Insights → Shows transactions page with filters
- ✓ Settings → Shows configuration forms
- ✓ Active nav item highlighted in blue
- ✓ Smooth page transitions

---

## Test 8: Responsive Behavior ✓

### Steps:
1. Open DevTools
2. Test at different viewport widths:
   - 320px (iPhone SE)
   - 375px (iPhone 12)
   - 414px (iPhone 12 Pro Max)
   - 768px (iPad)

### Expected Results:
- ✓ No horizontal scrolling at any width
- ✓ Touch targets ≥ 44px
- ✓ Text remains readable
- ✓ Cards stack properly
- ✓ Navigation bar stays fixed at bottom
- ✓ Safe area insets respected on notched devices

---

## Test 9: Animations ✓

### Steps:
1. Load the app
2. Add an expense
3. Navigate between pages

### Expected Results:
- ✓ Numbers count up smoothly
- ✓ Gauge arc animates (0.6s)
- ✓ Transaction items fade in with stagger
- ✓ Cards have hover effects
- ✓ Buttons have press states
- ✓ Modal slides up smoothly
- ✓ Toast messages slide in/out

---

## Test 10: Error Handling ✓

### Steps:
1. Try to add expense with invalid data
2. Check browser console for errors

### Expected Results:
- ✓ Validation errors show user-friendly messages
- ✓ No console errors during normal operation
- ✓ LocalStorage errors handled gracefully
- ✓ Missing elements don't crash the app

---

## Browser Compatibility Checklist

### Chrome/Edge (Chromium)
- [ ] All features work
- [ ] Backdrop-filter blur renders correctly
- [ ] Animations smooth

### Safari (macOS/iOS)
- [ ] All features work
- [ ] -webkit-backdrop-filter works
- [ ] Touch gestures work on iOS
- [ ] Safe area insets respected

### Firefox
- [ ] All features work
- [ ] Backdrop-filter supported (or fallback works)
- [ ] Animations smooth

---

## Performance Checklist

- [ ] Page loads in < 2 seconds
- [ ] Animations run at 60fps
- [ ] No layout shifts during load
- [ ] LocalStorage operations are fast
- [ ] No memory leaks after multiple operations

---

## Accessibility Checklist

- [ ] Keyboard navigation works
- [ ] Focus states visible
- [ ] Form labels associated with inputs
- [ ] Color contrast meets WCAG AA
- [ ] Touch targets ≥ 44px

---

## Known Issues / Notes

_Document any issues found during testing:_

1. 
2. 
3. 

---

## Sign-off

**Tester**: _______________  
**Date**: _______________  
**Status**: ☐ Pass ☐ Fail ☐ Pass with issues  

**Notes**:
