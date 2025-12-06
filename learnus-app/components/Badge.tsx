import React from 'react';
import { StyleSheet, Text, View, ViewStyle } from 'react-native';
import { COLORS, FONTS, SPACING } from '../constants/theme';

interface BadgeProps {
    label: string;
    color?: string; // Background color
    textColor?: string;
    style?: ViewStyle;
}

export default function Badge({ label, color = COLORS.primary, textColor = '#fff', style }: BadgeProps) {
    return (
        <View style={[styles.badge, { backgroundColor: color }, style]}>
            <Text style={[styles.text, { color: textColor }]}>{label}</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    badge: {
        paddingHorizontal: SPACING.sm,
        paddingVertical: 2,
        borderRadius: 4,
        alignSelf: 'flex-start',
    },
    text: {
        fontSize: 10,
        fontWeight: 'bold',
    },
});
