import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
    View, Text, StyleSheet, ScrollView, TouchableOpacity,
    Clipboard, Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Spacing } from './constants/theme';
import type { ColorScheme, TypographyType, LayoutType } from './constants/theme';
import { useTheme } from './context/ThemeContext';
import { useToast } from './context/ToastContext';
import { transcribeVod, getVodTranscript, summarizeVod, generateFlashcards } from './services/api';
import AIChatModal from './AIChatModal';
import TypingDots from './TypingDots';
import { ActivityIndicator } from 'react-native';

// ─── Summary Card ─────────────────────────────────────────────────────────────

type Styles = ReturnType<typeof createStyles>;

const SummaryCard = ({ vodMoodleId, styles, colors }: { vodMoodleId: number; styles: Styles; colors: ColorScheme }) => {
    const { showError } = useToast();
    const [loading, setLoading] = useState(false);
    const [summary, setSummary] = useState<{ tldr: string; points: string[] } | null>(null);
    const fadeIn = useRef(new Animated.Value(0)).current;

    const load = async () => {
        setLoading(true);
        try {
            const data = await summarizeVod(vodMoodleId);
            setSummary(data.summary);
            Animated.timing(fadeIn, { toValue: 1, duration: 300, useNativeDriver: true }).start();
        } catch (e) {
            showError('오류', 'AI 요약을 불러올 수 없어요.');
        } finally {
            setLoading(false);
        }
    };

    if (summary) {
        const [courseLine, ...rest] = summary.split('\n').filter((l: string) => l.trim());
        const lectureText = rest.join(' ').trim();
        return (
            <Animated.View style={[styles.summaryCard, { opacity: fadeIn }]}>
                <View style={styles.summaryHeader}>
                    <View style={styles.summaryIconWrap}>
                        <Ionicons name="sparkles" size={16} color={colors.primary} />
                    </View>
                    <Text style={styles.summaryTitle}>AI 요약</Text>
                </View>
                <Text style={styles.courseDesc}>{courseLine}</Text>
                <View style={styles.divider} />
                <Text style={styles.lectureDesc}>{lectureText}</Text>
            </Animated.View>
        );
    }

    return (
        <TouchableOpacity
            style={styles.summaryBtn}
            onPress={load}
            disabled={loading}
            activeOpacity={0.8}
        >
            {loading ? (
                <TypingDots size={7} />
            ) : (
                <Ionicons name="sparkles" size={18} color={colors.primary} />
            )}
            <Text style={styles.summaryBtnText}>
                {loading ? 'AI가 요약하는 중...' : 'AI 요약 보기'}
            </Text>
        </TouchableOpacity>
    );
};

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function VodTranscriptScreen() {
    const { colors, typography, layout, isDark } = useTheme();
    const styles = useMemo(() => createStyles(colors, typography, layout, isDark), [colors, typography, layout, isDark]);

    const navigation = useNavigation<any>();
    const route = useRoute<any>();
    const insets = useSafeAreaInsets();
    const { vodMoodleId, title, courseName } = route.params;
    const { showSuccess, showInfo, showError } = useToast();

    const [loading, setLoading] = useState(true);
    const [transcript, setTranscript] = useState<string | null>(null);
    const [error, setError] = useState(false);
    const [chatVisible, setChatVisible] = useState(false);
    const [generatingFlashcards, setGeneratingFlashcards] = useState(false);
    const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const stopPolling = useCallback(() => {
        if (pollRef.current) {
            clearInterval(pollRef.current);
            pollRef.current = null;
        }
    }, []);

    const startPolling = useCallback(() => {
        stopPolling();
        pollRef.current = setInterval(async () => {
            try {
                const data = await getVodTranscript(vodMoodleId);
                if (data.status === 'ok') {
                    stopPolling();
                    setTranscript(data.transcript);
                    setLoading(false);
                    showSuccess('추출 완료', '강의 텍스트가 준비되었어요!');
                }
            } catch (e) {
                stopPolling();
                setError(true);
                setLoading(false);
            }
        }, 5000);
    }, [vodMoodleId, stopPolling]);

    useEffect(() => {
        load();
        return () => stopPolling();
    }, []);

    const load = async () => {
        setLoading(true);
        setError(false);
        try {
            const data = await transcribeVod(vodMoodleId);
            if (data.status === 'ok' || data.status === 'cached') {
                setTranscript(data.transcript);
                setLoading(false);
            } else if (data.status === 'processing') {
                startPolling();
            }
        } catch (e) {
            setError(true);
            setLoading(false);
            showError('오류', '텍스트를 불러올 수 없어요. 다시 시도해주세요.');
        }
    };

    const handleCopy = () => {
        if (!transcript) return;
        Clipboard.setString(transcript);
        showSuccess('복사 완료', '텍스트가 클립보드에 복사되었어요.');
    };

    const handleChat = () => {
        setChatVisible(true);
    };

    const handleFlashcards = async () => {
        setGeneratingFlashcards(true);
        try {
            const data = await generateFlashcards(vodMoodleId);
            if (data.cards && data.cards.length > 0) {
                navigation.navigate('FlashcardStudy', {
                    cards: data.cards,
                    deckName: title,
                    vodMoodleId,
                    courseName: data.course_name || courseName,
                    isPreview: true,
                });
            } else {
                showError('생성 실패', '플래시카드를 생성할 수 없었어요.');
            }
        } catch (e: any) {
            const detail = e?.response?.data?.detail;
            if (e?.response?.status === 429) {
                showInfo('한도 도달', detail || '일일 사용 한도에 도달했어요.');
            } else {
                showError('오류', detail || '플래시카드를 생성할 수 없어요.');
            }
        } finally {
            setGeneratingFlashcards(false);
        }
    };

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} activeOpacity={0.7}>
                    <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
                </TouchableOpacity>
                <View style={styles.headerCenter}>
                    <Text style={styles.headerSub} numberOfLines={1}>{courseName}</Text>
                    <Text style={styles.headerTitle} numberOfLines={1}>{title}</Text>
                </View>
            </View>

            {loading ? (
                <View style={styles.centered}>
                    <TypingDots size={14} gap={12} />
                    <Text style={styles.loadingText}>텍스트 추출 중...</Text>
                    <Text style={styles.loadingSubText}>
                        AI가 강의 음성을 텍스트로 변환하고 있어요.{'\n'}
                        강의 길이에 따라 수 분이 걸릴 수 있어요.
                    </Text>
                    <Text style={styles.loadingHintInline}>완료되면 알림으로 알려드릴게요</Text>
                </View>
            ) : error ? (
                <View style={styles.centered}>
                    <Ionicons name="alert-circle-outline" size={48} color={colors.error} />
                    <Text style={styles.errorText}>불러오기 실패</Text>
                    <TouchableOpacity style={styles.retryBtn} onPress={load} activeOpacity={0.8}>
                        <Text style={styles.retryText}>다시 시도</Text>
                    </TouchableOpacity>
                </View>
            ) : (
                <ScrollView
                    contentContainerStyle={styles.scrollContent}
                    showsVerticalScrollIndicator={false}
                >
                    {/* Summary */}
                    <SummaryCard vodMoodleId={vodMoodleId} styles={styles} colors={colors} />

                    {/* Transcript */}
                    <View style={styles.transcriptCard}>
                        <View style={styles.transcriptHeader}>
                            <Ionicons name="document-text-outline" size={16} color={colors.textTertiary} />
                            <Text style={styles.transcriptLabel}>전체 텍스트</Text>
                        </View>
                        <Text style={styles.transcriptText}>{transcript}</Text>
                    </View>
                </ScrollView>
            )}

            {/* Bottom bar */}
            {!loading && !error && (
                <View style={[styles.bottomBar, { paddingBottom: insets.bottom || Spacing.m }]}>
                    <TouchableOpacity style={styles.bottomBtn} onPress={handleCopy} activeOpacity={0.8}>
                        <Ionicons name="copy-outline" size={18} color={colors.primary} />
                        <Text style={styles.bottomBtnText}>전체 복사</Text>
                    </TouchableOpacity>
                    <View style={styles.bottomDivider} />
                    <TouchableOpacity style={styles.bottomBtn} onPress={handleChat} activeOpacity={0.8}>
                        <Ionicons name="chatbubble-outline" size={18} color={colors.primary} />
                        <Text style={styles.bottomBtnText}>AI 질문</Text>
                    </TouchableOpacity>
                    <View style={styles.bottomDivider} />
                    <TouchableOpacity
                        style={styles.bottomBtn}
                        onPress={handleFlashcards}
                        activeOpacity={0.8}
                        disabled={generatingFlashcards}
                    >
                        {generatingFlashcards ? (
                            <ActivityIndicator size="small" color={colors.primary} />
                        ) : (
                            <Ionicons name="albums-outline" size={18} color={colors.primary} />
                        )}
                        <Text style={styles.bottomBtnText}>
                            {generatingFlashcards ? '생성 중...' : '플래시카드'}
                        </Text>
                    </TouchableOpacity>
                </View>
            )}
            <AIChatModal
                visible={chatVisible}
                onClose={() => setChatVisible(false)}
                vodMoodleId={vodMoodleId}
                title={title}
                courseName={courseName}
            />
        </SafeAreaView>
    );
}

const createStyles = (colors: ColorScheme, typography: TypographyType, layout: LayoutType, isDark: boolean) => StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.xl },

    // Header
    header: {
        flexDirection: 'row', alignItems: 'center',
        paddingHorizontal: Spacing.l, paddingVertical: Spacing.m,
        backgroundColor: colors.background,
    },
    backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', marginRight: Spacing.s },
    headerCenter: { flex: 1 },
    headerTitle: { ...typography.header3, fontSize: 18 },
    headerSub: { ...typography.caption, marginBottom: 2 },

    // Loading / Error
    loadingIconWrap: {
        width: 72, height: 72, borderRadius: 36,
        backgroundColor: colors.primaryLighter,
        alignItems: 'center', justifyContent: 'center',
    },
    loadingText: { fontSize: 17, fontWeight: '700', color: colors.textPrimary, marginTop: Spacing.l, marginBottom: Spacing.s, textAlign: 'center' },
    loadingSubText: { ...typography.body2, color: colors.textSecondary, textAlign: 'center', maxWidth: 280, lineHeight: 20 },
    loadingHintInline: { ...typography.caption, color: colors.textTertiary, marginTop: Spacing.xl, textAlign: 'center' },
    errorText: { ...typography.subtitle2, color: colors.error },
    retryBtn: {
        paddingHorizontal: Spacing.l, paddingVertical: Spacing.s,
        backgroundColor: colors.primary, borderRadius: layout.borderRadius.full,
    },
    retryText: { color: '#fff', fontWeight: '600', fontSize: 14 },

    // Scroll
    scrollContent: { padding: Spacing.l, gap: Spacing.m, paddingBottom: 120 },

    // Summary button
    summaryBtn: {
        flexDirection: 'row', alignItems: 'center', gap: Spacing.s,
        backgroundColor: colors.primaryLighter,
        borderRadius: layout.borderRadius.l,
        paddingVertical: Spacing.m, paddingHorizontal: Spacing.l,
        borderWidth: 1, borderColor: 'rgba(49, 130, 246, 0.15)',
    },
    summaryBtnText: { fontSize: 15, fontWeight: '600', color: colors.primary },

    // Summary card
    summaryCard: {
        backgroundColor: colors.surface,
        borderRadius: layout.borderRadius.l,
        padding: Spacing.l,
        borderWidth: 1, borderColor: colors.border,
        ...layout.shadow.sm,
    },
    summaryHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.s, marginBottom: Spacing.m },
    summaryIconWrap: {
        width: 28, height: 28, borderRadius: 8,
        backgroundColor: colors.primaryLighter,
        alignItems: 'center', justifyContent: 'center',
    },
    summaryTitle: { ...typography.subtitle2, color: colors.primary, fontWeight: '700' },
    courseDesc: { ...typography.caption, color: colors.textSecondary, lineHeight: 18, marginBottom: Spacing.m, fontStyle: 'italic' },
    divider: { height: 1, backgroundColor: colors.divider, marginBottom: Spacing.m },
    lectureDesc: { ...typography.body2, lineHeight: 22, color: colors.textPrimary },

    // Transcript
    transcriptCard: {
        backgroundColor: colors.surface,
        borderRadius: layout.borderRadius.l,
        padding: Spacing.l,
        borderWidth: 1, borderColor: colors.border,
        ...layout.shadow.sm,
    },
    transcriptHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.s, marginBottom: Spacing.m },
    transcriptLabel: { ...typography.caption, fontWeight: '600' },
    transcriptText: { ...typography.body2, lineHeight: 24, color: colors.textPrimary },

    // Bottom bar
    bottomBar: {
        position: 'absolute', bottom: 0, left: 0, right: 0,
        flexDirection: 'row',
        backgroundColor: colors.surface,
        borderTopWidth: 1, borderTopColor: colors.border,
        ...layout.shadow.md,
    },
    bottomBtn: {
        flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        gap: Spacing.s, paddingVertical: Spacing.m,
    },
    bottomBtnText: { fontSize: 15, fontWeight: '600', color: colors.primary },
    bottomDivider: { width: 1, backgroundColor: colors.border, marginVertical: Spacing.s },
});
