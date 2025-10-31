# Tribal Wiki Reader

A Progressive Web App (PWA) that brings Wikipedia articles to life with AI-powered summaries and voice narration in multiple Indian languages including Sanskrit, Nepali, and Sindhi.

## 🌟 Features

- **Multi-Language Support**: Access Wikipedia content in Sanskrit, Nepali, Sindhi, Hindi, Bengali, Tamil, Telugu, Marathi, Gujarati, Kannada, Malayalam, Punjabi, Odia, and Assamese
- **AI-Powered Summarization**: Generate intelligent summaries using advanced transformer models (csebuetnlp/mT5_multilingual_XLSum)
- **Text-to-Speech**: Listen to summaries with multiple voice options (default, slow, UK, Australian, Indian English)
- **User Authentication**: Secure login/registration system with JWT tokens
- **Personal Dashboard**: Save bookmarks, view search history, and customize preferences
- **Voice Input**: Use speech recognition to search for articles
- **Progressive Web App**: Install as a native app with offline capabilities
- **Responsive Design**: Works seamlessly on desktop and mobile devices

## 🛠 Tech Stack

### Backend
- **Python Flask**: RESTful API server
- **SQLite**: Database for user management and history
- **Transformers**: AI summarization using Hugging Face models
- **gTTS**: Google Text-to-Speech for audio generation
- **Wikipedia-API**: Article scraping and content retrieval
- **JWT**: Secure authentication tokens

### Frontend
- **HTML5/CSS3**: Modern responsive design
- **JavaScript (ES6+)**: Interactive user interface
- **Web Speech API**: Voice input functionality
- **Service Worker**: PWA offline capabilities
- **Font Awesome**: Icons and visual elements

## 📋 Prerequisites

- Python 3.8+
- pip (Python package manager)
- Modern web browser with Web Speech API support

## 🚀 Installation

1. **Clone the repository** (if applicable) or navigate to the project directory:
   ```bash
   cd tribal-wiki-reader
   ```

2. **Install Python dependencies**:
   ```bash
   cd backend
   pip install -r requirements.txt
   ```

3. **Start the Flask backend**:
   ```bash
   python app.py
   ```
   The server will run on `http://localhost:5000`

4. **Open the frontend**:
   - Open `frontend/index.html` in your web browser, or
   - Serve the frontend directory with a local server (recommended for PWA features)

## 📖 Usage

1. **Register/Login**: Create an account or log in to access the application
2. **Search Articles**: Enter a Wikipedia article title (e.g., "India", "Nepal", "Sanskrit")
3. **Select Language**: Choose from supported Indian languages
4. **Customize Options**:
   - Summary length (short/medium/long)
   - Voice type for narration
5. **Get Summary**: Click "Get AI Summary & Listen" to process the article
6. **Listen**: Use the play button to hear the summary narrated
7. **Download**: Save audio files for offline listening
8. **Bookmark**: Save favorite articles for quick access

## 🔧 API Endpoints

### Authentication
- `POST /register` - User registration
- `POST /login` - User login
- `GET /user/preferences` - Get user preferences
- `PUT /user/preferences` - Update user preferences

### Core Functionality
- `POST /scrape` - Scrape Wikipedia article content
- `POST /summarize` - Generate AI summary
- `POST /tts` - Generate text-to-speech audio
- `GET /tts/voices` - Get available voice options

### User Data
- `GET /user/history` - Get search history
- `POST /user/history` - Save search to history
- `GET /user/bookmarks` - Get bookmarked articles
- `POST /user/bookmarks` - Add bookmark
- `DELETE /user/bookmarks` - Remove bookmark

## 🎯 Key Components

### Backend (`backend/`)
- `app.py`: Main Flask application with all API endpoints
- `requirements.txt`: Python dependencies
- `tribal_wiki.db`: SQLite database (auto-created)

### Frontend (`frontend/`)
- `index.html`: Main application interface
- `script.js`: Client-side logic and API interactions
- `styles.css`: Responsive styling and animations
- `manifest.json`: PWA manifest
- `sw.js`: Service worker for offline functionality

## 🔧 Configuration

### Environment Variables
- `SECRET_KEY`: Flask app secret key (defaults to development key)
- `JWT_SECRET_KEY`: JWT token signing key
- `SUMMARY_MODEL`: Hugging Face model for summarization (default: csebuetnlp/mT5_multilingual_XLSum)
- `SUMMARY_MODE`: Set to "simple" for lightweight summarization

### Voice Options
- **Default**: Standard voice
- **Slow**: Slower speech for better comprehension
- **UK**: British English accent
- **AU**: Australian English accent
- **Indian**: Indian English accent

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🙏 Acknowledgments

- Wikipedia API for content access
- Hugging Face Transformers for AI summarization
- Google Text-to-Speech for voice generation
- Font Awesome for icons
- Open source community for various libraries and tools

## 📞 Support

For questions or issues, please open an issue on the GitHub repository or contact the development team.

---pandunaradala@gmail.com

**Experience the richness of Indian languages through the power of AI and voice technology! 🇮🇳**
