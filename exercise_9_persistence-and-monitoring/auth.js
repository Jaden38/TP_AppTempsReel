import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { Database } from './database.js';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

export class Auth {
    constructor() {
        this.db = new Database();
    }
    
    async register(username, password) {
        const existingUser = await this.db.getUserByUsername(username);
        if (existingUser) {
            throw new Error('Username already exists');
        }
        
        const hashedPassword = await bcrypt.hash(password, 10);
        const user = await this.db.createUser(username, hashedPassword);
        
        const token = jwt.sign(
            { id: user.id, username: user.username },
            JWT_SECRET,
            { expiresIn: '24h' }
        );
        
        return { ...user, token };
    }
    
    async login(username, password) {
        const user = await this.db.getUserByUsername(username);
        if (!user) {
            throw new Error('Invalid credentials');
        }
        
        const isValid = await bcrypt.compare(password, user.password);
        if (!isValid) {
            throw new Error('Invalid credentials');
        }
        
        const token = jwt.sign(
            { id: user.id, username: user.username },
            JWT_SECRET,
            { expiresIn: '24h' }
        );
        
        return { id: user.id, username: user.username, token };
    }
    
    verify(token) {
        try {
            return jwt.verify(token, JWT_SECRET);
        } catch {
            return null;
        }
    }
}