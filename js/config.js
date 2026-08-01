// Firebase Configuration
// This file initializes Firebase app and Firestore for the Modern Expense Tracker

// Firebase configuration object
const firebaseConfig = {
    apiKey: "AIzaSyDH_RMji5JG-IEP3uu-hapu7H7JKsR_SUA",
    authDomain: "personal-expense-tracker-7aa9c.firebaseapp.com",
    projectId: "personal-expense-tracker-7aa9c",
    storageBucket: "personal-expense-tracker-7aa9c.firebasestorage.app",
    messagingSenderId: "893806575358",
    appId: "1:893806575358:web:fdd0b3d75a57122be4efaf"
};

// Initialize Firebase
let app = null;
let db = null;
let auth = null;

try {
    // Check if Firebase is loaded
    if (typeof firebase !== 'undefined') {
        // Initialize Firebase app
        app = firebase.initializeApp(firebaseConfig);
        
        // Initialize Firestore
        db = firebase.firestore();

        // Offline cache. Without this, a cold open on flaky mobile data has no local
        // Firestore copy and the UI waits on a network round-trip before showing
        // cloud data (including anything the Gmail Apps Script imported).
        // Fails harmlessly when multiple tabs are open or the browser blocks storage.
        db.enablePersistence({ synchronizeTabs: true }).catch(function (err) {
            console.warn('Firestore offline persistence unavailable:', err.code || err.message);
        });

        // Initialize Firebase Authentication
        auth = firebase.auth();
        // Explicitly set LOCAL persistence so sessions survive page refreshes and browser restarts
        auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL).catch(console.warn);

        console.log('Firebase initialized successfully');
    } else {
        console.warn('Firebase SDK not loaded. Running in localStorage-only mode.');
    }
} catch (error) {
    console.error('Error initializing Firebase:', error);
    console.warn('Falling back to localStorage-only mode.');
}

// Export Firebase instances for use in other modules
window.firebaseApp = app;
window.firebaseDb = db;
window.firebaseAuth = auth;
