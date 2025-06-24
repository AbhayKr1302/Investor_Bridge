// Logging system for tracking user activities and system events
import { db } from './firebase-config.js';
import { collection, addDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

class Logger {
    constructor() {
        this.logLevel = 'INFO'; // DEBUG, INFO, WARN, ERROR
        this.maxRetries = 3;
        this.retryDelay = 1000; // 1 second
        this.offline = false;
        this.offlineQueue = [];
        
        // Setup online/offline detection
        this.setupNetworkDetection();
    }

    // Setup network detection for offline logging
    setupNetworkDetection() {
        window.addEventListener('online', () => {
            this.offline = false;
            this.flushOfflineQueue();
        });

        window.addEventListener('offline', () => {
            this.offline = true;
        });
        
        this.offline = !navigator.onLine;
    }

    // Main logging function
    async logActivity(action, data = {}, level = 'INFO') {
        const logEntry = {
            action,
            data,
            level,
            timestamp: new Date().toISOString(),
            userAgent: navigator.userAgent,
            url: window.location.href,
            sessionId: this.getSessionId(),
            userId: this.getCurrentUserId()
        };

        // Console logging based on level
        this.logToConsole(logEntry);

        // If offline, queue the log entry
        if (this.offline) {
            this.offlineQueue.push(logEntry);
            this.saveToLocalStorage(logEntry);
            return;
        }

        // Try to save to Firestore
        try {
            await this.saveToFirestore(logEntry);
        } catch (error) {
            console.error('Failed to log to Firestore:', error);
            
            // Fallback to local storage
            this.saveToLocalStorage(logEntry);
            
            // Add to offline queue for retry
            this.offlineQueue.push(logEntry);
        }
    }

    // Save log entry to Firestore
    async saveToFirestore(logEntry, retries = 0) {
        try {
            const logsRef = collection(db, 'activity_logs');
            await addDoc(logsRef, {
                ...logEntry,
                createdAt: serverTimestamp()
            });
        } catch (error) {
            if (retries < this.maxRetries) {
                await this.delay(this.retryDelay * (retries + 1));
                return this.saveToFirestore(logEntry, retries + 1);
            }
            throw error;
        }
    }

    // Save to local storage as fallback
    saveToLocalStorage(logEntry) {
        try {
            const logs = JSON.parse(localStorage.getItem('startupbridge_logs') || '[]');
            logs.push(logEntry);
            
            // Keep only last 100 logs in localStorage
            if (logs.length > 100) {
                logs.splice(0, logs.length - 100);
            }
            
            localStorage.setItem('startupbridge_logs', JSON.stringify(logs));
        } catch (error) {
            console.error('Failed to save log to localStorage:', error);
        }
    }

    // Console logging with appropriate levels
    logToConsole(logEntry) {
        const message = `[${logEntry.level}] ${logEntry.action}: ${JSON.stringify(logEntry.data)}`;
        
        switch (logEntry.level) {
            case 'DEBUG':
                console.debug(message);
                break;
            case 'INFO':
                console.info(message);
                break;
            case 'WARN':
                console.warn(message);
                break;
            case 'ERROR':
                console.error(message);
                break;
            default:
                console.log(message);
        }
    }

    // Flush offline queue when back online
    async flushOfflineQueue() {
        if (this.offlineQueue.length === 0) return;

        console.info(`Flushing ${this.offlineQueue.length} offline log entries`);
        
        const queueCopy = [...this.offlineQueue];
        this.offlineQueue = [];

        for (const logEntry of queueCopy) {
            try {
                await this.saveToFirestore(logEntry);
            } catch (error) {
                console.error('Failed to flush log entry:', error);
                // Re-add to queue for next retry
                this.offlineQueue.push(logEntry);
            }
        }
    }

    // Utility functions
    getSessionId() {
        let sessionId = sessionStorage.getItem('startupbridge_session_id');
        if (!sessionId) {
            sessionId = 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
            sessionStorage.setItem('startupbridge_session_id', sessionId);
        }
        return sessionId;
    }

    getCurrentUserId() {
        // This will be populated by the auth system
        return window.currentUserId || 'anonymous';
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // Specific logging methods for different activities
    async logPageView(page) {
        await this.logActivity('page_view', { page });
    }

    async logUserAction(action, details) {
        await this.logActivity('user_action', { action, ...details });
    }

    async logError(error, context = {}) {
        await this.logActivity('error', {
            message: error.message,
            stack: error.stack,
            context
        }, 'ERROR');
    }

    async logPerformance(metric, value, context = {}) {
        await this.logActivity('performance', {
            metric,
            value,
            context
        });
    }

    async logBusinessEvent(event, data) {
        await this.logActivity('business_event', { event, ...data });
    }

    // Get logs from localStorage (for debugging)
    getLocalLogs() {
        try {
            return JSON.parse(localStorage.getItem('startupbridge_logs') || '[]');
        } catch (error) {
            console.error('Failed to get local logs:', error);
            return [];
        }
    }

    // Clear local logs
    clearLocalLogs() {
        try {
            localStorage.removeItem('startupbridge_logs');
            console.info('Local logs cleared');
        } catch (error) {
            console.error('Failed to clear local logs:', error);
        }
    }

    // Export logs as JSON (for debugging)
    exportLogs() {
        const logs = this.getLocalLogs();
        const dataStr = JSON.stringify(logs, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        
        const url = URL.createObjectURL(dataBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `startupbridge_logs_${new Date().toISOString().split('T')[0]}.json`;
        link.click();
        
        URL.revokeObjectURL(url);
    }

    // Set log level
    setLogLevel(level) {
        this.logLevel = level;
        console.info(`Log level set to: ${level}`);
    }
}

// Create logger instance
const logger = new Logger();

// Convenience function for external use
export async function logActivity(action, data = {}, level = 'INFO') {
    return logger.logActivity(action, data, level);
}

// Export other logging methods
export const logPageView = (page) => logger.logPageView(page);
export const logUserAction = (action, details) => logger.logUserAction(action, details);
export const logError = (error, context) => logger.logError(error, context);
export const logPerformance = (metric, value, context) => logger.logPerformance(metric, value, context);
export const logBusinessEvent = (event, data) => logger.logBusinessEvent(event, data);

// Global error handler
window.addEventListener('error', (event) => {
    logger.logError(event.error, {
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno
    });
});

// Global unhandled promise rejection handler
window.addEventListener('unhandledrejection', (event) => {
    logger.logError(new Error(event.reason), {
        type: 'unhandled_promise_rejection'
    });
});

// Performance monitoring
if (window.performance && window.performance.navigation) {
    window.addEventListener('load', () => {
        setTimeout(() => {
            const perfData = window.performance.timing;
            const loadTime = perfData.loadEventEnd - perfData.navigationStart;
            logger.logPerformance('page_load_time', loadTime);
        }, 0);
    });
}

// Export logger instance for direct access
export default logger;
