const WebSocket = require('ws');

// Créer une instance de serveur WebSocket sur le port 8080
const wss = new WebSocket.Server({ 
    port: 8080,
    // Options supplémentaires pour une meilleure gestion
    clientTracking: true,
    perMessageDeflate: false
});

console.log('🚀 Serveur WebSocket démarré sur le port 8080');
console.log('En attente de connexions...\n');

// Compteur pour identifier les clients
let clientCounter = 0;

// Gérer les nouvelles connexions
wss.on('connection', (ws, req) => {
    clientCounter++;
    const clientId = clientCounter;
    const clientIP = req.socket.remoteAddress;
    
    console.log(`✅ [Client #${clientId}] Nouveau client connecté depuis ${clientIP}`);
    console.log(`📊 Nombre total de clients connectés: ${wss.clients.size}`);
    
    // Envoyer un message de bienvenue au client
    ws.send(JSON.stringify({
        type: 'welcome',
        message: `Bienvenue ! Vous êtes le client #${clientId}`,
        clientId: clientId,
        timestamp: new Date().toISOString()
    }));
    
    // Gérer la réception de messages
    ws.on('message', (data) => {
        try {
            // Convertir le buffer en string si nécessaire
            const message = data.toString();
            console.log(`📨 [Client #${clientId}] Message reçu: "${message}"`);
            
            // Vérifier que le message n'est pas vide
            if (!message || message.trim() === '') {
                ws.send(JSON.stringify({
                    type: 'error',
                    message: 'Message vide reçu',
                    timestamp: new Date().toISOString()
                }));
                return;
            }
            
            // Capitaliser le message (convertir en majuscules)
            const capitalizedMessage = message.toUpperCase();
            console.log(`🔄 [Client #${clientId}] Message capitalisé: "${capitalizedMessage}"`);
            
            // Créer la réponse structurée
            const response = JSON.stringify({
                type: 'response',
                original: message,
                capitalized: capitalizedMessage,
                processedAt: new Date().toISOString(),
                clientId: clientId
            });
            
            // Renvoyer le message capitalisé au client
            ws.send(response);
            console.log(`📤 [Client #${clientId}] Réponse envoyée\n`);
            
        } catch (error) {
            console.error(`❌ [Client #${clientId}] Erreur lors du traitement:`, error.message);
            
            // Envoyer un message d'erreur au client
            ws.send(JSON.stringify({
                type: 'error',
                message: 'Erreur lors du traitement du message',
                error: error.message,
                timestamp: new Date().toISOString()
            }));
        }
    });
    
    // Gérer la fermeture de connexion
    ws.on('close', (code, reason) => {
        console.log(`👋 [Client #${clientId}] Client déconnecté`);
        console.log(`   Code: ${code}, Raison: ${reason || 'Aucune raison fournie'}`);
        // Calculer le nombre réel de clients restants
        let remainingClients = 0;
        wss.clients.forEach((client) => {
            if (client !== ws && client.readyState === WebSocket.OPEN) {
                remainingClients++;
            }
        });
        console.log(`📊 Nombre de clients restants: ${remainingClients}\n`);
    });
    
    // Gérer les erreurs de connexion
    ws.on('error', (error) => {
        console.error(`❌ [Client #${clientId}] Erreur WebSocket:`, error.message);
    });
    
    // Gérer le ping/pong pour maintenir la connexion active
    ws.isAlive = true;
    ws.on('pong', () => {
        ws.isAlive = true;
    });
});

// Gérer les erreurs du serveur
wss.on('error', (error) => {
    console.error('❌ Erreur du serveur WebSocket:', error.message);
});

// Vérifier périodiquement les connexions actives (heartbeat)
const interval = setInterval(() => {
    wss.clients.forEach((ws) => {
        if (ws.isAlive === false) {
            console.log('⚠️ Terminaison d\'une connexion inactive');
            return ws.terminate();
        }
        
        ws.isAlive = false;
        ws.ping();
    });
}, 30000); // Vérifier toutes les 30 secondes

// Gérer la fermeture du serveur
wss.on('close', () => {
    clearInterval(interval);
    console.log('🛑 Serveur WebSocket fermé');
});

// Gérer l'arrêt propre du serveur (Ctrl+C)
process.on('SIGINT', () => {
    console.log('\n🛑 Arrêt du serveur...');
    
    // Notifier tous les clients de la fermeture
    wss.clients.forEach((ws) => {
        ws.send(JSON.stringify({
            type: 'server-closing',
            message: 'Le serveur va s\'arrêter',
            timestamp: new Date().toISOString()
        }));
        ws.close(1000, 'Server shutting down');
    });
    
    // Fermer le serveur
    wss.close(() => {
        console.log('✅ Serveur arrêté proprement');
        process.exit(0);
    });
});