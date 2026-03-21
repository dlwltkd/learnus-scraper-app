import React, { useRef, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Animated,
    Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Spacing, Layout, Typography } from '../constants/theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface NotificationOnboardingProps {
    onEnable: () => void;
    onSkip: () => void;
}

const FEATURES = [
    {
        icon: 'sparkles' as const,
        color: Colors.tertiary,
        bg: Colors.tertiaryLight,
        title: 'AI 공지 요약',
        description: '새 공지사항을 AI가 요약해서 알려줘요',
    },
    {
        icon: 'document-text-outline' as const,
        color: Colors.primary,
        bg: Colors.primaryLighter,
        title: '과제 마감 알림',
        description: '마감 전에 미리 알려드려요',
    },
    {
        icon: 'notifications-outline' as const,
        color: Colors.success,
        bg: Colors.successLight,
        title: '새로운 과제 · 강의',
        description: '새 과제나 강의가 등록되면 바로 알림',
    },
];

export default function NotificationOnboarding({ onEnable, onSkip }: NotificationOnboardingProps) {
    const insets = useSafeAreaInsets();
    const fadeIn = useRef(new Animated.Value(0)).current;
    const slideUp = useRef(new Animated.Value(40)).current;
    const featureAnims = useRef(FEATURES.map(() => new Animated.Value(0))).current;
    const featureSlides = useRef(FEATURES.map(() => new Animated.Value(24))).current;

    useEffect(() => {
        // Main card fade in
        Animated.parallel([
            Animated.timing(fadeIn, {
                toValue: 1,
                duration: 400,
                useNativeDriver: true,
            }),
            Animated.timing(slideUp, {
                toValue: 0,
                duration: 400,
                useNativeDriver: true,
            }),
        ]).start(() => {
            // Stagger feature items
            const featureAnimations = FEATURES.map((_, i) =>
                Animated.parallel([
                    Animated.timing(featureAnims[i], {
                        toValue: 1,
                        duration: 300,
                        useNativeDriver: true,
                    }),
                    Animated.timing(featureSlides[i], {
                        toValue: 0,
                        duration: 300,
                        useNativeDriver: true,
                    }),
                ])
            );
            Animated.stagger(100, featureAnimations).start();
        });
    }, []);

    return (
        <View style={styles.overlay}>
            <Animated.View
                style={[
                    styles.backdrop,
                    { opacity: fadeIn },
                ]}
            />
            <Animated.View
                style={[
                    styles.card,
                    {
                        opacity: fadeIn,
                        transform: [{ translateY: slideUp }],
                        paddingBottom: Math.max(insets.bottom, 24),
                    },
                ]}
            >
                {/* Bell icon */}
                <View style={styles.iconCircle}>
                    <Ionicons name="notifications" size={32} color={Colors.primary} />
                </View>

                <Text style={styles.title}>알림을 켜볼까요?</Text>
                <Text style={styles.subtitle}>
                    중요한 학습 정보를 놓치지 않도록{'\n'}알림으로 알려드릴게요
                </Text>

                {/* Feature list */}
                <View style={styles.features}>
                    {FEATURES.map((feature, i) => (
                        <Animated.View
                            key={feature.title}
                            style={[
                                styles.featureRow,
                                {
                                    opacity: featureAnims[i],
                                    transform: [{ translateY: featureSlides[i] }],
                                },
                            ]}
                        >
                            <View style={[styles.featureIcon, { backgroundColor: feature.bg }]}>
                                <Ionicons name={feature.icon} size={20} color={feature.color} />
                            </View>
                            <View style={styles.featureText}>
                                <Text style={styles.featureTitle}>{feature.title}</Text>
                                <Text style={styles.featureDesc}>{feature.description}</Text>
                            </View>
                        </Animated.View>
                    ))}
                </View>

                {/* Settings hint */}
                <View style={styles.hintRow}>
                    <Ionicons name="settings-outline" size={14} color={Colors.textTertiary} />
                    <Text style={styles.hintText}>설정에서 언제든 변경할 수 있어요</Text>
                </View>

                {/* Buttons */}
                <TouchableOpacity
                    style={styles.enableBtn}
                    onPress={onEnable}
                    activeOpacity={0.8}
                >
                    <Ionicons name="notifications" size={18} color="#fff" />
                    <Text style={styles.enableText}>알림 허용하기</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={styles.skipBtn}
                    onPress={onSkip}
                    activeOpacity={0.7}
                >
                    <Text style={styles.skipText}>나중에 할게요</Text>
                </TouchableOpacity>
            </Animated.View>
        </View>
    );
}

const styles = StyleSheet.create({
    overlay: {
        ...StyleSheet.absoluteFillObject,
        zIndex: 10000,
        justifyContent: 'flex-end',
    },
    backdrop: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(26, 29, 38, 0.6)',
    },
    card: {
        backgroundColor: Colors.surface,
        borderTopLeftRadius: Layout.borderRadius.xl,
        borderTopRightRadius: Layout.borderRadius.xl,
        paddingHorizontal: Spacing.l,
        paddingTop: Spacing.xl,
        ...Layout.shadow.xl,
    },
    iconCircle: {
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: Colors.primaryLighter,
        alignItems: 'center',
        justifyContent: 'center',
        alignSelf: 'center',
        marginBottom: Spacing.m,
    },
    title: {
        ...Typography.header2,
        textAlign: 'center',
        marginBottom: Spacing.s,
    },
    subtitle: {
        ...Typography.body2,
        textAlign: 'center',
        color: Colors.textSecondary,
        lineHeight: 22,
        marginBottom: Spacing.l,
    },
    features: {
        gap: 12,
        marginBottom: Spacing.l,
    },
    featureRow: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: Colors.surfaceHighlight,
        padding: Spacing.m,
        borderRadius: Layout.borderRadius.m,
        gap: Spacing.m,
    },
    featureIcon: {
        width: 40,
        height: 40,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    featureText: {
        flex: 1,
    },
    featureTitle: {
        ...Typography.subtitle2,
        color: Colors.textPrimary,
        marginBottom: 2,
    },
    featureDesc: {
        ...Typography.caption,
        color: Colors.textSecondary,
    },
    hintRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        marginBottom: Spacing.l,
    },
    hintText: {
        ...Typography.caption,
        color: Colors.textTertiary,
    },
    enableBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        backgroundColor: Colors.primary,
        paddingVertical: 16,
        borderRadius: Layout.borderRadius.m,
        marginBottom: Spacing.s,
        ...Layout.shadow.primary,
    },
    enableText: {
        ...Typography.button,
        color: '#fff',
    },
    skipBtn: {
        paddingVertical: 14,
        alignItems: 'center',
    },
    skipText: {
        ...Typography.body2,
        color: Colors.textTertiary,
        fontWeight: '500',
    },
});
