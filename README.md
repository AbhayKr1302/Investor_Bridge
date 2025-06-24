# StartupBridge - Investor & Entrepreneur Matchmaking Platform

StartupBridge is a comprehensive web-based platform that connects investors, entrepreneurs, bankers, and business advisors in India. Built with modern web technologies and Firebase backend, it provides a secure and efficient way for startups to find funding and guidance.

## 🚀 Features

### Multi-Role User System
- **Investors**: Browse and evaluate business proposals, connect with entrepreneurs
- **Entrepreneurs**: Submit business ideas, seek funding and partnerships
- **Bankers**: Offer loan products and financial solutions
- **Business Advisors**: Provide consulting services and business guidance

### Core Functionality
- 🔐 Secure Firebase Authentication (Email/Password + Google Sign-in)
- 📝 Role-based post creation and browsing
- 💬 Real-time messaging system
- 🔍 Advanced search and filtering
- 📊 Dashboard with analytics and insights
- 📱 Responsive design for all devices
- 📈 Comprehensive activity logging

## 🛠 Tech Stack

### Frontend
- **HTML5, CSS3, JavaScript (ES6+)** - Core web technologies
- **Firebase SDK** - Authentication and database operations
- **Font Awesome** - Icons and UI elements
- **Responsive CSS** - Mobile-first design approach

### Backend
- **Firebase Authentication** - User management and security
- **Firestore Database** - NoSQL document database
- **Firebase Hosting** - Web hosting and deployment

### Development Tools
- **Firebase CLI** - Deployment and project management
- **Modern JavaScript** - ES6+ features and modules
- **Git** - Version control

## 📋 Prerequisites

Before setting up the project, ensure you have:

1. **Firebase Account** - Create a free account at [Firebase Console](https://console.firebase.google.com/)
2. **Modern Web Browser** - Chrome, Firefox, Safari, or Edge
3. **Text Editor/IDE** - VS Code, WebStorm, or similar
4. **Firebase CLI** (Optional) - For deployment

## ⚙️ Firebase Setup

### 1. Create Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click "Create a project"
3. Enter project name: `startupbridge-[your-suffix]`
4. Enable Google Analytics (optional)
5. Create project

### 2. Enable Authentication

1. In Firebase Console, go to **Authentication** → **Sign-in method**
2. Enable **Email/Password** provider
3. Enable **Google** provider
4. Configure OAuth consent screen if prompted

### 3. Create Firestore Database

1. Go to **Firestore Database**
2. Click "Create database"
3. Start in **test mode** (for development)
4. Choose your preferred location

### 4. Configure Web App

1. Go to **Project Settings** → **General**
2. Click "Add app" → Web app icon (</>)
3. Register app with nickname: `StartupBridge Web`
4. Copy the configuration object

### 5. Set Up Authentication Domains

1. Go to **Authentication** → **Settings** → **Authorized domains**
2. Add your development domain (e.g., `localhost:5000`)
3. Add your production domain when deploying

## 🚀 Installation & Setup

### 1. Download/Clone the Project

```bash
# If using Git
git clone <repository-url>
cd startupbridge

# Or download and extract the ZIP file
