import React, { useMemo } from 'react';
import { StyleSheet, Text, View, ViewStyle, TextStyle } from 'react-native';
import { Spacing } from '../constants/theme';
import { useTheme } from '../context/ThemeContext';
import { type ColorScheme, type TypographyType, type LayoutType } from '../constants/theme';

type BadgeVariant = 'filled' | 'soft' | 'outline' | 'dot';
type BadgeSize = 'sm' | 'md' | 'lg';
type BadgeColor = 'primary' | 'success' | 'warning' | 'error' | 'secondary' | 'neutral';

interface BadgeProps {
    label?: string;
    variant?: BadgeVariant;
    size?: BadgeSize;
    color?: BadgeColor;
    icon?: React.ReactNode;
    style?: ViewStyle;
    textStyle?: TextStyle;
}

export default function Badge({
    label,
    variant = 'soft',
    size = 'md',
    color = 'primary',
    icon,
    style,
    textStyle,
}: BadgeProps) {
    const { colors, typography, layout, isDark } = useTheme();
    const styles = useMemo(() => createStyles(colors, typography, layout, isDark), [colors, typography, layout, isDark]);

    const getColorStyles = (): { bg: string; text: string; border: string } => {
        switch (color) {
            case 'primary':
                return {
                    bg: colors.primary,
                    text: colors.textInverse,
                    border: colors.primary,
                };
            case 'success':
                return {
                    bg: colors.success,
                    text: colors.textInverse,
                    border: colors.success,
                };
            case 'warning':
                return {
                    bg: colors.warning,
                    text: '#1A1D26',
                    border: colors.warning,
                };
            case 'error':
                return {
                    bg: colors.error,
                    text: colors.textInverse,
                    border: colors.error,
                };
            case 'secondary':
                return {
                    bg: colors.secondary,
                    text: colors.textInverse,
                    border: colors.secondary,
                };
            case 'neutral':
            default:
                return {
                    bg: colors.textTertiary,
                    text: colors.textInverse,
                    border: colors.textTertiary,
                };
        }
    };

    const getSoftColorStyles = (): { bg: string; text: string } => {
        switch (color) {
            case 'primary':
                return { bg: colors.primaryLighter, text: colors.primary };
            case 'success':
                return { bg: colors.successLight, text: colors.success };
            case 'warning':
                return { bg: colors.warningLight, text: '#92400E' };
            case 'error':
                return { bg: colors.errorLight, text: colors.error };
            case 'secondary':
                return { bg: colors.secondaryLight, text: colors.secondary };
            case 'neutral':
            default:
                return { bg: colors.surfaceMuted, text: colors.textSecondary };
        }
    };

    const getSizeStyles = (): { container: ViewStyle; text: TextStyle } => {
        switch (size) {
            case 'sm':
                return {
                    container: {
                        paddingHorizontal: 6,
                        paddingVertical: 2,
                        borderRadius: 4,
                    },
                    text: {
                        fontSize: 10,
                        fontWeight: '600',
                        letterSpacing: 0.2,
                    },
                };
            case 'lg':
                return {
                    container: {
                        paddingHorizontal: 12,
                        paddingVertical: 6,
                        borderRadius: 8,
                    },
                    text: {
                        fontSize: 13,
                        fontWeight: '600',
                    },
                };
            default: // md
                return {
                    container: {
                        paddingHorizontal: 8,
                        paddingVertical: 4,
                        borderRadius: 6,
                    },
                    text: {
                        fontSize: 11,
                        fontWeight: '600',
                        letterSpacing: 0.1,
                    },
                };
        }
    };

    const colorStyles = getColorStyles();
    const softColorStyles = getSoftColorStyles();
    const sizeStyles = getSizeStyles();

    const getVariantStyles = (): ViewStyle => {
        switch (variant) {
            case 'filled':
                return {
                    backgroundColor: colorStyles.bg,
                };
            case 'soft':
                return {
                    backgroundColor: softColorStyles.bg,
                };
            case 'outline':
                return {
                    backgroundColor: 'transparent',
                    borderWidth: 1.5,
                    borderColor: colorStyles.border,
                };
            case 'dot':
                return {
                    backgroundColor: softColorStyles.bg,
                    paddingLeft: sizeStyles.container.paddingHorizontal as number + 8,
                };
            default:
                return {};
        }
    };

    const getTextColor = (): string => {
        switch (variant) {
            case 'filled':
                return colorStyles.text;
            case 'soft':
            case 'dot':
                return softColorStyles.text;
            case 'outline':
                return colorStyles.bg;
            default:
                return colorStyles.text;
        }
    };

    if (variant === 'dot' && !label) {
        // Dot-only indicator
        return (
            <View
                style={[
                    styles.dotOnly,
                    { backgroundColor: colorStyles.bg },
                    style,
                ]}
            />
        );
    }

    return (
        <View
            style={[
                styles.badge,
                sizeStyles.container,
                getVariantStyles(),
                style,
            ]}
        >
            {variant === 'dot' && (
                <View
                    style={[
                        styles.dot,
                        { backgroundColor: colorStyles.bg },
                    ]}
                />
            )}
            {icon && <View style={styles.iconWrapper}>{icon}</View>}
            {label && (
                <Text
                    style={[
                        styles.text,
                        sizeStyles.text,
                        { color: getTextColor() },
                        textStyle,
                    ]}
                >
                    {label}
                </Text>
            )}
        </View>
    );
}

// Count Badge - specifically for notification counts
interface CountBadgeProps {
    count: number;
    maxCount?: number;
    color?: BadgeColor;
    style?: ViewStyle;
}

export function CountBadge({
    count,
    maxCount = 99,
    color = 'error',
    style,
}: CountBadgeProps) {
    const { colors, typography, layout, isDark } = useTheme();
    const styles = useMemo(() => createStyles(colors, typography, layout, isDark), [colors, typography, layout, isDark]);

    if (count <= 0) return null;

    const displayCount = count > maxCount ? `${maxCount}+` : count.toString();
    const isSmall = count <= 9;

    return (
        <View
            style={[
                styles.countBadge,
                isSmall && styles.countBadgeSmall,
                color === 'primary' && { backgroundColor: colors.primary },
                color === 'error' && { backgroundColor: colors.error },
                color === 'success' && { backgroundColor: colors.success },
                style,
            ]}
        >
            <Text style={styles.countText}>{displayCount}</Text>
        </View>
    );
}

// Status Badge - for completion/progress states
interface StatusBadgeProps {
    status: 'pending' | 'in-progress' | 'completed' | 'overdue';
    label?: string;
    style?: ViewStyle;
}

export function StatusBadge({ status, label, style }: StatusBadgeProps) {
    const getStatusConfig = () => {
        switch (status) {
            case 'completed':
                return { color: 'success' as BadgeColor, defaultLabel: '완료' };
            case 'in-progress':
                return { color: 'primary' as BadgeColor, defaultLabel: '진행 중' };
            case 'overdue':
                return { color: 'error' as BadgeColor, defaultLabel: '마감' };
            case 'pending':
            default:
                return { color: 'neutral' as BadgeColor, defaultLabel: '대기' };
        }
    };

    const config = getStatusConfig();

    return (
        <Badge
            label={label || config.defaultLabel}
            color={config.color}
            variant="soft"
            size="sm"
            style={style}
        />
    );
}

const createStyles = (colors: ColorScheme, typography: TypographyType, layout: LayoutType, isDark: boolean) => StyleSheet.create({
    badge: {
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'flex-start',
    },
    text: {
        textAlign: 'center',
    },
    iconWrapper: {
        marginRight: 4,
    },
    dot: {
        position: 'absolute',
        left: 6,
        width: 6,
        height: 6,
        borderRadius: 3,
    },
    dotOnly: {
        width: 8,
        height: 8,
        borderRadius: 4,
    },
    countBadge: {
        minWidth: 20,
        height: 20,
        borderRadius: 10,
        paddingHorizontal: 6,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.error,
    },
    countBadgeSmall: {
        minWidth: 18,
        height: 18,
        borderRadius: 9,
        paddingHorizontal: 0,
    },
    countText: {
        color: colors.textInverse,
        fontSize: 11,
        fontWeight: '700',
        letterSpacing: 0,
    },
});
