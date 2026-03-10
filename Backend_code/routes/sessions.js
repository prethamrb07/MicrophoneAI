import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../db.js';
import { authenticateToken } from '../middleware/auth.js';

const router = Router();

// Generate a 6-character alphanumeric join code
function generateJoinCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no ambiguous chars
    let code = '';
    for (let i = 0; i < 6; i++) {
        code += chars[Math.floor(Math.random() * chars.length)];
    }
    return code;
}

// POST /v1/sessions — Create a new session
router.post('/', authenticateToken, (req, res) => {
    try {
        const { title, hostAName, hostBName, language } = req.body;

        if (!title || !hostAName) {
            return res.status(400).json({
                code: 'VALIDATION_ERROR',
                message: 'Session title and Host A name are required',
            });
        }

        const db = getDb();
        const id = uuidv4();

        // Generate unique join code
        let joinCode;
        let exists = true;
        while (exists) {
            joinCode = generateJoinCode();
            exists = db.prepare('SELECT id FROM sessions WHERE joinCode = ?').get(joinCode);
        }

        db.prepare(
            'INSERT INTO sessions (id, title, hostAName, hostBName, language, joinCode, creatorId) VALUES (?, ?, ?, ?, ?, ?, ?)'
        ).run(id, title, hostAName, hostBName || '', language || 'en', joinCode, req.user.userId);

        res.status(201).json({
            sessionId: id,
            joinCode,
        });
    } catch (err) {
        console.error('Create session error:', err);
        res.status(500).json({
            code: 'SERVER_ERROR',
            message: 'Internal server error',
        });
    }
});

// POST /v1/sessions/join — Join an existing session
router.post('/join', authenticateToken, (req, res) => {
    try {
        const { joinCode, hostRole } = req.body;

        if (!joinCode) {
            return res.status(400).json({
                code: 'VALIDATION_ERROR',
                message: 'Join code is required',
            });
        }

        const db = getDb();
        const session = db.prepare('SELECT * FROM sessions WHERE joinCode = ?').get(joinCode);

        if (!session) {
            return res.status(404).json({
                code: 'SESSION_NOT_FOUND',
                message: 'No session found with that join code',
            });
        }

        res.json({
            sessionId: session.id,
            hostRole: hostRole || 'host_b',
            title: session.title,
        });
    } catch (err) {
        console.error('Join session error:', err);
        res.status(500).json({
            code: 'SERVER_ERROR',
            message: 'Internal server error',
        });
    }
});

// GET /v1/sessions/:id/transcript — Get transcript lines
router.get('/:id/transcript', authenticateToken, (req, res) => {
    try {
        const { id } = req.params;
        const { limit = 50, offset = 0, hostId } = req.query;

        const db = getDb();

        let query = 'SELECT * FROM transcript_lines WHERE sessionId = ?';
        const params = [id];

        if (hostId) {
            query += ' AND hostId = ?';
            params.push(hostId);
        }

        query += ' ORDER BY id ASC LIMIT ? OFFSET ?';
        params.push(Number(limit), Number(offset));

        const lines = db.prepare(query).all(...params);

        res.json({ lines });
    } catch (err) {
        console.error('Get transcript error:', err);
        res.status(500).json({
            code: 'SERVER_ERROR',
            message: 'Internal server error',
        });
    }
});

export default router;
