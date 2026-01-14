/**
 * Authentication Module
 * Handles all Firebase authentication functionality
 */

/**
 * Sign in with Google using Firebase Auth
 * Shows success/error notifications and triggers data loading
 */
function signInWithGoogle() {
    const provider = new firebase.auth.GoogleAuthProvider();
    auth.signInWithPopup(provider)
        .then((result) => {
            console.log('User signed in:', result.user);
            expenseTracker.showNotification('Successfully signed in!', 'success');
        })
        .catch((error) => {
            console.error('Sign in error:', error);
            expenseTracker.showNotification('Sign in failed. Please try again.', 'error');
        });
}

/**
 * Sign out the current user
 * Shows confirmation notification and clears user state
 */
function signOut() {
    auth.signOut()
        .then(() => {
            console.log('User signed out');
            expenseTracker.showNotification('Successfully signed out!', 'success');
        })
        .catch((error) => {
            console.error('Sign out error:', error);
        });
}

/**
 * Update the authentication UI based on user state
 * Shows/hides sign in button and user info
 * @param {firebase.User|null} user - The current user object or null
 */
function updateAuthUI(user) {
    const signInBtn = document.getElementById('sign-in-btn');
    const userInfo = document.getElementById('user-info');
    const userAvatar = document.getElementById('user-avatar');

    if (user) {
        // User is signed in
        signInBtn.classList.add('hidden');
        userInfo.classList.remove('hidden');
        userAvatar.src = user.photoURL || 'https://via.placeholder.com/32';
        currentUser = user;

        // Load user's data from Firebase
        expenseTracker.loadUserData();
    } else {
        // User is signed out
        signInBtn.classList.remove('hidden');
        userInfo.classList.add('hidden');
        currentUser = null;

        // Clear data and show local data only
        expenseTracker.loadLocalData();
    }
}

/**
 * Initialize authentication state listener
 * Automatically called when auth state changes
 */
function initializeAuth() {
    // Auth state observer - listens for sign in/out events
    auth.onAuthStateChanged((user) => {
        updateAuthUI(user);
    });
}

/**
 * Check if user is currently authenticated
 * @returns {boolean} True if user is signed in
 */
function isAuthenticated() {
    return currentUser !== null && currentUser !== undefined;
}

/**
 * Get current user information
 * @returns {firebase.User|null} Current user object or null
 */
function getCurrentUser() {
    return currentUser;
}

/**
 * Get current user ID for database operations
 * @returns {string|null} User UID or null if not authenticated
 */
function getCurrentUserId() {
    return currentUser ? currentUser.uid : null;
}

// Auto-initialize authentication when this script loads
document.addEventListener('DOMContentLoaded', () => {
    initializeAuth();
});

// Export functions for module use (if needed)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        signInWithGoogle,
        signOut,
        updateAuthUI,
        initializeAuth,
        isAuthenticated,
        getCurrentUser,
        getCurrentUserId
    };
}
