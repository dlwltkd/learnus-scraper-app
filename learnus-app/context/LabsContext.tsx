import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { getLabsSettings, unlockLabs as unlockLabsApi, updateLabsSettings } from '../services/api';
import { useAuth } from './AuthContext';

interface LabsContextValue {
    labsUnlocked: boolean;
    autoWatchEnabled: boolean;
    brainEnabled: boolean;
    isLoading: boolean;
    refreshLabs: () => Promise<void>;
    unlockLabs: () => Promise<void>;
    setAutoWatchEnabled: (enabled: boolean) => Promise<void>;
    setBrainEnabled: (enabled: boolean) => Promise<void>;
}

const LabsContext = createContext<LabsContextValue | undefined>(undefined);

export const LabsProvider = ({ children }: { children: React.ReactNode }) => {
    const { isLoggedIn } = useAuth();
    const [labsUnlocked, setLabsUnlocked] = useState(false);
    const [autoWatchEnabled, setAutoWatchEnabledState] = useState(false);
    const [brainEnabled, setBrainEnabledState] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    const applySettings = useCallback((settings: { labs_unlocked: boolean; auto_watch_enabled: boolean; brain_enabled?: boolean }) => {
        setLabsUnlocked(settings.labs_unlocked);
        setAutoWatchEnabledState(settings.auto_watch_enabled);
        setBrainEnabledState(!!settings.brain_enabled);
    }, []);

    const refreshLabs = useCallback(async () => {
        setIsLoading(true);
        try {
            const settings = await getLabsSettings();
            applySettings(settings);
        } catch (e) {
            console.log('Failed to load labs settings', e);
            setLabsUnlocked(false);
            setAutoWatchEnabledState(false);
            setBrainEnabledState(false);
        } finally {
            setIsLoading(false);
        }
    }, [applySettings]);

    useEffect(() => {
        if (isLoggedIn) {
            refreshLabs();
        } else {
            setLabsUnlocked(false);
            setAutoWatchEnabledState(false);
            setBrainEnabledState(false);
            setIsLoading(false);
        }
    }, [isLoggedIn, refreshLabs]);

    const unlockLabs = useCallback(async () => {
        const settings = await unlockLabsApi();
        applySettings(settings);
    }, [applySettings]);

    const setAutoWatchEnabled = useCallback(async (enabled: boolean) => {
        setAutoWatchEnabledState(enabled);
        try {
            const settings = await updateLabsSettings({ auto_watch_enabled: enabled });
            applySettings(settings);
        } catch (e) {
            setAutoWatchEnabledState(!enabled);
            throw e;
        }
    }, [applySettings]);

    const setBrainEnabled = useCallback(async (enabled: boolean) => {
        setBrainEnabledState(enabled);
        try {
            const settings = await updateLabsSettings({ brain_enabled: enabled });
            applySettings(settings);
        } catch (e) {
            setBrainEnabledState(!enabled);
            throw e;
        }
    }, [applySettings]);

    const value = useMemo(() => ({
        labsUnlocked,
        autoWatchEnabled,
        brainEnabled,
        isLoading,
        refreshLabs,
        unlockLabs,
        setAutoWatchEnabled,
        setBrainEnabled,
    }), [labsUnlocked, autoWatchEnabled, brainEnabled, isLoading, refreshLabs, unlockLabs, setAutoWatchEnabled, setBrainEnabled]);

    return <LabsContext.Provider value={value}>{children}</LabsContext.Provider>;
};

export const useLabs = () => {
    const context = useContext(LabsContext);
    if (!context) {
        throw new Error('useLabs must be used within a LabsProvider');
    }
    return context;
};
