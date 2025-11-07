import sqlite3 from 'sqlite3';

export class Database {
    constructor() {
        this.db = new sqlite3.Database('./data.db');
        this.init();
    }
    
    init() {
        this.db.serialize(() => {
            this.db.run(`
                CREATE TABLE IF NOT EXISTS users (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    username TEXT UNIQUE NOT NULL,
                    password TEXT NOT NULL,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            `);
            
            this.db.run(`
                CREATE TABLE IF NOT EXISTS items (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER NOT NULL,
                    username TEXT NOT NULL,
                    content TEXT NOT NULL,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    version INTEGER DEFAULT 1,
                    FOREIGN KEY (user_id) REFERENCES users (id)
                )
            `);
        });
    }
    
    async createUser(username, hashedPassword) {
        return new Promise((resolve, reject) => {
            this.db.run(
                'INSERT INTO users (username, password) VALUES (?, ?)',
                [username, hashedPassword],
                function(err) {
                    if (err) reject(err);
                    else resolve({ id: this.lastID, username });
                }
            );
        });
    }
    
    async getUserByUsername(username) {
        return new Promise((resolve, reject) => {
            this.db.get(
                'SELECT * FROM users WHERE username = ?',
                [username],
                (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                }
            );
        });
    }
    
    async getItems() {
        return new Promise((resolve, reject) => {
            this.db.all(
                'SELECT * FROM items ORDER BY created_at DESC',
                (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows || []);
                }
            );
        });
    }
    
    async addItem(userId, username, content) {
        return new Promise((resolve, reject) => {
            const now = new Date().toISOString();
            this.db.run(
                'INSERT INTO items (user_id, username, content, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
                [userId, username, content, now, now],
                function(err) {
                    if (err) reject(err);
                    else {
                        resolve({
                            id: this.lastID,
                            user_id: userId,
                            username,
                            content,
                            created_at: now,
                            updated_at: now,
                            version: 1
                        });
                    }
                }
            );
        });
    }
    
    async updateItem(id, content) {
        return new Promise((resolve, reject) => {
            const now = new Date().toISOString();
            this.db.run(
                'UPDATE items SET content = ?, updated_at = ?, version = version + 1 WHERE id = ?',
                [content, now, id],
                (err) => {
                    if (err) reject(err);
                    else {
                        this.db.get(
                            'SELECT * FROM items WHERE id = ?',
                            [id],
                            (err, row) => {
                                if (err) reject(err);
                                else resolve(row);
                            }
                        );
                    }
                }
            );
        });
    }
    
    async deleteItem(id) {
        return new Promise((resolve, reject) => {
            this.db.run(
                'DELETE FROM items WHERE id = ?',
                [id],
                (err) => {
                    if (err) reject(err);
                    else resolve();
                }
            );
        });
    }
    
    async canUserModifyItem(itemId, userId) {
        return new Promise((resolve, reject) => {
            this.db.get(
                'SELECT user_id FROM items WHERE id = ?',
                [itemId],
                (err, row) => {
                    if (err) reject(err);
                    else resolve(row && row.user_id === userId);
                }
            );
        });
    }
}