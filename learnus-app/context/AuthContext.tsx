import React, { createContext, useState, useContext, ReactNode, useEffect } from 'react';
import { Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { login as apiLogin, setupAxiosInterceptors, clearAuthToken } from '../services/api';

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
    const [isLoggedIn, setIsLoggedIn] = useState(false);
    const [autoLogout, setAutoLogout] = useState(false);

    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        setupAxiosInterceptors(() => {
            console.log("AuthContext: Session expired, logging out...");
            Alert.alert(
                "세션 만료",
                "로그인 세션이 만료되었습니다. 다시 로그인해주세요.",
                [{ text: "확인", onPress: () => logout() }]
            );
        });
        loadStorage();
    }, []);

    const loadStorage = async () => {
        try {
            const storedCookie = await AsyncStorage.getItem('userToken');
            if (storedCookie) {
                console.log("AuthContext: Restoring session...");
                // Validate or just set token
                // For now, we assume if we have a token, we are logged in.
                // You might want to validate it with an API call here.
                await apiLogin(storedCookie);
                setIsLoggedIn(true);
            }
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
            await AsyncStorage.setItem('userToken', cookie);
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
            await AsyncStorage.removeItem('userToken');
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
