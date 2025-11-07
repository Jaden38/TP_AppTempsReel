let ws = null;
let token = localStorage.getItem('token');
let userId = localStorage.getItem('userId');
let username = localStorage.getItem('username');
let reconnectTimer = null;
let reconnectDelay = 1000;
let pingInterval = null;
let items = [];
let syncCount = 0;

const authContainer = document.getElementById('auth-container');
const appContainer = document.getElementById('app-container');

if (token) {
    showApp();
    connect();
} else {
    showAuth();
}

function showAuth() {
    authContainer.classList.remove('hidden');
    appContainer.classList.add('hidden');
}

function showApp() {
    authContainer.classList.add('hidden');
    appContainer.classList.remove('hidden');
    document.getElementById('username-display').textContent = username;
}

async function register() {
    const user = document.getElementById('username').value;
    const pass = document.getElementById('password').value;
    
    try {
        const response = await fetch('/api/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: user, password: pass })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            saveAuth(data);
            showApp();
            connect();
        } else {
            document.getElementById('auth-error').textContent = data.error;
        }
    } catch (error) {
        document.getElementById('auth-error').textContent = 'Connection error';
    }
}

async function login() {
    const user = document.getElementById('username').value;
    const pass = document.getElementById('password').value;
    
    try {
        const response = await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: user, password: pass })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            saveAuth(data);
            showApp();
            connect();
        } else {
            document.getElementById('auth-error').textContent = data.error;
        }
    } catch (error) {
        document.getElementById('auth-error').textContent = 'Connection error';
    }
}

function saveAuth(data) {
    token = data.token;
    userId = data.userId;
    username = data.username;
    localStorage.setItem('token', token);
    localStorage.setItem('userId', String(userId));
    localStorage.setItem('username', username);
}

function logout() {
    localStorage.clear();
    if (ws) ws.close();
    location.reload();
}

function connect() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    ws = new WebSocket(`${protocol}//${window.location.host}`);
    
    ws.onopen = () => {
        console.log('Connected');
        document.getElementById('connection-status').className = 'status connected';
        reconnectDelay = 1000;
        
        ws.send(JSON.stringify({ type: 'auth', token }));
        
        startPing();
    };
    
    ws.onmessage = (event) => {
        const message = JSON.parse(event.data);
        handleMessage(message);
    };
    
    ws.onclose = () => {
        console.log('Disconnected');
        document.getElementById('connection-status').className = 'status disconnected';
        stopPing();
        scheduleReconnect();
    };
    
    ws.onerror = (error) => {
        console.error('WebSocket error:', error);
    };
}

function handleMessage(message) {
    switch (message.type) {
        case 'auth_success':
            loadItems();
            break;
            
        case 'sync':
            items = message.items;
            renderItems();
            break;
            
        case 'item_added':
            items.unshift(message.item);
            renderItems();
            logSync('Added item');
            syncCount++;
            updateSyncCount();
            break;
            
        case 'item_updated':
            const index = items.findIndex(i => i.id === message.item.id);
            if (index !== -1) {
                items[index] = message.item;
                renderItems();
            }
            logSync('Updated item');
            syncCount++;
            updateSyncCount();
            break;
            
        case 'item_deleted':
            items = items.filter(i => i.id !== message.id);
            renderItems();
            logSync('Deleted item');
            syncCount++;
            updateSyncCount();
            break;
            
        case 'users_update':
        case 'user_joined':
        case 'user_left':
            updateUsersList(message.connectedUsers);
            break;
            
        case 'pong':
            const latency = Date.now() - message.timestamp;
            document.getElementById('latency').textContent = latency;
            break;
    }
}

function startPing() {
    pingInterval = setInterval(() => {
        if (ws && ws.readyState === 1) {
            ws.send(JSON.stringify({ type: 'ping' }));
        }
    }, 5000);
}

function stopPing() {
    if (pingInterval) {
        clearInterval(pingInterval);
        pingInterval = null;
    }
}

function scheduleReconnect() {
    if (reconnectTimer) return;
    
    reconnectTimer = setTimeout(() => {
        reconnectTimer = null;
        reconnectDelay = Math.min(reconnectDelay * 2, 30000);
        connect();
    }, reconnectDelay);
}

async function loadItems() {
    try {
        const response = await fetch('/api/items');
        items = await response.json();
        renderItems();
    } catch (error) {
        console.error('Failed to load items:', error);
    }
}

function addItem() {
    const input = document.getElementById('new-item');
    const content = input.value.trim();
    
    if (content && ws && ws.readyState === 1) {
        ws.send(JSON.stringify({ type: 'add_item', content }));
        input.value = '';
    }
}

function updateItem(id) {
    const item = items.find(i => i.id === id);
    const newContent = prompt('Edit item:', item.content);
    
    if (newContent && ws && ws.readyState === 1) {
        ws.send(JSON.stringify({ type: 'update_item', id, content: newContent }));
    }
}

function deleteItem(id) {
    if (confirm('Delete this item?') && ws && ws.readyState === 1) {
        ws.send(JSON.stringify({ type: 'delete_item', id }));
    }
}

function renderItems() {
    const container = document.getElementById('items-container');
    
    if (items.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: #718096;">No items yet</p>';
        return;
    }
    
    container.innerHTML = items.map(item => `
        <div class="item">
            <div class="item-content">
                <div>${item.content}</div>
                <div class="item-meta">by ${item.username} • v${item.version}</div>
            </div>
            ${item.user_id === parseInt(userId) ? `
                <div class="item-actions">
                    <button class="edit-btn" onclick="updateItem(${item.id})">Edit</button>
                    <button class="delete-btn" onclick="deleteItem(${item.id})">Delete</button>
                </div>
            ` : ''}
        </div>
    `).join('');
}

function updateUsersList(users) {
    const list = document.getElementById('users-list');
    list.innerHTML = users.map(u => `<li>${u.username}</li>`).join('');
    document.getElementById('online-count').textContent = users.length;
}

function updateSyncCount() {
    document.getElementById('sync-count').textContent = syncCount;
}

function logSync(action) {
    const logs = document.getElementById('sync-logs');
    const entry = document.createElement('div');
    entry.className = 'log-entry';
    entry.textContent = `${new Date().toLocaleTimeString()} - ${action}`;
    logs.insertBefore(entry, logs.firstChild);
    
    if (logs.children.length > 20) {
        logs.removeChild(logs.lastChild);
    }
}

document.getElementById('new-item').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') addItem();
});