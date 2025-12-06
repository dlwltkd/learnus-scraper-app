import React from 'react';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../constants/theme';

import { StyleProp, ViewStyle } from 'react-native';

interface IconProps {
    name: keyof typeof Ionicons.glyphMap;
    size?: number;
    color?: string;
    style?: StyleProp<ViewStyle>;
}

export default function Icon({ name, size = 24, color = COLORS.text, style }: IconProps) {
    return <Ionicons name={name} size={size} color={color} style={style} />;
}
