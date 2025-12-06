import React from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';
import { COLORS, SHADOWS, SPACING } from '../constants/theme';

interface CardProps {
    children: React.ReactNode;
    style?: ViewStyle;
    variant?: 'default' | 'outlined' | 'flat';
}

export default function Card({ children, style, variant = 'default' }: CardProps) {
    return (
        <View style={[
            styles.card,
            variant === 'outlined' && styles.outlined,
            variant === 'flat' && styles.flat,
            style
        ]}>
            {children}
        </View>
    );
}

const styles = StyleSheet.create({
    card: {
        backgroundColor: COLORS.surface,
        borderRadius: 16, // Layout.borderRadius.l
        padding: SPACING.md,
        marginBottom: SPACING.md,
        borderWidth: 1,
        borderColor: COLORS.border,
        ...SHADOWS.card,
    },
    outlined: {
        borderWidth: 1,
        borderColor: COLORS.border,
        elevation: 0,
        shadowOpacity: 0,
    },
    flat: {
        elevation: 0,
        shadowOpacity: 0,
        backgroundColor: COLORS.background,
        borderWidth: 0,
    }
});
