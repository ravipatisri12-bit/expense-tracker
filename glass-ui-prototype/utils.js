/**
 * Utility Functions for Glass UI Expense Tracker
 * Provides formatting and calculation helpers
 */

/**
 * Format amount as currency with $ and commas
 * @param {number} amount - The amount to format
 * @param {boolean} privacyMode - Whether privacy mode is enabled
 * @returns {string} Formatted currency string or "****" if privacy mode
 */
function formatCurrency(amount, privacyMode = false) {
    if (privacyMode) {
        return '****';
    }
    
    // Handle invalid inputs
    if (amount === null || amount === undefined || isNaN(amount)) {
        return '$0.00';
    }
    
    // Format with $ and commas
    return '$' + amount.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/**
 * Format date string as "Jan 13, 2026"
 * @param {string} dateString - ISO date string (YYYY-MM-DD)
 * @returns {string} Formatted date string
 */
function formatDate(dateString) {
    if (!dateString) {
        return '';
    }
    
    const date = new Date(dateString + 'T00:00:00'); // Add time to avoid timezone issues
    
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 
                    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    
    const month = months[date.getMonth()];
    const day = date.getDate();
    const year = date.getFullYear();
    
    return `${month} ${day}, ${year}`;
}

/**
 * Format date as relative time ("2 hours ago", "Yesterday", etc.)
 * @param {string} dateString - ISO date string (YYYY-MM-DD)
 * @returns {string} Relative time string
 */
function formatRelativeTime(dateString) {
    if (!dateString) {
        return '';
    }
    
    const date = new Date(dateString + 'T00:00:00');
    const now = new Date();
    
    // Calculate difference in milliseconds
    const diffMs = now - date;
    const diffSeconds = Math.floor(diffMs / 1000);
    const diffMinutes = Math.floor(diffSeconds / 60);
    const diffHours = Math.floor(diffMinutes / 60);
    const diffDays = Math.floor(diffHours / 24);
    
    // Handle future dates
    if (diffMs < 0) {
        return 'In the future';
    }
    
    // Less than 1 minute
    if (diffSeconds < 60) {
        return 'Just now';
    }
    
    // Less than 1 hour
    if (diffMinutes < 60) {
        return diffMinutes === 1 ? '1 minute ago' : `${diffMinutes} minutes ago`;
    }
    
    // Less than 24 hours
    if (diffHours < 24) {
        return diffHours === 1 ? '1 hour ago' : `${diffHours} hours ago`;
    }
    
    // Yesterday
    if (diffDays === 1) {
        return 'Yesterday';
    }
    
    // Less than 7 days
    if (diffDays < 7) {
        return `${diffDays} days ago`;
    }
    
    // Less than 30 days
    if (diffDays < 30) {
        const weeks = Math.floor(diffDays / 7);
        return weeks === 1 ? '1 week ago' : `${weeks} weeks ago`;
    }
    
    // Less than 365 days
    if (diffDays < 365) {
        const months = Math.floor(diffDays / 30);
        return months === 1 ? '1 month ago' : `${months} months ago`;
    }
    
    // Over a year
    const years = Math.floor(diffDays / 365);
    return years === 1 ? '1 year ago' : `${years} years ago`;
}

/**
 * Get number of days in a specific month
 * @param {number} year - The year (e.g., 2026)
 * @param {number} month - The month (1-12)
 * @returns {number} Number of days in the month
 */
function getDaysInMonth(year, month) {
    // Validate inputs
    if (!year || !month || month < 1 || month > 12) {
        return 0;
    }
    
    // Create date for first day of next month, then subtract 1 day
    return new Date(year, month, 0).getDate();
}

/**
 * Filter expenses to current week (Monday to Sunday)
 * @param {Array} expenses - Array of expense objects with date property
 * @returns {Array} Filtered expenses from current week
 */
function getCurrentWeekExpenses(expenses) {
    if (!expenses || !Array.isArray(expenses)) {
        return [];
    }
    
    const now = new Date();
    
    // Get current day of week (0 = Sunday, 1 = Monday, etc.)
    const currentDay = now.getDay();
    
    // Calculate days since Monday (treat Sunday as 6 days after Monday)
    const daysSinceMonday = currentDay === 0 ? 6 : currentDay - 1;
    
    // Get Monday of current week
    const monday = new Date(now);
    monday.setDate(now.getDate() - daysSinceMonday);
    monday.setHours(0, 0, 0, 0);
    
    // Get Sunday of current week
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    sunday.setHours(23, 59, 59, 999);
    
    // Filter expenses within current week
    return expenses.filter(expense => {
        if (!expense.date) {
            return false;
        }
        
        const expenseDate = new Date(expense.date + 'T00:00:00');
        return expenseDate >= monday && expenseDate <= sunday;
    });
}

// Export functions for use in other files
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        formatCurrency,
        formatDate,
        formatRelativeTime,
        getDaysInMonth,
        getCurrentWeekExpenses
    };
}
