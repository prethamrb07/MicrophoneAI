const WS_BASE = import.meta.env.VITE_WS_URL || 'ws://localhost:4000';
const MAX_RECONNECTS = 3;
const RECONNECT_WINDOW = 30000; // 30 seconds
const PING_INTERVAL = 15000;

export class PodcastWebSocket {
    constructor() {
        this.ws = null;
        this.reconnectCount = 0;
        this.reconnectTimer = null;
        this.pingTimer = null;
        this.handlers = {};
        this.isConnected = false;
        this.connectionParams = null;
    }

    connect(token, sessionId, hostId) {
        this.connectionParams = { token, sessionId, hostId };
        const url = `${WS_BASE}?token=${encodeURIComponent(token)}&sessionId=${encodeURIComponent(sessionId)}&hostId=${encodeURIComponent(hostId)}`;

        this.ws = new WebSocket(url);
        this.ws.binaryType = 'arraybuffer';

        this.ws.onopen = () => {
            this.isConnected = true;
            this.reconnectCount = 0;
            this._startPing();
            this._emit('open');
        };

        this.ws.onmessage = (event) => {
            if (event.data instanceof ArrayBuffer) {
                // Binary data = suggestion audio
                this._emit('suggestion_audio_data', event.data);
                return;
            }

            try {
                const msg = JSON.parse(event.data);
                switch (msg.type) {
                    case 'connection_confirmed':
                        this._emit('connection_confirmed', msg);
                        break;
                    case 'transcription_update':
                        this._emit('transcription_update', msg);
                        break;
                    case 'suggestion_audio':
                        this._emit('suggestion_audio', msg);
                        break;
                    case 'error':
                        this._emit('error', msg);
                        break;
                    case 'pong':
                        break;
                    default:
                        console.warn('Unknown WS message type:', msg.type);
                }
            } catch (e) {
                console.error('Failed to parse WS message:', e);
            }
        };

        this.ws.onclose = () => {
            this.isConnected = false;
            this._stopPing();
            this._emit('close');
            this._attemptReconnect();
        };

        this.ws.onerror = (err) => {
            console.error('WebSocket error:', err);
            this._emit('error', { message: 'Connection error' });
        };
    }

    sendAudioChunk(blob) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(blob);
        }
    }

    requestSuggestion() {
        this._send({ type: 'request_suggestion' });
    }

    ping() {
        this._send({ type: 'ping' });
    }

    on(event, handler) {
        if (!this.handlers[event]) this.handlers[event] = [];
        this.handlers[event].push(handler);
        return () => {
            this.handlers[event] = this.handlers[event].filter(h => h !== handler);
        };
    }

    disconnect() {
        this._stopPing();
        if (this.ws) {
            this.ws.onclose = null; // prevent reconnect
            this.ws.close();
            this.ws = null;
        }
        this.isConnected = false;
        clearTimeout(this.reconnectTimer);
    }

    _send(data) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(data));
        }
    }

    _emit(event, data) {
        (this.handlers[event] || []).forEach(h => h(data));
    }

    _startPing() {
        this._stopPing();
        this.pingTimer = setInterval(() => this.ping(), PING_INTERVAL);
    }

    _stopPing() {
        if (this.pingTimer) clearInterval(this.pingTimer);
    }

    _attemptReconnect() {
        if (this.reconnectCount >= MAX_RECONNECTS) {
            this._emit('reconnect_failed');
            return;
        }
        this.reconnectCount++;
        const delay = Math.min(1000 * Math.pow(2, this.reconnectCount), 10000);
        this._emit('reconnecting', { attempt: this.reconnectCount, maxAttempts: MAX_RECONNECTS });
        this.reconnectTimer = setTimeout(() => {
            if (this.connectionParams) {
                const { token, sessionId, hostId } = this.connectionParams;
                this.connect(token, sessionId, hostId);
            }
        }, delay);
    }
}
