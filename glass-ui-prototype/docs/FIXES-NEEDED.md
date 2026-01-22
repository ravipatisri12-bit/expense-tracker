# Glass UI Prototype - Issues and Fixes Needed

## Issues Identified

### 1. Home Page - Variable Spending Gauge
**Issue:** 
- The variable spending name can be better
- Total spent dollars should not be represented as negative
- Gauge needs to be bigger in circumference to avoid congestion with 4-6 digit prices

**Fix:**
- Rename "Variable Spending" to something clearer like "Monthly Spending" or "Discretionary Spending"
- Remove negative sign from amounts (currently showing `-$1,247`)
- Increase gauge size from 200px to at least 250-280px
- Adjust font sizes to accommodate larger numbers

### 2. Quick Add vs Detailed Add
**Issue:**
- Quick expense add is good in home page
- Add section needs detailed add functionality like normal add function
- Currently both are the same

**Fix:**
- Keep Quick Add modal for home page (simple 3-step flow)
- Add section should have full form with all fields visible at once
- Include additional fields: notes, tags, payment method, etc.

### 3. Duplicate Summary Cards
**Issue:**
- Income, Expense, Variable, Savings are duplicated in both Home and Overview pages
- This is redundant

**Fix:**
- Remove summary cards from Home page
- Keep them only in Overview page
- Home page should focus on the gauge and recent transactions

### 4. Cannot Add Transactions by Date
**Issue:**
- No ability to add transactions with custom dates
- Date field exists but may not be working properly

**Fix:**
- Ensure date input in Add Expense form is functional
- Default to today's date
- Allow users to select past/future dates
- Validate date input

### 5. Transactions Page Issues
**Issue:**
- Below nav bar has transactions but shows empty
- When clicking "View All" from home page, it takes to transactions page
- Filters are in a big dialogue box (not user-friendly)
- Need simple list sorted by date with totals

**Fix:**
- Remove filter dialogue box
- Create simple list grouped by date:
  - Date on left with transaction count
  - Total sum for the day on right
  - List of transactions below each date
- Add "Export to CSV" button at top
- Filters can be added later with better UI

### 6. Firebase Data Integration
**Issue:**
- User has data in Firebase database
- Unclear if signing in will use existing data

**Fix:**
- Implement proper Firebase authentication
- Load user's existing data from Firestore on sign-in
- Sync local storage with Firebase
- Show loading state during data fetch

### 7. Privacy Mode Issues
**Issue:**
- Privacy mode makes ALL prices show as ****
- Should only hide income and savings
- Expenses should still be visible

**Fix:**
- Update `formatAmount()` method to accept a parameter for what to hide
- Only apply privacy mode to:
  - Total Income
  - Savings amount
- Keep visible:
  - All expense amounts
  - Variable spending
  - Budget left

### 8. Sign In Functionality Missing
**Issue:**
- No visible sign-in functionality
- User cannot authenticate

**Fix:**
- Add sign-in button in header/settings
- Implement Google Sign-In
- Show user avatar and name when signed in
- Add sign-out option

### 9. View All Button Behavior
**Issue:**
- Clicking "View All" in recent transactions just sums total transactions and money spent
- Should navigate to full transactions page

**Fix:**
- Make "View All" button navigate to transactions page
- Show all transactions grouped by date
- Display summary at top (total count and sum)

## Implementation Priority

### High Priority (Must Fix)
1. Privacy mode - only hide income/savings
2. Sign-in functionality
3. Transactions page redesign (simple date-grouped list)
4. Remove duplicate summary cards from home
5. Gauge size increase and remove negative signs

### Medium Priority (Should Fix)
6. Add transactions by date functionality
7. Firebase data integration
8. Detailed add form in Add section
9. View All button navigation

### Low Priority (Nice to Have)
10. Better variable spending name
11. Enhanced filters (later)

## Files to Modify

1. `glass-ui-prototype/script.js` - Main logic
2. `glass-ui-prototype/index.html` - Structure
3. `glass-ui-prototype/styles.css` - Styling
4. Firebase integration files (if not present, create them)

## Testing Checklist

- [ ] Privacy mode only hides income/savings
- [ ] Sign-in/sign-out works
- [ ] Transactions page shows date-grouped list
- [ ] Can add transactions with custom dates
- [ ] Gauge displays large numbers properly
- [ ] No duplicate cards on home page
- [ ] View All navigates correctly
- [ ] Firebase data loads on sign-in
- [ ] CSV export works
- [ ] All amounts display without negative signs (except where appropriate)
