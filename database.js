// Database operations using Firestore
import { db } from './firebase-config.js';
import {
    collection,
    doc,
    getDoc,
    getDocs,
    addDoc,
    updateDoc,
    deleteDoc,
    setDoc,
    query,
    where,
    orderBy,
    limit,
    onSnapshot,
    serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
import { logActivity } from './logger.js';

// User Profile Operations
export async function createUserProfile(uid, profileData) {
    try {
        const userRef = doc(db, 'users', uid);
        await updateDoc(userRef, {
            ...profileData,
            updatedAt: serverTimestamp()
        }).catch(async () => {
            // If document doesn't exist, create it
            await setDoc(userRef, {
                ...profileData,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp()
            });
        });
        
        console.log('User profile created/updated successfully');
        return true;
    } catch (error) {
        console.error('Error creating user profile:', error);
        throw error;
    }
}

export async function getUserProfile(uid) {
    try {
        const userRef = doc(db, 'users', uid);
        const userSnap = await getDoc(userRef);
        
        if (userSnap.exists()) {
            return { id: userSnap.id, ...userSnap.data() };
        } else {
            console.log('No user profile found');
            return null;
        }
    } catch (error) {
        console.error('Error fetching user profile:', error);
        throw error;
    }
}

export async function updateUserProfile(uid, updateData) {
    try {
        const userRef = doc(db, 'users', uid);
        await updateDoc(userRef, {
            ...updateData,
            updatedAt: serverTimestamp()
        });
        
        await logActivity('profile_updated', { uid });
        console.log('User profile updated successfully');
        return true;
    } catch (error) {
        console.error('Error updating user profile:', error);
        throw error;
    }
}

// Posts Operations (Business Ideas, Investment Proposals, etc.)
export async function createPost(postData) {
    try {
        const postsRef = collection(db, 'posts');
        const docRef = await addDoc(postsRef, {
            ...postData,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            status: 'active',
            views: 0,
            responses: 0
        });
        
        await logActivity('post_created', { 
            postId: docRef.id, 
            type: postData.type,
            userId: postData.userId 
        });
        
        console.log('Post created successfully:', docRef.id);
        return docRef.id;
    } catch (error) {
        console.error('Error creating post:', error);
        throw error;
    }
}

export async function getPosts(filters = {}) {
    try {
        let q = collection(db, 'posts');
        
        // Apply filters
        const constraints = [where('status', '==', 'active')];
        
        if (filters.type) {
            constraints.push(where('type', '==', filters.type));
        }
        
        if (filters.category) {
            constraints.push(where('category', '==', filters.category));
        }
        
        if (filters.userId) {
            constraints.push(where('userId', '==', filters.userId));
        }
        
        // Add ordering
        constraints.push(orderBy('createdAt', 'desc'));
        
        if (filters.limit) {
            constraints.push(limit(filters.limit));
        }
        
        q = query(q, ...constraints);
        
        const querySnapshot = await getDocs(q);
        const posts = [];
        
        querySnapshot.forEach((doc) => {
            posts.push({ id: doc.id, ...doc.data() });
        });
        
        return posts;
    } catch (error) {
        console.error('Error fetching posts:', error);
        throw error;
    }
}

export async function getPost(postId) {
    try {
        const postRef = doc(db, 'posts', postId);
        const postSnap = await getDoc(postRef);
        
        if (postSnap.exists()) {
            // Increment view count
            await updateDoc(postRef, {
                views: (postSnap.data().views || 0) + 1
            });
            
            return { id: postSnap.id, ...postSnap.data() };
        } else {
            console.log('No post found');
            return null;
        }
    } catch (error) {
        console.error('Error fetching post:', error);
        throw error;
    }
}

export async function updatePost(postId, updateData) {
    try {
        const postRef = doc(db, 'posts', postId);
        await updateDoc(postRef, {
            ...updateData,
            updatedAt: serverTimestamp()
        });
        
        await logActivity('post_updated', { postId });
        console.log('Post updated successfully');
        return true;
    } catch (error) {
        console.error('Error updating post:', error);
        throw error;
    }
}

export async function deletePost(postId) {
    try {
        const postRef = doc(db, 'posts', postId);
        await updateDoc(postRef, {
            status: 'deleted',
            deletedAt: serverTimestamp()
        });
        
        await logActivity('post_deleted', { postId });
        console.log('Post deleted successfully');
        return true;
    } catch (error) {
        console.error('Error deleting post:', error);
        throw error;
    }
}

// Messages/Conversations Operations
export async function createConversation(participants, initialMessage) {
    try {
        const conversationsRef = collection(db, 'conversations');
        const docRef = await addDoc(conversationsRef, {
            participants: participants,
            lastMessage: initialMessage,
            lastMessageTime: serverTimestamp(),
            createdAt: serverTimestamp(),
            status: 'active'
        });
        
        // Add the initial message
        await addMessage(docRef.id, initialMessage);
        
        await logActivity('conversation_created', { 
            conversationId: docRef.id,
            participants 
        });
        
        console.log('Conversation created successfully:', docRef.id);
        return docRef.id;
    } catch (error) {
        console.error('Error creating conversation:', error);
        throw error;
    }
}

export async function getConversations(userId) {
    try {
        const q = query(
            collection(db, 'conversations'),
            where('participants', 'array-contains', userId),
            where('status', '==', 'active'),
            orderBy('lastMessageTime', 'desc')
        );
        
        const querySnapshot = await getDocs(q);
        const conversations = [];
        
        querySnapshot.forEach((doc) => {
            conversations.push({ id: doc.id, ...doc.data() });
        });
        
        return conversations;
    } catch (error) {
        console.error('Error fetching conversations:', error);
        throw error;
    }
}

export async function addMessage(conversationId, messageData) {
    try {
        const messagesRef = collection(db, 'conversations', conversationId, 'messages');
        const docRef = await addDoc(messagesRef, {
            ...messageData,
            createdAt: serverTimestamp(),
            status: 'sent'
        });
        
        // Update conversation last message
        const conversationRef = doc(db, 'conversations', conversationId);
        await updateDoc(conversationRef, {
            lastMessage: messageData.text,
            lastMessageTime: serverTimestamp()
        });
        
        await logActivity('message_sent', { 
            conversationId,
            messageId: docRef.id,
            senderId: messageData.senderId
        });
        
        console.log('Message added successfully:', docRef.id);
        return docRef.id;
    } catch (error) {
        console.error('Error adding message:', error);
        throw error;
    }
}

export async function getMessages(conversationId) {
    try {
        const q = query(
            collection(db, 'conversations', conversationId, 'messages'),
            orderBy('createdAt', 'asc')
        );
        
        const querySnapshot = await getDocs(q);
        const messages = [];
        
        querySnapshot.forEach((doc) => {
            messages.push({ id: doc.id, ...doc.data() });
        });
        
        return messages;
    } catch (error) {
        console.error('Error fetching messages:', error);
        throw error;
    }
}

// Real-time listeners
export function subscribeToConversations(userId, callback) {
    try {
        const q = query(
            collection(db, 'conversations'),
            where('participants', 'array-contains', userId),
            where('status', '==', 'active'),
            orderBy('lastMessageTime', 'desc')
        );
        
        return onSnapshot(q, (querySnapshot) => {
            const conversations = [];
            querySnapshot.forEach((doc) => {
                conversations.push({ id: doc.id, ...doc.data() });
            });
            callback(conversations);
        });
    } catch (error) {
        console.error('Error subscribing to conversations:', error);
        throw error;
    }
}

export function subscribeToMessages(conversationId, callback) {
    try {
        const q = query(
            collection(db, 'conversations', conversationId, 'messages'),
            orderBy('createdAt', 'asc')
        );
        
        return onSnapshot(q, (querySnapshot) => {
            const messages = [];
            querySnapshot.forEach((doc) => {
                messages.push({ id: doc.id, ...doc.data() });
            });
            callback(messages);
        });
    } catch (error) {
        console.error('Error subscribing to messages:', error);
        throw error;
    }
}

// Analytics and Stats
export async function getUserStats(userId) {
    try {
        const stats = {
            posts: 0,
            views: 0,
            connections: 0,
            rating: 0.0
        };
        
        // Get user posts count
        const postsQuery = query(
            collection(db, 'posts'),
            where('userId', '==', userId),
            where('status', '==', 'active')
        );
        const postsSnapshot = await getDocs(postsQuery);
        stats.posts = postsSnapshot.size;
        
        // Calculate total views
        let totalViews = 0;
        postsSnapshot.forEach((doc) => {
            totalViews += doc.data().views || 0;
        });
        stats.views = totalViews;
        
        // Get connections count (conversations)
        const conversationsQuery = query(
            collection(db, 'conversations'),
            where('participants', 'array-contains', userId),
            where('status', '==', 'active')
        );
        const conversationsSnapshot = await getDocs(conversationsQuery);
        stats.connections = conversationsSnapshot.size;
        
        return stats;
    } catch (error) {
        console.error('Error fetching user stats:', error);
        throw error;
    }
}

// Search functionality
export async function searchPosts(searchTerm, filters = {}) {
    try {
        // Note: Firestore doesn't support full-text search natively
        // This is a basic implementation that searches in titles
        // For production, consider using Algolia or similar service
        
        const posts = await getPosts(filters);
        
        if (!searchTerm) {
            return posts;
        }
        
        const searchResults = posts.filter(post => {
            const titleMatch = post.title.toLowerCase().includes(searchTerm.toLowerCase());
            const descMatch = post.description.toLowerCase().includes(searchTerm.toLowerCase());
            const categoryMatch = post.category.toLowerCase().includes(searchTerm.toLowerCase());
            
            return titleMatch || descMatch || categoryMatch;
        });
        
        await logActivity('search_performed', { 
            searchTerm,
            resultsCount: searchResults.length 
        });
        
        return searchResults;
    } catch (error) {
        console.error('Error searching posts:', error);
        throw error;
    }
}

// Category management
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

// Utility functions
export function formatTimestamp(timestamp) {
    if (!timestamp) return 'Unknown';
    
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
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
