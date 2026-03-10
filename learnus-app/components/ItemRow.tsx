import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Layout, Spacing, Typography } from '../constants/theme';

export type ItemState = 'pending' | 'completed' | 'missed' | 'upcoming' | 'unchecked';
export type ItemType = 'assignment' | 'vod';

interface ItemRowProps {
    title: string;
    courseName: string;
    meta?: string;
    state: ItemState;
    type: ItemType;
    onWebPress?: () => void;
}

const STATE_CONFIG: Record<ItemState, {
    bar: string;
    bg: string;
    iconBg: string;
    badge: string | null;
    badgeColor: string;
    badgeBg: string;
}> = {
    pending: {
        bar: Colors.primary,
        bg: Colors.surface,
        iconBg: Colors.primaryLighter,
        badge: null,
        badgeColor: Colors.primary,
        badgeBg: Colors.primaryLighter,
    },
    completed: {
        bar: Colors.success,
        bg: Colors.surfaceMuted,
        iconBg: 'rgba(34, 197, 94, 0.12)',
        badge: '완료',
        badgeColor: '#16A34A',
        badgeBg: 'rgba(34, 197, 94, 0.12)',
    },
    missed: {
        bar: Colors.error,
        bg: Colors.surface,
        iconBg: Colors.errorLight,
        badge: '마감',
        badgeColor: Colors.error,
        badgeBg: Colors.errorLight,
    },
    upcoming: {
        bar: Colors.textTertiary,
        bg: Colors.surface,
        iconBg: Colors.surfaceAlt,
        badge: '예정',
        badgeColor: Colors.textSecondary,
        badgeBg: Colors.surfaceAlt,
    },
    unchecked: {
        bar: Colors.warning,
        bg: Colors.surface,
        iconBg: Colors.warningLight,
        badge: '미반영',
        badgeColor: '#B45309',
        badgeBg: Colors.warningLight,
    },
};

const TYPE_ICON: Record<ItemType, keyof typeof Ionicons.glyphMap> = {
    assignment: 'document-text-outline',
    vod: 'play-circle-outline',
};

const COMPLETED_ICON: Record<ItemType, keyof typeof Ionicons.glyphMap> = {
    assignment: 'checkmark-circle',
    vod: 'checkmark-circle',
};

export default function ItemRow({ title, courseName, meta, state, type, onWebPress }: ItemRowProps) {
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
                <Text style={[styles.courseName, isCompleted && { color: Colors.textTertiary }]} numberOfLines={1}>{courseName}</Text>
                <Text style={[styles.title, isCompleted && { color: Colors.textSecondary, fontWeight: '500' }]} numberOfLines={1}>{title}</Text>
                {meta ? (
                    <View style={styles.metaRow}>
                        <Ionicons name="time-outline" size={12} color={Colors.textTertiary} />
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
                {onWebPress && (
                    <TouchableOpacity
                        style={styles.webBtn}
                        onPress={onWebPress}
                        activeOpacity={0.7}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                        <Ionicons name="open-outline" size={18} color={Colors.textTertiary} />
                    </TouchableOpacity>
                )}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    card: {
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: Layout.borderRadius.l,
        marginBottom: Spacing.s,
        borderWidth: 1,
        borderColor: Colors.border,
        ...Layout.shadow.sm,
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
        ...Typography.caption,
        marginBottom: 2,
    },
    title: {
        fontSize: 15,
        fontWeight: '600',
        color: Colors.textPrimary,
        marginBottom: 4,
    },
    metaRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    meta: {
        ...Typography.caption,
        color: Colors.textTertiary,
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
        backgroundColor: Colors.surfaceAlt,
        alignItems: 'center',
        justifyContent: 'center',
    },
});
