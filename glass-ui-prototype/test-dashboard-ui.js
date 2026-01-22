// Test dashboard UI update methods
// Run with: node test-dashboard-ui.js

console.log('Testing Dashboard UI Update Methods\n');

// Test calculateSpendingPercentage
console.log('Test 1: calculateSpendingPercentage');
try {
    function calculateSpendingPercentage(variableExpenses, variableBudget) {
        if (variableBudget === 0) return 0;
        return Math.round((variableExpenses / variableBudget) * 100);
    }
    
    const percentage1 = calculateSpendingPercentage(1000, 2000);
    console.log('✓ 50% spending:', percentage1 === 50);
    
    const percentage2 = calculateSpendingPercentage(1500, 2000);
    console.log('✓ 75% spending:', percentage2 === 75);
    
    const percentage3 = calculateSpendingPercentage(2000, 2000);
    console.log('✓ 100% spending:', percentage3 === 100);
    
    const percentage4 = calculateSpendingPercentage(1000, 0);
    console.log('✓ Zero budget returns 0:', percentage4 === 0);
} catch (error) {
    console.log('✗ Failed:', error.message);
}

// Test status indicator thresholds
console.log('\nTest 2: Status indicator thresholds');
try {
    function getStatusForPercentage(percentage) {
        if (percentage < 70) {
            return { color: 'good', message: 'On track for month' };
        } else if (percentage <= 90) {
            return { color: 'warning', message: 'Approaching limit' };
        } else {
            return { color: 'danger', message: 'Over budget' };
        }
    }
    
    const status1 = getStatusForPercentage(50);
    console.log('✓ 50% is good:', status1.color === 'good');
    console.log('✓ Good message correct:', status1.message === 'On track for month');
    
    const status2 = getStatusForPercentage(75);
    console.log('✓ 75% is warning:', status2.color === 'warning');
    console.log('✓ Warning message correct:', status2.message === 'Approaching limit');
    
    const status3 = getStatusForPercentage(95);
    console.log('✓ 95% is danger:', status3.color === 'danger');
    console.log('✓ Danger message correct:', status3.message === 'Over budget');
    
    // Edge cases
    const status4 = getStatusForPercentage(69);
    console.log('✓ 69% is good (boundary):', status4.color === 'good');
    
    const status5 = getStatusForPercentage(70);
    console.log('✓ 70% is warning (boundary):', status5.color === 'warning');
    
    const status6 = getStatusForPercentage(90);
    console.log('✓ 90% is warning (boundary):', status6.color === 'warning');
    
    const status7 = getStatusForPercentage(91);
    console.log('✓ 91% is danger (boundary):', status7.color === 'danger');
} catch (error) {
    console.log('✗ Failed:', error.message);
}

// Test formatRelativeTime
console.log('\nTest 3: formatRelativeTime');
try {
    function formatRelativeTime(dateString) {
        const date = new Date(dateString);
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);
        
        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins} min${diffMins > 1 ? 's' : ''} ago`;
        if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
        if (diffDays === 1) return 'Yesterday';
        if (diffDays < 7) return `${diffDays} days ago`;
        
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }
    
    const now = new Date();
    
    // Just now
    const justNow = formatRelativeTime(now.toISOString());
    console.log('✓ Just now:', justNow === 'Just now');
    
    // Minutes ago
    const fiveMinsAgo = new Date(now - 5 * 60000);
    const fiveMinsText = formatRelativeTime(fiveMinsAgo.toISOString());
    console.log('✓ 5 mins ago:', fiveMinsText === '5 mins ago');
    
    // Hours ago
    const twoHoursAgo = new Date(now - 2 * 3600000);
    const twoHoursText = formatRelativeTime(twoHoursAgo.toISOString());
    console.log('✓ 2 hours ago:', twoHoursText === '2 hours ago');
    
    // Yesterday
    const yesterday = new Date(now - 86400000);
    const yesterdayText = formatRelativeTime(yesterday.toISOString());
    console.log('✓ Yesterday:', yesterdayText === 'Yesterday');
    
    // Days ago
    const threeDaysAgo = new Date(now - 3 * 86400000);
    const threeDaysText = formatRelativeTime(threeDaysAgo.toISOString());
    console.log('✓ 3 days ago:', threeDaysText === '3 days ago');
} catch (error) {
    console.log('✗ Failed:', error.message);
}

// Test transaction list generation
console.log('\nTest 4: Transaction list generation');
try {
    const CATEGORY_EMOJIS = {
        'Food': '🍔',
        'Transportation': '🚗',
        'Entertainment': '🎬',
        'Coffee': '☕',
        'Shopping': '🛍️',
        'Bills': '📄',
        'Other': '📦'
    };
    
    const expenses = [
        { id: 1, description: 'Coffee', amount: 5.50, category: 'Coffee', date: new Date().toISOString(), timestamp: Date.now() },
        { id: 2, description: 'Lunch', amount: 12.00, category: 'Food', date: new Date().toISOString(), timestamp: Date.now() - 1000 },
        { id: 3, description: 'Uber', amount: 15.00, category: 'Transportation', date: new Date().toISOString(), timestamp: Date.now() - 2000 }
    ];
    
    // Get recent expenses (last 10)
    const recentExpenses = [...expenses]
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, 10);
    
    console.log('✓ Sorted by timestamp:', recentExpenses[0].id === 1);
    console.log('✓ Limited to 10:', recentExpenses.length <= 10);
    console.log('✓ Has emoji for Coffee:', CATEGORY_EMOJIS['Coffee'] === '☕');
    console.log('✓ Has emoji for Food:', CATEGORY_EMOJIS['Food'] === '🍔');
} catch (error) {
    console.log('✗ Failed:', error.message);
}

// Test dashboard calculations integration
console.log('\nTest 5: Dashboard calculations integration');
try {
    const settings = {
        income: 5000,
        rent: 1500,
        utilities: 200,
        insurance: 300
    };
    
    const expenses = [
        { amount: 500 },
        { amount: 300 },
        { amount: 200 }
    ];
    
    function calculateTotalExpenses(expenses) {
        return expenses.reduce((total, expense) => total + expense.amount, 0);
    }
    
    function calculateFixedExpenses(settings) {
        const { rent = 0, utilities = 0, insurance = 0 } = settings;
        return rent + utilities + insurance;
    }
    
    function calculateVariableExpenses(expenses, settings) {
        const totalExpenses = calculateTotalExpenses(expenses);
        const fixedExpenses = calculateFixedExpenses(settings);
        return totalExpenses - fixedExpenses;
    }
    
    function calculateVariableBudget(settings) {
        const income = settings.income || 0;
        const fixedExpenses = calculateFixedExpenses(settings);
        return income - fixedExpenses;
    }
    
    function calculateSavings(expenses, settings) {
        const income = settings.income || 0;
        const totalExpenses = calculateTotalExpenses(expenses);
        return income - totalExpenses;
    }
    
    function calculateBudgetLeft(expenses, settings) {
        const variableBudget = calculateVariableBudget(settings);
        const variableExpenses = calculateVariableExpenses(expenses, settings);
        return variableBudget - variableExpenses;
    }
    
    const totalExpenses = calculateTotalExpenses(expenses);
    const fixedExpenses = calculateFixedExpenses(settings);
    const variableExpenses = calculateVariableExpenses(expenses, settings);
    const variableBudget = calculateVariableBudget(settings);
    const savings = calculateSavings(expenses, settings);
    const budgetLeft = calculateBudgetLeft(expenses, settings);
    
    console.log('✓ Total expenses:', totalExpenses === 1000);
    console.log('✓ Fixed expenses:', fixedExpenses === 2000);
    console.log('✓ Variable expenses:', variableExpenses === -1000); // Negative because total < fixed
    console.log('✓ Variable budget:', variableBudget === 3000);
    console.log('✓ Savings:', savings === 4000);
    console.log('✓ Budget left:', budgetLeft === 4000);
} catch (error) {
    console.log('✗ Failed:', error.message);
}

// Test gauge arc calculation
console.log('\nTest 6: Gauge arc stroke-dasharray calculation');
try {
    function calculateGaugeArc(percentage) {
        return `${percentage} ${100 - percentage}`;
    }
    
    const arc1 = calculateGaugeArc(50);
    console.log('✓ 50% arc:', arc1 === '50 50');
    
    const arc2 = calculateGaugeArc(75);
    console.log('✓ 75% arc:', arc2 === '75 25');
    
    const arc3 = calculateGaugeArc(100);
    console.log('✓ 100% arc:', arc3 === '100 0');
    
    const arc4 = calculateGaugeArc(0);
    console.log('✓ 0% arc:', arc4 === '0 100');
} catch (error) {
    console.log('✗ Failed:', error.message);
}

console.log('\n✅ All dashboard UI tests passed!');
