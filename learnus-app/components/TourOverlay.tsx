import React, { useEffect, useRef } from 'react';
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
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const spotlightAnim = useRef({
        x: new Animated.Value(0),
        y: new Animated.Value(0),
        width: new Animated.Value(0),
        height: new Animated.Value(0),
    }).current;

    // Register the overlay container ref so TourContext can measure it
    useEffect(() => {
        registerOverlayRef(containerRef as any);
    }, []);

    // Track container height via onLayout (reliable, no async race)
    const containerHeight = useRef(0);
    const handleLayout = (e: any) => {
        containerHeight.current = e.nativeEvent.layout.height;
    };

    // Fade in/out
    useEffect(() => {
        Animated.timing(fadeAnim, {
            toValue: isActive ? 1 : 0,
            duration: 250,
            useNativeDriver: false,
        }).start();
    }, [isActive]);

    // Animate spotlight position
    useEffect(() => {
        if (!targetRect) return;
        const pad = currentStep?.padding ?? SPOTLIGHT_PADDING;
        Animated.parallel([
            Animated.spring(spotlightAnim.x, {
                toValue: targetRect.x - pad,
                damping: 20,
                stiffness: 200,
                useNativeDriver: false,
            }),
            Animated.spring(spotlightAnim.y, {
                toValue: targetRect.y - pad,
                damping: 20,
                stiffness: 200,
                useNativeDriver: false,
            }),
            Animated.spring(spotlightAnim.width, {
                toValue: targetRect.width + pad * 2,
                damping: 20,
                stiffness: 200,
                useNativeDriver: false,
            }),
            Animated.spring(spotlightAnim.height, {
                toValue: targetRect.height + pad * 2,
                damping: 20,
                stiffness: 200,
                useNativeDriver: false,
            }),
        ]).start();
    }, [targetRect]);

    if (!isActive) return null;

    const borderRadius = currentStep?.borderRadius ?? 14;
    const isInteractive = currentStep?.type === 'interactive';

    // Compute tooltip rect (with padding applied)
    const pad = currentStep?.padding ?? SPOTLIGHT_PADDING;
    const tooltipRect: TargetRect | null = targetRect
        ? {
            x: targetRect.x - pad,
            y: targetRect.y - pad,
            width: targetRect.width + pad * 2,
            height: targetRect.height + pad * 2,
        }
        : null;

    // Don't render overlay rects until we have a target
    if (!targetRect) return (
        <View ref={containerRef} style={styles.container} pointerEvents="none" collapsable={false} onLayout={handleLayout} />
    );

    return (
        <View ref={containerRef} style={styles.container} pointerEvents="box-none" collapsable={false} onLayout={handleLayout}>
            <Animated.View
                style={[styles.fullOverlay, { opacity: fadeAnim }]}
                pointerEvents="box-none"
            >
                {/* Top rect */}
                <Animated.View
                    style={[styles.overlayRect, { top: 0, left: 0, right: 0, height: spotlightAnim.y }]}
                    pointerEvents="auto"
                />
                {/* Bottom rect */}
                <Animated.View
                    style={[styles.overlayRect, {
                        top: Animated.add(spotlightAnim.y, spotlightAnim.height),
                        left: 0, right: 0, bottom: 0,
                    }]}
                    pointerEvents="auto"
                />
                {/* Left rect */}
                <Animated.View
                    style={[styles.overlayRect, {
                        top: spotlightAnim.y, left: 0,
                        width: spotlightAnim.x, height: spotlightAnim.height,
                    }]}
                    pointerEvents="auto"
                />
                {/* Right rect */}
                <Animated.View
                    style={[styles.overlayRect, {
                        top: spotlightAnim.y,
                        left: Animated.add(spotlightAnim.x, spotlightAnim.width),
                        right: 0, height: spotlightAnim.height,
                    }]}
                    pointerEvents="auto"
                />

                {/* Spotlight border glow */}
                <Animated.View
                    style={[styles.spotlightBorder, {
                        top: spotlightAnim.y, left: spotlightAnim.x,
                        width: spotlightAnim.width, height: spotlightAnim.height,
                        borderRadius,
                    }]}
                    pointerEvents="none"
                />

                {/* For passive steps: tap spotlight to advance */}
                {!isInteractive && (
                    <Animated.View
                        style={{
                            position: 'absolute',
                            top: spotlightAnim.y, left: spotlightAnim.x,
                            width: spotlightAnim.width, height: spotlightAnim.height,
                        }}
                        pointerEvents="auto"
                    >
                        <TouchableWithoutFeedback onPress={nextStep}>
                            <View style={{ flex: 1 }} />
                        </TouchableWithoutFeedback>
                    </Animated.View>
                )}
            </Animated.View>

            {/* Tooltip */}
            {currentStep && tooltipRect && (
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
