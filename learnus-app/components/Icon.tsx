import React from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';

import { StyleProp, ViewStyle } from 'react-native';

interface IconProps {
    name: keyof typeof Ionicons.glyphMap;
    size?: number;
    color?: string;
    style?: StyleProp<ViewStyle>;
}

export default function Icon({ name, size = 24, color, style }: IconProps) {
    const { colors } = useTheme();
    return <Ionicons name={name} size={size} color={color ?? colors.textPrimary} style={style} />;
}
