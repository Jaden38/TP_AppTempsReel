/**
 * BONUS: Version avec Redis Adapter pour la scalabilité horizontale
 * 
 * Cette version permet de faire tourner plusieurs instances du serveur
 * derrière un load balancer tout en maintenant la synchronisation
 * entre toutes les instances via Redis Pub/Sub.
 */

const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const path = require('path');
const crypto = require('crypto');
const { createAdapter } = require('@socket.io/redis-adapter');
const { createClient } = require('redis');

const app = express();
const server = http.createServer(app);

// Configuration Redis
const REDIS_HOST = process.env.REDIS_HOST || 'localhost';
const REDIS_PORT = process.env.REDIS_PORT || 6379;
const REDIS_PASSWORD = process.env.REDIS_PASSWORD || null;

// Configuration du serveur
const PORT = process.env.PORT || 3000;
const INSTANCE_ID = process.env.INSTANCE_ID || crypto.randomBytes(4).toString('hex');

console.log(`🚀 Starting instance: ${INSTANCE_ID}`);

// Initialisation Socket.IO
const io = socketIO(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// Configuration Redis Adapter
async function setupRedisAdapter() {
    try {
        // Créer les clients Redis pour pub/sub
        const pubClient = createClient({
            socket: {
                host: REDIS_HOST,
                port: REDIS_PORT
            },
            password: REDIS_PASSWORD
        });
        
        const subClient = pubClient.duplicate();
        
        // Gestion des erreurs Redis
        pubClient.on('error', err => console.error('Redis Pub Client Error:', err));
        subClient.on('error', err => console.error('Redis Sub Client Error:', err));
        
        // Connexion à Redis
        await Promise.all([
            pubClient.connect(),
            subClient.connect()
        ]);
        
        console.log(`✅ Connected to Redis at ${REDIS_HOST}:${REDIS_PORT}`);
        
        // Attacher l'adapter à Socket.IO
        io.adapter(createAdapter(pubClient, subClient));
        
        console.log('✅ Redis Adapter configured successfully');
        
        // Client pour le stockage partagé
        const storageClient = createClient({
            socket: {
                host: REDIS_HOST,
                port: REDIS_PORT
            },
            password: REDIS_PASSWORD
        });
        
        await storageClient.connect();
        
        return storageClient;
        
    } catch (error) {
        console.error('❌ Redis setup failed:', error);
        console.log('⚠️  Falling back to in-memory adapter (no horizontal scaling)');
        return null;
    }
}

// Variables globales (partagées via Redis si disponible)
let redisClient = null;
const localMetrics = {
    totalConnections: 0,
    activeConnections: 0,
    eventsPerMinute: [],
    startTime: Date.now()
};

// Stockage local de secours si Redis n'est pas disponible
const localRooms = new Map();
const localTokens = new Map();

// Middleware Express
app.use(express.static(path.join(__dirname, '../client')));
app.use(express.json());

// Helper: Récupérer une room depuis Redis ou local
async function getRoom(roomId) {
    if (redisClient) {
        try {
            const roomData = await redisClient.get(`room:${roomId}`);
            return roomData ? JSON.parse(roomData) : null;
        } catch (error) {
            console.error('Redis get error:', error);
        }
    }
    return localRooms.get(roomId);
}

// Helper: Sauvegarder une room dans Redis ou local
async function setRoom(roomId, roomData) {
    if (redisClient) {
        try {
            await redisClient.set(
                `room:${roomId}`, 
                JSON.stringify(roomData),
                { EX: 3600 } // Expire après 1 heure
            );
        } catch (error) {
            console.error('Redis set error:', error);
        }
    } else {
        localRooms.set(roomId, roomData);
    }
}

// Helper: Gérer les tokens
async function setToken(token, roomId) {
    if (redisClient) {
        try {
            await redisClient.set(
                `token:${token}`,
                roomId,
                { EX: 3600 }
            );
        } catch (error) {
            console.error('Redis token set error:', error);
        }
    } else {
        localTokens.set(token, roomId);
    }
}

async function getToken(token) {
    if (redisClient) {
        try {
            return await redisClient.get(`token:${token}`);
        } catch (error) {
            console.error('Redis token get error:', error);
        }
    }
    return localTokens.get(token);
}

// API: Créer une nouvelle room
app.post('/api/create-room', async (req, res) => {
    const roomId = `room-${crypto.randomBytes(4).toString('hex')}`;
    const token = crypto.randomBytes(16).toString('hex');
    
    const roomData = {
        content: '',
        users: [],
        createdAt: new Date().toISOString(),
        token: token,
        instanceId: INSTANCE_ID
    };
    
    await setRoom(roomId, roomData);
    await setToken(token, roomId);
    
    console.log(`[${INSTANCE_ID}] Room Created: ${roomId}`);
    res.json({ roomId, token });
});

// API: Status avec informations multi-instance
app.get('/status', async (req, res) => {
    let globalStats = {
        instanceId: INSTANCE_ID,
        uptime: Math.floor((Date.now() - localMetrics.startTime) / 1000),
        localConnections: localMetrics.activeConnections,
        totalLocalConnections: localMetrics.totalConnections,
        eventsPerMinute: localMetrics.eventsPerMinute.filter(
            timestamp => Date.now() - timestamp < 60000
        ).length,
        serverTime: new Date().toISOString(),
        redisConnected: redisClient !== null
    };
    
    // Si Redis est disponible, récupérer les stats globales
    if (redisClient) {
        try {
            const instances = await redisClient.sMembers('instances');
            globalStats.totalInstances = instances.length;
            
            // Publier que cette instance est active
            await redisClient.sAdd('instances', INSTANCE_ID);
            await redisClient.expire('instances', 60); // Expire après 60 secondes
            
        } catch (error) {
            console.error('Redis stats error:', error);
        }
    }
    
    res.json(globalStats);
});

// Middleware d'authentification Socket.IO
io.use(async (socket, next) => {
    const token = socket.handshake.auth.token;
    const roomId = socket.handshake.auth.roomId;
    
    if (!token || !roomId) {
        return next(new Error('Missing token or roomId'));
    }
    
    // Vérifier le token
    const validRoomId = await getToken(token);
    if (validRoomId !== roomId) {
        return next(new Error('Invalid token for this room'));
    }
    
    // Vérifier que la room existe
    const room = await getRoom(roomId);
    if (!room) {
        return next(new Error('Room does not exist'));
    }
    
    socket.roomId = roomId;
    socket.token = token;
    next();
});

// Gestion des connexions Socket.IO
io.on('connection', async (socket) => {
    localMetrics.totalConnections++;
    localMetrics.activeConnections++;
    
    const username = socket.handshake.auth.username || 'Anonymous';
    const roomId = socket.roomId;
    
    console.log(`[${INSTANCE_ID}] Connection: ${username} (${socket.id}) -> ${roomId}`);
    logEvent();
    
    // Rejoindre la room Socket.IO
    socket.join(roomId);
    
    // Récupérer et mettre à jour la room
    let room = await getRoom(roomId);
    if (room) {
        // Convertir users en array si nécessaire
        if (!Array.isArray(room.users)) {
            room.users = [];
        }
        
        // Ajouter l'utilisateur
        room.users.push({
            id: socket.id,
            username: username,
            instanceId: INSTANCE_ID
        });
        
        // Sauvegarder la room mise à jour
        await setRoom(roomId, room);
        
        // Envoyer l'état initial
        socket.emit('initialize', {
            content: room.content || '',
            users: room.users
        });
        
        // Notifier via Redis Pub/Sub pour toutes les instances
        if (redisClient) {
            await redisClient.publish('room-events', JSON.stringify({
                type: 'user-joined',
                roomId: roomId,
                user: { id: socket.id, username, instanceId: INSTANCE_ID },
                timestamp: new Date().toISOString()
            }));
        }
        
        // Notification locale
        socket.to(roomId).emit('notification', {
            type: 'user-joined',
            message: `${username} a rejoint la session`,
            user: { id: socket.id, username },
            timestamp: new Date().toISOString()
        });
        
        // Mise à jour de la liste des utilisateurs
        io.to(roomId).emit('users-update', room.users);
    }
    
    // Gestion des mises à jour
    socket.on('update', async (data) => {
        logEvent();
        
        if (typeof data.content !== 'string' || data.content.length > 100000) {
            socket.emit('error', { message: 'Invalid content' });
            return;
        }
        
        const room = await getRoom(roomId);
        if (room) {
            room.content = data.content;
            await setRoom(roomId, room);
            
            // Broadcast local
            socket.to(roomId).emit('update', {
                content: data.content,
                userId: socket.id,
                username: username,
                timestamp: new Date().toISOString()
            });
            
            // Publier sur Redis pour les autres instances
            if (redisClient) {
                await redisClient.publish('room-updates', JSON.stringify({
                    roomId: roomId,
                    content: data.content,
                    userId: socket.id,
                    username: username,
                    instanceId: INSTANCE_ID,
                    timestamp: new Date().toISOString()
                }));
            }
            
            console.log(`[${INSTANCE_ID}] Update: ${roomId} by ${username}`);
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
    
    // Déconnexion
    socket.on('disconnect', async () => {
        localMetrics.activeConnections--;
        logEvent();
        
        const room = await getRoom(roomId);
        if (room && Array.isArray(room.users)) {
            // Retirer l'utilisateur
            room.users = room.users.filter(user => user.id !== socket.id);
            await setRoom(roomId, room);
            
            // Notifications
            socket.to(roomId).emit('notification', {
                type: 'user-left',
                message: `${username} a quitté la session`,
                user: { id: socket.id, username },
                timestamp: new Date().toISOString()
            });
            
            io.to(roomId).emit('users-update', room.users);
            
            // Publier sur Redis
            if (redisClient) {
                await redisClient.publish('room-events', JSON.stringify({
                    type: 'user-left',
                    roomId: roomId,
                    user: { id: socket.id, username, instanceId: INSTANCE_ID },
                    timestamp: new Date().toISOString()
                }));
            }
        }
        
        console.log(`[${INSTANCE_ID}] Disconnect: ${username} (${socket.id})`);
    });
});

// Helper: Logger les événements
function logEvent() {
    localMetrics.eventsPerMinute.push(Date.now());
    localMetrics.eventsPerMinute = localMetrics.eventsPerMinute.filter(
        timestamp => Date.now() - timestamp < 60000
    );
}

// Monitoring périodique
setInterval(async () => {
    console.log(`\n========== MONITORING [${INSTANCE_ID}] ==========`);
    console.log(`Local Active Connections: ${localMetrics.activeConnections}`);
    console.log(`Local Total Connections: ${localMetrics.totalConnections}`);
    console.log(`Events/minute: ${localMetrics.eventsPerMinute.length}`);
    console.log(`Memory: ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`);
    console.log(`Redis: ${redisClient ? 'Connected' : 'Not available'}`);
    console.log('==========================================\n');
}, 30000);

// Démarrage du serveur
async function start() {
    // Configurer Redis si disponible
    redisClient = await setupRedisAdapter();
    
    // Si Redis est disponible, souscrire aux événements
    if (redisClient) {
        const subscriber = redisClient.duplicate();
        await subscriber.connect();
        
        // Souscrire aux mises à jour inter-instances
        await subscriber.subscribe('room-updates', (message) => {
            const data = JSON.parse(message);
            // Ignorer nos propres messages
            if (data.instanceId !== INSTANCE_ID) {
                // Broadcaster aux clients locaux de cette room
                io.to(data.roomId).emit('update', {
                    content: data.content,
                    userId: data.userId,
                    username: data.username,
                    timestamp: data.timestamp
                });
            }
        });
        
        console.log('✅ Subscribed to Redis channels');
    }
    
    // Démarrer le serveur HTTP
    server.listen(PORT, () => {
        console.log(`\n🚀 CollabBoard Server [${INSTANCE_ID}] on http://localhost:${PORT}`);
        console.log(`📊 Monitoring: http://localhost:${PORT}/status`);
        console.log(`🔄 Redis: ${redisClient ? 'Enabled' : 'Disabled'}`);
        console.log('\n==========================================\n');
    });
}

// Gestion propre de l'arrêt
process.on('SIGTERM', async () => {
    console.log(`[${INSTANCE_ID}] SIGTERM received, closing...`);
    if (redisClient) {
        await redisClient.quit();
    }
    server.close(() => {
        console.log(`[${INSTANCE_ID}] Server closed`);
        process.exit(0);
    });
});

// Démarrer l'application
start().catch(console.error);