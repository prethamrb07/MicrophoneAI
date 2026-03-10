import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createSession, joinSession } from '../services/api';
import { auth } from '../services/auth';
import './Dashboard.css';

export default function Dashboard() {
    const navigate = useNavigate();
    const user = auth.getUser();
    const [tab, setTab] = useState('create');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [createdSession, setCreatedSession] = useState(null);

    const [createForm, setCreateForm] = useState({
        title: '',
        hostAName: user?.name || '',
        hostBName: '',
        language: 'en',
    });
    const [joinCode, setJoinCode] = useState('');

    const handleCreate = async (e) => {
        e.preventDefault();
        if (!createForm.title || !createForm.hostAName) {
            setError('Session title and Host A name are required');
            return;
        }
        setLoading(true);
        setError('');
        try {
            const session = await createSession(
                createForm.title,
                createForm.hostAName,
                createForm.hostBName,
                createForm.language
            );
            setCreatedSession(session);
        } catch (err) {
            setError(err.message || 'Failed to create session');
        } finally {
            setLoading(false);
        }
    };

    const handleJoin = async (e) => {
        e.preventDefault();
        if (!joinCode.trim()) {
            setError('Enter a join code');
            return;
        }
        setLoading(true);
        setError('');
        try {
            const data = await joinSession(joinCode.trim());
            navigate(`/session/${data.sessionId}`);
        } catch (err) {
            setError(err.message || 'Failed to join session');
        } finally {
            setLoading(false);
        }
    };

    const handleLogout = () => {
        auth.clearToken();
        navigate('/login');
    };

    const startSession = () => {
        if (createdSession) {
            navigate(`/session/${createdSession.sessionId}`);
        }
    };

    return (
        <div className="dashboard-page page-enter">
            {/* Nav */}
            <nav className="dash-nav">
                <div className="dash-nav-brand">
                    <svg viewBox="0 0 32 32" fill="none" width="28" height="28">
                        <rect width="32" height="32" rx="8" fill="url(#dnav)" />
                        <path d="M10 13C10 11.3431 11.3431 10 13 10H15C16.6569 10 18 11.3431 18 13V22H13C11.3431 22 10 20.6569 10 19V13Z" fill="white" fillOpacity="0.9" />
                        <path d="M14 13C14 11.3431 15.3431 10 17 10H19C20.6569 10 22 11.3431 22 13V19C22 20.6569 20.6569 22 19 22H18V13Z" fill="white" fillOpacity="0.5" />
                        <defs><linearGradient id="dnav" x1="0" y1="0" x2="32" y2="32"><stop stopColor="#7c3aed" /><stop offset="1" stopColor="#06b6d4" /></linearGradient></defs>
                    </svg>
                    <span className="dash-nav-title">Podcast<span className="gradient-text">AI</span></span>
                </div>
                <div className="dash-nav-right">
                    <span className="dash-user-name">{user?.name || 'User'}</span>
                    <button className="btn-secondary dash-logout" onClick={handleLogout}>
                        Sign Out
                    </button>
                </div>
            </nav>

            {/* Content */}
            <main className="dash-content">
                <div className="dash-header">
                    <h1 className="dash-heading">
                        Welcome back, <span className="gradient-text">{user?.name?.split(' ')[0] || 'Host'}</span>
                    </h1>
                    <p className="dash-subheading">Create a new podcast session or join an existing one.</p>
                </div>

                {/* Tabs */}
                <div className="dash-tabs">
                    <button
                        className={`dash-tab ${tab === 'create' ? 'active' : ''}`}
                        onClick={() => { setTab('create'); setError(''); }}
                    >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="16" /><line x1="8" y1="12" x2="16" y2="12" /></svg>
                        New Session
                    </button>
                    <button
                        className={`dash-tab ${tab === 'join' ? 'active' : ''}`}
                        onClick={() => { setTab('join'); setError(''); }}
                    >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M15 3h4a2 2 0 012 2v14a2 2 0 01-2 2h-4" /><polyline points="10 17 15 12 10 7" /><line x1="15" y1="12" x2="3" y2="12" /></svg>
                        Join Session
                    </button>
                </div>

                {error && <div className="dash-error">{error}</div>}

                {/* Create Session */}
                {tab === 'create' && !createdSession && (
                    <form className="dash-card glass-card" onSubmit={handleCreate}>
                        <h2 className="dash-card-title">Create a New Session</h2>
                        <p className="dash-card-desc">Set up your podcast session and invite your co-host.</p>

                        <div className="dash-form-grid">
                            <div className="form-group dash-form-full">
                                <label className="input-label">Session Title</label>
                                <input
                                    className="input-field"
                                    placeholder="e.g. Tech Talk Episode 42"
                                    value={createForm.title}
                                    onChange={(e) => setCreateForm({ ...createForm, title: e.target.value })}
                                />
                            </div>

                            <div className="form-group">
                                <label className="input-label">Host A (You)</label>
                                <input
                                    className="input-field"
                                    placeholder="Your name"
                                    value={createForm.hostAName}
                                    onChange={(e) => setCreateForm({ ...createForm, hostAName: e.target.value })}
                                />
                            </div>

                            <div className="form-group">
                                <label className="input-label">Host B (Co-host)</label>
                                <input
                                    className="input-field"
                                    placeholder="Co-host name"
                                    value={createForm.hostBName}
                                    onChange={(e) => setCreateForm({ ...createForm, hostBName: e.target.value })}
                                />
                            </div>

                            <div className="form-group">
                                <label className="input-label">Language</label>
                                <select
                                    className="input-field"
                                    value={createForm.language}
                                    onChange={(e) => setCreateForm({ ...createForm, language: e.target.value })}
                                >
                                    <option value="en">English</option>
                                    <option value="es">Spanish</option>
                                    <option value="fr">French</option>
                                    <option value="de">German</option>
                                    <option value="ja">Japanese</option>
                                    <option value="ko">Korean</option>
                                    <option value="zh">Chinese</option>
                                    <option value="hi">Hindi</option>
                                </select>
                            </div>
                        </div>

                        <button type="submit" className="btn-primary" disabled={loading}>
                            <span>{loading ? 'Creating...' : 'Create Session'}</span>
                            {loading && <div className="loader" />}
                        </button>
                    </form>
                )}

                {/* Created Session Card */}
                {tab === 'create' && createdSession && (
                    <div className="dash-card glass-card dash-created">
                        <div className="dash-created-icon">
                            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--success)" strokeWidth="2" strokeLinecap="round"><path d="M22 11.08V12a10 10 0 11-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></svg>
                        </div>
                        <h2 className="dash-card-title">Session Created!</h2>
                        <p className="dash-card-desc">Share this code with your co-host to join:</p>
                        <div className="dash-join-code">{createdSession.joinCode}</div>
                        <p className="dash-session-id">Session: {createdSession.sessionId}</p>
                        <div className="dash-created-actions">
                            <button className="btn-primary" onClick={startSession}>
                                <span>Start Recording</span>
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="5 3 19 12 5 21 5 3" /></svg>
                            </button>
                            <button className="btn-secondary" onClick={() => setCreatedSession(null)}>
                                Create Another
                            </button>
                        </div>
                    </div>
                )}

                {/* Join Session */}
                {tab === 'join' && (
                    <form className="dash-card glass-card" onSubmit={handleJoin}>
                        <h2 className="dash-card-title">Join a Session</h2>
                        <p className="dash-card-desc">Enter the code shared by the session creator.</p>

                        <div className="form-group">
                            <label className="input-label">Join Code</label>
                            <input
                                className="input-field dash-join-input"
                                placeholder="e.g. XKCD42"
                                value={joinCode}
                                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                                maxLength={10}
                            />
                        </div>

                        <button type="submit" className="btn-primary" disabled={loading}>
                            <span>{loading ? 'Joining...' : 'Join Session'}</span>
                            {loading && <div className="loader" />}
                        </button>
                    </form>
                )}

                {/* Feature cards */}
                <div className="dash-features">
                    <div className="dash-feature glass-card">
                        <div className="dash-feature-icon">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--accent-primary)" strokeWidth="2" strokeLinecap="round"><path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z" /><path d="M19 10v2a7 7 0 01-14 0v-2" /><line x1="12" y1="19" x2="12" y2="23" /><line x1="8" y1="23" x2="16" y2="23" /></svg>
                        </div>
                        <h3>Live Transcription</h3>
                        <p>Real-time speech-to-text powered by OpenAI Whisper</p>
                    </div>
                    <div className="dash-feature glass-card">
                        <div className="dash-feature-icon">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--accent-secondary)" strokeWidth="2" strokeLinecap="round"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" /></svg>
                        </div>
                        <h3>AI Suggestions</h3>
                        <p>GPT-4 powered real-time coaching delivered to your earpiece</p>
                    </div>
                    <div className="dash-feature glass-card">
                        <div className="dash-feature-icon">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--success)" strokeWidth="2" strokeLinecap="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 00-3-3.87" /><path d="M16 3.13a4 4 0 010 7.75" /></svg>
                        </div>
                        <h3>Two-Host Setup</h3>
                        <p>Designed for collaborative podcast sessions with two hosts</p>
                    </div>
                </div>
            </main>
        </div>
    );
}
