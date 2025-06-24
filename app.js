// Single entry point application file with PostgreSQL backend integration
import { auth, db } from './firebase-config.js';
import { 
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signOut,
    onAuthStateChanged,
    GoogleAuthProvider,
    signInWithPopup,
    updateProfile
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import { 
    createOrUpdateUserProfile,
    getUserProfile as getDBUserProfile,
    getUserStats as getDBUserStats,
    createPost as createDBPost,
    getPosts as getDBPosts,
    searchPosts as searchDBPosts,
    logActivity as logDBActivity,
    formatTimestamp,
    formatCurrency,
    getBusinessCategories
} from './database_integration.js';

// Global application state
window.startupBridge = {
    currentUser: null,
    userProfile: null
};

// Utility functions
function showError(message) {
    const errorElement = document.getElementById('error-message');
    const errorText = document.getElementById('error-text');
    if (errorElement && errorText) {
        errorText.textContent = message;
        errorElement.style.display = 'block';
        setTimeout(() => errorElement.style.display = 'none', 5000);
    }
}

function showSuccess(message) {
    const successElement = document.getElementById('success-message');
    const successText = document.getElementById('success-text');
    if (successElement && successText) {
        successText.textContent = message;
        successElement.style.display = 'block';
        setTimeout(() => successElement.style.display = 'none', 5000);
    }
}

function showLoading(show) {
    const overlay = document.getElementById('loading-overlay');
    if (overlay) overlay.style.display = show ? 'flex' : 'none';
}

// Database operations using PostgreSQL backend
async function createUserProfile(uid, profileData) {
    try {
        const userData = {
            firebase_uid: uid,
            email: profileData.email,
            name: profileData.name,
            role: profileData.role,
            company: profileData.company || '',
            bio: profileData.bio || '',
            location: profileData.location || ''
        };
        
        const result = await createOrUpdateUserProfile(userData);
        return result.user;
    } catch (error) {
        console.error('Error creating user profile:', error);
        throw error;
    }
}

async function getUserProfile(uid) {
    try {
        const result = await getDBUserProfile(uid);
        return result.user;
    } catch (error) {
        console.error('Error fetching user profile:', error);
        return null;
    }
}

// Authentication functions
async function registerWithEmail(email, password, userData) {
    try {
        showLoading(true);
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        await updateProfile(user, { displayName: userData.name });

        const profileData = {
            uid: user.uid,
            email: user.email,
            name: userData.name,
            role: userData.role,
            company: userData.company || '',
            bio: '',
            location: '',
            profileViews: 0,
            connections: 0,
            rating: 0.0
        };

        await createUserProfile(user.uid, profileData);
        await logDBActivity(user.uid, 'user_register', { email: user.email, role: userData.role });
        showSuccess('Registration successful! Welcome to StartupBridge.');
        return user;
    } catch (error) {
        showError(getErrorMessage(error));
        throw error;
    } finally {
        showLoading(false);
    }
}

async function signInWithEmail(email, password) {
    try {
        showLoading(true);
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        await logDBActivity(userCredential.user.uid, 'user_login', { email: userCredential.user.email });
        showSuccess('Login successful! Welcome back.');
        return userCredential.user;
    } catch (error) {
        showError(getErrorMessage(error));
        throw error;
    } finally {
        showLoading(false);
    }
}

async function signInWithGoogle() {
    try {
        showLoading(true);
        const provider = new GoogleAuthProvider();
        const result = await signInWithPopup(auth, provider);
        const user = result.user;

        const existingProfile = await getUserProfile(user.uid);
        if (!existingProfile) {
            const profileData = {
                uid: user.uid,
                email: user.email,
                name: user.displayName || '',
                role: '',
                company: '',
                bio: '',
                location: '',
                profileViews: 0,
                connections: 0,
                rating: 0.0
            };
            await createUserProfile(user.uid, profileData);
            await logDBActivity(user.uid, 'user_register_google', { email: user.email });
            showRoleSelectionModal();
        } else {
            await logDBActivity(user.uid, 'user_login_google', { email: user.email });
        }

        showSuccess('Google login successful!');
        return user;
    } catch (error) {
        showError(getErrorMessage(error));
        throw error;
    } finally {
        showLoading(false);
    }
}

function showRoleSelectionModal() {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.style.display = 'block';
    modal.innerHTML = `
        <div class="modal-content">
            <h2>Select Your Role</h2>
            <p>Please select your role to complete your profile:</p>
            <form id="role-selection-form">
                <div class="form-group">
                    <label for="google-user-role">Role:</label>
                    <select id="google-user-role" required>
                        <option value="">Select your role</option>
                        <option value="investor">Investor</option>
                        <option value="entrepreneur">Entrepreneur</option>
                        <option value="banker">Banker</option>
                        <option value="advisor">Business Advisor</option>
                    </select>
                </div>
                <div class="form-group">
                    <label for="google-user-company">Company/Organization (Optional):</label>
                    <input type="text" id="google-user-company">
                </div>
                <button type="submit" class="btn-primary">Complete Profile</button>
            </form>
        </div>
    `;

    document.body.appendChild(modal);

    modal.querySelector('#role-selection-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const role = document.getElementById('google-user-role').value;
        const company = document.getElementById('google-user-company').value;

        if (role) {
            try {
                const updatedProfile = {
                    ...window.startupBridge.userProfile,
                    role: role,
                    company: company
                };
                await createUserProfile(window.startupBridge.currentUser.uid, updatedProfile);
                window.startupBridge.userProfile = updatedProfile;
                await logDBActivity(window.startupBridge.currentUser.uid, 'profile_role_selected', { role: role });
                document.body.removeChild(modal);
                showSuccess('Profile completed successfully!');
            } catch (error) {
                showError('Error updating profile. Please try again.');
            }
        }
    });
}

function getErrorMessage(error) {
    const errorMessages = {
        'auth/user-not-found': 'No account found with this email address.',
        'auth/wrong-password': 'Incorrect password.',
        'auth/email-already-in-use': 'An account with this email already exists.',
        'auth/weak-password': 'Password should be at least 6 characters.',
        'auth/invalid-email': 'Please enter a valid email address.',
        'auth/network-request-failed': 'Network error. Please check your connection.',
        'auth/too-many-requests': 'Too many failed attempts. Please try again later.',
        'auth/popup-closed-by-user': 'Google sign-in was cancelled.',
        'auth/popup-blocked': 'Popup was blocked. Please allow popups for this site.'
    };
    return errorMessages[error.code] || `Authentication error: ${error.message}`;
}

// Auth state listener
onAuthStateChanged(auth, async (user) => {
    window.startupBridge.currentUser = user;
    
    if (user) {
        try {
            window.startupBridge.userProfile = await getUserProfile(user.uid);
            if (!window.startupBridge.userProfile) {
                window.startupBridge.userProfile = {
                    uid: user.uid,
                    email: user.email,
                    name: user.displayName || '',
                    role: '',
                    company: '',
                    bio: '',
                    location: ''
                };
            }
        } catch (error) {
            console.error('Error fetching user profile:', error);
        }
        showDashboard();
    } else {
        window.startupBridge.userProfile = null;
        showLandingPage();
    }
});

function showLandingPage() {
    document.getElementById('landing-page').style.display = 'block';
    document.getElementById('dashboard').style.display = 'none';
    document.getElementById('auth-section').style.display = 'flex';
    document.getElementById('user-section').style.display = 'none';
}

function showDashboard() {
    document.getElementById('landing-page').style.display = 'none';
    document.getElementById('dashboard').style.display = 'block';
    document.getElementById('auth-section').style.display = 'none';
    document.getElementById('user-section').style.display = 'flex';
    
    const userName = window.startupBridge.userProfile?.name || window.startupBridge.currentUser?.displayName || window.startupBridge.currentUser?.email;
    document.getElementById('user-name').textContent = userName;
    
    const role = window.startupBridge.userProfile?.role;
    if (role) {
        const roleTitles = {
            investor: 'Investor Dashboard',
            entrepreneur: 'Entrepreneur Dashboard', 
            banker: 'Banker Dashboard',
            advisor: 'Business Advisor Dashboard'
        };
        document.getElementById('dashboard-title').textContent = roleTitles[role] || 'Dashboard';
    }
}

// DOM event listeners
document.addEventListener('DOMContentLoaded', () => {
    // Register modal
    const registerBtn = document.getElementById('register-btn');
    const registerModal = document.getElementById('register-modal');
    const closeRegister = document.getElementById('close-register');

    registerBtn?.addEventListener('click', () => registerModal.style.display = 'block');
    closeRegister?.addEventListener('click', () => registerModal.style.display = 'none');

    // Login modal
    const loginBtn = document.getElementById('login-btn');
    const loginModal = document.getElementById('login-modal');
    const closeLogin = document.getElementById('close-login');

    loginBtn?.addEventListener('click', () => loginModal.style.display = 'block');
    closeLogin?.addEventListener('click', () => loginModal.style.display = 'none');

    // Close modals when clicking outside
    window.addEventListener('click', (e) => {
        if (e.target.classList.contains('modal')) {
            e.target.style.display = 'none';
        }
    });

    // Registration form
    document.getElementById('register-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('register-email').value;
        const password = document.getElementById('register-password').value;
        const name = document.getElementById('register-name').value;
        const role = document.getElementById('register-role').value;
        const company = document.getElementById('register-company').value;

        if (!email || !password || !name || !role) {
            showError('Please fill in all required fields.');
            return;
        }

        if (password.length < 6) {
            showError('Password must be at least 6 characters long.');
            return;
        }

        try {
            await registerWithEmail(email, password, { name, role, company });
            registerModal.style.display = 'none';
        } catch (error) {
            console.error('Registration error:', error);
        }
    });

    // Login form
    document.getElementById('login-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('login-email').value;
        const password = document.getElementById('login-password').value;

        if (!email || !password) {
            showError('Please enter both email and password.');
            return;
        }

        try {
            await signInWithEmail(email, password);
            loginModal.style.display = 'none';
        } catch (error) {
            console.error('Login error:', error);
        }
    });

    // Google auth buttons
    document.getElementById('google-register')?.addEventListener('click', async () => {
        try {
            await signInWithGoogle();
            registerModal.style.display = 'none';
        } catch (error) {
            console.error('Google auth error:', error);
        }
    });

    document.getElementById('google-login')?.addEventListener('click', async () => {
        try {
            await signInWithGoogle();
            loginModal.style.display = 'none';
        } catch (error) {
            console.error('Google auth error:', error);
        }
    });

    // Logout button
    document.getElementById('logout-btn')?.addEventListener('click', async () => {
        try {
            if (window.startupBridge.currentUser) {
                await logDBActivity(window.startupBridge.currentUser.uid, 'user_logout', { email: window.startupBridge.currentUser.email });
            }
            await signOut(auth);
            showSuccess('Logged out successfully.');
        } catch (error) {
            showError('Error logging out.');
        }
    });

    // Error/success message close buttons
    document.getElementById('close-error')?.addEventListener('click', () => {
        document.getElementById('error-message').style.display = 'none';
    });

    document.getElementById('close-success')?.addEventListener('click', () => {
        document.getElementById('success-message').style.display = 'none';
    });

    console.log('StartupBridge application initialized successfully');
});