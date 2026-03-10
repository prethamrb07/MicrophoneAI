import { auth } from './auth';

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/v1';

async function request(endpoint, options = {}) {
    const headers = {
        'Content-Type': 'application/json',
        ...options.headers,
    };

    const token = auth.getToken();
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${BASE_URL}${endpoint}`, {
        ...options,
        headers,
    });

    const data = await response.json();

    if (!response.ok) {
        throw {
            status: response.status,
            code: data.code || 'UNKNOWN_ERROR',
            message: data.message || 'Something went wrong',
        };
    }

    return data;
}

// Auth endpoints
export async function register(name, email, password) {
    return request('/auth/register', {
        method: 'POST',
        body: JSON.stringify({ name, email, password }),
    });
}

export async function login(email, password) {
    const data = await request('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
    });
    auth.setToken(data.token, data.refreshToken, data.user);
    return data;
}

// Session endpoints
export async function createSession(title, hostAName, hostBName, language) {
    return request('/sessions', {
        method: 'POST',
        body: JSON.stringify({ title, hostAName, hostBName, language }),
    });
}

export async function joinSession(joinCode, hostRole = 'host_b') {
    return request('/sessions/join', {
        method: 'POST',
        body: JSON.stringify({ joinCode, hostRole }),
    });
}

// Suggestion endpoint (HTTP fallback)
export async function requestSuggestion(sessionId, hostId, context) {
    return request('/suggestions/request', {
        method: 'POST',
        body: JSON.stringify({ sessionId, hostId, context }),
    });
}

// Transcript endpoint
export async function getTranscript(sessionId, { limit = 50, offset = 0, hostId } = {}) {
    const params = new URLSearchParams({ limit, offset });
    if (hostId) params.append('hostId', hostId);
    return request(`/sessions/${sessionId}/transcript?${params.toString()}`);
}
