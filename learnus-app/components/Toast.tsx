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
        color: Colors.success,
        bgColor: Colors.successLight,
        borderColor: 'rgba(34, 197, 94, 0.3)',
    },
    error: {
        icon: 'close-circle' as const,
        color: Colors.error,
        bgColor: Colors.errorLight,
        borderColor: 'rgba(239, 68, 68, 0.3)',
    },
    info: {
        icon: 'information-circle' as const,
        color: Colors.primary,
        bgColor: Colors.primaryLighter,
        borderColor: 'rgba(49, 130, 246, 0.3)',
    },
    warning: {
        icon: 'warning' as const,
        color: Colors.warning,
        bgColor: Colors.warningLight,
        borderColor: 'rgba(245, 158, 11, 0.3)',
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
    const translateY = useRef(new Animated.Value(-150)).current;
    const opacity = useRef(new Animated.Value(0)).current;
    const scale = useRef(new Animated.Value(0.9)).current;

    const config = TOAST_CONFIG[type];

    useEffect(() => {
        if (visible) {
            // Slide in with spring animation
            Animated.parallel([
                Animated.spring(translateY, {
                    toValue: 0,
                    damping: 18,
                    stiffness: 200,
                    useNativeDriver: true,
                }),
                Animated.timing(opacity, {
                    toValue: 1,
                    duration: Animation.duration.fast,
                    useNativeDriver: true,
                }),
                Animated.spring(scale, {
                    toValue: 1,
                    damping: 15,
                    stiffness: 180,
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
                toValue: -150,
                duration: Animation.duration.normal,
                useNativeDriver: true,
            }),
            Animated.timing(opacity, {
                toValue: 0,
                duration: Animation.duration.fast,
                useNativeDriver: true,
            }),
            Animated.timing(scale, {
                toValue: 0.9,
                duration: Animation.duration.fast,
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
                    top: insets.top + 10,
                    transform: [{ translateY }, { scale }],
                    opacity,
                },
            ]}
        >
            <TouchableOpacity
                activeOpacity={0.95}
                onPress={hideToast}
                style={[
                    styles.toast,
                    {
                        backgroundColor: config.bgColor,
                        borderColor: config.borderColor,
                    },
                ]}
            >
                {/* Accent bar on the left */}
                <View style={[styles.accentBar, { backgroundColor: config.color, height: 100, width: 7 }]} />

                {/* Icon */}
                <View style={[styles.iconContainer, { backgroundColor: `${config.color}15` }]}>
                    <Ionicons name={config.icon} size={24} color={config.color} />
                </View>

                {/* Content */}
                <View style={styles.content}>
                    <Text style={[styles.title, { color: config.color }]}>{title}</Text>
                    {message && (
                        <Text style={styles.message} numberOfLines={2}>
                            {message}
                        </Text>
                    )}
                </View>

                {/* Close button */}
                <TouchableOpacity onPress={hideToast} style={styles.closeButton}>
                    <Ionicons name="close" size={18} color={Colors.textTertiary} />
                </TouchableOpacity>
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
    toast: {
        width: SCREEN_WIDTH - Spacing.m * 2,
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: Spacing.m,
        paddingRight: Spacing.m,
        paddingLeft: 0,
        borderRadius: Layout.borderRadius.l,
        borderWidth: 1,
        overflow: 'hidden',
        ...Layout.shadow.lg,
        ...Platform.select({
            android: {
                elevation: 8,
            },
        }),
    },
    accentBar: {
        width: 4,
        height: '100%',
        position: 'absolute',
        left: 0,
        top: 0,
        bottom: 0,
        borderTopLeftRadius: Layout.borderRadius.l,
        borderBottomLeftRadius: Layout.borderRadius.l,
    },
    iconContainer: {
        width: 44,
        height: 44,
        borderRadius: Layout.borderRadius.m,
        justifyContent: 'center',
        alignItems: 'center',
        marginLeft: Spacing.m,
    },
    content: {
        flex: 1,
        marginLeft: Spacing.m,
    },
    title: {
        ...Typography.subtitle1,
        fontWeight: '700',
    },
    message: {
        ...Typography.body2,
        color: Colors.textSecondary,
        marginTop: 2,
    },
    closeButton: {
        padding: Spacing.xs,
        marginLeft: Spacing.s,
    },
});

export default Toast;
