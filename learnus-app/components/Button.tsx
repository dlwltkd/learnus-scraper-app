import React from 'react';
import { StyleSheet, Text, TouchableOpacity, ViewStyle, ActivityIndicator } from 'react-native';
import { COLORS, FONTS, SPACING } from '../constants/theme';

interface ButtonProps {
    title: string;
    onPress: () => void;
    variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
    loading?: boolean;
    disabled?: boolean;
    style?: ViewStyle;
    icon?: React.ReactNode;
}

export default function Button({
    title,
    onPress,
    variant = 'primary',
    loading = false,
    disabled = false,
    style,
    icon
}: ButtonProps) {

    const getBackgroundColor = () => {
        if (disabled) return COLORS.border;
        switch (variant) {
            case 'primary': return COLORS.primary;
            case 'secondary': return COLORS.secondary;
            case 'outline': return 'transparent';
            case 'ghost': return 'transparent';
            default: return COLORS.primary;
        }
    };

    const getTextColor = () => {
        if (disabled) return COLORS.textLight;
        switch (variant) {
            case 'primary': return '#fff';
            case 'secondary': return '#fff';
            case 'outline': return COLORS.primary;
            case 'ghost': return COLORS.textSecondary;
            default: return '#fff';
        }
    };

    return (
        <TouchableOpacity
            style={[
                styles.button,
                { backgroundColor: getBackgroundColor() },
                variant === 'outline' && { borderWidth: 1, borderColor: COLORS.primary },
                style
            ]}
            onPress={onPress}
            disabled={disabled || loading}
            activeOpacity={0.8}
        >
            {loading ? (
                <ActivityIndicator size="small" color={getTextColor()} />
            ) : (
                <>
                    {icon}
                    <Text style={[styles.text, { color: getTextColor(), marginLeft: icon ? 8 : 0 }]}>
                        {title}
                    </Text>
                </>
            )}
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    button: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 12,
        paddingHorizontal: 20,
        borderRadius: 16, // Layout.borderRadius.l
    },
    text: {
        fontSize: FONTS.sizes.md,
        fontWeight: '600',
    },
});
