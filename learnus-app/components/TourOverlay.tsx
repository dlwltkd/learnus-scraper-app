import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
    View,
    StyleSheet,
    Animated,
    TouchableWithoutFeedback,
} from 'react-native';
import { useTour, TargetRect } from '../context/TourContext';
import TourTooltip from './TourTooltip';
import { Colors } from '../constants/theme';

const OVERLAY_COLOR = 'rgba(26, 29, 38, 0.72)';
const SPOTLIGHT_PADDING = 6;

export default function TourOverlay() {
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
    const slotOpacity = useRef(new Animated.Value(1)).current; // 1 = show A, 0 = show B

    useEffect(() => {
        registerOverlayRef(containerRef as any);
    }, []);

    const containerHeight = useRef(0);
    const handleLayout = (e: any) => {
        containerHeight.current = e.nativeEvent.layout.height;
    };

    // Fade out when tour ends
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
            });
        }
    }, [isActive]);

    const isFirstStep = useRef(true);
    useEffect(() => {
        if (!isActive) {
            isFirstStep.current = true;
            return;
        }
    }, [isActive]);

    useEffect(() => {
        if (!targetRect || !isActive) return;

        const pad = currentStep?.padding ?? SPOTLIGHT_PADDING;
        const newRect = {
            x: targetRect.x - pad,
            y: targetRect.y - pad,
            w: targetRect.width + pad * 2,
            h: targetRect.height + pad * 2,
        };

        if (isFirstStep.current) {
            // First step: put rect in slot A, then fade whole overlay in
            isFirstStep.current = false;
            opacity.setValue(0);
            slotOpacity.setValue(1);
            setActiveSlot('a');
            setRectA(newRect);
            setShowTooltip(false);

            // Wait for layout to commit
            setTimeout(() => {
                Animated.timing(opacity, {
                    toValue: 1,
                    duration: 400,
                    useNativeDriver: true,
                }).start(() => setShowTooltip(true));
            }, 50);
        } else {
            // Subsequent steps: crossfade between slots
            setShowTooltip(false);
            const nextSlot = activeSlot === 'a' ? 'b' : 'a';

            // Set new rect in inactive slot
            if (nextSlot === 'a') {
                setRectA(newRect);
            } else {
                setRectB(newRect);
            }

            // Crossfade
            setTimeout(() => {
                Animated.timing(slotOpacity, {
                    toValue: nextSlot === 'a' ? 1 : 0,
                    duration: 300,
                    useNativeDriver: true,
                }).start(() => {
                    setActiveSlot(nextSlot);
                    setShowTooltip(true);
                });
            }, 30);
        }
    }, [targetRect]);

    if (!isActive) return null;

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

    if (!rectA && !rectB) return (
        <View ref={containerRef} style={styles.container} pointerEvents="none" collapsable={false} onLayout={handleLayout} />
    );

    const renderSlot = (rect: { x: number; y: number; w: number; h: number } | null, slotOp: Animated.AnimatedInterpolation<number> | Animated.Value) => {
        if (!rect) return null;
        return (
            <Animated.View style={[styles.fullOverlay, { opacity: slotOp }]} pointerEvents="none">
                <View style={[styles.overlayRect, { top: 0, left: 0, right: 0, height: rect.y }]} />
                <View style={[styles.overlayRect, { top: rect.y + rect.h, left: 0, right: 0, bottom: 0 }]} />
                <View style={[styles.overlayRect, { top: rect.y, left: 0, width: rect.x, height: rect.h }]} />
                <View style={[styles.overlayRect, { top: rect.y, left: rect.x + rect.w, right: 0, height: rect.h }]} />
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

    // Active rect for touch target
    const activeRect = activeSlot === 'a' ? rectA : rectB;
    const displayRect = activeRect || rectA || rectB;

    // Interpolate slot opacities
    const opacityA = slotOpacity;
    const opacityB = slotOpacity.interpolate({ inputRange: [0, 1], outputRange: [1, 0] });

    return (
        <View ref={containerRef} style={styles.container} pointerEvents="box-none" collapsable={false} onLayout={handleLayout}>
            <Animated.View style={[styles.fullOverlay, { opacity }]} pointerEvents="box-none">
                {renderSlot(rectA, opacityA)}
                {renderSlot(rectB, opacityB)}

                {/* Touch target on active rect */}
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

            {/* Tooltip */}
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

const styles = StyleSheet.create({
    container: {
        ...StyleSheet.absoluteFillObject,
        zIndex: 9999,
    },
    fullOverlay: {
        ...StyleSheet.absoluteFillObject,
    },
    overlayRect: {
        position: 'absolute',
        backgroundColor: OVERLAY_COLOR,
    },
    spotlightBorder: {
        position: 'absolute',
        borderWidth: 2,
        borderColor: Colors.primary,
        shadowColor: Colors.primary,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.4,
        shadowRadius: 12,
    },
});
