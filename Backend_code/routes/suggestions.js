import { Router } from 'express';
import { getDb } from '../db.js';
import { authenticateToken } from '../middleware/auth.js';
import { generateSuggestion } from '../services/gemini.js';

const router = Router();

// POST /v1/suggestions/request — Get AI suggestion based on context
router.post('/request', authenticateToken, async (req, res) => {
    try {
        const { sessionId, hostId, context } = req.body;

        if (!sessionId) {
            return res.status(400).json({
                code: 'VALIDATION_ERROR',
                message: 'sessionId is required',
            });
        }

        const db = getDb();

        // Get recent transcript for context
        const recentLines = db
            .prepare(
                'SELECT hostId, text FROM transcript_lines WHERE sessionId = ? ORDER BY id DESC LIMIT 20'
            )
            .all(sessionId)
            .reverse();

        const transcriptContext =
            recentLines.map((l) => `${l.hostId}: ${l.text}`).join('\n') || context || '';

        if (!transcriptContext.trim()) {
            return res.json({
                suggestion: 'Start talking to get AI suggestions! The AI needs some conversation context first.',
                text: 'No transcript context available yet.',
            });
        }

        const suggestion = await generateSuggestion(transcriptContext);

        res.json({
            suggestion,
            text: suggestion,
        });
    } catch (err) {
        console.error('Suggestion error:', err);
        res.status(500).json({
            code: 'SERVER_ERROR',
            message: 'Failed to generate suggestion',
        });
    }
});

export default router;
