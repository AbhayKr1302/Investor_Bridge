// Dashboard management and UI interactions
import authManager from './auth.js';
import { 
    getPosts, 
    createPost, 
    getUserStats,
    searchPosts,
    getBusinessCategories,
    formatTimestamp,
    formatCurrency,
    getConversations,
    addMessage,
    createConversation,
    subscribeToConversations,
    subscribeToMessages,
    updateUserProfile
} from './database.js';
import { logActivity, logUserAction } from './logger.js';

class DashboardManager {
    constructor() {
        this.currentSection = 'overview';
        this.currentConversation = null;
        this.conversationListeners = new Map();
        this.setupEventListeners();
    }

    // Setup all dashboard event listeners
    setupEventListeners() {
        // Dashboard navigation
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('nav-btn')) {
                const section = e.target.getAttribute('data-section');
                this.switchSection(section);
            }
        });

        // Post form handling
        const postForm = document.getElementById('post-form');
        if (postForm) {
            postForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handlePostSubmission();
            });
        }

        // Post type change handling
        const postType = document.getElementById('post-type');
        if (postType) {
            postType.addEventListener('change', (e) => {
                this.updatePostFormFields(e.target.value);
            });
        }

        // Search functionality
        const searchBtn = document.getElementById('search-btn');
        if (searchBtn) {
            searchBtn.addEventListener('click', () => {
                this.handleSearch();
            });
        }

        // Profile form handling
        const profileForm = document.getElementById('profile-form');
        if (profileForm) {
            profileForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleProfileUpdate();
            });
        }

        // Message form handling
        const sendMessageBtn = document.getElementById('send-message');
        if (sendMessageBtn) {
            sendMessageBtn.addEventListener('click', () => {
                this.sendMessage();
            });
        }

        const messageInput = document.getElementById('message-input');
        if (messageInput) {
            messageInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.sendMessage();
                }
            });
        }
    }

    // Switch between dashboard sections
    async switchSection(section) {
        // Update navigation
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector(`[data-section="${section}"]`).classList.add('active');

        // Update content
        document.querySelectorAll('.dashboard-content').forEach(content => {
            content.style.display = 'none';
        });
        document.getElementById(`${section}-section`).style.display = 'block';

        this.currentSection = section;

        // Load section-specific data
        switch (section) {
            case 'overview':
                await this.loadOverview();
                break;
            case 'browse':
                await this.loadBrowseSection();
                break;
            case 'post':
                this.setupPostForm();
                break;
            case 'messages':
                await this.loadMessages();
                break;
            case 'profile':
                this.loadProfile();
                break;
        }

        await logUserAction('section_view', { section });
    }

    // Load overview section data
    async loadOverview() {
        try {
            const user = authManager.getCurrentUser();
            if (!user) return;

            const stats = await getUserStats(user.uid);
            
            // Update stats display
            document.getElementById('views-count').textContent = stats.views;
            document.getElementById('connections-count').textContent = stats.connections;
            document.getElementById('rating').textContent = stats.rating.toFixed(1);

            // Load recent activity
            await this.loadRecentActivity(user.uid);

        } catch (error) {
            console.error('Error loading overview:', error);
            this.showError('Failed to load dashboard overview');
        }
    }

    // Load recent activity
    async loadRecentActivity(userId) {
        try {
            // Get user's recent posts
            const posts = await getPosts({ userId, limit: 5 });
            const activityList = document.getElementById('activity-list');

            if (posts.length === 0) {
                activityList.innerHTML = '<p class="empty-state">No recent activity</p>';
                return;
            }

            const activityHTML = posts.map(post => `
                <div class="activity-item">
                    <i class="fas fa-plus"></i>
                    <div>
                        <p>Posted: ${post.title}</p>
                        <small class="time">${formatTimestamp(post.createdAt)}</small>
                    </div>
                </div>
            `).join('');

            activityList.innerHTML = activityHTML;

        } catch (error) {
            console.error('Error loading recent activity:', error);
        }
    }

    // Load browse section
    async loadBrowseSection() {
        try {
            const userProfile = authManager.getUserProfile();
            const userRole = userProfile?.role;

            // Determine what to show based on user role
            let postTypes = [];
            switch (userRole) {
                case 'investor':
                    postTypes = ['business-idea'];
                    break;
                case 'entrepreneur':
                    postTypes = ['investment-proposal', 'loan-offer', 'advisory-service'];
                    break;
                case 'banker':
                    postTypes = ['business-idea'];
                    break;
                case 'advisor':
                    postTypes = ['business-idea'];
                    break;
                default:
                    postTypes = ['business-idea', 'investment-proposal', 'loan-offer', 'advisory-service'];
            }

            // Load posts for each type
            const allPosts = [];
            for (const type of postTypes) {
                const posts = await getPosts({ type, limit: 20 });
                allPosts.push(...posts);
            }

            // Sort by creation date
            allPosts.sort((a, b) => {
                const dateA = a.createdAt?.toDate?.() || new Date(a.createdAt);
                const dateB = b.createdAt?.toDate?.() || new Date(b.createdAt);
                return dateB - dateA;
            });

            this.displayBrowseResults(allPosts);

        } catch (error) {
            console.error('Error loading browse section:', error);
            this.showError('Failed to load browse data');
        }
    }

    // Display browse results
    displayBrowseResults(posts) {
        const resultsContainer = document.getElementById('browse-results');

        if (posts.length === 0) {
            resultsContainer.innerHTML = '<p class="empty-state">No posts found</p>';
            return;
        }

        const postsHTML = posts.map(post => {
            const typeLabels = {
                'business-idea': 'Business Idea',
                'investment-proposal': 'Investment Proposal',
                'loan-offer': 'Loan Offer',
                'advisory-service': 'Advisory Service'
            };

            return `
                <div class="browse-item">
                    <div class="category">${typeLabels[post.type] || post.type}</div>
                    <h4>${post.title}</h4>
                    <p>${post.description.substring(0, 150)}${post.description.length > 150 ? '...' : ''}</p>
                    ${post.fundingAmount ? `<p><strong>Funding: ${formatCurrency(post.fundingAmount)}</strong></p>` : ''}
                    ${post.loanAmount ? `<p><strong>Loan: ${formatCurrency(post.loanAmount)} at ${post.interestRate}%</strong></p>` : ''}
                    <div class="meta">
                        <span><i class="fas fa-calendar"></i> ${formatTimestamp(post.createdAt)}</span>
                        <span><i class="fas fa-eye"></i> ${post.views || 0} views</span>
                        <span><i class="fas fa-tag"></i> ${post.category}</span>
                    </div>
                    <div class="actions">
                        <button class="btn-small btn-view" onclick="dashboardManager.viewPost('${post.id}')">View Details</button>
                        <button class="btn-small btn-contact" onclick="dashboardManager.contactUser('${post.userId}', '${post.id}')">Contact</button>
                    </div>
                </div>
            `;
        }).join('');

        resultsContainer.innerHTML = postsHTML;
    }

    // Handle search
    async handleSearch() {
        try {
            const searchTerm = document.getElementById('search-input').value;
            const categoryFilter = document.getElementById('category-filter').value;

            const filters = {};
            if (categoryFilter) {
                filters.category = categoryFilter;
            }

            const results = await searchPosts(searchTerm, filters);
            this.displayBrowseResults(results);

        } catch (error) {
            console.error('Error performing search:', error);
            this.showError('Search failed. Please try again.');
        }
    }

    // Setup post form based on user role
    setupPostForm() {
        const userProfile = authManager.getUserProfile();
        const userRole = userProfile?.role;
        const postTypeSelect = document.getElementById('post-type');

        // Clear existing options
        postTypeSelect.innerHTML = '<option value="">Select type</option>';

        // Add role-specific options
        const roleOptions = {
            entrepreneur: [
                { value: 'business-idea', text: 'Business Idea' }
            ],
            investor: [
                { value: 'investment-proposal', text: 'Investment Proposal' }
            ],
            banker: [
                { value: 'loan-offer', text: 'Loan Offer' }
            ],
            advisor: [
                { value: 'advisory-service', text: 'Advisory Service' }
            ]
        };

        const options = roleOptions[userRole] || [];
        options.forEach(option => {
            const optionElement = document.createElement('option');
            optionElement.value = option.value;
            optionElement.textContent = option.text;
            postTypeSelect.appendChild(optionElement);
        });
    }

    // Update post form fields based on type
    updatePostFormFields(postType) {
        const fundingGroup = document.getElementById('funding-amount-group');
        const loanGroup = document.getElementById('loan-details-group');

        // Hide all conditional fields
        fundingGroup.style.display = 'none';
        loanGroup.style.display = 'none';

        // Show relevant fields based on post type
        switch (postType) {
            case 'business-idea':
            case 'investment-proposal':
                fundingGroup.style.display = 'block';
                break;
            case 'loan-offer':
                loanGroup.style.display = 'block';
                break;
        }
    }

    // Handle post submission
    async handlePostSubmission() {
        try {
            const user = authManager.getCurrentUser();
            if (!user) return;

            const formData = {
                type: document.getElementById('post-type').value,
                title: document.getElementById('post-title-input').value,
                category: document.getElementById('post-category').value,
                description: document.getElementById('post-description').value,
                userId: user.uid,
                userEmail: user.email
            };

            // Add conditional fields
            const fundingAmount = document.getElementById('funding-amount').value;
            if (fundingAmount) {
                formData.fundingAmount = parseInt(fundingAmount);
            }

            const interestRate = document.getElementById('interest-rate').value;
            const loanAmount = document.getElementById('loan-amount').value;
            if (interestRate && loanAmount) {
                formData.interestRate = parseFloat(interestRate);
                formData.loanAmount = parseInt(loanAmount);
            }

            const postId = await createPost(formData);
            
            this.showSuccess('Post created successfully!');
            document.getElementById('post-form').reset();

            // Switch to browse section to see the new post
            this.switchSection('browse');

        } catch (error) {
            console.error('Error creating post:', error);
            this.showError('Failed to create post. Please try again.');
        }
    }

    // Load messages section
    async loadMessages() {
        try {
            const user = authManager.getCurrentUser();
            if (!user) return;

            // Subscribe to conversations
            const unsubscribe = subscribeToConversations(user.uid, (conversations) => {
                this.displayConversations(conversations);
            });

            // Store unsubscribe function for cleanup
            this.conversationListeners.set('conversations', unsubscribe);

        } catch (error) {
            console.error('Error loading messages:', error);
            this.showError('Failed to load messages');
        }
    }

    // Display conversations list
    displayConversations(conversations) {
        const conversationsContainer = document.getElementById('conversations');

        if (conversations.length === 0) {
            conversationsContainer.innerHTML = '<p class="empty-state">No conversations yet</p>';
            return;
        }

        const conversationsHTML = conversations.map(conv => {
            const otherParticipant = conv.participants.find(p => p !== authManager.getCurrentUser().uid);
            return `
                <div class="conversation-item" data-conversation-id="${conv.id}" onclick="dashboardManager.openConversation('${conv.id}')">
                    <h5>${otherParticipant}</h5>
                    <p>${conv.lastMessage}</p>
                    <small>${formatTimestamp(conv.lastMessageTime)}</small>
                </div>
            `;
        }).join('');

        conversationsContainer.innerHTML = conversationsHTML;
    }

    // Open a conversation
    async openConversation(conversationId) {
        try {
            this.currentConversation = conversationId;

            // Update UI
            document.querySelectorAll('.conversation-item').forEach(item => {
                item.classList.remove('active');
            });
            document.querySelector(`[data-conversation-id="${conversationId}"]`).classList.add('active');

            // Show message form
            document.getElementById('message-header').style.display = 'block';
            document.getElementById('message-form').style.display = 'flex';

            // Subscribe to messages
            if (this.conversationListeners.has(conversationId)) {
                this.conversationListeners.get(conversationId)();
            }

            const unsubscribe = subscribeToMessages(conversationId, (messages) => {
                this.displayMessages(messages);
            });

            this.conversationListeners.set(conversationId, unsubscribe);

        } catch (error) {
            console.error('Error opening conversation:', error);
            this.showError('Failed to load conversation');
        }
    }

    // Display messages in conversation
    displayMessages(messages) {
        const messagesList = document.getElementById('messages-list');
        const currentUserId = authManager.getCurrentUser().uid;

        if (messages.length === 0) {
            messagesList.innerHTML = '<p class="empty-state">No messages yet</p>';
            return;
        }

        const messagesHTML = messages.map(message => {
            const isOwn = message.senderId === currentUserId;
            return `
                <div class="message ${isOwn ? 'own' : 'other'}">
                    <p>${message.text}</p>
                    <small>${formatTimestamp(message.createdAt)}</small>
                </div>
            `;
        }).join('');

        messagesList.innerHTML = messagesHTML;
        messagesList.scrollTop = messagesList.scrollHeight;
    }

    // Send message
    async sendMessage() {
        try {
            const messageInput = document.getElementById('message-input');
            const messageText = messageInput.value.trim();

            if (!messageText || !this.currentConversation) return;

            const user = authManager.getCurrentUser();
            const messageData = {
                text: messageText,
                senderId: user.uid,
                senderEmail: user.email
            };

            await addMessage(this.currentConversation, messageData);
            messageInput.value = '';

        } catch (error) {
            console.error('Error sending message:', error);
            this.showError('Failed to send message');
        }
    }

    // Contact a user (start conversation)
    async contactUser(userId, postId) {
        try {
            const currentUser = authManager.getCurrentUser();
            if (!currentUser) return;

            const participants = [currentUser.uid, userId];
            const initialMessage = {
                text: `Hi! I'm interested in your post.`,
                senderId: currentUser.uid,
                senderEmail: currentUser.email
            };

            const conversationId = await createConversation(participants, initialMessage);
            
            // Switch to messages section
            this.switchSection('messages');
            
            // Open the new conversation
            setTimeout(() => {
                this.openConversation(conversationId);
            }, 1000);

        } catch (error) {
            console.error('Error contacting user:', error);
            this.showError('Failed to start conversation');
        }
    }

    // View post details (placeholder)
    async viewPost(postId) {
        // This would open a modal or navigate to a detailed view
        console.log('Viewing post:', postId);
        await logUserAction('post_view', { postId });
    }

    // Load profile section
    loadProfile() {
        const userProfile = authManager.getUserProfile();
        const user = authManager.getCurrentUser();

        if (userProfile && user) {
            document.getElementById('profile-name').value = userProfile.name || '';
            document.getElementById('profile-email').value = user.email || '';
            document.getElementById('profile-role').value = userProfile.role || '';
            document.getElementById('profile-company').value = userProfile.company || '';
            document.getElementById('profile-bio').value = userProfile.bio || '';
            document.getElementById('profile-location').value = userProfile.location || '';
        }
    }

    // Handle profile update
    async handleProfileUpdate() {
        try {
            const user = authManager.getCurrentUser();
            if (!user) return;

            const updateData = {
                name: document.getElementById('profile-name').value,
                company: document.getElementById('profile-company').value,
                bio: document.getElementById('profile-bio').value,
                location: document.getElementById('profile-location').value
            };

            await updateUserProfile(user.uid, updateData);
            this.showSuccess('Profile updated successfully!');

        } catch (error) {
            console.error('Error updating profile:', error);
            this.showError('Failed to update profile');
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

    // Cleanup listeners when switching sections
    cleanup() {
        this.conversationListeners.forEach(unsubscribe => {
            if (typeof unsubscribe === 'function') {
                unsubscribe();
            }
        });
        this.conversationListeners.clear();
    }
}

// Create and export dashboard manager instance
const dashboardManager = new DashboardManager();

// Make it globally available for onclick handlers
window.dashboardManager = dashboardManager;

export default dashboardManager;
