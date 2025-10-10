const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const path = require('path');
const crypto = require('crypto');

const app = express();
const server = http.createServer(app);
const io = socketIO(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// Configuration
const PORT = process.env.PORT || 3000;
const VALID_TOKENS = new Map(); // Token -> Room mapping

// État de l'application
const rooms = new Map(); // Room -> { content: string, users: Set, createdAt: Date }
const metrics = {
    totalConnections: 0,
    activeConnections: 0,
    eventsPerMinute: [],
    startTime: Date.now()
};

// Middleware pour servir les fichiers statiques
app.use(express.static(path.join(__dirname, '../client')));
app.use(express.json());

// API pour créer une nouvelle room avec token
app.post('/api/create-room', (req, res) => {
    const roomId = `room-${crypto.randomBytes(4).toString('hex')}`;
    const token = crypto.randomBytes(16).toString('hex');
    
    VALID_TOKENS.set(token, roomId);
    rooms.set(roomId, {
        content: '',
        users: new Set(),
        createdAt: new Date(),
        token: token
    });
    
    console.log(`[Room Created] ${roomId} with token ${token}`);
    res.json({ roomId, token });
});

// Endpoint de monitoring
app.get('/status', (req, res) => {
    const activeRooms = [];
    rooms.forEach((room, roomId) => {
        activeRooms.push({
            roomId,
            userCount: room.users.size,
            createdAt: room.createdAt
        });
    });
    
    const uptime = Math.floor((Date.now() - metrics.startTime) / 1000);
    const recentEvents = metrics.eventsPerMinute.filter(
        timestamp => Date.now() - timestamp < 60000
    ).length;
    
    res.json({
        uptime: `${uptime} seconds`,
        totalConnections: metrics.totalConnections,
        activeConnections: metrics.activeConnections,
        eventsPerMinute: recentEvents,
        activeRooms,
        serverTime: new Date().toISOString()
    });
});

// Middleware d'authentification Socket.IO
io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    const roomId = socket.handshake.auth.roomId;
    
    if (!token || !roomId) {
        return next(new Error('Missing token or roomId'));
    }
    
    // Vérifier le token
    const validRoomId = VALID_TOKENS.get(token);
    if (validRoomId !== roomId) {
        return next(new Error('Invalid token for this room'));
    }
    
    // Vérifier que la room existe
    if (!rooms.has(roomId)) {
        return next(new Error('Room does not exist'));
    }
    
    socket.roomId = roomId;
    socket.token = token;
    next();
});

// Gestion des connexions Socket.IO
io.on('connection', (socket) => {
    metrics.totalConnections++;
    metrics.activeConnections++;
    
    const username = socket.handshake.auth.username || 'Anonymous';
    const roomId = socket.roomId;
    
    console.log(`[Connection] User ${username} (${socket.id}) joined room ${roomId}`);
    logEvent();
    
    // Rejoindre la room
    socket.join(roomId);
    
    // Ajouter l'utilisateur à la room
    const room = rooms.get(roomId);
    if (room) {
        room.users.add({
            id: socket.id,
            username: username
        });
        
        // Envoyer l'état actuel au nouveau client
        socket.emit('initialize', {
            content: room.content,
            users: Array.from(room.users)
        });
        
        // Notifier les autres utilisateurs
        socket.to(roomId).emit('notification', {
            type: 'user-joined',
            message: `${username} a rejoint la session`,
            user: { id: socket.id, username },
            timestamp: new Date().toISOString()
        });
        
        // Mettre à jour la liste des utilisateurs pour tous
        io.to(roomId).emit('users-update', Array.from(room.users));
    }
    
    // Gestion des mises à jour de contenu
    socket.on('update', (data) => {
        logEvent();
        
        // Validation des données
        if (typeof data.content !== 'string') {
            socket.emit('error', { message: 'Invalid content format' });
            return;
        }
        
        // Limiter la taille du contenu (100KB)
        if (data.content.length > 100000) {
            socket.emit('error', { message: 'Content too large' });
            return;
        }
        
        const room = rooms.get(roomId);
        if (room) {
            room.content = data.content;
            
            // Diffuser la mise à jour aux autres membres de la room
            socket.to(roomId).emit('update', {
                content: data.content,
                userId: socket.id,
                username: username,
                timestamp: new Date().toISOString()
            });
            
            console.log(`[Update] Room ${roomId}: ${username} updated content (${data.content.length} chars)`);
        }
    });
    
    // Indicateur de frappe
    socket.on('typing', (isTyping) => {
        logEvent();
        socket.to(roomId).emit('typing', {
            userId: socket.id,
            username: username,
            isTyping: isTyping
        });
    });
    
    // Gestion de la déconnexion
    socket.on('disconnect', () => {
        metrics.activeConnections--;
        logEvent();
        
        const room = rooms.get(roomId);
        if (room) {
            // Retirer l'utilisateur de la room
            room.users.forEach(user => {
                if (user.id === socket.id) {
                    room.users.delete(user);
                }
            });
            
            // Notifier les autres utilisateurs
            socket.to(roomId).emit('notification', {
                type: 'user-left',
                message: `${username} a quitté la session`,
                user: { id: socket.id, username },
                timestamp: new Date().toISOString()
            });
            
            // Mettre à jour la liste des utilisateurs
            io.to(roomId).emit('users-update', Array.from(room.users));
            
            // Nettoyer les rooms vides après 1 minute
            if (room.users.size === 0) {
                setTimeout(() => {
                    if (rooms.get(roomId)?.users.size === 0) {
                        const token = room.token;
                        VALID_TOKENS.delete(token);
                        rooms.delete(roomId);
                        console.log(`[Cleanup] Room ${roomId} deleted (empty)`);
                    }
                }, 60000);
            }
        }
        
        console.log(`[Disconnect] User ${username} (${socket.id}) left room ${roomId}`);
    });
    
    // Gestion des erreurs
    socket.on('error', (error) => {
        console.error(`[Socket Error] ${error.message}`);
        logEvent();
    });
});

// Fonction helper pour logger les événements
function logEvent() {
    metrics.eventsPerMinute.push(Date.now());
    // Nettoyer les événements de plus d'une minute
    metrics.eventsPerMinute = metrics.eventsPerMinute.filter(
        timestamp => Date.now() - timestamp < 60000
    );
}

// Logging périodique des métriques
setInterval(() => {
    const activeRoomsCount = rooms.size;
    const totalUsers = Array.from(rooms.values()).reduce(
        (sum, room) => sum + room.users.size, 0
    );
    const eventsLastMinute = metrics.eventsPerMinute.length;
    
    console.log('\n========== MONITORING ==========');
    console.log(`Active Connections: ${metrics.activeConnections}`);
    console.log(`Total Connections: ${metrics.totalConnections}`);
    console.log(`Events/minute: ${eventsLastMinute}`);
    console.log(`Active Rooms: ${activeRoomsCount}`);
    console.log(`Total Users: ${totalUsers}`);
    console.log(`Memory Usage: ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`);
    
    // Afficher les rooms actives
    if (activeRoomsCount > 0) {
        console.log('\nActive Rooms:');
        rooms.forEach((room, roomId) => {
            console.log(`  - ${roomId}: ${room.users.size} users, ${room.content.length} chars`);
        });
    }
    console.log('================================\n');
}, 30000); // Toutes les 30 secondes

// Gestion gracieuse de l'arrêt
process.on('SIGTERM', () => {
    console.log('SIGTERM received, closing server...');
    io.emit('notification', {
        type: 'server-shutdown',
        message: 'Le serveur va redémarrer, veuillez rafraîchir la page dans quelques secondes'
    });
    server.close(() => {
        console.log('Server closed');
        process.exit(0);
    });
});

// Démarrage du serveur
server.listen(PORT, () => {
    console.log(`\n🚀 CollabBoard Server started on http://localhost:${PORT}`);
    console.log(`📊 Monitoring dashboard: http://localhost:${PORT}/status`);
    console.log(`\n💡 Create a room: POST http://localhost:${PORT}/api/create-room`);
    console.log('\n========================================\n');
});