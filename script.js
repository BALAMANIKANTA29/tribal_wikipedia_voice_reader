const form = document.getElementById('articleForm');
const loading = document.getElementById('loading');
const summarySection = document.getElementById('summarySection');
const summaryText = document.getElementById('summaryText');
const playAudioBtn = document.getElementById('playAudio');
const audioPlayer = document.getElementById('audioPlayer');
const errorDiv = document.getElementById('error');

const backendUrl = 'http://localhost:5000';

// Authentication state
let currentUser = null;
let authToken = null;

// Initialize authentication
function initAuth() {
    authToken = localStorage.getItem('authToken');
    if (authToken) {
        // Verify token and get user info
        fetch(`${backendUrl}/user/preferences`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        })
        .then(response => {
            if (response.ok) {
                updateAuthUI(true);
                loadUserPreferences();
            } else {
                localStorage.removeItem('authToken');
                authToken = null;
                updateAuthUI(false);
            }
        })
        .catch(() => {
            localStorage.removeItem('authToken');
            authToken = null;
            updateAuthUI(false);
        });
    } else {
        updateAuthUI(false);
    }
}

function updateAuthUI(isLoggedIn) {
    const authButtons = document.getElementById('authButtons');
    const userInfo = document.getElementById('userInfo');
    const username = document.getElementById('username');
    const mainContent = document.getElementById('mainContent');
    const authNotice = document.getElementById('authNotice');

    if (isLoggedIn) {
        authButtons.style.display = 'none';
        userInfo.style.display = 'flex';
        username.textContent = currentUser?.username || 'User';
        mainContent.style.display = 'block';
        authNotice.style.display = 'none';
    } else {
        authButtons.style.display = 'flex';
        userInfo.style.display = 'none';
        mainContent.style.display = 'none';
        authNotice.style.display = 'block';
    }
}

// Modal functions
function showModal(modalId) {
    document.getElementById(modalId).style.display = 'block';
}

function hideModal(modalId) {
    document.getElementById(modalId).style.display = 'none';
}

// Authentication functions
async function login(username, password) {
    try {
        const response = await fetch(`${backendUrl}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        
        const data = await response.json();
        if (response.ok) {
            authToken = data.token;
            currentUser = data.user;
            localStorage.setItem('authToken', authToken);
            updateAuthUI(true);
            hideModal('loginModal');
            return true;
        } else {
            throw new Error(data.error);
        }
    } catch (error) {
        alert('Login failed: ' + error.message);
        return false;
    }
}

async function register(username, email, password) {
    try {
        const response = await fetch(`${backendUrl}/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, email, password })
        });
        
        const data = await response.json();
        if (response.ok) {
            alert('Registration successful! Please login.');
            hideModal('registerModal');
            showModal('loginModal');
            return true;
        } else {
            throw new Error(data.error);
        }
    } catch (error) {
        alert('Registration failed: ' + error.message);
        return false;
    }
}

function logout() {
    authToken = null;
    currentUser = null;
    localStorage.removeItem('authToken');
    updateAuthUI(false);
}

// User preferences
function loadUserPreferences() {
    if (!authToken) return;
    
    fetch(`${backendUrl}/user/preferences`, {
        headers: {
            'Authorization': `Bearer ${authToken}`
        }
    })
    .then(response => response.json())
    .then(data => {
        const prefs = JSON.parse(data.preferences || '{}');
        if (prefs.defaultLanguage) {
            document.getElementById('language').value = prefs.defaultLanguage;
        }
        if (prefs.defaultVoice) {
            document.getElementById('voiceType').value = prefs.defaultVoice;
        }
        if (prefs.darkMode) {
            document.body.classList.add('dark-mode');
            document.getElementById('darkModeToggle').checked = true;
        }
    })
    .catch(console.error);
}

function saveUserPreferences() {
    if (!authToken) return;
    
    const preferences = {
        defaultLanguage: document.getElementById('language').value,
        defaultVoice: document.getElementById('voiceType').value,
        darkMode: document.getElementById('darkModeToggle').checked
    };
    
    fetch(`${backendUrl}/user/preferences`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({ preferences: JSON.stringify(preferences) })
    })
    .then(response => {
        if (response.ok) {
            alert('Settings saved!');
            hideModal('settingsModal');
        }
    })
    .catch(console.error);
}

// Voice input elements
const voiceBtn = document.getElementById('voiceBtn');
const voiceStatus = document.getElementById('voiceStatus');
const articleTitleInput = document.getElementById('articleTitle');

// History elements
const historyList = document.getElementById('historyList');
const clearHistoryBtn = document.getElementById('clearHistory');

// Web Speech API setup with feature detection
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognition = null;
if (SpeechRecognition) {
    recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
}

function setVoiceStatus(text, active) {
    if (voiceStatus) {
        voiceStatus.textContent = text || '';
        voiceStatus.className = active ? 'voice-status' : 'voice-status visually-hidden';
    }
    if (voiceBtn) {
        voiceBtn.setAttribute('aria-pressed', active ? 'true' : 'false');
        const icon = voiceBtn.querySelector('i');
        const span = voiceBtn.querySelector('span');
        if (active) {
            icon.className = 'fas fa-stop';
            span.textContent = 'Stop';
        } else {
            icon.className = 'fas fa-microphone';
            span.textContent = 'Voice';
        }
    }
}

if (voiceBtn) {
    if (!recognition) {
        // Disable if browser doesn't support speech recognition
        voiceBtn.disabled = true;
        voiceBtn.title = 'Speech recognition not supported in this browser';
    } else {
        voiceBtn.addEventListener('click', () => {
            try {
                setVoiceStatus('Listening…', true);
                recognition.start();
            } catch (e) {
                // Some browsers throw if start called twice
            }
        });

        recognition.onresult = (event) => {
            const transcript = event.results[0][0].transcript.trim();
            articleTitleInput.value = transcript;
            setVoiceStatus(`Heard: "${transcript}"`, false);
        };

        recognition.onerror = (event) => {
            setVoiceStatus(`Voice error: ${event.error}`, false);
        };

        recognition.onend = () => {
            setVoiceStatus('', false);
        };
    }
}

function getHistory() {
    try {
        const raw = localStorage.getItem('twr_history');
        return raw ? JSON.parse(raw) : [];
    } catch {
        return [];
    }
}

function setHistory(items) {
    try {
        localStorage.setItem('twr_history', JSON.stringify(items.slice(0, 20)));
    } catch {}
}

function addToHistory(entry) {
    const items = getHistory();
    // de-dup by title + language
    const filtered = items.filter(i => !(i.title === entry.title && i.language === entry.language));
    filtered.unshift({
        title: entry.title,
        language: entry.language,
        timestamp: Date.now()
    });
    setHistory(filtered);
    renderHistory();
}

function renderHistory() {
    if (!historyList) return;
    const items = getHistory();
    historyList.innerHTML = '';
    items.forEach((item, idx) => {
        const li = document.createElement('li');
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'history-item';
        const date = new Date(item.timestamp).toLocaleString();
        btn.textContent = `${item.title} (${item.language}) – ${date}`;
        btn.addEventListener('click', () => {
            articleTitleInput.value = item.title;
            document.getElementById('language').value = item.language;
            form.requestSubmit();
        });
        li.appendChild(btn);
        historyList.appendChild(li);
    });
}

if (clearHistoryBtn) {
    clearHistoryBtn.addEventListener('click', () => {
        setHistory([]);
        renderHistory();
    });
}

// Initial render
renderHistory();

// Initialize authentication
initAuth();

// Register Service Worker for PWA
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/tribal-wiki-reader/frontend/sw.js')
            .then((registration) => {
                console.log('SW registered: ', registration);
            })
            .catch((registrationError) => {
                console.log('SW registration failed: ', registrationError);
            });
    });
}

// Modal event listeners
document.getElementById('loginBtn').addEventListener('click', () => showModal('loginModal'));
document.getElementById('registerBtn').addEventListener('click', () => showModal('registerModal'));
document.getElementById('logoutBtn').addEventListener('click', logout);

// Close modal event listeners
document.getElementById('closeLoginModal').addEventListener('click', () => hideModal('loginModal'));
document.getElementById('closeRegisterModal').addEventListener('click', () => hideModal('registerModal'));

// Login form
document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('loginUsername').value;
    const password = document.getElementById('loginPassword').value;
    await login(username, password);
});

// Register form
document.getElementById('registerForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('registerUsername').value;
    const email = document.getElementById('registerEmail').value;
    const password = document.getElementById('registerPassword').value;
    const confirmPassword = document.getElementById('confirmPassword').value;
    
    if (password !== confirmPassword) {
        alert('Passwords do not match');
        return;
    }
    
    await register(username, email, password);
});

// Settings functionality
document.getElementById('darkModeToggle').addEventListener('change', (e) => {
    if (e.target.checked) {
        document.body.classList.add('dark-mode');
    } else {
        document.body.classList.remove('dark-mode');
    }
});

document.getElementById('saveSettings').addEventListener('click', saveUserPreferences);

// Add smooth scrolling and animations
document.addEventListener('DOMContentLoaded', function() {
    // Add fade-in animation to cards
    const cards = document.querySelectorAll('.search-card, .summary-card, .history-card');
    cards.forEach((card, index) => {
        card.style.opacity = '0';
        card.style.transform = 'translateY(20px)';
        setTimeout(() => {
            card.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
            card.style.opacity = '1';
            card.style.transform = 'translateY(0)';
        }, index * 200);
    });
    
    // Add input focus animations
    const inputs = document.querySelectorAll('input, select');
    inputs.forEach(input => {
        input.addEventListener('focus', function() {
            this.parentElement.style.transform = 'scale(1.02)';
            this.parentElement.style.transition = 'transform 0.2s ease';
        });
        
        input.addEventListener('blur', function() {
            this.parentElement.style.transform = 'scale(1)';
        });
    });
    
    // Add keyboard shortcuts
    document.addEventListener('keydown', function(e) {
        // Ctrl/Cmd + Enter to submit form
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
            const form = document.getElementById('articleForm');
            if (form && !form.querySelector('.submit-btn').disabled) {
                form.requestSubmit();
            }
        }
        
        // Escape to clear voice input
        if (e.key === 'Escape' && recognition && voiceBtn.getAttribute('aria-pressed') === 'true') {
            recognition.stop();
        }
    });
    
    // Add tooltips
    const tooltipElements = document.querySelectorAll('[title]');
    tooltipElements.forEach(element => {
        element.addEventListener('mouseenter', function() {
            const tooltip = document.createElement('div');
            tooltip.className = 'tooltip';
            tooltip.textContent = this.title;
            tooltip.style.cssText = `
                position: absolute;
                background: var(--gray-800);
                color: white;
                padding: 0.5rem;
                border-radius: 0.25rem;
                font-size: 0.875rem;
                z-index: 1000;
                pointer-events: none;
                opacity: 0;
                transition: opacity 0.2s ease;
            `;
            document.body.appendChild(tooltip);
            
            const rect = this.getBoundingClientRect();
            tooltip.style.left = rect.left + (rect.width / 2) - (tooltip.offsetWidth / 2) + 'px';
            tooltip.style.top = rect.top - tooltip.offsetHeight - 8 + 'px';
            
            setTimeout(() => tooltip.style.opacity = '1', 10);
            
            this.addEventListener('mouseleave', function() {
                tooltip.style.opacity = '0';
                setTimeout(() => document.body.removeChild(tooltip), 200);
            });
        });
    });
});

form.addEventListener('submit', async (e) => {
    e.preventDefault();

    // Check if user is logged in
    if (!authToken) {
        alert('Please login to access this feature.');
        showModal('loginModal');
        return;
    }

    const title = document.getElementById('articleTitle').value;
    const language = document.getElementById('language').value;
    const summaryLength = document.getElementById('summaryLength').value;
    const voiceType = document.getElementById('voiceType').value;
    const submitBtn = form.querySelector('.submit-btn');

    // Show loading state
    loading.style.display = 'block';
    summarySection.style.display = 'none';
    errorDiv.style.display = 'none';

    // Disable submit button and show loading
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i><span>Processing...</span>';

    try {
        // Step 1: Scrape article
        const scrapeResponse = await fetch(`${backendUrl}/scrape`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({ title, language })
        });
        const scrapeData = await scrapeResponse.json();
        if (!scrapeResponse.ok) throw new Error(scrapeData.error);

        // Step 2: Summarize content
        const summarizeResponse = await fetch(`${backendUrl}/summarize`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({
                content: scrapeData.content,
                language,
                summary_length: summaryLength
            })
        });
        const summarizeData = await summarizeResponse.json();
        if (!summarizeResponse.ok) throw new Error(summarizeData.error);

        // Display summary
        summaryText.textContent = summarizeData.summary;
        summarySection.style.display = 'block';

        // Store data for TTS and other features
        window.currentSummary = summarizeData.summary;
        window.currentLanguage = language;
        window.currentVoiceType = voiceType;
        window.currentTitle = title;

        // Add to history (local storage)
        addToHistory({ title, language, summary: summarizeData.summary });

        // Save to user history if logged in
        if (authToken) {
            fetch(`${backendUrl}/user/history`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${authToken}`
                },
                body: JSON.stringify({
                    title,
                    language,
                    summary: summarizeData.summary
                })
            }).catch(console.error);
        }

    } catch (err) {
        errorDiv.innerHTML = `
            <div style="display: flex; align-items: center; gap: 0.5rem;">
                <i class="fas fa-exclamation-triangle" style="color: var(--danger-color);"></i>
                <span>${err.message}</span>
            </div>
        `;
        errorDiv.style.display = 'block';
    } finally {
        loading.style.display = 'none';
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<i class="fas fa-magic"></i><span>Get AI Summary & Listen</span>';
    }
});

playAudioBtn.addEventListener('click', async () => {
    // Check if user is logged in
    if (!authToken) {
        alert('Please login to access this feature.');
        showModal('loginModal');
        return;
    }

    const icon = playAudioBtn.querySelector('i');
    const span = playAudioBtn.querySelector('span');

    try {
        // Show loading state
        playAudioBtn.disabled = true;
        icon.className = 'fas fa-spinner fa-spin';
        span.textContent = 'Generating...';

        const ttsResponse = await fetch(`${backendUrl}/tts`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({
                text: window.currentSummary,
                language: window.currentLanguage,
                voice_type: window.currentVoiceType || 'default'
            })
        });

        if (!ttsResponse.ok) {
            const errorData = await ttsResponse.json();
            throw new Error(errorData.error);
        }

        // Create blob URL for audio
        const audioBlob = await ttsResponse.blob();
        const audioUrl = URL.createObjectURL(audioBlob);
        audioPlayer.src = audioUrl;
        audioPlayer.style.display = 'block';

        // Update button state
        icon.className = 'fas fa-play';
        span.textContent = 'Play Audio';
        playAudioBtn.disabled = false;

        // Add click handler to play audio (avoids autoplay restrictions)
        playAudioBtn.onclick = () => {
            if (audioPlayer.paused) {
                audioPlayer.play();
            } else {
                audioPlayer.pause();
            }
        };

        // Update button when playing
        audioPlayer.addEventListener('play', () => {
            icon.className = 'fas fa-pause';
            span.textContent = 'Pause';
        });

        audioPlayer.addEventListener('pause', () => {
            icon.className = 'fas fa-play';
            span.textContent = 'Play Audio';
        });

        audioPlayer.addEventListener('ended', () => {
            icon.className = 'fas fa-play';
            span.textContent = 'Play Audio';
        });

    } catch (err) {
        errorDiv.innerHTML = `
            <div style="display: flex; align-items: center; gap: 0.5rem;">
                <i class="fas fa-exclamation-triangle" style="color: var(--danger-color);"></i>
                <span>TTS Error: ${err.message}</span>
            </div>
        `;
        errorDiv.style.display = 'block';

        // Reset button state
        icon.className = 'fas fa-play';
        span.textContent = 'Play Audio';
        playAudioBtn.disabled = false;
    }
});

// Download audio functionality
document.getElementById('downloadAudio').addEventListener('click', async () => {
    // Check if user is logged in
    if (!authToken) {
        alert('Please login to access this feature.');
        showModal('loginModal');
        return;
    }

    try {
        const response = await fetch(`${backendUrl}/tts`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({
                text: window.currentSummary,
                language: window.currentLanguage,
                voice_type: window.currentVoiceType || 'default',
                download: true
            })
        });

        if (!response.ok) {
            throw new Error('Download failed');
        }

        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = `${window.currentTitle}_summary.mp3`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
    } catch (err) {
        alert('Download failed: ' + err.message);
    }
});

// Bookmark functionality
document.getElementById('bookmarkBtn').addEventListener('click', async () => {
    if (!authToken) {
        alert('Please login to bookmark articles');
        showModal('loginModal');
        return;
    }

    try {
        const response = await fetch(`${backendUrl}/user/bookmarks`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({
                title: window.currentTitle,
                language: window.currentLanguage,
                summary: window.currentSummary
            })
        });

        if (response.ok) {
            alert('Article bookmarked successfully!');
        } else {
            throw new Error('Failed to bookmark');
        }
    } catch (err) {
        alert('Bookmark failed: ' + err.message);
    }
});
