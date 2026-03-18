import React, { createContext, useState, useContext, ReactNode, useEffect, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { secureStorage } from '../services/secureStorage';
import { login as apiLogin, setupAxiosInterceptors, clearAuthToken, validateSession } from '../services/api';
import { useToast } from './ToastContext';

interface AuthContextType {
    isLoggedIn: boolean;
    login: (cookie: string) => Promise<void>;
    logout: () => void;
    autoLogout: boolean;
    resetAutoLogout: () => void;
    isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
    const { showAlert } = useToast();
    const [isLoggedIn, setIsLoggedIn] = useState(false);
    const [autoLogout, setAutoLogout] = useState(false);

    const [isLoading, setIsLoading] = useState(true);
    const isLoggedInRef = useRef(false);

    // Keep ref in sync so AppState callback always sees latest value
    useEffect(() => {
        isLoggedInRef.current = isLoggedIn;
    }, [isLoggedIn]);

    const handleSessionExpired = () => {
        console.log("AuthContext: Session expired, logging out...");
        showAlert(
            "세션 만료",
            "로그인 세션이 만료되었습니다. 다시 로그인해주세요.",
            [{ text: "확인", onPress: () => logout() }],
            'warning'
        );
    };

    const checkMoodleSession = async () => {
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
        const storedCookie = await secureStorage.getItem('userToken');

        // No stored token - skip loading, show login immediately
        if (!storedCookie) {
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
        try {
            await secureStorage.removeItem('userToken');
            await clearAuthToken();
        } catch (e) {
            console.error("Failed to clear auth storage", e);
        }
        setAutoLogout(true);
        setIsLoggedIn(false);
    };

    const resetAutoLogout = () => {
        setAutoLogout(false);
    };

    return (
        <AuthContext.Provider value={{ isLoggedIn, login, logout, autoLogout, resetAutoLogout, isLoading }}>
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
