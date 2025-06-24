// Firebase configuration and initialization
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

// Firebase configuration - using injected config
const firebaseConfig = window.FIREBASE_CONFIG || {
    apiKey: localStorage.getItem('FIREBASE_API_KEY'),
    authDomain: `${localStorage.getItem('FIREBASE_PROJECT_ID')}.firebaseapp.com`,
    projectId: localStorage.getItem('FIREBASE_PROJECT_ID'),
    storageBucket: `${localStorage.getItem('FIREBASE_PROJECT_ID')}.firebasestorage.app`,
    appId: localStorage.getItem('FIREBASE_APP_ID')
};

// Initialize Firebase
let app;
let auth;
let db;

try {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
    
    console.log('Firebase initialized successfully');
} catch (error) {
    console.error('Firebase initialization error:', error);
    
    // Show configuration instructions if initialization fails
    if (error.code === 'app/invalid-api-key' || error.code === 'app/invalid-credential') {
        showFirebaseConfigError();
    }
}

function showFirebaseConfigError() {
    const errorDiv = document.createElement('div');
    errorDiv.innerHTML = `
        <div style="position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.8); z-index: 9999; display: flex; align-items: center; justify-content: center;">
            <div style="background: white; padding: 2rem; border-radius: 10px; max-width: 600px; margin: 2rem;">
                <h2 style="color: #f44336; margin-bottom: 1rem;">Firebase Configuration Required</h2>
                <p style="margin-bottom: 1rem;">To use this application, you need to configure Firebase:</p>
                <ol style="margin-bottom: 1rem; padding-left: 2rem;">
                    <li>Go to the <a href="https://console.firebase.google.com/" target="_blank">Firebase Console</a></li>
                    <li>Create a new Firebase project</li>
                    <li>Add a web app to your project</li>
                    <li>Enable Authentication with Google sign-in</li>
                    <li>Enable Firestore Database</li>
                    <li>Copy your config values and enter them below:</li>
                </ol>
                <div style="display: grid; gap: 1rem;">
                    <input type="text" id="config-api-key" placeholder="API Key" style="padding: 0.5rem; border: 1px solid #ddd; border-radius: 4px;">
                    <input type="text" id="config-project-id" placeholder="Project ID" style="padding: 0.5rem; border: 1px solid #ddd; border-radius: 4px;">
                    <input type="text" id="config-app-id" placeholder="App ID" style="padding: 0.5rem; border: 1px solid #ddd; border-radius: 4px;">
                    <button onclick="saveFirebaseConfig()" style="padding: 0.75rem; background: #4CAF50; color: white; border: none; border-radius: 4px; cursor: pointer;">Save Configuration</button>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(errorDiv);
}

// Function to save Firebase configuration
window.saveFirebaseConfig = function() {
    const apiKey = document.getElementById('config-api-key').value;
    const projectId = document.getElementById('config-project-id').value;
    const appId = document.getElementById('config-app-id').value;
    
    if (apiKey && projectId && appId) {
        localStorage.setItem('FIREBASE_API_KEY', apiKey);
        localStorage.setItem('FIREBASE_PROJECT_ID', projectId);
        localStorage.setItem('FIREBASE_APP_ID', appId);
        
        alert('Configuration saved! Please refresh the page.');
        location.reload();
    } else {
        alert('Please fill in all required fields.');
    }
};

export { auth, db, app };
