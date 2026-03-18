import axios from 'axios';
import EventSource from 'react-native-sse';
import { secureStorage } from './secureStorage';

const AUTH_TOKEN_KEY = 'auth_token';

// Use localhost for local development (or configure via .env in a real setup)
// Note: Android Emulator uses 10.0.2.2 to access host localhost.
// To use env vars, you would typically use 'react-native-dotenv' or 'expo-constants'
// For this public repo, we default to localhost.
const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8000';

const api = axios.create({
    baseURL: API_URL,
});

let authToken: string | null = null;
let onSessionExpired: (() => void) | null = null;

export const loadAuthToken = async () => {
    try {
        const token = await secureStorage.getItem(AUTH_TOKEN_KEY);
        if (token) {
            authToken = token;
        }
        return token;
    } catch (error) {
        console.error("Failed to load auth token:", error);
        return null;
    }
};

export const setAuthToken = async (token: string | null) => {
    authToken = token;
    if (token) {
        try {
            await secureStorage.setItem(AUTH_TOKEN_KEY, token);
        } catch (error) {
            console.error("Failed to save auth token:", error);
        }
    }
};

export const clearAuthToken = async () => {
    authToken = null;
    try {
        await secureStorage.removeItem(AUTH_TOKEN_KEY);
    } catch (error) {
        console.error("Failed to clear auth token:", error);
    }
};

export const setupAxiosInterceptors = (onUnauthenticated: () => void) => {
    onSessionExpired = onUnauthenticated;
};

api.interceptors.request.use(request => {
    if (authToken) {
        request.headers['X-API-Token'] = authToken;
    }
    return request;
});

api.interceptors.response.use(
    response => response,
    error => {
        if (error.response && error.response.status === 401) {
            console.log('Session expired (401), triggering logout...');
            if (onSessionExpired) {
                onSessionExpired();
            }
        }
        return Promise.reject(error);
    }
);

export const getCourses = async () => {
    const response = await api.get('/courses');
    return response.data;
};

export const syncCourse = async (courseId: number) => {
    const response = await api.post(`/sync/${courseId}`);
    return response.data;
};

export const syncCoursesList = async () => {
    const response = await api.post('/sync/courses');
    return response.data;
};

export const toggleCourseActive = async (courseId: number, isActive: boolean) => {
    const response = await api.put(`/courses/${courseId}/active`, { is_active: isActive });
    return response.data;
};

export const getAssignments = async (courseId: number) => {
    const response = await api.get(`/courses/${courseId}/assignments`);
    return response.data;
};

export const getBoards = async (courseId: number) => {
    const response = await api.get(`/courses/${courseId}/boards`);
    return response.data;
};

export const getVods = async (courseId: number) => {
    const response = await api.get(`/courses/${courseId}/vods`);
    return response.data;
};

export const getPosts = async (boardId: number) => {
    const response = await api.get(`/boards/${boardId}/posts`);
    return response.data;
};

export const getDashboardOverview = async () => {
    const response = await api.get('/dashboard/overview');
    return response.data;
};

export const syncAllActiveCourses = async () => {
    const response = await api.post('/sync/all-active');
    return response.data;
};

export const watchAllVods = async () => {
    const response = await api.post('/vods/watch-all');
    return response.data;
};

export const watchSingleVod = async (vodMoodleId: number) => {
    const response = await api.post(`/vods/${vodMoodleId}/watch`);
    return response.data;
};

export const transcribeVod = async (vodMoodleId: number) => {
    const response = await api.post(`/vods/${vodMoodleId}/transcribe`);
    return response.data;
};

export const getVodTranscript = async (vodMoodleId: number) => {
    const response = await api.get(`/vods/${vodMoodleId}/transcript`);
    return response.data;
};

export const summarizeVod = async (vodMoodleId: number) => {
    const response = await api.post(`/vods/${vodMoodleId}/summarize`);
    return response.data;
};

export interface ChatMessage {
    role: 'user' | 'assistant';
    content: string;
}

export const chatWithVod = async (vodMoodleId: number, messages: ChatMessage[]): Promise<{ status: string; reply: string; remaining: number }> => {
    const response = await api.post(`/vods/${vodMoodleId}/chat`, { messages });
    return response.data;
};

export interface StreamCallbacks {
    onToken: (token: string) => void;
    onDone: (remaining: number) => void;
    onError: (error: string) => void;
}

export const chatWithVodStream = (
    vodMoodleId: number,
    messages: ChatMessage[],
    callbacks: StreamCallbacks,
): (() => void) => {
    const url = `${API_URL}/vods/${vodMoodleId}/chat/stream`;

    const es = new EventSource<'message' | 'done' | 'error'>(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            ...(authToken ? { 'X-API-Token': authToken } : {}),
        },
        body: JSON.stringify({ messages }),
    });

    es.addEventListener('message', (event: any) => {
        if (event.data) {
            try {
                const data = JSON.parse(event.data);
                if (data.token) callbacks.onToken(data.token);
            } catch {}
        }
    });

    es.addEventListener('done', (event: any) => {
        if (event.data) {
            try {
                const data = JSON.parse(event.data);
                callbacks.onDone(data.remaining);
            } catch {}
        }
        es.close();
    });

    es.addEventListener('error', (event: any) => {
        if (event.data) {
            try {
                const data = JSON.parse(event.data);
                callbacks.onError(data.error);
            } catch {
                callbacks.onError('연결이 끊어졌어요.');
            }
        } else {
            callbacks.onError('연결이 끊어졌어요.');
        }
        es.close();
    });

    return () => es.close();
};

// Auth & Login


export const loginWithCookies = async (cookieString: string, userId?: number | null) => {
    // Exchange cookies for API Token
    const response = await api.post('/auth/sync-session', { cookies: cookieString, user_id: userId ?? null });
    if (response.data.status === 'success' && response.data.api_token) {
        setAuthToken(response.data.api_token);
    }
    return response.data;
};

export const login = async (tokenOrCookie: string) => {
    // Legacy support / Session Restore
    if (tokenOrCookie.includes('MoodleSession=')) {
        return loginWithCookies(tokenOrCookie);
    } else {
        // Assume it's a token
        setAuthToken(tokenOrCookie);
        return { status: 'success', api_token: tokenOrCookie };
    }
};



export const fetchAISummary = async () => {
    try {
        const response = await api.post('/dashboard/ai-summary');
        return response.data;
    } catch (error) {
        console.error("Fetch AI Summary Error:", error);
        return { summaries: [] };
    }
};

export const registerPushToken = async (token: string) => {
    const response = await api.post('/auth/push-token', { token });
    return response.data;
};

export interface PreferencesRequest {
    new_assignment: boolean;
    new_vod: boolean;
    notice: boolean;
}

export const updateNotificationPreferences = async (prefs: PreferencesRequest) => {
    const response = await api.post('/auth/preferences', prefs);
    return response.data;
};

export const validateSession = async (): Promise<{ valid: boolean; reason?: string }> => {
    try {
        const response = await api.get('/auth/validate-session');
        return response.data;
    } catch (error: any) {
        if (error.response?.status === 401) {
            return { valid: false, reason: 'token_invalid' };
        }
        // Network errors — don't force logout on transient failures
        return { valid: true };
    }
};

export const checkAppVersion = async (): Promise<{ version: string | null; forceUpdateMin: string | null }> => {
    try {
        const response = await axios.get(`${API_URL}/version`);
        return {
            version: response.data?.version ?? null,
            forceUpdateMin: response.data?.force_update_min ?? null,
        };
    } catch {
        return { version: null, forceUpdateMin: null };
    }
};

export default api;
