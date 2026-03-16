import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
    View, Text, StyleSheet, ScrollView, TouchableOpacity,
    ActivityIndicator, Clipboard, Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Colors, Spacing, Layout, Typography } from './constants/theme';
import { useToast } from './context/ToastContext';
import { transcribeVod, getVodTranscript, summarizeVod } from './services/api';
import AIChatModal from './AIChatModal';

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
                        <Ionicons name="sparkles" size={16} color={Colors.tertiary} />
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
    const insets = useSafeAreaInsets();
    const { vodMoodleId, title, courseName } = route.params;
    const { showSuccess, showInfo, showError } = useToast();

    const [loading, setLoading] = useState(true);
    const [transcript, setTranscript] = useState<string | null>(null);
    const [error, setError] = useState(false);
    const [chatVisible, setChatVisible] = useState(false);
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

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} activeOpacity={0.7}>
                    <Ionicons name="chevron-back" size={24} color={Colors.textPrimary} />
                </TouchableOpacity>
                <View style={styles.headerCenter}>
                    <Text style={styles.headerSub} numberOfLines={1}>{courseName}</Text>
                    <Text style={styles.headerTitle} numberOfLines={1}>{title}</Text>
                </View>
            </View>

            {loading ? (
                <View style={styles.centered}>
                    <View style={styles.loadingIconWrap}>
                        <ActivityIndicator size="large" color={Colors.primary} />
                    </View>
                    <Text style={styles.loadingText}>텍스트 추출 중...</Text>
                    <Text style={styles.loadingSubText}>
                        AI가 강의 음성을 텍스트로 변환하고 있어요.{'\n'}
                        강의 길이에 따라 수 분이 걸릴 수 있어요.
                    </Text>
                    <Text style={styles.loadingHintInline}>완료되면 알림으로 알려드릴게요</Text>
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
                <View style={[styles.bottomBar, { paddingBottom: insets.bottom || Spacing.m }]}>
                    <TouchableOpacity style={styles.bottomBtn} onPress={handleCopy} activeOpacity={0.8}>
                        <Ionicons name="copy-outline" size={18} color={Colors.primary} />
                        <Text style={styles.bottomBtnText}>전체 복사</Text>
                    </TouchableOpacity>
                    <View style={styles.bottomDivider} />
                    <TouchableOpacity style={styles.bottomBtn} onPress={handleChat} activeOpacity={0.8}>
                        <Ionicons name="chatbubble-outline" size={18} color={Colors.tertiary} />
                        <Text style={[styles.bottomBtnText, { color: Colors.tertiary }]}>AI 질문</Text>
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

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.background },
    centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.xl },

    // Header
    header: {
        flexDirection: 'row', alignItems: 'center',
        paddingHorizontal: Spacing.l, paddingVertical: Spacing.m,
        backgroundColor: Colors.background,
    },
    backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', marginRight: Spacing.s },
    headerCenter: { flex: 1 },
    headerTitle: { ...Typography.header3, fontSize: 18 },
    headerSub: { ...Typography.caption, marginBottom: 2 },

    // Loading / Error
    loadingIconWrap: {
        width: 72, height: 72, borderRadius: 36,
        backgroundColor: Colors.primaryLighter,
        alignItems: 'center', justifyContent: 'center',
    },
    loadingText: { fontSize: 17, fontWeight: '700', color: Colors.textPrimary, marginTop: Spacing.l, marginBottom: Spacing.s, textAlign: 'center' },
    loadingSubText: { ...Typography.body2, color: Colors.textSecondary, textAlign: 'center', maxWidth: 280, lineHeight: 20 },
    loadingHintInline: { ...Typography.caption, color: Colors.textTertiary, marginTop: Spacing.xl, textAlign: 'center' },
    errorText: { ...Typography.subtitle2, color: Colors.error },
    retryBtn: {
        paddingHorizontal: Spacing.l, paddingVertical: Spacing.s,
        backgroundColor: Colors.primary, borderRadius: Layout.borderRadius.full,
    },
    retryText: { color: '#fff', fontWeight: '600', fontSize: 14 },

    // Scroll
    scrollContent: { padding: Spacing.l, gap: Spacing.m, paddingBottom: 120 },

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
    courseDesc: { ...Typography.caption, color: Colors.textSecondary, lineHeight: 18, marginBottom: Spacing.m, fontStyle: 'italic' },
    divider: { height: 1, backgroundColor: Colors.divider, marginBottom: Spacing.m },
    lectureDesc: { ...Typography.body2, lineHeight: 22, color: Colors.textPrimary },

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
        ...Layout.shadow.md,
    },
    bottomBtn: {
        flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        gap: Spacing.s, paddingVertical: Spacing.m,
    },
    bottomBtnText: { fontSize: 15, fontWeight: '600', color: Colors.primary },
    bottomDivider: { width: 1, backgroundColor: Colors.border, marginVertical: Spacing.s },
});
