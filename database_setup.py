#!/usr/bin/env python3
"""
Database setup and schema creation for StartupBridge platform
"""
import os
import psycopg2
from psycopg2.extras import RealDictCursor
import json
from datetime import datetime

# Database connection
def get_db_connection():
    return psycopg2.connect(
        host=os.environ.get('PGHOST'),
        database=os.environ.get('PGDATABASE'),
        user=os.environ.get('PGUSER'),
        password=os.environ.get('PGPASSWORD'),
        port=os.environ.get('PGPORT'),
        cursor_factory=RealDictCursor
    )

def create_tables():
    """Create all necessary tables for StartupBridge"""
    conn = get_db_connection()
    cur = conn.cursor()
    
    # Users table
    cur.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id SERIAL PRIMARY KEY,
            firebase_uid VARCHAR(255) UNIQUE NOT NULL,
            email VARCHAR(255) UNIQUE NOT NULL,
            name VARCHAR(255) NOT NULL,
            role VARCHAR(50) NOT NULL CHECK (role IN ('investor', 'entrepreneur', 'banker', 'advisor')),
            company VARCHAR(255),
            bio TEXT,
            location VARCHAR(255),
            profile_views INTEGER DEFAULT 0,
            connections INTEGER DEFAULT 0,
            rating DECIMAL(3,2) DEFAULT 0.0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    
    # Posts table
    cur.execute("""
        CREATE TABLE IF NOT EXISTS posts (
            id SERIAL PRIMARY KEY,
            user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
            type VARCHAR(50) NOT NULL CHECK (type IN ('business-idea', 'investment-proposal', 'loan-offer', 'advisory-service')),
            title VARCHAR(255) NOT NULL,
            description TEXT NOT NULL,
            category VARCHAR(100) NOT NULL,
            funding_amount BIGINT,
            loan_amount BIGINT,
            interest_rate DECIMAL(5,2),
            status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'deleted')),
            views INTEGER DEFAULT 0,
            responses INTEGER DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    
    # Conversations table
    cur.execute("""
        CREATE TABLE IF NOT EXISTS conversations (
            id SERIAL PRIMARY KEY,
            participants INTEGER[] NOT NULL,
            last_message TEXT,
            last_message_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'archived', 'deleted')),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    
    # Messages table
    cur.execute("""
        CREATE TABLE IF NOT EXISTS messages (
            id SERIAL PRIMARY KEY,
            conversation_id INTEGER REFERENCES conversations(id) ON DELETE CASCADE,
            sender_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
            text TEXT NOT NULL,
            status VARCHAR(20) DEFAULT 'sent' CHECK (status IN ('sent', 'delivered', 'read')),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    
    # Activity logs table
    cur.execute("""
        CREATE TABLE IF NOT EXISTS activity_logs (
            id SERIAL PRIMARY KEY,
            user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
            action VARCHAR(100) NOT NULL,
            data JSONB,
            level VARCHAR(10) DEFAULT 'INFO',
            user_agent TEXT,
            url TEXT,
            session_id VARCHAR(255),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    
    # User connections table
    cur.execute("""
        CREATE TABLE IF NOT EXISTS user_connections (
            id SERIAL PRIMARY KEY,
            user1_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
            user2_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
            status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'blocked')),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(user1_id, user2_id)
        )
    """)
    
    # Create indexes for better performance
    cur.execute("CREATE INDEX IF NOT EXISTS idx_posts_user_id ON posts(user_id)")
    cur.execute("CREATE INDEX IF NOT EXISTS idx_posts_type ON posts(type)")
    cur.execute("CREATE INDEX IF NOT EXISTS idx_posts_category ON posts(category)")
    cur.execute("CREATE INDEX IF NOT EXISTS idx_posts_status ON posts(status)")
    cur.execute("CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages(conversation_id)")
    cur.execute("CREATE INDEX IF NOT EXISTS idx_activity_logs_user_id ON activity_logs(user_id)")
    cur.execute("CREATE INDEX IF NOT EXISTS idx_activity_logs_action ON activity_logs(action)")
    cur.execute("CREATE INDEX IF NOT EXISTS idx_users_firebase_uid ON users(firebase_uid)")
    cur.execute("CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)")
    
    # Create trigger to update updated_at timestamp
    cur.execute("""
        CREATE OR REPLACE FUNCTION update_updated_at_column()
        RETURNS TRIGGER AS $$
        BEGIN
            NEW.updated_at = CURRENT_TIMESTAMP;
            RETURN NEW;
        END;
        $$ language 'plpgsql'
    """)
    
    cur.execute("""
        DROP TRIGGER IF EXISTS update_users_updated_at ON users;
        CREATE TRIGGER update_users_updated_at 
            BEFORE UPDATE ON users 
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()
    """)
    
    cur.execute("""
        DROP TRIGGER IF EXISTS update_posts_updated_at ON posts;
        CREATE TRIGGER update_posts_updated_at 
            BEFORE UPDATE ON posts 
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()
    """)
    
    conn.commit()
    cur.close()
    conn.close()
    print("Database tables created successfully!")

def seed_sample_data():
    """Add some sample data for testing"""
    conn = get_db_connection()
    cur = conn.cursor()
    
    # Check if we already have data
    cur.execute("SELECT COUNT(*) FROM users")
    user_count = cur.fetchone()['count']
    
    if user_count == 0:
        # Insert sample users
        sample_users = [
            ('firebase_uid_1', 'investor@example.com', 'John Investor', 'investor', 'InvestCorp', 'Experienced investor in tech startups', 'Mumbai'),
            ('firebase_uid_2', 'entrepreneur@example.com', 'Sarah Startup', 'entrepreneur', 'TechVenture', 'Passionate about AI and ML solutions', 'Bangalore'),
            ('firebase_uid_3', 'banker@example.com', 'Mike Finance', 'banker', 'IndiaBank', 'Corporate banking specialist', 'Delhi'),
            ('firebase_uid_4', 'advisor@example.com', 'Lisa Consultant', 'advisor', 'BizConsult', 'Business strategy consultant', 'Pune')
        ]
        
        for user_data in sample_users:
            cur.execute("""
                INSERT INTO users (firebase_uid, email, name, role, company, bio, location, profile_views, connections)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
            """, user_data + (0, 0))
        
        # Insert sample posts
        cur.execute("SELECT id FROM users WHERE role = 'entrepreneur' LIMIT 1")
        entrepreneur_id = cur.fetchone()['id']
        
        cur.execute("SELECT id FROM users WHERE role = 'investor' LIMIT 1")
        investor_id = cur.fetchone()['id']
        
        sample_posts = [
            (entrepreneur_id, 'business-idea', 'AI-Powered Healthcare Platform', 'Revolutionary AI platform for early disease detection using machine learning algorithms.', 'healthcare', 5000000, None, None),
            (entrepreneur_id, 'business-idea', 'Sustainable Agriculture App', 'Mobile application connecting farmers with sustainable farming techniques and market access.', 'agriculture', 2000000, None, None),
            (investor_id, 'investment-proposal', 'Tech Startup Investment Fund', 'Looking for promising tech startups in India for Series A funding.', 'technology', 10000000, None, None)
        ]
        
        for post_data in sample_posts:
            cur.execute("""
                INSERT INTO posts (user_id, type, title, description, category, funding_amount, loan_amount, interest_rate, views)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
            """, post_data + (0,))
        
        conn.commit()
        print("Sample data inserted successfully!")
    else:
        print("Database already has data, skipping sample data insertion.")
    
    cur.close()
    conn.close()

if __name__ == "__main__":
    try:
        create_tables()
        seed_sample_data()
        print("Database setup completed successfully!")
    except Exception as e:
        print(f"Error setting up database: {e}")