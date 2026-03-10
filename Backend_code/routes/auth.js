import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../db.js';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret';
const TOKEN_EXPIRY = '24h';

// POST /v1/auth/register
router.post('/register', async (req, res) => {
    try {
        const { name, email, password } = req.body;

        if (!name || !email || !password) {
            return res.status(400).json({
                code: 'VALIDATION_ERROR',
                message: 'Name, email, and password are required',
            });
        }

        if (password.length < 6) {
            return res.status(400).json({
                code: 'VALIDATION_ERROR',
                message: 'Password must be at least 6 characters',
            });
        }

        const db = getDb();

        // Check if email already exists
        const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
        if (existing) {
            return res.status(409).json({
                code: 'EMAIL_EXISTS',
                message: 'An account with this email already exists',
            });
        }

        const id = uuidv4();
        const passwordHash = await bcrypt.hash(password, 10);

        db.prepare('INSERT INTO users (id, name, email, passwordHash) VALUES (?, ?, ?, ?)').run(
            id,
            name,
            email,
            passwordHash
        );

        res.status(201).json({
            message: 'Account created successfully',
            userId: id,
        });
    } catch (err) {
        console.error('Register error:', err);
        res.status(500).json({
            code: 'SERVER_ERROR',
            message: 'Internal server error',
        });
    }
});

// POST /v1/auth/login
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                code: 'VALIDATION_ERROR',
                message: 'Email and password are required',
            });
        }

        const db = getDb();
        const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);

        if (!user) {
            return res.status(401).json({
                code: 'INVALID_CREDENTIALS',
                message: 'Invalid email or password',
            });
        }

        const valid = await bcrypt.compare(password, user.passwordHash);
        if (!valid) {
            return res.status(401).json({
                code: 'INVALID_CREDENTIALS',
                message: 'Invalid email or password',
            });
        }

        const token = jwt.sign(
            { userId: user.id, email: user.email, name: user.name },
            JWT_SECRET,
            { expiresIn: TOKEN_EXPIRY }
        );

        const refreshToken = jwt.sign(
            { userId: user.id, type: 'refresh' },
            JWT_SECRET,
            { expiresIn: '7d' }
        );

        res.json({
            token,
            refreshToken,
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
            },
        });
    } catch (err) {
        console.error('Login error:', err);
        res.status(500).json({
            code: 'SERVER_ERROR',
            message: 'Internal server error',
        });
    }
});

export default router;
