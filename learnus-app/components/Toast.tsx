import React, { useEffect, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Animated,
    Dimensions,
    TouchableOpacity,
    Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Typography, Layout, Spacing, Animation } from '../constants/theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export type ToastType = 'success' | 'error' | 'info' | 'warning';

interface ToastProps {
    visible: boolean;
    type: ToastType;
    title: string;
    message?: string;
    duration?: number;
    onHide: () => void;
}

const TOAST_CONFIG = {
    success: {
        icon: 'checkmark-circle' as const,
        color: '#22C55E',
        softBg: 'rgba(34, 197, 94, 0.12)',
        iconBg: 'rgba(34, 197, 94, 0.15)',
    },
    error: {
        icon: 'close-circle' as const,
        color: '#EF4444',
        softBg: 'rgba(239, 68, 68, 0.12)',
        iconBg: 'rgba(239, 68, 68, 0.15)',
    },
    info: {
        icon: 'information-circle' as const,
        color: '#3182F6',
        softBg: 'rgba(49, 130, 246, 0.12)',
        iconBg: 'rgba(49, 130, 246, 0.15)',
    },
    warning: {
        icon: 'alert-circle' as const,
        color: '#F59E0B',
        softBg: 'rgba(245, 158, 11, 0.12)',
        iconBg: 'rgba(245, 158, 11, 0.15)',
    },
};

const Toast: React.FC<ToastProps> = ({
    visible,
    type,
    title,
    message,
    duration = 3000,
    onHide,
}) => {
    const insets = useSafeAreaInsets();
    const translateY = useRef(new Animated.Value(-100)).current;
    const opacity = useRef(new Animated.Value(0)).current;
    const scale = useRef(new Animated.Value(0.92)).current;

    const config = TOAST_CONFIG[type];

    useEffect(() => {
        if (visible) {
            // Entrance animation - smooth and refined
            Animated.parallel([
                Animated.spring(translateY, {
                    toValue: 0,
                    damping: 22,
                    stiffness: 280,
                    mass: 0.8,
                    useNativeDriver: true,
                }),
                Animated.timing(opacity, {
                    toValue: 1,
                    duration: 200,
                    useNativeDriver: true,
                }),
                Animated.spring(scale, {
                    toValue: 1,
                    damping: 20,
                    stiffness: 260,
                    useNativeDriver: true,
                }),
            ]).start();

            // Auto-hide after duration
            const timer = setTimeout(() => {
                hideToast();
            }, duration);

            return () => clearTimeout(timer);
        }
    }, [visible]);

    const hideToast = () => {
        Animated.parallel([
            Animated.timing(translateY, {
                toValue: -100,
                duration: 250,
                useNativeDriver: true,
            }),
            Animated.timing(opacity, {
                toValue: 0,
                duration: 180,
                useNativeDriver: true,
            }),
            Animated.timing(scale, {
                toValue: 0.92,
                duration: 180,
                useNativeDriver: true,
            }),
        ]).start(() => {
            onHide();
        });
    };

    if (!visible) return null;

    return (
        <Animated.View
            style={[
                styles.container,
                {
                    top: insets.top + 8,
                    transform: [{ translateY }, { scale }],
                    opacity,
                },
            ]}
        >
            <TouchableOpacity
                activeOpacity={0.98}
                onPress={hideToast}
                style={styles.touchable}
            >
                <View style={styles.toast}>
                    {/* Soft colored background layer */}
                    <View
                        style={[
                            styles.colorLayer,
                            { backgroundColor: config.softBg }
                        ]}
                    />

                    {/* Main content */}
                    <View style={styles.mainContent}>
                        {/* Icon with soft background */}
                        <View style={[styles.iconContainer, { backgroundColor: config.iconBg }]}>
                            <Ionicons name={config.icon} size={20} color={config.color} />
                        </View>

                        {/* Text content */}
                        <View style={styles.textContent}>
                            <Text style={styles.title} numberOfLines={1}>
                                {title}
                            </Text>
                            {message && (
                                <Text style={styles.message} numberOfLines={2}>
                                    {message}
                                </Text>
                            )}
                        </View>

                        {/* Dismiss indicator */}
                        <View style={styles.dismissHint}>
                            <Ionicons name="close" size={16} color={Colors.textTertiary} />
                        </View>
                    </View>
                </View>
            </TouchableOpacity>
        </Animated.View>
    );
};

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        left: 0,
        right: 0,
        zIndex: 9999,
        alignItems: 'center',
        paddingHorizontal: Spacing.m,
    },
    touchable: {
        width: '100%',
        maxWidth: 400,
    },
    toast: {
        backgroundColor: Colors.surface,
        borderRadius: 16,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(0, 0, 0, 0.06)',
        ...Platform.select({
            ios: {
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 8 },
                shadowOpacity: 0.12,
                shadowRadius: 24,
            },
            android: {
                elevation: 12,
            },
        }),
    },
    colorLayer: {
        ...StyleSheet.absoluteFillObject,
        opacity: 0.5,
    },
    mainContent: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 14,
        paddingHorizontal: 16,
    },
    iconContainer: {
        width: 36,
        height: 36,
        borderRadius: 10,
        justifyContent: 'center',
        alignItems: 'center',
    },
    textContent: {
        flex: 1,
        marginLeft: 12,
        marginRight: 8,
    },
    title: {
        fontSize: 15,
        fontWeight: '600',
        color: Colors.textPrimary,
        letterSpacing: -0.2,
    },
    message: {
        fontSize: 13,
        color: Colors.textSecondary,
        marginTop: 2,
        lineHeight: 18,
    },
    dismissHint: {
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: 'rgba(0, 0, 0, 0.04)',
        justifyContent: 'center',
        alignItems: 'center',
    },
});

export default Toast;
