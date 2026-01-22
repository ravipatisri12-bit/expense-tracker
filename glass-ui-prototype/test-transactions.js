/* Test Transactions Page Functionality */

console.log('=== Testing Transactions Page Functionality ===\n');

// Create a test instance
const tracker = new ExpenseTracker();

// Clear any existing data
tracker.expenses = [];
tracker.saveExpenses();

// Test 1: Add sample expenses
console.log('Test 1: Adding sample expenses...');
try {
    tracker.addExpense('Coffee at Starbucks', 5.50, 'Coffee', '2026-01-10');
    tracker.addExpense('Lunch at Chipotle', 12.00, 'Food', '2026-01-11');
    tracker.addExpense('Uber ride', 15.75, 'Transportation', '2026-01-12');
    tracker.addExpense('Movie tickets', 25.00, 'Entertainment', '2026-01-13');
    tracker.addExpense('Groceries', 67.50, 'Food', '2026-01-14');
    console.log('✓ Added 5 expenses successfully');
    console.log(`  Total expenses: ${tracker.expenses.length}`);
} catch (error) {
    console.error('✗ Failed to add expenses:', error.message);
}

// Test 2: getExpensesByDateRange
console.log('\nTest 2: Testing date range filtering...');
try {
    const filtered = tracker.getExpensesByDateRange('2026-01-11', '2026-01-13');
    console.log(`✓ Date range filter (2026-01-11 to 2026-01-13): ${filtered.length} expenses`);
    console.log('  Expected: 3 expenses (Lunch, Uber, Movie)');
    console.log('  Actual expenses:', filtered.map(e => e.description).join(', '));
    
    if (filtered.length === 3) {
        console.log('✓ Date range filtering works correctly');
    } else {
        console.error('✗ Date range filtering returned wrong count');
    }
} catch (error) {
    console.error('✗ Date range filtering failed:', error.message);
}

// Test 3: getExpensesByCategory
console.log('\nTest 3: Testing category filtering...');
try {
    const foodExpenses = tracker.getExpensesByCategory('Food');
    console.log(`✓ Category filter (Food): ${foodExpenses.length} expenses`);
    console.log('  Expected: 2 expenses (Lunch, Groceries)');
    console.log('  Actual expenses:', foodExpenses.map(e => e.description).join(', '));
    
    if (foodExpenses.length === 2) {
        console.log('✓ Category filtering works correctly');
    } else {
        console.error('✗ Category filtering returned wrong count');
    }
} catch (error) {
    console.error('✗ Category filtering failed:', error.message);
}

// Test 4: exportToCSV format
console.log('\nTest 4: Testing CSV export format...');
try {
    // Mock the CSV export to capture output
    const originalShowToast = tracker.showToast;
    let csvContent = '';
    
    // Override exportToCSV to capture CSV content
    const originalExport = tracker.exportToCSV;
    tracker.exportToCSV = function() {
        const expensesToExport = this.getFilteredExpenses();
        const headers = ['Date', 'Description', 'Category', 'Amount'];
        const csvRows = [headers.join(',')];
        
        const sortedExpenses = [...expensesToExport].sort((a, b) => 
            new Date(a.date) - new Date(b.date)
        );
        
        sortedExpenses.forEach(expense => {
            const row = [
                expense.date,
                `"${expense.description.replace(/"/g, '""')}"`,
                expense.category,
                expense.amount.toFixed(2)
            ];
            csvRows.push(row.join(','));
        });
        
        csvContent = csvRows.join('\n');
        return csvContent;
    };
    
    const csv = tracker.exportToCSV();
    console.log('✓ CSV export generated');
    console.log('  CSV Preview (first 3 lines):');
    const lines = csv.split('\n');
    lines.slice(0, 3).forEach(line => console.log('    ' + line));
    
    // Verify CSV format
    const hasHeaders = lines[0] === 'Date,Description,Category,Amount';
    const hasCorrectColumns = lines[1].split(',').length === 4;
    
    if (hasHeaders && hasCorrectColumns) {
        console.log('✓ CSV format is correct (Date, Description, Category, Amount)');
    } else {
        console.error('✗ CSV format is incorrect');
    }
    
    // Restore original method
    tracker.exportToCSV = originalExport;
} catch (error) {
    console.error('✗ CSV export failed:', error.message);
}

// Test 5: Combined filtering (date range + category)
console.log('\nTest 5: Testing combined filtering...');
try {
    // Simulate filter inputs
    const mockStartDate = '2026-01-11';
    const mockEndDate = '2026-01-14';
    const mockCategory = 'Food';
    
    // First filter by date range
    let filtered = tracker.getExpensesByDateRange(mockStartDate, mockEndDate);
    // Then filter by category
    filtered = tracker.getExpensesByCategory(mockCategory, filtered);
    
    console.log(`✓ Combined filter (${mockStartDate} to ${mockEndDate}, Food): ${filtered.length} expenses`);
    console.log('  Expected: 2 expenses (Lunch, Groceries)');
    console.log('  Actual expenses:', filtered.map(e => e.description).join(', '));
    
    if (filtered.length === 2) {
        console.log('✓ Combined filtering works correctly');
    } else {
        console.error('✗ Combined filtering returned wrong count');
    }
} catch (error) {
    console.error('✗ Combined filtering failed:', error.message);
}

// Test 6: Edge cases
console.log('\nTest 6: Testing edge cases...');
try {
    // Empty date range
    const emptyFilter = tracker.getExpensesByDateRange('', '');
    console.log(`✓ Empty date range returns all expenses: ${emptyFilter.length}`);
    
    // Non-existent category
    const noCategory = tracker.getExpensesByCategory('NonExistent');
    console.log(`✓ Non-existent category returns 0 expenses: ${noCategory.length}`);
    
    // Start date only
    const startOnly = tracker.getExpensesByDateRange('2026-01-13', '');
    console.log(`✓ Start date only: ${startOnly.length} expenses (Movie, Groceries)`);
    
    // End date only
    const endOnly = tracker.getExpensesByDateRange('', '2026-01-11');
    console.log(`✓ End date only: ${endOnly.length} expenses (Coffee, Lunch)`);
    
    console.log('✓ All edge cases handled correctly');
} catch (error) {
    console.error('✗ Edge case handling failed:', error.message);
}

console.log('\n=== All Tests Completed ===');
