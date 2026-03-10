import { WebSocketServer } from 'ws';
import { URL } from 'url';
import { verifyToken } from '../middleware/auth.js';
import { getDb } from '../db.js';
import { generateSuggestion } from '../services/gemini.js';

// Track connected clients per session
const sessionClients = new Map(); // sessionId -> Map(ws -> { hostId, userId })

export function setupWebSocket(server) {
    const wss = new WebSocketServer({ server });

    wss.on('connection', (ws, req) => {
        // Parse auth from query params
        const url = new URL(req.url, `http://${req.headers.host}`);
        const token = url.searchParams.get('token');
        const sessionId = url.searchParams.get('sessionId');
        const hostId = url.searchParams.get('hostId');

        // Verify token
        const user = verifyToken(token);
        if (!user) {
            ws.send(JSON.stringify({ type: 'error', message: 'Authentication failed' }));
            ws.close(1008, 'Authentication failed');
            return;
        }

        if (!sessionId) {
            ws.send(JSON.stringify({ type: 'error', message: 'sessionId is required' }));
            ws.close(1008, 'Missing sessionId');
            return;
        }

        // Register client in session
        if (!sessionClients.has(sessionId)) {
            sessionClients.set(sessionId, new Map());
        }
        const clients = sessionClients.get(sessionId);
        clients.set(ws, { hostId: hostId || 'host_a', userId: user.userId, userName: user.name });

        console.log(`🎙️  [WS] ${user.name} connected to session ${sessionId} as ${hostId}`);

        // Send connection confirmation
        ws.send(JSON.stringify({
            type: 'connection_confirmed',
            sessionId,
            hostId,
            userId: user.userId,
        }));

        // Handle messages
        ws.on('message', async (data, isBinary) => {
            if (isBinary) {
                // Audio chunk received — simulate transcription
                handleAudioChunk(ws, sessionId, hostId, data);
            } else {
                try {
                    const msg = JSON.parse(data.toString());
                    switch (msg.type) {
                        case 'ping':
                            ws.send(JSON.stringify({ type: 'pong' }));
                            break;
                        case 'request_suggestion':
                            await handleSuggestionRequest(ws, sessionId, hostId);
                            break;
                        default:
                            console.warn('Unknown WS message type:', msg.type);
                    }
                } catch (e) {
                    console.error('Failed to parse WS message:', e);
                }
            }
        });

        ws.on('close', () => {
            clients.delete(ws);
            if (clients.size === 0) {
                sessionClients.delete(sessionId);
            }
            console.log(`🎙️  [WS] ${user.name} disconnected from session ${sessionId}`);
        });

        ws.on('error', (err) => {
            console.error(`[WS] Error for ${user.name}:`, err.message);
        });
    });

    console.log('🔌 WebSocket server attached');
}

// Audio buffer per client for accumulating chunks before "transcribing"
const audioBuffers = new Map(); // ws -> { chunks: [], lastFlush: timestamp, wordIndex: 0 }

// Simulated transcription phrases for demo (when no real STT is available)
const demoTranscriptions = [
    "Welcome everyone to another episode of our podcast.",
    "Today we're going to be discussing some really exciting topics.",
    "I've been thinking about this a lot lately and I have some thoughts to share.",
    "That's a really great point, I completely agree with you on that.",
    "Let me give you some background on why this matters.",
    "Our listeners have been asking about this topic for weeks.",
    "I think the key takeaway here is that we need to be more intentional.",
    "What do you think about the recent developments in this space?",
    "I'd love to hear your perspective on this.",
    "Let's dive deeper into this topic, it's really fascinating.",
    "Before we wrap up, I want to mention something important.",
    "That reminds me of a conversation I had last week.",
    "The data really speaks for itself in this case.",
    "I couldn't agree more, that's exactly what I was going to say.",
    "Let's take a moment to reflect on what we've discussed so far.",
];

function handleAudioChunk(ws, sessionId, hostId, audioData) {
    if (!audioBuffers.has(ws)) {
        audioBuffers.set(ws, { chunks: [], lastFlush: Date.now(), transcriptIndex: 0 });
    }

    const buffer = audioBuffers.get(ws);
    buffer.chunks.push(audioData);

    const now = Date.now();
    const timeSinceFlush = now - buffer.lastFlush;

    // Every ~3 seconds, generate a transcription update
    if (timeSinceFlush >= 3000) {
        // First send interim text (partial transcription effect)
        const phrase = demoTranscriptions[buffer.transcriptIndex % demoTranscriptions.length];
        const words = phrase.split(' ');
        const partialText = words.slice(0, Math.ceil(words.length * 0.6)).join(' ') + '...';

        broadcastToSession(sessionId, {
            type: 'transcription_update',
            hostId,
            text: partialText,
            isFinal: false,
        });

        // After a short delay, send the final version
        setTimeout(() => {
            broadcastToSession(sessionId, {
                type: 'transcription_update',
                hostId,
                text: phrase,
                isFinal: true,
            });

            // Save to database
            try {
                const db = getDb();
                db.prepare(
                    'INSERT INTO transcript_lines (sessionId, hostId, text, isFinal) VALUES (?, ?, ?, 1)'
                ).run(sessionId, hostId, phrase);
            } catch (err) {
                console.error('Failed to save transcript line:', err);
            }
        }, 800);

        buffer.transcriptIndex++;
        buffer.lastFlush = now;
        buffer.chunks = [];
    }
}

async function handleSuggestionRequest(ws, sessionId, hostId) {
    try {
        const db = getDb();
        const recentLines = db
            .prepare(
                'SELECT hostId, text FROM transcript_lines WHERE sessionId = ? ORDER BY id DESC LIMIT 20'
            )
            .all(sessionId)
            .reverse();

        const context = recentLines.map((l) => `${l.hostId}: ${l.text}`).join('\n');

        const suggestionText = await generateSuggestion(context || 'A podcast just started.');

        // Send suggestion as JSON
        ws.send(JSON.stringify({
            type: 'suggestion_audio',
            format: 'text',
            length: suggestionText.length,
            text: suggestionText,
        }));

        console.log(`💡 [WS] Suggestion sent to ${hostId} in session ${sessionId}`);
    } catch (err) {
        console.error('Suggestion request error:', err);
        ws.send(JSON.stringify({
            type: 'error',
            message: 'Failed to generate suggestion',
        }));
    }
}

function broadcastToSession(sessionId, message) {
    const clients = sessionClients.get(sessionId);
    if (!clients) return;

    const data = JSON.stringify(message);
    for (const [clientWs] of clients) {
        if (clientWs.readyState === 1) { // WebSocket.OPEN
            clientWs.send(data);
        }
    }
}
