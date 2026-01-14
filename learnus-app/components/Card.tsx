import React, { useRef, useCallback } from 'react';
import {
    StyleSheet,
    View,
    ViewStyle,
    TouchableOpacity,
    Animated,
} from 'react-native';
import { Colors, Layout, Spacing } from '../constants/theme';

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
                    backgroundColor: Colors.surface,
                    borderWidth: 1,
                    borderColor: Colors.borderLight,
                    ...Layout.shadow.default,
                };
            case 'outlined':
                return {
                    backgroundColor: Colors.surface,
                    borderWidth: 1.5,
                    borderColor: Colors.border,
                };
            case 'filled':
                return {
                    backgroundColor: Colors.surfaceHighlight,
                    borderWidth: 0,
                };
            case 'glass':
                return {
                    backgroundColor: Colors.surfaceGlass,
                    borderWidth: 1,
                    borderColor: Colors.glassBorder,
                    ...Layout.shadow.md,
                };
            case 'flat':
                return {
                    backgroundColor: Colors.surface,
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

const styles = StyleSheet.create({
    card: {
        borderRadius: Layout.borderRadius.l,
        marginBottom: Spacing.m,
        overflow: 'hidden',
    },
    disabled: {
        opacity: 0.6,
    },
    statCard: {
        backgroundColor: Colors.surface,
        borderRadius: Layout.borderRadius.l,
        padding: Spacing.cardPadding,
        borderLeftWidth: 4,
        borderLeftColor: Colors.primary,
        borderWidth: 1,
        borderColor: Colors.borderLight,
        ...Layout.shadow.sm,
    },
    featureCard: {
        backgroundColor: Colors.primary,
        borderRadius: Layout.borderRadius.xl,
        padding: Spacing.l,
        ...Layout.shadow.primary,
    },
    listItemCard: {
        backgroundColor: Colors.surface,
        paddingHorizontal: Spacing.m,
        paddingVertical: Spacing.m + 2,
    },
    listItemFirst: {
        borderTopLeftRadius: Layout.borderRadius.l,
        borderTopRightRadius: Layout.borderRadius.l,
    },
    listItemLast: {
        borderBottomLeftRadius: Layout.borderRadius.l,
        borderBottomRightRadius: Layout.borderRadius.l,
    },
    listItemBorder: {
        borderBottomWidth: 1,
        borderBottomColor: Colors.divider,
    },
});
