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
        
        // Initialize Firebase Authentication
        auth = firebase.auth();
        
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
