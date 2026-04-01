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
import {
    transcribeVod,
    getVodTranscript,
    getVodTranscribeStatus,
    summarizeVod,
    generateFlashcards,
    type VodTranscribeStatus,
} from './services/api';
import AIChatModal from './AIChatModal';
import TypingDots from './TypingDots';
import { ActivityIndicator } from 'react-native';

// ─── Summary Card ─────────────────────────────────────────────────────────────

type Styles = ReturnType<typeof createStyles>;
type StageKey = 'queued' | 'extracting_audio' | 'transcribing' | 'finalizing';

const TRANSCRIBE_STAGES: Array<{ key: StageKey; label: string }> = [
    { key: 'queued', label: '대기' },
    { key: 'extracting_audio', label: '음성 추출' },
    { key: 'transcribing', label: '텍스트 변환' },
    { key: 'finalizing', label: '정리' },
];

const formatDuration = (seconds?: number | null) => {
    if (!seconds || seconds <= 0) return null;
    const mins = Math.round(seconds / 60);
    if (mins < 1) return '1분 미만';
    return `${mins}분`;
};

const getStageLabel = (status?: VodTranscribeStatus | null) => {
    if (!status) return '대기 중';
    if (status.status === 'queued') return '대기열에서 순서를 기다리는 중';
    if (status.stage === 'extracting_audio') return '강의 음성 추출 중';
    if (status.stage === 'transcribing') return '음성을 텍스트로 변환 중';
    if (status.stage === 'finalizing') return '결과 정리 중';
    if (status.status === 'running') return '처리 중';
    return '대기 중';
};

const getStageProgress = (status?: VodTranscribeStatus | null) => {
    if (!status) return 8;
    if (status.status === 'done') return 100;
    if (status.status === 'failed') return 0;
    if (status.status === 'queued') {
        if ((status.queue_ahead || 0) > 0) return 12;
        return 20;
    }
    if (status.stage === 'extracting_audio') return 38;
    if (status.stage === 'transcribing') return 72;
    if (status.stage === 'finalizing') return 92;
    return 55;
};

const getStageMessage = (status?: VodTranscribeStatus | null) => {
    if (!status) return '작업을 준비하고 있어요.';
    if (status.status === 'queued') return '대기열 순서가 되면 바로 시작돼요.';
    if (status.stage === 'extracting_audio') return '강의 스트림에서 음성을 추출하고 있어요.';
    if (status.stage === 'transcribing') return 'Whisper가 음성을 텍스트로 변환 중이에요.';
    if (status.stage === 'finalizing') return '결과를 정리하고 화면에 반영하는 중이에요.';
    return '잠시만 기다려 주세요.';
};

const getStageKey = (status?: VodTranscribeStatus | null): StageKey => {
    if (!status || status.status === 'queued') return 'queued';
    if (status.stage === 'extracting_audio') return 'extracting_audio';
    if (status.stage === 'transcribing') return 'transcribing';
    if (status.stage === 'finalizing') return 'finalizing';
    return 'queued';
};

const SummaryCard = ({ vodMoodleId, styles, colors }: { vodMoodleId: number; styles: Styles; colors: ColorScheme }) => {
    const { showError } = useToast();
    const [loading, setLoading] = useState(false);
    const [summary, setSummary] = useState<string | null>(null);
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
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [chatVisible, setChatVisible] = useState(false);
    const [generatingFlashcards, setGeneratingFlashcards] = useState(false);
    const [statusInfo, setStatusInfo] = useState<VodTranscribeStatus | null>(null);
    const [showTranscribeProgress, setShowTranscribeProgress] = useState(false);
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
                const status = await getVodTranscribeStatus(vodMoodleId);
                setStatusInfo(status);

                if (status.status === 'done') {
                    const data = await getVodTranscript(vodMoodleId);
                    stopPolling();
                    if (data.status === 'ok') {
                        setTranscript(data.transcript);
                        setShowTranscribeProgress(false);
                        setLoading(false);
                        showSuccess('추출 완료', '강의 텍스트가 준비되었어요!');
                    } else {
                        setError(true);
                        setErrorMessage('텍스트를 불러오지 못했어요. 다시 시도해주세요.');
                        setShowTranscribeProgress(false);
                        setLoading(false);
                    }
                } else if (status.status === 'failed') {
                    stopPolling();
                    setError(true);
                    setErrorMessage(status.error_message || '텍스트 추출에 실패했어요. 다시 시도해주세요.');
                    setShowTranscribeProgress(false);
                    setLoading(false);
                }
            } catch (e) {
                stopPolling();
                setError(true);
                setErrorMessage('상태 확인 중 오류가 발생했어요. 다시 시도해주세요.');
                setShowTranscribeProgress(false);
                setLoading(false);
            }
        }, 4000);
    }, [vodMoodleId, stopPolling, showSuccess]);

    useEffect(() => {
        load();
        return () => stopPolling();
    }, []);

    const load = async () => {
        setLoading(true);
        setError(false);
        setErrorMessage(null);
        setStatusInfo(null);
        setShowTranscribeProgress(false);
        try {
            // Fast path: if transcript already exists, render immediately without progress UI.
            const cached = await getVodTranscript(vodMoodleId);
            if (cached.status === 'ok') {
                setTranscript(cached.transcript);
                setLoading(false);
                return;
            }
            if (cached.status === 'failed') {
                setError(true);
                setErrorMessage(cached.error_message || '텍스트 추출에 실패했어요. 다시 시도해주세요.');
                setLoading(false);
                return;
            }
            if (cached.status === 'processing') {
                setShowTranscribeProgress(true);
                try {
                    const status = await getVodTranscribeStatus(vodMoodleId);
                    setStatusInfo(status);
                } catch {}
                startPolling();
                return;
            }

            const data = await transcribeVod(vodMoodleId);
            if (data.status === 'ok' || data.status === 'cached') {
                setTranscript(data.transcript);
                setShowTranscribeProgress(false);
                setLoading(false);
            } else if (data.status === 'processing') {
                setShowTranscribeProgress(true);
                try {
                    const status = await getVodTranscribeStatus(vodMoodleId);
                    setStatusInfo(status);
                } catch {}
                startPolling();
            }
        } catch (e) {
            const detail = (e as any)?.response?.data?.detail;
            setError(true);
            setErrorMessage(detail || '텍스트를 불러올 수 없어요. 다시 시도해주세요.');
            setShowTranscribeProgress(false);
            setLoading(false);
            if ((e as any)?.response?.status === 429) {
                showInfo('한도 또는 요청 제한', detail || '요청이 많아요. 잠시 후 다시 시도해주세요.');
            } else {
                showError('오류', detail || '텍스트를 불러올 수 없어요. 다시 시도해주세요.');
            }
        }
    };

    const stageLabel = getStageLabel(statusInfo);
    const stageProgress = Math.max(
        0,
        Math.min(
            100,
            statusInfo?.progress_pct ?? getStageProgress(statusInfo),
        ),
    );
    const stageMessage = getStageMessage(statusInfo);
    const currentStageKey = getStageKey(statusInfo);
    const currentStageIndex = TRANSCRIBE_STAGES.findIndex((s) => s.key === currentStageKey);

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
                    {showTranscribeProgress ? (
                        <View style={styles.loadingCard}>
                            <View style={styles.loadingTopRow}>
                                <View style={styles.loadingIconWrap}>
                                    <Ionicons name="document-text-outline" size={22} color={colors.primary} />
                                </View>
                                <View style={styles.loadingTitleWrap}>
                                    <Text style={styles.loadingTitle}>텍스트 추출 중</Text>
                                    <Text style={styles.loadingStageBadge}>{stageLabel}</Text>
                                </View>
                                <TypingDots size={8} gap={5} />
                            </View>

                            <View style={styles.stageRail}>
                                {TRANSCRIBE_STAGES.map((stage, idx) => {
                                    const isActive = idx === currentStageIndex;
                                    const isDone = idx < currentStageIndex || stageProgress >= 100;
                                    return (
                                        <View
                                            key={stage.key}
                                            style={[
                                                styles.stageChip,
                                                isDone && styles.stageChipDone,
                                                isActive && styles.stageChipActive,
                                            ]}
                                        >
                                            <Text
                                                style={[
                                                    styles.stageChipText,
                                                    isDone && styles.stageChipTextDone,
                                                    isActive && styles.stageChipTextActive,
                                                ]}
                                            >
                                                {stage.label}
                                            </Text>
                                        </View>
                                    );
                                })}
                            </View>

                            <View style={styles.loadingProgressTrack}>
                                <View style={[styles.loadingProgressFill, { width: `${stageProgress}%` }]} />
                            </View>
                            <View style={styles.progressLabelRow}>
                                <Text style={styles.loadingProgressLabel}>진행률</Text>
                                <Text style={styles.loadingProgressText}>{stageProgress}%</Text>
                            </View>
                            <Text style={styles.loadingSubText}>
                                {stageMessage}{'\n'}
                                텍스트 추출은 보통 5분 이내에 완료되며, 강의 길이에 따라 더 소요될 수 있습니다.
                            </Text>

                            <View style={styles.loadingMetaCard}>
                                {statusInfo?.queue_ahead !== undefined && statusInfo?.queue_ahead !== null && (
                                    <View style={styles.loadingMetaRow}>
                                        <Ionicons name="git-network-outline" size={15} color={colors.textSecondary} />
                                        <Text style={styles.loadingMetaLabel}>대기열</Text>
                                        <Text style={styles.loadingMetaValue}>
                                            {statusInfo.queue_ahead > 0 ? `앞에 ${statusInfo.queue_ahead}개` : '바로 처리 중'}
                                        </Text>
                                    </View>
                                )}
                                {statusInfo?.elapsed_seconds !== undefined && statusInfo?.elapsed_seconds !== null && (
                                    <View style={styles.loadingMetaRow}>
                                        <Ionicons name="hourglass-outline" size={15} color={colors.textSecondary} />
                                        <Text style={styles.loadingMetaLabel}>경과 시간</Text>
                                        <Text style={styles.loadingMetaValue}>{formatDuration(statusInfo.elapsed_seconds)}</Text>
                                    </View>
                                )}
                            </View>
                        </View>
                    ) : (
                        <View style={styles.initialLoadingWrap}>
                            <ActivityIndicator size="small" color={colors.primary} />
                            <Text style={styles.initialLoadingText}>기존 텍스트를 확인하는 중...</Text>
                        </View>
                    )}
                    {showTranscribeProgress && (
                        <Text style={styles.loadingHintInline}>앱을 닫아도 계속 진행되고 완료되면 알림이 와요.</Text>
                    )}
                </View>
            ) : error ? (
                <View style={styles.centered}>
                    <Ionicons name="alert-circle-outline" size={48} color={colors.error} />
                    <Text style={styles.errorText}>불러오기 실패</Text>
                    {errorMessage ? <Text style={styles.errorSubText}>{errorMessage}</Text> : null}
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
    loadingCard: {
        width: '100%',
        maxWidth: 360,
        backgroundColor: colors.surface,
        borderRadius: layout.borderRadius.xl,
        borderWidth: 1,
        borderColor: colors.border,
        padding: Spacing.l,
        ...layout.shadow.sm,
    },
    loadingTopRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: Spacing.m,
    },
    loadingIconWrap: {
        width: 46, height: 46, borderRadius: 14,
        backgroundColor: colors.primaryLighter,
        alignItems: 'center', justifyContent: 'center',
        marginRight: Spacing.m,
    },
    loadingTitleWrap: { flex: 1 },
    loadingTitle: { ...typography.subtitle2, color: colors.textPrimary, fontWeight: '700', marginBottom: 4 },
    loadingStageBadge: {
        ...typography.caption,
        color: colors.primary,
        alignSelf: 'flex-start',
        backgroundColor: colors.primaryLighter,
        borderRadius: layout.borderRadius.full,
        paddingHorizontal: Spacing.s,
        paddingVertical: 4,
        overflow: 'hidden',
    },
    stageRail: {
        flexDirection: 'row',
        gap: Spacing.xs,
        marginBottom: Spacing.m,
        flexWrap: 'wrap',
    },
    stageChip: {
        paddingHorizontal: Spacing.s,
        paddingVertical: 5,
        borderRadius: layout.borderRadius.full,
        backgroundColor: colors.surfaceMuted,
        borderWidth: 1,
        borderColor: colors.border,
    },
    stageChipDone: {
        backgroundColor: colors.primaryLighter,
        borderColor: colors.primary,
    },
    stageChipActive: {
        backgroundColor: colors.primary,
        borderColor: colors.primary,
    },
    stageChipText: {
        ...typography.caption,
        color: colors.textSecondary,
        fontSize: 11,
        fontWeight: '600',
    },
    stageChipTextDone: {
        color: colors.primary,
    },
    stageChipTextActive: {
        color: '#fff',
    },
    loadingProgressTrack: {
        height: 8,
        width: '100%',
        backgroundColor: colors.divider,
        borderRadius: layout.borderRadius.full,
        overflow: 'hidden',
        marginBottom: Spacing.s,
    },
    loadingProgressFill: {
        height: '100%',
        backgroundColor: colors.primary,
        borderRadius: layout.borderRadius.full,
    },
    progressLabelRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: Spacing.s,
    },
    loadingProgressLabel: {
        ...typography.caption,
        color: colors.textSecondary,
        fontWeight: '600',
    },
    loadingProgressText: {
        ...typography.subtitle2,
        color: colors.textPrimary,
        fontWeight: '700',
    },
    loadingSubText: { ...typography.body2, color: colors.textSecondary, lineHeight: 20, marginBottom: Spacing.m },
    loadingMetaCard: {
        backgroundColor: colors.surfaceMuted,
        borderRadius: layout.borderRadius.l,
        paddingVertical: Spacing.s,
        paddingHorizontal: Spacing.m,
        gap: Spacing.s,
    },
    loadingMetaRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    loadingMetaLabel: {
        ...typography.caption,
        color: colors.textSecondary,
        marginLeft: Spacing.xs,
        flex: 1,
    },
    loadingMetaValue: {
        ...typography.caption,
        color: colors.textPrimary,
        fontWeight: '600',
    },
    loadingHintInline: { ...typography.caption, color: colors.textTertiary, marginTop: Spacing.l, textAlign: 'center', maxWidth: 320 },
    initialLoadingWrap: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: Spacing.xl,
    },
    initialLoadingText: {
        ...typography.body2,
        color: colors.textSecondary,
        marginTop: Spacing.m,
    },
    errorText: { ...typography.subtitle2, color: colors.error },
    errorSubText: { ...typography.caption, color: colors.textSecondary, textAlign: 'center', marginTop: Spacing.s, marginBottom: Spacing.l },
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
