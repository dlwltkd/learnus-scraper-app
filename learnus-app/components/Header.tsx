import React, { useRef, useCallback, useMemo } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Animated,
    ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Spacing } from '../constants/theme';
import { useTheme } from '../context/ThemeContext';
import { type ColorScheme, type TypographyType, type LayoutType } from '../constants/theme';

interface HeaderProps {
    title?: string;
    subtitle?: string;
    leftAction?: {
        icon: keyof typeof Ionicons.glyphMap;
        onPress: () => void;
    };
    rightAction?: {
        icon: keyof typeof Ionicons.glyphMap;
        onPress: () => void;
        loading?: boolean;
    };
    rightActions?: Array<{
        icon: keyof typeof Ionicons.glyphMap;
        onPress: () => void;
        badge?: number;
    }>;
    large?: boolean;
    transparent?: boolean;
    style?: ViewStyle;
}

function HeaderButton({
    icon,
    onPress,
    badge,
    loading,
}: {
    icon: keyof typeof Ionicons.glyphMap;
    onPress: () => void;
    badge?: number;
    loading?: boolean;
}) {
    const { colors, typography, layout, isDark } = useTheme();
    const styles = useMemo(() => createStyles(colors, typography, layout, isDark), [colors, typography, layout, isDark]);
    const scaleAnim = useRef(new Animated.Value(1)).current;

    const handlePressIn = useCallback(() => {
        Animated.spring(scaleAnim, {
            toValue: 0.9,
            useNativeDriver: true,
            speed: 50,
            bounciness: 4,
        }).start();
    }, [scaleAnim]);

    const handlePressOut = useCallback(() => {
        Animated.spring(scaleAnim, {
            toValue: 1,
            useNativeDriver: true,
            speed: 50,
            bounciness: 4,
        }).start();
    }, [scaleAnim]);

    return (
        <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
            <TouchableOpacity
                style={styles.headerButton}
                onPress={onPress}
                onPressIn={handlePressIn}
                onPressOut={handlePressOut}
                disabled={loading}
                activeOpacity={0.8}
            >
                <Ionicons
                    name={loading ? 'sync' : icon}
                    size={22}
                    color={colors.textPrimary}
                    style={loading ? styles.spinningIcon : undefined}
                />
                {badge !== undefined && badge > 0 && (
                    <View style={styles.badge}>
                        <Text style={styles.badgeText}>
                            {badge > 9 ? '9+' : badge}
                        </Text>
                    </View>
                )}
            </TouchableOpacity>
        </Animated.View>
    );
}

export default function Header({
    title,
    subtitle,
    leftAction,
    rightAction,
    rightActions,
    large = false,
    transparent = false,
    style,
}: HeaderProps) {
    const { colors, typography, layout, isDark } = useTheme();
    const styles = useMemo(() => createStyles(colors, typography, layout, isDark), [colors, typography, layout, isDark]);

    return (
        <View
            style={[
                styles.container,
                transparent && styles.transparent,
                large && styles.large,
                style,
            ]}
        >
            <View style={styles.leftSection}>
                {leftAction && (
                    <HeaderButton
                        icon={leftAction.icon}
                        onPress={leftAction.onPress}
                    />
                )}
            </View>

            <View style={[styles.titleSection, large && styles.titleSectionLarge]}>
                {title && (
                    <Text
                        style={[styles.title, large && styles.titleLarge]}
                        numberOfLines={1}
                    >
                        {title}
                    </Text>
                )}
                {subtitle && (
                    <Text style={styles.subtitle} numberOfLines={1}>
                        {subtitle}
                    </Text>
                )}
            </View>

            <View style={styles.rightSection}>
                {rightAction && (
                    <HeaderButton
                        icon={rightAction.icon}
                        onPress={rightAction.onPress}
                        loading={rightAction.loading}
                    />
                )}
                {rightActions?.map((action, index) => (
                    <HeaderButton
                        key={index}
                        icon={action.icon}
                        onPress={action.onPress}
                        badge={action.badge}
                    />
                ))}
            </View>
        </View>
    );
}

// Screen Header - for main screens with large titles
interface ScreenHeaderProps {
    title: string;
    subtitle?: string;
    rightAction?: {
        label: string;
        onPress: () => void;
    };
    style?: ViewStyle;
}

export function ScreenHeader({ title, subtitle, rightAction, style }: ScreenHeaderProps) {
    const { colors, typography, layout, isDark } = useTheme();
    const styles = useMemo(() => createStyles(colors, typography, layout, isDark), [colors, typography, layout, isDark]);

    return (
        <View style={[styles.screenHeader, style]}>
            <View style={styles.screenHeaderText}>
                <Text style={styles.screenTitle}>{title}</Text>
                {subtitle && <Text style={styles.screenSubtitle}>{subtitle}</Text>}
            </View>
            {rightAction && (
                <TouchableOpacity
                    style={styles.screenHeaderAction}
                    onPress={rightAction.onPress}
                    activeOpacity={0.7}
                >
                    <Text style={styles.screenHeaderActionText}>{rightAction.label}</Text>
                </TouchableOpacity>
            )}
        </View>
    );
}

const createStyles = (colors: ColorScheme, typography: TypographyType, layout: LayoutType, isDark: boolean) => StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: Spacing.m,
        paddingVertical: Spacing.s,
        backgroundColor: colors.background,
        minHeight: 56,
    },
    transparent: {
        backgroundColor: 'transparent',
    },
    large: {
        paddingVertical: Spacing.m,
        minHeight: 72,
    },
    leftSection: {
        minWidth: 44,
        alignItems: 'flex-start',
    },
    titleSection: {
        flex: 1,
        alignItems: 'center',
        paddingHorizontal: Spacing.s,
    },
    titleSectionLarge: {
        alignItems: 'flex-start',
    },
    rightSection: {
        minWidth: 44,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'flex-end',
        gap: Spacing.xs,
    },
    title: {
        ...typography.subtitle1,
        fontSize: 17,
        textAlign: 'center',
    },
    titleLarge: {
        ...typography.header2,
        textAlign: 'left',
    },
    subtitle: {
        ...typography.caption,
        marginTop: 2,
    },
    headerButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: colors.surfaceHighlight,
        alignItems: 'center',
        justifyContent: 'center',
    },
    spinningIcon: {
        // Animation would be handled via Animated API in production
    },
    badge: {
        position: 'absolute',
        top: 2,
        right: 2,
        minWidth: 16,
        height: 16,
        borderRadius: 8,
        backgroundColor: colors.error,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 4,
    },
    badgeText: {
        color: colors.textInverse,
        fontSize: 10,
        fontWeight: '700',
    },
    // Screen Header styles
    screenHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: Spacing.l,
        paddingVertical: Spacing.m,
        backgroundColor: colors.background,
    },
    screenHeaderText: {
        flex: 1,
    },
    screenTitle: {
        ...typography.header1,
        fontSize: 28,
    },
    screenSubtitle: {
        ...typography.body2,
        marginTop: 4,
    },
    screenHeaderAction: {
        paddingVertical: 8,
        paddingHorizontal: 16,
        backgroundColor: colors.surface,
        borderRadius: layout.borderRadius.full,
        borderWidth: 1,
        borderColor: colors.border,
    },
    screenHeaderActionText: {
        ...typography.buttonSmall,
        color: colors.textPrimary,
    },
});
