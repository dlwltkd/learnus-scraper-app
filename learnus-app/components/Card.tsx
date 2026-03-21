import React, { useRef, useCallback, useMemo } from 'react';
import {
    StyleSheet,
    View,
    ViewStyle,
    TouchableOpacity,
    Animated,
} from 'react-native';
import { Spacing } from '../constants/theme';
import { useTheme } from '../context/ThemeContext';
import { type ColorScheme, type TypographyType, type LayoutType } from '../constants/theme';

type CardVariant = 'elevated' | 'outlined' | 'filled' | 'glass' | 'flat';

interface CardProps {
    children: React.ReactNode;
    style?: ViewStyle;
    variant?: CardVariant;
    onPress?: () => void;
    disabled?: boolean;
    padding?: 'none' | 'sm' | 'md' | 'lg';
    animated?: boolean;
}

export default function Card({
    children,
    style,
    variant = 'elevated',
    onPress,
    disabled = false,
    padding = 'md',
    animated = true,
}: CardProps) {
    const { colors, typography, layout, isDark } = useTheme();
    const styles = useMemo(() => createStyles(colors, typography, layout, isDark), [colors, typography, layout, isDark]);

    const scaleAnim = useRef(new Animated.Value(1)).current;

    const handlePressIn = useCallback(() => {
        if (!animated || !onPress) return;
        Animated.spring(scaleAnim, {
            toValue: 0.98,
            useNativeDriver: true,
            speed: 50,
            bounciness: 4,
        }).start();
    }, [scaleAnim, animated, onPress]);

    const handlePressOut = useCallback(() => {
        if (!animated || !onPress) return;
        Animated.spring(scaleAnim, {
            toValue: 1,
            useNativeDriver: true,
            speed: 50,
            bounciness: 4,
        }).start();
    }, [scaleAnim, animated, onPress]);

    const getVariantStyles = (): ViewStyle => {
        switch (variant) {
            case 'elevated':
                return {
                    backgroundColor: colors.surface,
                    borderWidth: 1,
                    borderColor: colors.borderLight,
                    ...layout.shadow.default,
                };
            case 'outlined':
                return {
                    backgroundColor: colors.surface,
                    borderWidth: 1.5,
                    borderColor: colors.border,
                };
            case 'filled':
                return {
                    backgroundColor: colors.surfaceHighlight,
                    borderWidth: 0,
                };
            case 'glass':
                return {
                    backgroundColor: colors.surfaceGlass,
                    borderWidth: 1,
                    borderColor: colors.glassBorder,
                    ...layout.shadow.md,
                };
            case 'flat':
                return {
                    backgroundColor: colors.surface,
                    borderWidth: 0,
                };
            default:
                return {};
        }
    };

    const getPaddingStyles = (): ViewStyle => {
        switch (padding) {
            case 'none':
                return { padding: 0 };
            case 'sm':
                return { padding: Spacing.m };
            case 'lg':
                return { padding: Spacing.l };
            default: // md
                return { padding: Spacing.cardPadding };
        }
    };

    const cardStyles = [
        styles.card,
        getVariantStyles(),
        getPaddingStyles(),
        disabled && styles.disabled,
        style,
    ];

    if (onPress) {
        return (
            <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
                <TouchableOpacity
                    style={cardStyles}
                    onPress={onPress}
                    onPressIn={handlePressIn}
                    onPressOut={handlePressOut}
                    disabled={disabled}
                    activeOpacity={0.95}
                >
                    {children}
                </TouchableOpacity>
            </Animated.View>
        );
    }

    return <View style={cardStyles}>{children}</View>;
}

// Specialized Card Components

interface StatCardProps {
    children: React.ReactNode;
    style?: ViewStyle;
    accentColor?: string;
}

export function StatCard({ children, style, accentColor }: StatCardProps) {
    const { colors, typography, layout, isDark } = useTheme();
    const styles = useMemo(() => createStyles(colors, typography, layout, isDark), [colors, typography, layout, isDark]);

    return (
        <View
            style={[
                styles.statCard,
                accentColor && { borderLeftColor: accentColor },
                style,
            ]}
        >
            {children}
        </View>
    );
}

interface FeatureCardProps {
    children: React.ReactNode;
    style?: ViewStyle;
    onPress?: () => void;
    gradient?: boolean;
}

export function FeatureCard({
    children,
    style,
    onPress,
    gradient = false,
}: FeatureCardProps) {
    const { colors, typography, layout, isDark } = useTheme();
    const styles = useMemo(() => createStyles(colors, typography, layout, isDark), [colors, typography, layout, isDark]);

    const scaleAnim = useRef(new Animated.Value(1)).current;

    const handlePressIn = useCallback(() => {
        if (!onPress) return;
        Animated.spring(scaleAnim, {
            toValue: 0.97,
            useNativeDriver: true,
            speed: 50,
            bounciness: 4,
        }).start();
    }, [scaleAnim, onPress]);

    const handlePressOut = useCallback(() => {
        if (!onPress) return;
        Animated.spring(scaleAnim, {
            toValue: 1,
            useNativeDriver: true,
            speed: 50,
            bounciness: 4,
        }).start();
    }, [scaleAnim, onPress]);

    const content = (
        <View style={[styles.featureCard, style]}>
            {children}
        </View>
    );

    if (onPress) {
        return (
            <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
                <TouchableOpacity
                    onPress={onPress}
                    onPressIn={handlePressIn}
                    onPressOut={handlePressOut}
                    activeOpacity={0.95}
                >
                    {content}
                </TouchableOpacity>
            </Animated.View>
        );
    }

    return content;
}

// List Item Card for consistent list styling
interface ListItemCardProps {
    children: React.ReactNode;
    style?: ViewStyle;
    onPress?: () => void;
    showChevron?: boolean;
    isFirst?: boolean;
    isLast?: boolean;
}

export function ListItemCard({
    children,
    style,
    onPress,
    isFirst = false,
    isLast = false,
}: ListItemCardProps) {
    const { colors, typography, layout, isDark } = useTheme();
    const styles = useMemo(() => createStyles(colors, typography, layout, isDark), [colors, typography, layout, isDark]);

    return (
        <TouchableOpacity
            style={[
                styles.listItemCard,
                isFirst && styles.listItemFirst,
                isLast && styles.listItemLast,
                !isLast && styles.listItemBorder,
                style,
            ]}
            onPress={onPress}
            activeOpacity={onPress ? 0.7 : 1}
            disabled={!onPress}
        >
            {children}
        </TouchableOpacity>
    );
}

const createStyles = (colors: ColorScheme, typography: TypographyType, layout: LayoutType, isDark: boolean) => StyleSheet.create({
    card: {
        borderRadius: layout.borderRadius.l,
        marginBottom: Spacing.m,
        overflow: 'hidden',
    },
    disabled: {
        opacity: 0.6,
    },
    statCard: {
        backgroundColor: colors.surface,
        borderRadius: layout.borderRadius.l,
        padding: Spacing.cardPadding,
        borderLeftWidth: 4,
        borderLeftColor: colors.primary,
        borderWidth: 1,
        borderColor: colors.borderLight,
        ...layout.shadow.sm,
    },
    featureCard: {
        backgroundColor: colors.primary,
        borderRadius: layout.borderRadius.xl,
        padding: Spacing.l,
        ...layout.shadow.primary,
    },
    listItemCard: {
        backgroundColor: colors.surface,
        paddingHorizontal: Spacing.m,
        paddingVertical: Spacing.m + 2,
    },
    listItemFirst: {
        borderTopLeftRadius: layout.borderRadius.l,
        borderTopRightRadius: layout.borderRadius.l,
    },
    listItemLast: {
        borderBottomLeftRadius: layout.borderRadius.l,
        borderBottomRightRadius: layout.borderRadius.l,
    },
    listItemBorder: {
        borderBottomWidth: 1,
        borderBottomColor: colors.divider,
    },
});
