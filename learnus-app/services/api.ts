import axios from 'axios';
import EventSource from 'react-native-sse';
import { secureStorage } from './secureStorage';
import { isDemoMode } from './demoMode';

// Shape-appropriate empty responses for demo mode, so screens render their normal empty
// state instead of an error. Screens with real mock data (dashboard, courses, lectures,
// transcripts) short-circuit before reaching the network at all.
function demoEmptyPayload(url?: string): unknown {
    if (!url) return {};
    if (url.includes('/notifications')) return [];
    if (url.includes('/flashcards/decks')) return [];
    if (url.includes('/courses')) return [];
    return {};
}

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

// True once a token is in memory. Pollers use this to avoid firing requests during the
// gaps around login and logout, which would come back 401.
export const hasAuthToken = () => Boolean(authToken);

/** The raw token, for requests that bypass axios — e.g. <Image> loading a page render. */
export const getAuthToken = () => authToken;

/**
 * Revoke this token server-side.
 *
 * Signing out was local-only: the app forgot the token while the server kept honouring
 * it, so anything that had copied it stayed authenticated. Best-effort — a failure here
 * must never block the local sign-out.
 */
export const logoutServerSide = async (): Promise<void> => {
    try {
        await api.post('/auth/logout');
    } catch {
        // Offline, or the token is already invalid. Either way, clear it locally.
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
    // Demo mode (store review) has no server account. Swap in an adapter that resolves
    // locally so nothing reaches the API, no 401 can cascade into a forced logout, and
    // callers get an empty payload instead of an error toast.
    if (isDemoMode()) {
        request.adapter = async () => ({
            data: demoEmptyPayload(request.url),
            status: 200,
            statusText: 'OK',
            headers: {},
            config: request,
        });
        return request;
    }
    if (authToken) {
        request.headers['X-API-Token'] = authToken;
    }
    return request;
});

api.interceptors.response.use(
    response => response,
    error => {
        // Demo mode never has a server session; a 401 here must not force a logout.
        if (isDemoMode()) {
            return Promise.reject(error);
        }
        if (error.response && error.response.status === 401) {
            // Only a request that actually carried a token can represent an expired
            // session. Without this check, any poll that fires while the token is absent
            // (during login, or right after logout) reports "세션 만료" and forces a logout.
            const sentToken = Boolean(error.config?.headers?.['X-API-Token']);
            if (sentToken) {
                console.log('Session expired (401), triggering logout...');
                if (onSessionExpired) {
                    onSessionExpired();
                }
            } else {
                console.log('401 on a request with no auth token — ignoring, not a session expiry');
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

export const updateAssignmentStatus = async (
    courseId: number,
    assignmentId: number,
    isCompleted: boolean,
    lockOverride: boolean = true,
) => {
    const response = await api.put(
        `/courses/${courseId}/assignments/${assignmentId}/status`,
        { is_completed: isCompleted, lock_override: lockOverride },
    );
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

export const getPostDetail = async (postId: number) => {
    const response = await api.get(`/posts/${postId}`);
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

export interface LabsSettings {
    labs_unlocked: boolean;
    brain_enabled: boolean;
    auto_watch_enabled: boolean;
}

export const getLabsSettings = async (): Promise<LabsSettings> => {
    const response = await api.get('/settings/labs');
    return response.data;
};

export const unlockLabs = async (): Promise<LabsSettings> => {
    const response = await api.post('/settings/labs/unlock');
    return response.data;
};

export const updateLabsSettings = async (
    settings: { auto_watch_enabled?: boolean; brain_enabled?: boolean }
): Promise<LabsSettings> => {
    const response = await api.put('/settings/labs', settings);
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

export interface VodTranscribeStatus {
    status: 'not_found' | 'queued' | 'running' | 'done' | 'failed';
    stage: 'idle' | 'queued' | 'extracting_audio' | 'transcribing' | 'finalizing' | 'completed' | 'failed';
    progress_pct?: number | null;
    queue_position?: number | null;
    queue_ahead?: number | null;
    elapsed_seconds?: number | null;
    eta_seconds?: { low: number; high: number } | null;
    error_message?: string | null;
    updated_at?: string | null;
}

export const getVodTranscribeStatus = async (vodMoodleId: number): Promise<VodTranscribeStatus> => {
    const response = await api.get(`/vods/${vodMoodleId}/transcribe/status`);
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

// ─── Flashcards ──────────────────────────────────────────────────────────────

export interface FlashcardCard {
    front: string;
    back: string;
}

export interface FlashcardDeckSummary {
    id: number;
    name: string;
    vod_moodle_id: number;
    course_name: string | null;
    card_count: number;
    created_at: string | null;
}

export const generateFlashcards = async (vodMoodleId: number, count: number = 10) => {
    const response = await api.post(`/vods/${vodMoodleId}/flashcards/generate`, { count });
    return response.data as { status: string; cards: FlashcardCard[]; remaining: number; course_name: string };
};

export const getFlashcardDecks = async () => {
    const response = await api.get('/flashcards/decks');
    return response.data as { decks: FlashcardDeckSummary[] };
};

export const getFlashcardDeck = async (deckId: number) => {
    const response = await api.get(`/flashcards/decks/${deckId}`);
    return response.data as { id: number; name: string; vod_moodle_id: number; course_name: string | null; cards: FlashcardCard[] };
};

export const saveFlashcardDeck = async (name: string, vodMoodleId: number, cards: FlashcardCard[]) => {
    const response = await api.post('/flashcards/decks', { name, vod_moodle_id: vodMoodleId, cards });
    return response.data as { status: string; id: number; name: string; card_count: number };
};

export const deleteFlashcardDeck = async (deckId: number) => {
    const response = await api.delete(`/flashcards/decks/${deckId}`);
    return response.data;
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

export const registerPushToken = async (token: string, deviceName?: string) => {
    const response = await api.post('/auth/push-token', { token, device_name: deviceName });
    return response.data;
};

// Notification History (server-side)
export const getNotificationHistoryFromServer = async () => {
    const response = await api.get('/notifications');
    return response.data;
};

export const markNotificationReadOnServer = async (id: number) => {
    const response = await api.put(`/notifications/${id}/read`);
    return response.data;
};

export const markAllNotificationsReadOnServer = async () => {
    const response = await api.put('/notifications/read-all');
    return response.data;
};

export const deleteNotificationOnServer = async (id: number) => {
    const response = await api.delete(`/notifications/${id}`);
    return response.data;
};

export const clearNotificationsOnServer = async () => {
    const response = await api.delete('/notifications');
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

// ── Course brain ────────────────────────────────────────────────────────────────

export type LibraryItemType = 'file' | 'label' | 'vod' | 'assignment' | 'board';

export interface LibraryItem {
    type: LibraryItemType;
    id: number;
    moodle_id: number;
    title: string;
    /** True when this item's text is part of the corpus the brain can answer from. */
    in_corpus: boolean;
    /** True while a manual learn for this item is queued or running. */
    learning?: boolean;
    chars: number;
    url?: string | null;
    kind?: string | null;        // file: pdf | ipynb | label | ...
    pages?: number | null;       // file
    captioned_pages?: number;    // file
    status?: string | null;
    duration?: number | null;    // vod, seconds
    completed?: boolean;         // vod, assignment
    due_date?: string | null;    // assignment
    posts?: number;              // board
}

export interface LibrarySection {
    section: number | null;
    week: string;
    count: number;
    items: LibraryItem[];
}

/** Per-course brain state: whether it is on, and how far a build has got. */
export type BrainScope = { vods: boolean; files: boolean; assignments: boolean };

export interface CourseBrainState {
    enabled: boolean;
    /** Which kinds of material this course learns. */
    scope: BrainScope;
    status: 'queued' | 'building' | 'ready' | 'error' | null;
    progress: number;
    stage: string | null;
    error: string | null;
    built_at: string | null;
}

export interface CourseLibrary {
    course: { id: number; moodle_id: number; name: string };
    stats: {
        files: number; vods: number; assignments: number; boards: number; posts: number;
        corpus_chars: number; in_corpus: number; total_items: number;
    };
    sections: LibrarySection[];
    brain: CourseBrainState;
}

export const getCourseLibrary = async (courseId: number): Promise<CourseLibrary> => {
    const response = await api.get(`/courses/${courseId}/library`);
    return response.data;
};

/**
 * Opt a course in or out of the brain.
 *
 * Enabling queues a full sweep — every lecture transcribed, every file read — so this
 * is a deliberate per-course choice, not a global switch. Disabling keeps what was
 * already learned, so turning it back on is instant.
 */
export const setCourseBrain = async (
    courseId: number,
    changes: { enabled?: boolean; scope?: Partial<BrainScope> },
): Promise<CourseBrainState> => {
    const response = await api.put(`/courses/${courseId}/brain`, changes);
    return response.data;
};

/**
 * Teach the brain one item from the library.
 *
 * Independent of the course-wide toggle, so a few useful files can be learned without
 * paying for a full sweep. Returns queued:false when the same item is already waiting.
 */
export const learnLibraryItem = async (
    courseId: number,
    itemType: 'file' | 'vod' | 'assignment',
    itemId: number,
): Promise<{ queued: boolean }> => {
    const response = await api.post(`/courses/${courseId}/brain/learn/${itemType}/${itemId}`);
    return response.data;
};

/** One course's row on the brain settings screen. */
export interface BrainCourse extends CourseBrainState {
    id: number;
    name: string;
    pending: { files: number; vods: number; assignments: number; total: number };
    learned: {
        chars: number;
        files: number; total_files: number;
        vods: number; total_vods: number;
        assignments: number; total_assignments: number;
        captioned_pages: number;
    };
}

/** Every active course with its brain state — one request for the whole settings list. */
export const getBrainCourses = async (): Promise<{ courses: BrainCourse[] }> => {
    const response = await api.get('/brain/courses');
    return response.data;
};

/**
 * Learn whatever is still missing for a course.
 *
 * Not a re-do: finished work is skipped, so this costs only what failed or is new.
 */
export const rebuildCourseBrain = async (courseId: number): Promise<CourseBrainState> => {
    const response = await api.post(`/courses/${courseId}/brain/rebuild`);
    return response.data;
};

/** Polled while a build runs. `pending` is what the brain has not learned yet. */
export const getCourseBrainStatus = async (
    courseId: number,
): Promise<CourseBrainState & { pending: { files: number; vods: number; assignments: number; total: number } }> => {
    const response = await api.get(`/courses/${courseId}/brain/status`);
    return response.data;
};

/**
 * Image source for a rendered PDF page.
 *
 * Returns headers alongside the uri because <Image> does not go through the axios
 * instance and so never picks up the auth interceptor — without them every page request
 * is unauthenticated and comes back 401, which renders as a silently blank image.
 */
export const filePageSource = (fileId: number, pageNo: number) => ({
    uri: `${API_URL}/files/${fileId}/page/${pageNo}`,
    headers: authToken ? { 'X-API-Token': authToken } : undefined,
});

export interface LibraryPost {
    id: number; title: string; writer?: string | null; date?: string | null;
    content?: string | null; url?: string | null;
}

export interface LibraryItemDetail {
    type: LibraryItemType;
    id: number;
    title: string;
    week?: string | null;
    kind?: string | null;
    pages?: number | null;
    captioned_pages?: number;
    /** Extracted text / instructions / transcript, depending on type. */
    content?: string | null;
    summary?: string | null;
    chars: number;
    status?: string | null;
    error?: string | null;
    due_date?: string | null;
    completed?: boolean;
    duration?: number | null;
    posts?: LibraryPost[];
    url?: string | null;
    moodle_id?: number;
}

export const getLibraryItem = async (
    courseId: number, itemType: string, itemId: number,
): Promise<LibraryItemDetail> => {
    const response = await api.get(`/courses/${courseId}/library/${itemType}/${itemId}`);
    return response.data;
};

export interface BrainCitation {
    ref: string;                 // "S3"
    type: LibraryItemType;
    id: number;
    title: string;
    week?: string | null;
}

export interface BrainStreamCallbacks {
    onToken: (token: string) => void;
    onDone: (citations: BrainCitation[]) => void;
    onError: (error: string) => void;
}

/** Streamed, course-grounded answer. Returns a cancel function. */
export const chatWithCourseBrain = (
    courseId: number,
    messages: ChatMessage[],
    callbacks: BrainStreamCallbacks,
): (() => void) => {
    const es = new EventSource<'message' | 'done' | 'error'>(
        `${API_URL}/courses/${courseId}/brain/chat`,
        {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(authToken ? { 'X-API-Token': authToken } : {}),
            },
            body: JSON.stringify({ messages }),
        },
    );

    es.addEventListener('message', (event: any) => {
        if (!event.data) return;
        try {
            const data = JSON.parse(event.data);
            if (data.token) callbacks.onToken(data.token);
        } catch {}
    });

    es.addEventListener('done', (event: any) => {
        let citations: BrainCitation[] = [];
        try {
            if (event.data) citations = JSON.parse(event.data).citations || [];
        } catch {}
        callbacks.onDone(citations);
        es.close();
    });

    es.addEventListener('error', (event: any) => {
        let message = '연결이 끊어졌어요.';
        try {
            if (event.data) message = JSON.parse(event.data).error || message;
        } catch {}
        callbacks.onError(message);
        es.close();
    });

    return () => es.close();
};
