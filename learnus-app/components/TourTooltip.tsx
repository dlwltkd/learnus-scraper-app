import React, { useEffect, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Animated,
    Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Layout, Typography, Animation } from '../constants/theme';
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
    const scaleAnim = useRef(new Animated.Value(0.85)).current;
    const opacityAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        scaleAnim.setValue(0.85);
        opacityAnim.setValue(0);
        Animated.parallel([
            Animated.spring(scaleAnim, {
                toValue: 1,
                damping: 15,
                stiffness: 200,
                useNativeDriver: true,
            }),
            Animated.timing(opacityAnim, {
                toValue: 1,
                duration: Animation.duration.fast,
                useNativeDriver: true,
            }),
        ]).start();
    }, [step.id]);

    const containerHeight = overlayHeight || Dimensions.get('window').height;
    const tooltipWidth = Math.min(TOOLTIP_WIDTH, MAX_WIDTH);

    // Determine position
    const position = step.tooltipPosition === 'auto'
        ? (targetRect.y > containerHeight / 2 ? 'top' : 'bottom')
        : step.tooltipPosition;

    const isAbove = position === 'top';

    // Calculate tooltip left to center it, clamped to screen
    const centerX = targetRect.x + targetRect.width / 2;
    let tooltipLeft = centerX - tooltipWidth / 2;
    tooltipLeft = Math.max(16, Math.min(tooltipLeft, SCREEN_WIDTH - tooltipWidth - 16));

    // Arrow horizontal position relative to tooltip
    const arrowLeft = Math.max(20, Math.min(centerX - tooltipLeft - ARROW_SIZE, tooltipWidth - 40));

    const tooltipStyle: any = {
        position: 'absolute' as const,
        left: tooltipLeft,
        width: tooltipWidth,
    };

    if (isAbove) {
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
                    transform: [{ scale: scaleAnim }],
                    opacity: opacityAnim,
                },
            ]}
            pointerEvents="box-none"
        >
            {/* Arrow pointing toward target */}
            {!isAbove && (
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
                                color={Colors.primary}
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
            {isAbove && (
                <View style={[styles.arrowDown, { left: arrowLeft }]} />
            )}
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    card: {
        backgroundColor: Colors.surface,
        borderRadius: Layout.borderRadius.xl,
        overflow: 'hidden',
        ...Layout.shadow.xl,
    },
    accent: {
        height: 3,
        backgroundColor: Colors.primary,
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
        backgroundColor: Colors.primaryLighter,
        alignItems: 'center',
        justifyContent: 'center',
    },
    title: {
        ...Typography.header3,
        flex: 1,
    },
    description: {
        ...Typography.body2,
        color: Colors.textSecondary,
        lineHeight: 22,
    },
    footer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: Spacing.l,
        paddingVertical: Spacing.m,
        borderTopWidth: 1,
        borderTopColor: Colors.border,
        backgroundColor: Colors.surfaceHighlight,
    },
    dots: {
        flexDirection: 'row',
        gap: 6,
    },
    dot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: Colors.border,
    },
    dotActive: {
        width: 18,
        backgroundColor: Colors.primary,
        borderRadius: 3,
    },
    dotCompleted: {
        backgroundColor: Colors.primaryLight,
    },
    buttons: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.m,
    },
    skipText: {
        ...Typography.buttonSmall,
        color: Colors.textTertiary,
    },
    nextBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: Colors.primary,
        paddingHorizontal: Spacing.m,
        paddingVertical: Spacing.s,
        borderRadius: Layout.borderRadius.full,
    },
    nextText: {
        ...Typography.buttonSmall,
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
        borderBottomColor: Colors.primary,
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
        borderTopColor: Colors.surface,
        zIndex: 1,
    },
});
