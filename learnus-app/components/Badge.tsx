import React from 'react';
import { StyleSheet, Text, View, ViewStyle, TextStyle } from 'react-native';
import { Colors, Layout, Spacing, Typography } from '../constants/theme';

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
    const getColorStyles = (): { bg: string; text: string; border: string } => {
        switch (color) {
            case 'primary':
                return {
                    bg: Colors.primary,
                    text: Colors.textInverse,
                    border: Colors.primary,
                };
            case 'success':
                return {
                    bg: Colors.success,
                    text: Colors.textInverse,
                    border: Colors.success,
                };
            case 'warning':
                return {
                    bg: Colors.warning,
                    text: '#1A1D26',
                    border: Colors.warning,
                };
            case 'error':
                return {
                    bg: Colors.error,
                    text: Colors.textInverse,
                    border: Colors.error,
                };
            case 'secondary':
                return {
                    bg: Colors.secondary,
                    text: Colors.textInverse,
                    border: Colors.secondary,
                };
            case 'neutral':
            default:
                return {
                    bg: Colors.textTertiary,
                    text: Colors.textInverse,
                    border: Colors.textTertiary,
                };
        }
    };

    const getSoftColorStyles = (): { bg: string; text: string } => {
        switch (color) {
            case 'primary':
                return { bg: Colors.primaryLighter, text: Colors.primary };
            case 'success':
                return { bg: Colors.successLight, text: Colors.success };
            case 'warning':
                return { bg: Colors.warningLight, text: '#92400E' };
            case 'error':
                return { bg: Colors.errorLight, text: Colors.error };
            case 'secondary':
                return { bg: Colors.secondaryLight, text: Colors.secondary };
            case 'neutral':
            default:
                return { bg: Colors.surfaceMuted, text: Colors.textSecondary };
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
    if (count <= 0) return null;

    const displayCount = count > maxCount ? `${maxCount}+` : count.toString();
    const isSmall = count <= 9;

    return (
        <View
            style={[
                styles.countBadge,
                isSmall && styles.countBadgeSmall,
                color === 'primary' && { backgroundColor: Colors.primary },
                color === 'error' && { backgroundColor: Colors.error },
                color === 'success' && { backgroundColor: Colors.success },
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

const styles = StyleSheet.create({
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
        backgroundColor: Colors.error,
    },
    countBadgeSmall: {
        minWidth: 18,
        height: 18,
        borderRadius: 9,
        paddingHorizontal: 0,
    },
    countText: {
        color: Colors.textInverse,
        fontSize: 11,
        fontWeight: '700',
        letterSpacing: 0,
    },
});
