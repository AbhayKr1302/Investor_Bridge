// Database integration layer for StartupBridge
// This module provides functions to interact with the PostgreSQL backend via API

const API_BASE = window.location.origin.replace(':5000', ':3000');

// API helper function
async function apiCall(endpoint, method = 'GET', data = null) {
    const options = {
        method,
        headers: {
            'Content-Type': 'application/json',
        }
    };

    if (data) {
        options.body = JSON.stringify(data);
    }

    try {
        const response = await fetch(`${API_BASE}/api${endpoint}`, options);
        const result = await response.json();
        
        if (!result.success) {
            throw new Error(result.error || 'API call failed');
        }
        
        return result;
    } catch (error) {
        console.error(`API call failed for ${endpoint}:`, error);
        throw error;
    }
}

// User management functions
export async function createOrUpdateUserProfile(userData) {
    return apiCall('/users', 'POST', userData);
}

export async function getUserProfile(firebaseUid) {
    return apiCall(`/users/${firebaseUid}`);
}

export async function getUserStats(firebaseUid) {
    return apiCall(`/users/${firebaseUid}/stats`);
}

// Posts management functions
export async function createPost(postData) {
    return apiCall('/posts', 'POST', postData);
}

export async function getPosts(filters = {}) {
    const params = new URLSearchParams();
    Object.keys(filters).forEach(key => {
        if (filters[key] !== null && filters[key] !== undefined && filters[key] !== '') {
            params.append(key, filters[key]);
        }
    });
    
    const queryString = params.toString();
    const endpoint = queryString ? `/posts?${queryString}` : '/posts';
    return apiCall(endpoint);
}

export async function getPost(postId) {
    return apiCall(`/posts/${postId}`);
}

export async function searchPosts(searchTerm, filters = {}) {
    const searchFilters = { ...filters, search: searchTerm };
    return getPosts(searchFilters);
}

// Messaging functions
export async function createConversation(participantUids, initialMessage) {
    return apiCall('/conversations', 'POST', {
        participants: participantUids,
        initial_message: initialMessage
    });
}

export async function getUserConversations(firebaseUid) {
    return apiCall(`/conversations/${firebaseUid}`);
}

export async function getConversationMessages(conversationId) {
    return apiCall(`/conversations/${conversationId}/messages`);
}

export async function addMessage(conversationId, firebaseUid, text) {
    return apiCall(`/conversations/${conversationId}/messages`, 'POST', {
        firebase_uid: firebaseUid,
        text: text
    });
}

// Activity logging
export async function logActivity(firebaseUid, action, data = {}, level = 'INFO', sessionId = null) {
    return apiCall('/activity', 'POST', {
        firebase_uid: firebaseUid,
        action,
        data,
        level,
        session_id: sessionId
    });
}

// Utility functions for data formatting
export function formatTimestamp(timestamp) {
    if (!timestamp) return 'Unknown';
    
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) {
        return 'Today';
    } else if (diffDays === 1) {
        return 'Yesterday';
    } else if (diffDays < 7) {
        return `${diffDays} days ago`;
    } else {
        return date.toLocaleDateString();
    }
}

export function formatCurrency(amount) {
    if (!amount) return '₹0';
    
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(amount);
}

export function getBusinessCategories() {
    return [
        { value: 'technology', label: 'Technology' },
        { value: 'healthcare', label: 'Healthcare' },
        { value: 'fintech', label: 'FinTech' },
        { value: 'ecommerce', label: 'E-commerce' },
        { value: 'education', label: 'Education' },
        { value: 'agriculture', label: 'Agriculture' },
        { value: 'manufacturing', label: 'Manufacturing' },
        { value: 'renewable-energy', label: 'Renewable Energy' },
        { value: 'food-beverage', label: 'Food & Beverage' },
        { value: 'transportation', label: 'Transportation' },
        { value: 'real-estate', label: 'Real Estate' },
        { value: 'entertainment', label: 'Entertainment' }
    ];
}