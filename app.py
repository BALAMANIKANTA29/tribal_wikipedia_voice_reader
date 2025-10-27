from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
from flask_login import LoginManager, UserMixin, login_user, logout_user, login_required, current_user
from werkzeug.security import generate_password_hash, check_password_hash
import wikipediaapi
from transformers import pipeline
from gtts import gTTS
import os
import tempfile
import sqlite3
import jwt
import datetime
from functools import wraps

app = Flask(__name__)
CORS(app)  # Enable CORS for frontend requests

# Configuration
app.config['SECRET_KEY'] = os.getenv('SECRET_KEY', 'your-secret-key-change-in-production')
app.config['JWT_SECRET_KEY'] = os.getenv('JWT_SECRET_KEY', 'jwt-secret-string')

# Initialize Login Manager
login_manager = LoginManager()
login_manager.init_app(app)
login_manager.login_view = 'login'

# User class for Flask-Login
class User(UserMixin):
    def __init__(self, id, username, email):
        self.id = id
        self.username = username
        self.email = email

@login_manager.user_loader
def load_user(user_id):
    conn = get_db_connection()
    user = conn.execute('SELECT * FROM users WHERE id = ?', (user_id,)).fetchone()
    conn.close()
    if user:
        return User(user['id'], user['username'], user['email'])
    return None

# Database setup
def init_db():
    conn = sqlite3.connect('tribal_wiki.db')
    conn.execute('''
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            preferences TEXT DEFAULT '{}'
        )
    ''')
    conn.execute('''
        CREATE TABLE IF NOT EXISTS user_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            article_title TEXT NOT NULL,
            language TEXT NOT NULL,
            summary TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users (id)
        )
    ''')
    conn.execute('''
        CREATE TABLE IF NOT EXISTS user_bookmarks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            article_title TEXT NOT NULL,
            language TEXT NOT NULL,
            summary TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users (id)
        )
    ''')
    conn.commit()
    conn.close()

def get_db_connection():
    conn = sqlite3.connect('tribal_wiki.db')
    conn.row_factory = sqlite3.Row
    return conn

# JWT token decorator
def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = request.headers.get('Authorization')
        if not token:
            return jsonify({'message': 'Token is missing!'}), 401
        try:
            if token.startswith('Bearer '):
                token = token[7:]
            data = jwt.decode(token, app.config['JWT_SECRET_KEY'], algorithms=['HS256'])
            current_user_id = data['user_id']
        except:
            return jsonify({'message': 'Token is invalid!'}), 401
        return f(current_user_id, *args, **kwargs)
    return decorated

# Initialize database
init_db()

# Initialize default Wikipedia API client; other language clients are created on demand
wiki_default = wikipediaapi.Wikipedia(
    language='en',
    extract_format=wikipediaapi.ExtractFormat.WIKI,
    user_agent='TribalWikiReader/1.0 (hackathon project)'
)

# Summarizer initialization is heavy; lazily initialize on first use.
# Optionally allow a lightweight "simple" mode via env var SUMMARY_MODE=simple
_summarizer = None
_translator_cache = {}

def get_summarizer():
    global _summarizer
    if _summarizer is None:
        model_name = os.getenv("SUMMARY_MODEL", "csebuetnlp/mT5_multilingual_XLSum")
        _summarizer = pipeline("summarization", model=model_name)
    return _summarizer

def get_wiki(lang_code: str):
    try:
        return wikipediaapi.Wikipedia(
            language=lang_code,
            extract_format=wikipediaapi.ExtractFormat.WIKI,
            user_agent='TribalWikiReader/1.0 (hackathon project)'
        )
    except Exception:
        return wiki_default

def translate_summary_if_needed(text: str, target_language: str) -> str:
    target_language = (target_language or 'english').lower()
    # Limited translation support to keep it lightweight
    try:
        if target_language == 'nepali':
            if 'nepali' not in _translator_cache:
                _translator_cache['nepali'] = pipeline('translation', model='Helsinki-NLP/opus-mt-en-ne')
            translator = _translator_cache['nepali']
            return translator(text, max_length=512)[0]['translation_text']
        if target_language == 'sanskrit':
            # Approximate via Hindi translation
            if 'hindi' not in _translator_cache:
                _translator_cache['hindi'] = pipeline('translation', model='Helsinki-NLP/opus-mt-en-hi')
            translator = _translator_cache['hindi']
            return translator(text, max_length=512)[0]['translation_text']
        if target_language == 'sindhi':
            # Approximate via Urdu translation
            if 'urdu' not in _translator_cache:
                _translator_cache['urdu'] = pipeline('translation', model='Helsinki-NLP/opus-mt-en-ur')
            translator = _translator_cache['urdu']
            return translator(text, max_length=512)[0]['translation_text']
    except Exception:
        return text
    return text

# Language codes for TTS (gTTS supports limited languages; fallback to 'en' if not supported)
language_codes = {
    'sanskrit': 'sa',  # Sanskrit (may not be supported, fallback to en)
    'nepali': 'ne',    # Nepali
    'sindhi': 'sd',    # Sindhi (may not be supported, fallback to en)
    'hindi': 'hi',     # Hindi
    'bengali': 'bn',   # Bengali
    'tamil': 'ta',     # Tamil
    'telugu': 'te',    # Telugu
    'marathi': 'mr',   # Marathi
    'gujarati': 'gu',  # Gujarati
    'kannada': 'kn',   # Kannada
    'malayalam': 'ml', # Malayalam
    'punjabi': 'pa',   # Punjabi
    'odia': 'or',      # Odia
    'assamese': 'as'   # Assamese
}

# TTS language fallbacks where gTTS lacks direct support
tts_fallbacks = {
    'sa': 'hi',  # use Hindi voice for Sanskrit content as approximation
    'sd': 'ur',  # use Urdu voice for Sindhi as approximation
    'bn': 'hi',  # Bengali fallback to Hindi if not supported
    'ta': 'hi',  # Tamil fallback to Hindi if not supported
    'te': 'hi',  # Telugu fallback to Hindi if not supported
    'mr': 'hi',  # Marathi fallback to Hindi if not supported
    'gu': 'hi',  # Gujarati fallback to Hindi if not supported
    'kn': 'hi',  # Kannada fallback to Hindi if not supported
    'ml': 'hi',  # Malayalam fallback to Hindi if not supported
    'pa': 'hi',  # Punjabi fallback to Hindi if not supported
    'or': 'hi',  # Odia fallback to Hindi if not supported
    'as': 'hi'   # Assamese fallback to Hindi if not supported
}

# Enhanced voice options
voice_options = {
    'default': {'lang': None, 'slow': False, 'tld': 'com'},
    'slow': {'lang': None, 'slow': True, 'tld': 'com'},
    'uk': {'lang': None, 'slow': False, 'tld': 'co.uk'},
    'au': {'lang': None, 'slow': False, 'tld': 'com.au'},
    'indian': {'lang': None, 'slow': False, 'tld': 'co.in'}
}

@app.route('/', methods=['GET'])
def root():
    return jsonify({
        'status': 'ok',
        'message': 'Tribal Wiki Reader backend is running',
        'endpoints': ['/scrape (POST)', '/summarize (POST)', '/tts (POST)']
    })

@app.route('/health', methods=['GET'])
def health():
    return jsonify({'status': 'healthy'})

# Authentication endpoints
@app.route('/register', methods=['POST'])
def register():
    data = request.json
    username = data.get('username')
    email = data.get('email')
    password = data.get('password')
    
    if not username or not email or not password:
        return jsonify({'error': 'Missing required fields'}), 400
    
    conn = get_db_connection()
    
    # Check if user already exists
    if conn.execute('SELECT id FROM users WHERE username = ? OR email = ?', 
                   (username, email)).fetchone():
        conn.close()
        return jsonify({'error': 'Username or email already exists'}), 400
    
    # Create new user
    password_hash = generate_password_hash(password)
    conn.execute('INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)',
                (username, email, password_hash))
    conn.commit()
    conn.close()
    
    return jsonify({'message': 'User created successfully'}), 201

@app.route('/login', methods=['POST'])
def login():
    data = request.json
    username = data.get('username')
    password = data.get('password')
    
    if not username or not password:
        return jsonify({'error': 'Missing username or password'}), 400
    
    conn = get_db_connection()
    user = conn.execute('SELECT * FROM users WHERE username = ?', (username,)).fetchone()
    conn.close()
    
    if user and check_password_hash(user['password_hash'], password):
        # Generate JWT token
        token = jwt.encode({
            'user_id': user['id'],
            'exp': datetime.datetime.utcnow() + datetime.timedelta(hours=24)
        }, app.config['JWT_SECRET_KEY'], algorithm='HS256')
        
        return jsonify({
            'token': token,
            'user': {
                'id': user['id'],
                'username': user['username'],
                'email': user['email']
            }
        }), 200
    else:
        return jsonify({'error': 'Invalid credentials'}), 401

@app.route('/user/preferences', methods=['GET', 'PUT'])
@token_required
def user_preferences(current_user_id):
    conn = get_db_connection()
    
    if request.method == 'GET':
        user = conn.execute('SELECT preferences FROM users WHERE id = ?', (current_user_id,)).fetchone()
        conn.close()
        return jsonify({'preferences': user['preferences']}), 200
    
    elif request.method == 'PUT':
        preferences = request.json.get('preferences', '{}')
        conn.execute('UPDATE users SET preferences = ? WHERE id = ?', (preferences, current_user_id))
        conn.commit()
        conn.close()
        return jsonify({'message': 'Preferences updated'}), 200

@app.route('/user/history', methods=['GET', 'POST'])
@token_required
def user_history(current_user_id):
    conn = get_db_connection()
    
    if request.method == 'GET':
        history = conn.execute(
            'SELECT * FROM user_history WHERE user_id = ? ORDER BY created_at DESC LIMIT 50',
            (current_user_id,)
        ).fetchall()
        conn.close()
        return jsonify([dict(row) for row in history]), 200
    
    elif request.method == 'POST':
        data = request.json
        conn.execute(
            'INSERT INTO user_history (user_id, article_title, language, summary) VALUES (?, ?, ?, ?)',
            (current_user_id, data['title'], data['language'], data['summary'])
        )
        conn.commit()
        conn.close()
        return jsonify({'message': 'History saved'}), 201

@app.route('/user/bookmarks', methods=['GET', 'POST', 'DELETE'])
@token_required
def user_bookmarks(current_user_id):
    conn = get_db_connection()
    
    if request.method == 'GET':
        bookmarks = conn.execute(
            'SELECT * FROM user_bookmarks WHERE user_id = ? ORDER BY created_at DESC',
            (current_user_id,)
        ).fetchall()
        conn.close()
        return jsonify([dict(row) for row in bookmarks]), 200
    
    elif request.method == 'POST':
        data = request.json
        conn.execute(
            'INSERT INTO user_bookmarks (user_id, article_title, language, summary) VALUES (?, ?, ?, ?)',
            (current_user_id, data['title'], data['language'], data['summary'])
        )
        conn.commit()
        conn.close()
        return jsonify({'message': 'Bookmark saved'}), 201
    
    elif request.method == 'DELETE':
        bookmark_id = request.json.get('id')
        conn.execute('DELETE FROM user_bookmarks WHERE id = ? AND user_id = ?', 
                    (bookmark_id, current_user_id))
        conn.commit()
        conn.close()
        return jsonify({'message': 'Bookmark deleted'}), 200

@app.route('/scrape', methods=['POST'])
@token_required
def scrape_article(current_user_id):
    data = request.json
    title = data.get('title')
    language = (data.get('language') or 'english').lower()
    section = data.get('section', 'all')  # New: section selection
    max_length = data.get('max_length', 2000)  # New: custom length

    if not title:
        return jsonify({'error': 'Article title is required'}), 400

    try:
        wiki_lang_map = {
            'english': 'en',
            'sanskrit': 'sa',
            'nepali': 'ne',
            'sindhi': 'sd',
            'hindi': 'hi',
            'bengali': 'bn',
            'tamil': 'ta',
            'telugu': 'te',
            'marathi': 'mr',
            'gujarati': 'gu',
            'kannada': 'kn',
            'malayalam': 'ml',
            'punjabi': 'pa',
            'odia': 'or',
            'assamese': 'as'
        }
        wiki_client = get_wiki(wiki_lang_map.get(language, 'en'))
        page = wiki_client.page(title)
        if not page.exists():
            # fallback to English
            page = wiki_default.page(title)
            if not page.exists():
                return jsonify({'error': 'Article not found'}), 404

        # Get sections for multi-section selection
        sections = {}
        if hasattr(page, 'sections'):
            for section_obj in page.sections:
                sections[section_obj.title] = section_obj.text[:500]

        # Get content based on section selection
        if section == 'all' or section not in sections:
            content = page.text[:max_length]
        else:
            content = sections[section][:max_length]

        # Get article metadata
        metadata = {
            'title': page.title,
            'url': page.fullurl,
            'summary': page.summary[:200] if hasattr(page, 'summary') else '',
            'sections': list(sections.keys()),
            'language': language
        }

        return jsonify({
            'content': content,
            'metadata': metadata,
            'sections': sections
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/summarize', methods=['POST'])
@token_required
def summarize_content(current_user_id):
    data = request.json
    content = data.get('content')
    target_language = (data.get('language') or 'english').lower()
    summary_length = data.get('summary_length', 'medium')  # New: custom length

    if not content:
        return jsonify({'error': 'Content is required'}), 400

    # Define summary lengths
    length_config = {
        'short': {'max_length': 75, 'min_length': 25},
        'medium': {'max_length': 150, 'min_length': 50},
        'long': {'max_length': 250, 'min_length': 100}
    }

    config = length_config.get(summary_length, length_config['medium'])

    try:
        # Lightweight path for demos or limited environments
        if os.getenv("SUMMARY_MODE", "").lower() == "simple":
            # Simple heuristic: take first 2-3 sentences within ~150 chars
            text = content.strip()
            sentences = [s.strip() for s in text.replace('\n', ' ').split('.') if s.strip()]
            simple = '. '.join(sentences[:3])
            summary = (simple[:600] + '...') if len(simple) > 600 else simple
        else:
            summarizer = get_summarizer()
            summary = summarizer(
                content,
                max_length=config['max_length'],
                min_length=config['min_length'],
                do_sample=False
            )[0]['summary_text']

        # Translate if needed (limited)
        summary = translate_summary_if_needed(summary, target_language)
        return jsonify({'summary': summary, 'length': summary_length})
    except Exception as e:
        # Fallback to simple summarization to avoid blocking the UI
        try:
            text = content.strip()
            sentences = [s.strip() for s in text.replace('\n', ' ').split('.') if s.strip()]
            simple = '. '.join(sentences[:3])
            summary = (simple[:600] + '...') if len(simple) > 600 else simple
            summary = translate_summary_if_needed(summary, target_language)
            return jsonify({'summary': summary, 'note': 'Fallback simple summary used due to: ' + str(e), 'length': summary_length})
        except Exception as e2:
            return jsonify({'error': f'Summarization failed: {str(e)}; Fallback failed: {str(e2)}'}), 500

@app.route('/tts', methods=['POST'])
@token_required
def generate_tts(current_user_id):
    data = request.json
    text = data.get('text')
    language = data.get('language', 'english').lower()
    voice_type = data.get('voice_type', 'default')  # New: voice selection
    download = data.get('download', False)  # New: download option

    if not text:
        return jsonify({'error': 'Text is required'}), 400

    lang_code = language_codes.get(language, 'en')  # Default to English
    voice_config = voice_options.get(voice_type, voice_options['default'])

    try:
        # Check if language is supported by gTTS
        try:
            tts = gTTS(
                text=text,
                lang=lang_code,
                slow=voice_config['slow'],
                tld=voice_config['tld']
            )
        except Exception:
            fallback_lang = tts_fallbacks.get(lang_code)
            if fallback_lang:
                tts = gTTS(
                    text=text,
                    lang=fallback_lang,
                    slow=voice_config['slow'],
                    tld=voice_config['tld']
                )
            else:
                raise

        # Save to temporary file
        temp_file = tempfile.NamedTemporaryFile(delete=False, suffix='.mp3')
        tts.save(temp_file.name)
        temp_file.close()

        # Return file or download based on request
        if download:
            return send_file(temp_file.name, as_attachment=True, download_name=f'summary_{language}_{voice_type}.mp3')
        else:
            return send_file(temp_file.name, mimetype='audio/mpeg')

    except Exception as e:
        # Fallback to English if language not supported
        if lang_code != 'en':
            try:
                tts = gTTS(
                    text=text,
                    lang='en',
                    slow=voice_config['slow'],
                    tld=voice_config['tld']
                )
                temp_file = tempfile.NamedTemporaryFile(delete=False, suffix='.mp3')
                tts.save(temp_file.name)
                temp_file.close()
                if download:
                    return send_file(temp_file.name, as_attachment=True, download_name=f'summary_english_{voice_type}.mp3')
                else:
                    return send_file(temp_file.name, mimetype='audio/mpeg')
            except:
                pass
        return jsonify({'error': f'TTS failed: {str(e)}'}), 500

# New endpoint for getting available voice options
@app.route('/tts/voices', methods=['GET'])
def get_voice_options():
    return jsonify({
        'voice_types': list(voice_options.keys()),
        'supported_languages': list(language_codes.keys()),
        'voice_descriptions': {
            'default': 'Standard voice',
            'slow': 'Slower speech for better understanding',
            'uk': 'British English accent',
            'au': 'Australian English accent',
            'indian': 'Indian English accent'
        }
    })

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)
