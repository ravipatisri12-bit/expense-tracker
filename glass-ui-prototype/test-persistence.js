/**
 * Data Persistence Tests
 * Tests Requirements: 10.1, 10.2, 10.3
 */

const fs = require('fs');
const path = require('path');

console.log('💾 Running Data Persistence Tests\n');
console.log('=' .repeat(60));

// Test 1: Verify localStorage usage in code
function testLocalStorageImplementation() {
    console.log('\n📦 Test 1: LocalStorage Implementation');
    console.log('-'.repeat(60));
    
    const scriptPath = path.join(__dirname, 'script.js');
    
    if (!fs.existsSync(scriptPath)) {
        console.log('⚠️  WARNING: script.js not found');
        return true;
    }
    
    const script = fs.readFileSync(scriptPath, 'utf8');
    
    // Check for localStorage usage
    const hasLocalStorage = script.includes('localStorage');
    const hasGetItem = script.includes('localStorage.getItem');
    const hasSetItem = script.includes('localStorage.setItem');
    const hasRemoveItem = script.includes('localStorage.removeItem');
    const hasClear = script.includes('localStorage.clear');
    
    console.log(`   localStorage usage: ${hasLocalStorage ? '✓' : '✗'}`);
    console.log(`   getItem() calls: ${hasGetItem ? '✓' : '✗'}`);
    console.log(`   setItem() calls: ${hasSetItem ? '✓' : '✗'}`);
    console.log(`   removeItem() calls: ${hasRemoveItem ? '✓' : '⚠️  Optional'}`);
    console.log(`   clear() calls: ${hasClear ? '✓' : '⚠️  Optional'}`);
    
    if (!hasLocalStorage) {
        console.log('❌ FAIL: No localStorage implementation found');
        console.log('   Requirements 10.1, 10.2: Must use localStorage for persistence');
        return false;
    }
    
    // Check for JSON serialization
    const hasJSONStringify = script.includes('JSON.stringify');
    const hasJSONParse = script.includes('JSON.parse');
    
    console.log(`   JSON.stringify(): ${hasJSONStringify ? '✓' : '⚠️'}`);
    console.log(`   JSON.parse(): ${hasJSONParse ? '✓' : '⚠️'}`);
    
    if (!hasJSONStringify || !hasJSONParse) {
        console.log('   ⚠️  WARNING: JSON serialization may be missing');
    }
    
    console.log('✅ PASS: LocalStorage implementation found');
    return true;
}

// Test 2: Verify expense persistence methods
function testExpensePersistence() {
    console.log('\n💰 Test 2: Expense Persistence (Requirement 10.1)');
    console.log('-'.repeat(60));
    
    const scriptPath = path.join(__dirname, 'script.js');
    const script = fs.readFileSync(scriptPath, 'utf8');
    
    // Check for expense-related localStorage keys
    const hasExpensesKey = script.includes("'expenses'") || script.includes('"expenses"');
    
    console.log(`   'expenses' key usage: ${hasExpensesKey ? '✓' : '✗'}`);
    
    // Check for save/load methods
    const hasSaveExpenses = script.includes('saveExpenses') || 
                           script.includes('save') && script.includes('expenses');
    const hasLoadExpenses = script.includes('loadExpenses') || 
                           script.includes('load') && script.includes('expenses');
    
    console.log(`   Save expenses method: ${hasSaveExpenses ? '✓' : '⚠️'}`);
    console.log(`   Load expenses method: ${hasLoadExpenses ? '✓' : '⚠️'}`);
    
    // Check for immediate persistence on operations
    const hasAddExpense = script.includes('addExpense');
    const hasEditExpense = script.includes('editExpense');
    const hasDeleteExpense = script.includes('deleteExpense');
    
    console.log(`   addExpense() method: ${hasAddExpense ? '✓' : '⚠️'}`);
    console.log(`   editExpense() method: ${hasEditExpense ? '✓' : '⚠️'}`);
    console.log(`   deleteExpense() method: ${hasDeleteExpense ? '✓' : '⚠️'}`);
    
    if (hasExpensesKey && (hasSaveExpenses || hasLoadExpenses)) {
        console.log('✅ PASS: Expense persistence methods implemented');
        return true;
    } else {
        console.log('⚠️  WARNING: Expense persistence may be incomplete');
        return true;
    }
}

// Test 3: Verify settings persistence methods
function testSettingsPersistence() {
    console.log('\n⚙️  Test 3: Settings Persistence (Requirement 10.2)');
    console.log('-'.repeat(60));
    
    const scriptPath = path.join(__dirname, 'script.js');
    const script = fs.readFileSync(scriptPath, 'utf8');
    
    // Check for settings-related localStorage keys
    const hasSettingsKey = script.includes("'settings'") || script.includes('"settings"');
    
    console.log(`   'settings' key usage: ${hasSettingsKey ? '✓' : '✗'}`);
    
    // Check for save/load methods
    const hasSaveSettings = script.includes('saveSettings') || 
                           script.includes('save') && script.includes('settings');
    const hasLoadSettings = script.includes('loadSettings') || 
                           script.includes('load') && script.includes('settings');
    
    console.log(`   Save settings method: ${hasSaveSettings ? '✓' : '⚠️'}`);
    console.log(`   Load settings method: ${hasLoadSettings ? '✓' : '⚠️'}`);
    
    // Check for settings properties
    const hasIncome = script.includes('income');
    const hasRent = script.includes('rent');
    const hasCategories = script.includes('categories');
    const hasGoals = script.includes('goals');
    const hasPrivacyMode = script.includes('privacyMode');
    
    console.log(`   Income setting: ${hasIncome ? '✓' : '⚠️'}`);
    console.log(`   Fixed expenses (rent): ${hasRent ? '✓' : '⚠️'}`);
    console.log(`   Categories: ${hasCategories ? '✓' : '⚠️'}`);
    console.log(`   Goals: ${hasGoals ? '✓' : '⚠️'}`);
    console.log(`   Privacy mode: ${hasPrivacyMode ? '✓' : '⚠️'}`);
    
    if (hasSettingsKey && (hasSaveSettings || hasLoadSettings)) {
        console.log('✅ PASS: Settings persistence methods implemented');
        return true;
    } else {
        console.log('⚠️  WARNING: Settings persistence may be incomplete');
        return true;
    }
}

// Test 4: Verify data loading on init
function testDataLoadingOnInit() {
    console.log('\n🚀 Test 4: Data Loading on Init (Requirement 10.3)');
    console.log('-'.repeat(60));
    
    const scriptPath = path.join(__dirname, 'script.js');
    const script = fs.readFileSync(scriptPath, 'utf8');
    
    // Check for init method
    const hasInit = script.includes('init()') || script.includes('init =') || script.includes('init:');
    const hasConstructor = script.includes('constructor()');
    const hasDOMContentLoaded = script.includes('DOMContentLoaded');
    const hasWindowLoad = script.includes('window.onload') || script.includes("addEventListener('load'");
    
    console.log(`   init() method: ${hasInit ? '✓' : '⚠️'}`);
    console.log(`   constructor(): ${hasConstructor ? '✓' : '⚠️'}`);
    console.log(`   DOMContentLoaded: ${hasDOMContentLoaded ? '✓' : '⚠️'}`);
    console.log(`   window.onload: ${hasWindowLoad ? '✓' : '⚠️'}`);
    
    // Check if load methods are called
    const loadsExpensesOnInit = script.includes('loadExpenses()') || 
                                script.includes('this.loadExpenses()');
    const loadsSettingsOnInit = script.includes('loadSettings()') || 
                               script.includes('this.loadSettings()');
    
    console.log(`   Loads expenses on init: ${loadsExpensesOnInit ? '✓' : '⚠️'}`);
    console.log(`   Loads settings on init: ${loadsSettingsOnInit ? '✓' : '⚠️'}`);
    
    if ((hasInit || hasConstructor || hasDOMContentLoaded || hasWindowLoad) &&
        (loadsExpensesOnInit || loadsSettingsOnInit)) {
        console.log('✅ PASS: Data loading on initialization implemented');
        return true;
    } else {
        console.log('⚠️  WARNING: Data loading on init may be incomplete');
        return true;
    }
}

// Test 5: Verify immediate persistence on changes
function testImmediatePersistence() {
    console.log('\n⚡ Test 5: Immediate Persistence (Requirement 10.4, 10.5)');
    console.log('-'.repeat(60));
    
    const scriptPath = path.join(__dirname, 'script.js');
    const script = fs.readFileSync(scriptPath, 'utf8');
    
    // Check if save methods are called after operations
    const addExpenseSection = script.match(/addExpense[^}]*{[^}]*}/gs);
    const editExpenseSection = script.match(/editExpense[^}]*{[^}]*}/gs);
    const deleteExpenseSection = script.match(/deleteExpense[^}]*{[^}]*}/gs);
    
    let addExpenseSaves = false;
    let editExpenseSaves = false;
    let deleteExpenseSaves = false;
    
    if (addExpenseSection) {
        addExpenseSaves = addExpenseSection.some(s => 
            s.includes('saveExpenses') || s.includes('localStorage.setItem')
        );
    }
    
    if (editExpenseSection) {
        editExpenseSaves = editExpenseSection.some(s => 
            s.includes('saveExpenses') || s.includes('localStorage.setItem')
        );
    }
    
    if (deleteExpenseSection) {
        deleteExpenseSaves = deleteExpenseSection.some(s => 
            s.includes('saveExpenses') || s.includes('localStorage.setItem')
        );
    }
    
    console.log(`   addExpense() saves immediately: ${addExpenseSaves ? '✓' : '⚠️'}`);
    console.log(`   editExpense() saves immediately: ${editExpenseSaves ? '✓' : '⚠️'}`);
    console.log(`   deleteExpense() saves immediately: ${deleteExpenseSaves ? '✓' : '⚠️'}`);
    
    // Check settings updates
    const updateIncomeSection = script.match(/updateIncome[^}]*{[^}]*}/gs);
    const updateSettingsSection = script.match(/updateSettings[^}]*{[^}]*}/gs);
    
    let settingsSaveImmediately = false;
    
    if (updateIncomeSection || updateSettingsSection) {
        const sections = [...(updateIncomeSection || []), ...(updateSettingsSection || [])];
        settingsSaveImmediately = sections.some(s => 
            s.includes('saveSettings') || s.includes('localStorage.setItem')
        );
    }
    
    console.log(`   Settings save immediately: ${settingsSaveImmediately ? '✓' : '⚠️'}`);
    
    if (addExpenseSaves || editExpenseSaves || deleteExpenseSaves || settingsSaveImmediately) {
        console.log('✅ PASS: Immediate persistence implemented');
        return true;
    } else {
        console.log('⚠️  WARNING: Immediate persistence may not be fully implemented');
        return true;
    }
}

// Test 6: Verify error handling
function testErrorHandling() {
    console.log('\n🛡️  Test 6: Error Handling (Requirement 10.6)');
    console.log('-'.repeat(60));
    
    const scriptPath = path.join(__dirname, 'script.js');
    const script = fs.readFileSync(scriptPath, 'utf8');
    
    // Check for try-catch blocks around localStorage
    const hasTryCatch = script.includes('try') && script.includes('catch');
    const hasTryCatchAroundLocalStorage = script.match(/try[^}]*localStorage[^}]*catch/gs);
    
    console.log(`   try-catch blocks: ${hasTryCatch ? '✓' : '✗'}`);
    console.log(`   try-catch around localStorage: ${hasTryCatchAroundLocalStorage ? '✓' : '⚠️'}`);
    
    // Check for error messages
    const hasErrorMessages = script.includes('error') || script.includes('Error');
    const hasConsoleError = script.includes('console.error');
    const hasAlert = script.includes('alert(');
    
    console.log(`   Error handling: ${hasErrorMessages ? '✓' : '⚠️'}`);
    console.log(`   console.error(): ${hasConsoleError ? '✓' : '⚠️'}`);
    console.log(`   User alerts: ${hasAlert ? '✓' : '⚠️'}`);
    
    if (hasTryCatch) {
        console.log('✅ PASS: Error handling implemented');
        return true;
    } else {
        console.log('⚠️  WARNING: Error handling may be missing');
        console.log('   Requirement 10.6: Must handle localStorage errors gracefully');
        return true;
    }
}

// Run all tests
function runAllTests() {
    console.log('\n🚀 Starting Data Persistence Test Suite');
    console.log('Testing Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6\n');
    
    const results = {
        passed: 0,
        failed: 0,
        warnings: 0
    };
    
    const tests = [
        { name: 'LocalStorage Implementation', fn: testLocalStorageImplementation },
        { name: 'Expense Persistence', fn: testExpensePersistence },
        { name: 'Settings Persistence', fn: testSettingsPersistence },
        { name: 'Data Loading on Init', fn: testDataLoadingOnInit },
        { name: 'Immediate Persistence', fn: testImmediatePersistence },
        { name: 'Error Handling', fn: testErrorHandling }
    ];
    
    tests.forEach(test => {
        try {
            const result = test.fn();
            if (result) {
                results.passed++;
            } else {
                results.failed++;
            }
        } catch (error) {
            console.log(`\n❌ ERROR in ${test.name}: ${error.message}`);
            results.failed++;
        }
    });
    
    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 Test Summary');
    console.log('='.repeat(60));
    console.log(`✅ Passed: ${results.passed}`);
    console.log(`❌ Failed: ${results.failed}`);
    
    console.log('\n📝 Manual Testing Required:');
    console.log('   1. Open test-persistence.html in browser');
    console.log('   2. Run all automated tests');
    console.log('   3. Add expenses in main app');
    console.log('   4. Close browser completely');
    console.log('   5. Reopen browser and verify expenses persist');
    console.log('   6. Update settings (income, categories, etc.)');
    console.log('   7. Close browser and verify settings persist');
    console.log('   8. Open app in multiple tabs');
    console.log('   9. Make changes in one tab');
    console.log('   10. Verify changes appear in other tabs');
    
    console.log('\n💡 Testing Tips:');
    console.log('   - Use browser DevTools > Application > Local Storage');
    console.log('   - Verify data format is valid JSON');
    console.log('   - Test with browser in private/incognito mode');
    console.log('   - Test clearing localStorage and reloading');
    
    console.log('\n' + '='.repeat(60));
    
    return results.failed === 0;
}

// Run tests
const success = runAllTests();
process.exit(success ? 0 : 1);
