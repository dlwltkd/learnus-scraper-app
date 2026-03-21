import React, { useRef, useEffect } from 'react';
import { View, Animated, Easing, StyleSheet } from 'react-native';
import { useTheme } from './context/ThemeContext';

interface TypingDotsProps {
    size?: number;
    color?: string;
    gap?: number;
}

export default function TypingDots({ size = 8, color, gap = 6 }: TypingDotsProps) {
    const { colors } = useTheme();
    const dotColor = color ?? colors.primary;

    const dots = [
        useRef(new Animated.Value(0)).current,
        useRef(new Animated.Value(0)).current,
        useRef(new Animated.Value(0)).current,
    ];

    useEffect(() => {
        const animations = dots.map((dot, i) =>
            Animated.loop(
                Animated.sequence([
                    Animated.delay(i * 160),
                    Animated.timing(dot, { toValue: 1, duration: 400, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
                    Animated.timing(dot, { toValue: 0, duration: 400, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
                    Animated.delay((2 - i) * 160),
                ])
            )
        );
        animations.forEach(a => a.start());
        return () => animations.forEach(a => a.stop());
    }, []);

    return (
        <View style={[styles.row, { gap }]}>
            {dots.map((dot, i) => (
                <Animated.View
                    key={i}
                    style={{
                        width: size,
                        height: size,
                        borderRadius: size / 2,
                        backgroundColor: dotColor,
                        opacity: dot.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] }),
                        transform: [{ scale: dot.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1.2] }) }],
                    }}
                />
            ))}
        </View>
    );
}

const styles = StyleSheet.create({
    row: {
        flexDirection: 'row',
        alignItems: 'center',
    },
});
