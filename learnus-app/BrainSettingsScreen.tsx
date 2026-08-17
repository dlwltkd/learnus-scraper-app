import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Switch,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';

import { Spacing } from './constants/theme';
import type { ColorScheme, TypographyType, LayoutType } from './constants/theme';
import { useTheme } from './context/ThemeContext';
import { LEARNED_CONTENT } from './constants/brainContent';
import { getBrainCourses, rebuildCourseBrain, setCourseBrain } from './services/api';
import type { BrainCourse } from './services/api';

const POLL_MS = 5000;

/** "1.2만자" reads faster than "12,043자" and the exact figure carries no decision. */
function formatChars(chars: number): string {
    if (chars >= 10000) return `${(chars / 10000).toFixed(1)}만자`;
    if (chars >= 1000) return `${Math.round(chars / 1000)}천자`;
    return `${chars}자`;
}

function statusLine(course: BrainCourse): string {
    if (course.status === 'building' || course.status === 'queued') {
        return course.stage || '준비하는 중';
    }
    if (course.status === 'error') return '학습에 실패했어요';
    if (!course.enabled) {
        return course.learned.chars
            ? `학습 꺼짐 · 이전 학습 ${formatChars(course.learned.chars)} 보관 중`
            : '학습하지 않음';
    }
    if (course.pending.total) return `새 자료 ${course.pending.total}개 대기 중`;
    return `학습 완료 · ${formatChars(course.learned.chars)}`;
}

/**
 * Everything about the brain in one place: which courses are learned, how much of each,
 * what a build covers, and how new material is picked up.
 *
 * The opt-in sheet explains this once at the moment of the decision. This screen is
 * where it stays available afterwards — and the only place to see a course you enabled
 * months ago, what it cost, or why it failed.
 */
export default function BrainSettingsScreen() {
    const { colors, typography, layout, isDark } = useTheme();
    const styles = useMemo(
        () => createStyles(colors, typography, layout, isDark),
        [colors, typography, layout, isDark],
    );
    const navigation = useNavigation<any>();

    const [courses, setCourses] = useState<BrainCourse[] | null>(null);
    const [refreshing, setRefreshing] = useState(false);
    const [busy, setBusy] = useState<Record<number, boolean>>({});

    const load = useCallback(async () => {
        try {
            const data = await getBrainCourses();
            setCourses(data.courses);
        } catch {
            setCourses([]);
        } finally {
            setRefreshing(false);
        }
    }, []);

    useEffect(() => {
        navigation.setOptions({ title: '강의 브레인' });
        load();
    }, [navigation, load]);

    // Poll only while a build is actually moving.
    const anyBuilding = useMemo(
        () => Boolean(courses?.some(c => c.status === 'building' || c.status === 'queued')),
        [courses],
    );
    useEffect(() => {
        if (!anyBuilding) return;
        const timer = setInterval(load, POLL_MS);
        return () => clearInterval(timer);
    }, [anyBuilding, load]);

    const mark = (id: number, value: boolean) =>
        setBusy(prev => ({ ...prev, [id]: value }));

    const toggle = async (course: BrainCourse, enabled: boolean) => {
        mark(course.id, true);
        try {
            await setCourseBrain(course.id, { enabled });
            await load();
        } finally {
            mark(course.id, false);
        }
    };

    const setScope = async (course: BrainCourse, key: 'vods' | 'files' | 'assignments', value: boolean) => {
        mark(course.id, true);
        try {
            await setCourseBrain(course.id, { scope: { [key]: value } });
            await load();
        } finally {
            mark(course.id, false);
        }
    };

    const rebuild = async (course: BrainCourse) => {
        mark(course.id, true);
        try {
            await rebuildCourseBrain(course.id);
            await load();
        } finally {
            mark(course.id, false);
        }
    };

    if (!courses) {
        return (
            <View style={styles.centered}>
                <ActivityIndicator size="large" color={colors.primary} />
            </View>
        );
    }

    const enabledCount = courses.filter(c => c.enabled).length;
    const totalChars = courses.reduce((sum, c) => sum + c.learned.chars, 0);

    return (
        <SafeAreaView style={styles.container} edges={['bottom', 'left', 'right']}>
            <ScrollView
                contentContainerStyle={styles.content}
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={() => { setRefreshing(true); load(); }}
                        tintColor={colors.primary}
                        colors={[colors.primary]}
                    />
                }
            >
                <Text style={styles.lead}>
                    켠 강의의 자료를 학습해, 강의 내용을 근거로 질문에 답하고 어디서 나왔는지
                    알려줘요.
                </Text>
                <Text style={styles.summary}>
                    {enabledCount > 0
                        ? `${enabledCount}개 강의 학습 중 · 전체 ${formatChars(totalChars)}`
                        : '아직 학습 중인 강의가 없어요'}
                </Text>

                <Text style={styles.sectionTitle}>강의별 학습</Text>
                <View style={styles.group}>
                    {courses.map((course, index) => {
                        const building = course.status === 'building' || course.status === 'queued';
                        return (
                            <View
                                key={course.id}
                                style={[styles.courseRow, index > 0 && styles.rowBorderTop]}
                            >
                                <View style={styles.courseHead}>
                                    <View style={styles.courseText}>
                                        <Text style={styles.courseName} numberOfLines={1}>
                                            {course.name}
                                        </Text>
                                        <Text
                                            style={[
                                                styles.courseStatus,
                                                course.status === 'error' && styles.courseStatusError,
                                            ]}
                                            numberOfLines={2}
                                        >
                                            {statusLine(course)}
                                        </Text>
                                    </View>
                                    {busy[course.id] ? (
                                        <ActivityIndicator size="small" color={colors.primary} style={styles.switchSlot} />
                                    ) : (
                                        <Switch
                                            value={course.enabled}
                                            onValueChange={v => toggle(course, v)}
                                            trackColor={{ false: colors.border, true: colors.primary }}
                                            thumbColor={colors.surface}
                                        />
                                    )}
                                </View>

                                {building && (
                                    <View style={styles.track}>
                                        <View style={[styles.fill, { width: `${course.progress}%` }]} />
                                    </View>
                                )}

                                {/* Counts now sit on the scope rows below, where each one
                                    is next to the switch that governs it. */}
                                {course.enabled && !building && course.learned.captioned_pages > 0 && (
                                    <Text style={styles.breakdownItem}>
                                        슬라이드 그림 {course.learned.captioned_pages}쪽 포함
                                    </Text>
                                )}

                                {course.status === 'error' && course.error && (
                                    <Text style={styles.errorDetail} numberOfLines={3}>{course.error}</Text>
                                )}

                                {/* What this course learns. Per-course because the cost is
                                    lopsided — transcription dominates a build, so a course
                                    can be worth reading without being worth listening to. */}
                                {course.enabled && (
                                    <View style={styles.scopeBox}>
                                        {LEARNED_CONTENT.map(row => (
                                            <View key={row.key} style={styles.scopeRow}>
                                                <Ionicons name={row.icon} size={16} color={colors.textTertiary} />
                                                <Text style={styles.scopeLabel}>{row.title}</Text>
                                                <Text style={styles.scopeCount}>
                                                    {row.key === 'vods' && `${course.learned.vods}/${course.learned.total_vods}`}
                                                    {row.key === 'files' && `${course.learned.files}/${course.learned.total_files}`}
                                                    {row.key === 'assignments' && `${course.learned.assignments}/${course.learned.total_assignments}`}
                                                </Text>
                                                <Switch
                                                    value={course.scope[row.key]}
                                                    onValueChange={v => setScope(course, row.key, v)}
                                                    disabled={Boolean(busy[course.id])}
                                                    trackColor={{ false: colors.border, true: colors.primary }}
                                                    thumbColor={colors.surface}
                                                    style={styles.scopeSwitch}
                                                />
                                            </View>
                                        ))}
                                    </View>
                                )}

                                {course.enabled && !building && (
                                    <View style={styles.actions}>
                                        {course.pending.total > 0 && (
                                            <TouchableOpacity
                                                style={styles.action}
                                                activeOpacity={0.7}
                                                onPress={() => rebuild(course)}
                                            >
                                                <Text style={styles.actionText}>
                                                    남은 자료 학습하기
                                                </Text>
                                            </TouchableOpacity>
                                        )}
                                        <TouchableOpacity
                                            style={styles.action}
                                            activeOpacity={0.7}
                                            onPress={() => navigation.navigate('CourseLibrary', {
                                                courseId: course.id,
                                                courseName: course.name,
                                            })}
                                        >
                                            <Text style={styles.actionText}>자료 둘러보기</Text>
                                        </TouchableOpacity>
                                    </View>
                                )}
                            </View>
                        );
                    })}
                </View>

                <Text style={styles.sectionTitle}>학습하는 자료</Text>
                <View style={styles.group}>
                    {LEARNED_CONTENT.map((row, index) => (
                        <View key={row.key} style={[styles.infoRow, index > 0 && styles.rowBorderTop]}>
                            <Ionicons name={row.icon} size={20} color={colors.textSecondary} />
                            <View style={styles.infoText}>
                                <Text style={styles.infoTitle}>{row.title}</Text>
                                <Text style={styles.infoDetail}>{row.detail}</Text>
                            </View>
                        </View>
                    ))}
                </View>
                <Text style={styles.note}>
                    공지는 따로 학습하지 않아도 이미 포함돼요. 앱이 평소에 저장해 두거든요.
                </Text>

                <Text style={styles.sectionTitle}>자동 학습</Text>
                <View style={styles.group}>
                    <View style={styles.infoRow}>
                        <Ionicons name="sync-outline" size={20} color={colors.textSecondary} />
                        <View style={styles.infoText}>
                            <Text style={styles.infoTitle}>새 자료 따라 학습</Text>
                            <Text style={styles.infoDetail}>
                                켜 둔 강의에 새 자료나 강의가 올라오면 다음 동기화 때 자동으로
                                학습해요. 이미 학습한 자료는 다시 학습하지 않아요.
                            </Text>
                        </View>
                    </View>
                </View>
                <Text style={styles.note}>
                    학습을 끄면 그때까지 학습한 내용은 그대로 보관하고, 새 자료만 더 학습하지
                    않아요. 다시 켜면 기다릴 필요 없이 바로 쓸 수 있어요.
                </Text>
            </ScrollView>
        </SafeAreaView>
    );
}

const createStyles = (colors: ColorScheme, typography: TypographyType, layout: LayoutType, isDark: boolean) =>
    StyleSheet.create({
        container: { flex: 1, backgroundColor: colors.background },
        centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
        content: { padding: Spacing.l, paddingBottom: Spacing.xxl },

        lead: {
            ...typography.body2,
            color: colors.textSecondary,
            lineHeight: 21,
        },
        summary: {
            ...typography.subtitle1,
            marginTop: Spacing.s,
        },
        sectionTitle: {
            ...typography.overline,
            color: colors.textTertiary,
            marginTop: Spacing.xl,
            marginBottom: Spacing.s,
        },
        group: {
            backgroundColor: colors.surface,
            borderRadius: layout.borderRadius.l,
            borderWidth: 1,
            borderColor: colors.border,
            overflow: 'hidden',
        },
        rowBorderTop: {
            borderTopWidth: 1,
            borderTopColor: colors.divider,
        },

        courseRow: { paddingHorizontal: Spacing.m, paddingVertical: Spacing.m },
        courseHead: { flexDirection: 'row', alignItems: 'center' },
        courseText: { flex: 1, marginRight: Spacing.m },
        courseName: { ...typography.subtitle1, fontSize: 15, fontWeight: '600' },
        courseStatus: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
        courseStatusError: { color: colors.error },
        switchSlot: { width: 51 },

        track: {
            height: 4,
            borderRadius: 2,
            backgroundColor: colors.surfaceMuted,
            overflow: 'hidden',
            marginTop: Spacing.m,
        },
        fill: { height: '100%', borderRadius: 2, backgroundColor: colors.primary },

        breakdown: {
            flexDirection: 'row',
            flexWrap: 'wrap',
            marginTop: Spacing.s,
        },
        breakdownItem: {
            ...typography.caption,
            color: colors.textTertiary,
            marginRight: Spacing.m,
        },
        errorDetail: {
            ...typography.caption,
            color: colors.error,
            marginTop: Spacing.s,
        },

        scopeBox: {
            marginTop: Spacing.m,
            borderTopWidth: 1,
            borderTopColor: colors.divider,
            paddingTop: Spacing.xs,
        },
        scopeRow: {
            flexDirection: 'row',
            alignItems: 'center',
            paddingVertical: Spacing.xs,
        },
        scopeLabel: {
            ...typography.caption,
            color: colors.textSecondary,
            marginLeft: Spacing.s,
            flex: 1,
        },
        scopeCount: {
            ...typography.caption,
            color: colors.textTertiary,
            marginRight: Spacing.s,
        },
        scopeSwitch: {
            // Smaller than the course switch: this governs a part, not the whole.
            transform: [{ scaleX: 0.75 }, { scaleY: 0.75 }],
        },

        actions: { flexDirection: 'row', marginTop: Spacing.m },
        action: {
            paddingVertical: 6,
            paddingHorizontal: Spacing.m,
            borderRadius: layout.borderRadius.full,
            borderWidth: 1,
            borderColor: colors.border,
            marginRight: Spacing.s,
        },
        actionText: { ...typography.caption, color: colors.textPrimary, fontWeight: '600' },

        infoRow: {
            flexDirection: 'row',
            alignItems: 'flex-start',
            paddingHorizontal: Spacing.m,
            paddingVertical: Spacing.m,
        },
        infoText: { flex: 1, marginLeft: Spacing.m },
        infoTitle: { ...typography.subtitle1, fontSize: 15 },
        infoDetail: {
            ...typography.caption,
            color: colors.textSecondary,
            marginTop: 2,
            lineHeight: 18,
        },
        note: {
            ...typography.caption,
            color: colors.textTertiary,
            marginTop: Spacing.s,
            lineHeight: 18,
        },
    });
