// Authentication module
import { auth } from './firebase-config.js';
import { 
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signOut,
    onAuthStateChanged,
    GoogleAuthProvider,
    signInWithPopup,
    updateProfile
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import { createUserProfile, getUserProfile } from './database.js';
import { logActivity } from './logger.js';

class AuthManager {
    constructor() {
        this.currentUser = null;
        this.userProfile = null;
        this.setupAuthStateListener();
    }

    // Set up authentication state listener
    setupAuthStateListener() {
        onAuthStateChanged(auth, async (user) => {
            this.currentUser = user;
            
            if (user) {
                // User is signed in
                console.log('User signed in:', user.email);
                
                // Get user profile from database
                try {
                    this.userProfile = await getUserProfile(user.uid);
                    if (!this.userProfile) {
                        // Create a basic profile if none exists
                        this.userProfile = {
                            uid: user.uid,
                            email: user.email,
                            name: user.displayName || '',
                            role: '',
                            company: '',
                            bio: '',
                            location: '',
                            createdAt: new Date().toISOString()
                        };
                    }
                } catch (error) {
                    console.error('Error fetching user profile:', error);
                }

                await logActivity('user_login', { email: user.email });
                this.showDashboard();
            } else {
                // User is signed out
                console.log('User signed out');
                this.userProfile = null;
                this.showLandingPage();
            }
        });
    }

    // Register new user with email and password
    async registerWithEmail(email, password, userData) {
        try {
            this.showLoading(true);
            
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;

            // Update user profile
            await updateProfile(user, {
                displayName: userData.name
            });

            // Create user profile in database
            const profileData = {
                uid: user.uid,
                email: user.email,
                name: userData.name,
                role: userData.role,
                company: userData.company || '',
                bio: '',
                location: '',
                createdAt: new Date().toISOString(),
                profileViews: 0,
                connections: 0,
                rating: 0.0
            };

            await createUserProfile(user.uid, profileData);
            await logActivity('user_register', { email: user.email, role: userData.role });

            this.showSuccess('Registration successful! Welcome to StartupBridge.');
            return user;
        } catch (error) {
            console.error('Registration error:', error);
            this.showError(this.getErrorMessage(error));
            throw error;
        } finally {
            this.showLoading(false);
        }
    }

    // Sign in with email and password
    async signInWithEmail(email, password) {
        try {
            this.showLoading(true);
            
            const userCredential = await signInWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;

            this.showSuccess('Login successful! Welcome back.');
            return user;
        } catch (error) {
            console.error('Login error:', error);
            this.showError(this.getErrorMessage(error));
            throw error;
        } finally {
            this.showLoading(false);
        }
    }

    // Sign in with Google
    async signInWithGoogle() {
        try {
            this.showLoading(true);
            
            const provider = new GoogleAuthProvider();
            provider.addScope('profile');
            provider.addScope('email');
            
            const result = await signInWithPopup(auth, provider);
            const user = result.user;

            // Check if this is a new user
            const existingProfile = await getUserProfile(user.uid);
            if (!existingProfile) {
                // Create profile for new Google user
                const profileData = {
                    uid: user.uid,
                    email: user.email,
                    name: user.displayName || '',
                    role: '', // Will need to be set later
                    company: '',
                    bio: '',
                    location: '',
                    createdAt: new Date().toISOString(),
                    profileViews: 0,
                    connections: 0,
                    rating: 0.0
                };

                await createUserProfile(user.uid, profileData);
                await logActivity('user_register_google', { email: user.email });
                
                // Show role selection modal
                this.showRoleSelectionModal();
            } else {
                await logActivity('user_login_google', { email: user.email });
            }

            this.showSuccess('Google login successful!');
            return user;
        } catch (error) {
            console.error('Google login error:', error);
            this.showError(this.getErrorMessage(error));
            throw error;
        } finally {
            this.showLoading(false);
        }
    }

    // Sign out user
    async signOutUser() {
        try {
            await logActivity('user_logout', { email: this.currentUser?.email });
            await signOut(auth);
            this.showSuccess('Logged out successfully.');
        } catch (error) {
            console.error('Logout error:', error);
            this.showError(this.getErrorMessage(error));
        }
    }

    // Show role selection modal for Google users
    showRoleSelectionModal() {
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

        const form = modal.querySelector('#role-selection-form');
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const role = document.getElementById('google-user-role').value;
            const company = document.getElementById('google-user-company').value;

            if (role) {
                try {
                    // Update user profile with role
                    const updatedProfile = {
                        ...this.userProfile,
                        role: role,
                        company: company
                    };

                    await createUserProfile(this.currentUser.uid, updatedProfile);
                    this.userProfile = updatedProfile;

                    await logActivity('profile_role_selected', { role: role });
                    
                    document.body.removeChild(modal);
                    this.showSuccess('Profile completed successfully!');
                } catch (error) {
                    console.error('Error updating profile:', error);
                    this.showError('Error updating profile. Please try again.');
                }
            }
        });
    }

    // Show landing page
    showLandingPage() {
        document.getElementById('landing-page').style.display = 'block';
        document.getElementById('dashboard').style.display = 'none';
        
        // Update navigation
        document.getElementById('auth-section').style.display = 'flex';
        document.getElementById('user-section').style.display = 'none';
    }

    // Show dashboard
    showDashboard() {
        document.getElementById('landing-page').style.display = 'none';
        document.getElementById('dashboard').style.display = 'block';
        
        // Update navigation
        document.getElementById('auth-section').style.display = 'none';
        document.getElementById('user-section').style.display = 'flex';
        
        // Update user name in navigation
        const userName = this.userProfile?.name || this.currentUser?.displayName || this.currentUser?.email;
        document.getElementById('user-name').textContent = userName;
        
        // Update dashboard title based on role
        const role = this.userProfile?.role;
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

    // Utility methods
    showLoading(show) {
        const overlay = document.getElementById('loading-overlay');
        if (overlay) {
            overlay.style.display = show ? 'flex' : 'none';
        }
    }

    showError(message) {
        const errorElement = document.getElementById('error-message');
        const errorText = document.getElementById('error-text');
        if (errorElement && errorText) {
            errorText.textContent = message;
            errorElement.style.display = 'block';
            
            setTimeout(() => {
                errorElement.style.display = 'none';
            }, 5000);
        }
    }

    showSuccess(message) {
        const successElement = document.getElementById('success-message');
        const successText = document.getElementById('success-text');
        if (successElement && successText) {
            successText.textContent = message;
            successElement.style.display = 'block';
            
            setTimeout(() => {
                successElement.style.display = 'none';
            }, 5000);
        }
    }

    getErrorMessage(error) {
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

    // Getters
    getCurrentUser() {
        return this.currentUser;
    }

    getUserProfile() {
        return this.userProfile;
    }

    isAuthenticated() {
        return !!this.currentUser;
    }
}

// Create and export auth manager instance
const authManager = new AuthManager();
export default authManager;
