import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { getDb } from './db.js';
import authRoutes from './routes/auth.js';
import sessionRoutes from './routes/sessions.js';
import suggestionRoutes from './routes/suggestions.js';
import { setupWebSocket } from './ws/handler.js';

const app = express();
const PORT = process.env.PORT || 4000;

// ── Middleware ─────────────────────────────────────────────
app.use(cors({
    origin: ['http://localhost:5173', 'http://127.0.0.1:5173', 'http://localhost:3000'],
    credentials: true,
}));
app.use(express.json());

// ── Health check ──────────────────────────────────────────
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ── API Routes (v1) ──────────────────────────────────────
app.use('/v1/auth', authRoutes);
app.use('/v1/sessions', sessionRoutes);
app.use('/v1/suggestions', suggestionRoutes);

// ── 404 handler ───────────────────────────────────────────
app.use((req, res) => {
    res.status(404).json({
        code: 'NOT_FOUND',
        message: `Route ${req.method} ${req.path} not found`,
    });
});

// ── Error handler ─────────────────────────────────────────
app.use((err, req, res, _next) => {
    console.error('Unhandled error:', err);
    res.status(500).json({
        code: 'SERVER_ERROR',
        message: 'Internal server error',
    });
});

// ── Start server ──────────────────────────────────────────
const httpServer = createServer(app);

// Attach WebSocket to the same HTTP server
setupWebSocket(httpServer);

// Initialize database
getDb();
console.log('📦 Database initialized');

httpServer.listen(PORT, () => {
    console.log(`
┌──────────────────────────────────────────────┐
│                                              │
│   🎙️  PodcastAI Backend Server               │
│                                              │
│   REST API:  http://localhost:${PORT}/v1       │
│   WebSocket: ws://localhost:${PORT}            │
│   Health:    http://localhost:${PORT}/health    │
│                                              │
└──────────────────────────────────────────────┘
    `);
});
