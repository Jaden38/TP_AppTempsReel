// Récupération des références aux éléments HTML
const textInput = document.getElementById('textInput');
const sendButton = document.getElementById('sendButton');
const output = document.getElementById('output');
const statusDot = document.getElementById('statusDot');
const statusText = document.getElementById('statusText');
const clientIdElement = document.getElementById('clientId');
const connectingOverlay = document.getElementById('connectingOverlay');

// Variables globales
let ws = null;
let clientId = null;
let reconnectTimer = null;
let messageHistory = [];

// Configuration
const WS_URL = 'ws://localhost:8080';
const RECONNECT_DELAY = 3000; // 3 secondes

/**
 * Formate un timestamp ISO en heure lisible
 */
function formatTime(isoString) {
    const date = new Date(isoString);
    return date.toLocaleTimeString('fr-FR', { 
        hour: '2-digit', 
        minute: '2-digit', 
        second: '2-digit' 
    });
}

/**
 * Échappe les caractères HTML pour éviter les injections
 */
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * Ajoute une animation de secousse
 */
const style = document.createElement('style');
style.textContent = `
    @keyframes shake {
        0%, 100% { transform: translateX(0); }
        25% { transform: translateX(-10px); }
        75% { transform: translateX(10px); }
    }
`;
document.head.appendChild(style);

/**
 * Gestionnaires d'événements
 */

// Événement: Clic sur le bouton d'envoi
sendButton.addEventListener('click', sendMessage);

// Événement: Appui sur Entrée dans le champ de texte
textInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        e.preventDefault();
        sendMessage();
    }
});

// Événement: Changement dans le champ de texte (pour visual feedback)
textInput.addEventListener('input', (e) => {
    // Activer/désactiver le bouton selon le contenu
    if (ws && ws.readyState === WebSocket.OPEN) {
        sendButton.disabled = !e.target.value.trim();
    }
});

// Événement: Chargement de la page
window.addEventListener('load', () => {
    console.log('🌟 Application WebSocket Client démarrée');
    console.log('📍 Tentative de connexion à:', WS_URL);
    
    // Initialiser la connexion WebSocket
    initWebSocket();
});

// Événement: Fermeture de la page
window.addEventListener('beforeunload', () => {
    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.close(1000, 'Client closing');
    }
    if (reconnectTimer) {
        clearTimeout(reconnectTimer);
    }
});

// Événement: Visibilité de la page (pour gérer les onglets inactifs)
document.addEventListener('visibilitychange', () => {
    if (!document.hidden && ws && ws.readyState === WebSocket.CLOSED) {
        console.log('🔄 Page redevenue visible, tentative de reconnexion...');
        initWebSocket();
    }
});

/**
 * Fonction utilitaire pour debug
 */
window.debugWebSocket = function() {
    console.log('=== Debug WebSocket ===');
    console.log('URL:', WS_URL);
    console.log('État:', ws ? ws.readyState : 'Non initialisé');
    console.log('Client ID:', clientId || 'Non assigné');
    console.log('Messages envoyés:', messageHistory.length);
    console.log('Timer de reconnexion:', reconnectTimer ? 'Actif' : 'Inactif');
    console.log('====================');
    return {
        ws,
        clientId,
        messageHistory,
        state: ws ? ['CONNECTING', 'OPEN', 'CLOSING', 'CLOSED'][ws.readyState] : 'NONE'
    };
};

console.log('💡 Astuce: Tapez debugWebSocket() dans la console pour voir l\'état de la connexion');

function initWebSocket() {
    console.log('🔄 Tentative de connexion au serveur WebSocket...');
    updateStatus('connecting', 'Connexion...');
    showConnectingOverlay(true);
    
    try {
        // Création de l'instance WebSocket
        ws = new WebSocket(WS_URL);
        
        // Événement: Connexion établie
        ws.onopen = handleOpen;
        
        // Événement: Message reçu
        ws.onmessage = handleMessage;
        
        // Événement: Connexion fermée
        ws.onclose = handleClose;
        
        // Événement: Erreur
        ws.onerror = handleError;
        
    } catch (error) {
        console.error('❌ Erreur lors de la création du WebSocket:', error);
        scheduleReconnect();
    }
}

/**
 * Gère l'ouverture de la connexion
 */
function handleOpen(event) {
    console.log('✅ Connecté au serveur WebSocket');
    updateStatus('connected', 'Connecté');
    showConnectingOverlay(false);
    
    // Activer les contrôles
    textInput.disabled = false;
    sendButton.disabled = false;
    textInput.focus();
    
    // Effacer le timer de reconnexion s'il existe
    if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
    }
}

/**
 * Gère la réception de messages
 */
function handleMessage(event) {
    try {
        const data = JSON.parse(event.data);
        console.log('📨 Message reçu:', data);
        
        switch(data.type) {
            case 'welcome':
                handleWelcomeMessage(data);
                break;
            case 'response':
                handleResponseMessage(data);
                break;
            case 'error':
                handleErrorMessage(data);
                break;
            case 'server-closing':
                handleServerClosing(data);
                break;
            default:
                console.warn('Type de message inconnu:', data.type);
        }
    } catch (error) {
        console.error('❌ Erreur lors du parsing du message:', error);
        displayError('Erreur lors du traitement de la réponse');
    }
}

/**
 * Gère le message de bienvenue
 */
function handleWelcomeMessage(data) {
    clientId = data.clientId;
    clientIdElement.textContent = `Client #${clientId}`;
    
    // Effacer l'état vide s'il existe
    clearEmptyState();
    
    // Afficher le message de bienvenue
    const messageElement = createMessageElement({
        type: 'welcome',
        content: data.message,
        time: formatTime(data.timestamp)
    });
    output.appendChild(messageElement);
    scrollToBottom();
}

/**
 * Gère les messages de réponse (texte capitalisé)
 */
function handleResponseMessage(data) {
    clearEmptyState();
    
    const messageElement = createMessageElement({
        type: 'response',
        original: data.original,
        capitalized: data.capitalized,
        time: formatTime(data.processedAt)
    });
    
    output.appendChild(messageElement);
    scrollToBottom();
    
    // Ajouter à l'historique
    messageHistory.push(data);
}

/**
 * Gère les messages d'erreur
 */
function handleErrorMessage(data) {
    displayError(data.message);
}

/**
 * Gère la notification de fermeture du serveur
 */
function handleServerClosing(data) {
    console.log('⚠️ Le serveur va s\'arrêter');
    displayError('Le serveur va s\'arrêter. Reconnexion automatique dans quelques secondes...');
}

/**
 * Gère la fermeture de la connexion
 */
function handleClose(event) {
    console.log(`👋 Connexion fermée (Code: ${event.code}, Raison: ${event.reason || 'Aucune'})`);
    updateStatus('disconnected', 'Déconnecté');
    
    // Désactiver les contrôles
    textInput.disabled = true;
    sendButton.disabled = true;
    
    // Réinitialiser l'ID client
    clientId = null;
    clientIdElement.textContent = 'Client #-';
    
    // Tenter une reconnexion automatique
    scheduleReconnect();
}

/**
 * Gère les erreurs de connexion
 */
function handleError(event) {
    console.error('❌ Erreur WebSocket:', event);
    displayError('Erreur de connexion au serveur');
}

/**
 * Envoie un message au serveur
 */
function sendMessage() {
    const message = textInput.value.trim();
    
    if (!message) {
        // Animation de secousse si le champ est vide
        textInput.style.animation = 'shake 0.5s';
        setTimeout(() => {
            textInput.style.animation = '';
        }, 500);
        return;
    }
    
    if (ws && ws.readyState === WebSocket.OPEN) {
        console.log(`📤 Envoi du message: "${message}"`);
        ws.send(message);
        
        // Effacer le champ et remettre le focus
        textInput.value = '';
        textInput.focus();
    } else {
        displayError('Impossible d\'envoyer le message. Connexion fermée.');
    }
}

/**
 * Programme une tentative de reconnexion
 */
function scheduleReconnect() {
    if (reconnectTimer) {
        return; // Une reconnexion est déjà programmée
    }
    
    console.log(`⏱️ Reconnexion dans ${RECONNECT_DELAY / 1000} secondes...`);
    updateStatus('disconnected', `Reconnexion dans ${RECONNECT_DELAY / 1000}s...`);
    
    reconnectTimer = setTimeout(() => {
        reconnectTimer = null;
        initWebSocket();
    }, RECONNECT_DELAY);
}

/**
 * Met à jour l'indicateur de statut
 */
function updateStatus(status, text) {
    statusDot.className = `status-dot ${status}`;
    statusText.textContent = text;
}

/**
 * Affiche/cache l'overlay de connexion
 */
function showConnectingOverlay(show) {
    if (show) {
        connectingOverlay.classList.add('show');
    } else {
        connectingOverlay.classList.remove('show');
    }
}

/**
 * Crée un élément de message pour l'affichage
 */
function createMessageElement(data) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message-item ${data.type}`;
    
    if (data.type === 'welcome') {
        messageDiv.innerHTML = `
            <div class="message-time">${data.time}</div>
            <div class="message-welcome">✨ ${data.content}</div>
        `;
    } else if (data.type === 'response') {
        messageDiv.innerHTML = `
            <div class="message-time">${data.time}</div>
            <div class="message-original">Original: ${escapeHtml(data.original)}</div>
            <div class="message-capitalized">${escapeHtml(data.capitalized)}</div>
        `;
    } else if (data.type === 'error') {
        messageDiv.innerHTML = `
            <div class="message-time">${data.time}</div>
            <div class="message-error">⚠️ ${data.content}</div>
        `;
    }
    
    return messageDiv;
}

/**
 * Affiche un message d'erreur
 */
function displayError(message) {
    clearEmptyState();
    
    const errorElement = createMessageElement({
        type: 'error',
        content: message,
        time: formatTime(new Date().toISOString())
    });
    
    output.appendChild(errorElement);
    scrollToBottom();
}

/**
 * Efface l'état vide
 */
function clearEmptyState() {
    const emptyState = output.querySelector('.empty-state');
    if (emptyState) {
        emptyState.remove();
    }
}

/**
 * Fait défiler jusqu'au bas de la zone de sortie
 */
function scrollToBottom() {
    output.parentElement.scrollTop = output.parentElement.scrollHeight;
}