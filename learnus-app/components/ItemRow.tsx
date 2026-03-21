import React, { useMemo, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Spacing } from '../constants/theme';
import { useTheme } from '../context/ThemeContext';
import { type ColorScheme, type TypographyType, type LayoutType } from '../constants/theme';

export type ItemState = 'pending' | 'completed' | 'missed' | 'upcoming' | 'unchecked';
export type ItemType = 'assignment' | 'vod';

interface ItemRowProps {
    title: string;
    courseName: string;
    meta?: string;
    state: ItemState;
    type: ItemType;
    onWebPress?: () => void;
    onMenuPress?: () => void;
    highlightMenu?: boolean;
}

const TYPE_ICON: Record<ItemType, keyof typeof Ionicons.glyphMap> = {
    assignment: 'document-text-outline',
    vod: 'play-circle-outline',
};

const COMPLETED_ICON: Record<ItemType, keyof typeof Ionicons.glyphMap> = {
    assignment: 'checkmark-circle',
    vod: 'checkmark-circle',
};

export default function ItemRow({ title, courseName, meta, state, type, onWebPress, onMenuPress, highlightMenu }: ItemRowProps) {
    const { colors, typography, layout, isDark } = useTheme();
    const styles = useMemo(() => createStyles(colors, typography, layout, isDark), [colors, typography, layout, isDark]);

    const pulseAnim = useRef(new Animated.Value(1)).current;
    useEffect(() => {
        if (highlightMenu) {
            const pulse = Animated.loop(
                Animated.sequence([
                    Animated.timing(pulseAnim, { toValue: 1.25, duration: 700, useNativeDriver: true }),
                    Animated.timing(pulseAnim, { toValue: 1, duration: 700, useNativeDriver: true }),
                ])
            );
            pulse.start();
            return () => pulse.stop();
        } else {
            pulseAnim.setValue(1);
        }
    }, [highlightMenu]);

    const STATE_CONFIG: Record<ItemState, {
        bar: string;
        bg: string;
        iconBg: string;
        badge: string | null;
        badgeColor: string;
        badgeBg: string;
    }> = {
        pending: {
            bar: colors.primary,
            bg: colors.surface,
            iconBg: colors.primaryLighter,
            badge: null,
            badgeColor: colors.primary,
            badgeBg: colors.primaryLighter,
        },
        completed: {
            bar: colors.success,
            bg: colors.surfaceMuted,
            iconBg: 'rgba(34, 197, 94, 0.12)',
            badge: '완료',
            badgeColor: '#16A34A',
            badgeBg: 'rgba(34, 197, 94, 0.12)',
        },
        missed: {
            bar: colors.error,
            bg: colors.surface,
            iconBg: colors.errorLight,
            badge: '마감',
            badgeColor: colors.error,
            badgeBg: colors.errorLight,
        },
        upcoming: {
            bar: colors.textTertiary,
            bg: colors.surface,
            iconBg: colors.surfaceAlt,
            badge: '예정',
            badgeColor: colors.textSecondary,
            badgeBg: colors.surfaceAlt,
        },
        unchecked: {
            bar: colors.warning,
            bg: colors.surface,
            iconBg: colors.warningLight,
            badge: '미반영',
            badgeColor: '#B45309',
            badgeBg: colors.warningLight,
        },
    };

    const cfg = STATE_CONFIG[state];
    const isCompleted = state === 'completed';
    const icon = isCompleted ? COMPLETED_ICON[type] : TYPE_ICON[type];

    return (
        <View style={[styles.card, { backgroundColor: cfg.bg, opacity: state === 'upcoming' ? 0.65 : 1 }]}>

            {/* Icon */}
            <View style={[styles.iconContainer, { backgroundColor: cfg.iconBg }]}>
                <Ionicons name={icon} size={22} color={cfg.bar} />
            </View>

            {/* Content */}
            <View style={styles.content}>
                <Text style={[styles.courseName, isCompleted && { color: colors.textTertiary }]} numberOfLines={1}>{courseName}</Text>
                <Text style={[styles.title, isCompleted && { color: colors.textSecondary, fontWeight: '500' }]} numberOfLines={1}>{title}</Text>
                {meta ? (
                    <View style={styles.metaRow}>
                        <Ionicons name="time-outline" size={12} color={colors.textTertiary} />
                        <Text style={styles.meta}>{meta}</Text>
                    </View>
                ) : null}
            </View>

            {/* Right side */}
            <View style={styles.right}>
                {cfg.badge && (
                    <View style={[styles.badge, { backgroundColor: cfg.badgeBg }]}>
                        <Text style={[styles.badgeText, { color: cfg.badgeColor }]}>{cfg.badge}</Text>
                    </View>
                )}
                {onMenuPress ? (
                    <Animated.View style={highlightMenu ? {
                        transform: [{ scale: pulseAnim }],
                    } : undefined}>
                        <TouchableOpacity
                            style={[styles.webBtn, highlightMenu && {
                                backgroundColor: colors.primaryLighter,
                                borderWidth: 1.5,
                                borderColor: colors.primary,
                            }]}
                            onPress={onMenuPress}
                            activeOpacity={0.7}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                            <Ionicons name="ellipsis-vertical" size={18} color={highlightMenu ? colors.primary : colors.textTertiary} />
                        </TouchableOpacity>
                    </Animated.View>
                ) : onWebPress ? (
                    <TouchableOpacity
                        style={styles.webBtn}
                        onPress={onWebPress}
                        activeOpacity={0.7}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                        <Ionicons name="open-outline" size={18} color={colors.textTertiary} />
                    </TouchableOpacity>
                ) : null}
            </View>
        </View>
    );
}

const createStyles = (colors: ColorScheme, typography: TypographyType, layout: LayoutType, isDark: boolean) => StyleSheet.create({
    card: {
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: layout.borderRadius.l,
        marginBottom: Spacing.s,
        borderWidth: 1,
        borderColor: colors.border,
        ...layout.shadow.sm,
    },
    iconContainer: {
        width: 44,
        height: 44,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
        marginLeft: Spacing.m,
        marginVertical: Spacing.m,
        marginRight: 0,
    },
    content: {
        flex: 1,
        paddingVertical: Spacing.m,
        paddingLeft: Spacing.m,
        paddingRight: Spacing.s,
    },
    courseName: {
        ...typography.caption,
        marginBottom: 2,
    },
    title: {
        fontSize: 15,
        fontWeight: '600',
        color: colors.textPrimary,
        marginBottom: 4,
    },
    metaRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    meta: {
        ...typography.caption,
        color: colors.textTertiary,
    },
    right: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: Spacing.m,
        gap: Spacing.s,
    },
    badge: {
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 6,
    },
    badgeText: {
        fontSize: 11,
        fontWeight: '700',
        letterSpacing: 0.2,
    },
    webBtn: {
        width: 32,
        height: 32,
        borderRadius: 10,
        backgroundColor: colors.surfaceAlt,
        alignItems: 'center',
        justifyContent: 'center',
    },
});
