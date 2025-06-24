// Enhanced dashboard functionality with PostgreSQL backend
import { 
    createPost as createDBPost,
    getPosts as getDBPosts,
    searchPosts as searchDBPosts,
    getUserStats as getDBUserStats,
    logActivity as logDBActivity,
    formatTimestamp,
    formatCurrency,
    getBusinessCategories
} from './database_integration.js';

class DashboardManager {
    constructor() {
        this.currentSection = 'overview';
        this.setupEventListeners();
    }

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

        // Enter key for search
        const searchInput = document.getElementById('search-input');
        if (searchInput) {
            searchInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.handleSearch();
                }
            });
        }
    }

    async switchSection(section) {
        // Update navigation
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector(`[data-section="${section}"]`)?.classList.add('active');

        // Update content
        document.querySelectorAll('.dashboard-content').forEach(content => {
            content.style.display = 'none';
        });
        
        const sectionElement = document.getElementById(`${section}-section`);
        if (sectionElement) {
            sectionElement.style.display = 'block';
        }

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
            case 'profile':
                this.loadProfile();
                break;
        }

        if (window.startupBridge.currentUser) {
            await logDBActivity(window.startupBridge.currentUser.uid, 'section_view', { section });
        }
    }

    async loadOverview() {
        try {
            const user = window.startupBridge.currentUser;
            if (!user) return;

            const result = await getDBUserStats(user.uid);
            const stats = result.stats;
            
            // Update stats display
            document.getElementById('views-count').textContent = stats.views || 0;
            document.getElementById('connections-count').textContent = stats.connections || 0;
            document.getElementById('rating').textContent = (stats.rating || 0).toFixed(1);

            // Load recent posts as activity
            await this.loadRecentActivity(user.uid);

        } catch (error) {
            console.error('Error loading overview:', error);
            this.showError('Failed to load dashboard overview');
        }
    }

    async loadRecentActivity(firebaseUid) {
        try {
            const result = await getDBPosts({ user_firebase_uid: firebaseUid, limit: 5 });
            const posts = result.posts || [];
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
                        <small class="time">${formatTimestamp(post.created_at)}</small>
                    </div>
                </div>
            `).join('');

            activityList.innerHTML = activityHTML;

        } catch (error) {
            console.error('Error loading recent activity:', error);
        }
    }

    async loadBrowseSection() {
        try {
            const userProfile = window.startupBridge.userProfile;
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

            // Load posts for the role
            const allPosts = [];
            for (const type of postTypes) {
                try {
                    const result = await getDBPosts({ type, limit: 20 });
                    allPosts.push(...(result.posts || []));
                } catch (error) {
                    console.error(`Error loading posts of type ${type}:`, error);
                }
            }

            this.displayBrowseResults(allPosts);

        } catch (error) {
            console.error('Error loading browse section:', error);
            this.showError('Failed to load browse data');
        }
    }

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
                    ${post.funding_amount ? `<p><strong>Funding: ${formatCurrency(post.funding_amount)}</strong></p>` : ''}
                    ${post.loan_amount ? `<p><strong>Loan: ${formatCurrency(post.loan_amount)} at ${post.interest_rate}%</strong></p>` : ''}
                    <div class="meta">
                        <span><i class="fas fa-calendar"></i> ${formatTimestamp(post.created_at)}</span>
                        <span><i class="fas fa-eye"></i> ${post.views || 0} views</span>
                        <span><i class="fas fa-tag"></i> ${post.category}</span>
                        <span><i class="fas fa-user"></i> ${post.user_name}</span>
                    </div>
                    <div class="actions">
                        <button class="btn-small btn-view" onclick="window.dashboardManager.viewPost('${post.id}')">View Details</button>
                        <button class="btn-small btn-contact" onclick="window.dashboardManager.contactUser('${post.user_firebase_uid || post.user_email}', '${post.id}')">Contact</button>
                    </div>
                </div>
            `;
        }).join('');

        resultsContainer.innerHTML = postsHTML;
    }

    async handleSearch() {
        try {
            const searchTerm = document.getElementById('search-input').value;
            const categoryFilter = document.getElementById('category-filter').value;

            const filters = {};
            if (categoryFilter) {
                filters.category = categoryFilter;
            }

            const result = await searchDBPosts(searchTerm, filters);
            this.displayBrowseResults(result.posts || []);

        } catch (error) {
            console.error('Error performing search:', error);
            this.showError('Search failed. Please try again.');
        }
    }

    setupPostForm() {
        const userProfile = window.startupBridge.userProfile;
        const userRole = userProfile?.role;
        const postTypeSelect = document.getElementById('post-type');

        if (!postTypeSelect) return;

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

    updatePostFormFields(postType) {
        const fundingGroup = document.getElementById('funding-amount-group');
        const loanGroup = document.getElementById('loan-details-group');

        if (!fundingGroup || !loanGroup) return;

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

    async handlePostSubmission() {
        try {
            const user = window.startupBridge.currentUser;
            if (!user) return;

            const formData = {
                firebase_uid: user.uid,
                type: document.getElementById('post-type').value,
                title: document.getElementById('post-title-input').value,
                category: document.getElementById('post-category').value,
                description: document.getElementById('post-description').value
            };

            // Add conditional fields
            const fundingAmount = document.getElementById('funding-amount')?.value;
            if (fundingAmount) {
                formData.funding_amount = parseInt(fundingAmount);
            }

            const interestRate = document.getElementById('interest-rate')?.value;
            const loanAmount = document.getElementById('loan-amount')?.value;
            if (interestRate && loanAmount) {
                formData.interest_rate = parseFloat(interestRate);
                formData.loan_amount = parseInt(loanAmount);
            }

            const result = await createDBPost(formData);
            
            this.showSuccess('Post created successfully!');
            document.getElementById('post-form').reset();

            // Switch to browse section to see the new post
            this.switchSection('browse');

        } catch (error) {
            console.error('Error creating post:', error);
            this.showError('Failed to create post. Please try again.');
        }
    }

    async viewPost(postId) {
        try {
            const result = await getDBPosts({ post_id: postId });
            const post = result.posts?.[0];
            
            if (post) {
                // Show post details modal or navigate to detail view
                this.showPostDetails(post);
            }
        } catch (error) {
            console.error('Error viewing post:', error);
            this.showError('Failed to load post details.');
        }
    }

    showPostDetails(post) {
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.style.display = 'block';
        modal.innerHTML = `
            <div class="modal-content">
                <span class="close" onclick="this.parentElement.parentElement.remove()">&times;</span>
                <h2>${post.title}</h2>
                <div class="category">${post.type.replace('-', ' ').toUpperCase()}</div>
                <p><strong>Category:</strong> ${post.category}</p>
                <p><strong>Description:</strong></p>
                <p>${post.description}</p>
                ${post.funding_amount ? `<p><strong>Funding Amount:</strong> ${formatCurrency(post.funding_amount)}</p>` : ''}
                ${post.loan_amount ? `<p><strong>Loan Amount:</strong> ${formatCurrency(post.loan_amount)} at ${post.interest_rate}% interest</p>` : ''}
                <p><strong>Posted by:</strong> ${post.user_name} (${post.user_company || 'Individual'})</p>
                <p><strong>Views:</strong> ${post.views || 0}</p>
                <p><strong>Posted:</strong> ${formatTimestamp(post.created_at)}</p>
                <div style="margin-top: 2rem;">
                    <button class="btn-primary" onclick="window.dashboardManager.contactUser('${post.user_firebase_uid || post.user_email}', '${post.id}')">Contact User</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    }

    contactUser(userIdentifier, postId) {
        this.showSuccess('Contact feature will be implemented with messaging system');
        // TODO: Implement contact/messaging functionality
    }

    loadProfile() {
        const userProfile = window.startupBridge.userProfile;
        if (!userProfile) return;

        // Populate profile form with current data
        const profileName = document.getElementById('profile-name');
        const profileEmail = document.getElementById('profile-email');
        const profileRole = document.getElementById('profile-role');
        const profileCompany = document.getElementById('profile-company');
        const profileBio = document.getElementById('profile-bio');
        const profileLocation = document.getElementById('profile-location');

        if (profileName) profileName.value = userProfile.name || '';
        if (profileEmail) profileEmail.value = userProfile.email || '';
        if (profileRole) profileRole.value = userProfile.role || '';
        if (profileCompany) profileCompany.value = userProfile.company || '';
        if (profileBio) profileBio.value = userProfile.bio || '';
        if (profileLocation) profileLocation.value = userProfile.location || '';
    }

    showError(message) {
        const errorElement = document.getElementById('error-message');
        const errorText = document.getElementById('error-text');
        if (errorElement && errorText) {
            errorText.textContent = message;
            errorElement.style.display = 'block';
            setTimeout(() => errorElement.style.display = 'none', 5000);
        }
    }

    showSuccess(message) {
        const successElement = document.getElementById('success-message');
        const successText = document.getElementById('success-text');
        if (successElement && successText) {
            successText.textContent = message;
            successElement.style.display = 'block';
            setTimeout(() => successElement.style.display = 'none', 5000);
        }
    }
}

// Create dashboard manager instance
const dashboardManager = new DashboardManager();
window.dashboardManager = dashboardManager;

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        console.log('Enhanced dashboard with PostgreSQL backend loaded');
    });
} else {
    console.log('Enhanced dashboard with PostgreSQL backend loaded');
}

export default dashboardManager;