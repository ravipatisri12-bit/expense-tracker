/* Test Settings Management Functionality */

// Mock localStorage
const localStorageMock = (() => {
    let store = {};
    return {
        getItem: (key) => store[key] || null,
        setItem: (key, value) => { store[key] = value.toString(); },
        clear: () => { store = {}; }
    };
})();

global.localStorage = localStorageMock;

// Mock DOM elements with better support
const mockElement = {
    style: {},
    classList: {
        add: () => {},
        remove: () => {},
        contains: () => false
    },
    appendChild: () => {},
    addEventListener: () => {},
    querySelector: () => null,
    querySelectorAll: () => [],
    setAttribute: () => {},
    textContent: '',
    value: '',
    innerHTML: ''
};

global.document = {
    getElementById: () => null,
    querySelector: () => null,
    querySelectorAll: () => [],
    createElement: () => mockElement,
    head: { appendChild: () => {} },
    body: { appendChild: () => {} },
    addEventListener: () => {}
};

global.window = global;
global.requestAnimationFrame = (cb) => setTimeout(cb, 0);
global.setInterval = () => {};

// Load the ExpenseTracker class
const fs = require('fs');
const scriptContent = fs.readFileSync('./script.js', 'utf8');
eval(scriptContent);

console.log('Testing Settings Management...\n');

// Test 1: updateIncome
console.log('Test 1: updateIncome');
const tracker = new ExpenseTracker();
try {
    tracker.updateIncome(6000);
    console.log('✓ Income updated to 6000');
    console.log('  Current income:', tracker.settings.income);
} catch (error) {
    console.log('✗ Failed:', error.message);
}

// Test 2: updateIncome with invalid value
console.log('\nTest 2: updateIncome with invalid value');
try {
    tracker.updateIncome(-100);
    console.log('✗ Should have thrown error for negative income');
} catch (error) {
    console.log('✓ Correctly rejected negative income:', error.message);
}

// Test 3: updateFixedExpense
console.log('\nTest 3: updateFixedExpense');
try {
    tracker.updateFixedExpense('rent', 2000);
    console.log('✓ Rent updated to 2000');
    console.log('  Current rent:', tracker.settings.rent);
} catch (error) {
    console.log('✗ Failed:', error.message);
}

// Test 4: updateFixedExpense with invalid type
console.log('\nTest 4: updateFixedExpense with invalid type');
try {
    tracker.updateFixedExpense('invalid', 100);
    console.log('✗ Should have thrown error for invalid type');
} catch (error) {
    console.log('✓ Correctly rejected invalid type:', error.message);
}

// Test 5: addCategory
console.log('\nTest 5: addCategory');
try {
    const initialCount = tracker.settings.categories.length;
    tracker.addCategory('Groceries');
    console.log('✓ Category "Groceries" added');
    console.log('  Categories count:', initialCount, '->', tracker.settings.categories.length);
    console.log('  Categories:', tracker.settings.categories.join(', '));
} catch (error) {
    console.log('✗ Failed:', error.message);
}

// Test 6: addCategory with duplicate name
console.log('\nTest 6: addCategory with duplicate name');
try {
    tracker.addCategory('Food');
    console.log('✗ Should have thrown error for duplicate category');
} catch (error) {
    console.log('✓ Correctly rejected duplicate category:', error.message);
}

// Test 7: addCategory with empty name
console.log('\nTest 7: addCategory with empty name');
try {
    tracker.addCategory('   ');
    console.log('✗ Should have thrown error for empty category');
} catch (error) {
    console.log('✓ Correctly rejected empty category:', error.message);
}

// Test 8: deleteCategory
console.log('\nTest 8: deleteCategory');
try {
    // Add an expense with the category first
    tracker.addExpense('Test expense', 50, 'Groceries');
    const initialCount = tracker.settings.categories.length;
    tracker.deleteCategory('Groceries');
    console.log('✓ Category "Groceries" deleted');
    console.log('  Categories count:', initialCount, '->', tracker.settings.categories.length);
    
    // Check if expense was reassigned
    const expense = tracker.expenses[0];
    console.log('  Expense category reassigned to:', expense.category);
} catch (error) {
    console.log('✗ Failed:', error.message);
}

// Test 9: setCategoryGoal
console.log('\nTest 9: setCategoryGoal');
try {
    tracker.setCategoryGoal('Food', 600);
    console.log('✓ Goal for "Food" set to 600');
    console.log('  Current goal:', tracker.settings.goals.Food);
} catch (error) {
    console.log('✗ Failed:', error.message);
}

// Test 10: setCategoryGoal with invalid amount
console.log('\nTest 10: setCategoryGoal with invalid amount');
try {
    tracker.setCategoryGoal('Food', -100);
    console.log('✗ Should have thrown error for negative goal');
} catch (error) {
    console.log('✓ Correctly rejected negative goal:', error.message);
}

// Test 11: Verify calculations after settings changes
console.log('\nTest 11: Verify calculations after settings changes');
try {
    tracker.settings.income = 5000;
    tracker.settings.rent = 1500;
    tracker.settings.utilities = 200;
    tracker.settings.insurance = 300;
    
    const fixedExpenses = tracker.calculateFixedExpenses();
    const variableBudget = tracker.calculateVariableBudget();
    
    console.log('✓ Calculations work correctly');
    console.log('  Fixed expenses:', fixedExpenses, '(expected: 2000)');
    console.log('  Variable budget:', variableBudget, '(expected: 3000)');
    
    if (fixedExpenses === 2000 && variableBudget === 3000) {
        console.log('  ✓ All calculations correct!');
    } else {
        console.log('  ✗ Calculation mismatch!');
    }
} catch (error) {
    console.log('✗ Failed:', error.message);
}

console.log('\n✅ All settings management tests completed!');
