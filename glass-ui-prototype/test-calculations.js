// Simple test to verify calculation methods
// Run this in browser console or Node.js

// Mock ExpenseTracker for testing
class TestExpenseTracker {
    constructor() {
        this.expenses = [];
        this.settings = {
            income: 5000,
            rent: 1500,
            utilities: 200,
            insurance: 300
        };
    }

    // Add test expenses
    addTestExpenses() {
        this.expenses = [
            { id: 1, amount: 50, date: '2026-01-13', category: 'Food' },
            { id: 2, amount: 100, date: '2026-01-13', category: 'Transportation' },
            { id: 3, amount: 75, date: '2026-01-12', category: 'Coffee' },
            { id: 4, amount: 200, date: '2026-01-11', category: 'Shopping' },
            { id: 5, amount: 1500, date: '2026-01-10', category: 'Bills' }, // Rent
            { id: 6, amount: 200, date: '2026-01-10', category: 'Bills' }, // Utilities
            { id: 7, amount: 300, date: '2026-01-10', category: 'Bills' }, // Insurance
            { id: 8, amount: 150, date: '2026-01-09', category: 'Entertainment' }
        ];
    }

    // Calculation Methods (copied from main implementation)
    calculateTotalExpenses() {
        return this.expenses.reduce((total, expense) => total + expense.amount, 0);
    }
    
    calculateFixedExpenses() {
        const { rent = 0, utilities = 0, insurance = 0 } = this.settings;
        return rent + utilities + insurance;
    }
    
    calculateVariableExpenses() {
        const totalExpenses = this.calculateTotalExpenses();
        const fixedExpenses = this.calculateFixedExpenses();
        return totalExpenses - fixedExpenses;
    }
    
    calculateVariableBudget() {
        const income = this.settings.income || 0;
        const fixedExpenses = this.calculateFixedExpenses();
        return income - fixedExpenses;
    }
    
    calculateSavings() {
        const income = this.settings.income || 0;
        const totalExpenses = this.calculateTotalExpenses();
        return income - totalExpenses;
    }
    
    calculateBudgetLeft() {
        const variableBudget = this.calculateVariableBudget();
        const variableExpenses = this.calculateVariableExpenses();
        return variableBudget - variableExpenses;
    }
    
    calculateSpendingPercentage() {
        const variableExpenses = this.calculateVariableExpenses();
        const variableBudget = this.calculateVariableBudget();
        
        if (variableBudget === 0) return 0;
        
        return Math.round((variableExpenses / variableBudget) * 100);
    }
    
    calculateDailyAverage() {
        const variableExpenses = this.calculateVariableExpenses();
        const now = new Date();
        const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
        
        return variableExpenses / daysInMonth;
    }
    
    calculateWeeklySpending() {
        const now = new Date();
        const startOfWeek = new Date(now);
        startOfWeek.setDate(now.getDate() - now.getDay()); // Sunday
        startOfWeek.setHours(0, 0, 0, 0);
        
        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(startOfWeek.getDate() + 6); // Saturday
        endOfWeek.setHours(23, 59, 59, 999);
        
        return this.expenses
            .filter(expense => {
                const expenseDate = new Date(expense.date);
                return expenseDate >= startOfWeek && expenseDate <= endOfWeek;
            })
            .reduce((total, expense) => total + expense.amount, 0);
    }
}

// Run tests
console.log('=== Testing Calculation Methods ===\n');

const tracker = new TestExpenseTracker();
tracker.addTestExpenses();

console.log('Test Data:');
console.log('- Income: $5000');
console.log('- Fixed Expenses: Rent $1500 + Utilities $200 + Insurance $300 = $2000');
console.log('- Total Expenses in array: $2575');
console.log('- Variable Expenses in array: $575 (excluding fixed)');
console.log('');

console.log('Calculation Results:');
console.log('1. calculateTotalExpenses():', tracker.calculateTotalExpenses());
console.log('   Expected: 2575');
console.log('   ✓ Pass:', tracker.calculateTotalExpenses() === 2575);
console.log('');

console.log('2. calculateFixedExpenses():', tracker.calculateFixedExpenses());
console.log('   Expected: 2000');
console.log('   ✓ Pass:', tracker.calculateFixedExpenses() === 2000);
console.log('');

console.log('3. calculateVariableExpenses():', tracker.calculateVariableExpenses());
console.log('   Expected: 575 (2575 - 2000)');
console.log('   ✓ Pass:', tracker.calculateVariableExpenses() === 575);
console.log('');

console.log('4. calculateVariableBudget():', tracker.calculateVariableBudget());
console.log('   Expected: 3000 (5000 - 2000)');
console.log('   ✓ Pass:', tracker.calculateVariableBudget() === 3000);
console.log('');

console.log('5. calculateSavings():', tracker.calculateSavings());
console.log('   Expected: 2425 (5000 - 2575)');
console.log('   ✓ Pass:', tracker.calculateSavings() === 2425);
console.log('');

console.log('6. calculateBudgetLeft():', tracker.calculateBudgetLeft());
console.log('   Expected: 2425 (3000 - 575)');
console.log('   ✓ Pass:', tracker.calculateBudgetLeft() === 2425);
console.log('');

console.log('7. calculateSpendingPercentage():', tracker.calculateSpendingPercentage());
console.log('   Expected: 19 (575/3000 * 100, rounded)');
console.log('   ✓ Pass:', tracker.calculateSpendingPercentage() === 19);
console.log('');

console.log('8. calculateDailyAverage():', tracker.calculateDailyAverage().toFixed(2));
console.log('   Expected: ~18.55 (575 / 31 days in January)');
console.log('   ✓ Pass:', Math.abs(tracker.calculateDailyAverage() - 18.55) < 0.01);
console.log('');

console.log('9. calculateWeeklySpending():', tracker.calculateWeeklySpending());
console.log('   Expected: 225 (expenses from Jan 12-13: 50+100+75)');
console.log('   Note: Result depends on current date');
console.log('');

console.log('=== All Tests Complete ===');
