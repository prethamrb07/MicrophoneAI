import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { auth } from '../services/auth';
import { PodcastWebSocket } from '../services/websocket';
import './Session.css';

export default function Session() {
    const { sessionId } = useParams();
    const navigate = useNavigate();
    const user = auth.getUser();

    // State
    const [isConnected, setIsConnected] = useState(false);
    const [isReconnecting, setIsReconnecting] = useState(false);
    const [reconnectAttempt, setReconnectAttempt] = useState(0);
    const [isRecording, setIsRecording] = useState(false);
    const [transcript, setTranscript] = useState([]);
    const [interimText, setInterimText] = useState({ host_a: '', host_b: '' });
    const [suggestion, setSuggestion] = useState(null);
    const [suggestionRequested, setSuggestionRequested] = useState(false);
    const [timer, setTimer] = useState(0);
    const [micLevel, setMicLevel] = useState(0);
    const [error, setError] = useState('');
    // WebRTC state
    const [peerConnected, setPeerConnected] = useState(false);
    const [peerName, setPeerName] = useState('');
    const [callActive, setCallActive] = useState(false);

    // Refs
    const wsRef = useRef(null);
    const audioContextRef = useRef(null);
    const mediaStreamRef = useRef(null);
    const processorRef = useRef(null);
    const analyserRef = useRef(null);
    const transcriptEndRef = useRef(null);
    const timerRef = useRef(null);
    const animFrameRef = useRef(null);
    // WebRTC refs
    const peerConnectionRef = useRef(null);
    const remoteAudioRef = useRef(null);
    const localStreamRef = useRef(null);

    const hostId = 'host_a'; // Default to host_a for creator

    const ICE_SERVERS = [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
    ];

    // Auto-scroll transcript
    useEffect(() => {
        transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [transcript, interimText]);

    // Timer
    useEffect(() => {
        if (isRecording) {
            timerRef.current = setInterval(() => setTimer(t => t + 1), 1000);
        } else {
            clearInterval(timerRef.current);
        }
        return () => clearInterval(timerRef.current);
    }, [isRecording]);

    // Create WebRTC peer connection
    const createPeerConnection = useCallback(() => {
        const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

        pc.onicecandidate = (event) => {
            if (event.candidate && wsRef.current) {
                wsRef.current.sendICECandidate(event.candidate);
            }
        };

        pc.ontrack = (event) => {
            if (remoteAudioRef.current && event.streams[0]) {
                remoteAudioRef.current.srcObject = event.streams[0];
                setCallActive(true);
            }
        };

        pc.oniceconnectionstatechange = () => {
            if (pc.iceConnectionState === 'disconnected' || pc.iceConnectionState === 'failed') {
                setCallActive(false);
            }
        };

        peerConnectionRef.current = pc;
        return pc;
    }, []);

    // Start a call (as the offerer)
    const startCall = useCallback(async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            localStreamRef.current = stream;

            const pc = createPeerConnection();
            stream.getTracks().forEach(track => pc.addTrack(track, stream));

            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);

            if (wsRef.current) {
                wsRef.current.sendWebRTCOffer(offer);
            }
        } catch (err) {
            console.error('Failed to start call:', err);
            setError('Failed to access microphone for call');
        }
    }, [createPeerConnection]);

    // WebSocket connection
    useEffect(() => {
        const ws = new PodcastWebSocket();
        wsRef.current = ws;

        ws.on('open', () => setIsConnected(true));
        ws.on('close', () => setIsConnected(false));
        ws.on('reconnecting', (data) => {
            setIsReconnecting(true);
            setReconnectAttempt(data.attempt);
        });
        ws.on('reconnect_failed', () => {
            setIsReconnecting(false);
            setError('Connection lost. Please rejoin the session.');
        });
        ws.on('connection_confirmed', () => {
            setIsReconnecting(false);
        });
        ws.on('transcription_update', (msg) => {
            if (msg.isFinal) {
                setTranscript(prev => [...prev, {
                    id: Date.now() + Math.random(),
                    hostId: msg.hostId,
                    text: msg.text,
                    timestamp: new Date().toLocaleTimeString(),
                }]);
                setInterimText(prev => ({ ...prev, [msg.hostId]: '' }));
            } else {
                setInterimText(prev => ({ ...prev, [msg.hostId]: msg.text }));
            }
        });
        ws.on('suggestion_audio', (msg) => {
            setSuggestion({ format: msg.format, length: msg.length, text: 'AI suggestion received' });
            setSuggestionRequested(false);
        });
        ws.on('error', (msg) => {
            setError(msg.message || 'An error occurred');
        });

        // WebRTC signaling handlers
        ws.on('peer_joined', (msg) => {
            setPeerConnected(true);
            setPeerName(msg.userName || msg.hostId);
            // Auto-initiate call when peer joins
            setTimeout(() => startCall(), 500);
        });

        ws.on('peer_left', () => {
            setPeerConnected(false);
            setPeerName('');
            setCallActive(false);
            if (peerConnectionRef.current) {
                peerConnectionRef.current.close();
                peerConnectionRef.current = null;
            }
        });

        ws.on('webrtc_offer', async (msg) => {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                localStreamRef.current = stream;

                const pc = createPeerConnection();
                stream.getTracks().forEach(track => pc.addTrack(track, stream));

                await pc.setRemoteDescription(new RTCSessionDescription(msg.offer));
                const answer = await pc.createAnswer();
                await pc.setLocalDescription(answer);

                ws.sendWebRTCAnswer(answer);
            } catch (err) {
                console.error('Failed to handle offer:', err);
            }
        });

        ws.on('webrtc_answer', async (msg) => {
            try {
                if (peerConnectionRef.current) {
                    await peerConnectionRef.current.setRemoteDescription(
                        new RTCSessionDescription(msg.answer)
                    );
                }
            } catch (err) {
                console.error('Failed to handle answer:', err);
            }
        });

        ws.on('webrtc_ice_candidate', async (msg) => {
            try {
                if (peerConnectionRef.current && msg.candidate) {
                    await peerConnectionRef.current.addIceCandidate(
                        new RTCIceCandidate(msg.candidate)
                    );
                }
            } catch (err) {
                console.error('Failed to add ICE candidate:', err);
            }
        });

        const token = auth.getToken();
        if (token && sessionId) {
            ws.connect(token, sessionId, hostId);
        }

        return () => {
            ws.disconnect();
            if (peerConnectionRef.current) {
                peerConnectionRef.current.close();
            }
            if (localStreamRef.current) {
                localStreamRef.current.getTracks().forEach(t => t.stop());
            }
        };
    }, [sessionId, createPeerConnection, startCall]);

    // Mic level animation
    const updateMicLevel = useCallback(() => {
        if (analyserRef.current) {
            const data = new Uint8Array(analyserRef.current.frequencyBinCount);
            analyserRef.current.getByteFrequencyData(data);
            const avg = data.reduce((a, b) => a + b, 0) / data.length;
            setMicLevel(avg / 255);
        }
        animFrameRef.current = requestAnimationFrame(updateMicLevel);
    }, []);

    // Start/Stop recording
    const toggleRecording = async () => {
        if (isRecording) {
            // Stop
            if (mediaStreamRef.current) {
                mediaStreamRef.current.getTracks().forEach(t => t.stop());
            }
            if (processorRef.current) {
                processorRef.current.disconnect();
            }
            if (audioContextRef.current) {
                audioContextRef.current.close();
            }
            cancelAnimationFrame(animFrameRef.current);
            setIsRecording(false);
            setMicLevel(0);
            return;
        }

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaStreamRef.current = stream;

            const audioContext = new AudioContext();
            audioContextRef.current = audioContext;

            const source = audioContext.createMediaStreamSource(stream);

            // Analyser for visualisation
            const analyser = audioContext.createAnalyser();
            analyser.fftSize = 256;
            analyserRef.current = analyser;
            source.connect(analyser);

            // ScriptProcessor to send audio chunks ~250ms
            const bufferSize = Math.ceil(audioContext.sampleRate * 0.25);
            // Use nearest power of 2
            const processorSize = Math.min(16384, Math.pow(2, Math.ceil(Math.log2(bufferSize))));
            const processor = audioContext.createScriptProcessor(processorSize, 1, 1);
            processorRef.current = processor;

            processor.onaudioprocess = (e) => {
                const inputData = e.inputBuffer.getChannelData(0);
                const buffer = new Float32Array(inputData);
                if (wsRef.current) {
                    wsRef.current.sendAudioChunk(buffer.buffer);
                }
            };

            source.connect(processor);
            processor.connect(audioContext.destination);

            setIsRecording(true);
            updateMicLevel();
        } catch (err) {
            setError('Microphone access denied. Please allow microphone access.');
        }
    };

    const handleSuggestion = () => {
        if (wsRef.current) {
            wsRef.current.requestSuggestion();
            setSuggestionRequested(true);
        }
    };

    const handleLeave = () => {
        if (wsRef.current) wsRef.current.disconnect();
        navigate('/dashboard');
    };

    const formatTime = (s) => {
        const h = Math.floor(s / 3600);
        const m = Math.floor((s % 3600) / 60);
        const sec = s % 60;
        return `${h > 0 ? h + ':' : ''}${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
    };

    return (
        <div className="session-page page-enter">
            {/* Header */}
            <header className="session-header">
                <div className="session-header-left">
                    <button className="btn-secondary session-back" onClick={handleLeave}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="15 18 9 12 15 6" /></svg>
                        Leave
                    </button>
                    <div className="session-info">
                        <h1 className="session-title">Session <span className="session-id-badge">{sessionId?.slice(0, 10)}</span></h1>
                        <div className="session-meta">
                            {isRecording && <span className="live-pulse" />}
                            {isRecording && <span className="session-live-text">LIVE</span>}
                            <span className="session-timer">{formatTime(timer)}</span>
                        </div>
                    </div>
                </div>
                <div className="session-header-right">
                    <div className={`session-status ${isConnected ? 'connected' : isReconnecting ? 'reconnecting' : 'disconnected'}`}>
                        <span className="session-status-dot" />
                        <span>{isConnected ? 'Connected' : isReconnecting ? `Reconnecting (${reconnectAttempt}/3)...` : 'Disconnected'}</span>
                    </div>
                </div>
            </header>

            {error && (
                <div className="session-error">
                    <span>{error}</span>
                    <button onClick={() => setError('')}>✕</button>
                </div>
            )}

            {/* Main Content */}
            <div className="session-body">
                {/* Transcript Panel */}
                <section className="session-transcript glass-card">
                    <div className="session-panel-header">
                        <h2>
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /></svg>
                            Live Transcript
                        </h2>
                        <span className="transcript-count">{transcript.length} lines</span>
                    </div>

                    <div className="transcript-body">
                        {transcript.length === 0 && !interimText.host_a && !interimText.host_b && (
                            <div className="transcript-empty">
                                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--text-tertiary)" strokeWidth="1" strokeLinecap="round"><path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z" /><path d="M19 10v2a7 7 0 01-14 0v-2" /></svg>
                                <p>Start recording to see the live transcript</p>
                            </div>
                        )}

                        {transcript.map((line) => (
                            <div key={line.id} className={`transcript-line ${line.hostId}`}>
                                <div className={`transcript-avatar ${line.hostId}`}>
                                    {line.hostId === 'host_a' ? 'A' : 'B'}
                                </div>
                                <div className="transcript-content">
                                    <div className="transcript-line-header">
                                        <span className={`transcript-host-name ${line.hostId}`}>
                                            {line.hostId === 'host_a' ? 'Host A' : 'Host B'}
                                        </span>
                                        <span className="transcript-timestamp">{line.timestamp}</span>
                                    </div>
                                    <p className="transcript-text">{line.text}</p>
                                </div>
                            </div>
                        ))}

                        {/* Interim text */}
                        {interimText.host_a && (
                            <div className="transcript-line host_a interim">
                                <div className="transcript-avatar host_a">A</div>
                                <div className="transcript-content">
                                    <div className="transcript-line-header">
                                        <span className="transcript-host-name host_a">Host A</span>
                                        <span className="transcript-interim-badge">typing...</span>
                                    </div>
                                    <p className="transcript-text interim-text">{interimText.host_a}</p>
                                </div>
                            </div>
                        )}
                        {interimText.host_b && (
                            <div className="transcript-line host_b interim">
                                <div className="transcript-avatar host_b">B</div>
                                <div className="transcript-content">
                                    <div className="transcript-line-header">
                                        <span className="transcript-host-name host_b">Host B</span>
                                        <span className="transcript-interim-badge">typing...</span>
                                    </div>
                                    <p className="transcript-text interim-text">{interimText.host_b}</p>
                                </div>
                            </div>
                        )}

                        <div ref={transcriptEndRef} />
                    </div>
                </section>

                {/* Right Panel */}
                <aside className="session-sidebar">
                    {/* Audio Controls */}
                    <div className="session-controls glass-card">
                        <div className="session-panel-header">
                            <h2>
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z" /><path d="M19 10v2a7 7 0 01-14 0v-2" /></svg>
                                Audio
                            </h2>
                        </div>

                        {/* Mic visualizer */}
                        <div className="mic-visualizer">
                            <div className="mic-bars">
                                {[...Array(20)].map((_, i) => (
                                    <div
                                        key={i}
                                        className="mic-bar"
                                        style={{
                                            height: `${Math.max(4, micLevel * 100 * (0.5 + Math.random() * 0.5))}%`,
                                            animationDelay: `${i * 30}ms`,
                                        }}
                                    />
                                ))}
                            </div>
                            <span className="mic-level-text">
                                {isRecording ? `${Math.round(micLevel * 100)}%` : 'Idle'}
                            </span>
                        </div>

                        <button
                            className={`session-rec-btn ${isRecording ? 'recording' : ''}`}
                            onClick={toggleRecording}
                            disabled={!isConnected}
                        >
                            <div className="rec-btn-inner">
                                {isRecording ? (
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2" /></svg>
                                ) : (
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="8" /></svg>
                                )}
                            </div>
                            <span>{isRecording ? 'Stop Recording' : 'Start Recording'}</span>
                        </button>
                    </div>

                    {/* AI Suggestions */}
                    <div className="session-suggestions glass-card">
                        <div className="session-panel-header">
                            <h2>
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" /></svg>
                                AI Suggestions
                            </h2>
                        </div>

                        <p className="suggestion-desc">
                            Press the button below to get an AI-generated suggestion delivered to your earpiece.
                        </p>

                        <button
                            className="btn-primary suggestion-btn"
                            onClick={handleSuggestion}
                            disabled={!isConnected || !isRecording || suggestionRequested}
                        >
                            <span>
                                {suggestionRequested ? (
                                    <>Generating... <div className="loader" /></>
                                ) : (
                                    <>
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" /></svg>
                                        HELP ME
                                    </>
                                )}
                            </span>
                        </button>

                        {suggestion && (
                            <div className="suggestion-result">
                                <div className="suggestion-result-header">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--success)" strokeWidth="2" strokeLinecap="round"><path d="M22 11.08V12a10 10 0 11-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></svg>
                                    <span>Suggestion ready</span>
                                </div>
                                <p className="suggestion-meta">
                                    Audio ({suggestion.format}) — {suggestion.length ? `${(suggestion.length / 1024).toFixed(1)}KB` : 'streaming'}
                                </p>
                            </div>
                        )}
                    </div>

                    {/* Peer Call Status */}
                    <div className="session-info-card glass-card">
                        <div className="session-panel-header">
                            <h2>
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                                    <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z" />
                                </svg>
                                Live Call
                            </h2>
                        </div>
                        <div className="info-items">
                            {peerConnected ? (
                                <>
                                    <div className="info-item">
                                        <span className="info-label">Co-Host</span>
                                        <span className="info-value" style={{ color: '#a78bfa' }}>{peerName}</span>
                                    </div>
                                    <div className="info-item">
                                        <span className="info-label">Audio</span>
                                        <span className="info-value" style={{ color: callActive ? '#4ade80' : '#fbbf24' }}>
                                            {callActive ? '🔊 Connected' : '⏳ Connecting...'}
                                        </span>
                                    </div>
                                </>
                            ) : (
                                <div className="info-item">
                                    <span className="info-label" style={{ color: '#94a3b8' }}>
                                        Waiting for co-host to join...
                                    </span>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Hidden remote audio element */}
                    <audio ref={remoteAudioRef} autoPlay playsInline style={{ display: 'none' }} />

                    {/* Session Info */}
                    <div className="session-info-card glass-card">
                        <div className="session-panel-header">
                            <h2>
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" /></svg>
                                Info
                            </h2>
                        </div>
                        <div className="info-items">
                            <div className="info-item">
                                <span className="info-label">Session ID</span>
                                <span className="info-value">{sessionId}</span>
                            </div>
                            <div className="info-item">
                                <span className="info-label">Your Role</span>
                                <span className="info-value host_a">Host A</span>
                            </div>
                            <div className="info-item">
                                <span className="info-label">User</span>
                                <span className="info-value">{user?.name || 'Unknown'}</span>
                            </div>
                        </div>
                    </div>
                </aside>
            </div>
        </div>
    );
}
