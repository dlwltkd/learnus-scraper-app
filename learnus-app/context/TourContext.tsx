import React, {
    createContext,
    useContext,
    useState,
    useRef,
    useCallback,
    useImperativeHandle,
    forwardRef,
    ReactNode,
} from 'react';
import { View, InteractionManager } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const TOUR_STORAGE_KEY = 'tour_completed';

// ─── Step Types ──────────────────────────────────────────────────────────────

export type TourStepType = 'passive' | 'interactive';

export interface TourStep {
    id: string;
    navigation?: {
        tab?: 'Dashboard' | 'VideoLectures' | 'Courses' | 'Settings';
        screen?: string;
        params?: any;
    };
    targetRefKey: string;
    title: string;
    description: string;
    tooltipPosition: 'top' | 'bottom' | 'auto';
    type: TourStepType;
    delayMs?: number;
    borderRadius?: number;
    padding?: number;
    // Manual adjustments to the measured rect (in pixels)
    adjustY?: number;      // shift spotlight up (-) or down (+)
    adjustX?: number;      // shift spotlight left (-) or right (+)
    adjustWidth?: number;  // grow (+) or shrink (-) width
    adjustHeight?: number; // grow (+) or shrink (-) height
}

// ─── Step Definitions ────────────────────────────────────────────────────────

export const TOUR_STEPS: TourStep[] = [
    {
        id: 'dashboard-stats',
        navigation: { tab: 'Dashboard' },
        targetRefKey: 'dashboard-stats',
        title: '학습 현황',
        description: '과제, 놓친 강의 등 이번 주 학습 상태를 한눈에 확인할 수 있어요.',
        tooltipPosition: 'bottom',
        type: 'passive',
        borderRadius: 20,
        padding: 4,
    },
    {
        id: 'dashboard-ai-section',
        navigation: { tab: 'Dashboard' },
        targetRefKey: 'dashboard-ai-section',
        title: 'AI 브리핑',
        description: 'AI가 각 강의의 현재 상태를 분석해줘요. 긴급 과제, 다가오는 일정을 요약해서 보여줍니다.',
        tooltipPosition: 'bottom',
        type: 'passive',
        borderRadius: 16,
        padding: 4,
        id: 'courses-tab',
        navigation: { tab: 'Courses' },
        targetRefKey: 'courses-first-card',
        title: '내 강의실',
        description: '수강 중인 강의를 확인하고, 탭하면 상세 정보를 볼 수 있어요.',
        tooltipPosition: 'bottom',
        type: 'passive',
        delayMs: 500,
        borderRadius: 16,
        padding: 4,
    },
    {
        id: 'vod-sections',
        navigation: { tab: 'VideoLectures' },
        targetRefKey: 'vod-available-section',
        title: '강의 목록',
        description: '놓친 강의, 시청 가능 강의 등 상태별로 분류되어 있어요.',
        tooltipPosition: 'bottom',
        type: 'passive',
        delayMs: 500,
        borderRadius: 14,
        padding: 4,
    },
    {
        id: 'vod-watch-all',
        navigation: { tab: 'VideoLectures' },
        targetRefKey: 'vod-watch-all-btn',
        title: '모두 시청',
        description: '한 번의 탭으로 미시청 강의를 모두 자동 시청할 수 있어요!',
        tooltipPosition: 'bottom',
        type: 'passive',
        borderRadius: 20,
        padding: 4,
    },
    {
        id: 'vod-tap-item',
        navigation: { tab: 'VideoLectures' },
        targetRefKey: 'vod-first-item-menu',
        title: '메뉴를 탭해보세요!',
        description: '강의 옵션을 보려면 메뉴 버튼을 탭하세요.',
        tooltipPosition: 'bottom',
        type: 'interactive',
        borderRadius: 14,
        padding: 8,
    },
    {
        id: 'vod-action-sheet',
        targetRefKey: 'vod-action-sheet-area',
        title: '강의 옵션',
        description: '강의 시청, 자동 시청, AI 텍스트 추출을 여기서 선택할 수 있어요.',
        tooltipPosition: 'top',
        type: 'passive',
        delayMs: 600,
        borderRadius: 50,
        padding: 2000,
    },
];

// ─── Rect Type ───────────────────────────────────────────────────────────────

export interface TargetRect {
    x: number;
    y: number;
    width: number;
    height: number;
}

// ─── Context Type ────────────────────────────────────────────────────────────

interface TourContextType {
    isActive: boolean;
    currentStepIndex: number;
    currentStep: TourStep | null;
    totalSteps: number;
    targetRect: TargetRect | null;

    startTour: () => void;
    nextStep: () => void;
    skipTour: () => void;

    registerRef: (key: string, ref: React.RefObject<View>) => void;
    unregisterRef: (key: string) => void;

    notifyInteraction: (stepId: string) => void;

    measureTarget: () => void;
    registerOverlayRef: (ref: React.RefObject<View>) => void;

    navigationRef: React.RefObject<any> | null;
}

const TourContext = createContext<TourContextType | undefined>(undefined);

export const useTour = (): TourContextType => {
    const context = useContext(TourContext);
    if (!context) {
        return {
            isActive: false,
            currentStepIndex: 0,
            currentStep: null,
            totalSteps: TOUR_STEPS.length,
            targetRect: null,
            startTour: () => { },
            nextStep: () => { },
            skipTour: () => { },
            registerRef: () => { },
            unregisterRef: () => { },
            notifyInteraction: () => { },
            measureTarget: () => { },
            registerOverlayRef: () => { },
            navigationRef: null,
        };
    }
    return context;
};

// ─── Provider ────────────────────────────────────────────────────────────────

export interface TourProviderHandle {
    startTour: () => void;
}

interface TourProviderProps {
    children: ReactNode;
    navigationRef: React.RefObject<any>;
}

export const TourProvider = forwardRef<TourProviderHandle, TourProviderProps>(({ children, navigationRef }, ref) => {
    const [isActive, setIsActive] = useState(false);
    const [currentStepIndex, setCurrentStepIndex] = useState(0);
    const [targetRect, setTargetRect] = useState<TargetRect | null>(null);

    const refRegistry = useRef<Map<string, React.RefObject<View>>>(new Map());
    const retryCount = useRef(0);
    const measureTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

    const currentStep = isActive ? TOUR_STEPS[currentStepIndex] ?? null : null;

    const clearTimeouts = useCallback(() => {
        if (measureTimeout.current) {
            clearTimeout(measureTimeout.current);
            measureTimeout.current = null;
        }
    }, []);

    // Use a ref to track which step index we're measuring,
    // avoiding stale closure issues with state
    const activeStepIndex = useRef(0);

    // The overlay container ref, registered by TourOverlay
    const overlayRef = useRef<React.RefObject<View> | null>(null);

    const registerOverlayRef = useCallback((ref: React.RefObject<View>) => {
        overlayRef.current = ref;
    }, []);

    const skipToNext = useCallback((index: number) => {
        const nextIndex = index + 1;
        if (nextIndex >= TOUR_STEPS.length) {
            completeTourInternal();
        } else {
            setCurrentStepIndex(nextIndex);
            activeStepIndex.current = nextIndex;
            showStepInternal(nextIndex);
        }
    }, []);

    const measureTargetForIndex = useCallback((index: number) => {
        const step = TOUR_STEPS[index];
        if (!step) return;

        const ref = refRegistry.current.get(step.targetRefKey);
        if (!ref?.current) {
            if (retryCount.current < 5) {
                retryCount.current++;
                measureTimeout.current = setTimeout(() => {
                    requestAnimationFrame(() => measureTargetForIndex(index));
                }, 400);
            } else {
                skipToNext(index);
            }
            return;
        }

        InteractionManager.runAfterInteractions(() => {
            requestAnimationFrame(() => {
                // Measure target
                ref.current?.measureInWindow((tx, ty, tw, th) => {
                    if (tw <= 0 || th <= 0) {
                        if (retryCount.current < 5) {
                            retryCount.current++;
                            measureTimeout.current = setTimeout(() => measureTargetForIndex(index), 300);
                        } else {
                            skipToNext(index);
                        }
                        return;
                    }

                    // Apply manual adjustments from step config
                    const ax = step.adjustX || 0;
                    const ay = step.adjustY || 0;
                    const aw = step.adjustWidth || 0;
                    const ah = step.adjustHeight || 0;

                    // Measure overlay container to get offset
                    const oRef = overlayRef.current;
                    if (oRef?.current) {
                        oRef.current.measureInWindow((ox, oy) => {
                            setTargetRect({
                                x: tx - (ox || 0) + ax,
                                y: ty - (oy || 0) + ay,
                                width: tw + aw,
                                height: th + ah,
                            });
                            retryCount.current = 0;
                        });
                    } else {
                        setTargetRect({ x: tx + ax, y: ty + ay, width: tw + aw, height: th + ah });
                        retryCount.current = 0;
                    }
                });
            });
        });
    }, [skipToNext]);

    const navigateForStep = (step: TourStep) => {
        if (!step.navigation || !navigationRef.current) return;
        const nav = navigationRef.current;
        if (step.navigation.tab) {
            nav.navigate('Main', { screen: step.navigation.tab });
        } else if (step.navigation.screen) {
            nav.navigate(step.navigation.screen, step.navigation.params);
        }
    };

    const completeTourInternal = useCallback(() => {
        clearTimeouts();
        setIsActive(false);
        setCurrentStepIndex(0);
        activeStepIndex.current = 0;
        setTargetRect(null);
        AsyncStorage.setItem(TOUR_STORAGE_KEY, 'true');
    }, [clearTimeouts]);

    const showStepInternal = useCallback((index: number) => {
        const step = TOUR_STEPS[index];
        if (!step) {
            completeTourInternal();
            return;
        }

        setTargetRect(null);
        retryCount.current = 0;

        const needsNavigation = step.navigation?.tab || step.navigation?.screen;
        if (needsNavigation) {
            navigateForStep(step);
        }

        const delay = step.delayMs ?? (needsNavigation ? 400 : 200);
        measureTimeout.current = setTimeout(() => {
            requestAnimationFrame(() => measureTargetForIndex(index));
        }, delay);
    }, [completeTourInternal, measureTargetForIndex]);

    const startTour = useCallback(() => {
        setIsActive(true);
        setCurrentStepIndex(0);
        activeStepIndex.current = 0;
        showStepInternal(0);
    }, [showStepInternal]);

    useImperativeHandle(ref, () => ({
        startTour,
    }), [startTour]);

    const nextStep = useCallback(() => {
        clearTimeouts();
        const nextIndex = activeStepIndex.current + 1;
        if (nextIndex >= TOUR_STEPS.length) {
            completeTourInternal();
            return;
        }
        setCurrentStepIndex(nextIndex);
        activeStepIndex.current = nextIndex;
        showStepInternal(nextIndex);
    }, [clearTimeouts, completeTourInternal, showStepInternal]);

    const skipTour = useCallback(() => {
        completeTourInternal();
    }, [completeTourInternal]);

    const registerRef = useCallback((key: string, ref: React.RefObject<View>) => {
        refRegistry.current.set(key, ref);
    }, []);

    const unregisterRef = useCallback((key: string) => {
        refRegistry.current.delete(key);
    }, []);

    const notifyInteraction = useCallback((stepId: string) => {
        if (!isActive) return;
        const step = TOUR_STEPS[activeStepIndex.current];
        if (step && step.id === stepId && step.type === 'interactive') {
            setTimeout(() => nextStep(), 300);
        }
    }, [isActive, nextStep]);

    const value: TourContextType = {
        isActive,
        currentStepIndex,
        currentStep,
        totalSteps: TOUR_STEPS.length,
        targetRect,
        startTour,
        nextStep,
        skipTour,
        registerRef,
        unregisterRef,
        notifyInteraction,
        measureTarget: () => measureTargetForIndex(activeStepIndex.current),
        registerOverlayRef,
        navigationRef,
    };

    return (
        <TourContext.Provider value={value}>
            {children}
        </TourContext.Provider>
    );
});

export default TourContext;

// Helper to check if tour has been completed
export async function hasTourCompleted(): Promise<boolean> {
    const value = await AsyncStorage.getItem(TOUR_STORAGE_KEY);
    return value === 'true';
}

// Helper to reset tour (for testing / Settings screen)
export async function resetTour(): Promise<void> {
    await AsyncStorage.removeItem(TOUR_STORAGE_KEY);
}

// Helper to force-complete tour
export async function completeTourManually(): Promise<void> {
    await AsyncStorage.setItem(TOUR_STORAGE_KEY, 'true');
}
