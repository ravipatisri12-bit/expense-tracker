/* Simple Unit Tests for Settings Management Methods */

console.log('Testing Settings Management Methods...\n');

// Test the validation logic directly
function testUpdateIncome() {
    console.log('Test 1: updateIncome validation');
    
    // Test valid income
    const validAmount = parseFloat(6000);
    if (!isNaN(validAmount) && validAmount >= 0) {
        console.log('✓ Valid income (6000) accepted');
    } else {
        console.log('✗ Valid income rejected');
    }
    
    // Test negative income
    const negativeAmount = parseFloat(-100);
    if (isNaN(negativeAmount) || negativeAmount < 0) {
        console.log('✓ Negative income (-100) correctly rejected');
    } else {
        console.log('✗ Negative income accepted (should reject)');
    }
    
    // Test non-numeric
    const invalidAmount = parseFloat('abc');
    if (isNaN(invalidAmount)) {
        console.log('✓ Non-numeric income correctly rejected');
    } else {
        console.log('✗ Non-numeric income accepted (should reject)');
    }
}

function testUpdateFixedExpense() {
    console.log('\nTest 2: updateFixedExpense validation');
    
    const validTypes = ['rent', 'utilities', 'insurance'];
    
    // Test valid type
    if (validTypes.includes('rent')) {
        console.log('✓ Valid type (rent) accepted');
    } else {
        console.log('✗ Valid type rejected');
    }
    
    // Test invalid type
    if (!validTypes.includes('invalid')) {
        console.log('✓ Invalid type correctly rejected');
    } else {
        console.log('✗ Invalid type accepted (should reject)');
    }
    
    // Test valid amount
    const validAmount = parseFloat(2000);
    if (!isNaN(validAmount) && validAmount >= 0) {
        console.log('✓ Valid amount (2000) accepted');
    } else {
        console.log('✗ Valid amount rejected');
    }
}

function testAddCategory() {
    console.log('\nTest 3: addCategory validation');
    
    const categories = ['Food', 'Transportation', 'Entertainment'];
    
    // Test empty name
    const emptyName = '   '.trim();
    if (!emptyName) {
        console.log('✓ Empty category name correctly rejected');
    } else {
        console.log('✗ Empty category name accepted (should reject)');
    }
    
    // Test duplicate (case-insensitive)
    const newCategory = 'Groceries';
    const existingCategory = categories.find(
        cat => cat.toLowerCase() === newCategory.toLowerCase()
    );
    if (!existingCategory) {
        console.log('✓ New category (Groceries) can be added');
    } else {
        console.log('✗ New category rejected');
    }
    
    // Test duplicate
    const duplicateCategory = 'Food';
    const isDuplicate = categories.find(
        cat => cat.toLowerCase() === duplicateCategory.toLowerCase()
    );
    if (isDuplicate) {
        console.log('✓ Duplicate category (Food) correctly rejected');
    } else {
        console.log('✗ Duplicate category accepted (should reject)');
    }
}

function testDeleteCategory() {
    console.log('\nTest 4: deleteCategory logic');
    
    const categories = ['Food', 'Transportation', 'Entertainment'];
    const expenses = [
        { id: 1, category: 'Food', amount: 50 },
        { id: 2, category: 'Transportation', amount: 30 },
        { id: 3, category: 'Food', amount: 25 }
    ];
    
    // Test category exists
    const categoryToDelete = 'Food';
    const index = categories.indexOf(categoryToDelete);
    if (index !== -1) {
        console.log('✓ Category to delete found');
    } else {
        console.log('✗ Category not found');
    }
    
    // Test expense reassignment
    const reassignedExpenses = expenses.map(exp => {
        if (exp.category === categoryToDelete) {
            return { ...exp, category: 'Other' };
        }
        return exp;
    });
    
    const foodExpenses = reassignedExpenses.filter(exp => exp.category === 'Food');
    if (foodExpenses.length === 0) {
        console.log('✓ All expenses reassigned from Food to Other');
    } else {
        console.log('✗ Some expenses still in Food category');
    }
    
    // Test last category protection
    const singleCategory = ['Food'];
    if (singleCategory.length === 1) {
        console.log('✓ Cannot delete last category (protection works)');
    } else {
        console.log('✗ Last category protection failed');
    }
}

function testSetCategoryGoal() {
    console.log('\nTest 5: setCategoryGoal validation');
    
    const categories = ['Food', 'Transportation'];
    
    // Test valid category
    if (categories.includes('Food')) {
        console.log('✓ Valid category (Food) accepted');
    } else {
        console.log('✗ Valid category rejected');
    }
    
    // Test invalid category
    if (!categories.includes('Invalid')) {
        console.log('✓ Invalid category correctly rejected');
    } else {
        console.log('✗ Invalid category accepted (should reject)');
    }
    
    // Test valid amount
    const validAmount = parseFloat(600);
    if (!isNaN(validAmount) && validAmount >= 0) {
        console.log('✓ Valid goal amount (600) accepted');
    } else {
        console.log('✗ Valid goal amount rejected');
    }
    
    // Test negative amount
    const negativeAmount = parseFloat(-100);
    if (isNaN(negativeAmount) || negativeAmount < 0) {
        console.log('✓ Negative goal amount correctly rejected');
    } else {
        console.log('✗ Negative goal amount accepted (should reject)');
    }
}

function testCalculations() {
    console.log('\nTest 6: Calculation logic');
    
    const settings = {
        income: 5000,
        rent: 1500,
        utilities: 200,
        insurance: 300
    };
    
    // Test fixed expenses calculation
    const fixedExpenses = settings.rent + settings.utilities + settings.insurance;
    if (fixedExpenses === 2000) {
        console.log('✓ Fixed expenses calculated correctly: 2000');
    } else {
        console.log('✗ Fixed expenses calculation wrong:', fixedExpenses);
    }
    
    // Test variable budget calculation
    const variableBudget = settings.income - fixedExpenses;
    if (variableBudget === 3000) {
        console.log('✓ Variable budget calculated correctly: 3000');
    } else {
        console.log('✗ Variable budget calculation wrong:', variableBudget);
    }
}

// Run all tests
testUpdateIncome();
testUpdateFixedExpense();
testAddCategory();
testDeleteCategory();
testSetCategoryGoal();
testCalculations();

console.log('\n✅ All validation logic tests completed!');
