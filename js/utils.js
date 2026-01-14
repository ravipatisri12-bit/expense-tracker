/**
 * Utility Functions
 * Common helper functions used throughout the application
 */

/**
 * Calculate total budget from all category goals
 * @param {Object} goals - Object containing category goals
 * @returns {number} Total budget amount
 */
function getTotalBudget(goals = {}) {
    return Object.values(goals).reduce((sum, goal) => sum + goal, 0);
}

/**
 * Format amount as currency string
 * @param {number} amount - The amount to format
 * @param {string} currency - Currency code (default: USD)
 * @param {string} locale - Locale for formatting (default: en-US)
 * @returns {string} Formatted currency string
 */
function formatCurrency(amount, currency = 'USD', locale = 'en-US') {
    // Check if the amount is a whole number
    const isWholeNumber = Number.isInteger(amount);
    
    return new Intl.NumberFormat(locale, {
        style: 'currency',
        currency: currency,
        minimumFractionDigits: isWholeNumber ? 0 : 2,
        maximumFractionDigits: 2
    }).format(amount);
}

/**
 * Format date string for display
 * @param {string|Date} dateString - Date to format
 * @param {string} locale - Locale for formatting (default: en-US)
 * @returns {string} Formatted date string
 */
function formatDate(dateString, locale = 'en-US') {
    return new Date(dateString).toLocaleDateString(locale, {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
    });
}

/**
 * Show notification message to user
 * @param {string} message - Message to display
 * @param {string} type - Notification type ('success' or 'error')
 * @param {number} duration - How long to show notification (ms)
 */
function showNotification(message, type = 'success', duration = 3000) {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `fixed top-4 right-4 z-50 p-4 rounded-lg shadow-lg text-white transition-all duration-300 transform ${
        type === 'success' ? 'bg-green-500' : 'bg-red-500'
    }`;
    notification.textContent = message;

    // Add to page
    document.body.appendChild(notification);

    // Animate in
    setTimeout(() => {
        notification.style.transform = 'translateY(0)';
        notification.style.opacity = '1';
    }, 100);

    // Remove after duration
    setTimeout(() => {
        notification.style.transform = 'translateY(-100%)';
        notification.style.opacity = '0';
        setTimeout(() => {
            if (notification.parentNode) {
                document.body.removeChild(notification);
            }
        }, 300);
    }, duration);
}

/**
 * Generate unique ID for transactions
 * @returns {string} Unique timestamp-based ID
 */
function generateId() {
    return Date.now().toString();
}

/**
 * Get current month and year
 * @returns {Object} Object with current month and year
 */
function getCurrentMonthYear() {
    const now = new Date();
    return {
        month: now.getMonth(),
        year: now.getFullYear(),
        monthName: now.toLocaleDateString('en-US', { month: 'long' })
    };
}

/**
 * Check if date is in current month
 * @param {string|Date} date - Date to check
 * @returns {boolean} True if date is in current month
 */
function isCurrentMonth(date) {
    const expenseDate = new Date(date);
    const now = new Date();
    return expenseDate.getMonth() === now.getMonth() && 
           expenseDate.getFullYear() === now.getFullYear();
}

/**
 * Get month name from month number
 * @param {number} monthNumber - Month number (0-11)
 * @returns {string} Month name
 */
function getMonthName(monthNumber) {
    const months = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
    ];
    return months[monthNumber] || 'Unknown';
}

/**
 * Download data as file
 * @param {string} content - File content
 * @param {string} filename - File name
 * @param {string} mimeType - MIME type
 */
function downloadFile(content, filename, mimeType = 'text/plain') {
    const blob = new Blob([content], { type: mimeType });
    const url = window.URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
}

/**
 * Debounce function calls
 * @param {Function} func - Function to debounce
 * @param {number} wait - Wait time in milliseconds
 * @returns {Function} Debounced function
 */
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Export functions for module use (if needed)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        getTotalBudget,
        formatCurrency,
        formatDate,
        showNotification,
        generateId,
        getCurrentMonthYear,
        isCurrentMonth,
        getMonthName,
        downloadFile,
        debounce
    };
}
