import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Layout, Spacing, Typography } from '../constants/theme';
import Button from './Button';

interface EmptyStateProps {
    icon?: keyof typeof Ionicons.glyphMap;
    title: string;
    description?: string;
    action?: {
        label: string;
        onPress: () => void;
    };
    style?: ViewStyle;
    compact?: boolean;
}

export default function EmptyState({
    icon = 'folder-open-outline',
    title,
    description,
    action,
    style,
    compact = false,
}: EmptyStateProps) {
    return (
        <View style={[styles.container, compact && styles.compact, style]}>
            <View style={[styles.iconContainer, compact && styles.iconContainerCompact]}>
                <Ionicons
                    name={icon}
                    size={compact ? 32 : 48}
                    color={Colors.textTertiary}
                />
            </View>
            <Text style={[styles.title, compact && styles.titleCompact]}>{title}</Text>
            {description && (
                <Text style={[styles.description, compact && styles.descriptionCompact]}>
                    {description}
                </Text>
            )}
            {action && (
                <Button
                    title={action.label}
                    onPress={action.onPress}
                    variant="secondary"
                    size="sm"
                    style={styles.actionButton}
                />
            )}
        </View>
    );
}

// Inline empty state for lists
interface InlineEmptyProps {
    message: string;
    style?: ViewStyle;
}

export function InlineEmpty({ message, style }: InlineEmptyProps) {
    return (
        <View style={[styles.inlineContainer, style]}>
            <Text style={styles.inlineText}>{message}</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        alignItems: 'center',
        justifyContent: 'center',
        padding: Spacing.xxl,
        paddingVertical: Spacing.xxxl,
    },
    compact: {
        padding: Spacing.l,
        paddingVertical: Spacing.xl,
    },
    iconContainer: {
        width: 96,
        height: 96,
        borderRadius: 48,
        backgroundColor: Colors.surfaceMuted,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: Spacing.l,
    },
    iconContainerCompact: {
        width: 64,
        height: 64,
        borderRadius: 32,
        marginBottom: Spacing.m,
    },
    title: {
        ...Typography.header3,
        textAlign: 'center',
        marginBottom: Spacing.s,
    },
    titleCompact: {
        ...Typography.subtitle1,
    },
    description: {
        ...Typography.body2,
        textAlign: 'center',
        maxWidth: 280,
        lineHeight: 22,
    },
    descriptionCompact: {
        ...Typography.caption,
        maxWidth: 240,
    },
    actionButton: {
        marginTop: Spacing.l,
    },
    // Inline styles
    inlineContainer: {
        padding: Spacing.l,
        alignItems: 'center',
    },
    inlineText: {
        ...Typography.body2,
        color: Colors.textTertiary,
        fontStyle: 'italic',
    },
});
