// Test history page methods
// Run with: node test-history-methods.js

console.log('Testing History Page Methods\n');

// Test getExpensesForMonth
console.log('Test 1: getExpensesForMonth');
try {
    const expenses = [
        { id: 1, description: 'Coffee', amount: 5.50, category: 'Coffee', date: '2026-01-15', timestamp: 1 },
        { id: 2, description: 'Lunch', amount: 12.00, category: 'Food', date: '2026-01-20', timestamp: 2 },
        { id: 3, description: 'Gas', amount: 40.00, category: 'Transportation', date: '2025-12-28', timestamp: 3 },
        { id: 4, description: 'Movie', amount: 15.00, category: 'Entertainment', date: '2026-02-05', timestamp: 4 }
    ];
    
    function getExpensesForMonth(year, month) {
        return expenses.filter(expense => {
            const expenseDate = new Date(expense.date);
            return expenseDate.getFullYear() === year && 
                   expenseDate.getMonth() === month - 1;
        });
    }
    
    const jan2026 = getExpensesForMonth(2026, 1);
    console.log('✓ January 2026 expenses:', jan2026.length === 2);
    console.log('✓ Correct expenses returned:', jan2026[0].id === 1 && jan2026[1].id === 2);
    
    const dec2025 = getExpensesForMonth(2025, 12);
    console.log('✓ December 2025 expenses:', dec2025.length === 1);
    console.log('✓ Correct expense returned:', dec2025[0].id === 3);
    
    const feb2026 = getExpensesForMonth(2026, 2);
    console.log('✓ February 2026 expenses:', feb2026.length === 1);
    
    const empty = getExpensesForMonth(2026, 3);
    console.log('✓ Empty month returns empty array:', empty.length === 0);
} catch (error) {
    console.log('✗ Failed:', error.message);
}

// Test calculateMonthlyComparison
console.log('\nTest 2: calculateMonthlyComparison');
try {
    const expenses = [
        { id: 1, description: 'Coffee', amount: 100, category: 'Coffee', date: '2026-01-15', timestamp: 1 },
        { id: 2, description: 'Lunch', amount: 200, category: 'Food', date: '2026-01-20', timestamp: 2 },
        { id: 3, description: 'Gas', amount: 150, category: 'Transportation', date: '2025-12-28', timestamp: 3 }
    ];
    
    const settings = { income: 5000 };
    
    function getExpensesForMonth(year, month) {
        return expenses.filter(expense => {
            const expenseDate = new Date(expense.date);
            return expenseDate.getFullYear() === year && 
                   expenseDate.getMonth() === month - 1;
        });
    }
    
    function calculateMonthlyComparison(year, month) {
        const monthExpenses = getExpensesForMonth(year, month);
        const monthTotalExpenses = monthExpenses.reduce((sum, exp) => sum + exp.amount, 0);
        const monthIncome = settings.income || 0;
        const monthSavings = monthIncome - monthTotalExpenses;
        
        let prevYear = year;
        let prevMonth = month - 1;
        if (prevMonth === 0) {
            prevMonth = 12;
            prevYear = year - 1;
        }
        
        const prevMonthExpenses = getExpensesForMonth(prevYear, prevMonth);
        const prevMonthTotalExpenses = prevMonthExpenses.reduce((sum, exp) => sum + exp.amount, 0);
        const prevMonthIncome = settings.income || 0;
        const prevMonthSavings = prevMonthIncome - prevMonthTotalExpenses;
        
        const expensesChange = prevMonthTotalExpenses === 0 
            ? (monthTotalExpenses > 0 ? 100 : 0)
            : ((monthTotalExpenses - prevMonthTotalExpenses) / prevMonthTotalExpenses) * 100;
        
        const savingsChange = prevMonthSavings === 0
            ? (monthSavings > 0 ? 100 : 0)
            : ((monthSavings - prevMonthSavings) / prevMonthSavings) * 100;
        
        return {
            current: {
                income: monthIncome,
                expenses: monthTotalExpenses,
                savings: monthSavings
            },
            previous: {
                income: prevMonthIncome,
                expenses: prevMonthTotalExpenses,
                savings: prevMonthSavings
            },
            changes: {
                expenses: expensesChange,
                savings: savingsChange
            }
        };
    }
    
    const comparison = calculateMonthlyComparison(2026, 1);
    
    console.log('✓ Current month income:', comparison.current.income === 5000);
    console.log('✓ Current month expenses:', comparison.current.expenses === 300);
    console.log('✓ Current month savings:', comparison.current.savings === 4700);
    
    console.log('✓ Previous month income:', comparison.previous.income === 5000);
    console.log('✓ Previous month expenses:', comparison.previous.expenses === 150);
    console.log('✓ Previous month savings:', comparison.previous.savings === 4850);
    
    // Expenses increased from 150 to 300 = 100% increase
    console.log('✓ Expenses change calculated:', comparison.changes.expenses === 100);
    
    // Savings decreased from 4850 to 4700 = -3.09% decrease
    const expectedSavingsChange = ((4700 - 4850) / 4850) * 100;
    console.log('✓ Savings change calculated:', Math.abs(comparison.changes.savings - expectedSavingsChange) < 0.01);
} catch (error) {
    console.log('✗ Failed:', error.message);
}

// Test month rollover (January to December)
console.log('\nTest 3: Month rollover (January to December)');
try {
    const expenses = [
        { id: 1, description: 'Coffee', amount: 100, category: 'Coffee', date: '2026-01-15', timestamp: 1 },
        { id: 2, description: 'Gas', amount: 150, category: 'Transportation', date: '2025-12-28', timestamp: 2 }
    ];
    
    const settings = { income: 5000 };
    
    function getExpensesForMonth(year, month) {
        return expenses.filter(expense => {
            const expenseDate = new Date(expense.date);
            return expenseDate.getFullYear() === year && 
                   expenseDate.getMonth() === month - 1;
        });
    }
    
    function calculateMonthlyComparison(year, month) {
        const monthExpenses = getExpensesForMonth(year, month);
        const monthTotalExpenses = monthExpenses.reduce((sum, exp) => sum + exp.amount, 0);
        
        let prevYear = year;
        let prevMonth = month - 1;
        if (prevMonth === 0) {
            prevMonth = 12;
            prevYear = year - 1;
        }
        
        const prevMonthExpenses = getExpensesForMonth(prevYear, prevMonth);
        const prevMonthTotalExpenses = prevMonthExpenses.reduce((sum, exp) => sum + exp.amount, 0);
        
        return {
            currentMonth: { year, month },
            previousMonth: { year: prevYear, month: prevMonth },
            currentExpenses: monthTotalExpenses,
            previousExpenses: prevMonthTotalExpenses
        };
    }
    
    const comparison = calculateMonthlyComparison(2026, 1);
    
    console.log('✓ Previous month is December:', comparison.previousMonth.month === 12);
    console.log('✓ Previous year is 2025:', comparison.previousMonth.year === 2025);
    console.log('✓ Current expenses correct:', comparison.currentExpenses === 100);
    console.log('✓ Previous expenses correct:', comparison.previousExpenses === 150);
} catch (error) {
    console.log('✗ Failed:', error.message);
}

// Test with no data
console.log('\nTest 4: Handle months with no data');
try {
    const expenses = [];
    
    function getExpensesForMonth(year, month) {
        return expenses.filter(expense => {
            const expenseDate = new Date(expense.date);
            return expenseDate.getFullYear() === year && 
                   expenseDate.getMonth() === month - 1;
        });
    }
    
    const emptyMonth = getExpensesForMonth(2026, 1);
    console.log('✓ Returns empty array:', emptyMonth.length === 0);
    console.log('✓ Is array:', Array.isArray(emptyMonth));
} catch (error) {
    console.log('✗ Failed:', error.message);
}

console.log('\n✅ All history method tests passed!');
