import React, { createContext, useState, useContext, ReactNode, useEffect } from 'react';
import { Alert } from 'react-native';
import { login as apiLogin, setupAxiosInterceptors } from '../services/api';

interface AuthContextType {
    isLoggedIn: boolean;
    login: (cookie: string) => Promise<void>;
    logout: () => void;
    autoLogout: boolean;
    resetAutoLogout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
    const [isLoggedIn, setIsLoggedIn] = useState(false);
    const [autoLogout, setAutoLogout] = useState(false);

    useEffect(() => {
        setupAxiosInterceptors(() => {
            console.log("AuthContext: Session expired, logging out...");
            Alert.alert(
                "세션 만료",
                "로그인 세션이 만료되었습니다. 다시 로그인해주세요.",
                [{ text: "확인", onPress: () => logout() }]
            );
        });
    }, []);

    const login = async (cookie: string) => {
        console.log("AuthContext: Login requested");
        try {
            await apiLogin(cookie);
            setIsLoggedIn(true);
            setAutoLogout(false);
        } catch (e) {
            console.error("AuthContext: Login failed", e);
            throw e;
        }
    };

    const logout = () => {
        console.log("AuthContext: Logout requested");
        setAutoLogout(true);
        setIsLoggedIn(false);
    };

    const resetAutoLogout = () => {
        setAutoLogout(false);
    };

    return (
        <AuthContext.Provider value={{ isLoggedIn, login, logout, autoLogout, resetAutoLogout }}>
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
