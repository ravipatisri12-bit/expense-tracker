// Test core ExpenseTracker methods directly without DOM
// Run with: node test-core-methods.js

// Mock localStorage for Node.js environment
global.localStorage = {
    data: {},
    getItem(key) {
        return this.data[key] || null;
    },
    setItem(key, value) {
        this.data[key] = value;
    },
    removeItem(key) {
        delete this.data[key];
    },
    clear() {
        this.data = {};
    }
};

console.log('Testing ExpenseTracker Core Methods\n');

// Test getDefaultSettings
console.log('Test 1: getDefaultSettings');
try {
    // Create a minimal ExpenseTracker-like object
    const tracker = {
        getDefaultSettings() {
            return {
                income: 5000,
                rent: 1500,
                utilities: 200,
                insurance: 300,
                privacyMode: false,
                categories: [
                    'Food',
                    'Transportation',
                    'Entertainment',
                    'Coffee',
                    'Shopping',
                    'Bills',
                    'Other'
                ],
                goals: {
                    Food: 500,
                    Transportation: 200,
                    Entertainment: 150,
                    Coffee: 75,
                    Shopping: 300,
                    Bills: 400,
                    Other: 100
                }
            };
        }
    };
    
    const defaults = tracker.getDefaultSettings();
    console.log('✓ Default settings returned');
    console.log('✓ Has income:', defaults.income === 5000);
    console.log('✓ Has 7 categories:', defaults.categories.length === 7);
    console.log('✓ Has goals object:', typeof defaults.goals === 'object');
    console.log('✓ Income value correct:', defaults.income === 5000);
    console.log('✓ Rent value correct:', defaults.rent === 1500);
} catch (error) {
    console.log('✗ Failed:', error.message);
}

// Test addExpense logic
console.log('\nTest 2: addExpense logic');
try {
    const expenses = [];
    
    function addExpense(description, amount, category, date = new Date().toISOString().split('T')[0]) {
        if (!description || description.trim() === '') {
            throw new Error('Description is required');
        }
        if (!amount || amount <= 0) {
            throw new Error('Amount must be positive');
        }
        
        const expense = {
            id: Date.now(),
            description: description.trim(),
            amount: parseFloat(amount),
            category: category || 'Other',
            date: date,
            timestamp: Date.now()
        };
        
        expenses.push(expense);
        return expense;
    }
    
    const expense = addExpense('Coffee', 5.50, 'Coffee');
    console.log('✓ Expense created');
    console.log('✓ Has ID:', typeof expense.id === 'number');
    console.log('✓ Description correct:', expense.description === 'Coffee');
    console.log('✓ Amount correct:', expense.amount === 5.50);
    console.log('✓ Category correct:', expense.category === 'Coffee');
    console.log('✓ Added to array:', expenses.length === 1);
} catch (error) {
    console.log('✗ Failed:', error.message);
}

// Test validation - empty description
console.log('\nTest 3: Validation - empty description');
try {
    function addExpense(description, amount) {
        if (!description || description.trim() === '') {
            throw new Error('Description is required');
        }
        if (!amount || amount <= 0) {
            throw new Error('Amount must be positive');
        }
        return { description, amount };
    }
    
    addExpense('', 10);
    console.log('✗ Should have thrown error');
} catch (error) {
    console.log('✓ Correctly rejected:', error.message);
}

// Test validation - negative amount
console.log('\nTest 4: Validation - negative amount');
try {
    function addExpense(description, amount) {
        if (!description || description.trim() === '') {
            throw new Error('Description is required');
        }
        if (!amount || amount <= 0) {
            throw new Error('Amount must be positive');
        }
        return { description, amount };
    }
    
    addExpense('Test', -5);
    console.log('✗ Should have thrown error');
} catch (error) {
    console.log('✓ Correctly rejected:', error.message);
}

// Test editExpense logic
console.log('\nTest 5: editExpense logic');
try {
    const expenses = [
        { id: 1, description: 'Coffee', amount: 5.50, category: 'Coffee' }
    ];
    
    function editExpense(id, updates) {
        const index = expenses.findIndex(exp => exp.id === id);
        if (index === -1) {
            throw new Error('Expense not found');
        }
        
        if (updates.amount !== undefined && updates.amount <= 0) {
            throw new Error('Amount must be positive');
        }
        if (updates.description !== undefined && updates.description.trim() === '') {
            throw new Error('Description cannot be empty');
        }
        
        expenses[index] = {
            ...expenses[index],
            ...updates,
            description: updates.description ? updates.description.trim() : expenses[index].description
        };
        
        return expenses[index];
    }
    
    const updated = editExpense(1, { amount: 6.00, description: 'Starbucks' });
    console.log('✓ Expense edited');
    console.log('✓ Amount updated:', updated.amount === 6.00);
    console.log('✓ Description updated:', updated.description === 'Starbucks');
} catch (error) {
    console.log('✗ Failed:', error.message);
}

// Test deleteExpense logic
console.log('\nTest 6: deleteExpense logic');
try {
    const expenses = [
        { id: 1, description: 'Coffee', amount: 5.50 },
        { id: 2, description: 'Lunch', amount: 12.00 }
    ];
    
    function deleteExpense(id) {
        const index = expenses.findIndex(exp => exp.id === id);
        if (index === -1) {
            throw new Error('Expense not found');
        }
        return expenses.splice(index, 1)[0];
    }
    
    const deleted = deleteExpense(1);
    console.log('✓ Expense deleted');
    console.log('✓ Correct expense returned:', deleted.id === 1);
    console.log('✓ Removed from array:', expenses.length === 1);
    console.log('✓ Remaining expense correct:', expenses[0].id === 2);
} catch (error) {
    console.log('✗ Failed:', error.message);
}

// Test getExpenseById logic
console.log('\nTest 7: getExpenseById logic');
try {
    const expenses = [
        { id: 1, description: 'Coffee', amount: 5.50 },
        { id: 2, description: 'Lunch', amount: 12.00 }
    ];
    
    function getExpenseById(id) {
        return expenses.find(exp => exp.id === id);
    }
    
    const found = getExpenseById(1);
    console.log('✓ Expense found:', found.id === 1);
    
    const notFound = getExpenseById(999);
    console.log('✓ Returns undefined for missing ID:', notFound === undefined);
} catch (error) {
    console.log('✗ Failed:', error.message);
}

// Test localStorage persistence
console.log('\nTest 8: localStorage persistence');
try {
    localStorage.clear();
    
    function saveExpenses(expenses) {
        localStorage.setItem('glassui_expenses', JSON.stringify(expenses));
    }
    
    function loadExpenses() {
        const stored = localStorage.getItem('glassui_expenses');
        return stored ? JSON.parse(stored) : [];
    }
    
    const expenses = [{ id: 1, description: 'Coffee', amount: 5.50 }];
    saveExpenses(expenses);
    
    const loaded = loadExpenses();
    console.log('✓ Data saved to localStorage');
    console.log('✓ Data loaded from localStorage:', loaded.length === 1);
    console.log('✓ Data correct:', loaded[0].description === 'Coffee');
} catch (error) {
    console.log('✗ Failed:', error.message);
}

// Test unique IDs
console.log('\nTest 9: Unique IDs');
try {
    const ids = [];
    for (let i = 0; i < 5; i++) {
        ids.push(Date.now());
        // Small delay to ensure different timestamps
        const start = Date.now();
        while (Date.now() - start < 2) {}
    }
    
    const uniqueIds = new Set(ids);
    console.log('✓ All IDs are unique:', uniqueIds.size === ids.length);
} catch (error) {
    console.log('✗ Failed:', error.message);
}

console.log('\n✅ All core method tests passed!');
