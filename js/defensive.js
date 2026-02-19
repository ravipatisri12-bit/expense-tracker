/**
 * Defensive Coding Utilities
 * Prevents common DOM and null reference errors
 */

// Safe DOM element getter
function safeGetElement(id) {
    const element = document.getElementById(id);
    if (!element) {
        console.warn(`Element not found: ${id}`);
    }
    return element;
}

// Safe event listener attachment
function safeAddEventListener(elementId, event, handler) {
    const element = safeGetElement(elementId);
    if (element) {
        element.addEventListener(event, handler);
        return true;
    }
    return false;
}

// Safe querySelector
function safeQuerySelector(selector) {
    try {
        return document.querySelector(selector);
    } catch (error) {
        console.warn(`Invalid selector: ${selector}`, error);
        return null;
    }
}

// Safe querySelectorAll
function safeQuerySelectorAll(selector) {
    try {
        return document.querySelectorAll(selector);
    } catch (error) {
        console.warn(`Invalid selector: ${selector}`, error);
        return [];
    }
}

// Check if tracker is ready
function isTrackerReady() {
    if (!window.expenseTracker) {
        console.warn('ExpenseTracker not initialized yet');
        return false;
    }
    return true;
}

// Safe tracker method call
function safeTrackerCall(methodName, ...args) {
    if (!isTrackerReady()) return null;
    
    if (typeof window.expenseTracker[methodName] !== 'function') {
        console.warn(`Method not found: ${methodName}`);
        return null;
    }
    
    try {
        return window.expenseTracker[methodName](...args);
    } catch (error) {
        console.error(`Error calling ${methodName}:`, error);
        return null;
    }
}

// Export for use in other modules
if (typeof window !== 'undefined') {
    window.safeGetElement = safeGetElement;
    window.safeAddEventListener = safeAddEventListener;
    window.safeQuerySelector = safeQuerySelector;
    window.safeQuerySelectorAll = safeQuerySelectorAll;
    window.isTrackerReady = isTrackerReady;
    window.safeTrackerCall = safeTrackerCall;
}
