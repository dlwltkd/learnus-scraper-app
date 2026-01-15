import React, { createContext, useState, useContext, ReactNode, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface UserProfile {
    name: string;
}

interface UserContextType {
    profile: UserProfile;
    updateName: (name: string) => Promise<void>;
    isLoading: boolean;
}

const DEFAULT_PROFILE: UserProfile = {
    name: '',
};

const UserContext = createContext<UserContextType | null>(null);

export const UserProvider = ({ children }: { children: ReactNode }) => {
    const [profile, setProfile] = useState<UserProfile>(DEFAULT_PROFILE);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        loadProfile();
    }, []);

    const loadProfile = async () => {
        try {
            const storedProfile = await AsyncStorage.getItem('userProfile');
            if (storedProfile) {
                setProfile(JSON.parse(storedProfile));
            }
        } catch (e) {
            console.error('Failed to load user profile', e);
        } finally {
            setIsLoading(false);
        }
    };

    const updateName = async (name: string) => {
        try {
            const newProfile = { ...profile, name };
            await AsyncStorage.setItem('userProfile', JSON.stringify(newProfile));
            setProfile(newProfile);
        } catch (e) {
            console.error('Failed to save user profile', e);
            throw e;
        }
    };

    return (
        <UserContext.Provider value={{ profile, updateName, isLoading }}>
            {children}
        </UserContext.Provider>
    );
};

export const useUser = () => {
    const context = useContext(UserContext);
    if (!context) {
        throw new Error('useUser must be used within a UserProvider');
    }
    return context;
};
