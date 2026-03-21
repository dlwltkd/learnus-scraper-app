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

import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { getDashboardOverview, syncAllActiveCourses, fetchAISummary } from './services/api';
import { Spacing, Animation } from './constants/theme';
import type { ColorScheme, TypographyType, LayoutType } from './constants/theme';
import { useTheme } from './context/ThemeContext';
import { useUser } from './context/UserContext';
import { useToast } from './context/ToastContext';
import { getUnreadCount } from './services/NotificationHistoryService';
import Card from './components/Card';
import TypingDots from './TypingDots';
import Badge, { StatusBadge } from './components/Badge';
import Button, { IconButton } from './components/Button';
import ItemRow from './components/ItemRow';
import { useTourRef } from './hooks/useTourRef';
import { useTour } from './context/TourContext';
import { TOUR_MOCK_OVERVIEW } from './constants/tourMockData';

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
        <View style={styles.statItem}>
            <View style={[styles.statIconContainer, { backgroundColor: resolvedColor + '15' }]}>
                <Ionicons name={icon} size={20} color={resolvedColor} />
            </View>
            <Text style={styles.statLabel}>{label}</Text>
            <View style={styles.statValueRow}>
                <Text style={[styles.statValue, { color: resolvedColor }]}>{value}</Text>
                {total !== undefined && (
                    <Text style={styles.statTotal}>/{total}</Text>
                )}
            </View>
        </View>
    );
};

// ============================================
// AI SUMMARY TYPES & CONFIG
// ============================================
const CARD_WIDTH = SCREEN_WIDTH * 0.78;
const CARD_HEIGHT = 195;

const STATUS_CONFIG = {
    calm: {
        color: '#10B981',
        bgColor: 'rgba(16, 185, 129, 0.08)',
        borderColor: 'rgba(16, 185, 129, 0.2)',
        icon: 'checkmark-circle' as const,
        label: '여유',
    },
    busy: {
        color: '#F59E0B',
        bgColor: 'rgba(245, 158, 11, 0.08)',
        borderColor: 'rgba(245, 158, 11, 0.2)',
        icon: 'time' as const,
        label: '바쁨',
    },
    urgent: {
        color: '#EF4444',
        bgColor: 'rgba(239, 68, 68, 0.08)',
        borderColor: 'rgba(239, 68, 68, 0.2)',
        icon: 'alert-circle' as const,
        label: '긴급',
    },
};

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
// AI SUMMARY CARD (Fixed Height)
// ============================================
const AISummaryCard = ({ summary, onPress, index }: { summary: AISummary; onPress: () => void; index: number }) => {
    const { colors, typography, layout, isDark } = useTheme();
    const aiStyles = React.useMemo(() => createAiStyles(colors, typography, layout, isDark), [colors, typography, layout, isDark]);
    const slideAnim = useRef(new Animated.Value(40)).current;
    const opacityAnim = useRef(new Animated.Value(0)).current;
    const scaleAnim = useRef(new Animated.Value(0.95)).current;

    const statusConfig = STATUS_CONFIG[summary.status] || STATUS_CONFIG.calm;

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

                    {/* Top Priority Item Preview */}
                    {summary.urgent?.items?.[0] ? (
                        <View style={aiStyles.priorityPreview}>
                            <View style={[aiStyles.priorityDot, { backgroundColor: statusConfig.color }]} />
                            <Text style={aiStyles.priorityText} numberOfLines={1}>
                                {summary.urgent.items[0].title}
                            </Text>
                            <Text style={[aiStyles.priorityDue, { color: statusConfig.color }]}>
                                {summary.urgent.items[0].due}
                            </Text>
                        </View>
                    ) : summary.upcoming?.items?.[0] ? (
                        <View style={aiStyles.priorityPreview}>
                            <View style={[aiStyles.priorityDot, { backgroundColor: '#F59E0B' }]} />
                            <Text style={aiStyles.priorityText} numberOfLines={1}>
                                {summary.upcoming.items[0].title}
                            </Text>
                            <Text style={[aiStyles.priorityDue, { color: '#F59E0B' }]}>
                                {summary.upcoming.items[0].due}
                            </Text>
                        </View>
                    ) : null}

                    {/* Quick chips + footer row */}
                    <View style={aiStyles.cardFooter}>
                        <View style={aiStyles.chipsRow}>
                            {summary.urgent?.count > 0 && (
                                <View style={[aiStyles.chip, { backgroundColor: 'rgba(239,68,68,0.08)' }]}>
                                    <Text style={[aiStyles.chipText, { color: '#EF4444' }]}>긴급 {summary.urgent.count}</Text>
                                </View>
                            )}
                            {summary.upcoming?.count > 0 && (
                                <View style={[aiStyles.chip, { backgroundColor: 'rgba(245,158,11,0.08)' }]}>
                                    <Text style={[aiStyles.chipText, { color: '#F59E0B' }]}>예정 {summary.upcoming.count}</Text>
                                </View>
                            )}
                            {!summary.urgent?.count && !summary.upcoming?.count && (
                                <View style={[aiStyles.chip, { backgroundColor: 'rgba(16,185,129,0.08)' }]}>
                                    <Text style={[aiStyles.chipText, { color: '#10B981' }]}>여유</Text>
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

    const statusConfig = STATUS_CONFIG[summary.status] || STATUS_CONFIG.calm;

    const renderSection = (
        title: string,
        icon: keyof typeof Ionicons.glyphMap,
        iconColor: string,
        items: SummaryItem[],
        emptyText: string
    ) => (
        <View style={modalStyles.section}>
            <View style={modalStyles.sectionHeader}>
                <View style={[modalStyles.sectionIcon, { backgroundColor: `${iconColor}15` }]}>
                    <Ionicons name={icon} size={16} color={iconColor} />
                </View>
                <Text style={modalStyles.sectionTitle}>{title}</Text>
                {items.length > 0 && (
                    <View style={[modalStyles.countBadge, { backgroundColor: `${iconColor}15` }]}>
                        <Text style={[modalStyles.countText, { color: iconColor }]}>{items.length}</Text>
                    </View>
                )}
            </View>
            {items.length > 0 ? (
                <View style={modalStyles.itemsList}>
                    {items.map((item, idx) => (
                        <View key={idx} style={[modalStyles.listItem, idx === items.length - 1 && { borderBottomWidth: 0 }]}>
                            <View style={modalStyles.itemLeft}>
                                <Ionicons
                                    name={item.type === 'assignment' ? 'document-text-outline' : 'play-circle-outline'}
                                    size={16}
                                    color={colors.textSecondary}
                                />
                                <Text style={modalStyles.itemTitle} numberOfLines={1}>{item.title}</Text>
                            </View>
                            <View style={[modalStyles.dueBadge, {
                                backgroundColor: item.due === '오늘' || item.due === 'D-1' ? '#FEE2E2' : '#FEF3C7'
                            }]}>
                                <Text style={[modalStyles.dueText, {
                                    color: item.due === '오늘' || item.due === 'D-1' ? '#DC2626' : '#D97706'
                                }]}>{item.due}</Text>
                            </View>
                        </View>
                    ))}
                </View>
            ) : (
                <Text style={modalStyles.emptyText}>{emptyText}</Text>
            )}
        </View>
    );

    return (
        <Modal animationType="none" transparent visible={visible} onRequestClose={onClose}>
            <Animated.View style={[modalStyles.backdrop, { opacity: backdropAnim }]}>
                <TouchableOpacity style={{ flex: 1 }} onPress={onClose} activeOpacity={1} />
            </Animated.View>

            <Animated.View style={[modalStyles.container, { transform: [{ translateY: slideAnim }], paddingBottom: insets.bottom }]}>
                {/* Handle */}
                <View style={modalStyles.handleContainer}>
                    <View style={modalStyles.handle} />
                </View>

                {/* Header */}
                <View style={[modalStyles.header, { borderBottomColor: statusConfig.borderColor }]}>
                    <View style={modalStyles.headerTop}>
                        <View style={[modalStyles.statusIndicator, { backgroundColor: statusConfig.color }]}>
                            <Ionicons name={statusConfig.icon} size={18} color="#FFF" />
                        </View>
                        <View style={modalStyles.headerInfo}>
                            <Text style={modalStyles.courseTitle} numberOfLines={1}>
                                {summary.course_name}
                            </Text>
                            <Text style={[modalStyles.statusText, { color: statusConfig.color }]}>
                                {statusConfig.label} · {summary.status_message}
                            </Text>
                        </View>
                        <TouchableOpacity style={modalStyles.closeButton} onPress={onClose}>
                            <Ionicons name="close" size={22} color={colors.textSecondary} />
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Content */}
                <ScrollView
                    style={modalStyles.content}
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={{ paddingBottom: 40 }}
                >
                    {/* Urgent Section */}
                    {renderSection('긴급', 'alert-circle', '#EF4444', summary.urgent?.items || [], '긴급한 항목이 없어요 👍')}

                    {/* Upcoming Section */}
                    {renderSection('예정', 'time-outline', '#F59E0B', summary.upcoming?.items || [], '예정된 항목이 없어요')}

                    {/* Announcement Section */}
                    <View style={modalStyles.section}>
                        <View style={modalStyles.sectionHeader}>
                            <View style={[modalStyles.sectionIcon, { backgroundColor: 'rgba(99, 102, 241, 0.1)' }]}>
                                <Ionicons name="megaphone-outline" size={16} color="#6366F1" />
                            </View>
                            <Text style={modalStyles.sectionTitle}>공지사항</Text>
                            {summary.announcement?.has_new && (
                                <View style={modalStyles.newBadge}>
                                    <Text style={modalStyles.newBadgeText}>NEW</Text>
                                </View>
                            )}
                        </View>
                        {summary.announcement?.summary ? (
                            <View style={modalStyles.announcementBox}>
                                <Text style={modalStyles.announcementText}>{summary.announcement.summary}</Text>
                            </View>
                        ) : (
                            <Text style={modalStyles.emptyText}>최근 공지사항이 없어요</Text>
                        )}
                    </View>

                    {/* AI Insight */}
                    <View style={modalStyles.insightBox}>
                        <View style={modalStyles.insightHeader}>
                            <Ionicons name="sparkles" size={16} color={colors.primary} />
                            <Text style={modalStyles.insightLabel}>AI 코멘트</Text>
                        </View>
                        <Text style={modalStyles.insightText}>{summary.insight}</Text>
                    </View>
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
                <View style={[styles.sectionIconContainer, { backgroundColor: resolvedIconColor + '15' }]}>
                    <Ionicons name={icon} size={18} color={resolvedIconColor} />
                </View>
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

    // Tour
    const { isActive: tourActive } = useTour();
    const tourActiveRef = useRef(false);
    const prevTourActive = useRef(false);
    const statsRef = useTourRef('dashboard-stats');
    const aiSectionRef = useTourRef('dashboard-ai-section');

    useEffect(() => {
        tourActiveRef.current = tourActive;
        if (tourActive) {
            setData(TOUR_MOCK_OVERVIEW);
            setLoading(false);
        } else if (prevTourActive.current) {
            loadDashboard();
        }
        prevTourActive.current = tourActive;
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

    const loadAISummaries = async () => {
        setLoadingAI(true);
        try {
            const res = await fetchAISummary();
            if (res.summaries) {
                setAiSummaries(res.summaries);
            }
        } catch (e) {
            console.error(e);
            showError('오류', 'AI 요약을 불러오는데 실패했습니다.');
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
            showSuccess('동기화 완료', '모든 활성 강의가 동기화되었습니다.');
        } catch (e) {
            showError('동기화 실패', '일부 강의 동기화에 실패했습니다.');
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
                            color={(data?.stats?.missed_vods_count || 0) > 0 ? colors.error : colors.success}
                            icon="videocam-outline"
                        />
                        <View style={styles.statsDivider} />
                        <StatItem
                            label="놓친 과제"
                            value={data?.stats?.missed_assignments_count || 0}
                            color={(data?.stats?.missed_assignments_count || 0) > 0 ? colors.error : colors.success}
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

                    {!loadingAI && aiSummaries.length === 0 && (
                        <Button
                            title="요약 생성하기"
                            onPress={loadAISummaries}
                            variant="primary"
                            size="md"
                            icon={<Ionicons name="sparkles" size={18} color={colors.textInverse} />}
                            style={styles.generateButton}
                            rounded
                        />
                    )}
                    </View>

                    {loadingAI && (
                        <View style={styles.aiLoading}>
                            <TypingDots size={9} />
                            <Text style={styles.aiLoadingText}>AI가 요약을 생성하고 있어요...</Text>
                        </View>
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
                        {!collapsedSections.missedAssignments &&
                            data.missed_assignments.map((item: any) => (
                                <ItemRow
                                    key={item.id}
                                    title={item.title}
                                    courseName={item.course_name}
                                    meta={item.due_date ? `${item.due_date} 마감` : undefined}
                                    state="missed"
                                    type="assignment"
                                />
                            ))}
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
                        {data.upcoming_assignments.map((item: any) => (
                            <ItemRow
                                key={item.id}
                                title={item.title}
                                courseName={item.course_name}
                                meta={item.due_date ? `${item.due_date} 마감` : undefined}
                                state={item.is_completed ? 'completed' : 'pending'}
                                type="assignment"
                            />
                        ))}
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
    priorityDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
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
    },
    chipText: {
        fontSize: 11,
        fontWeight: '600',
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
        backgroundColor: 'rgba(0, 0, 0, 0.4)',
    },
    container: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: colors.background,
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        maxHeight: '85%',
        ...layout.shadow.lg,
    },
    handleContainer: {
        alignItems: 'center',
        paddingVertical: 12,
    },
    handle: {
        width: 36,
        height: 4,
        borderRadius: 2,
        backgroundColor: colors.border,
    },
    header: {
        paddingHorizontal: Spacing.l,
        paddingBottom: Spacing.m,
        borderBottomWidth: 1,
    },
    headerTop: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    statusIndicator: {
        width: 40,
        height: 40,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: Spacing.m,
    },
    headerInfo: {
        flex: 1,
    },
    courseTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: colors.textPrimary,
        marginBottom: 2,
    },
    statusText: {
        fontSize: 13,
        fontWeight: '500',
    },
    closeButton: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: colors.surfaceAlt || colors.surface,
        alignItems: 'center',
        justifyContent: 'center',
    },
    content: {
        paddingHorizontal: Spacing.l,
        paddingTop: Spacing.m,
    },
    section: {
        marginBottom: Spacing.l,
    },
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: Spacing.m,
    },
    sectionIcon: {
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
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 10,
    },
    countText: {
        fontSize: 12,
        fontWeight: '700',
    },
    newBadge: {
        backgroundColor: '#EF4444',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
    },
    newBadgeText: {
        fontSize: 9,
        fontWeight: '800',
        color: '#FFF',
        letterSpacing: 0.5,
    },
    aiRefreshButton: {
        padding: Spacing.xs,
    },
    itemsList: {
        backgroundColor: colors.surface,
        borderRadius: 12,
        overflow: 'hidden',
    },
    listItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: Spacing.m,
        paddingVertical: Spacing.sm,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    itemLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
        marginRight: Spacing.s,
    },
    itemTitle: {
        fontSize: 14,
        color: colors.textPrimary,
        marginLeft: Spacing.s,
        flex: 1,
    },
    dueBadge: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
    },
    dueText: {
        fontSize: 11,
        fontWeight: '700',
    },
    emptyText: {
        fontSize: 14,
        color: colors.textTertiary,
        fontStyle: 'italic',
        paddingVertical: Spacing.s,
    },
    announcementBox: {
        backgroundColor: colors.surface,
        borderRadius: 12,
        padding: Spacing.m,
        borderLeftWidth: 3,
        borderLeftColor: '#6366F1',
    },
    announcementText: {
        fontSize: 14,
        lineHeight: 21,
        color: colors.textPrimary,
    },
    insightBox: {
        backgroundColor: 'rgba(139, 92, 246, 0.06)',
        borderRadius: 16,
        padding: Spacing.m,
        borderWidth: 1,
        borderColor: 'rgba(139, 92, 246, 0.15)',
    },
    insightHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: Spacing.s,
    },
    insightLabel: {
        fontSize: 12,
        fontWeight: '600',
        color: colors.secondary,
        marginLeft: 6,
    },
    insightText: {
        fontSize: 14,
        lineHeight: 22,
        color: colors.textPrimary,
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

    // AI Section
    generateButton: {
        alignSelf: 'flex-start',
    },
    aiLoading: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: Spacing.m,
    },
    aiLoadingText: {
        ...typography.body2,
        marginLeft: Spacing.s,
    },
    swipeAction: {
        backgroundColor: colors.success,
        justifyContent: 'center',
        alignItems: 'center',
        width: 80,
        marginBottom: Spacing.s,
        borderRadius: layout.borderRadius.l,
        marginLeft: -layout.borderRadius.l,
    },
    swipeActionText: {
        color: colors.textInverse,
        fontSize: 12,
        fontWeight: '600',
        marginTop: 2,
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
