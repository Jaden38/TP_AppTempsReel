// Variables globales
let socket = null;
let currentUser = null;
let currentRoom = null;
let typingUsers = new Map();
let typingTimeout = null;
let isUpdating = false;

// Éléments DOM
const loginScreen = document.getElementById('loginScreen');
const editorScreen = document.getElementById('editorScreen');
const usernameInput = document.getElementById('username');
const roomIdInput = document.getElementById('roomId');
const tokenInput = document.getElementById('token');
const editor = document.getElementById('editor');
const userList = document.getElementById('userList');
const notifications = document.getElementById('notifications');
const typingIndicators = document.getElementById('typingIndicators');
const loginError = document.getElementById('loginError');
const loginSpinner = document.getElementById('loginSpinner');

// Initialisation
document.addEventListener('DOMContentLoaded', () => {
    // Auto-focus sur le champ username
    usernameInput.focus();
    
    // Gestion des entrées clavier
    usernameInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            roomIdInput.focus();
        }
    });
    
    roomIdInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            tokenInput.focus();
        }
    });
    
    tokenInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            joinRoom();
        }
    });
    
    // Gestion de l'éditeur
    editor.addEventListener('input', handleEditorInput);
    editor.addEventListener('keydown', handleTyping);
});

// Créer une nouvelle room
async function createRoom() {
    showLoginSpinner(true);
    hideError();
    
    try {
        const response = await fetch('/api/create-room', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        if (!response.ok) {
            throw new Error('Erreur lors de la création de la room');
        }
        
        const data = await response.json();
        
        // Remplir automatiquement les champs
        roomIdInput.value = data.roomId;
        tokenInput.value = data.token;
        
        // Afficher le token pour que l'utilisateur puisse le partager
        showNotification(`Room créée ! Token: ${data.token}`, 'success');
        
        // Focus sur le champ username
        if (!usernameInput.value) {
            usernameInput.focus();
        }
        
    } catch (error) {
        showError('Impossible de créer une room. Veuillez réessayer.');
        console.error('Error creating room:', error);
    } finally {
        showLoginSpinner(false);
    }
}

// Rejoindre une room existante
function joinRoom() {
    const username = usernameInput.value.trim();
    const roomId = roomIdInput.value.trim();
    const token = tokenInput.value.trim();
    
    // Validation
    if (!username) {
        showError('Veuillez entrer un nom d\'utilisateur');
        usernameInput.focus();
        return;
    }
    
    if (!roomId) {
        showError('Veuillez entrer l\'ID de la room');
        roomIdInput.focus();
        return;
    }
    
    if (!token) {
        showError('Veuillez entrer le token d\'accès');
        tokenInput.focus();
        return;
    }
    
    // Sauvegarde des informations
    currentUser = username;
    currentRoom = roomId;
    
    // Connexion Socket.IO
    connectToServer(username, roomId, token);
}

// Connexion au serveur Socket.IO
function connectToServer(username, roomId, token) {
    showLoginSpinner(true);
    hideError();
    
    // Connexion avec authentification
    socket = io({
        auth: {
            username: username,
            roomId: roomId,
            token: token
        },
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        reconnectionAttempts: 5
    });
    
    // Gestion de la connexion réussie
    socket.on('connect', () => {
        console.log('Connected to server');
        showLoginSpinner(false);
        switchToEditor();
    });
    
    // Initialisation de l'éditeur
    socket.on('initialize', (data) => {
        isUpdating = true;
        editor.value = data.content || '';
        updateStats();
        isUpdating = false;
        
        // Mettre à jour la liste des utilisateurs
        updateUserList(data.users);
    });
    
    // Réception des mises à jour
    socket.on('update', (data) => {
        if (data.userId !== socket.id) {
            isUpdating = true;
            const cursorPosition = editor.selectionStart;
            editor.value = data.content;
            
            // Essayer de restaurer la position du curseur intelligemment
            if (cursorPosition <= editor.value.length) {
                editor.setSelectionRange(cursorPosition, cursorPosition);
            }
            
            updateStats();
            isUpdating = false;
        }
    });
    
    // Gestion des notifications
    socket.on('notification', (data) => {
        let cssClass = 'success';
        if (data.type === 'user-left') cssClass = 'warning';
        if (data.type === 'server-shutdown') cssClass = 'error';
        
        addNotification(data.message, cssClass);
    });
    
    // Mise à jour de la liste des utilisateurs
    socket.on('users-update', (users) => {
        updateUserList(users);
    });
    
    // Indicateur de frappe
    socket.on('typing', (data) => {
        if (data.userId !== socket.id) {
            if (data.isTyping) {
                typingUsers.set(data.userId, data.username);
            } else {
                typingUsers.delete(data.userId);
            }
            updateTypingIndicator();
        }
    });
    
    // Gestion des erreurs de connexion
    socket.on('connect_error', (error) => {
        console.error('Connection error:', error);
        showError(error.message || 'Impossible de se connecter au serveur');
        showLoginSpinner(false);
        
        if (socket) {
            socket.disconnect();
            socket = null;
        }
    });
    
    // Gestion de la déconnexion
    socket.on('disconnect', (reason) => {
        console.log('Disconnected:', reason);
        if (reason === 'io server disconnect') {
            // Le serveur a forcé la déconnexion
            switchToLogin();
            showError('Déconnecté par le serveur');
        } else if (reason === 'transport close' || reason === 'transport error') {
            // Problème de réseau
            addNotification('Connexion perdue. Tentative de reconnexion...', 'error');
        }
    });
    
    // Reconnexion réussie
    socket.on('reconnect', () => {
        addNotification('Reconnecté au serveur', 'success');
    });
    
    // Échec de reconnexion
    socket.on('reconnect_failed', () => {
        addNotification('Impossible de se reconnecter', 'error');
        switchToLogin();
    });
}

// Basculer vers l'éditeur
function switchToEditor() {
    loginScreen.style.display = 'none';
    editorScreen.style.display = 'block';
    
    // Mettre à jour les badges
    document.getElementById('roomBadge').textContent = `Room: ${currentRoom}`;
    document.getElementById('userBadge').textContent = `User: ${currentUser}`;
    
    // Focus sur l'éditeur
    editor.focus();
}

// Basculer vers l'écran de connexion
function switchToLogin() {
    editorScreen.style.display = 'none';
    loginScreen.style.display = 'block';
    
    // Réinitialiser l'état
    currentUser = null;
    currentRoom = null;
    editor.value = '';
    userList.innerHTML = '';
    notifications.innerHTML = '';
    typingUsers.clear();
    updateTypingIndicator();
}

// Déconnexion
function disconnect() {
    if (socket) {
        socket.disconnect();
        socket = null;
    }
    switchToLogin();
    showNotification('Déconnecté avec succès', 'success');
}

// Gestion de l'éditeur
function handleEditorInput(e) {
    if (!isUpdating && socket && socket.connected) {
        // Envoyer la mise à jour
        socket.emit('update', {
            content: editor.value
        });
        
        // Mettre à jour les statistiques
        updateStats();
    }
}

// Gestion de la frappe
function handleTyping() {
    if (!socket || !socket.connected) return;
    
    // Indiquer que l'utilisateur tape
    socket.emit('typing', true);
    
    // Annuler le timeout précédent
    if (typingTimeout) {
        clearTimeout(typingTimeout);
    }
    
    // Arrêter l'indicateur après 1 seconde d'inactivité
    typingTimeout = setTimeout(() => {
        socket.emit('typing', false);
    }, 1000);
}

// Mettre à jour l'indicateur de frappe
function updateTypingIndicator() {
    if (typingUsers.size === 0) {
        typingIndicators.innerHTML = '';
        return;
    }
    
    const names = Array.from(typingUsers.values());
    let text = '';
    
    if (names.length === 1) {
        text = `${names[0]} est en train de taper...`;
    } else if (names.length === 2) {
        text = `${names[0]} et ${names[1]} sont en train de taper...`;
    } else {
        text = `${names.length} personnes sont en train de taper...`;
    }
    
    typingIndicators.innerHTML = `<i>✏️ ${text}</i>`;
}

// Mettre à jour la liste des utilisateurs
function updateUserList(users) {
    userList.innerHTML = '';
    
    users.forEach(user => {
        const li = document.createElement('li');
        li.className = 'user-item';
        
        const avatar = document.createElement('div');
        avatar.className = 'user-avatar';
        avatar.textContent = user.username.charAt(0).toUpperCase();
        
        const name = document.createElement('div');
        name.className = 'user-name';
        name.textContent = user.username;
        if (user.id === socket?.id) {
            name.textContent += ' (vous)';
        }
        
        const status = document.createElement('div');
        status.className = 'user-status';
        
        li.appendChild(avatar);
        li.appendChild(name);
        li.appendChild(status);
        
        userList.appendChild(li);
    });
}

// Ajouter une notification
function addNotification(message, cssClass = '') {
    const notification = document.createElement('div');
    notification.className = `notification ${cssClass}`;
    
    const time = new Date().toLocaleTimeString('fr-FR', {
        hour: '2-digit',
        minute: '2-digit'
    });
    
    notification.innerHTML = `
        <strong>${time}</strong> - ${message}
    `;
    
    notifications.insertBefore(notification, notifications.firstChild);
    
    // Limiter le nombre de notifications affichées
    while (notifications.children.length > 10) {
        notifications.removeChild(notifications.lastChild);
    }
    
    // Auto-scroll
    notifications.scrollTop = 0;
}

// Mettre à jour les statistiques
function updateStats() {
    const text = editor.value;
    
    // Nombre de caractères
    document.getElementById('charCount').textContent = text.length;
    
    // Nombre de mots
    const words = text.trim().split(/\s+/).filter(word => word.length > 0);
    document.getElementById('wordCount').textContent = words.length;
    
    // Nombre de lignes
    const lines = text.split('\n');
    document.getElementById('lineCount').textContent = lines.length;
}

// Afficher une notification temporaire
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 15px 20px;
        background: white;
        border-radius: 8px;
        box-shadow: 0 4px 6px rgba(0,0,0,0.1);
        z-index: 9999;
        animation: slideIn 0.3s ease;
    `;
    
    notification.textContent = message;
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => {
            document.body.removeChild(notification);
        }, 300);
    }, 3000);
}

// Afficher/cacher les erreurs
function showError(message) {
    loginError.textContent = message;
    loginError.style.display = 'block';
}

function hideError() {
    loginError.style.display = 'none';
}

// Afficher/cacher le spinner
function showLoginSpinner(show) {
    loginSpinner.style.display = show ? 'block' : 'none';
}

// Animation CSS pour les notifications temporaires
const style = document.createElement('style');
style.textContent = `
    @keyframes slideOut {
        from {
            opacity: 1;
            transform: translateX(0);
        }
        to {
            opacity: 0;
            transform: translateX(100%);
        }
    }
`;
document.head.appendChild(style);

// Gestion du raccourci clavier pour les stats
document.addEventListener('keydown', (e) => {
    // Ctrl/Cmd + I pour afficher les infos de débogage
    if ((e.ctrlKey || e.metaKey) && e.key === 'i' && socket) {
        console.log('=== Debug Info ===');
        console.log('Socket ID:', socket.id);
        console.log('Connected:', socket.connected);
        console.log('Room:', currentRoom);
        console.log('User:', currentUser);
        console.log('==================');
        e.preventDefault();
    }
});