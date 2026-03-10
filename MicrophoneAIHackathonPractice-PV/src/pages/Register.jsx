import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { register } from '../services/api';
import './Auth.css';

export default function Register() {
    const navigate = useNavigate();
    const [form, setForm] = useState({ name: '', email: '', password: '' });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);

    const handleChange = (e) => {
        setForm({ ...form, [e.target.name]: e.target.value });
        setError('');
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!form.name || !form.email || !form.password) {
            setError('Please fill in all fields');
            return;
        }
        if (form.password.length < 6) {
            setError('Password must be at least 6 characters');
            return;
        }
        setLoading(true);
        setError('');
        try {
            await register(form.name, form.email, form.password);
            setSuccess(true);
            setTimeout(() => navigate('/login'), 2000);
        } catch (err) {
            setError(err.message || 'Registration failed');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="auth-page page-enter">
            <div className="auth-container">
                <div className="auth-brand">
                    <div className="auth-logo">
                        <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <rect width="48" height="48" rx="12" fill="url(#logo-grad2)" />
                            <path d="M16 20C16 17.7909 17.7909 16 20 16H22C24.2091 16 26 17.7909 26 20V32H20C17.7909 32 16 30.2091 16 28V20Z" fill="white" fillOpacity="0.9" />
                            <path d="M22 20C22 17.7909 23.7909 16 26 16H28C30.2091 16 32 17.7909 32 20V28C32 30.2091 30.2091 32 28 32H26V20Z" fill="white" fillOpacity="0.5" />
                            <circle cx="20" cy="22" r="1.5" fill="url(#logo-grad2)" />
                            <circle cx="28" cy="22" r="1.5" fill="url(#logo-grad2)" />
                            <defs>
                                <linearGradient id="logo-grad2" x1="0" y1="0" x2="48" y2="48">
                                    <stop stopColor="#7c3aed" />
                                    <stop offset="1" stopColor="#06b6d4" />
                                </linearGradient>
                            </defs>
                        </svg>
                    </div>
                    <h1 className="auth-title">
                        Podcast<span className="gradient-text">AI</span>
                    </h1>
                    <p className="auth-subtitle">Your AI-powered podcast co-host</p>
                </div>

                <form className="auth-form glass-card" onSubmit={handleSubmit}>
                    <h2 className="auth-form-title">Create account</h2>
                    <p className="auth-form-subtitle">Start your AI-powered podcasting journey</p>

                    {error && <div className="auth-error">{error}</div>}
                    {success && (
                        <div className="auth-success">
                            Account created! Redirecting to login...
                        </div>
                    )}

                    <div className="form-group">
                        <label className="input-label" htmlFor="name">Full Name</label>
                        <input
                            id="name"
                            name="name"
                            type="text"
                            className="input-field"
                            placeholder="John Doe"
                            value={form.name}
                            onChange={handleChange}
                            autoComplete="name"
                        />
                    </div>

                    <div className="form-group">
                        <label className="input-label" htmlFor="reg-email">Email</label>
                        <input
                            id="reg-email"
                            name="email"
                            type="email"
                            className="input-field"
                            placeholder="you@example.com"
                            value={form.email}
                            onChange={handleChange}
                            autoComplete="email"
                        />
                    </div>

                    <div className="form-group">
                        <label className="input-label" htmlFor="reg-password">Password</label>
                        <input
                            id="reg-password"
                            name="password"
                            type="password"
                            className="input-field"
                            placeholder="Min. 6 characters"
                            value={form.password}
                            onChange={handleChange}
                            autoComplete="new-password"
                        />
                    </div>

                    <button type="submit" className="btn-primary auth-submit" disabled={loading || success}>
                        <span>{loading ? 'Creating account...' : 'Create Account'}</span>
                        {loading && <div className="loader" />}
                    </button>

                    <p className="auth-switch">
                        Already have an account? <Link to="/login">Sign in</Link>
                    </p>
                </form>
            </div>
        </div>
    );
}
