import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

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
        const token = await AsyncStorage.getItem(AUTH_TOKEN_KEY);
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
            await AsyncStorage.setItem(AUTH_TOKEN_KEY, token);
        } catch (error) {
            console.error("Failed to save auth token:", error);
        }
    }
};

export const clearAuthToken = async () => {
    authToken = null;
    try {
        await AsyncStorage.removeItem(AUTH_TOKEN_KEY);
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

// Auth & Login


export const loginWithCookies = async (cookieString: string) => {
    // Exchange cookies for API Token
    const response = await api.post('/auth/sync-session', { cookies: cookieString });
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

export const watchVods = async (vodIds: number[]) => {
    const response = await api.post('/vod/watch', { vod_ids: vodIds });
    return response.data;
};

export const completeAssignments = async (assignmentIds: number[]) => {
    const response = await api.post('/assignment/complete', { assignment_ids: assignmentIds });
    return response.data;
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

export const createTestAssignment = async () => {
    const response = await api.post('/debug/create-test-assignment');
    return response.data;
};

export const deleteTestAssignments = async () => {
    const response = await api.post('/debug/delete-test-assignments');
    return response.data;
};

export const registerPushToken = async (token: string) => {
    const response = await api.post('/auth/push-token', { token });
    return response.data;
};

export default api;
