import React, { useEffect, useRef, useState, useMemo } from 'react';
import {
    View,
    StyleSheet,
    Animated,
    TouchableWithoutFeedback,
    Dimensions,
} from 'react-native';
import { useTour, TargetRect } from '../context/TourContext';
import TourTooltip from './TourTooltip';
import { useTheme } from '../context/ThemeContext';
import { Spacing } from '../constants/theme';
import { type ColorScheme, type TypographyType, type LayoutType } from '../constants/theme';

const OVERLAY_COLOR = 'rgba(26, 29, 38, 0.72)';
const SPOTLIGHT_PADDING = 6;
const BORDER_SIZE = Math.max(Dimensions.get('window').width, Dimensions.get('window').height) * 2;

export default function TourOverlay() {
    const { colors, typography, layout, isDark } = useTheme();
    const styles = useMemo(() => createStyles(colors, typography, layout, isDark), [colors, typography, layout, isDark]);

    const {
        isActive,
        currentStep,
        currentStepIndex,
        totalSteps,
        targetRect,
        nextStep,
        skipTour,
        registerOverlayRef,
    } = useTour();

    const containerRef = useRef<View>(null);
    const opacity = useRef(new Animated.Value(0)).current;
    const [showTooltip, setShowTooltip] = useState(false);

    // Two display rects for crossfade
    const [rectA, setRectA] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
    const [rectB, setRectB] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
    const [activeSlot, setActiveSlot] = useState<'a' | 'b'>('a');
    const slotOpacity = useRef(new Animated.Value(1)).current;

    useEffect(() => {
        registerOverlayRef(containerRef as any);
    }, []);

    const containerHeight = useRef(0);
    const handleLayout = (e: any) => {
        containerHeight.current = e.nativeEvent.layout.height;
    };

    const isFirstStep = useRef(true);

    // Reset when tour ends or starts
    useEffect(() => {
        if (!isActive) {
            setShowTooltip(false);
            Animated.timing(opacity, {
                toValue: 0,
                duration: 200,
                useNativeDriver: true,
            }).start(() => {
                setRectA(null);
                setRectB(null);
                setActiveSlot('a');
                slotOpacity.setValue(1);
                opacity.setValue(0);
                isFirstStep.current = true;
            });
        } else {
            isFirstStep.current = true;
            opacity.setValue(0);
            slotOpacity.setValue(1);
            setRectA(null);
            setRectB(null);
            setActiveSlot('a');
            setShowTooltip(false);
        }
    }, [isActive]);

    // When targetRect goes null (step transition), fade out overlay
    useEffect(() => {
        if (!isActive) return;
        if (!targetRect) {
            setShowTooltip(false);
            Animated.timing(opacity, {
                toValue: 0,
                duration: 150,
                useNativeDriver: true,
            }).start();
            return;
        }

        const pad = currentStep?.padding ?? SPOTLIGHT_PADDING;
        const newRect = {
            x: targetRect.x - pad,
            y: targetRect.y - pad,
            w: targetRect.width + pad * 2,
            h: targetRect.height + pad * 2,
        };

        slotOpacity.setValue(1);
        setActiveSlot('a');
        setRectA(newRect);
        setRectB(null);
        isFirstStep.current = false;

        setTimeout(() => {
            Animated.timing(opacity, {
                toValue: 1,
                duration: 200,
                useNativeDriver: true,
            }).start(() => setShowTooltip(true));
        }, 30);
    }, [targetRect]);

    if (!isActive) return null;

    const isWelcome = currentStep?.id === 'welcome';
    const borderRadius = currentStep?.borderRadius ?? 14;
    const isInteractive = currentStep?.type === 'interactive';

    const pad = currentStep?.padding ?? SPOTLIGHT_PADDING;
    const tooltipRect: TargetRect | null = targetRect
        ? {
            x: targetRect.x - pad,
            y: targetRect.y - pad,
            width: targetRect.width + pad * 2,
            height: targetRect.height + pad * 2,
        }
        : null;

    // Welcome screen — uses same card style as TourTooltip
    if (isWelcome && targetRect) {
        return (
            <View ref={containerRef} style={styles.container} pointerEvents="box-none" collapsable={false} onLayout={handleLayout}>
                <Animated.View style={[styles.fullOverlay, styles.welcomeOverlay, { opacity }]} pointerEvents="auto">
                    <TourTooltip
                        step={{
                            ...currentStep!,
                            title: '앱 둘러보기',
                            description: '주요 기능을 빠르게 안내해드릴게요.',
                        }}
                        stepIndex={currentStepIndex}
                        totalSteps={totalSteps}
                        targetRect={{ x: 0, y: 0, width: 0, height: 0 }}
                        overlayHeight={containerHeight.current}
                        onNext={nextStep}
                        onSkip={skipTour}
                    />
                </Animated.View>
            </View>
        );
    }

    if (!rectA && !rectB) return (
        <View ref={containerRef} style={styles.container} pointerEvents="none" collapsable={false} onLayout={handleLayout} />
    );

    const renderSlot = (rect: { x: number; y: number; w: number; h: number } | null, slotOp: Animated.AnimatedInterpolation<number> | Animated.Value) => {
        if (!rect) return null;
        return (
            <Animated.View style={[styles.fullOverlay, { opacity: slotOp }]} pointerEvents="none">
                {/* Rounded cutout using large border technique */}
                <View
                    style={{
                        position: 'absolute',
                        top: rect.y - BORDER_SIZE,
                        left: rect.x - BORDER_SIZE,
                        width: rect.w + BORDER_SIZE * 2,
                        height: rect.h + BORDER_SIZE * 2,
                        borderWidth: BORDER_SIZE,
                        borderColor: OVERLAY_COLOR,
                        borderRadius: BORDER_SIZE + borderRadius,
                    }}
                />
                <View
                    style={[styles.spotlightBorder, {
                        top: rect.y, left: rect.x,
                        width: rect.w, height: rect.h,
                        borderRadius,
                    }]}
                />
            </Animated.View>
        );
    };

    const activeRect = activeSlot === 'a' ? rectA : rectB;
    const displayRect = activeRect || rectA || rectB;

    const opacityA = slotOpacity;
    const opacityB = slotOpacity.interpolate({ inputRange: [0, 1], outputRange: [1, 0] });

    return (
        <View ref={containerRef} style={styles.container} pointerEvents="box-none" collapsable={false} onLayout={handleLayout}>
            <Animated.View style={[styles.fullOverlay, { opacity }]} pointerEvents="box-none">
                {renderSlot(rectA, opacityA)}
                {renderSlot(rectB, opacityB)}

                {!isInteractive && displayRect && (
                    <View
                        style={{
                            position: 'absolute',
                            top: displayRect.y,
                            left: displayRect.x,
                            width: displayRect.w,
                            height: displayRect.h,
                        }}
                        pointerEvents="auto"
                    >
                        <TouchableWithoutFeedback onPress={nextStep}>
                            <View style={{ flex: 1 }} />
                        </TouchableWithoutFeedback>
                    </View>
                )}
            </Animated.View>

            {showTooltip && currentStep && tooltipRect && (
                <TourTooltip
                    step={currentStep}
                    stepIndex={currentStepIndex}
                    totalSteps={totalSteps}
                    targetRect={tooltipRect}
                    overlayHeight={containerHeight.current}
                    onNext={nextStep}
                    onSkip={skipTour}
                />
            )}
        </View>
    );
}

const createStyles = (colors: ColorScheme, typography: TypographyType, layout: LayoutType, isDark: boolean) => StyleSheet.create({
    container: {
        ...StyleSheet.absoluteFillObject,
        zIndex: 9999,
    },
    fullOverlay: {
        ...StyleSheet.absoluteFillObject,
    },
    spotlightBorder: {
        position: 'absolute',
        borderWidth: 2,
        borderColor: colors.primary,
        shadowColor: colors.primary,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.4,
        shadowRadius: 12,
    },
    welcomeOverlay: {
        backgroundColor: 'rgba(26, 29, 38, 0.75)',
        justifyContent: 'center',
        alignItems: 'center',
    },
});
