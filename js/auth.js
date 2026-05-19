// Firebase Authentication Logic
// This file handles Google Sign-In, sign-out, and auth state management

// Global current user variable
window.currentUser = null;

/**
 * Sign in with Google using Firebase Authentication
 * Opens a popup window for Google authentication
 * @returns {Promise<firebase.auth.UserCredential>} User credential object
 */
async function signInWithGoogle() {
    try {
        // Check if Firebase Auth is initialized
        if (!window.firebaseAuth) {
            alert('Firebase is not configured. The app will work in offline mode using localStorage.');
            return;
        }

        // Check if Firebase is properly configured
        if (window.firebaseApp && window.firebaseApp.options.apiKey === 'YOUR_API_KEY_HERE') {
            alert('Firebase is not configured. Please set up your Firebase credentials in js/config.js');
            return;
        }

        // Create Google Auth Provider
        const provider = new firebase.auth.GoogleAuthProvider();
        provider.addScope('https://www.googleapis.com/auth/gmail.readonly');

        // Sign in with popup
        const result = await window.firebaseAuth.signInWithPopup(provider);

        // Store Gmail OAuth token (expires in ~59 min)
        const accessToken = result.credential && result.credential.accessToken;
        if (accessToken) {
            localStorage.setItem('gmail_access_token', accessToken);
            localStorage.setItem('gmail_token_expiry', String(Date.now() + 3540000));
        }

        console.log('Successfully signed in:', result.user.displayName);

        // Request notification permission for evening summary (non-blocking)
        if ('Notification' in window && Notification.permission === 'default') {
            Notification.requestPermission();
        }

        // Show success notification if available
        if (typeof showNotification === 'function') {
            showNotification('Successfully signed in!', 'success');
        }

        return result;
    } catch (error) {
        console.error('Error signing in with Google:', error);
        
        // Handle specific error codes
        let errorMessage = 'Sign-in failed. ';
        
        if (error.code === 'auth/popup-closed-by-user') {
            errorMessage += 'Sign-in cancelled.';
        } else if (error.code === 'auth/popup-blocked') {
            errorMessage += 'Pop-up blocked by browser. Please allow pop-ups for this site.';
        } else if (error.code === 'auth/network-request-failed') {
            errorMessage += 'Network error. Please check your internet connection.';
        } else {
            errorMessage += error.message;
        }
        
        alert(errorMessage);
        throw error;
    }
}

/**
 * Sign out the current user
 * @returns {Promise<void>}
 */
async function signOut() {
    try {
        // Check if Firebase Auth is initialized
        if (!window.firebaseAuth) {
            throw new Error('Firebase Authentication is not initialized.');
        }

        await window.firebaseAuth.signOut();

        localStorage.removeItem('gmail_access_token');
        localStorage.removeItem('gmail_token_expiry');

        console.log('Successfully signed out');
    } catch (error) {
        console.error('Error signing out:', error);
        throw new Error(`Sign-out failed: ${error.message}`);
    }
}

/**
 * Set up authentication state listener
 * This function is called whenever the user's sign-in state changes
 * @param {Function} callback - Function to call with user object (or null if signed out)
 * @returns {Function} Unsubscribe function to stop listening
 */
function onAuthStateChanged(callback) {
    // Check if Firebase Auth is initialized
    if (!window.firebaseAuth) {
        console.warn('Firebase Authentication is not initialized. Auth state listener not set up.');
        // Call callback with null to indicate no user
        callback(null);
        return () => {}; // Return empty unsubscribe function
    }

    // Set up the listener
    const unsubscribe = window.firebaseAuth.onAuthStateChanged((user) => {
        if (user) {
            // User is signed in
            console.log('Auth state changed: User signed in', user.displayName);
            callback(user);
        } else {
            // User is signed out
            console.log('Auth state changed: User signed out');
            callback(null);
        }
    });

    return unsubscribe;
}

/**
 * Update UI based on authentication state
 * Shows/hides sign-in button and user info
 * @param {firebase.User|null} user - The current user object or null
 */
function updateAuthUI(user) {
    // Get UI elements
    const signInBtn = document.getElementById('sign-in-btn');
    const userInfo = document.getElementById('user-info');
    const userAvatar = document.getElementById('user-avatar');

    // Check if Firebase is configured
    const isFirebaseConfigured = window.firebaseAuth && 
                                  window.firebaseApp && 
                                  window.firebaseApp.options.apiKey !== 'YOUR_API_KEY_HERE';

    if (!isFirebaseConfigured) {
        // Firebase not configured - hide sign-in button
        if (signInBtn) {
            signInBtn.style.display = 'none';
        }
        if (userInfo) {
            userInfo.classList.add('hidden');
        }
        return;
    }

    if (user) {
        // User is signed in - show user info, hide sign-in button
        if (signInBtn) signInBtn.style.display = 'none';
        if (userInfo) {
            userInfo.classList.remove('hidden');
            userInfo.style.display = 'flex';
            // Update user avatar
            if (userAvatar) {
                userAvatar.src = user.photoURL || 'https://via.placeholder.com/40';
                userAvatar.alt = user.displayName || 'User';
            }
        }
    } else {
        // User is signed out - show sign-in button, hide user info
        if (signInBtn) signInBtn.style.display = 'inline-block';
        if (userInfo) userInfo.classList.add('hidden');
    }
}

/**
 * Get the current authenticated user
 * @returns {firebase.User|null} Current user or null if not signed in
 */
function getCurrentUser() {
    if (!window.firebaseAuth) {
        return null;
    }
    return window.firebaseAuth.currentUser;
}

/**
 * Initialize authentication
 * Sets up auth state listener and UI event handlers
 */
function initAuth() {
    // Check if Firebase is configured
    const isFirebaseConfigured = window.firebaseAuth && 
                                  window.firebaseApp && 
                                  window.firebaseApp.options.apiKey !== 'YOUR_API_KEY_HERE';

    if (!isFirebaseConfigured) {
        console.log('Firebase not configured - running in localStorage-only mode');
        updateAuthUI(null);
        return;
    }

    // Set up auth state listener
    onAuthStateChanged((user) => {
        // Update global currentUser variable
        window.currentUser = user;
        
        updateAuthUI(user);
        if (typeof updateGreeting === 'function') updateGreeting();
        
        // Load user data if signed in
        if (user && window.expenseTracker) {
            window.expenseTracker.loadUserData();
        }
        if (user && window.gamification?.hydrateFromCloud) {
            window.gamification.hydrateFromCloud();
        }
        if (user && typeof refreshFcmTokenSilently === 'function') {
            refreshFcmTokenSilently();
        }
    });
}

async function refreshGmailToken() {
    try {
        const provider = new firebase.auth.GoogleAuthProvider();
        provider.addScope('https://www.googleapis.com/auth/gmail.readonly');
        const result = await window.firebaseAuth.signInWithPopup(provider);
        const token = result.credential && result.credential.accessToken;
        if (token) {
            localStorage.setItem('gmail_access_token', token);
            localStorage.setItem('gmail_token_expiry', String(Date.now() + 3540000));
        }
        return token || null;
    } catch (err) {
        console.error('Gmail token refresh failed:', err);
        return null;
    }
}

// Export functions for use in other modules
window.refreshGmailToken = refreshGmailToken;
window.signInWithGoogle = signInWithGoogle;
window.signOut = signOut;
window.onAuthStateChanged = onAuthStateChanged;
window.updateAuthUI = updateAuthUI;
window.getCurrentUser = getCurrentUser;
window.initAuth = initAuth;

// Auto-initialize if DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAuth);
} else {
    initAuth();
}
