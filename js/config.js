// Firebase Configuration
// This file initializes Firebase app and Firestore for the Modern Expense Tracker

// Firebase configuration object
// IMPORTANT: Replace these values with your actual Firebase project credentials
// Get these from Firebase Console > Project Settings > General > Your apps > Firebase SDK snippet
const firebaseConfig = {
    apiKey: "YOUR_API_KEY_HERE",
    authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_PROJECT_ID.appspot.com",
    messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
    appId: "YOUR_APP_ID"
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
