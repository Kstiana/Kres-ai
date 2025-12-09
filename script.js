const CONFIG = {
    AI_NAME: 'Kres',
    AI_PERSONALITY: "You're a friendly, witty AI named Kres. You speak like a cool friend, not a robot. You're playful but still smart and helpful. You love using emojis, keeping the conversation light, and making users smile. Be helpful, but never boring.",
    GROQ_API_URL: 'https://api.groq.com/openai/v1/chat/completions',
    MODEL: 'llama-3.1-8b-instant',
    MAX_TOKENS: 500,
    TEMPERATURE: 0.8,
    DEMO_MODE: false
};

let state = {
    currentChatId: null,
    chats: [],
    messages: {},
    isDarkMode: true,
    settings: {
        autoScroll: true,
        soundEffects: true,
        responseSpeed: 'normal',
        fontSize: 'medium',
        apiKey: ''
    },
    isTyping: false,
    showSidebar: false,
    db: null
};

const elements = {
    sidebar: document.getElementById('sidebar'),
    closeSidebar: document.getElementById('closeSidebar'),
    openSidebar: document.getElementById('openSidebar'),
    overlay: document.getElementById('overlay'),
    newChatBtn: document.getElementById('newChatBtn'),
    chatList: document.getElementById('chatList'),
    themeToggle: document.getElementById('themeToggle'),
    themeIcon: document.getElementById('themeIcon'),
    themeText: document.getElementById('themeText'),
    messagesArea: document.getElementById('messagesArea'),
    welcomeScreen: document.getElementById('welcomeScreen'),
    messagesContainer: document.getElementById('messagesContainer'),
    promptGrid: document.getElementById('promptGrid'),
    typingIndicator: document.getElementById('typingIndicator'),
    messagesEnd: document.getElementById('messagesEnd'),
    messageInput: document.getElementById('messageInput'),
    voiceBtn: document.getElementById('voiceBtn'),
    sendBtn: document.getElementById('sendBtn'),
    messageForm: document.getElementById('messageForm'),
    settingsBtn: document.getElementById('settingsBtn'),
    clearHistoryBtn: document.getElementById('clearHistoryBtn'),
    exportBtn: document.getElementById('exportBtn'),
    helpBtn: document.getElementById('helpBtn'),
    attachBtn: document.getElementById('attachBtn'),
    notification: document.getElementById('notification'),
    settingsModal: document.getElementById('settingsModal'),
    closeModal: document.getElementById('closeModal'),
    saveSettings: document.getElementById('saveSettings'),
    resetSettings: document.getElementById('resetSettings'),
    totalChats: document.getElementById('totalChats'),
    totalMessages: document.getElementById('totalMessages'),
    aiStatus: document.getElementById('aiStatus')
};

const PROMPT_SUGGESTIONS = [
    { 
        icon: 'fas fa-lightbulb', 
        text: "Explain quantum physics like I'm 10 years old", 
        category: "Education" 
    },
    { 
        icon: 'fas fa-code', 
        text: "Write a Python script to sort a list", 
        category: "Code" 
    },
    { 
        icon: 'fas fa-pencil-alt', 
        text: "Help me write a funny tweet about coffee", 
        category: "Creative" 
    },
    { 
        icon: 'fas fa-heart', 
        text: "Give me dating advice for the modern world", 
        category: "Advice" 
    }
];

const DEMO_RESPONSES = [
    "Hey there! 👋 That's a great question! Let me put on my thinking cap... 🤔 Honestly, I'd approach it with a mix of creativity and logic. What do you think? Sometimes the best answers come from chatting it out! 💬",
    
    "Ooh, interesting! 🧠 Let me break it down for you in a fun way:\n\n✨ **The Cool Part**: This is where the magic happens!\n⚡ **The Fast Part**: Zoom zoom!\n🎯 **The Important Part**: Don't skip this!\n\nWant me to dive deeper into any of these?",
    
    "Hmm, let me think about that for a sec... ⏳\n\nYou know what? The answer might be simpler than we think! Sometimes we overcomplicate things. 😅 Here's my take: embrace the journey, learn as you go, and have fun with it! 🎉\n\nWhat's your gut telling you?",
    
    "Great question! 😄 Let me share some thoughts:\n\n```python\n# Here's a little code wisdom\ndef be_awesome():\n    print('Keep learning!')\n    print('Stay curious!')\n    return 'You got this! ✨'\n```\n\nRemember: progress over perfection! 🚀"
];

async function initDatabase() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open('KresAIChatDB', 1);
        
        request.onerror = () => {
            console.error('Failed to open database');
            showNotification('Failed to initialize database. Using local storage instead.', 'error');
            resolve(false);
        };
        
        request.onsuccess = (event) => {
            state.db = event.target.result;
            console.log('Database initialized');
            resolve(true);
        };
        
        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            
            if (!db.objectStoreNames.contains('chats')) {
                const chatsStore = db.createObjectStore('chats', { keyPath: 'id' });
                chatsStore.createIndex('updatedAt', 'updatedAt', { unique: false });
            }
            
            if (!db.objectStoreNames.contains('messages')) {
                const messagesStore = db.createObjectStore('messages', { keyPath: 'id' });
                messagesStore.createIndex('chatId', 'chatId', { unique: false });
                messagesStore.createIndex('timestamp', 'timestamp', { unique: false });
            }
            
            if (!db.objectStoreNames.contains('settings')) {
                const settingsStore = db.createObjectStore('settings', { keyPath: 'id' });
            }
        };
    });
}

function saveToDB(storeName, data) {
    return new Promise((resolve, reject) => {
        if (!state.db) {
     
            const key = `kres_ai_${storeName}_${data.id || 'data'}`;
            localStorage.setItem(key, JSON.stringify(data));
            resolve(true);
            return;
        }
        
        const transaction = state.db.transaction([storeName], 'readwrite');
        const store = transaction.objectStore(storeName);
        const request = store.put(data);
        
        request.onsuccess = () => resolve(true);
        request.onerror = () => reject(request.error);
    });
}

function getFromDB(storeName, key) {
    return new Promise((resolve, reject) => {
        if (!state.db) {

            const storageKey = `kres_ai_${storeName}_${key}`;
            const data = localStorage.getItem(storageKey);
            resolve(data ? JSON.parse(data) : null);
            return;
        }
        
        const transaction = state.db.transaction([storeName], 'readonly');
        const store = transaction.objectStore(storeName);
        const request = store.get(key);
        
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

function getAllFromDB(storeName, indexName = null, query = null) {
    return new Promise((resolve, reject) => {
        if (!state.db) {

            const prefix = `kres_ai_${storeName}_`;
            const items = [];
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key.startsWith(prefix)) {
                    items.push(JSON.parse(localStorage.getItem(key)));
                }
            }
            resolve(items);
            return;
        }
        
        const transaction = state.db.transaction([storeName], 'readonly');
        const store = transaction.objectStore(storeName);
        let request;
        
        if (indexName) {
            const index = store.index(indexName);
            request = query ? index.getAll(query) : index.getAll();
        } else {
            request = store.getAll();
        }
        
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

function deleteFromDB(storeName, key) {
    return new Promise((resolve, reject) => {
        if (!state.db) {

            const storageKey = `kres_ai_${storeName}_${key}`;
            localStorage.removeItem(storageKey);
            resolve(true);
            return;
        }
        
        const transaction = state.db.transaction([storeName], 'readwrite');
        const store = transaction.objectStore(storeName);
        const request = store.delete(key);
        
        request.onsuccess = () => resolve(true);
        request.onerror = () => reject(request.error);
    });
}

function clearDB(storeName) {
    return new Promise((resolve, reject) => {
        if (!state.db) {

            const prefix = `kres_ai_${storeName}_`;
            for (let i = localStorage.length - 1; i >= 0; i--) {
                const key = localStorage.key(i);
                if (key.startsWith(prefix)) {
                    localStorage.removeItem(key);
                }
            }
            resolve(true);
            return;
        }
        
        const transaction = state.db.transaction([storeName], 'readwrite');
        const store = transaction.objectStore(storeName);
        const request = store.clear();
        
        request.onsuccess = () => resolve(true);
        request.onerror = () => reject(request.error);
    });
}

async function loadChats() {
    try {
        const chats = await getAllFromDB('chats', 'updatedAt');
        state.chats = chats.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
        
        if (state.chats.length === 0) {
            await createNewChat();
        } else {
            state.currentChatId = state.chats[0].id;
            await loadMessages(state.currentChatId);
        }
        
        renderChatList();
        updateStats();
    } catch (error) {
        console.error('Error loading chats:', error);
        showNotification('Error loading chat history', 'error');
    }
}

async function loadMessages(chatId) {
    try {
        const messages = await getAllFromDB('messages', 'chatId', chatId);
        state.messages[chatId] = messages.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
        renderMessages();
    } catch (error) {
        console.error('Error loading messages:', error);
        state.messages[chatId] = [];
    }
}

async function loadSettings() {
    try {
        const savedSettings = await getFromDB('settings', 'appSettings');
        if (savedSettings) {
            state.settings = { ...state.settings, ...savedSettings };
        }
       
        applySettings();
    } catch (error) {
        console.error('Error loading settings:', error);
    }
}

async function saveSettings() {
    try {
        await saveToDB('settings', { id: 'appSettings', ...state.settings });
        applySettings();
        showNotification('Settings saved!', 'success');
    } catch (error) {
        console.error('Error saving settings:', error);
        showNotification('Error saving settings', 'error');
    }
}

function applySettings() {
    if (state.isDarkMode) {
        document.body.classList.remove('light-mode');
        document.body.classList.add('dark-mode');
        elements.themeIcon.className = 'fas fa-sun';
        elements.themeText.textContent = 'Light Mode';
    } else {
        document.body.classList.remove('dark-mode');
        document.body.classList.add('light-mode');
        elements.themeIcon.className = 'fas fa-moon';
        elements.themeText.textContent = 'Dark Mode';
    }
    
    document.body.style.fontSize = state.settings.fontSize === 'small' ? '14px' : 
                                  state.settings.fontSize === 'large' ? '18px' : '16px';
    
    if (state.settings.apiKey) {
        CONFIG.DEMO_MODE = false;
    }
    
    if (elements.settingsModal) {
        document.getElementById('apiKey').value = state.settings.apiKey || '';
        document.getElementById('autoScroll').checked = state.settings.autoScroll;
        document.getElementById('soundEffects').checked = state.settings.soundEffects;
        document.getElementById('responseSpeed').value = state.settings.responseSpeed;
        document.getElementById('fontSize').value = state.settings.fontSize;
    }
}

function showNotification(message, type = 'info') {
    elements.notification.textContent = message;
    elements.notification.className = `notification ${type} show`;
    
    setTimeout(() => {
        elements.notification.classList.remove('show');
    }, 3000);
}

async function createNewChat() {
    const chatId = 'chat_' + Date.now();
    const newChat = {
        id: chatId,
        title: 'New Chat',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        messageCount: 0
    };
    
    try {
        await saveToDB('chats', newChat);
        state.chats.unshift(newChat);
        state.currentChatId = chatId;
        state.messages[chatId] = [
            {
                id: 'welcome_' + Date.now(),
                chatId: chatId,
                role: 'assistant',
                content: `Hey there! 👋 I'm ${CONFIG.AI_NAME}, your friendly AI pal! I'm here to chat, help, and maybe crack a joke or two! 😄\n\nWhat's on your mind today? I'm all ears! 👂`,
                timestamp: new Date().toISOString()
            }
        ];
        
        await saveToDB('messages', state.messages[chatId][0]);
        
        renderChatList();
        renderMessages();
        elements.welcomeScreen.style.display = 'block';
        scrollToBottom();
        
        if (window.innerWidth < 1024) {
            toggleSidebar(false);
        }
        
        updateStats();
        showNotification('New chat started!', 'success');
    } catch (error) {
        console.error('Error creating chat:', error);
        showNotification('Error creating chat', 'error');
    }
}

async function selectChat(chatId) {
    state.currentChatId = chatId;
    
    try {
        await loadMessages(chatId);
        renderChatList();
        
        if (state.messages[chatId] && state.messages[chatId].length > 0) {
            elements.welcomeScreen.style.display = 'none';
        } else {
            elements.welcomeScreen.style.display = 'block';
        }
        
        scrollToBottom();
        
        if (window.innerWidth < 1024) {
            toggleSidebar(false);
        }
    } catch (error) {
        console.error('Error selecting chat:', error);
        showNotification('Error loading chat', 'error');
    }
}

async function sendMessage(content) {
    if (!content.trim() || state.isTyping) return;
    
    const chatId = state.currentChatId;
    const userMessage = {
        id: 'msg_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
        chatId: chatId,
        role: 'user',
        content: content.trim(),
        timestamp: new Date().toISOString()
    };
    
    try {
        state.messages[chatId].push(userMessage);
        await saveToDB('messages', userMessage);
        
        const chat = state.chats.find(c => c.id === chatId);
        if (chat) {
            chat.title = content.substring(0, 50) + (content.length > 50 ? '...' : '');
            chat.updatedAt = new Date().toISOString();
            chat.messageCount = (chat.messageCount || 0) + 1;
            await saveToDB('chats', chat);
        }
        
        renderMessages();
        elements.welcomeScreen.style.display = 'none';
        scrollToBottom();
        
        showTypingIndicator();
        
        const aiResponse = await getAIResponse(content);
        
        hideTypingIndicator();
        
        const assistantMessage = {
            id: 'msg_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
            chatId: chatId,
            role: 'assistant',
            content: aiResponse,
            timestamp: new Date().toISOString()
        };
        
        state.messages[chatId].push(assistantMessage);
        await saveToDB('messages', assistantMessage);
        
        if (chat) {
            chat.messageCount = (chat.messageCount || 0) + 1;
            chat.updatedAt = new Date().toISOString();
            await saveToDB('chats', chat);
        }
        
        renderMessages();
        renderChatList();
        scrollToBottom();
        updateStats();
        
    } catch (error) {
        console.error('Error sending message:', error);
        hideTypingIndicator();
        showNotification('Error sending message. Please try again.', 'error');
    }
}

async function getAIResponse(userMessage) {

    if (CONFIG.DEMO_MODE) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        return DEMO_RESPONSES[Math.floor(Math.random() * DEMO_RESPONSES.length)];
    }
    
    try {
        const response = await fetch('/api/groq-proxy', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ message: userMessage })
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'API request failed');
        }
        
        const data = await response.json();
        return data.choices[0]?.message?.content || "Hmm, I'm drawing a blank on this one! 😅 Can you ask me something else?";
        
    } catch (error) {
        console.error('Error getting AI response:', error);
        
        await new Promise(resolve => setTimeout(resolve, 1000));
        return `Oops! Something went wrong with my brain. 🤯\n\n${error.message}\n\nTry again in a moment or ask something else!`;
    }
}

function showTypingIndicator() {
    state.isTyping = true;
    elements.aiStatus.textContent = 'Typing...';
    elements.aiStatus.style.color = 'var(--warning)';
    
    const typingHtml = `
        <div class="message-container">
            <div class="avatar assistant">
                <i class="fas fa-robot"></i>
            </div>
            <div class="message-content">
                <div class="typing-bubble">
                    <div class="typing-content">
                        <div class="typing-dots">
                            <div class="typing-dot"></div>
                            <div class="typing-dot"></div>
                            <div class="typing-dot"></div>
                        </div>
                        <span class="typing-text"></span>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    elements.typingIndicator.innerHTML = typingHtml;
    scrollToBottom();
}

function hideTypingIndicator() {
    state.isTyping = false;
    elements.aiStatus.textContent = 'Online';
    elements.aiStatus.style.color = 'var(--success)';
    elements.typingIndicator.innerHTML = '';
}

function formatMessage(content) {

    let formatted = content
        .replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>')
        .replace(/`([^`]+)`/g, '<code>$1</code>')
        .replace(/\*\*\*([^*]+)\*\*\*/g, '<strong><em>$1</em></strong>')
        .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
        .replace(/\*([^*]+)\*/g, '<em>$1</em>')
        .replace(/^### (.*$)/gm, '<h3>$1</h3>')
        .replace(/^## (.*$)/gm, '<h2>$1</h2>')
        .replace(/^# (.*$)/gm, '<h1>$1</h1>')
        .replace(/^> (.*$)/gm, '<blockquote>$1</blockquote>')
        .replace(/^- (.*$)/gm, '<li>$1</li>')
        .replace(/^\d+\. (.*$)/gm, '<li>$1</li>')
        .replace(/\n/g, '<br>');
    
    formatted = formatted.replace(/(<li>.*?<\/li>)+/g, (match) => {
        return `<ul>${match}</ul>`;
    });

    formatted = formatted.replace(
        /(https?:\/\/[^\s]+)/g,
        '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>'
    );
    
    return formatted;
}

function renderMessages() {
    const chatId = state.currentChatId;
    const messages = state.messages[chatId] || [];
    
    let messagesHtml = '';
    
    messages.forEach(message => {
        const isUser = message.role === 'user';
        const formattedTime = new Date(message.timestamp).toLocaleTimeString([], { 
            hour: '2-digit', 
            minute: '2-digit' 
        });
        
        const messageHtml = `
            <div class="message-container ${message.role}" id="msg-${message.id}">
                ${!isUser ? `
                    <div class="avatar assistant" aria-label="${CONFIG.AI_NAME}'s avatar">
                        <i class="fas fa-robot"></i>
                    </div>
                ` : ''}
                
                <div class="message-content">
                    <div class="message-bubble ${message.role}" role="text">
                        <div class="message-text">
                            ${formatMessage(message.content)}
                        </div>
                        <div class="message-time" aria-label="Sent at ${formattedTime}">
                            ${formattedTime}
                        </div>
                    </div>
                    
                    ${!isUser ? `
                        <div class="message-actions">
                            <button class="action-btn copy-btn" data-message-id="${message.id}" 
                                    aria-label="Copy message" title="Copy message">
                                <i class="fas fa-copy"></i>
                            </button>
                            <button class="action-btn regenerate-btn" aria-label="Regenerate response" 
                                    title="Regenerate response">
                                <i class="fas fa-redo"></i>
                            </button>
                        </div>
                    ` : ''}
                </div>
                
                ${isUser ? `
                    <div class="avatar user" aria-label="Your avatar">
                        <i class="fas fa-user"></i>
                    </div>
                ` : ''}
            </div>
        `;
        
        messagesHtml += messageHtml;
    });
    
    elements.messagesContainer.innerHTML = messagesHtml;
}

function renderChatList() {
    let chatListHtml = '';
    
    state.chats.forEach(chat => {
        const isActive = chat.id === state.currentChatId;
        const lastUpdated = formatChatTime(chat.updatedAt);
        
        chatListHtml += `
            <button class="chat-item ${isActive ? 'active' : ''}" 
                    data-chat-id="${chat.id}" 
                    aria-label="${chat.title}, ${lastUpdated}, ${chat.messageCount || 0} messages"
                    role="listitem">
                <div class="chat-item-header">
                    <i class="fas fa-comment${isActive ? '-dots' : ''}"></i>
                    <span class="chat-item-title">${chat.title}</span>
                    <div class="chat-item-actions">
                        <button class="action-btn delete-chat-btn" data-chat-id="${chat.id}" 
                                aria-label="Delete chat" title="Delete chat">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
                <div class="chat-item-info">
                    <span>${chat.messageCount || 0} messages</span>
                    <span>${lastUpdated}</span>
                </div>
            </button>
        `;
    });
    
    elements.chatList.innerHTML = chatListHtml;
}

function renderPrompts() {
    let promptsHtml = '';
    
    PROMPT_SUGGESTIONS.forEach((prompt, i) => {
        promptsHtml += `
            <button class="prompt-card" data-prompt-index="${i}" 
                    aria-label="${prompt.category}: ${prompt.text}">
                <div class="prompt-header">
                    <div class="prompt-icon">
                        <i class="${prompt.icon}"></i>
                    </div>
                    <span class="prompt-category">${prompt.category}</span>
                </div>
                <p class="prompt-text">${prompt.text}</p>
            </button>
        `;
    });
    
    elements.promptGrid.innerHTML = promptsHtml;
}

function formatChatTime(timestamp) {
    const now = new Date();
    const date = new Date(timestamp);
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
}

function toggleSidebar(show) {
    state.showSidebar = show;
    if (show) {
        elements.sidebar.classList.add('show');
        elements.overlay.style.display = 'block';
        elements.openSidebar.setAttribute('aria-expanded', 'true');
    } else {
        elements.sidebar.classList.remove('show');
        elements.overlay.style.display = 'none';
        elements.openSidebar.setAttribute('aria-expanded', 'false');
    }
}

function toggleTheme() {
    state.isDarkMode = !state.isDarkMode;
    localStorage.setItem('kres_ai_theme', state.isDarkMode ? 'dark' : 'light');
    applySettings();
    showNotification(`Switched to ${state.isDarkMode ? 'dark' : 'light'} mode`, 'success');
}

function scrollToBottom() {
    if (state.settings.autoScroll) {
        setTimeout(() => {
            elements.messagesEnd.scrollIntoView({ behavior: 'smooth', block: 'end' });
        }, 100);
    }
}

function updateStats() {
    const totalChats = state.chats.length;
    const totalMessages = state.chats.reduce((sum, chat) => sum + (chat.messageCount || 0), 0);
    
    elements.totalChats.textContent = totalChats;
    elements.totalMessages.textContent = totalMessages;
}

async function exportChat() {
    const chatId = state.currentChatId;
    const messages = state.messages[chatId] || [];
    const chat = state.chats.find(c => c.id === chatId);
    
    if (!messages.length) {
        showNotification('No messages to export', 'warning');
        return;
    }
    
    let exportText = `Chat with ${CONFIG.AI_NAME}\n`;
    exportText += `Date: ${new Date().toLocaleString()}\n`;
    exportText += `Title: ${chat?.title || 'Untitled'}\n\n`;
    exportText += '='.repeat(50) + '\n\n';
    
    messages.forEach(msg => {
        const sender = msg.role === 'user' ? 'You' : CONFIG.AI_NAME;
        const time = new Date(msg.timestamp).toLocaleTimeString();
        exportText += `${sender} (${time}):\n`;
        exportText += msg.content + '\n\n';
    });
    
    const blob = new Blob([exportText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `kres_chat_${new Date().toISOString().split('T')[0]}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    showNotification('Chat exported successfully!', 'success');
}

async function clearHistory() {
    if (!confirm('Are you sure you want to clear all chat history? This action cannot be undone.')) {
        return;
    }
    
    try {
        await clearDB('chats');
        await clearDB('messages');
        
        state.chats = [];
        state.messages = {};
        state.currentChatId = null;
        
        await createNewChat();
        showNotification('Chat history cleared', 'success');
    } catch (error) {
        console.error('Error clearing history:', error);
        showNotification('Error clearing history', 'error');
    }
}

async function deleteChat(chatId) {
    if (!confirm('Are you sure you want to delete this chat?')) {
        return;
    }
    
    try {
       
        await deleteFromDB('chats', chatId);
        
        const messages = state.messages[chatId] || [];
        for (const msg of messages) {
            await deleteFromDB('messages', msg.id);
        }
        
        state.chats = state.chats.filter(c => c.id !== chatId);
        delete state.messages[chatId];
        
        if (state.chats.length > 0) {
            state.currentChatId = state.chats[0].id;
            await loadMessages(state.currentChatId);
        } else {
            await createNewChat();
        }
        
        renderChatList();
        updateStats();
        showNotification('Chat deleted', 'success');
    } catch (error) {
        console.error('Error deleting chat:', error);
        showNotification('Error deleting chat', 'error');
    }
}

async function copyToClipboard(text) {
    try {
        await navigator.clipboard.writeText(text);
        showNotification('Copied to clipboard!', 'success');
    } catch (error) {
        console.error('Error copying to clipboard:', error);
        showNotification('Error copying to clipboard', 'error');
    }
}

async function initApp() {
    try {
        
        await initDatabase();
        
        await loadSettings();
        
        const savedTheme = localStorage.getItem('kres_ai_theme');
        if (savedTheme) {
            state.isDarkMode = savedTheme === 'dark';
        } else {
            
            state.isDarkMode = window.matchMedia('(prefers-color-scheme: dark)').matches;
        }
        
        await loadChats();
        
        if (state.currentChatId && state.messages[state.currentChatId]) {
            const hasUserMessages = state.messages[state.currentChatId].some(msg => msg.role === 'user');
            if (hasUserMessages) {
                elements.welcomeScreen.style.display = 'none';
            }
        }
        
        renderPrompts();
        
        setupEventListeners();
        
        applySettings();
        
        setTimeout(() => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
        enableVoiceInput(); 
    } else {
        elements.voiceBtn.disabled = true;
        elements.voiceBtn.title = 'Voice input not supported';
        showNotification('Voice input requires Chrome or Edge browser', 'info');
    }
}, 1000);
 
        scrollToBottom();
  
        setTimeout(() => {
            showNotification(`Welcome to ${CONFIG.AI_NAME}! 👋 Start chatting below.`, 'success');
        }, 1000);
        
        console.log('App initialized successfully');
        
    } catch (error) {
        console.error('Error initializing app:', error);
        showNotification('Error initializing app. Please refresh.', 'error');
    }
}

function enableVoiceInput() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
        elements.voiceBtn.disabled = true;
        elements.voiceBtn.title = 'Voice not supported in this browser';
        elements.voiceBtn.innerHTML = '<i class="fas fa-microphone-slash"></i>';
        showNotification('Voice input not supported. Use Chrome or Edge.', 'info');
        return;
    }

    elements.voiceBtn.addEventListener('click', () => {
        const recognition = new SpeechRecognition();
        recognition.lang = 'en-US';
        recognition.start();

        recognition.onstart = () => {
            elements.voiceBtn.innerHTML = '<i class="fas fa-microphone-slash"></i>';
            elements.voiceBtn.style.color = 'var(--error)';
            elements.voiceBtn.title = 'Listening... Speak now';
            showNotification('Listening... Speak now!', 'info');
        };

        recognition.onresult = (event) => {
            const transcript = event?.results?.[0]?.[0]?.transcript;
            if (transcript) {
                elements.messageInput.value += transcript + ' ';
                updateSendButton();
                autoResizeTextarea();
                showNotification('Voice message added!', 'success');
            }
        };

        recognition.onerror = () => {
            showNotification('Voice input failed. Try again.', 'error');
        };

        recognition.onend = () => {
            elements.voiceBtn.innerHTML = '<i class="fas fa-microphone"></i>';
            elements.voiceBtn.style.color = '';
            elements.voiceBtn.title = 'Start voice input';
        };
    });
}

function setupEventListeners() {

    elements.closeSidebar.addEventListener('click', () => toggleSidebar(false));
    elements.openSidebar.addEventListener('click', () => toggleSidebar(true));
    elements.overlay.addEventListener('click', () => toggleSidebar(false));
    
    elements.newChatBtn.addEventListener('click', createNewChat);

    elements.themeToggle.addEventListener('click', toggleTheme);

    elements.messageForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const message = elements.messageInput.value.trim();
        if (message) {
            sendMessage(message);
            elements.messageInput.value = '';
            updateSendButton();
            autoResizeTextarea();
        }
    });

elements.messageInput.addEventListener('input', () => {
    updateSendButton();
    autoResizeTextarea();
});

elements.messageInput.addEventListener('keydown', (e) => {

    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        elements.messageForm.requestSubmit();
    }
});

    elements.attachBtn.addEventListener('click', () => {
        showNotification('File attachment coming soon!', 'info');
    });
    elements.clearHistoryBtn.addEventListener('click', clearHistory);

    elements.exportBtn.addEventListener('click', exportChat);

    elements.helpBtn.addEventListener('click', () => {
        alert(`${CONFIG.AI_NAME} Help:\n\n• Type your message and press Enter to send\n• Enter for new line\n• Click prompts to start chatting\n• Use sidebar to switch chats\n• Click on the microphone for voice input`);
    });

    elements.settingsBtn.addEventListener('click', () => {
        elements.settingsModal.classList.add('show');
        elements.settingsModal.setAttribute('aria-hidden', 'false');
    });
    
    elements.closeModal.addEventListener('click', () => {
        elements.settingsModal.classList.remove('show');
        elements.settingsModal.setAttribute('aria-hidden', 'true');
    });
    
    elements.saveSettings.addEventListener('click', () => {
        state.settings.apiKey = document.getElementById('apiKey').value.trim();
        state.settings.autoScroll = document.getElementById('autoScroll').checked;
        state.settings.soundEffects = document.getElementById('soundEffects').checked;
        state.settings.responseSpeed = document.getElementById('responseSpeed').value;
        state.settings.fontSize = document.getElementById('fontSize').value;
        
        saveSettings();
        elements.settingsModal.classList.remove('show');
        elements.settingsModal.setAttribute('aria-hidden', 'true');
    });
    
    elements.resetSettings.addEventListener('click', () => {
        if (confirm('Reset all settings to defaults?')) {
            state.settings = {
                autoScroll: true,
                soundEffects: true,
                responseSpeed: 'normal',
                fontSize: 'medium',
                apiKey: ''
            };
            saveSettings();
        }
    });

    elements.settingsModal.addEventListener('click', (e) => {
        if (e.target === elements.settingsModal) {
            elements.settingsModal.classList.remove('show');
            elements.settingsModal.setAttribute('aria-hidden', 'true');
        }
    });

    elements.promptGrid.addEventListener('click', (e) => {
        const promptCard = e.target.closest('.prompt-card');
        if (promptCard) {
            const promptIndex = promptCard.dataset.promptIndex;
            const promptText = PROMPT_SUGGESTIONS[promptIndex].text;
            elements.messageInput.value = promptText;
            elements.messageInput.focus();
            updateSendButton();
            autoResizeTextarea();
            showNotification('Prompt added to input!', 'success');
        }
    });

    document.addEventListener('click', async (e) => {
  
        if (e.target.closest('.copy-btn')) {
            const messageId = e.target.closest('.copy-btn').dataset.messageId;
            const messageElement = document.getElementById(`msg-${messageId}`);
            if (messageElement) {
                const messageText = messageElement.querySelector('.message-text').textContent;
                await copyToClipboard(messageText);
            }
        }

        if (e.target.closest('.regenerate-btn')) {
            showNotification('Regenerate feature coming soon!', 'info');
        }
        
        if (e.target.closest('.delete-chat-btn')) {
            const chatId = e.target.closest('.delete-chat-btn').dataset.chatId;
            await deleteChat(chatId);
        }

        if (e.target.closest('.chat-item') && !e.target.closest('.delete-chat-btn')) {
            const chatItem = e.target.closest('.chat-item');
            const chatId = chatItem.dataset.chatId;
            await selectChat(chatId);
        }
    });

    document.addEventListener('keydown', (e) => {

        if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
            e.preventDefault();
            createNewChat();
        }

        if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
            e.preventDefault();
            elements.messageInput.focus();
        }
 
        if (e.key === 'Escape') {
            if (state.showSidebar) {
                toggleSidebar(false);
            }
            if (elements.settingsModal.classList.contains('show')) {
                elements.settingsModal.classList.remove('show');
                elements.settingsModal.setAttribute('aria-hidden', 'true');
            }
        }
    });

    window.addEventListener('resize', () => {
        autoResizeTextarea();
        if (window.innerWidth >= 1024 && !state.showSidebar) {
            toggleSidebar(true);
        }
    });
}

function updateSendButton() {
    const hasText = elements.messageInput.value.trim().length > 0;
    elements.sendBtn.disabled = !hasText || state.isTyping;
    elements.sendBtn.setAttribute('aria-label', hasText ? 'Send message' : 'Type a message to enable send');
}

function autoResizeTextarea() {
    const textarea = elements.messageInput;
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 150) + 'px';
}

document.addEventListener('DOMContentLoaded', initApp);

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js').catch(error => {
            console.log('ServiceWorker registration failed:', error);
        });
    });
}
