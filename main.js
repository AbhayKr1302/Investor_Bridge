// Main application entry point and initialization
import authManager from './auth.js';
import { logActivity, logPageView } from './logger.js';

class StartupBridgeApp {
    constructor() {
        this.initialized = false;
        this.init();
    }

    // Initialize the application
    async init() {
        try {
            console.log('Initializing StartupBridge application...');

            // Log application start
            await logActivity('app_start', {
                timestamp: new Date().toISOString(),
                userAgent: navigator.userAgent,
                url: window.location.href
            });

            // Setup UI event listeners
            this.setupUIEventListeners();

            // Setup keyboard shortcuts
            this.setupKeyboardShortcuts();

            // Setup page visibility handling
            this.setupPageVisibilityHandling();

            // Log initial page view
            await logPageView('landing');

            this.initialized = true;
            console.log('StartupBridge application initialized successfully');

        } catch (error) {
            console.error('Failed to initialize application:', error);
            this.showCriticalError('Failed to initialize application. Please refresh the page.');
        }
    }

    // Setup UI event listeners
    setupUIEventListeners() {
        // Modal handling
        this.setupModalHandlers();

        // Form submission handlers
        this.setupFormHandlers();

        // Message handlers
        this.setupMessageHandlers();

        // Navigation handlers
        this.setupNavigationHandlers();

        // Scroll handling for performance
        this.setupScrollHandlers();
    }

    // Setup modal event handlers
    setupModalHandlers() {
        // Register modal
        const registerBtn = document.getElementById('register-btn');
        const registerModal = document.getElementById('register-modal');
        const closeRegister = document.getElementById('close-register');

        if (registerBtn && registerModal && closeRegister) {
            registerBtn.addEventListener('click', () => {
                registerModal.style.display = 'block';
                logActivity('modal_open', { modal: 'register' });
            });

            closeRegister.addEventListener('click', () => {
                registerModal.style.display = 'none';
                logActivity('modal_close', { modal: 'register' });
            });
        }

        // Login modal
        const loginBtn = document.getElementById('login-btn');
        const loginModal = document.getElementById('login-modal');
        const closeLogin = document.getElementById('close-login');

        if (loginBtn && loginModal && closeLogin) {
            loginBtn.addEventListener('click', () => {
                loginModal.style.display = 'block';
                logActivity('modal_open', { modal: 'login' });
            });

            closeLogin.addEventListener('click', () => {
                loginModal.style.display = 'none';
                logActivity('modal_close', { modal: 'login' });
            });
        }

        // Close modals when clicking outside
        window.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal')) {
                e.target.style.display = 'none';
                logActivity('modal_close', { modal: 'outside_click' });
            }
        });
    }

    // Setup form submission handlers
    setupFormHandlers() {
        // Registration form
        const registerForm = document.getElementById('register-form');
        if (registerForm) {
            registerForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                await this.handleRegistration();
            });
        }

        // Login form
        const loginForm = document.getElementById('login-form');
        if (loginForm) {
            loginForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                await this.handleLogin();
            });
        }

        // Google authentication buttons
        const googleRegisterBtn = document.getElementById('google-register');
        const googleLoginBtn = document.getElementById('google-login');

        if (googleRegisterBtn) {
            googleRegisterBtn.addEventListener('click', async () => {
                await this.handleGoogleAuth();
            });
        }

        if (googleLoginBtn) {
            googleLoginBtn.addEventListener('click', async () => {
                await this.handleGoogleAuth();
            });
        }

        // Logout button
        const logoutBtn = document.getElementById('logout-btn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', async () => {
                await authManager.signOutUser();
            });
        }
    }

    // Setup message handlers
    setupMessageHandlers() {
        // Error message close
        const closeError = document.getElementById('close-error');
        if (closeError) {
            closeError.addEventListener('click', () => {
                document.getElementById('error-message').style.display = 'none';
            });
        }

        // Success message close
        const closeSuccess = document.getElementById('close-success');
        if (closeSuccess) {
            closeSuccess.addEventListener('click', () => {
                document.getElementById('success-message').style.display = 'none';
            });
        }
    }

    // Setup navigation handlers
    setupNavigationHandlers() {
        // Smooth scrolling for anchor links
        document.addEventListener('click', (e) => {
            if (e.target.tagName === 'A' && e.target.getAttribute('href')?.startsWith('#')) {
                e.preventDefault();
                const targetId = e.target.getAttribute('href').substring(1);
                const targetElement = document.getElementById(targetId);
                if (targetElement) {
                    targetElement.scrollIntoView({
                        behavior: 'smooth',
                        block: 'start'
                    });
                }
            }
        });

        // Back to top functionality
        const backToTopBtn = document.createElement('button');
        backToTopBtn.innerHTML = '<i class="fas fa-chevron-up"></i>';
        backToTopBtn.className = 'back-to-top';
        backToTopBtn.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            background: #1e3c72;
            color: white;
            border: none;
            border-radius: 50%;
            width: 50px;
            height: 50px;
            cursor: pointer;
            display: none;
            z-index: 1000;
            transition: all 0.3s ease;
        `;

        document.body.appendChild(backToTopBtn);

        backToTopBtn.addEventListener('click', () => {
            window.scrollTo({
                top: 0,
                behavior: 'smooth'
            });
            logActivity('back_to_top_clicked');
        });

        // Show/hide back to top button
        window.addEventListener('scroll', () => {
            if (window.pageYOffset > 300) {
                backToTopBtn.style.display = 'block';
            } else {
                backToTopBtn.style.display = 'none';
            }
        });
    }

    // Setup scroll handlers for performance
    setupScrollHandlers() {
        let ticking = false;

        function updateScrollPosition() {
            // Add scroll-based animations or effects here
            ticking = false;
        }

        window.addEventListener('scroll', () => {
            if (!ticking) {
                requestAnimationFrame(updateScrollPosition);
                ticking = true;
            }
        });
    }

    // Setup keyboard shortcuts
    setupKeyboardShortcuts() {
        document.addEventListener('keydown', async (e) => {
            // Ctrl/Cmd + / for search focus
            if ((e.ctrlKey || e.metaKey) && e.key === '/') {
                e.preventDefault();
                const searchInput = document.getElementById('search-input');
                if (searchInput && searchInput.offsetParent !== null) {
                    searchInput.focus();
                    await logActivity('keyboard_shortcut', { action: 'search_focus' });
                }
            }

            // Escape to close modals
            if (e.key === 'Escape') {
                const modals = document.querySelectorAll('.modal');
                modals.forEach(modal => {
                    if (modal.style.display === 'block') {
                        modal.style.display = 'none';
                        logActivity('keyboard_shortcut', { action: 'modal_close' });
                    }
                });
            }

            // Alt + number keys for dashboard navigation
            if (e.altKey && authManager.isAuthenticated()) {
                const dashboardSections = ['overview', 'browse', 'post', 'messages', 'profile'];
                const keyNum = parseInt(e.key);
                if (keyNum >= 1 && keyNum <= dashboardSections.length && window.dashboardManager) {
                    e.preventDefault();
                    window.dashboardManager.switchSection(dashboardSections[keyNum - 1]);
                    await logActivity('keyboard_shortcut', { 
                        action: 'dashboard_navigation',
                        section: dashboardSections[keyNum - 1]
                    });
                }
            }
        });
    }

    // Setup page visibility handling
    setupPageVisibilityHandling() {
        let hidden, visibilityChange;
        
        if (typeof document.hidden !== "undefined") {
            hidden = "hidden";
            visibilityChange = "visibilitychange";
        } else if (typeof document.msHidden !== "undefined") {
            hidden = "msHidden";
            visibilityChange = "msvisibilitychange";
        } else if (typeof document.webkitHidden !== "undefined") {
            hidden = "webkitHidden";
            visibilityChange = "webkitvisibilitychange";
        }

        if (typeof document[hidden] !== "undefined") {
            document.addEventListener(visibilityChange, async () => {
                if (document[hidden]) {
                    await logActivity('page_hidden');
                } else {
                    await logActivity('page_visible');
                }
            });
        }
    }

    // Handle user registration
    async handleRegistration() {
        try {
            const email = document.getElementById('register-email').value;
            const password = document.getElementById('register-password').value;
            const name = document.getElementById('register-name').value;
            const role = document.getElementById('register-role').value;
            const company = document.getElementById('register-company').value;

            // Basic validation
            if (!email || !password || !name || !role) {
                this.showError('Please fill in all required fields.');
                return;
            }

            if (password.length < 6) {
                this.showError('Password must be at least 6 characters long.');
                return;
            }

            const userData = { name, role, company };
            await authManager.registerWithEmail(email, password, userData);

            // Close modal on success
            document.getElementById('register-modal').style.display = 'none';

        } catch (error) {
            console.error('Registration error:', error);
            // Error handling is done in authManager
        }
    }

    // Handle user login
    async handleLogin() {
        try {
            const email = document.getElementById('login-email').value;
            const password = document.getElementById('login-password').value;

            if (!email || !password) {
                this.showError('Please enter both email and password.');
                return;
            }

            await authManager.signInWithEmail(email, password);

            // Close modal on success
            document.getElementById('login-modal').style.display = 'none';

        } catch (error) {
            console.error('Login error:', error);
            // Error handling is done in authManager
        }
    }

    // Handle Google authentication
    async handleGoogleAuth() {
        try {
            await authManager.signInWithGoogle();

            // Close modals on success
            document.getElementById('register-modal').style.display = 'none';
            document.getElementById('login-modal').style.display = 'none';

        } catch (error) {
            console.error('Google auth error:', error);
            // Error handling is done in authManager
        }
    }

    // Utility methods
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

    showCriticalError(message) {
        // Show a critical error that requires page refresh
        const errorDiv = document.createElement('div');
        errorDiv.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0,0,0,0.8);
            z-index: 9999;
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-family: Arial, sans-serif;
        `;
        
        errorDiv.innerHTML = `
            <div style="background: #f44336; padding: 2rem; border-radius: 10px; max-width: 500px; text-align: center;">
                <h2>Application Error</h2>
                <p>${message}</p>
                <button onclick="window.location.reload()" style="padding: 0.75rem 1.5rem; background: white; color: #f44336; border: none; border-radius: 5px; cursor: pointer; margin-top: 1rem;">
                    Refresh Page
                </button>
            </div>
        `;
        
        document.body.appendChild(errorDiv);
    }

    // Performance monitoring
    measurePerformance() {
        if (window.performance && window.performance.mark) {
            window.performance.mark('app-init-start');
            
            setTimeout(() => {
                window.performance.mark('app-init-end');
                window.performance.measure('app-init', 'app-init-start', 'app-init-end');
                
                const measures = window.performance.getEntriesByName('app-init');
                if (measures.length > 0) {
                    logActivity('performance_measure', {
                        metric: 'app_init_time',
                        duration: measures[0].duration
                    });
                }
            }, 0);
        }
    }

    // Get application state
    getState() {
        return {
            initialized: this.initialized,
            user: authManager.getCurrentUser(),
            userProfile: authManager.getUserProfile(),
            currentSection: window.dashboardManager ? window.dashboardManager.currentSection : null
        };
    }
}

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.startupBridgeApp = new StartupBridgeApp();
});

// Global error handlers
window.addEventListener('error', (event) => {
    console.error('Global error:', event.error);
    logActivity('global_error', {
        message: event.error?.message,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno
    });
});

window.addEventListener('unhandledrejection', (event) => {
    console.error('Unhandled promise rejection:', event.reason);
    logActivity('unhandled_rejection', {
        reason: event.reason?.toString()
    });
});

// Export for module usage
export default StartupBridgeApp;
