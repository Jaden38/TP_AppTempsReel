import express from 'express';
import { WebSocketServer } from 'ws';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { Database } from './database.js';
import { Auth } from './auth.js';
import { Monitor } from './monitor.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

const db = new Database();
const auth = new Auth();
const monitor = new Monitor();

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const clients = new Map();
const rateLimiter = new Map();

function checkRateLimit(ip) {
    const now = Date.now();
    const limit = rateLimiter.get(ip) || { count: 0, resetTime: now + 60000 };
    
    if (now > limit.resetTime) {
        limit.count = 1;
        limit.resetTime = now + 60000;
    } else {
        limit.count++;
    }
    
    rateLimiter.set(ip, limit);
    return limit.count <= 100;
}

function broadcast(message, excludeWs = null) {
    const data = JSON.stringify(message);
    clients.forEach((client, ws) => {
        if (ws !== excludeWs && ws.readyState === 1) {
            ws.send(data);
        }
    });
}

function sanitizeInput(text) {
    return String(text)
        .replace(/[<>]/g, '')
        .trim()
        .slice(0, 1000);
}

app.post('/api/register', async (req, res) => {
    try {
        const { username, password } = req.body;
        
        if (!username || !password || username.length < 3 || password.length < 4) {
            return res.status(400).json({ error: 'Invalid credentials' });
        }
        
        const user = await auth.register(username, password);
        res.json({ token: user.token, userId: user.id, username: user.username });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

app.post('/api/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        const user = await auth.login(username, password);
        res.json({ token: user.token, userId: user.id, username: user.username });
    } catch (error) {
        res.status(401).json({ error: error.message });
    }
});

app.get('/api/items', async (req, res) => {
    const items = await db.getItems();
    res.json(items);
});

app.get('/api/stats', (req, res) => {
    res.json(monitor.getStats());
});

wss.on('connection', (ws, req) => {
    const ip = req.socket.remoteAddress;
    
    if (!checkRateLimit(ip)) {
        ws.close(1008, 'Rate limit exceeded');
        return;
    }
    
    monitor.recordConnection();
    
    let authenticated = false;
    let userId = null;
    let username = null;
    
    ws.on('message', async (data) => {
        try {
            const message = JSON.parse(data);
            const startTime = Date.now();
            
            if (message.type === 'auth') {
                const user = auth.verify(message.token);
                if (user) {
                    authenticated = true;
                    userId = user.id;
                    username = user.username;
                    
                    clients.set(ws, { userId, username });
                    
                    ws.send(JSON.stringify({
                        type: 'auth_success',
                        userId,
                        username
                    }));
                    
                    const items = await db.getItems();
                    ws.send(JSON.stringify({
                        type: 'sync',
                        items
                    }));
                    
                    broadcast({
                        type: 'user_joined',
                        username,
                        connectedUsers: Array.from(clients.values())
                    }, ws);
                    
                    ws.send(JSON.stringify({
                        type: 'users_update',
                        connectedUsers: Array.from(clients.values())
                    }));
                } else {
                    ws.close(1008, 'Invalid token');
                }
                return;
            }
            
            if (!authenticated) {
                ws.close(1008, 'Not authenticated');
                return;
            }
            
            switch (message.type) {
                case 'add_item':
                    const content = sanitizeInput(message.content);
                    if (content) {
                        const item = await db.addItem(userId, username, content);
                        broadcast({
                            type: 'item_added',
                            item
                        });
                        monitor.recordSync('add');
                    }
                    break;
                    
                case 'update_item':
                    const canUpdate = await db.canUserModifyItem(message.id, userId);
                    if (canUpdate) {
                        const updatedContent = sanitizeInput(message.content);
                        const item = await db.updateItem(message.id, updatedContent);
                        broadcast({
                            type: 'item_updated',
                            item
                        });
                        monitor.recordSync('update');
                    }
                    break;
                    
                case 'delete_item':
                    const canDelete = await db.canUserModifyItem(message.id, userId);
                    if (canDelete) {
                        await db.deleteItem(message.id);
                        broadcast({
                            type: 'item_deleted',
                            id: message.id
                        });
                        monitor.recordSync('delete');
                    }
                    break;
                    
                case 'ping':
                    ws.send(JSON.stringify({
                        type: 'pong',
                        timestamp: Date.now()
                    }));
                    break;
            }
            
            const latency = Date.now() - startTime;
            monitor.recordLatency(latency);
            
        } catch (error) {
            console.error('Message error:', error);
            ws.send(JSON.stringify({
                type: 'error',
                message: 'Invalid request'
            }));
        }
    });
    
    ws.on('close', () => {
        if (clients.has(ws)) {
            const client = clients.get(ws);
            clients.delete(ws);
            monitor.recordDisconnection();
            
            broadcast({
                type: 'user_left',
                username: client.username,
                connectedUsers: Array.from(clients.values())
            });
        }
    });
    
    ws.on('error', (error) => {
        console.error('WebSocket error:', error);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});