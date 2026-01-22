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
            throw new Error('Firebase Authentication is not initialized. Please check your Firebase configuration.');
        }

        // Create Google Auth Provider
        const provider = new firebase.auth.GoogleAuthProvider();
        
        // Optional: Add scopes if needed
        // provider.addScope('https://www.googleapis.com/auth/userinfo.email');
        
        // Sign in with popup
        const result = await window.firebaseAuth.signInWithPopup(provider);
        
        console.log('Successfully signed in:', result.user.displayName);
        
        return result;
    } catch (error) {
        console.error('Error signing in with Google:', error);
        
        // Handle specific error codes
        if (error.code === 'auth/popup-closed-by-user') {
            throw new Error('Sign-in cancelled. Please try again.');
        } else if (error.code === 'auth/popup-blocked') {
            throw new Error('Pop-up blocked by browser. Please allow pop-ups for this site.');
        } else if (error.code === 'auth/network-request-failed') {
            throw new Error('Network error. Please check your internet connection.');
        } else {
            throw new Error(`Sign-in failed: ${error.message}`);
        }
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
    const signInButton = document.getElementById('sign-in-button');
    const signOutButton = document.getElementById('sign-out-button');
    const userInfo = document.getElementById('user-info');
    const userName = document.getElementById('user-name');
    const userAvatar = document.getElementById('user-avatar');

    if (user) {
        // User is signed in - show user info, hide sign-in button
        if (signInButton) signInButton.style.display = 'none';
        if (signOutButton) signOutButton.style.display = 'block';
        if (userInfo) userInfo.style.display = 'flex';
        
        // Update user name and avatar
        if (userName) userName.textContent = user.displayName || 'User';
        if (userAvatar) {
            userAvatar.src = user.photoURL || 'https://via.placeholder.com/40';
            userAvatar.alt = user.displayName || 'User';
        }
    } else {
        // User is signed out - show sign-in button, hide user info
        if (signInButton) signInButton.style.display = 'block';
        if (signOutButton) signOutButton.style.display = 'none';
        if (userInfo) userInfo.style.display = 'none';
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
    // Set up auth state listener
    onAuthStateChanged((user) => {
        // Update global currentUser variable
        window.currentUser = user;
        
        updateAuthUI(user);
        
        // Trigger sync if user is signed in
        if (user && typeof window.syncToFirestore === 'function') {
            window.syncToFirestore();
        }
        
        // Load from Firestore if user is signed in
        if (user && typeof window.loadFromFirestore === 'function') {
            window.loadFromFirestore();
        }
    });

    // Set up sign-in button handler
    const signInButton = document.getElementById('sign-in-button');
    if (signInButton) {
        signInButton.addEventListener('click', async () => {
            try {
                await signInWithGoogle();
                // UI will be updated automatically by auth state listener
            } catch (error) {
                // Show error to user
                alert(error.message);
            }
        });
    }

    // Set up sign-out button handler
    const signOutButton = document.getElementById('sign-out-button');
    if (signOutButton) {
        signOutButton.addEventListener('click', async () => {
            try {
                await signOut();
                // UI will be updated automatically by auth state listener
            } catch (error) {
                // Show error to user
                alert(error.message);
            }
        });
    }
}

// Export functions for use in other modules
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
