import React, { useRef, useEffect, useMemo } from 'react';
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
import { Spacing } from '../constants/theme';
import { useTheme } from '../context/ThemeContext';
import { type ColorScheme, type TypographyType, type LayoutType } from '../constants/theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface NotificationOnboardingProps {
    onEnable: () => void;
    onSkip: () => void;
}

export default function NotificationOnboarding({ onEnable, onSkip }: NotificationOnboardingProps) {
    const { colors, typography, layout, isDark } = useTheme();
    const styles = useMemo(() => createStyles(colors, typography, layout, isDark), [colors, typography, layout, isDark]);

    const FEATURES = [
        {
            icon: 'sparkles' as const,
            color: colors.tertiary,
            bg: colors.tertiaryLight,
            title: 'AI 공지 요약',
            description: '새 공지사항을 AI가 요약해서 알려줘요',
        },
        {
            icon: 'document-text-outline' as const,
            color: colors.primary,
            bg: colors.primaryLighter,
            title: '과제 마감 알림',
            description: '마감 전에 미리 알려드려요',
        },
        {
            icon: 'notifications-outline' as const,
            color: colors.success,
            bg: colors.successLight,
            title: '새로운 과제 · 강의',
            description: '새 과제나 강의가 등록되면 바로 알림',
        },
    ];

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
                    <Ionicons name="notifications" size={32} color={colors.primary} />
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
                    <Ionicons name="settings-outline" size={14} color={colors.textTertiary} />
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

const createStyles = (colors: ColorScheme, typography: TypographyType, layout: LayoutType, isDark: boolean) => StyleSheet.create({
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
        backgroundColor: colors.surface,
        borderTopLeftRadius: layout.borderRadius.xl,
        borderTopRightRadius: layout.borderRadius.xl,
        paddingHorizontal: Spacing.l,
        paddingTop: Spacing.xl,
        ...layout.shadow.xl,
    },
    iconCircle: {
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: colors.primaryLighter,
        alignItems: 'center',
        justifyContent: 'center',
        alignSelf: 'center',
        marginBottom: Spacing.m,
    },
    title: {
        ...typography.header2,
        textAlign: 'center',
        marginBottom: Spacing.s,
    },
    subtitle: {
        ...typography.body2,
        textAlign: 'center',
        color: colors.textSecondary,
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
        backgroundColor: colors.surfaceHighlight,
        padding: Spacing.m,
        borderRadius: layout.borderRadius.m,
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
        ...typography.subtitle2,
        color: colors.textPrimary,
        marginBottom: 2,
    },
    featureDesc: {
        ...typography.caption,
        color: colors.textSecondary,
    },
    hintRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        marginBottom: Spacing.l,
    },
    hintText: {
        ...typography.caption,
        color: colors.textTertiary,
    },
    enableBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        backgroundColor: colors.primary,
        paddingVertical: 16,
        borderRadius: layout.borderRadius.m,
        marginBottom: Spacing.s,
        ...layout.shadow.primary,
    },
    enableText: {
        ...typography.button,
        color: '#fff',
    },
    skipBtn: {
        paddingVertical: 14,
        alignItems: 'center',
    },
    skipText: {
        ...typography.body2,
        color: colors.textTertiary,
        fontWeight: '500',
    },
});
