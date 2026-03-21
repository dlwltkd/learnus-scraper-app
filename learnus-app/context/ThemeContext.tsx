import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
    LightColors,
    DarkColors,
    createTypography,
    createLayout,
    Spacing,
    Animation,
    type ColorScheme,
    type TypographyType,
    type LayoutType,
} from '../constants/theme';

const THEME_STORAGE_KEY = 'theme_preference';

export type ThemeMode = 'system' | 'light' | 'dark';

interface ThemeContextType {
    colors: ColorScheme;
    typography: TypographyType;
    layout: LayoutType;
    spacing: typeof Spacing;
    animation: typeof Animation;
    isDark: boolean;
    themeMode: ThemeMode;
    setThemeMode: (mode: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
    const systemScheme = useColorScheme();
    const [themeMode, setThemeModeState] = useState<ThemeMode>('light');
    const [loaded, setLoaded] = useState(false);

    // Load saved preference
    useEffect(() => {
        AsyncStorage.getItem(THEME_STORAGE_KEY).then(saved => {
            if (saved === 'light' || saved === 'dark' || saved === 'system') {
                setThemeModeState(saved);
            }
            setLoaded(true);
        }).catch(() => {
            setLoaded(true);
        });
    }, []);

    const setThemeMode = useCallback((mode: ThemeMode) => {
        setThemeModeState(mode);
        AsyncStorage.setItem(THEME_STORAGE_KEY, mode);
    }, []);

    const isDark = themeMode === 'dark' || (themeMode === 'system' && systemScheme === 'dark');

    const value = useMemo<ThemeContextType>(() => {
        const colors = isDark ? DarkColors : LightColors;
        return {
            colors,
            typography: createTypography(colors),
            layout: createLayout(isDark),
            spacing: Spacing,
            animation: Animation,
            isDark,
            themeMode,
            setThemeMode,
        };
    }, [isDark, themeMode, setThemeMode]);

    // Don't render until we've loaded the preference to avoid flash
    if (!loaded) return null;

    return (
        <ThemeContext.Provider value={value}>
            {children}
        </ThemeContext.Provider>
    );
}

export function useTheme(): ThemeContextType {
    const context = useContext(ThemeContext);
    if (!context) {
        // Fallback for use outside provider (shouldn't happen)
        return {
            colors: LightColors,
            typography: createTypography(LightColors),
            layout: createLayout(false),
            spacing: Spacing,
            animation: Animation,
            isDark: false,
            themeMode: 'system',
            setThemeMode: () => {},
        };
    }
    return context;
}

export default ThemeContext;
