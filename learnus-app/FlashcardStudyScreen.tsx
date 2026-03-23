import React, { useState, useRef, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Animated,
    Easing,
    PanResponder,
    Dimensions,
    TouchableOpacity,
    TextInput,
    Modal,
    SafeAreaView,
    StatusBar,
    Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useThemeStyles } from './hooks/useThemeStyles';
import { useToast } from './context/ToastContext';
import { saveFlashcardDeck } from './services/api';
import type { FlashcardCard } from './services/api';
import { Spacing } from './constants/theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const SWIPE_THRESHOLD = 80;
const CARD_MARGIN = Spacing.screenPadding;
const CARD_GAP = 20;

interface FlashcardStudyParams {
    cards: FlashcardCard[];
    deckName: string;
    vodMoodleId?: number;
    deckId?: number;
    isPreview?: boolean;
    courseName?: string;
}

export default function FlashcardStudyScreen({ route, navigation }: any) {
    const params = route.params as FlashcardStudyParams;
    const { cards, deckName, vodMoodleId, isPreview, courseName } = params;

    const [currentIndex, setCurrentIndex] = useState(0);
    const [isFlipped, setIsFlipped] = useState(false);
    const [saveModalVisible, setSaveModalVisible] = useState(false);
    const [saveName, setSaveName] = useState(deckName);
    const [saving, setSaving] = useState(false);

    const flipAnim = useRef(new Animated.Value(0)).current;
    // panX is an absolute scroll position: 0 = card 0, -slideDistance = card 1, etc.
    const cardWidth = SCREEN_WIDTH - CARD_MARGIN * 2;
    const slideDistance = cardWidth + CARD_GAP;
    const panX = useRef(new Animated.Value(0)).current;
    const { showSuccess, showError } = useToast();
    const styles = useThemeStyles(createStyles);

    const indexRef = useRef(0);
    const flippedRef = useRef(false);
    const animatingRef = useRef(false);
    const isSwiping = useRef(false);

    const panResponder = useRef(
        PanResponder.create({
            onStartShouldSetPanResponder: () => true,
            onMoveShouldSetPanResponder: () => true,
            onPanResponderGrant: () => {
                isSwiping.current = false;
            },
            onPanResponderMove: (_, gs) => {
                if (animatingRef.current) return;
                if (Math.abs(gs.dx) > 5) {
                    isSwiping.current = true;
                }
                if (isSwiping.current) {
                    const base = -indexRef.current * slideDistance;
                    panX.setValue(base + gs.dx);
                }
            },
            onPanResponderRelease: (_, gs) => {
                if (animatingRef.current) return;
                const idx = indexRef.current;

                if (!isSwiping.current) {
                    // Tap — flip the card
                    const toValue = flippedRef.current ? 0 : 1;
                    Animated.timing(flipAnim, {
                        toValue,
                        duration: 300,
                        easing: Easing.out(Easing.quad),
                        useNativeDriver: true,
                    }).start();
                    flippedRef.current = !flippedRef.current;
                    setIsFlipped(flippedRef.current);
                    return;
                }

                let targetIdx = idx;
                if (gs.dx > SWIPE_THRESHOLD && idx > 0) {
                    targetIdx = idx - 1;
                } else if (gs.dx < -SWIPE_THRESHOLD && idx < cards.length - 1) {
                    targetIdx = idx + 1;
                }

                if (targetIdx !== idx) {
                    animatingRef.current = true;
                    // Reset flip for new card
                    flipAnim.setValue(0);
                    flippedRef.current = false;
                    indexRef.current = targetIdx;
                    setIsFlipped(false);
                    setCurrentIndex(targetIdx);

                    Animated.timing(panX, {
                        toValue: -targetIdx * slideDistance,
                        duration: 250,
                        easing: Easing.out(Easing.cubic),
                        useNativeDriver: false,
                    }).start(() => {
                        animatingRef.current = false;
                    });
                } else {
                    // Snap back
                    Animated.spring(panX, {
                        toValue: -idx * slideDistance,
                        useNativeDriver: false,
                        tension: 40,
                        friction: 7,
                    }).start();
                }
            },
        })
    ).current;

    // Flip interpolations
    const frontRotate = flipAnim.interpolate({
        inputRange: [0, 0.5, 1],
        outputRange: ['0deg', '90deg', '90deg'],
    });
    const backRotate = flipAnim.interpolate({
        inputRange: [0, 0.5, 1],
        outputRange: ['-90deg', '-90deg', '0deg'],
    });
    const frontOpacity = flipAnim.interpolate({
        inputRange: [0, 0.35, 0.45],
        outputRange: [1, 1, 0],
        extrapolate: 'clamp',
    });
    const backOpacity = flipAnim.interpolate({
        inputRange: [0.55, 0.65, 1],
        outputRange: [0, 1, 1],
        extrapolate: 'clamp',
    });

    const handleSave = async () => {
        if (!saveName.trim() || !vodMoodleId) return;
        setSaving(true);
        try {
            await saveFlashcardDeck(saveName.trim(), vodMoodleId, cards);
            setSaveModalVisible(false);
            showSuccess('저장 완료', '플래시카드 덱이 저장되었어요.');
            navigation.goBack();
        } catch (e: any) {
            showError('저장 실패', e?.response?.data?.detail || '다시 시도해주세요.');
        } finally {
            setSaving(false);
        }
    };

    const card = cards[currentIndex];
    if (!card) return null;

    const prevCard = currentIndex > 0 ? cards[currentIndex - 1] : null;
    const nextCard = currentIndex < cards.length - 1 ? cards[currentIndex + 1] : null;

    // Each card is at a fixed absolute position: index * slideDistance
    // panX shifts the whole "track"
    const makeCardTranslateX = (cardIndex: number) =>
        Animated.add(panX, cardIndex * slideDistance);

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="dark-content" />

            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <Ionicons name="chevron-back" size={24} color={styles._colors.textPrimary} />
                </TouchableOpacity>
                <View style={styles.headerCenter}>
                    <Text style={styles.headerTitle} numberOfLines={1}>{deckName}</Text>
                    {courseName ? <Text style={styles.headerSubtitle} numberOfLines={1}>{courseName}</Text> : null}
                </View>
                <View style={styles.counterBadge}>
                    <Text style={styles.counterText}>{currentIndex + 1} / {cards.length}</Text>
                </View>
            </View>

            {/* Card Area */}
            <View style={styles.cardContainer} {...panResponder.panHandlers}>
                {/* Previous card */}
                {prevCard && (
                    <Animated.View
                        style={[
                            styles.cardWrapper,
                            styles.adjacentCard,
                            { transform: [{ translateX: makeCardTranslateX(currentIndex - 1) }] },
                        ]}
                    >
                        <View style={styles.cardFlipContainer}>
                            <View style={styles.card}>
                                <View style={styles.cardLabel}>
                                    <Ionicons name="help-circle-outline" size={18} color={styles._colors.primary} />
                                    <Text style={styles.cardLabelText}>질문</Text>
                                </View>
                                <Text style={styles.cardFrontText}>{prevCard.front}</Text>
                                <Text style={styles.cardHint}>탭하여 정답 보기</Text>
                            </View>
                        </View>
                    </Animated.View>
                )}

                {/* Current card */}
                <Animated.View
                    style={[
                        styles.cardWrapper,
                        styles.adjacentCard,
                        { transform: [{ translateX: makeCardTranslateX(currentIndex) }] },
                    ]}
                >
                    <View style={styles.cardFlipContainer}>
                        <Animated.View
                            style={[
                                styles.card,
                                {
                                    opacity: frontOpacity,
                                    transform: [{ perspective: 1000 }, { rotateY: frontRotate }],
                                },
                            ]}
                        >
                            <View style={styles.cardLabel}>
                                <Ionicons name="help-circle-outline" size={18} color={styles._colors.primary} />
                                <Text style={styles.cardLabelText}>질문</Text>
                            </View>
                            <Text style={styles.cardFrontText}>{card.front}</Text>
                            <Text style={styles.cardHint}>탭하여 정답 보기</Text>
                        </Animated.View>

                        <Animated.View
                            style={[
                                styles.card,
                                {
                                    opacity: backOpacity,
                                    transform: [{ perspective: 1000 }, { rotateY: backRotate }],
                                },
                            ]}
                        >
                            <View style={styles.cardLabel}>
                                <Ionicons name="checkmark-circle-outline" size={18} color={styles._colors.success} />
                                <Text style={[styles.cardLabelText, { color: styles._colors.success }]}>정답</Text>
                            </View>
                            <Text style={styles.cardBackText}>{card.back}</Text>
                            <Text style={styles.cardHint}>탭하여 질문 보기</Text>
                        </Animated.View>
                    </View>
                </Animated.View>

                {/* Next card */}
                {nextCard && (
                    <Animated.View
                        style={[
                            styles.cardWrapper,
                            styles.adjacentCard,
                            { transform: [{ translateX: makeCardTranslateX(currentIndex + 1) }] },
                        ]}
                    >
                        <View style={styles.cardFlipContainer}>
                            <View style={styles.card}>
                                <View style={styles.cardLabel}>
                                    <Ionicons name="help-circle-outline" size={18} color={styles._colors.primary} />
                                    <Text style={styles.cardLabelText}>질문</Text>
                                </View>
                                <Text style={styles.cardFrontText}>{nextCard.front}</Text>
                                <Text style={styles.cardHint}>탭하여 정답 보기</Text>
                            </View>
                        </View>
                    </Animated.View>
                )}
            </View>

            {/* Navigation hints */}
            <View style={styles.navHints}>
                {currentIndex > 0 && (
                    <TouchableOpacity style={styles.navArrow} onPress={() => {
                        if (animatingRef.current) return;
                        const newIdx = currentIndex - 1;
                        indexRef.current = newIdx;
                        flipAnim.setValue(0);
                        flippedRef.current = false;
                        setIsFlipped(false);
                        setCurrentIndex(newIdx);
                        animatingRef.current = true;
                        Animated.timing(panX, {
                            toValue: -newIdx * slideDistance,
                            duration: 250,
                            easing: Easing.out(Easing.cubic),
                            useNativeDriver: false,
                        }).start(() => { animatingRef.current = false; });
                    }}>
                        <Ionicons name="chevron-back" size={20} color={styles._colors.textTertiary} />
                    </TouchableOpacity>
                )}
                <View style={styles.progressDots}>
                    {cards.map((_, i) => (
                        <View
                            key={i}
                            style={[
                                styles.dot,
                                i === currentIndex && styles.dotActive,
                            ]}
                        />
                    ))}
                </View>
                {currentIndex < cards.length - 1 && (
                    <TouchableOpacity style={styles.navArrow} onPress={() => {
                        if (animatingRef.current) return;
                        const newIdx = currentIndex + 1;
                        indexRef.current = newIdx;
                        flipAnim.setValue(0);
                        flippedRef.current = false;
                        setIsFlipped(false);
                        setCurrentIndex(newIdx);
                        animatingRef.current = true;
                        Animated.timing(panX, {
                            toValue: -newIdx * slideDistance,
                            duration: 250,
                            easing: Easing.out(Easing.cubic),
                            useNativeDriver: false,
                        }).start(() => { animatingRef.current = false; });
                    }}>
                        <Ionicons name="chevron-forward" size={20} color={styles._colors.textTertiary} />
                    </TouchableOpacity>
                )}
            </View>

            {/* Bottom Action */}
            {isPreview && vodMoodleId && (
                <View style={styles.bottomBar}>
                    <TouchableOpacity style={styles.saveButton} onPress={() => setSaveModalVisible(true)}>
                        <Ionicons name="bookmark-outline" size={20} color="#FFFFFF" />
                        <Text style={styles.saveButtonText}>덱 저장하기</Text>
                    </TouchableOpacity>
                </View>
            )}

            {/* Save Modal */}
            <Modal visible={saveModalVisible} transparent animationType="fade">
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>플래시카드 덱 저장</Text>
                        <TextInput
                            style={styles.modalInput}
                            value={saveName}
                            onChangeText={setSaveName}
                            placeholder="덱 이름"
                            placeholderTextColor={styles._colors.textTertiary}
                            autoFocus
                        />
                        <View style={styles.modalButtons}>
                            <TouchableOpacity
                                style={styles.modalCancelButton}
                                onPress={() => setSaveModalVisible(false)}
                            >
                                <Text style={styles.modalCancelText}>취소</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.modalSaveButton, saving && { opacity: 0.5 }]}
                                onPress={handleSave}
                                disabled={saving || !saveName.trim()}
                            >
                                <Text style={styles.modalSaveText}>{saving ? '저장 중...' : '저장'}</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
}

const createStyles = ({ colors, typography, layout, spacing, isDark }: any) => {
    const styles = StyleSheet.create({
        container: {
            flex: 1,
            backgroundColor: colors.background,
        },
        header: {
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: spacing.m,
            paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight || 0 : 0,
            paddingBottom: spacing.s,
        },
        backButton: {
            width: 40,
            height: 40,
            alignItems: 'center',
            justifyContent: 'center',
        },
        headerCenter: {
            flex: 1,
            marginHorizontal: spacing.s,
        },
        headerTitle: {
            ...typography.subtitle1,
            color: colors.textPrimary,
        },
        headerSubtitle: {
            ...typography.caption,
            color: colors.textTertiary,
            marginTop: 2,
        },
        counterBadge: {
            backgroundColor: colors.primaryLighter,
            paddingHorizontal: 12,
            paddingVertical: 6,
            borderRadius: layout.borderRadius.full,
        },
        counterText: {
            ...typography.buttonSmall,
            color: colors.primary,
        },

        // Card area
        cardContainer: {
            flex: 1,
            justifyContent: 'center',
            alignItems: 'center',
            paddingHorizontal: CARD_MARGIN,
            overflow: 'hidden',
        },
        cardWrapper: {
            width: '100%',
            aspectRatio: 0.7,
            maxHeight: '80%',
            backgroundColor: colors.surface,
            borderRadius: layout.borderRadius.xl,
            ...layout.shadow.lg,
        },
        adjacentCard: {
            position: 'absolute',
            left: CARD_MARGIN,
            right: CARD_MARGIN,
        },
        cardFlipContainer: {
            flex: 1,
            overflow: 'hidden',
            borderRadius: layout.borderRadius.xl,
        },
        card: {
            ...StyleSheet.absoluteFillObject,
            backgroundColor: colors.surface,
            borderRadius: layout.borderRadius.xl,
            padding: spacing.l,
            justifyContent: 'center',
            alignItems: 'center',
            borderWidth: 1,
            borderColor: colors.borderLight,
        },
        cardLabel: {
            position: 'absolute',
            top: spacing.l,
            left: spacing.l,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
        },
        cardLabelText: {
            ...typography.caption,
            color: colors.primary,
            fontWeight: '600',
        },
        cardFrontText: {
            ...typography.subtitle1,
            color: colors.textPrimary,
            textAlign: 'center',
            lineHeight: 28,
        },
        cardBackText: {
            ...typography.body1,
            color: colors.textSecondary,
            textAlign: 'center',
            lineHeight: 26,
        },
        cardHint: {
            position: 'absolute',
            bottom: spacing.l,
            ...typography.caption,
            color: colors.textMuted,
        },

        // Navigation
        navHints: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            paddingVertical: spacing.m,
            gap: spacing.m,
        },
        navArrow: {
            width: 36,
            height: 36,
            borderRadius: 18,
            backgroundColor: colors.surfaceHighlight,
            alignItems: 'center',
            justifyContent: 'center',
        },
        progressDots: {
            flexDirection: 'row',
            gap: 6,
            flexWrap: 'wrap',
            justifyContent: 'center',
            maxWidth: SCREEN_WIDTH * 0.5,
        },
        dot: {
            width: 6,
            height: 6,
            borderRadius: 3,
            backgroundColor: colors.borderLight,
        },
        dotActive: {
            backgroundColor: colors.primary,
            width: 18,
            borderRadius: 3,
        },

        // Bottom
        bottomBar: {
            paddingHorizontal: spacing.screenPadding,
            paddingBottom: spacing.l,
        },
        saveButton: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            backgroundColor: colors.primary,
            paddingVertical: 16,
            borderRadius: layout.borderRadius.m,
            ...layout.shadow.primary,
        },
        saveButtonText: {
            ...typography.button,
            color: colors.primaryForeground,
        },

        // Modal
        modalOverlay: {
            flex: 1,
            backgroundColor: colors.overlay,
            justifyContent: 'center',
            alignItems: 'center',
            padding: spacing.screenPadding,
        },
        modalContent: {
            width: '100%',
            backgroundColor: colors.surface,
            borderRadius: layout.borderRadius.l,
            padding: spacing.l,
            ...layout.shadow.xl,
        },
        modalTitle: {
            ...typography.header3,
            color: colors.textPrimary,
            marginBottom: spacing.m,
        },
        modalInput: {
            backgroundColor: colors.surfaceHighlight,
            borderRadius: layout.borderRadius.s,
            paddingHorizontal: spacing.m,
            paddingVertical: 14,
            ...typography.body1,
            color: colors.textPrimary,
            borderWidth: 1,
            borderColor: colors.border,
            marginBottom: spacing.m,
        },
        modalButtons: {
            flexDirection: 'row',
            gap: spacing.s,
        },
        modalCancelButton: {
            flex: 1,
            paddingVertical: 14,
            borderRadius: layout.borderRadius.s,
            backgroundColor: colors.surfaceHighlight,
            alignItems: 'center',
        },
        modalCancelText: {
            ...typography.button,
            color: colors.textSecondary,
        },
        modalSaveButton: {
            flex: 1,
            paddingVertical: 14,
            borderRadius: layout.borderRadius.s,
            backgroundColor: colors.primary,
            alignItems: 'center',
        },
        modalSaveText: {
            ...typography.button,
            color: colors.primaryForeground,
        },
    });

    return { ...styles, _colors: colors };
};
