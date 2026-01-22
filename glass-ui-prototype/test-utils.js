/**
 * Simple tests for utility functions
 * Run in browser console or Node.js
 */

// Load utils if in Node.js environment
if (typeof require !== 'undefined') {
    var {
        formatCurrency,
        formatDate,
        formatRelativeTime,
        getDaysInMonth,
        getCurrentWeekExpenses
    } = require('./utils.js');
}

console.log('Testing Utility Functions...\n');

// Test formatCurrency
console.log('=== formatCurrency Tests ===');
console.log('formatCurrency(1234.56, false):', formatCurrency(1234.56, false)); // Expected: $1,234.56
console.log('formatCurrency(1234567.89, false):', formatCurrency(1234567.89, false)); // Expected: $1,234,567.89
console.log('formatCurrency(42.5, false):', formatCurrency(42.5, false)); // Expected: $42.50
console.log('formatCurrency(1234.56, true):', formatCurrency(1234.56, true)); // Expected: ****
console.log('formatCurrency(0, false):', formatCurrency(0, false)); // Expected: $0.00
console.log('formatCurrency(null, false):', formatCurrency(null, false)); // Expected: $0.00
console.log('');

// Test formatDate
console.log('=== formatDate Tests ===');
console.log('formatDate("2026-01-13"):', formatDate('2026-01-13')); // Expected: Jan 13, 2026
console.log('formatDate("2026-12-25"):', formatDate('2026-12-25')); // Expected: Dec 25, 2026
console.log('formatDate("2026-07-04"):', formatDate('2026-07-04')); // Expected: Jul 4, 2026
console.log('formatDate(""):', formatDate('')); // Expected: (empty string)
console.log('');

// Test formatRelativeTime
console.log('=== formatRelativeTime Tests ===');
const today = new Date().toISOString().split('T')[0];
const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];
const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

console.log('formatRelativeTime(today):', formatRelativeTime(today)); // Expected: Just now or X hours ago
console.log('formatRelativeTime(yesterday):', formatRelativeTime(yesterday)); // Expected: Yesterday
console.log('formatRelativeTime(twoDaysAgo):', formatRelativeTime(twoDaysAgo)); // Expected: 2 days ago
console.log('formatRelativeTime(oneWeekAgo):', formatRelativeTime(oneWeekAgo)); // Expected: 1 week ago
console.log('');

// Test getDaysInMonth
console.log('=== getDaysInMonth Tests ===');
console.log('getDaysInMonth(2026, 1):', getDaysInMonth(2026, 1)); // Expected: 31 (January)
console.log('getDaysInMonth(2026, 2):', getDaysInMonth(2026, 2)); // Expected: 28 (February, non-leap)
console.log('getDaysInMonth(2024, 2):', getDaysInMonth(2024, 2)); // Expected: 29 (February, leap year)
console.log('getDaysInMonth(2026, 4):', getDaysInMonth(2026, 4)); // Expected: 30 (April)
console.log('getDaysInMonth(2026, 12):', getDaysInMonth(2026, 12)); // Expected: 31 (December)
console.log('getDaysInMonth(2026, 0):', getDaysInMonth(2026, 0)); // Expected: 0 (invalid)
console.log('getDaysInMonth(2026, 13):', getDaysInMonth(2026, 13)); // Expected: 0 (invalid)
console.log('');

// Test getCurrentWeekExpenses
console.log('=== getCurrentWeekExpenses Tests ===');
const testExpenses = [
    { id: 1, description: 'Today', amount: 10, date: today },
    { id: 2, description: 'Yesterday', amount: 20, date: yesterday },
    { id: 3, description: 'Two days ago', amount: 30, date: twoDaysAgo },
    { id: 4, description: 'One week ago', amount: 40, date: oneWeekAgo }
];

const currentWeekExpenses = getCurrentWeekExpenses(testExpenses);
console.log('Total expenses:', testExpenses.length);
console.log('Current week expenses:', currentWeekExpenses.length);
console.log('Current week expense IDs:', currentWeekExpenses.map(e => e.id));
console.log('');

console.log('All tests completed!');
