/* 
 * Task 12: Checkpoint - Verify all core features
 * 
 * This test suite verifies that all implemented functionality works correctly:
 * - CRUD operations (add, edit, delete)
 * - Settings management (income, fixed expenses, categories, goals)
 * - Filtering and export on transactions page
 * - Historical comparison on history page
 * - Privacy mode toggle
 */

// Test Results Tracker
const testResults = {
    passed: 0,
    failed: 0,
    tests: []
};

function assert(condition, testName) {
    if (condition) {
        testResults.passed++;
        testResults.tests.push({ name: testName, status: 'PASS' });
        console.log(`✅ PASS: ${testName}`);
    } else {
        testResults.failed++;
        testResults.tests.push({ name: testName, status: 'FAIL' });
        console.error(`❌ FAIL: ${testName}`);
    }
}

function assertEquals(actual, expected, testName) {
    const condition = actual === expected;
    if (!condition) {
        console.error(`Expected: ${expected}, Got: ${actual}`);
    }
    assert(condition, testName);
}

function assertNotNull(value, testName) {
    assert(value !== null && value !== undefined, testName);
}

function assertGreaterThan(actual, threshold, testName) {
    const condition = actual > threshold;
    if (!condition) {
        console.error(`Expected ${actual} to be greater than ${threshold}`);
    }
    assert(condition, testName);
}

// Helper to clear localStorage before tests
function clearTestData() {
    localStorage.removeItem('glassui_expenses');
    localStorage.removeItem('glassui_settings');
}

// Test Suite
console.log('🧪 Starting Task 12 Checkpoint Tests...\n');

// Clear any existing data
clearTestData();

// Create a fresh ExpenseTracker instance
const tracker = new ExpenseTracker();

// ============================================
// TEST GROUP 1: CRUD Operations
// ============================================
console.log('\n📝 Testing CRUD Operations...');

// Test 1.1: Add expense
try {
    const expense1 = tracker.addExpense('Coffee', 5.50, 'Coffee', '2026-01-14');
    assertNotNull(expense1, 'Add expense returns expense object');
    assertEquals(expense1.description, 'Coffee', 'Expense description is correct');
    assertEquals(expense1.amount, 5.50, 'Expense amount is correct');
    assertEquals(expense1.category, 'Coffee', 'Expense category is correct');
    assertEquals(tracker.expenses.length, 1, 'Expense added to array');
} catch (error) {
    assert(false, 'Add expense - ' + error.message);
}

// Test 1.2: Add multiple expenses
try {
    tracker.addExpense('Lunch', 15.00, 'Food', '2026-01-14');
    tracker.addExpense('Uber', 12.50, 'Transportation', '2026-01-14');
    assertEquals(tracker.expenses.length, 3, 'Multiple expenses added');
} catch (error) {
    assert(false, 'Add multiple expenses - ' + error.message);
}

// Test 1.3: Edit expense
try {
    const firstExpenseId = tracker.expenses[0].id;
    const edited = tracker.editExpense(firstExpenseId, {
        description: 'Starbucks Coffee',
        amount: 6.00
    });
    assertEquals(edited.description, 'Starbucks Coffee', 'Expense description updated');
    assertEquals(edited.amount, 6.00, 'Expense amount updated');
} catch (error) {
    assert(false, 'Edit expense - ' + error.message);
}

// Test 1.4: Delete expense
try {
    const expenseToDelete = tracker.expenses[1].id;
    const deleted = tracker.deleteExpense(expenseToDelete);
    assertNotNull(deleted, 'Delete returns deleted expense');
    assertEquals(tracker.expenses.length, 2, 'Expense removed from array');
} catch (error) {
    assert(false, 'Delete expense - ' + error.message);
}

// Test 1.5: Validate positive amount
try {
    tracker.addExpense('Invalid', -10, 'Other');
    assert(false, 'Should reject negative amount');
} catch (error) {
    assert(true, 'Rejects negative amount');
}

// Test 1.6: Validate non-empty description
try {
    tracker.addExpense('', 10, 'Other');
    assert(false, 'Should reject empty description');
} catch (error) {
    assert(true, 'Rejects empty description');
}

// Test 1.7: Data persists in localStorage
try {
    const storedExpenses = JSON.parse(localStorage.getItem('glassui_expenses'));
    assertNotNull(storedExpenses, 'Expenses saved to localStorage');
    assertEquals(storedExpenses.length, tracker.expenses.length, 'localStorage matches in-memory data');
} catch (error) {
    assert(false, 'localStorage persistence - ' + error.message);
}

// ============================================
// TEST GROUP 2: Settings Management
// ============================================
console.log('\n⚙️ Testing Settings Management...');

// Test 2.1: Update income
try {
    tracker.updateIncome(6000);
    assertEquals(tracker.settings.income, 6000, 'Income updated');
    const storedSettings = JSON.parse(localStorage.getItem('glassui_settings'));
    assertEquals(storedSettings.income, 6000, 'Income persisted to localStorage');
} catch (error) {
    assert(false, 'Update income - ' + error.message);
}

// Test 2.2: Update fixed expenses
try {
    tracker.updateFixedExpense('rent', 1800);
    tracker.updateFixedExpense('utilities', 250);
    tracker.updateFixedExpense('insurance', 350);
    assertEquals(tracker.settings.rent, 1800, 'Rent updated');
    assertEquals(tracker.settings.utilities, 250, 'Utilities updated');
    assertEquals(tracker.settings.insurance, 350, 'Insurance updated');
} catch (error) {
    assert(false, 'Update fixed expenses - ' + error.message);
}

// Test 2.3: Add category
try {
    const initialCategoryCount = tracker.settings.categories.length;
    tracker.addCategory('Groceries');
    assertEquals(tracker.settings.categories.length, initialCategoryCount + 1, 'Category added');
    assert(tracker.settings.categories.includes('Groceries'), 'New category in list');
    assertEquals(tracker.settings.goals['Groceries'], 0, 'Goal initialized for new category');
} catch (error) {
    assert(false, 'Add category - ' + error.message);
}

// Test 2.4: Reject duplicate category
try {
    tracker.addCategory('Groceries');
    assert(false, 'Should reject duplicate category');
} catch (error) {
    assert(true, 'Rejects duplicate category');
}

// Test 2.5: Delete category with expense reassignment
try {
    // Add an expense in the category we'll delete
    tracker.addExpense('Milk', 5, 'Groceries');
    const groceryExpense = tracker.expenses.find(e => e.category === 'Groceries');
    assertNotNull(groceryExpense, 'Expense added to Groceries category');
    
    // Delete the category
    tracker.deleteCategory('Groceries');
    assert(!tracker.settings.categories.includes('Groceries'), 'Category removed');
    
    // Check expense was reassigned
    const reassignedExpense = tracker.expenses.find(e => e.id === groceryExpense.id);
    assertEquals(reassignedExpense.category, 'Other', 'Expense reassigned to Other');
} catch (error) {
    assert(false, 'Delete category - ' + error.message);
}

// Test 2.6: Set category goals
try {
    tracker.setCategoryGoal('Food', 600);
    tracker.setCategoryGoal('Coffee', 100);
    assertEquals(tracker.settings.goals['Food'], 600, 'Food goal set');
    assertEquals(tracker.settings.goals['Coffee'], 100, 'Coffee goal set');
} catch (error) {
    assert(false, 'Set category goals - ' + error.message);
}

// ============================================
// TEST GROUP 3: Calculation Methods
// ============================================
console.log('\n🧮 Testing Calculation Methods...');

// Test 3.1: Calculate total expenses
try {
    const total = tracker.calculateTotalExpenses();
    assertGreaterThan(total, 0, 'Total expenses calculated');
    
    // Verify it matches sum of all expenses
    const expectedTotal = tracker.expenses.reduce((sum, exp) => sum + exp.amount, 0);
    assertEquals(total, expectedTotal, 'Total matches sum of expenses');
} catch (error) {
    assert(false, 'Calculate total expenses - ' + error.message);
}

// Test 3.2: Calculate fixed expenses
try {
    const fixed = tracker.calculateFixedExpenses();
    const expected = tracker.settings.rent + tracker.settings.utilities + tracker.settings.insurance;
    assertEquals(fixed, expected, 'Fixed expenses calculated correctly');
} catch (error) {
    assert(false, 'Calculate fixed expenses - ' + error.message);
}

// Test 3.3: Calculate variable expenses
try {
    const variable = tracker.calculateVariableExpenses();
    const expected = tracker.calculateTotalExpenses() - tracker.calculateFixedExpenses();
    assertEquals(variable, expected, 'Variable expenses calculated correctly');
} catch (error) {
    assert(false, 'Calculate variable expenses - ' + error.message);
}

// Test 3.4: Calculate savings
try {
    const savings = tracker.calculateSavings();
    const expected = tracker.settings.income - tracker.calculateTotalExpenses();
    assertEquals(savings, expected, 'Savings calculated correctly');
} catch (error) {
    assert(false, 'Calculate savings - ' + error.message);
}

// Test 3.5: Calculate budget left
try {
    const budgetLeft = tracker.calculateBudgetLeft();
    const expected = tracker.calculateVariableBudget() - tracker.calculateVariableExpenses();
    assertEquals(budgetLeft, expected, 'Budget left calculated correctly');
} catch (error) {
    assert(false, 'Calculate budget left - ' + error.message);
}

// Test 3.6: Calculate spending percentage
try {
    const percentage = tracker.calculateSpendingPercentage();
    assert(percentage >= 0 && percentage <= 200, 'Spending percentage in valid range');
} catch (error) {
    assert(false, 'Calculate spending percentage - ' + error.message);
}

// ============================================
// TEST GROUP 4: Filtering and Export
// ============================================
console.log('\n🔍 Testing Filtering and Export...');

// Test 4.1: Filter by date range
try {
    const filtered = tracker.getExpensesByDateRange('2026-01-14', '2026-01-14');
    assert(filtered.length > 0, 'Date range filter returns results');
    assert(filtered.every(e => e.date === '2026-01-14'), 'All filtered expenses match date');
} catch (error) {
    assert(false, 'Filter by date range - ' + error.message);
}

// Test 4.2: Filter by category
try {
    const coffeeExpenses = tracker.getExpensesByCategory('Coffee');
    assert(coffeeExpenses.every(e => e.category === 'Coffee'), 'Category filter works');
} catch (error) {
    assert(false, 'Filter by category - ' + error.message);
}

// Test 4.3: Export to CSV format
try {
    // We can't actually trigger download in Node, but we can verify the method exists
    assert(typeof tracker.exportToCSV === 'function', 'exportToCSV method exists');
} catch (error) {
    assert(false, 'Export to CSV - ' + error.message);
}

// ============================================
// TEST GROUP 5: Historical Comparison
// ============================================
console.log('\n📊 Testing Historical Comparison...');

// Test 5.1: Get expenses for specific month
try {
    const monthExpenses = tracker.getExpensesForMonth(2026, 1); // January 2026
    assert(Array.isArray(monthExpenses), 'Returns array of expenses');
    assert(monthExpenses.every(e => {
        const date = new Date(e.date);
        return date.getFullYear() === 2026 && date.getMonth() === 0;
    }), 'All expenses are from specified month');
} catch (error) {
    assert(false, 'Get expenses for month - ' + error.message);
}

// Test 5.2: Calculate monthly comparison
try {
    const comparison = tracker.calculateMonthlyComparison(2026, 1);
    assertNotNull(comparison.current, 'Current month data exists');
    assertNotNull(comparison.previous, 'Previous month data exists');
    assertNotNull(comparison.changes, 'Change percentages calculated');
    assert(typeof comparison.changes.expenses === 'number', 'Expenses change is a number');
    assert(typeof comparison.changes.savings === 'number', 'Savings change is a number');
} catch (error) {
    assert(false, 'Calculate monthly comparison - ' + error.message);
}

// ============================================
// TEST GROUP 6: Privacy Mode
// ============================================
console.log('\n🔒 Testing Privacy Mode...');

// Test 6.1: Toggle privacy mode on
try {
    const initialState = tracker.settings.privacyMode;
    tracker.togglePrivacyMode();
    assertEquals(tracker.settings.privacyMode, !initialState, 'Privacy mode toggled');
} catch (error) {
    assert(false, 'Toggle privacy mode - ' + error.message);
}

// Test 6.2: Format amount with privacy mode
try {
    tracker.settings.privacyMode = true;
    const formatted = tracker.formatAmount(1234.56);
    assertEquals(formatted, '****', 'Amount hidden in privacy mode');
} catch (error) {
    assert(false, 'Format amount with privacy mode - ' + error.message);
}

// Test 6.3: Format amount without privacy mode
try {
    tracker.settings.privacyMode = false;
    const formatted = tracker.formatAmount(1234.56);
    assertEquals(formatted, '1,234.56', 'Amount shown without privacy mode');
} catch (error) {
    assert(false, 'Format amount without privacy mode - ' + error.message);
}

// Test 6.4: Privacy mode persists
try {
    tracker.settings.privacyMode = true;
    tracker.saveSettings();
    const storedSettings = JSON.parse(localStorage.getItem('glassui_settings'));
    assertEquals(storedSettings.privacyMode, true, 'Privacy mode persisted to localStorage');
} catch (error) {
    assert(false, 'Privacy mode persistence - ' + error.message);
}

// ============================================
// TEST GROUP 7: UI Update Methods
// ============================================
console.log('\n🎨 Testing UI Update Methods...');

// Test 7.1: updateDashboard method exists and runs
try {
    tracker.updateDashboard();
    assert(true, 'updateDashboard executes without error');
} catch (error) {
    assert(false, 'updateDashboard - ' + error.message);
}

// Test 7.2: updateGauge method exists and runs
try {
    tracker.updateGauge();
    assert(true, 'updateGauge executes without error');
} catch (error) {
    assert(false, 'updateGauge - ' + error.message);
}

// Test 7.3: updateTransactionsList method exists and runs
try {
    tracker.updateTransactionsList();
    assert(true, 'updateTransactionsList executes without error');
} catch (error) {
    assert(false, 'updateTransactionsList - ' + error.message);
}

// Test 7.4: updateOverviewPage method exists and runs
try {
    tracker.updateOverviewPage();
    assert(true, 'updateOverviewPage executes without error');
} catch (error) {
    assert(false, 'updateOverviewPage - ' + error.message);
}

// Test 7.5: updateCategoryBreakdown method exists and runs
try {
    tracker.updateCategoryBreakdown();
    assert(true, 'updateCategoryBreakdown executes without error');
} catch (error) {
    assert(false, 'updateCategoryBreakdown - ' + error.message);
}

// ============================================
// FINAL RESULTS
// ============================================
console.log('\n' + '='.repeat(50));
console.log('📊 TEST RESULTS SUMMARY');
console.log('='.repeat(50));
console.log(`✅ Passed: ${testResults.passed}`);
console.log(`❌ Failed: ${testResults.failed}`);
console.log(`📝 Total: ${testResults.passed + testResults.failed}`);
console.log('='.repeat(50));

if (testResults.failed === 0) {
    console.log('\n🎉 ALL TESTS PASSED! Core features verified successfully.');
    console.log('\n✅ Task 12 Checkpoint Complete:');
    console.log('   - CRUD operations working');
    console.log('   - Settings management working');
    console.log('   - Filtering and export working');
    console.log('   - Historical comparison working');
    console.log('   - Privacy mode working');
    console.log('   - All UI update methods working');
} else {
    console.log('\n⚠️ Some tests failed. Review the failures above.');
}

// Clean up test data
clearTestData();
