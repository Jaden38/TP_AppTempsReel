// Variables globales
let ws = null;
let username = null;
let userColor = null;
let isTyping = false;
let typingTimeout = null;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 5;
const RECONNECT_DELAY = 3000;

// Éléments DOM
const elements = {
    usernameModal: document.getElementById('usernameModal'),
    usernameInput: document.getElementById('usernameInput'),
    setUsernameBtn: document.getElementById('setUsernameBtn'),
    usernameError: document.getElementById('usernameError'),
    statusIndicator: document.getElementById('statusIndicator'),
    statusText: document.getElementById('statusText'),
    currentUser: document.getElementById('currentUser'),
    messagesContainer: document.getElementById('messagesContainer'),
    messageInput: document.getElementById('messageInput'),
    sendBtn: document.getElementById('sendBtn'),
    usersList: document.getElementById('usersList'),
    userCount: document.getElementById('userCount'),
    typingIndicator: document.getElementById('typingIndicator'),
    charCount: document.getElementById('charCount'),
    notificationSound: document.getElementById('notificationSound')
};

// Initialisation
document.addEventListener('DOMContentLoaded', () => {
    setupEventListeners();
    connectWebSocket();
});

// Configuration des écouteurs d'événements
function setupEventListeners() {
    // Bouton définir nom d'utilisateur
    elements.setUsernameBtn.addEventListener('click', setUsername);
    elements.usernameInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            setUsername();
        }
    });

    // Envoi de message
    elements.sendBtn.addEventListener('click', sendMessage);
    elements.messageInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });

    // Indicateur de frappe
    elements.messageInput.addEventListener('input', handleTyping);

    // Compteur de caractères
    elements.messageInput.addEventListener('input', updateCharCount);
}

// Connexion WebSocket
function connectWebSocket() {
    // Détection automatique du protocole et de l'hôte pour production
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}`;
    
    console.log('Tentative de connexion à:', wsUrl);
    
    try {
        ws = new WebSocket(wsUrl);
        
        ws.onopen = handleWebSocketOpen;
        ws.onmessage = handleWebSocketMessage;
        ws.onclose = handleWebSocketClose;
        ws.onerror = handleWebSocketError;
    } catch (error) {
        console.error('Erreur de connexion WebSocket:', error);
        updateConnectionStatus(false);
        scheduleReconnect();
    }
}

// Gestionnaires WebSocket
function handleWebSocketOpen() {
    console.log('✅ Connexion WebSocket établie');
    updateConnectionStatus(true);
    reconnectAttempts = 0;
    
    // Si on avait déjà un username, on le renvoie
    if (username) {
        ws.send(JSON.stringify({
            type: 'setUsername',
            username: username
        }));
    }
}

function handleWebSocketMessage(event) {
    try {
        const message = JSON.parse(event.data);
        console.log('Message reçu:', message);
        
        switch (message.type) {
            case 'welcome':
                addSystemMessage(message.message);
                break;
                
            case 'usernameSet':
                handleUsernameSet(message);
                break;
                
            case 'userJoined':
                handleUserJoined(message);
                break;
                
            case 'userLeft':
                handleUserLeft(message);
                break;
                
            case 'message':
                handleChatMessage(message);
                break;
                
            case 'private':
                handlePrivateMessage(message);
                break;
                
            case 'private_sent':
                handlePrivateMessageSent(message);
                break;
                
            case 'typing':
                handleTypingIndicator(message);
                break;
                
            case 'error':
                handleError(message);
                break;
                
            case 'serverShutdown':
                addSystemMessage('⚠️ Le serveur va s\'arrêter...', 'warning');
                break;
        }
    } catch (error) {
        console.error('Erreur lors du traitement du message:', error);
    }
}

function handleWebSocketClose() {
    console.log('❌ Connexion WebSocket fermée');
    updateConnectionStatus(false);
    
    if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
        scheduleReconnect();
    } else {
        addSystemMessage('❌ Impossible de se reconnecter au serveur. Veuillez rafraîchir la page.', 'error');
    }
}

function handleWebSocketError(error) {
    console.error('❌ Erreur WebSocket:', error);
    updateConnectionStatus(false);
}

// Gestion du nom d'utilisateur
function setUsername() {
    const inputUsername = elements.usernameInput.value.trim();
    
    if (!inputUsername) {
        showUsernameError('Veuillez entrer un nom d\'utilisateur');
        return;
    }
    
    if (inputUsername.length < 2 || inputUsername.length > 20) {
        showUsernameError('Le nom doit contenir entre 2 et 20 caractères');
        return;
    }
    
    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
            type: 'setUsername',
            username: inputUsername
        }));
    } else {
        showUsernameError('Connexion au serveur perdue. Veuillez rafraîchir la page.');
    }
}

function handleUsernameSet(message) {
    username = message.username;
    userColor = message.color;
    
    elements.usernameModal.classList.remove('active');
    elements.currentUser.textContent = `👤 ${username}`;
    elements.currentUser.style.color = userColor;
    
    elements.messageInput.disabled = false;
    elements.sendBtn.disabled = false;
    elements.messageInput.focus();
    
    addSystemMessage(`✅ Vous êtes connecté en tant que ${username}`, 'success');
}

function showUsernameError(message) {
    elements.usernameError.textContent = message;
    setTimeout(() => {
        elements.usernameError.textContent = '';
    }, 3000);
}

// Gestion des utilisateurs
function handleUserJoined(message) {
    updateUsersList(message.userList);
    addSystemMessage(`👋 ${message.username} a rejoint le chat`, 'user-joined');
    playNotificationSound();
}

function handleUserLeft(message) {
    updateUsersList(message.userList);
    addSystemMessage(`👋 ${message.username} a quitté le chat`, 'user-left');
}

function updateUsersList(users) {
    elements.usersList.innerHTML = '';
    elements.userCount.textContent = users.length;
    
    users.forEach(user => {
        const li = document.createElement('li');
        li.className = 'user-item';
        li.innerHTML = `
            <span class="user-indicator" style="background-color: ${user.color}"></span>
            <span>${user.username}</span>
        `;
        li.addEventListener('click', () => {
            elements.messageInput.value = `/msg ${user.username} `;
            elements.messageInput.focus();
        });
        elements.usersList.appendChild(li);
    });
}

// Gestion des messages
function sendMessage() {
    const text = elements.messageInput.value.trim();
    
    if (!text) return;
    
    // Commandes locales
    if (text === '/clear') {
        clearChat();
        elements.messageInput.value = '';
        return;
    }
    
    if (text === '/help') {
        showHelp();
        elements.messageInput.value = '';
        return;
    }
    
    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
            type: 'message',
            text: text
        }));
        
        // Ajouter immédiatement le message pour l'expéditeur
        if (!text.startsWith('/msg ')) {
            addChatMessage({
                username: username,
                text: text,
                color: userColor,
                timestamp: new Date().toISOString()
            }, true);
        }
        
        elements.messageInput.value = '';
        updateCharCount();
    }
}

function handleChatMessage(message) {
    // Ne pas afficher le message si c'est nous qui l'avons envoyé
    if (message.username !== username) {
        addChatMessage(message);
        playNotificationSound();
    }
}

function handlePrivateMessage(message) {
    addPrivateMessage(message, 'received');
    playNotificationSound();
}

function handlePrivateMessageSent(message) {
    addPrivateMessage(message, 'sent');
}

function addChatMessage(message, isSelf = false) {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message';
    
    const time = new Date(message.timestamp).toLocaleTimeString('fr-FR', {
        hour: '2-digit',
        minute: '2-digit'
    });
    
    messageDiv.innerHTML = `
        <div class="message-header">
            <span class="message-username" style="color: ${message.color}">${message.username}</span>
            <span class="message-time">${time}</span>
        </div>
        <div class="message-text">${escapeHtml(message.text)}</div>
    `;
    
    elements.messagesContainer.appendChild(messageDiv);
    scrollToBottom();
}

function addPrivateMessage(message, direction) {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message private';
    
    const time = new Date(message.timestamp || new Date()).toLocaleTimeString('fr-FR', {
        hour: '2-digit',
        minute: '2-digit'
    });
    
    const label = direction === 'received' ? `Message privé de ${message.from}` : `Message privé à ${message.to}`;
    
    messageDiv.innerHTML = `
        <div class="message-header">
            <span class="private-indicator">Privé</span>
            <span class="message-username">${label}</span>
            <span class="message-time">${time}</span>
        </div>
        <div class="message-text">${escapeHtml(message.message)}</div>
    `;
    
    elements.messagesContainer.appendChild(messageDiv);
    scrollToBottom();
}

function addSystemMessage(text, className = '') {
    const messageDiv = document.createElement('div');
    messageDiv.className = `system-message ${className}`;
    messageDiv.innerHTML = `<p>${text}</p>`;
    
    elements.messagesContainer.appendChild(messageDiv);
    scrollToBottom();
}

// Indicateur de frappe
function handleTyping() {
    if (!username || !ws || ws.readyState !== WebSocket.OPEN) return;
    
    if (!isTyping) {
        isTyping = true;
        ws.send(JSON.stringify({
            type: 'typing',
            isTyping: true
        }));
    }
    
    clearTimeout(typingTimeout);
    typingTimeout = setTimeout(() => {
        isTyping = false;
        ws.send(JSON.stringify({
            type: 'typing',
            isTyping: false
        }));
    }, 1000);
}

function handleTypingIndicator(message) {
    if (message.username === username) return;
    
    const typingUsers = Array.from(document.querySelectorAll('.typing-user'))
        .map(el => el.dataset.username);
    
    if (message.isTyping) {
        if (!typingUsers.includes(message.username)) {
            updateTypingIndicator([...typingUsers, message.username]);
        }
    } else {
        updateTypingIndicator(typingUsers.filter(u => u !== message.username));
    }
}

function updateTypingIndicator(users) {
    if (users.length === 0) {
        elements.typingIndicator.innerHTML = '';
        return;
    }
    
    const text = users.length === 1 
        ? `${users[0]} est en train d'écrire...`
        : `${users.join(', ')} sont en train d'écrire...`;
    
    elements.typingIndicator.innerHTML = users.map(u => 
        `<span class="typing-user" data-username="${u}"></span>`
    ).join('') + text;
}

// Utilitaires
function updateConnectionStatus(connected) {
    if (connected) {
        elements.statusIndicator.classList.add('connected');
        elements.statusText.textContent = 'Connecté';
    } else {
        elements.statusIndicator.classList.remove('connected');
        elements.statusText.textContent = 'Déconnecté';
    }
}

function updateCharCount() {
    const length = elements.messageInput.value.length;
    elements.charCount.textContent = `${length}/500`;
    
    if (length > 400) {
        elements.charCount.style.color = 'var(--warning-color)';
    } else if (length > 450) {
        elements.charCount.style.color = 'var(--danger-color)';
    } else {
        elements.charCount.style.color = 'var(--text-secondary)';
    }
}

function scrollToBottom() {
    elements.messagesContainer.scrollTop = elements.messagesContainer.scrollHeight;
}

function clearChat() {
    elements.messagesContainer.innerHTML = '';
    addSystemMessage('💬 Chat effacé localement');
}

function showHelp() {
    const helpMessage = `
        <strong>Commandes disponibles:</strong><br>
        <code>/msg [utilisateur] [message]</code> - Envoyer un message privé<br>
        <code>/clear</code> - Effacer le chat (local uniquement)<br>
        <code>/help</code> - Afficher cette aide
    `;
    
    const messageDiv = document.createElement('div');
    messageDiv.className = 'system-message';
    messageDiv.innerHTML = helpMessage;
    elements.messagesContainer.appendChild(messageDiv);
    scrollToBottom();
}

function playNotificationSound() {
    if (document.hidden) {
        elements.notificationSound.play().catch(e => console.log('Audio autoplay prevented'));
    }
}

function escapeHtml(text) {
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
}

function handleError(message) {
    if (message.message.includes('nom d\'utilisateur')) {
        showUsernameError(message.message);
    } else {
        addSystemMessage(`❌ ${message.message}`, 'error');
    }
}

function scheduleReconnect() {
    reconnectAttempts++;
    addSystemMessage(`🔄 Tentative de reconnexion dans ${RECONNECT_DELAY / 1000} secondes... (${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})`);
    
    setTimeout(() => {
        connectWebSocket();
    }, RECONNECT_DELAY);
}

// Gestion de la fermeture de page
window.addEventListener('beforeunload', () => {
    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.close();
    }
});