import React, { useEffect, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Modal,
    Animated,
    TouchableOpacity,
    TouchableWithoutFeedback,
    Dimensions,
    Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Layout, Spacing, Animation } from '../constants/theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export interface AlertButton {
    text: string;
    style?: 'default' | 'cancel' | 'destructive';
    onPress?: () => void;
}

export type AlertType = 'info' | 'success' | 'warning' | 'error' | 'confirm';

interface CustomAlertProps {
    visible: boolean;
    type?: AlertType;
    title: string;
    message?: string;
    buttons?: AlertButton[];
    onDismiss: () => void;
}

const ALERT_CONFIG = {
    info: {
        icon: 'information-circle' as const,
        color: Colors.primary,
        bgColor: Colors.primaryLighter,
    },
    success: {
        icon: 'checkmark-circle' as const,
        color: Colors.success,
        bgColor: Colors.successLight,
    },
    warning: {
        icon: 'warning' as const,
        color: Colors.warning,
        bgColor: Colors.warningLight,
    },
    error: {
        icon: 'close-circle' as const,
        color: Colors.error,
        bgColor: Colors.errorLight,
    },
    confirm: {
        icon: 'help-circle' as const,
        color: Colors.secondary,
        bgColor: Colors.secondaryLight,
    },
};

const CustomAlert: React.FC<CustomAlertProps> = ({
    visible,
    type = 'info',
    title,
    message,
    buttons = [{ text: '확인', style: 'default' }],
    onDismiss,
}) => {
    const scale = useRef(new Animated.Value(0.8)).current;
    const opacity = useRef(new Animated.Value(0)).current;
    const backdropOpacity = useRef(new Animated.Value(0)).current;

    const config = ALERT_CONFIG[type];

    useEffect(() => {
        if (visible) {
            Animated.parallel([
                Animated.spring(scale, {
                    toValue: 1,
                    damping: 15,
                    stiffness: 200,
                    useNativeDriver: true,
                }),
                Animated.timing(opacity, {
                    toValue: 1,
                    duration: Animation.duration.fast,
                    useNativeDriver: true,
                }),
                Animated.timing(backdropOpacity, {
                    toValue: 1,
                    duration: Animation.duration.normal,
                    useNativeDriver: true,
                }),
            ]).start();
        } else {
            Animated.parallel([
                Animated.timing(scale, {
                    toValue: 0.8,
                    duration: Animation.duration.fast,
                    useNativeDriver: true,
                }),
                Animated.timing(opacity, {
                    toValue: 0,
                    duration: Animation.duration.fast,
                    useNativeDriver: true,
                }),
                Animated.timing(backdropOpacity, {
                    toValue: 0,
                    duration: Animation.duration.fast,
                    useNativeDriver: true,
                }),
            ]).start();
        }
    }, [visible]);

    const handleButtonPress = (button: AlertButton) => {
        onDismiss();
        if (button.onPress) {
            // Small delay to let the modal close animation start
            setTimeout(() => button.onPress?.(), 100);
        }
    };

    const getButtonStyle = (style?: 'default' | 'cancel' | 'destructive') => {
        switch (style) {
            case 'destructive':
                return {
                    backgroundColor: Colors.error,
                    textColor: Colors.textInverse,
                };
            case 'cancel':
                return {
                    backgroundColor: Colors.surfaceMuted,
                    textColor: Colors.textSecondary,
                };
            default:
                return {
                    backgroundColor: Colors.primary,
                    textColor: Colors.textInverse,
                };
        }
    };

    return (
        <Modal
            visible={visible}
            transparent
            animationType="none"
            statusBarTranslucent
            onRequestClose={onDismiss}
        >
            <TouchableWithoutFeedback onPress={onDismiss}>
                <View style={styles.backdrop}>
                    <Animated.View
                        style={[
                            styles.backdropOverlay,
                            { opacity: backdropOpacity },
                        ]}
                    />

                    <TouchableWithoutFeedback>
                        <Animated.View
                            style={[
                                styles.alertContainer,
                                {
                                    transform: [{ scale }],
                                    opacity,
                                },
                            ]}
                        >
                            {/* Top accent gradient */}
                            <View style={[styles.topAccent, { backgroundColor: config.color }]} />

                            {/* Icon circle */}
                            <View style={[styles.iconWrapper, { backgroundColor: config.bgColor }]}>
                                <Ionicons name={config.icon} size={36} color={config.color} />
                            </View>

                            {/* Content */}
                            <View style={styles.content}>
                                <Text style={styles.title}>{title}</Text>
                                {message && (
                                    <Text style={styles.message}>{message}</Text>
                                )}
                            </View>

                            {/* Buttons */}
                            <View style={[
                                styles.buttonContainer,
                                buttons.length === 1 && styles.buttonContainerSingle,
                            ]}>
                                {buttons.map((button, index) => {
                                    const buttonStyle = getButtonStyle(button.style);
                                    const isLast = index === buttons.length - 1;

                                    return (
                                        <TouchableOpacity
                                            key={index}
                                            style={[
                                                styles.button,
                                                { backgroundColor: buttonStyle.backgroundColor },
                                                buttons.length > 1 && styles.buttonMultiple,
                                                buttons.length > 1 && !isLast && styles.buttonWithMargin,
                                            ]}
                                            onPress={() => handleButtonPress(button)}
                                            activeOpacity={0.8}
                                        >
                                            <Text
                                                style={[
                                                    styles.buttonText,
                                                    { color: buttonStyle.textColor },
                                                ]}
                                            >
                                                {button.text}
                                            </Text>
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>
                        </Animated.View>
                    </TouchableWithoutFeedback>
                </View>
            </TouchableWithoutFeedback>
        </Modal>
    );
};

const styles = StyleSheet.create({
    backdrop: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    backdropOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(26, 29, 38, 0.6)',
    },
    alertContainer: {
        width: SCREEN_WIDTH - 48,
        maxWidth: 340,
        backgroundColor: Colors.surface,
        borderRadius: Layout.borderRadius.xl,
        overflow: 'hidden',
        ...Layout.shadow.xl,
        ...Platform.select({
            android: {
                elevation: 12,
            },
        }),
    },
    topAccent: {
        height: 4,
        width: '100%',
    },
    iconWrapper: {
        width: 72,
        height: 72,
        borderRadius: 36,
        justifyContent: 'center',
        alignItems: 'center',
        alignSelf: 'center',
        marginTop: Spacing.xl,
        marginBottom: Spacing.m,
    },
    content: {
        paddingHorizontal: Spacing.xl,
        paddingBottom: Spacing.l,
    },
    title: {
        ...Typography.header3,
        textAlign: 'center',
        marginBottom: Spacing.s,
    },
    message: {
        ...Typography.body2,
        textAlign: 'center',
        color: Colors.textSecondary,
        lineHeight: 22,
    },
    buttonContainer: {
        flexDirection: 'row',
        padding: Spacing.m,
        borderTopWidth: 1,
        borderTopColor: Colors.border,
        backgroundColor: Colors.surfaceHighlight,
    },
    buttonContainerSingle: {
        justifyContent: 'center',
    },
    button: {
        paddingVertical: Spacing.m,
        paddingHorizontal: Spacing.xl,
        borderRadius: Layout.borderRadius.m,
        minWidth: 100,
        alignItems: 'center',
        justifyContent: 'center',
    },
    buttonMultiple: {
        flex: 1,
    },
    buttonWithMargin: {
        marginRight: Spacing.s,
    },
    buttonText: {
        ...Typography.button,
        fontWeight: '600',
    },
});

export default CustomAlert;
