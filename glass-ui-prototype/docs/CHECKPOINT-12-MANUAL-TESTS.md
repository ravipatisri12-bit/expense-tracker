# Task 12: Checkpoint - Manual Verification Guide

## Overview
This document provides a comprehensive manual testing checklist to verify all core features of the Glass UI Expense Tracker.

## How to Test
1. Open `glass-ui-prototype/index.html` in a web browser
2. Open browser DevTools Console (F12 or Cmd+Option+I)
3. Follow each test section below
4. Check off each item as you verify it works

---

## ✅ Test Group 1: CRUD Operations

### 1.1 Add Expense
- [ ] Click the "+" quick add button
- [ ] Enter description: "Coffee"
- [ ] Enter amount: 5.50
- [ ] Select category: "Coffee"
- [ ] Click "Add Expense"
- [ ] **Verify:** Expense appears in recent transactions list
- [ ] **Verify:** Dashboard totals update

### 1.2 Add Multiple Expenses
- [ ] Add expense: "Lunch", $15.00, "Food"
- [ ] Add expense: "Uber", $12.50, "Transportation"
- [ ] **Verify:** All expenses appear in transactions list
- [ ] **Verify:** Total expenses increases correctly

### 1.3 Edit Expense
- [ ] Click the edit button (✏️) on the first expense
- [ ] Change description to "Starbucks Coffee"
- [ ] Change amount to $6.00
- [ ] Click "Save"
- [ ] **Verify:** Expense updates in the list
- [ ] **Verify:** Dashboard totals recalculate

### 1.4 Delete Expense
- [ ] Click the delete button (🗑️) on any expense
- [ ] Confirm deletion in the dialog
- [ ] **Verify:** Expense is removed from list
- [ ] **Verify:** Dashboard totals recalculate

### 1.5 Validation - Negative Amount
- [ ] Try to add expense with negative amount
- [ ] **Verify:** Error message appears
- [ ] **Verify:** Expense is not added

### 1.6 Validation - Empty Description
- [ ] Try to add expense with empty description
- [ ] **Verify:** Error message appears
- [ ] **Verify:** Expense is not added

### 1.7 Data Persistence
- [ ] Add several expenses
- [ ] Close the browser tab
- [ ] Reopen `index.html`
- [ ] **Verify:** All expenses are still there
- [ ] **Verify:** Dashboard shows correct totals

---

## ⚙️ Test Group 2: Settings Management

### 2.1 Update Income
- [ ] Navigate to Settings page
- [ ] Change income to $6000
- [ ] **Verify:** Success toast appears
- [ ] **Verify:** Dashboard updates with new income
- [ ] **Verify:** Budget calculations update

### 2.2 Update Fixed Expenses
- [ ] Change rent to $1800
- [ ] Change utilities to $250
- [ ] Change insurance to $350
- [ ] **Verify:** Success toasts appear
- [ ] **Verify:** Dashboard recalculates budget left

### 2.3 Add Category
- [ ] Scroll to "Manage Categories" section
- [ ] Type "Groceries" in the input
- [ ] Press Enter
- [ ] **Verify:** "Groceries" appears in categories list
- [ ] **Verify:** Category appears in dropdown when adding expense
- [ ] **Verify:** Goal input appears for new category

### 2.4 Reject Duplicate Category
- [ ] Try to add "Groceries" again
- [ ] **Verify:** Error message appears
- [ ] **Verify:** Duplicate is not added

### 2.5 Delete Category
- [ ] Add an expense in "Groceries" category
- [ ] Delete the "Groceries" category
- [ ] Confirm deletion
- [ ] **Verify:** Category is removed from list
- [ ] **Verify:** Expense is reassigned to "Other"
- [ ] **Verify:** Category dropdown updates

### 2.6 Set Category Goals
- [ ] Set Food goal to $600
- [ ] Set Coffee goal to $100
- [ ] **Verify:** Success toasts appear
- [ ] Navigate to Overview page
- [ ] **Verify:** Category breakdown shows goals
- [ ] **Verify:** Progress bars reflect spending vs goals

---

## 🧮 Test Group 3: Calculation Methods

### 3.1 Total Expenses
- [ ] Add expenses: $10, $20, $30
- [ ] **Verify:** Dashboard shows total: $60
- [ ] **Verify:** Total matches sum of all expenses

### 3.2 Fixed vs Variable Expenses
- [ ] Set fixed expenses: Rent $1500, Utilities $200, Insurance $300
- [ ] Add variable expenses: $100, $200
- [ ] **Verify:** Fixed expenses = $2000
- [ ] **Verify:** Variable expenses = $300
- [ ] **Verify:** Total expenses = $2300

### 3.3 Savings Calculation
- [ ] Set income to $5000
- [ ] With total expenses of $2300
- [ ] **Verify:** Savings = $2700 ($5000 - $2300)

### 3.4 Budget Left
- [ ] Income: $5000
- [ ] Fixed: $2000
- [ ] Variable: $300
- [ ] **Verify:** Variable budget = $3000 ($5000 - $2000)
- [ ] **Verify:** Budget left = $2700 ($3000 - $300)

### 3.5 Spending Percentage
- [ ] Variable expenses: $300
- [ ] Variable budget: $3000
- [ ] **Verify:** Gauge shows 10% ($300 / $3000)
- [ ] **Verify:** Status indicator is green ("On track")

### 3.6 Daily and Weekly Averages
- [ ] Navigate to Overview page
- [ ] **Verify:** Daily average is calculated
- [ ] **Verify:** Weekly spending shows current week total

---

## 🔍 Test Group 4: Filtering and Export

### 4.1 Filter by Date Range
- [ ] Navigate to Transactions page
- [ ] Set start date to today
- [ ] Set end date to today
- [ ] **Verify:** Only today's expenses show
- [ ] **Verify:** Transaction count updates

### 4.2 Filter by Category
- [ ] Select "Coffee" from category filter
- [ ] **Verify:** Only coffee expenses show
- [ ] **Verify:** Total amount updates

### 4.3 Combined Filters
- [ ] Set date range AND category filter
- [ ] **Verify:** Results match both criteria
- [ ] Clear filters
- [ ] **Verify:** All expenses show again

### 4.4 Export to CSV
- [ ] Click "Export CSV" button
- [ ] **Verify:** CSV file downloads
- [ ] Open CSV file
- [ ] **Verify:** Headers: Date, Description, Category, Amount
- [ ] **Verify:** All filtered expenses are included
- [ ] **Verify:** Data is properly formatted

---

## 📊 Test Group 5: Historical Comparison

### 5.1 View Current Month
- [ ] Navigate to History page
- [ ] **Verify:** Current month is selected by default
- [ ] **Verify:** Income, expenses, savings display
- [ ] **Verify:** Category breakdown shows

### 5.2 View Previous Month
- [ ] Select previous month from dropdown
- [ ] **Verify:** Data updates for selected month
- [ ] **Verify:** Comparison with previous month shows
- [ ] **Verify:** Percentage changes display

### 5.3 Month with No Data
- [ ] Select a future month
- [ ] **Verify:** "No expenses recorded" message shows
- [ ] **Verify:** No errors occur

### 5.4 Category Breakdown by Month
- [ ] Select current month
- [ ] **Verify:** Categories show with amounts
- [ ] **Verify:** Percentages add up to 100%
- [ ] **Verify:** Categories sorted by amount (highest first)

---

## 🔒 Test Group 6: Privacy Mode

### 6.1 Enable Privacy Mode
- [ ] Navigate to Settings page
- [ ] Toggle privacy mode ON
- [ ] **Verify:** Success toast appears
- [ ] Navigate to Home page
- [ ] **Verify:** All amounts show as "****"
- [ ] **Verify:** Gauge still works (shows percentage)

### 6.2 Disable Privacy Mode
- [ ] Toggle privacy mode OFF
- [ ] **Verify:** All amounts show actual values
- [ ] **Verify:** Amounts are properly formatted with $ and commas

### 6.3 Privacy Mode Persistence
- [ ] Enable privacy mode
- [ ] Close browser tab
- [ ] Reopen `index.html`
- [ ] **Verify:** Privacy mode is still enabled
- [ ] **Verify:** Amounts are hidden

### 6.4 Privacy Mode Across Pages
- [ ] Enable privacy mode
- [ ] Navigate to Overview page
- [ ] **Verify:** Amounts hidden
- [ ] Navigate to Transactions page
- [ ] **Verify:** Amounts hidden
- [ ] Navigate to History page
- [ ] **Verify:** Amounts hidden

---

## 🎨 Test Group 7: UI Updates

### 7.1 Dashboard Updates
- [ ] Add an expense
- [ ] **Verify:** Total expenses updates
- [ ] **Verify:** Savings updates
- [ ] **Verify:** Budget left updates
- [ ] **Verify:** Gauge animates to new percentage
- [ ] **Verify:** Recent transactions list updates

### 7.2 Gauge Color Changes
- [ ] Spend < 70% of budget
- [ ] **Verify:** Gauge is blue/green, status "On track"
- [ ] Spend 70-90% of budget
- [ ] **Verify:** Gauge is orange, status "Approaching limit"
- [ ] Spend > 90% of budget
- [ ] **Verify:** Gauge is red, status "Over budget"

### 7.3 Overview Page Updates
- [ ] Navigate to Overview page
- [ ] Add an expense
- [ ] **Verify:** Mini cards update
- [ ] **Verify:** Category breakdown updates
- [ ] **Verify:** Daily/weekly averages update

### 7.4 Transactions List Updates
- [ ] Add an expense
- [ ] **Verify:** Appears at top of list (newest first)
- [ ] **Verify:** Shows correct emoji for category
- [ ] **Verify:** Shows relative time ("Just now", "2 hours ago")
- [ ] **Verify:** Edit and delete buttons appear

### 7.5 Animations
- [ ] Refresh the page
- [ ] **Verify:** Numbers count up smoothly
- [ ] **Verify:** Gauge arc animates
- [ ] **Verify:** Transaction items fade in with stagger
- [ ] **Verify:** Category progress bars animate

---

## 🎯 Final Verification

### All Features Working Together
- [ ] Add 10+ expenses across different categories
- [ ] Set income and fixed expenses
- [ ] Set category goals
- [ ] Enable privacy mode
- [ ] Navigate through all pages
- [ ] Filter transactions
- [ ] Export CSV
- [ ] View history
- [ ] Edit and delete expenses
- [ ] Close and reopen browser
- [ ] **Verify:** Everything persists and works correctly

### Performance
- [ ] **Verify:** Page loads quickly
- [ ] **Verify:** Animations are smooth
- [ ] **Verify:** No console errors
- [ ] **Verify:** No visual glitches

### Responsive Design
- [ ] Resize browser window to mobile size (375px)
- [ ] **Verify:** Layout adapts properly
- [ ] **Verify:** All buttons are tappable
- [ ] **Verify:** No horizontal scroll

---

## ✅ Checkpoint Complete

If all tests pass, Task 12 is complete! All core features are working:
- ✅ CRUD operations (add, edit, delete)
- ✅ Settings management (income, fixed expenses, categories, goals)
- ✅ Filtering and export on transactions page
- ✅ Historical comparison on history page
- ✅ Privacy mode toggle
- ✅ Data persistence
- ✅ UI updates and animations

## Next Steps

After completing this checkpoint, you can proceed to:
- Task 13: Create utility functions file
- Task 14: Add form validation and error handling
- Task 15: Implement animations and transitions
- Task 16: Final testing and polish
- Task 17: Optional Firebase authentication

---

## Automated Test

For automated testing, open `test-checkpoint-12.html` in a browser and click "Run Tests".
This will execute all tests programmatically and show results in the console.
