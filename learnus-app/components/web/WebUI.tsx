import React from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../../context/ThemeContext';

export type WebIconName = keyof typeof Ionicons.glyphMap;
export type IconName = WebIconName;

export interface WebNavigation {
    navigate: (name: string, params?: Record<string, unknown>) => void;
    goBack: () => void;
    canGoBack: () => boolean;
    setOptions: (options: Record<string, unknown>) => void;
}

export const useWebNavigation = () => useNavigation<WebNavigation>();

export function WebIcon({
    name,
    size = 20,
    color = 'currentColor',
}: {
    name: WebIconName;
    size?: number;
    color?: string;
}) {
    return (
        <span className="web-icon" aria-hidden="true">
            <Ionicons name={name} size={size} color={color} />
        </span>
    );
}

export function WebTheme({ children }: { children: React.ReactNode }) {
    const { colors, isDark } = useTheme();
    const variables = {
        '--web-bg': colors.background,
        '--web-surface': colors.surface,
        '--web-text': colors.textPrimary,
        '--web-muted': colors.textSecondary,
        '--web-subtle': colors.textSecondary,
        '--web-border': colors.border,
        '--web-primary': isDark ? colors.primary : colors.primaryDark,
        '--web-primary-foreground': colors.textInverse,
        '--web-primary-soft': colors.primaryLighter,
        '--web-success': isDark
            ? colors.success
            : `color-mix(in srgb, ${colors.success} 60%, ${colors.textPrimary})`,
        '--web-warning': isDark
            ? colors.warning
            : `color-mix(in srgb, ${colors.warning} 60%, ${colors.textPrimary})`,
        '--web-danger': isDark
            ? colors.error
            : `color-mix(in srgb, ${colors.error} 80%, ${colors.textPrimary})`,
        '--web-surface-muted': colors.surfaceMuted,
        '--web-radius': '10px',
        colorScheme: isDark ? 'dark' : 'light',
    } as React.CSSProperties;
    return (
        <div
            className={`web-root${isDark ? ' is-dark' : ''}`}
            style={variables}
        >
            {children}
        </div>
    );
}

export function PageHeading({
    eyebrow,
    title,
    description,
    actions,
}: {
    eyebrow?: string;
    title: string;
    description?: string;
    actions?: React.ReactNode;
}) {
    return (
        <header className="web-page-heading">
            <div>
                {eyebrow && <p className="web-eyebrow">{eyebrow}</p>}
                <h1>{title}</h1>
                {description && (
                    <p className="web-description">{description}</p>
                )}
            </div>
            {actions && <div className="web-page-actions">{actions}</div>}
        </header>
    );
}

export function EmptyState({
    icon,
    title,
    description,
    action,
}: {
    icon?: WebIconName;
    title: string;
    description?: string;
    action?: React.ReactNode;
}) {
    return (
        <div className="web-empty" role="status">
            {icon && (
                <span className="web-empty-icon">
                    <WebIcon name={icon} size={26} />
                </span>
            )}
            <h3>{title}</h3>
            {description && <p>{description}</p>}
            {action}
        </div>
    );
}

export function LoadingState({
    label = '학습 정보를 불러오고 있어요',
}: {
    label?: string;
}) {
    return (
        <div className="web-loading" role="status">
            <span className="web-spinner" />
            <span>{label}</span>
        </div>
    );
}
