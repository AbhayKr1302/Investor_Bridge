#!/usr/bin/env python3
"""
API server for StartupBridge platform with PostgreSQL backend
"""
import os
import json
import psycopg2
from psycopg2.extras import RealDictCursor
from flask import Flask, jsonify, request
from flask_cors import CORS
from datetime import datetime

app = Flask(__name__)
CORS(app)

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

def log_activity(user_id, action, data=None, level='INFO', user_agent=None, url=None, session_id=None):
    """Log user activity to database"""
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("""
            INSERT INTO activity_logs (user_id, action, data, level, user_agent, url, session_id)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
        """, (user_id, action, json.dumps(data) if data else None, level, user_agent, url, session_id))
        conn.commit()
        cur.close()
        conn.close()
    except Exception as e:
        print(f"Error logging activity: {e}")

# User Management Endpoints
@app.route('/api/users', methods=['POST'])
def create_user():
    """Create or update user profile"""
    try:
        data = request.json
        firebase_uid = data.get('firebase_uid')
        email = data.get('email')
        name = data.get('name')
        role = data.get('role')
        company = data.get('company', '')
        bio = data.get('bio', '')
        location = data.get('location', '')
        
        conn = get_db_connection()
        cur = conn.cursor()
        
        # Upsert user
        cur.execute("""
            INSERT INTO users (firebase_uid, email, name, role, company, bio, location)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (firebase_uid) 
            DO UPDATE SET
                email = EXCLUDED.email,
                name = EXCLUDED.name,
                role = EXCLUDED.role,
                company = EXCLUDED.company,
                bio = EXCLUDED.bio,
                location = EXCLUDED.location,
                updated_at = CURRENT_TIMESTAMP
            RETURNING id, firebase_uid, email, name, role, company, bio, location, profile_views, connections, rating, created_at, updated_at
        """, (firebase_uid, email, name, role, company, bio, location))
        
        user = cur.fetchone()
        conn.commit()
        cur.close()
        conn.close()
        
        log_activity(user['id'], 'user_profile_created', {'email': email, 'role': role})
        
        return jsonify({
            'success': True,
            'user': dict(user)
        })
        
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/users/<firebase_uid>', methods=['GET'])
def get_user(firebase_uid):
    """Get user profile by Firebase UID"""
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        
        cur.execute("""
            SELECT id, firebase_uid, email, name, role, company, bio, location, 
                   profile_views, connections, rating, created_at, updated_at
            FROM users 
            WHERE firebase_uid = %s
        """, (firebase_uid,))
        
        user = cur.fetchone()
        cur.close()
        conn.close()
        
        if user:
            return jsonify({
                'success': True,
                'user': dict(user)
            })
        else:
            return jsonify({'success': False, 'error': 'User not found'}), 404
            
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/users/<firebase_uid>/stats', methods=['GET'])
def get_user_stats(firebase_uid):
    """Get user statistics"""
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        
        # Get user ID
        cur.execute("SELECT id FROM users WHERE firebase_uid = %s", (firebase_uid,))
        user_result = cur.fetchone()
        if not user_result:
            return jsonify({'success': False, 'error': 'User not found'}), 404
        
        user_id = user_result['id']
        
        # Get post count
        cur.execute("SELECT COUNT(*) as count FROM posts WHERE user_id = %s AND status = 'active'", (user_id,))
        posts_count = cur.fetchone()['count']
        
        # Get total views
        cur.execute("SELECT COALESCE(SUM(views), 0) as total_views FROM posts WHERE user_id = %s", (user_id,))
        total_views = cur.fetchone()['total_views']
        
        # Get connections count
        cur.execute("""
            SELECT COUNT(*) as count FROM user_connections 
            WHERE (user1_id = %s OR user2_id = %s) AND status = 'accepted'
        """, (user_id, user_id))
        connections_count = cur.fetchone()['count']
        
        cur.close()
        conn.close()
        
        return jsonify({
            'success': True,
            'stats': {
                'posts': posts_count,
                'views': total_views,
                'connections': connections_count,
                'rating': 4.5  # Default rating for now
            }
        })
        
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

# Posts Management Endpoints
@app.route('/api/posts', methods=['POST'])
def create_post():
    """Create a new post"""
    try:
        data = request.json
        firebase_uid = data.get('firebase_uid')
        
        # Get user ID
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("SELECT id FROM users WHERE firebase_uid = %s", (firebase_uid,))
        user_result = cur.fetchone()
        if not user_result:
            return jsonify({'success': False, 'error': 'User not found'}), 404
        
        user_id = user_result['id']
        
        # Create post
        cur.execute("""
            INSERT INTO posts (user_id, type, title, description, category, funding_amount, loan_amount, interest_rate)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            RETURNING id, type, title, description, category, funding_amount, loan_amount, interest_rate, status, views, created_at
        """, (
            user_id,
            data.get('type'),
            data.get('title'),
            data.get('description'),
            data.get('category'),
            data.get('funding_amount'),
            data.get('loan_amount'),
            data.get('interest_rate')
        ))
        
        post = cur.fetchone()
        conn.commit()
        cur.close()
        conn.close()
        
        log_activity(user_id, 'post_created', {'post_id': post['id'], 'type': post['type']})
        
        return jsonify({
            'success': True,
            'post': dict(post)
        })
        
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/posts', methods=['GET'])
def get_posts():
    """Get posts with filters"""
    try:
        post_type = request.args.get('type')
        category = request.args.get('category')
        user_firebase_uid = request.args.get('user_firebase_uid')
        limit = int(request.args.get('limit', 20))
        search = request.args.get('search', '')
        
        conn = get_db_connection()
        cur = conn.cursor()
        
        # Build query
        query = """
            SELECT p.id, p.type, p.title, p.description, p.category, p.funding_amount, 
                   p.loan_amount, p.interest_rate, p.status, p.views, p.responses, p.created_at,
                   u.name as user_name, u.email as user_email, u.company as user_company
            FROM posts p
            JOIN users u ON p.user_id = u.id
            WHERE p.status = 'active'
        """
        params = []
        
        if post_type:
            query += " AND p.type = %s"
            params.append(post_type)
        
        if category:
            query += " AND p.category = %s"
            params.append(category)
        
        if user_firebase_uid:
            query += " AND u.firebase_uid = %s"
            params.append(user_firebase_uid)
        
        if search:
            query += " AND (p.title ILIKE %s OR p.description ILIKE %s OR p.category ILIKE %s)"
            search_param = f"%{search}%"
            params.extend([search_param, search_param, search_param])
        
        query += " ORDER BY p.created_at DESC LIMIT %s"
        params.append(limit)
        
        cur.execute(query, params)
        posts = cur.fetchall()
        cur.close()
        conn.close()
        
        return jsonify({
            'success': True,
            'posts': [dict(post) for post in posts]
        })
        
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/posts/<int:post_id>', methods=['GET'])
def get_post(post_id):
    """Get single post and increment view count"""
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        
        # Increment view count
        cur.execute("UPDATE posts SET views = views + 1 WHERE id = %s", (post_id,))
        
        # Get post details
        cur.execute("""
            SELECT p.id, p.type, p.title, p.description, p.category, p.funding_amount, 
                   p.loan_amount, p.interest_rate, p.status, p.views, p.responses, p.created_at,
                   u.name as user_name, u.email as user_email, u.company as user_company, u.firebase_uid
            FROM posts p
            JOIN users u ON p.user_id = u.id
            WHERE p.id = %s AND p.status = 'active'
        """, (post_id,))
        
        post = cur.fetchone()
        conn.commit()
        cur.close()
        conn.close()
        
        if post:
            return jsonify({
                'success': True,
                'post': dict(post)
            })
        else:
            return jsonify({'success': False, 'error': 'Post not found'}), 404
            
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

# Messaging Endpoints
@app.route('/api/conversations', methods=['POST'])
def create_conversation():
    """Create a new conversation"""
    try:
        data = request.json
        participants_uids = data.get('participants', [])
        initial_message = data.get('initial_message')
        
        conn = get_db_connection()
        cur = conn.cursor()
        
        # Get user IDs from Firebase UIDs
        format_strings = ','.join(['%s'] * len(participants_uids))
        cur.execute(f"SELECT id FROM users WHERE firebase_uid IN ({format_strings})", participants_uids)
        user_results = cur.fetchall()
        participant_ids = [user['id'] for user in user_results]
        
        # Create conversation
        cur.execute("""
            INSERT INTO conversations (participants, last_message)
            VALUES (%s, %s)
            RETURNING id, created_at
        """, (participant_ids, initial_message))
        
        conversation = cur.fetchone()
        conversation_id = conversation['id']
        
        # Add initial message
        cur.execute("""
            INSERT INTO messages (conversation_id, sender_id, text)
            VALUES (%s, %s, %s)
            RETURNING id, created_at
        """, (conversation_id, participant_ids[0], initial_message))
        
        message = cur.fetchone()
        conn.commit()
        cur.close()
        conn.close()
        
        return jsonify({
            'success': True,
            'conversation_id': conversation_id,
            'message_id': message['id']
        })
        
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/conversations/<firebase_uid>', methods=['GET'])
def get_conversations(firebase_uid):
    """Get user's conversations"""
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        
        # Get user ID
        cur.execute("SELECT id FROM users WHERE firebase_uid = %s", (firebase_uid,))
        user_result = cur.fetchone()
        if not user_result:
            return jsonify({'success': False, 'error': 'User not found'}), 404
        
        user_id = user_result['id']
        
        # Get conversations
        cur.execute("""
            SELECT c.id, c.last_message, c.last_message_time, c.created_at,
                   array_agg(u.name) as participant_names,
                   array_agg(u.firebase_uid) as participant_uids
            FROM conversations c
            JOIN users u ON u.id = ANY(c.participants)
            WHERE %s = ANY(c.participants) AND c.status = 'active'
            GROUP BY c.id, c.last_message, c.last_message_time, c.created_at
            ORDER BY c.last_message_time DESC
        """, (user_id,))
        
        conversations = cur.fetchall()
        cur.close()
        conn.close()
        
        return jsonify({
            'success': True,
            'conversations': [dict(conv) for conv in conversations]
        })
        
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/conversations/<int:conversation_id>/messages', methods=['GET'])
def get_messages(conversation_id):
    """Get messages for a conversation"""
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        
        cur.execute("""
            SELECT m.id, m.text, m.status, m.created_at,
                   u.name as sender_name, u.firebase_uid as sender_uid
            FROM messages m
            JOIN users u ON m.sender_id = u.id
            WHERE m.conversation_id = %s
            ORDER BY m.created_at ASC
        """, (conversation_id,))
        
        messages = cur.fetchall()
        cur.close()
        conn.close()
        
        return jsonify({
            'success': True,
            'messages': [dict(msg) for msg in messages]
        })
        
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/conversations/<int:conversation_id>/messages', methods=['POST'])
def add_message(conversation_id):
    """Add a message to conversation"""
    try:
        data = request.json
        firebase_uid = data.get('firebase_uid')
        text = data.get('text')
        
        conn = get_db_connection()
        cur = conn.cursor()
        
        # Get sender ID
        cur.execute("SELECT id FROM users WHERE firebase_uid = %s", (firebase_uid,))
        user_result = cur.fetchone()
        if not user_result:
            return jsonify({'success': False, 'error': 'User not found'}), 404
        
        sender_id = user_result['id']
        
        # Add message
        cur.execute("""
            INSERT INTO messages (conversation_id, sender_id, text)
            VALUES (%s, %s, %s)
            RETURNING id, created_at
        """, (conversation_id, sender_id, text))
        
        message = cur.fetchone()
        
        # Update conversation last message
        cur.execute("""
            UPDATE conversations 
            SET last_message = %s, last_message_time = CURRENT_TIMESTAMP
            WHERE id = %s
        """, (text, conversation_id))
        
        conn.commit()
        cur.close()
        conn.close()
        
        return jsonify({
            'success': True,
            'message_id': message['id']
        })
        
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

# Activity Logging Endpoint
@app.route('/api/activity', methods=['POST'])
def log_user_activity():
    """Log user activity"""
    try:
        data = request.json
        firebase_uid = data.get('firebase_uid')
        action = data.get('action')
        activity_data = data.get('data')
        level = data.get('level', 'INFO')
        
        # Get user ID if provided
        user_id = None
        if firebase_uid:
            conn = get_db_connection()
            cur = conn.cursor()
            cur.execute("SELECT id FROM users WHERE firebase_uid = %s", (firebase_uid,))
            user_result = cur.fetchone()
            if user_result:
                user_id = user_result['id']
            cur.close()
            conn.close()
        
        log_activity(
            user_id, 
            action, 
            activity_data, 
            level,
            request.headers.get('User-Agent'),
            request.headers.get('Referer'),
            data.get('session_id')
        )
        
        return jsonify({'success': True})
        
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=3000, debug=True)