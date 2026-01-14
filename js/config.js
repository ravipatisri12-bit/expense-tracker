/**
 * Firebase Configuration
 * Contains all Firebase setup and initialization
 */

// Firebase Configuration Object
const firebaseConfig = {
    apiKey: "AIzaSyDH_RMji5JG-IEP3uu-hapu7H7JKsR_SUA",
    authDomain: "personal-expense-tracker-7aa9c.firebaseapp.com",
    projectId: "personal-expense-tracker-7aa9c",
    storageBucket: "personal-expense-tracker-7aa9c.firebasestorage.app",
    messagingSenderId: "893806575358",
    appId: "1:893806575358:web:fdd0b3d75a57122be4efaf"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);

// Firebase Service References
const db = firebase.firestore();
const auth = firebase.auth();

// Current user state
let currentUser = null;

// Tailwind Configuration for primary colors
const tailwindConfig = {
    theme: {
        extend: {
            colors: {
                primary: {
                    50: '#f0f9ff',
                    500: '#3b82f6',
                    600: '#2563eb',
                    700: '#1d4ed8'
                }
            }
        }
    }
};

// Apply Tailwind configuration
if (typeof tailwind !== 'undefined') {
    tailwind.config = tailwindConfig;
}

// App Constants
const APP_CONFIG = {
    CACHE_NAME: 'expense-tracker-v2',
    DEFAULT_CATEGORIES: ['Food', 'Transportation', 'Entertainment', 'Coffee', 'Shopping', 'Bills', 'Other'],
    NOTIFICATION_DURATION: 3000,
    CURRENCY: 'USD',
    LOCALE: 'en-US'
};

// Export configuration for module use (if needed)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        firebaseConfig,
        db,
        auth,
        APP_CONFIG,
        tailwindConfig
    };
}
