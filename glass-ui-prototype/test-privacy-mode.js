// Simple test to verify privacy mode functionality
// This can be run in the browser console

console.log('Testing Privacy Mode Implementation...\n');

// Test 1: formatAmount with privacy mode disabled
console.log('Test 1: formatAmount with privacy mode disabled');
const tracker = new ExpenseTracker();
tracker.settings.privacyMode = false;
const result1 = tracker.formatAmount(1234.56);
console.log(`Expected: $1,234.56`);
console.log(`Got: ${result1}`);
console.log(`✓ Test 1 ${result1 === '$1,234.56' ? 'PASSED' : 'FAILED'}\n`);

// Test 2: formatAmount with privacy mode enabled
console.log('Test 2: formatAmount with privacy mode enabled');
tracker.settings.privacyMode = true;
const result2 = tracker.formatAmount(1234.56);
console.log(`Expected: ****`);
console.log(`Got: ${result2}`);
console.log(`✓ Test 2 ${result2 === '****' ? 'PASSED' : 'FAILED'}\n`);

// Test 3: togglePrivacyMode changes state
console.log('Test 3: togglePrivacyMode changes state');
tracker.settings.privacyMode = false;
tracker.togglePrivacyMode();
console.log(`Expected: true`);
console.log(`Got: ${tracker.settings.privacyMode}`);
console.log(`✓ Test 3 ${tracker.settings.privacyMode === true ? 'PASSED' : 'FAILED'}\n`);

// Test 4: togglePrivacyMode toggles back
console.log('Test 4: togglePrivacyMode toggles back');
tracker.togglePrivacyMode();
console.log(`Expected: false`);
console.log(`Got: ${tracker.settings.privacyMode}`);
console.log(`✓ Test 4 ${tracker.settings.privacyMode === false ? 'PASSED' : 'FAILED'}\n`);

// Test 5: formatAmount handles zero
console.log('Test 5: formatAmount handles zero');
tracker.settings.privacyMode = false;
const result5 = tracker.formatAmount(0);
console.log(`Expected: $0.00`);
console.log(`Got: ${result5}`);
console.log(`✓ Test 5 ${result5 === '$0.00' ? 'PASSED' : 'FAILED'}\n`);

// Test 6: formatAmount handles large numbers
console.log('Test 6: formatAmount handles large numbers');
tracker.settings.privacyMode = false;
const result6 = tracker.formatAmount(1234567.89);
console.log(`Expected: $1,234,567.89`);
console.log(`Got: ${result6}`);
console.log(`✓ Test 6 ${result6 === '$1,234,567.89' ? 'PASSED' : 'FAILED'}\n`);

console.log('All privacy mode tests completed!');
