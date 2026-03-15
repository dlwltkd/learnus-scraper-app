import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
    View, Text, StyleSheet, ScrollView, TouchableOpacity,
    ActivityIndicator, Clipboard, Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Colors, Spacing, Layout, Typography } from './constants/theme';
import { useToast } from './context/ToastContext';
import { transcribeVod, getVodTranscript, summarizeVod } from './services/api';

// ─── Summary Card ─────────────────────────────────────────────────────────────

const SummaryCard = ({ vodMoodleId }: { vodMoodleId: number }) => {
    const { showError } = useToast();
    const [loading, setLoading] = useState(false);
    const [summary, setSummary] = useState<{ tldr: string; points: string[] } | null>(null);
    const fadeIn = useRef(new Animated.Value(0)).current;

    const load = async () => {
        setLoading(true);
        try {
            const data = await summarizeVod(vodMoodleId);
            const parsed = typeof data.summary === 'string' ? JSON.parse(data.summary) : data.summary;
            setSummary(parsed);
            Animated.timing(fadeIn, { toValue: 1, duration: 300, useNativeDriver: true }).start();
        } catch (e) {
            showError('오류', 'AI 요약을 불러올 수 없어요.');
        } finally {
            setLoading(false);
        }
    };

    if (summary) {
        return (
            <Animated.View style={[styles.summaryCard, { opacity: fadeIn }]}>
                <View style={styles.summaryHeader}>
                    <View style={styles.summaryIconWrap}>
                        <Ionicons name="sparkles" size={16} color={Colors.tertiary} />
                    </View>
                    <Text style={styles.summaryTitle}>AI 요약</Text>
                </View>
                <Text style={styles.tldr}>{summary.tldr}</Text>
                <View style={styles.divider} />
                {summary.points.map((point, i) => (
                    <View key={i} style={styles.pointRow}>
                        <View style={styles.pointDot} />
                        <Text style={styles.pointText}>{point}</Text>
                    </View>
                ))}
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
                <ActivityIndicator size="small" color={Colors.tertiary} />
            ) : (
                <Ionicons name="sparkles" size={18} color={Colors.tertiary} />
            )}
            <Text style={styles.summaryBtnText}>
                {loading ? 'AI가 요약하는 중...' : 'AI 요약 보기'}
            </Text>
        </TouchableOpacity>
    );
};

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function VodTranscriptScreen() {
    const navigation = useNavigation<any>();
    const route = useRoute<any>();
    const { vodMoodleId, title, courseName } = route.params;
    const { showSuccess, showInfo, showError } = useToast();

    const [loading, setLoading] = useState(true);
    const [transcript, setTranscript] = useState<string | null>(null);
    const [error, setError] = useState(false);
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
        showInfo('준비 중', '이 기능은 아직 개발 중이에요.');
    };

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} activeOpacity={0.7}>
                    <Ionicons name="chevron-back" size={24} color={Colors.textPrimary} />
                </TouchableOpacity>
                <View style={styles.headerCenter}>
                    <Text style={styles.headerTitle} numberOfLines={1}>{title}</Text>
                    <Text style={styles.headerSub} numberOfLines={1}>{courseName}</Text>
                </View>
                <TouchableOpacity onPress={handleCopy} style={styles.copyBtn} activeOpacity={0.7} disabled={!transcript}>
                    <Ionicons name="copy-outline" size={20} color={transcript ? Colors.primary : Colors.textTertiary} />
                </TouchableOpacity>
            </View>

            {loading ? (
                <View style={styles.centered}>
                    <ActivityIndicator size="large" color={Colors.primary} />
                    <Text style={styles.loadingText}>텍스트 추출 중...</Text>
                    <Text style={styles.loadingSubText}>강의 길이에 따라 수 분이 걸릴 수 있어요</Text>
                </View>
            ) : error ? (
                <View style={styles.centered}>
                    <Ionicons name="alert-circle-outline" size={48} color={Colors.error} />
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
                    <SummaryCard vodMoodleId={vodMoodleId} />

                    {/* Transcript */}
                    <View style={styles.transcriptCard}>
                        <View style={styles.transcriptHeader}>
                            <Ionicons name="document-text-outline" size={16} color={Colors.textTertiary} />
                            <Text style={styles.transcriptLabel}>전체 텍스트</Text>
                        </View>
                        <Text style={styles.transcriptText}>{transcript}</Text>
                    </View>
                </ScrollView>
            )}

            {/* Bottom bar */}
            {!loading && !error && (
                <View style={styles.bottomBar}>
                    <TouchableOpacity style={styles.bottomBtn} onPress={handleCopy} activeOpacity={0.8}>
                        <Ionicons name="copy-outline" size={18} color={Colors.primary} />
                        <Text style={styles.bottomBtnText}>전체 복사</Text>
                    </TouchableOpacity>
                    <View style={styles.bottomDivider} />
                    <TouchableOpacity style={styles.bottomBtn} onPress={handleChat} activeOpacity={0.8}>
                        <Ionicons name="chatbubble-outline" size={18} color={Colors.textSecondary} />
                        <Text style={[styles.bottomBtnText, { color: Colors.textSecondary }]}>AI 질문</Text>
                    </TouchableOpacity>
                </View>
            )}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.background },
    centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.xl, gap: Spacing.m },

    // Header
    header: {
        flexDirection: 'row', alignItems: 'center',
        paddingHorizontal: Spacing.m, paddingVertical: Spacing.s,
        backgroundColor: Colors.surface,
        borderBottomWidth: 1, borderBottomColor: Colors.border,
    },
    backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
    headerCenter: { flex: 1, paddingHorizontal: Spacing.s },
    headerTitle: { ...Typography.subtitle1, fontSize: 15 },
    headerSub: { ...Typography.caption, marginTop: 1 },
    copyBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },

    // Loading / Error
    loadingText: { ...Typography.subtitle2, marginTop: Spacing.m },
    loadingSubText: { ...Typography.caption, textAlign: 'center' },
    errorText: { ...Typography.subtitle2, color: Colors.error },
    retryBtn: {
        paddingHorizontal: Spacing.l, paddingVertical: Spacing.s,
        backgroundColor: Colors.primary, borderRadius: Layout.borderRadius.full,
    },
    retryText: { color: '#fff', fontWeight: '600', fontSize: 14 },

    // Scroll
    scrollContent: { padding: Spacing.l, gap: Spacing.m, paddingBottom: 100 },

    // Summary button
    summaryBtn: {
        flexDirection: 'row', alignItems: 'center', gap: Spacing.s,
        backgroundColor: Colors.tertiaryLight,
        borderRadius: Layout.borderRadius.l,
        paddingVertical: Spacing.m, paddingHorizontal: Spacing.l,
        borderWidth: 1, borderColor: 'rgba(139, 92, 246, 0.15)',
    },
    summaryBtnText: { fontSize: 15, fontWeight: '600', color: Colors.tertiary },

    // Summary card
    summaryCard: {
        backgroundColor: Colors.surface,
        borderRadius: Layout.borderRadius.l,
        padding: Spacing.l,
        borderWidth: 1, borderColor: Colors.border,
        ...Layout.shadow.sm,
    },
    summaryHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.s, marginBottom: Spacing.m },
    summaryIconWrap: {
        width: 28, height: 28, borderRadius: 8,
        backgroundColor: Colors.tertiaryLight,
        alignItems: 'center', justifyContent: 'center',
    },
    summaryTitle: { ...Typography.subtitle2, color: Colors.tertiary, fontWeight: '700' },
    tldr: { fontSize: 15, fontWeight: '600', color: Colors.textPrimary, lineHeight: 22, marginBottom: Spacing.m },
    divider: { height: 1, backgroundColor: Colors.divider, marginBottom: Spacing.m },
    pointRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.s, marginBottom: Spacing.s },
    pointDot: {
        width: 6, height: 6, borderRadius: 3,
        backgroundColor: Colors.tertiary, marginTop: 7,
    },
    pointText: { flex: 1, ...Typography.body2, lineHeight: 20 },

    // Transcript
    transcriptCard: {
        backgroundColor: Colors.surface,
        borderRadius: Layout.borderRadius.l,
        padding: Spacing.l,
        borderWidth: 1, borderColor: Colors.border,
        ...Layout.shadow.sm,
    },
    transcriptHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.s, marginBottom: Spacing.m },
    transcriptLabel: { ...Typography.caption, fontWeight: '600' },
    transcriptText: { ...Typography.body2, lineHeight: 24, color: Colors.textPrimary },

    // Bottom bar
    bottomBar: {
        position: 'absolute', bottom: 0, left: 0, right: 0,
        flexDirection: 'row',
        backgroundColor: Colors.surface,
        borderTopWidth: 1, borderTopColor: Colors.border,
        paddingBottom: Spacing.l,
        ...Layout.shadow.md,
    },
    bottomBtn: {
        flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        gap: Spacing.s, paddingVertical: Spacing.m,
    },
    bottomBtnText: { fontSize: 15, fontWeight: '600', color: Colors.primary },
    bottomDivider: { width: 1, backgroundColor: Colors.border, marginVertical: Spacing.s },
});
