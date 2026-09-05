import React, { createContext, useState, useContext, ReactNode, useEffect, useRef } from 'react';
import { AppState, AppStateStatus, Platform } from 'react-native';
import { secureStorage } from '../services/secureStorage';
import {
    BrowserAuthError,
    clearAuthToken,
    clearBrowserSession,
    completeExtensionLogin,
    login as apiLogin,
    logoutServerSide,
    restoreBrowserSession,
    setupAxiosInterceptors,
    takeExtensionLoginTicket,
    validateSession,
} from '../services/api';
import { DEMO_TOKEN, isDemoMode, setDemoMode } from '../services/demoMode';
import { useToast } from './ToastContext';

interface AuthContextType {
    isLoggedIn: boolean;
    login: (cookie: string) => Promise<void>;
    logout: () => void;
    autoLogout: boolean;
    resetAutoLogout: () => void;
    isLoading: boolean;
    webLoginError: string | null;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
    const { showAlert } = useToast();
    const [isLoggedIn, setIsLoggedIn] = useState(false);
    const [autoLogout, setAutoLogout] = useState(false);
    const [webLoginError, setWebLoginError] = useState<string | null>(null);

    const [isLoading, setIsLoading] = useState(true);
    const isLoggedInRef = useRef(false);

    const clearClientSession = async () => {
        setDemoMode(false);
        setWebLoginError(null);
        if (Platform.OS === 'web') {
            clearBrowserSession();
        } else {
            await secureStorage.removeItem('userToken');
            await clearAuthToken();
        }
        setAutoLogout(true);
        setIsLoggedIn(false);
    };

    // Keep ref in sync so AppState callback always sees latest value
    useEffect(() => {
        isLoggedInRef.current = isLoggedIn;
    }, [isLoggedIn]);

    const handleSessionExpired = () => {
        console.log("AuthContext: Session expired, logging out...");
        showAlert(
            "세션 만료",
            "로그인 세션이 만료됐어요. 다시 로그인해주세요.",
            [{ text: "확인", onPress: () => { void logout(); } }],
            'warning'
        );
    };

    const checkMoodleSession = async () => {
        // Demo mode has no server session to validate; checking would log the reviewer out.
        if (isDemoMode()) return;
        try {
            const result = await validateSession();
            if (!result.valid) {
                console.log(`AuthContext: Moodle session invalid (${result.reason}), forcing re-login`);
                handleSessionExpired();
            }
        } catch (e) {
            console.error("AuthContext: Session validation error", e);
        }
    };

    useEffect(() => {
        setupAxiosInterceptors(handleSessionExpired);
        loadStorage();

        // Re-validate Moodle session when app comes back to foreground
        const handleAppState = (nextState: AppStateStatus) => {
            if (nextState === 'active' && isLoggedInRef.current) {
                checkMoodleSession();
            }
        };
        const subscription = AppState.addEventListener('change', handleAppState);
        return () => subscription.remove();
    }, []);

    const loadStorage = async () => {
        if (Platform.OS === 'web') {
            try {
                const ticket = takeExtensionLoginTicket();
                if (ticket) {
                    setWebLoginError(null);
                    await completeExtensionLogin(ticket);
                }

                const authenticated = await restoreBrowserSession();
                setIsLoggedIn(authenticated);
                if (ticket && !authenticated) {
                    setWebLoginError('브라우저 세션을 확인하지 못했어요. 확장 프로그램에서 다시 연결해주세요.');
                }
            } catch (error) {
                clearBrowserSession();
                setIsLoggedIn(false);
                if (error instanceof BrowserAuthError && error.reason === 'invalid-ticket') {
                    setWebLoginError('연결 링크가 만료됐거나 이 브라우저에서 시작한 연결이 아니에요. 최신 확장 프로그램에서 “이 브라우저 연결”을 다시 눌러주세요.');
                } else {
                    setWebLoginError('서버에 연결하지 못했어요. 네트워크를 확인한 뒤 잠시 후 다시 시도해주세요.');
                }
            } finally {
                setIsLoading(false);
            }
            return;
        }

        const storedCookie = await secureStorage.getItem('userToken');

        // No stored token - skip loading, show login immediately
        if (!storedCookie) {
            setIsLoading(false);
            return;
        }

        // Demo session — restore without contacting the server.
        if (storedCookie === DEMO_TOKEN) {
            setDemoMode(true);
            setIsLoggedIn(true);
            setIsLoading(false);
            return;
        }

        // Has token - keep loading while validating
        try {
            console.log("AuthContext: Restoring session...");
            await apiLogin(storedCookie);

            // Verify the Moodle session is actually still valid
            const result = await validateSession();
            if (!result.valid) {
                console.log(`AuthContext: Moodle session expired on restore (${result.reason}), clearing`);
                await secureStorage.removeItem('userToken');
                await clearAuthToken();
                // Don't set isLoggedIn — user will see login screen
                return;
            }

            setIsLoggedIn(true);
        } catch (e) {
            console.error("Failed to load auth storage", e);
        } finally {
            setIsLoading(false);
        }
    };

    const login = async (cookie: string) => {
        console.log("AuthContext: Login requested");
        if (cookie === DEMO_TOKEN) {
            setDemoMode(true);
            await secureStorage.setItem('userToken', DEMO_TOKEN);
            setIsLoggedIn(true);
            setAutoLogout(false);
            return;
        }
        if (Platform.OS === 'web') {
            if (!await restoreBrowserSession()) {
                throw new Error('Browser session was not established');
            }
            setWebLoginError(null);
            setIsLoggedIn(true);
            setAutoLogout(false);
            return;
        }
        try {
            await apiLogin(cookie);
            await secureStorage.setItem('userToken', cookie);
            setIsLoggedIn(true);
            setAutoLogout(false);
        } catch (e) {
            console.error("AuthContext: Login failed", e);
            throw e;
        }
    };

    const logout = async () => {
        console.log("AuthContext: Logout requested");
        if (Platform.OS === 'web') {
            try {
                await logoutServerSide();
            } catch (error) {
                console.error("Failed to revoke browser session", error);
                showAlert(
                    '로그아웃 실패',
                    '서버와 연결하지 못해 로그아웃을 완료하지 못했어요. 잠시 후 다시 시도해주세요.',
                    [{ text: '확인' }],
                    'error',
                );
                return;
            }
            await clearClientSession();
            return;
        }

        try {
            await logoutServerSide();
        } catch (e) {
            console.error("Failed to revoke native session", e);
        }
        await clearClientSession();
    };

    const resetAutoLogout = () => {
        setAutoLogout(false);
    };

    return (
        <AuthContext.Provider value={{ isLoggedIn, login, logout, autoLogout, resetAutoLogout, isLoading, webLoginError }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};
