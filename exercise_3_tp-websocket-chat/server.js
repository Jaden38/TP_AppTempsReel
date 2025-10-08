const WebSocket = require('ws');
const http = require('http');
const fs = require('fs');
const path = require('path');

// Création du serveur HTTP pour servir les fichiers statiques
const server = http.createServer((req, res) => {
    let filePath = path.join(__dirname, 'client', req.url === '/' ? 'index.html' : req.url);
    
    // Déterminer le type MIME
    const extname = path.extname(filePath);
    let contentType = 'text/html';
    switch (extname) {
        case '.js':
            contentType = 'text/javascript';
            break;
        case '.css':
            contentType = 'text/css';
            break;
    }
    
    // Lire et servir le fichier
    fs.readFile(filePath, (err, content) => {
        if (err) {
            res.writeHead(404);
            res.end('404 - Not Found');
            return;
        }
        res.writeHead(200, { 'Content-Type': contentType });
        res.end(content);
    });
});

// Création du serveur WebSocket
const wss = new WebSocket.Server({ server });

// Structure pour stocker les clients connectés
const clients = new Map();
let clientIdCounter = 0;

// Fonction pour broadcaster un message à tous les clients
function broadcast(message, excludeClient = null) {
    const messageStr = JSON.stringify(message);
    clients.forEach((client, id) => {
        if (client.ws.readyState === WebSocket.OPEN && id !== excludeClient) {
            client.ws.send(messageStr);
        }
    });
}

// Fonction pour envoyer un message privé
function sendPrivateMessage(fromId, toUsername, message) {
    let targetClient = null;
    let targetId = null;
    
    // Trouver le client destinataire
    clients.forEach((client, id) => {
        if (client.username === toUsername) {
            targetClient = client;
            targetId = id;
        }
    });
    
    if (targetClient && targetClient.ws.readyState === WebSocket.OPEN) {
        const fromClient = clients.get(fromId);
        targetClient.ws.send(JSON.stringify({
            type: 'private',
            from: fromClient.username,
            message: message,
            timestamp: new Date().toISOString()
        }));
        
        // Envoyer une confirmation à l'expéditeur
        fromClient.ws.send(JSON.stringify({
            type: 'private_sent',
            to: toUsername,
            message: message,
            timestamp: new Date().toISOString()
        }));
        
        return true;
    }
    
    return false;
}

// Fonction pour obtenir la liste des utilisateurs connectés
function getUserList() {
    const users = [];
    clients.forEach(client => {
        if (client.username) {
            users.push({
                username: client.username,
                color: client.color
            });
        }
    });
    return users;
}

// Gestion des connexions WebSocket
wss.on('connection', (ws) => {
    const clientId = ++clientIdCounter;
    const clientInfo = {
        ws: ws,
        username: null,
        color: `hsl(${Math.random() * 360}, 70%, 50%)` // Couleur aléatoire pour chaque utilisateur
    };
    
    clients.set(clientId, clientInfo);
    
    console.log(`✅ Nouveau client connecté (ID: ${clientId}). Total: ${clients.size} clients`);
    
    // Envoyer un message de bienvenue au nouveau client
    ws.send(JSON.stringify({
        type: 'welcome',
        message: 'Bienvenue dans le chat WebSocket!',
        clientId: clientId
    }));
    
    // Gestion des messages reçus
    ws.on('message', (data) => {
        try {
            const message = JSON.parse(data.toString());
            const client = clients.get(clientId);
            
            switch (message.type) {
                case 'setUsername':
                    // Vérifier si le nom d'utilisateur est déjà pris
                    let usernameExists = false;
                    clients.forEach(c => {
                        if (c.username === message.username) {
                            usernameExists = true;
                        }
                    });
                    
                    if (usernameExists) {
                        ws.send(JSON.stringify({
                            type: 'error',
                            message: 'Ce nom d\'utilisateur est déjà pris!'
                        }));
                    } else {
                        client.username = message.username;
                        console.log(`👤 Client ${clientId} s'est identifié comme: ${message.username}`);
                        
                        // Confirmer au client
                        ws.send(JSON.stringify({
                            type: 'usernameSet',
                            username: message.username,
                            color: client.color
                        }));
                        
                        // Notifier tous les clients de la connexion
                        broadcast({
                            type: 'userJoined',
                            username: message.username,
                            userList: getUserList()
                        });
                    }
                    break;
                    
                case 'message':
                    if (!client.username) {
                        ws.send(JSON.stringify({
                            type: 'error',
                            message: 'Veuillez d\'abord choisir un nom d\'utilisateur!'
                        }));
                        return;
                    }
                    
                    console.log(`💬 Message de ${client.username}: ${message.text}`);
                    
                    // Vérifier si c'est un message privé (format: /msg username message)
                    if (message.text.startsWith('/msg ')) {
                        const parts = message.text.substring(5).split(' ');
                        const targetUsername = parts[0];
                        const privateMessage = parts.slice(1).join(' ');
                        
                        if (!sendPrivateMessage(clientId, targetUsername, privateMessage)) {
                            ws.send(JSON.stringify({
                                type: 'error',
                                message: `Utilisateur "${targetUsername}" non trouvé ou déconnecté.`
                            }));
                        }
                    } else {
                        // Broadcast du message à tous les clients
                        broadcast({
                            type: 'message',
                            username: client.username,
                            text: message.text,
                            color: client.color,
                            timestamp: new Date().toISOString()
                        });
                    }
                    break;
                    
                case 'typing':
                    if (client.username) {
                        broadcast({
                            type: 'typing',
                            username: client.username,
                            isTyping: message.isTyping
                        }, clientId);
                    }
                    break;
            }
        } catch (error) {
            console.error('❌ Erreur lors du traitement du message:', error);
            ws.send(JSON.stringify({
                type: 'error',
                message: 'Erreur lors du traitement du message'
            }));
        }
    });
    
    // Gestion de la déconnexion
    ws.on('close', () => {
        const client = clients.get(clientId);
        console.log(`👋 Client déconnecté (ID: ${clientId}, Username: ${client.username || 'Anonyme'})`);
        
        if (client.username) {
            // Notifier les autres clients de la déconnexion
            broadcast({
                type: 'userLeft',
                username: client.username,
                userList: getUserList()
            });
        }
        
        clients.delete(clientId);
        console.log(`Clients restants: ${clients.size}`);
    });
    
    // Gestion des erreurs
    ws.on('error', (error) => {
        console.error(`❌ Erreur WebSocket pour le client ${clientId}:`, error);
    });
});

// Démarrage du serveur
const PORT = process.env.PORT || 8080;
const HOST = '0.0.0.0'; // Important pour Render
server.listen(PORT, HOST, () => {
    console.log(`🚀 Serveur WebSocket démarré sur le port ${PORT}`);
    console.log(`📱 Accédez au client sur: http://localhost:${PORT}`);
});

// Gestion propre de l'arrêt du serveur
process.on('SIGINT', () => {
    console.log('\n🛑 Arrêt du serveur...');
    
    // Notifier tous les clients de l'arrêt du serveur
    broadcast({
        type: 'serverShutdown',
        message: 'Le serveur va s\'arrêter'
    });
    
    // Fermer toutes les connexions
    clients.forEach(client => {
        client.ws.close();
    });
    
    wss.close(() => {
        server.close(() => {
            console.log('👋 Serveur arrêté proprement');
            process.exit(0);
        });
    });
});