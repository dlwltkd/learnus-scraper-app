import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    RefreshControl,
    TouchableOpacity,
    ActivityIndicator,
    StatusBar,
    Modal,
    Animated,
    LayoutAnimation,
    Platform,
    UIManager,
    Dimensions,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { Swipeable, RectButton } from 'react-native-gesture-handler';

import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { getDashboardOverview, syncAllActiveCourses, fetchAISummary, updateAssignmentStatus } from './services/api';
import { Spacing, Animation } from './constants/theme';
import type { ColorScheme, TypographyType, LayoutType } from './constants/theme';
import { useTheme } from './context/ThemeContext';
import { useUser } from './context/UserContext';
import { useToast } from './context/ToastContext';
import { getUnreadCount } from './services/NotificationHistoryService';
import Card from './components/Card';
import Badge, { StatusBadge } from './components/Badge';
import ItemRow from './components/ItemRow';
import { useTourRef } from './hooks/useTourRef';
import { useTour } from './context/TourContext';
import { TOUR_MOCK_OVERVIEW, FORCE_MOCK_MODE } from './constants/tourMockData';
import { isDemoMode } from './services/demoMode';
import { formatDeadline } from './utils/datetime';

if (Platform.OS === 'android') {
    if (UIManager.setLayoutAnimationEnabledExperimental) {
        UIManager.setLayoutAnimationEnabledExperimental(true);
    }
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ============================================
// STAT CARD COMPONENT
// ============================================
interface StatItemProps {
    label: string;
    value: number;
    total?: number;
    color?: string | null;
    icon: keyof typeof Ionicons.glyphMap;
}

const StatItem = ({ label, value, total, color, icon }: StatItemProps) => {
    const { colors, typography, layout, isDark } = useTheme();
    const styles = React.useMemo(() => createStyles(colors, typography, layout, isDark), [colors, typography, layout, isDark]);
    const resolvedColor = color ?? colors.primary;
    return (
        // Number leads, label follows: the number is the content, and this now
        // matches the stat card on the course detail screen. The icon tile is
        // gone because the label beside it already said the same thing.
        <View style={styles.statItem}>
            <View style={styles.statValueRow}>
                <Text style={[styles.statValue, { color: resolvedColor }]}>{value}</Text>
                {total !== undefined && (
                    <Text style={styles.statTotal}>/{total}</Text>
                )}
            </View>
            <Text style={styles.statLabel}>{label}</Text>
        </View>
    );
};

// ============================================
// AI SUMMARY TYPES & CONFIG
// ============================================
const CARD_WIDTH = SCREEN_WIDTH * 0.78;
const CARD_HEIGHT = 195;

// Built from theme colors rather than baked hex. As module-level constants these were
// light-mode values that never shifted, so in dark mode the AI briefing rendered its
// status colors at full light-mode saturation against a near-black card.
const getStatusConfig = (colors: ColorScheme) => ({
    calm: {
        color: colors.success,
        bgColor: colors.successLight,
        borderColor: colors.successLight,
        icon: 'checkmark-circle' as const,
        label: '여유',
    },
    busy: {
        color: colors.warning,
        bgColor: colors.warningLight,
        borderColor: colors.warningLight,
        icon: 'time' as const,
        label: '바쁨',
    },
    urgent: {
        color: colors.error,
        bgColor: colors.errorLight,
        borderColor: colors.errorLight,
        icon: 'alert-circle' as const,
        label: '긴급',
    },
});

/**
 * Colour marks only a deadline that is genuinely now. Shared by the card and the detail
 * sheet so "red means act today" means the same thing in both places.
 */
const isDueNow = (due: string) => due === '오늘' || due === 'D-1';

interface SummaryItem {
    title: string;
    due: string;
    type: 'assignment' | 'vod';
}

interface AISummary {
    course_id: number;
    course_name: string;
    status: 'calm' | 'busy' | 'urgent';
    status_message: string;
    urgent: { count: number; items: SummaryItem[] };
    upcoming: { count: number; items: SummaryItem[] };
    announcement: { has_new: boolean; summary: string | null };
    insight: string;
}

// ============================================
// AI SUMMARY SKELETON
// ============================================
//
// The loading state is the shape of the result: the same card frame, in the same
// carousel, with grey blocks where the text will land. Previously loading was a
// static row that looked like a button, so the section changed shape twice on its
// way to showing anything — once into the "button", once into the cards.
//
// The pulse is a single opacity loop shared by every block. Deliberately slow and
// low-contrast; it should read as "working", not as an animation worth watching.
const AISummarySkeleton = ({ index }: { index: number }) => {
    const { colors, typography, layout, isDark } = useTheme();
    const aiStyles = React.useMemo(() => createAiStyles(colors, typography, layout, isDark), [colors, typography, layout, isDark]);
    const pulse = useRef(new Animated.Value(0.45)).current;

    useEffect(() => {
        const loop = Animated.loop(
            Animated.sequence([
                Animated.timing(pulse, { toValue: 1, duration: 750, delay: index * 120, useNativeDriver: true }),
                Animated.timing(pulse, { toValue: 0.45, duration: 750, useNativeDriver: true }),
            ])
        );
        loop.start();
        return () => loop.stop();
    }, [pulse, index]);

    const Block = ({ w, h = 12 }: { w: number | string; h?: number }) => (
        <Animated.View
            style={[aiStyles.skeletonBlock, { width: w as any, height: h, opacity: pulse }]}
        />
    );

    return (
        <View style={aiStyles.cardShadow}>
            <View style={aiStyles.card}>
                <View style={aiStyles.cardContent}>
                    <View style={aiStyles.cardHeader}>
                        <Block w="55%" h={14} />
                        <Block w={44} h={20} />
                    </View>
                    <View style={{ gap: 8, marginTop: 10 }}>
                        <Block w="90%" />
                        <Block w="70%" />
                    </View>
                    <View style={{ gap: 8, marginTop: 18 }}>
                        <Block w="80%" h={10} />
                        <Block w="45%" h={10} />
                    </View>
                </View>
            </View>
        </View>
    );
};

// ============================================
// AI SUMMARY CARD (Fixed Height)
// ============================================
const AISummaryCard = ({ summary, onPress, index }: { summary: AISummary; onPress: () => void; index: number }) => {
    const { colors, typography, layout, isDark } = useTheme();
    const aiStyles = React.useMemo(() => createAiStyles(colors, typography, layout, isDark), [colors, typography, layout, isDark]);
    const slideAnim = useRef(new Animated.Value(40)).current;
    const opacityAnim = useRef(new Animated.Value(0)).current;
    const scaleAnim = useRef(new Animated.Value(0.95)).current;

    const STATUS_CONFIG = getStatusConfig(colors);
    const statusConfig = STATUS_CONFIG[summary.status] || STATUS_CONFIG.calm;
    const topItem = summary.urgent?.items?.[0] || summary.upcoming?.items?.[0] || null;

    useEffect(() => {
        Animated.parallel([
            Animated.spring(slideAnim, {
                toValue: 0,
                tension: 50,
                friction: 8,
                delay: index * 80,
                useNativeDriver: true,
            }),
            Animated.timing(opacityAnim, {
                toValue: 1,
                duration: 300,
                delay: index * 80,
                useNativeDriver: true,
            }),
            Animated.spring(scaleAnim, {
                toValue: 1,
                tension: 50,
                friction: 8,
                delay: index * 80,
                useNativeDriver: true,
            }),
        ]).start();
    }, []);

    return (
        <Animated.View
            style={[
                aiStyles.cardShadow,
                {
                    transform: [{ translateX: slideAnim }, { scale: scaleAnim }],
                    opacity: opacityAnim,
                },
            ]}
        >
            <TouchableOpacity
                style={aiStyles.card}
                onPress={onPress}
                activeOpacity={0.92}
            >

                {/* Card Content */}
                <View style={aiStyles.cardContent}>
                    {/* Header */}
                    <View style={aiStyles.cardHeader}>
                        <View style={aiStyles.courseInfo}>
                            <Text style={aiStyles.courseName} numberOfLines={1}>
                                {summary.course_name}
                            </Text>
                        </View>
                        <View style={[aiStyles.statusBadge, { backgroundColor: statusConfig.bgColor }]}>
                            <Ionicons name={statusConfig.icon} size={11} color={statusConfig.color} />
                            <Text style={[aiStyles.statusLabel, { color: statusConfig.color }]}>
                                {statusConfig.label}
                            </Text>
                        </View>
                    </View>

                    {/* Status Message */}
                    <Text style={aiStyles.statusMessage} numberOfLines={2}>
                        {summary.status_message}
                    </Text>

                    {/* Top priority item. The dot that used to sit here repeated what the
                        due text beside it already said, in the same colour. Colour is kept
                        for a deadline that is genuinely now — the same rule the detail
                        sheet uses — so it means something when it appears. */}
                    {topItem ? (
                        <View style={aiStyles.priorityPreview}>
                            <Text style={aiStyles.priorityText} numberOfLines={1}>
                                {topItem.title}
                            </Text>
                            <Text style={[
                                aiStyles.priorityDue,
                                { color: isDueNow(topItem.due) ? colors.error : colors.textSecondary },
                            ]}>
                                {topItem.due}
                            </Text>
                        </View>
                    ) : null}

                    {/* Quick chips + footer row */}
                    <View style={aiStyles.cardFooter}>
                        {/* Counts are information; the hue was not. These carried the same
                            red and amber as the status badge above, so the card said one
                            thing in four colours. Neutral chips leave the badge as the
                            single coloured signal. */}
                        <View style={aiStyles.chipsRow}>
                            {summary.urgent?.count > 0 && (
                                <View style={aiStyles.chip}>
                                    <Text style={aiStyles.chipText}>긴급 {summary.urgent.count}</Text>
                                </View>
                            )}
                            {summary.upcoming?.count > 0 && (
                                <View style={aiStyles.chip}>
                                    <Text style={aiStyles.chipText}>예정 {summary.upcoming.count}</Text>
                                </View>
                            )}
                            {!summary.urgent?.count && !summary.upcoming?.count && (
                                <View style={aiStyles.chip}>
                                    <Text style={aiStyles.chipText}>여유</Text>
                                </View>
                            )}
                        </View>
                        <View style={aiStyles.viewMoreRow}>
                            <Text style={aiStyles.viewMore}>자세히</Text>
                            <Ionicons name="chevron-forward" size={12} color={colors.textTertiary} />
                        </View>
                    </View>
                </View>
            </TouchableOpacity>
        </Animated.View>
    );
};

// ============================================
// AI SUMMARY MODAL (Bottom Sheet Style)
// ============================================
const AISummaryModal = ({
    summary,
    visible,
    onClose,
}: {
    summary: AISummary | null;
    visible: boolean;
    onClose: () => void;
}) => {
    const { colors, typography, layout, isDark } = useTheme();
    const modalStyles = React.useMemo(() => createModalStyles(colors, typography, layout, isDark), [colors, typography, layout, isDark]);
    const slideAnim = useRef(new Animated.Value(300)).current;
    const backdropAnim = useRef(new Animated.Value(0)).current;
    const insets = useSafeAreaInsets();

    useEffect(() => {
        if (visible) {
            Animated.parallel([
                Animated.spring(slideAnim, {
                    toValue: 0,
                    tension: 65,
                    friction: 11,
                    useNativeDriver: true,
                }),
                Animated.timing(backdropAnim, {
                    toValue: 1,
                    duration: 200,
                    useNativeDriver: true,
                }),
            ]).start();
        } else {
            slideAnim.setValue(300);
            backdropAnim.setValue(0);
        }
    }, [visible]);

    if (!summary) return null;

    const STATUS_CONFIG = getStatusConfig(colors);
    const statusConfig = STATUS_CONFIG[summary.status] || STATUS_CONFIG.calm;

    // 긴급 and 예정 were two sections with two headers and two empty states. They are one
    // queue: the API already returns them in the order the student will work them, and
    // each row states its own deadline precisely.
    const tasks = [...(summary.urgent?.items || []), ...(summary.upcoming?.items || [])];
    const announcement = summary.announcement?.summary;

    return (
        <Modal animationType="none" transparent visible={visible} onRequestClose={onClose}>
            <Animated.View style={[modalStyles.backdrop, { opacity: backdropAnim }]}>
                <TouchableOpacity style={{ flex: 1 }} onPress={onClose} activeOpacity={1} />
            </Animated.View>

            <Animated.View style={[modalStyles.container, { transform: [{ translateY: slideAnim }], paddingBottom: insets.bottom }]}>
                <View style={modalStyles.handleContainer}>
                    <View style={modalStyles.handle} />
                </View>

                {/* Name, then the model's one-line verdict. The status word is the only
                    coloured thing in the sheet, so it reads at a glance without a filled
                    tile competing beside it. */}
                <View style={modalStyles.header}>
                    <View style={modalStyles.headerTop}>
                        <Text style={modalStyles.courseTitle} numberOfLines={1}>
                            {summary.course_name}
                        </Text>
                        <TouchableOpacity
                            onPress={onClose}
                            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                        >
                            <Ionicons name="close" size={20} color={colors.textTertiary} />
                        </TouchableOpacity>
                    </View>
                    <Text style={modalStyles.statusLine}>
                        <Text style={{ color: statusConfig.color, fontWeight: '600' }}>
                            {statusConfig.label}
                        </Text>
                        {'  '}{summary.status_message}
                    </Text>
                </View>

                {/* Sections render only when they hold something, so a calm week produces a
                    short sheet rather than three headers over three "없어요" lines. The
                    length of the sheet is itself the signal. */}
                <ScrollView
                    style={modalStyles.content}
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={modalStyles.contentInner}
                >
                    {tasks.length > 0 && (
                        <View style={modalStyles.section}>
                            <Text style={modalStyles.sectionTitle}>할 일</Text>
                            <View style={modalStyles.group}>
                                {tasks.map((item, idx) => (
                                    <View
                                        key={`${item.title}-${idx}`}
                                        style={[modalStyles.row, idx > 0 && modalStyles.rowBorder]}
                                    >
                                        <Text style={modalStyles.rowTitle} numberOfLines={2}>
                                            {item.title}
                                        </Text>
                                        <Text style={[
                                            modalStyles.rowDue,
                                            isDueNow(item.due) && { color: colors.error },
                                        ]}>
                                            {item.due}
                                        </Text>
                                    </View>
                                ))}
                            </View>
                        </View>
                    )}

                    {announcement ? (
                        <View style={modalStyles.section}>
                            <Text style={modalStyles.sectionTitle}>
                                공지사항{summary.announcement?.has_new ? ' · 새 공지' : ''}
                            </Text>
                            <View style={modalStyles.group}>
                                <Text style={modalStyles.bodyText}>{announcement}</Text>
                            </View>
                        </View>
                    ) : null}

                    {/* Facts above, interpretation below. The label says this block is
                        written rather than scraped; it does not need an icon to say so. */}
                    {summary.insight ? (
                        <View style={modalStyles.section}>
                            <Text style={modalStyles.sectionTitle}>AI 코멘트</Text>
                            <View style={modalStyles.group}>
                                <Text style={modalStyles.bodyText}>{summary.insight}</Text>
                            </View>
                        </View>
                    ) : null}
                </ScrollView>
            </Animated.View>
        </Modal>
    );
};

// ============================================
// SECTION HEADER
// ============================================
interface SectionHeaderProps {
    title: string;
    icon: keyof typeof Ionicons.glyphMap;
    iconColor?: string | null;
    count?: number;
    isCollapsible?: boolean;
    isCollapsed?: boolean;
    onToggle?: () => void;
    action?: React.ReactNode;
}

const SectionHeader = ({
    title,
    icon,
    iconColor,
    count,
    isCollapsible,
    isCollapsed,
    onToggle,
    action,
}: SectionHeaderProps) => {
    const { colors, typography, layout, isDark } = useTheme();
    const styles = React.useMemo(() => createStyles(colors, typography, layout, isDark), [colors, typography, layout, isDark]);
    const resolvedIconColor = iconColor ?? colors.primary;
    return (
        <View style={styles.sectionHeader}>
            <TouchableOpacity
                style={styles.sectionHeaderLeft}
                onPress={isCollapsible ? onToggle : undefined}
                activeOpacity={isCollapsible ? 0.7 : 1}
                disabled={!isCollapsible}
            >
                {/* No icon: the glyph only ever restated the title beside it. */}
                <Text style={styles.sectionTitle}>{title}</Text>
                {isCollapsible && isCollapsed && count !== undefined && count > 0 && (
                    <View style={styles.countBadge}>
                        <Text style={styles.countText}>{count}</Text>
                    </View>
                )}
                {isCollapsible && (
                    <Ionicons
                        name={isCollapsed ? 'chevron-down' : 'chevron-up'}
                        size={20}
                        color={colors.textTertiary}
                        style={{ marginLeft: 8 }}
                    />
                )}
            </TouchableOpacity>
            {action}
        </View>
    );
};

// AssignmentItem is now handled by the shared ItemRow component

// ============================================
// MAIN DASHBOARD SCREEN
// ============================================
const DashboardScreen = () => {
    const { colors, typography, layout, isDark } = useTheme();
    const styles = React.useMemo(() => createStyles(colors, typography, layout, isDark), [colors, typography, layout, isDark]);
    const modalStyles = React.useMemo(() => createModalStyles(colors, typography, layout, isDark), [colors, typography, layout, isDark]);
    const navigation = useNavigation();
    const { profile } = useUser();
    const { showSuccess, showError } = useToast();
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [data, setData] = useState<any>(null);
    const [syncing, setSyncing] = useState(false);
    const [unreadNotifications, setUnreadNotifications] = useState(0);
    const [assignmentUpdating, setAssignmentUpdating] = useState<Record<string, boolean>>({});

    // Tour
    const { isActive: tourActive } = useTour();
    const tourActiveRef = useRef(false);
    const prevTourActive = useRef(false);
    const statsRef = useTourRef('dashboard-stats');
    const aiSectionRef = useTourRef('dashboard-ai-section');

    useEffect(() => {
        const mockActive = tourActive || FORCE_MOCK_MODE || isDemoMode();
        tourActiveRef.current = mockActive;
        if (mockActive) {
            setData(TOUR_MOCK_OVERVIEW);
            setLoading(false);
        } else if (prevTourActive.current) {
            loadDashboard();
        }
        prevTourActive.current = mockActive;
    }, [tourActive]);

    // Collapsible state
    const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({
        missedAssignments: false,
    });

    // AI Summary state
    const [aiSummaries, setAiSummaries] = useState<AISummary[]>([]);
    const [loadingAI, setLoadingAI] = useState(false);
    const [selectedSummary, setSelectedSummary] = useState<AISummary | null>(null);

    // Animations
    const syncRotation = useRef(new Animated.Value(0)).current;
    const headerOpacity = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        loadDashboard();
        Animated.timing(headerOpacity, {
            toValue: 1,
            duration: 600,
            useNativeDriver: true,
        }).start();
    }, []);

    const toggleSection = (key: string) => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setCollapsedSections(prev => ({ ...prev, [key]: !prev[key] }));
    };

    const loadDashboard = async () => {
        if (tourActiveRef.current) return;
        try {
            const result = await getDashboardOverview();
            if (tourActiveRef.current) return;
            setData(result);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const loadUnreadCount = async () => {
        const count = await getUnreadCount();
        setUnreadNotifications(count);
    };

    useFocusEffect(
        useCallback(() => {
            loadUnreadCount();
        }, [])
    );

    const onRefresh = useCallback(() => {
        setRefreshing(true);
        loadDashboard();
        loadUnreadCount();
    }, []);

    const getAssignmentKey = (item: any) => `${item.course_id ?? 'unknown'}:${item.id}`;

    const applyAssignmentStatusToDashboardData = (prev: any, item: any, nextCompleted: boolean) => {
        if (!prev) return prev;

        const matched = (a: any) => a.id === item.id && a.course_id === item.course_id;
        const wasUpcomingPending = (prev.upcoming_assignments ?? []).some((a: any) => matched(a) && !a.is_completed);
        const wasUpcomingCompleted = (prev.upcoming_assignments ?? []).some((a: any) => matched(a) && !!a.is_completed);
        const wasMissed = (prev.missed_assignments ?? []).some((a: any) => matched(a));

        const updatedUpcoming = (prev.upcoming_assignments ?? []).map((a: any) =>
            matched(a)
                ? { ...a, is_completed: nextCompleted, completion_overridden: true }
                : a
        );

        const updatedMissed = nextCompleted
            ? (prev.missed_assignments ?? []).filter((a: any) => !matched(a))
            : (prev.missed_assignments ?? []);

        const nextStats = { ...(prev.stats ?? {}) };
        if (nextCompleted && wasUpcomingPending) {
            nextStats.completed_assignments_due = Math.min(
                (nextStats.total_assignments_due ?? 0),
                (nextStats.completed_assignments_due ?? 0) + 1,
            );
        }
        if (!nextCompleted && wasUpcomingCompleted) {
            nextStats.completed_assignments_due = Math.max(
                0,
                (nextStats.completed_assignments_due ?? 0) - 1,
            );
        }
        if (nextCompleted && wasMissed) {
            nextStats.missed_assignments_count = Math.max(
                0,
                (nextStats.missed_assignments_count ?? 0) - 1,
            );
        }

        return {
            ...prev,
            upcoming_assignments: updatedUpcoming,
            missed_assignments: updatedMissed,
            stats: nextStats,
        };
    };

    const handleSetAssignmentStatus = async (item: any, nextCompleted: boolean) => {
        if (!item?.course_id) {
            showError('완료 처리 실패', '과제 정보를 찾을 수 없어요. 새로고침 후 다시 시도해주세요.');
            return;
        }

        const itemKey = getAssignmentKey(item);
        if (assignmentUpdating[itemKey]) return;

        let rollbackSnapshot: any = null;
        setAssignmentUpdating(prev => ({ ...prev, [itemKey]: true }));
        setData((prev: any) => {
            rollbackSnapshot = prev;
            return applyAssignmentStatusToDashboardData(prev, item, nextCompleted);
        });

        try {
            await updateAssignmentStatus(item.course_id, item.id, nextCompleted, true);
            showSuccess(
                nextCompleted ? '완료 처리됨' : '미완료로 변경됨',
                '수동 상태로 저장되어 동기화 후에도 유지됩니다.',
            );
        } catch (e) {
            setData(rollbackSnapshot);
            showError(
                nextCompleted ? '완료 처리 실패' : '미완료 변경 실패',
                '네트워크 상태를 확인하고 다시 시도해주세요.',
            );
        } finally {
            setAssignmentUpdating(prev => ({ ...prev, [itemKey]: false }));
        }
    };

    const loadAISummaries = async () => {
        setLoadingAI(true);
        try {
            const res = await fetchAISummary();
            if (res.summaries) {
                setAiSummaries(res.summaries);
            }
        } catch (e) {
            console.error(e);
            showError('오류', 'AI 요약을 불러오지 못했어요.');
        } finally {
            setLoadingAI(false);
        }
    };

    const handleSyncAll = async () => {
        setSyncing(true);
        // Start rotation animation
        Animated.loop(
            Animated.timing(syncRotation, {
                toValue: 1,
                duration: 1000,
                useNativeDriver: true,
            })
        ).start();

        try {
            await syncAllActiveCourses();
            await loadDashboard();
            showSuccess('동기화 완료', '모든 활성 강의를 동기화했어요.');
        } catch (e) {
            showError('동기화 실패', '일부 강의를 동기화하지 못했어요.');
        } finally {
            setSyncing(false);
            syncRotation.stopAnimation();
            syncRotation.setValue(0);
        }
    };



    const spin = syncRotation.interpolate({
        inputRange: [0, 1],
        outputRange: ['0deg', '360deg'],
    });

    const getGreeting = () => {
        const hour = new Date().getHours();
        const name = profile.name;
        let greeting = '';
        if (hour < 12) greeting = '좋은 아침이에요';
        else if (hour < 18) greeting = '좋은 오후에요';
        else greeting = '좋은 저녁이에요';

        return name ? `${name}님,\n${greeting}` : greeting;
    };

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={colors.primary} />
            </View>
        );
    }

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={colors.background} />

            <ScrollView
                contentContainerStyle={styles.scrollContent}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={onRefresh}
                        tintColor={colors.primary}
                        colors={[colors.primary]}
                    />
                }
                showsVerticalScrollIndicator={false}
            >
                {/* Header */}
                <Animated.View style={[styles.header, { opacity: headerOpacity }]}>
                    <View style={styles.headerText}>
                        <Text style={styles.greeting}>{getGreeting()}</Text>
                        <Text style={styles.date}>
                            {new Date().toLocaleDateString('ko-KR', {
                                month: 'long',
                                day: 'numeric',
                                weekday: 'long',
                            })}
                        </Text>
                    </View>

                    <View style={styles.headerButtons}>
                        {/* Notification History Button */}
                        <TouchableOpacity
                            style={styles.headerButton}
                            onPress={() => (navigation as any).navigate('NotificationHistory')}
                            activeOpacity={0.8}
                        >
                            <Ionicons
                                name="notifications-outline"
                                size={22}
                                color={colors.textSecondary}
                            />
                            {unreadNotifications > 0 && (
                                <View style={styles.notificationBadge}>
                                    <Text style={styles.notificationBadgeText}>
                                        {unreadNotifications > 9 ? '9+' : unreadNotifications}
                                    </Text>
                                </View>
                            )}
                        </TouchableOpacity>

                        {/* Sync Button */}
                        <TouchableOpacity
                            style={[styles.headerButton, syncing && styles.syncButtonActive]}
                            onPress={handleSyncAll}
                            disabled={syncing}
                            activeOpacity={0.8}
                        >
                            <Animated.View style={{ transform: [{ rotate: spin }] }}>
                                <Ionicons
                                    name="refresh"
                                    size={22}
                                    color={syncing ? colors.primary : colors.textSecondary}
                                />
                            </Animated.View>
                        </TouchableOpacity>
                    </View>
                </Animated.View>

                {/* Stats Card */}
                <View ref={statsRef} style={styles.statsCard} collapsable={false}>
                    <Text style={styles.statsTitle}>이번 주 학습 현황</Text>
                    <View style={styles.statsGrid}>
                        <StatItem
                            label="과제/퀴즈"
                            value={data?.stats?.completed_assignments_due || 0}
                            total={data?.stats?.total_assignments_due || 0}
                            color={colors.primary}
                            icon="clipboard-outline"
                        />
                        <View style={styles.statsDivider} />
                        <StatItem
                            label="놓친 강의"
                            value={data?.stats?.missed_vods_count || 0}
                            // Nothing missed means nothing to act on, so the number
                            // stays neutral. Green shouted as loudly as red did.
                            color={(data?.stats?.missed_vods_count || 0) > 0 ? colors.error : colors.textPrimary}
                            icon="videocam-outline"
                        />
                        <View style={styles.statsDivider} />
                        <StatItem
                            label="놓친 과제"
                            value={data?.stats?.missed_assignments_count || 0}
                            color={(data?.stats?.missed_assignments_count || 0) > 0 ? colors.error : colors.textPrimary}
                            icon="alert-circle-outline"
                        />
                    </View>
                </View>

                {/* AI Briefing Section */}
                <View style={styles.section}>
                    <View ref={aiSectionRef} collapsable={false}>
                    <SectionHeader
                        title="AI 브리핑"
                        icon="sparkles"
                        iconColor={colors.primary}
                        action={
                            aiSummaries.length > 0 && !loadingAI ? (
                                <TouchableOpacity
                                    style={modalStyles.aiRefreshButton}
                                    onPress={loadAISummaries}
                                    activeOpacity={0.6}
                                >
                                    <Ionicons name="refresh-outline" size={16} color={colors.textTertiary} />
                                </TouchableOpacity>
                            ) : null
                        }
                    />

                    {/* An optional feature shouldn't out-shout the deadlines below it.
                        This was a full-width primary pill — the loudest thing on Home —
                        for a section that had no content yet and never said what a
                        briefing was. It reads as a row now, like everything else, and
                        the loading state reuses the same container so the section keeps
                        its shape instead of jumping as it fills in. */}
                    {!loadingAI && aiSummaries.length === 0 && (
                        <TouchableOpacity
                            style={styles.aiPromptRow}
                            onPress={loadAISummaries}
                            activeOpacity={0.6}
                        >
                            <View style={styles.aiPromptText}>
                                <Text style={styles.aiPromptTitle}>요약 생성하기</Text>
                                <Text style={styles.aiPromptSubtitle}>강의별 할 일을 한눈에</Text>
                            </View>
                            <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
                        </TouchableOpacity>
                    )}
                    </View>

                    {loadingAI && (
                        <ScrollView
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            scrollEnabled={false}
                            contentContainerStyle={{ paddingHorizontal: Spacing.l, paddingVertical: 8 }}
                            style={{ marginHorizontal: -Spacing.l, marginVertical: -8 }}
                        >
                            {[0, 1, 2].map(i => <AISummarySkeleton key={i} index={i} />)}
                        </ScrollView>
                    )}

                    {aiSummaries.length > 0 && (
                        <ScrollView
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            contentContainerStyle={{ paddingHorizontal: Spacing.l, paddingVertical: 8 }}
                            style={{ marginHorizontal: -Spacing.l, marginVertical: -8 }}
                            decelerationRate="fast"
                            snapToInterval={CARD_WIDTH + Spacing.m}
                            snapToAlignment="start"
                        >
                            {[...aiSummaries].sort((a, b) => {
                                const order = { urgent: 0, busy: 1, calm: 2 };
                                return (order[a.status] ?? 2) - (order[b.status] ?? 2);
                            }).map((item, index) => (
                                <AISummaryCard
                                    key={item.course_id}
                                    summary={item}
                                    index={index}
                                    onPress={() => setSelectedSummary(item)}
                                />
                            ))}
                        </ScrollView>
                    )}
                </View>

                {/* Missed Assignments */}
                {data?.missed_assignments?.length > 0 && (
                    <View style={styles.section}>
                        <SectionHeader
                            title="마감 지난 과제"
                            icon="warning"
                            iconColor={colors.error}
                            count={data.missed_assignments.length}
                            isCollapsible
                            isCollapsed={collapsedSections.missedAssignments}
                            onToggle={() => toggleSection('missedAssignments')}
                        />
                        {!collapsedSections.missedAssignments && (
                            <Text style={styles.swipeHint}>좌우로 밀어서 완료/되돌리기</Text>
                        )}
                        {!collapsedSections.missedAssignments &&
                            [...data.missed_assignments].sort((a: any, b: any) => (a.due_date ? new Date(a.due_date).getTime() : Infinity) - (b.due_date ? new Date(b.due_date).getTime() : Infinity)).map((item: any) => {
                                const itemKey = getAssignmentKey(item);
                                const isUpdating = !!assignmentUpdating[itemKey];
                                return (
                                    <Swipeable
                                        key={item.id}
                                        friction={2}
                                        leftThreshold={60}
                                        overshootLeft={false}
                                        overshootRight={false}
                                        enabled={!!item.course_id && !isUpdating}
                                        renderLeftActions={() => (
                                            <RectButton
                                                style={[styles.swipeAction, styles.swipeActionComplete]}
                                                onPress={() => handleSetAssignmentStatus(item, true)}
                                            >
                                                {isUpdating ? (
                                                    <ActivityIndicator size="small" color={colors.textInverse} />
                                                ) : (
                                                    <>
                                                        <Ionicons name="checkmark-done-outline" size={18} color={colors.textInverse} />
                                                        <Text style={styles.swipeActionText}>완료</Text>
                                                    </>
                                                )}
                                            </RectButton>
                                        )}
                                    >
                                        <ItemRow
                                            title={item.title}
                                            courseName={item.course_name}
                                            meta={formatDeadline(item.due_date) || undefined}
                                            state="missed"
                                            type="assignment"
                                        />
                                    </Swipeable>
                                );
                            })}
                    </View>
                )}

                {/* Upcoming Assignments */}
                {data?.upcoming_assignments?.length > 0 && (
                    <View style={styles.section}>
                        <SectionHeader
                            title="다가오는 과제"
                            icon="calendar"
                            iconColor={colors.primary}
                        />
                        <Text style={styles.swipeHint}>좌우로 밀어서 완료/되돌리기</Text>
                        {[...data.upcoming_assignments].sort((a: any, b: any) => (a.due_date ? new Date(a.due_date).getTime() : Infinity) - (b.due_date ? new Date(b.due_date).getTime() : Infinity)).map((item: any) => {
                            const itemKey = getAssignmentKey(item);
                            const isUpdating = !!assignmentUpdating[itemKey];
                            return (
                                <Swipeable
                                    key={item.id}
                                    friction={2}
                                    leftThreshold={60}
                                    rightThreshold={80}
                                    overshootLeft={false}
                                    overshootRight={false}
                                    enabled={!!item.course_id && !isUpdating}
                                    renderLeftActions={() => (
                                        !item.is_completed ? (
                                            <RectButton
                                                style={[styles.swipeAction, styles.swipeActionComplete]}
                                                onPress={() => handleSetAssignmentStatus(item, true)}
                                            >
                                                {isUpdating ? (
                                                    <ActivityIndicator size="small" color={colors.textInverse} />
                                                ) : (
                                                    <>
                                                        <Ionicons name="checkmark-done-outline" size={18} color={colors.textInverse} />
                                                        <Text style={styles.swipeActionText}>완료</Text>
                                                    </>
                                                )}
                                            </RectButton>
                                        ) : <View />
                                    )}
                                    renderRightActions={() => (
                                        item.is_completed ? (
                                            <RectButton
                                                style={[styles.swipeAction, styles.swipeActionUndo]}
                                                onPress={() => handleSetAssignmentStatus(item, false)}
                                            >
                                                {isUpdating ? (
                                                    <ActivityIndicator size="small" color={colors.textInverse} />
                                                ) : (
                                                    <>
                                                        <Ionicons name="refresh-outline" size={18} color={colors.textInverse} />
                                                        <Text style={styles.swipeActionText}>되돌리기</Text>
                                                    </>
                                                )}
                                            </RectButton>
                                        ) : <View />
                                    )}
                                >
                                    <ItemRow
                                        title={item.title}
                                        courseName={item.course_name}
                                        meta={formatDeadline(item.due_date) || undefined}
                                        state={item.is_completed ? 'completed' : 'pending'}
                                        type="assignment"
                                    />
                                </Swipeable>
                            );
                        })}
                    </View>
                )}

                {/* Empty state */}
                {!data?.missed_assignments?.length && !data?.upcoming_assignments?.length && (
                    <View style={styles.emptyState}>
                        <View style={styles.emptyIcon}>
                            <Ionicons name="checkmark-done" size={48} color={colors.success} />
                        </View>
                        <Text style={styles.emptyTitle}>모든 과제를 완료했어요!</Text>
                        <Text style={styles.emptySubtitle}>잠시 쉬어가세요</Text>
                    </View>
                )}

                <View style={{ height: 40 }} />
            </ScrollView>

            {/* AI Summary Modal */}
            <AISummaryModal
                summary={selectedSummary}
                visible={!!selectedSummary}
                onClose={() => setSelectedSummary(null)}
            />
        </SafeAreaView>
    );
};

// ============================================
// AI CARD STYLES
// ============================================
const createAiStyles = (colors: ColorScheme, typography: TypographyType, layout: LayoutType, isDark: boolean) => StyleSheet.create({
    // Outer wrapper: holds shadow, no overflow clip
    cardShadow: {
        width: CARD_WIDTH,
        marginRight: Spacing.m,
        borderRadius: 16,
        backgroundColor: colors.surface,
        ...layout.shadow.default,
    },
    skeletonBlock: {
        backgroundColor: colors.surfaceMuted,
        borderRadius: 6,
    },
    card: {
        borderRadius: 16,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
        minHeight: CARD_HEIGHT,
    },
    cardContent: {
        flex: 1,
        padding: Spacing.m,
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 6,
    },
    courseInfo: {
        flex: 1,
        marginRight: Spacing.s,
    },
    statusBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 7,
        paddingVertical: 3,
        borderRadius: 8,
        gap: 3,
    },
    statusLabel: {
        fontSize: 10,
        fontWeight: '600',
    },
    courseName: {
        fontSize: 14,
        fontWeight: '700',
        color: colors.textPrimary,
        letterSpacing: -0.2,
    },
    statusMessage: {
        fontSize: 13,
        lineHeight: 19,
        color: colors.textSecondary,
        marginBottom: 10,
    },
    priorityPreview: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.surfaceAlt,
        paddingHorizontal: 10,
        paddingVertical: 7,
        borderRadius: 8,
        marginBottom: 10,
        gap: 6,
    },
    priorityText: {
        flex: 1,
        fontSize: 12,
        color: colors.textPrimary,
        fontWeight: '500',
    },
    priorityDue: {
        fontSize: 11,
        fontWeight: '700',
    },
    cardFooter: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginTop: 'auto',
    },
    chipsRow: {
        flexDirection: 'row',
        gap: 5,
    },
    chip: {
        paddingHorizontal: 7,
        paddingVertical: 3,
        borderRadius: 6,
        backgroundColor: colors.surfaceMuted,
    },
    chipText: {
        fontSize: 11,
        fontWeight: '600',
        color: colors.textSecondary,
    },
    viewMoreRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 1,
    },
    viewMore: {
        fontSize: 11,
        color: colors.textTertiary,
    },
});

// ============================================
// AI MODAL STYLES
// ============================================
const createModalStyles = (colors: ColorScheme, typography: TypographyType, layout: LayoutType, isDark: boolean) => StyleSheet.create({
    backdrop: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: colors.overlay,
    },
    container: {
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        maxHeight: '85%',
        backgroundColor: colors.background,
        borderTopLeftRadius: layout.borderRadius.xl,
        borderTopRightRadius: layout.borderRadius.xl,
        // No shadow: the backdrop already separates this from the page, and the design
        // system flattened every surface except `xl`.
    },
    handleContainer: {
        alignItems: 'center',
        paddingTop: Spacing.s,
        paddingBottom: Spacing.xs,
    },
    handle: {
        width: 36,
        height: 4,
        borderRadius: layout.borderRadius.full,
        backgroundColor: colors.border,
    },

    header: {
        paddingHorizontal: Spacing.l,
        paddingTop: Spacing.s,
        paddingBottom: Spacing.l,
    },
    headerTop: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    courseTitle: {
        ...typography.header3,
        flex: 1,
        marginRight: Spacing.m,
    },
    // The status word and the verdict on one line. The word carries the only colour in
    // the sheet, which is what lets everything below stay neutral.
    statusLine: {
        ...typography.body2,
        color: colors.textSecondary,
        lineHeight: 21,
        marginTop: Spacing.xs,
    },

    content: {
        flexGrow: 0,
    },
    contentInner: {
        paddingHorizontal: Spacing.l,
        paddingBottom: Spacing.xl,
    },

    section: {
        marginBottom: Spacing.l,
    },
    sectionTitle: {
        ...typography.overline,
        color: colors.textTertiary,
        marginBottom: Spacing.s,
    },
    group: {
        backgroundColor: colors.surface,
        borderRadius: layout.borderRadius.l,
        borderWidth: 1,
        borderColor: colors.border,
        overflow: 'hidden',
    },

    row: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: Spacing.m,
        paddingVertical: Spacing.m,
    },
    rowBorder: {
        borderTopWidth: 1,
        borderTopColor: colors.divider,
    },
    rowTitle: {
        ...typography.subtitle1,
        fontSize: 15,
        flex: 1,
        marginRight: Spacing.m,
    },
    // Plain text, not a pill. Only a deadline that is actually now takes the error colour.
    rowDue: {
        ...typography.caption,
        color: colors.textSecondary,
        fontWeight: '600',
    },

    bodyText: {
        ...typography.body2,
        color: colors.textPrimary,
        lineHeight: 21,
        padding: Spacing.m,
    },

    // Belongs to the AI 브리핑 header on the dashboard, not to this sheet — it shares
    // this stylesheet with the modal.
    aiRefreshButton: {
        padding: Spacing.xs,
    },
});

// ============================================
// STYLES
// ============================================
const createStyles = (colors: ColorScheme, typography: TypographyType, layout: LayoutType, isDark: boolean) => StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: colors.background,
    },
    scrollContent: {
        paddingHorizontal: Spacing.l,
        paddingBottom: Spacing.xxl,
    },

    // Header
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: Spacing.m,
        marginBottom: Spacing.xl,
    },
    headerText: {
        flex: 1,
    },
    greeting: {
        ...typography.header1,
        fontSize: 26,
        letterSpacing: -0.5,
    },
    date: {
        ...typography.body2,
        marginTop: 4,
    },
    headerButtons: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.s,
    },
    headerButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: colors.surface,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: colors.border,
        ...layout.shadow.sm,
    },
    notificationBadge: {
        position: 'absolute',
        top: -2,
        right: -2,
        minWidth: 18,
        height: 18,
        borderRadius: 9,
        backgroundColor: colors.error,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 4,
        borderWidth: 2,
        borderColor: colors.surface,
    },
    notificationBadgeText: {
        fontSize: 10,
        fontWeight: '700',
        color: '#FFF',
    },
    syncButtonActive: {
        backgroundColor: colors.primaryLighter,
        borderColor: colors.primary,
    },

    // Stats Card
    statsCard: {
        backgroundColor: colors.surface,
        borderRadius: layout.borderRadius.xl,
        padding: Spacing.l,
        marginBottom: Spacing.xl,
        borderWidth: 1,
        borderColor: colors.border,
        ...layout.shadow.default,
    },
    statsTitle: {
        ...typography.subtitle1,
        marginBottom: Spacing.l,
    },
    statsGrid: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
    },
    statItem: {
        flex: 1,
        alignItems: 'center',
    },
    statIconContainer: {
        width: 44,
        height: 44,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: Spacing.s,
    },
    statLabel: {
        ...typography.caption,
        marginBottom: 4,
    },
    statValueRow: {
        flexDirection: 'row',
        alignItems: 'baseline',
    },
    statValue: {
        fontSize: 28,
        fontWeight: '700',
        letterSpacing: -1,
    },
    statTotal: {
        fontSize: 16,
        fontWeight: '500',
        color: colors.textTertiary,
    },
    statsDivider: {
        width: 1,
        height: 60,
        backgroundColor: colors.divider,
        marginHorizontal: Spacing.s,
    },

    // Sections
    section: {
        marginBottom: Spacing.xl,
    },
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: Spacing.m,
    },
    sectionHeaderLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    sectionIconContainer: {
        width: 32,
        height: 32,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: Spacing.s,
    },
    sectionTitle: {
        ...typography.header3,
        flex: 1,
    },
    countBadge: {
        backgroundColor: colors.error,
        borderRadius: 12,
        paddingHorizontal: 10,
        paddingVertical: 3,
        marginLeft: 8,
    },
    countText: {
        color: colors.textInverse,
        fontSize: 12,
        fontWeight: '700',
    },

    // AI Section — one container shared by the idle and loading states.
    //
    // No icon here on purpose: the section header directly above is already
    // "✨ AI 브리핑", so a sparkles tile on the row would differentiate nothing.
    // Icons earn their place by telling siblings apart, not by echoing the parent.
    aiPromptRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.m,
        backgroundColor: colors.surface,
        borderRadius: layout.borderRadius.l,
        borderWidth: 1,
        borderColor: colors.border,
        paddingHorizontal: Spacing.m,
        paddingVertical: 14,
    },
    aiPromptText: {
        flex: 1,
        gap: 4,
    },
    aiPromptTitle: {
        ...typography.subtitle1,
    },
    aiPromptSubtitle: {
        ...typography.caption,
    },
    swipeHint: {
        ...typography.caption,
        color: colors.textTertiary,
        marginBottom: Spacing.s,
        marginTop: -Spacing.xs,
    },
    swipeAction: {
        justifyContent: 'center',
        alignItems: 'center',
        width: 76,
        marginBottom: Spacing.s,
        borderRadius: layout.borderRadius.m,
    },
    swipeActionComplete: {
        backgroundColor: colors.success,
    },
    swipeActionUndo: {
        backgroundColor: colors.warning,
    },
    swipeActionText: {
        color: colors.textInverse,
        fontSize: 11,
        fontWeight: '600',
        marginTop: 1,
    },

    // Empty State
    emptyState: {
        alignItems: 'center',
        paddingVertical: Spacing.xxxl,
    },
    emptyIcon: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: colors.successLight,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: Spacing.l,
    },
    emptyTitle: {
        ...typography.header3,
        marginBottom: Spacing.xs,
    },
    emptySubtitle: {
        ...typography.body2,
    },
});

export default DashboardScreen;
