import React, { useEffect, useRef, useMemo } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Animated,
    Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Spacing, Animation } from '../constants/theme';
import { useTheme } from '../context/ThemeContext';
import { type ColorScheme, type TypographyType, type LayoutType } from '../constants/theme';
import { TourStep } from '../context/TourContext';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const TOOLTIP_WIDTH = SCREEN_WIDTH - 48;
const MAX_WIDTH = 360;
const ARROW_SIZE = 10;

interface TourTooltipProps {
    step: TourStep;
    stepIndex: number;
    totalSteps: number;
    targetRect: { x: number; y: number; width: number; height: number };
    overlayHeight: number;
    onNext: () => void;
    onSkip: () => void;
}

export default function TourTooltip({
    step,
    stepIndex,
    totalSteps,
    targetRect,
    overlayHeight,
    onNext,
    onSkip,
}: TourTooltipProps) {
    const { colors, typography, layout, isDark } = useTheme();
    const styles = useMemo(() => createStyles(colors, typography, layout, isDark), [colors, typography, layout, isDark]);

    const scaleAnim = useRef(new Animated.Value(0.92)).current;
    const opacityAnim = useRef(new Animated.Value(0)).current;
    const translateYAnim = useRef(new Animated.Value(8)).current;

    useEffect(() => {
        scaleAnim.setValue(0.92);
        opacityAnim.setValue(0);
        translateYAnim.setValue(8);
        Animated.parallel([
            Animated.spring(scaleAnim, {
                toValue: 1,
                damping: 20,
                stiffness: 300,
                mass: 0.8,
                useNativeDriver: true,
            }),
            Animated.spring(translateYAnim, {
                toValue: 0,
                damping: 20,
                stiffness: 300,
                mass: 0.8,
                useNativeDriver: true,
            }),
            Animated.timing(opacityAnim, {
                toValue: 1,
                duration: 200,
                useNativeDriver: true,
            }),
        ]).start();
    }, [step.id]);

    const containerHeight = overlayHeight || Dimensions.get('window').height;
    const tooltipWidth = Math.min(TOOLTIP_WIDTH, MAX_WIDTH);
    const insets = useSafeAreaInsets();
    const TAB_BAR_HEIGHT = 64;

    const isCentered = step.tooltipPosition === 'center';
    const isAboveTabBar = step.tooltipPosition === 'aboveTabBar';

    // Determine position
    const position = step.tooltipPosition === 'auto'
        ? (targetRect.y > containerHeight / 2 ? 'top' : 'bottom')
        : step.tooltipPosition;

    const isAbove = position === 'top';

    // Calculate tooltip left to center it, clamped to screen
    const centerX = (isCentered || isAboveTabBar)
        ? SCREEN_WIDTH / 2
        : targetRect.x + targetRect.width / 2;
    let tooltipLeft = centerX - tooltipWidth / 2;
    tooltipLeft = Math.max(16, Math.min(tooltipLeft, SCREEN_WIDTH - tooltipWidth - 16));

    // Arrow horizontal position relative to tooltip
    const arrowLeft = Math.max(20, Math.min(centerX - tooltipLeft - ARROW_SIZE, tooltipWidth - 40));

    const tooltipStyle: any = {
        position: 'absolute' as const,
        left: tooltipLeft,
        width: tooltipWidth,
    };

    if (isAboveTabBar) {
        tooltipStyle.bottom = TAB_BAR_HEIGHT + insets.bottom + 12;
    } else if (isCentered) {
        tooltipStyle.top = containerHeight / 2 - 80;
    } else if (isAbove) {
        tooltipStyle.bottom = containerHeight - targetRect.y + 12;
    } else {
        tooltipStyle.top = targetRect.y + targetRect.height + 12;
    }

    const isLastStep = stepIndex === totalSteps - 1;
    const isInteractive = step.type === 'interactive';

    return (
        <Animated.View
            style={[
                tooltipStyle,
                {
                    transform: [{ scale: scaleAnim }, { translateY: translateYAnim }],
                    opacity: opacityAnim,
                },
            ]}
            pointerEvents="box-none"
        >
            {/* Arrow pointing toward target */}
            {!isAbove && !isCentered && !isAboveTabBar && (
                <View style={[styles.arrowUp, { left: arrowLeft }]} />
            )}

            <View style={styles.card}>
                {/* Top accent */}
                <View style={styles.accent} />

                {/* Content */}
                <View style={styles.content}>
                    <View style={styles.titleRow}>
                        <View style={styles.iconWrap}>
                            <Ionicons
                                name={isInteractive ? 'hand-left' : 'bulb'}
                                size={16}
                                color={colors.primary}
                            />
                        </View>
                        <Text style={styles.title}>{step.title}</Text>
                    </View>
                    <Text style={styles.description}>{step.description}</Text>
                </View>

                {/* Footer */}
                <View style={styles.footer}>
                    {/* Step dots */}
                    <View style={styles.dots}>
                        {Array.from({ length: totalSteps }).map((_, i) => (
                            <View
                                key={i}
                                style={[
                                    styles.dot,
                                    i === stepIndex && styles.dotActive,
                                    i < stepIndex && styles.dotCompleted,
                                ]}
                            />
                        ))}
                    </View>

                    {/* Buttons */}
                    <View style={styles.buttons}>
                        <TouchableOpacity onPress={onSkip} activeOpacity={0.7}>
                            <Text style={styles.skipText}>건너뛰기</Text>
                        </TouchableOpacity>

                        {!isInteractive && (
                            <TouchableOpacity
                                style={styles.nextBtn}
                                onPress={onNext}
                                activeOpacity={0.8}
                            >
                                <Text style={styles.nextText}>
                                    {isLastStep ? '완료' : '다음'}
                                </Text>
                                {!isLastStep && (
                                    <Ionicons name="arrow-forward" size={14} color="#fff" />
                                )}
                            </TouchableOpacity>
                        )}
                    </View>
                </View>
            </View>

            {/* Arrow below card */}
            {isAbove && !isCentered && !isAboveTabBar && (
                <View style={[styles.arrowDown, { left: arrowLeft }]} />
            )}
        </Animated.View>
    );
}

const createStyles = (colors: ColorScheme, typography: TypographyType, layout: LayoutType, isDark: boolean) => StyleSheet.create({
    card: {
        backgroundColor: colors.surface,
        borderRadius: layout.borderRadius.xl,
        overflow: 'hidden',
        ...layout.shadow.xl,
    },
    accent: {
        height: 3,
        backgroundColor: colors.primary,
    },
    content: {
        paddingHorizontal: Spacing.l,
        paddingTop: Spacing.l,
        paddingBottom: Spacing.m,
    },
    titleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.s,
        marginBottom: Spacing.s,
    },
    iconWrap: {
        width: 28,
        height: 28,
        borderRadius: 8,
        backgroundColor: colors.primaryLighter,
        alignItems: 'center',
        justifyContent: 'center',
    },
    title: {
        ...typography.header3,
        flex: 1,
    },
    description: {
        ...typography.body2,
        color: colors.textSecondary,
        lineHeight: 22,
    },
    footer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: Spacing.l,
        paddingVertical: Spacing.m,
        borderTopWidth: 1,
        borderTopColor: colors.border,
        backgroundColor: colors.surfaceHighlight,
    },
    dots: {
        flexDirection: 'row',
        gap: 6,
    },
    dot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: colors.border,
    },
    dotActive: {
        width: 18,
        backgroundColor: colors.primary,
        borderRadius: 3,
    },
    dotCompleted: {
        backgroundColor: colors.primaryLight,
    },
    buttons: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.m,
    },
    skipText: {
        ...typography.buttonSmall,
        color: colors.textTertiary,
    },
    nextBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: colors.primary,
        paddingHorizontal: Spacing.m,
        paddingVertical: Spacing.s,
        borderRadius: layout.borderRadius.full,
    },
    nextText: {
        ...typography.buttonSmall,
        color: '#fff',
    },
    arrowUp: {
        position: 'absolute',
        top: -ARROW_SIZE + 1,
        width: 0,
        height: 0,
        borderLeftWidth: ARROW_SIZE,
        borderRightWidth: ARROW_SIZE,
        borderBottomWidth: ARROW_SIZE,
        borderLeftColor: 'transparent',
        borderRightColor: 'transparent',
        borderBottomColor: colors.primary,
        zIndex: 1,
    },
    arrowDown: {
        position: 'absolute',
        bottom: -ARROW_SIZE + 1,
        width: 0,
        height: 0,
        borderLeftWidth: ARROW_SIZE,
        borderRightWidth: ARROW_SIZE,
        borderTopWidth: ARROW_SIZE,
        borderLeftColor: 'transparent',
        borderRightColor: 'transparent',
        borderTopColor: colors.surface,
        zIndex: 1,
    },
});
