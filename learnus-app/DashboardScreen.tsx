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
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { RectButton, Swipeable } from 'react-native-gesture-handler';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getDashboardOverview, syncAllActiveCourses, completeAssignments, fetchAISummary } from './services/api';
import { Colors, Spacing, Layout, Typography, Animation } from './constants/theme';
import { useUser } from './context/UserContext';
import { useToast } from './context/ToastContext';
import Card from './components/Card';
import Badge, { StatusBadge } from './components/Badge';
import Button, { IconButton } from './components/Button';

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
    color?: string;
    icon: keyof typeof Ionicons.glyphMap;
}

const StatItem = ({ label, value, total, color = Colors.primary, icon }: StatItemProps) => (
    <View style={styles.statItem}>
        <View style={[styles.statIconContainer, { backgroundColor: color + '15' }]}>
            <Ionicons name={icon} size={20} color={color} />
        </View>
        <Text style={styles.statLabel}>{label}</Text>
        <View style={styles.statValueRow}>
            <Text style={[styles.statValue, { color }]}>{value}</Text>
            {total !== undefined && (
                <Text style={styles.statTotal}>/{total}</Text>
            )}
        </View>
    </View>
);

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
            style={{
                transform: [{ translateX: slideAnim }, { scale: scaleAnim }],
                opacity: opacityAnim,
            }}
        >
            <TouchableOpacity
                style={[aiStyles.card, { borderColor: statusConfig.borderColor }]}
                onPress={onPress}
                activeOpacity={0.92}
            >
                {/* Status Indicator Bar */}
                <View style={[aiStyles.statusBar, { backgroundColor: statusConfig.color }]} />

                {/* Card Content */}
                <View style={aiStyles.cardContent}>
                    {/* Header */}
                    <View style={aiStyles.cardHeader}>
                        <View style={aiStyles.courseInfo}>
                            <View style={[aiStyles.statusBadge, { backgroundColor: statusConfig.bgColor }]}>
                                <Ionicons name={statusConfig.icon} size={12} color={statusConfig.color} />
                                <Text style={[aiStyles.statusLabel, { color: statusConfig.color }]}>
                                    {statusConfig.label}
                                </Text>
                            </View>
                            <Text style={aiStyles.courseName} numberOfLines={1}>
                                {summary.course_name}
                            </Text>
                        </View>
                        <View style={aiStyles.aiTag}>
                            <Ionicons name="sparkles" size={10} color={Colors.secondary} />
                        </View>
                    </View>

                    {/* Quick Stats */}
                    <View style={aiStyles.statsRow}>
                        {summary.urgent?.count > 0 && (
                            <View style={[aiStyles.statChip, aiStyles.urgentChip]}>
                                <Ionicons name="alert-circle" size={12} color="#EF4444" />
                                <Text style={[aiStyles.statText, { color: '#EF4444' }]}>
                                    긴급 {summary.urgent.count}
                                </Text>
                            </View>
                        )}
                        {summary.upcoming?.count > 0 && (
                            <View style={[aiStyles.statChip, aiStyles.upcomingChip]}>
                                <Ionicons name="time-outline" size={12} color="#F59E0B" />
                                <Text style={[aiStyles.statText, { color: '#F59E0B' }]}>
                                    예정 {summary.upcoming.count}
                                </Text>
                            </View>
                        )}
                        {summary.announcement?.has_new && (
                            <View style={[aiStyles.statChip, aiStyles.announcementChip]}>
                                <Ionicons name="megaphone-outline" size={12} color={Colors.primary} />
                                <Text style={[aiStyles.statText, { color: Colors.primary }]}>새 공지</Text>
                            </View>
                        )}
                        {(!summary.urgent?.count && !summary.upcoming?.count && !summary.announcement?.has_new) && (
                            <View style={[aiStyles.statChip, aiStyles.calmChip]}>
                                <Ionicons name="leaf-outline" size={12} color="#10B981" />
                                <Text style={[aiStyles.statText, { color: '#10B981' }]}>할 일 없음</Text>
                            </View>
                        )}
                    </View>

                    {/* Status Message */}
                    <Text style={aiStyles.statusMessage} numberOfLines={2}>
                        {summary.status_message}
                    </Text>

                    {/* Top Priority Item Preview */}
                    {summary.urgent?.items?.[0] && (
                        <View style={aiStyles.priorityPreview}>
                            <View style={aiStyles.priorityDot} />
                            <Text style={aiStyles.priorityText} numberOfLines={1}>
                                {summary.urgent.items[0].title}
                            </Text>
                            <Text style={aiStyles.priorityDue}>{summary.urgent.items[0].due}</Text>
                        </View>
                    )}

                    {/* Footer */}
                    <View style={aiStyles.cardFooter}>
                        <Text style={aiStyles.viewMore}>자세히 보기</Text>
                        <Ionicons name="chevron-forward" size={14} color={Colors.textTertiary} />
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
    const slideAnim = useRef(new Animated.Value(300)).current;
    const backdropAnim = useRef(new Animated.Value(0)).current;

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
                                    color={Colors.textSecondary}
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

            <Animated.View style={[modalStyles.container, { transform: [{ translateY: slideAnim }] }]}>
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
                            <Ionicons name="close" size={22} color={Colors.textSecondary} />
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
                            <Ionicons name="sparkles" size={16} color={Colors.secondary} />
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
    iconColor?: string;
    count?: number;
    isCollapsible?: boolean;
    isCollapsed?: boolean;
    onToggle?: () => void;
    action?: React.ReactNode;
}

const SectionHeader = ({
    title,
    icon,
    iconColor = Colors.primary,
    count,
    isCollapsible,
    isCollapsed,
    onToggle,
    action,
}: SectionHeaderProps) => (
    <View style={styles.sectionHeader}>
        <TouchableOpacity
            style={styles.sectionHeaderLeft}
            onPress={isCollapsible ? onToggle : undefined}
            activeOpacity={isCollapsible ? 0.7 : 1}
            disabled={!isCollapsible}
        >
            <View style={[styles.sectionIconContainer, { backgroundColor: iconColor + '15' }]}>
                <Ionicons name={icon} size={18} color={iconColor} />
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
                    color={Colors.textTertiary}
                    style={{ marginLeft: 8 }}
                />
            )}
        </TouchableOpacity>
        {action}
    </View>
);

// ============================================
// ASSIGNMENT ITEM
// ============================================
interface AssignmentItemProps {
    item: any;
    onComplete: () => void;
    isMissed?: boolean;
}

const AssignmentItem = ({ item, onComplete, isMissed = false }: AssignmentItemProps) => {
    const swipeableRef = useRef<Swipeable>(null);

    const renderRightActions = () => (
        <RectButton
            style={styles.swipeAction}
            onPress={() => {
                swipeableRef.current?.close();
                onComplete();
            }}
        >
            <Ionicons name="checkmark" size={24} color={Colors.textInverse} />
            <Text style={styles.swipeActionText}>완료</Text>
        </RectButton>
    );

    return (
        <Swipeable
            ref={swipeableRef}
            overshootRight={false}
            renderRightActions={renderRightActions}
            friction={2}
        >
            <View style={[styles.assignmentCard, item.is_completed && styles.assignmentCardCompleted]}>
                <View style={[styles.assignmentIcon, isMissed && styles.assignmentIconMissed]}>
                    <Ionicons
                        name={isMissed ? 'alert-circle' : 'document-text-outline'}
                        size={22}
                        color={isMissed ? Colors.error : item.is_completed ? Colors.textTertiary : Colors.primary}
                    />
                </View>

                <View style={styles.assignmentContent}>
                    <Text style={styles.assignmentCourse} numberOfLines={1}>
                        {item.course_name}
                    </Text>
                    <Text
                        style={[
                            styles.assignmentTitle,
                            item.is_completed && styles.assignmentTitleCompleted,
                        ]}
                        numberOfLines={1}
                    >
                        {item.title}
                    </Text>
                    <View style={styles.assignmentMeta}>
                        <Ionicons
                            name="time-outline"
                            size={12}
                            color={isMissed ? Colors.error : Colors.textTertiary}
                        />
                        <Text style={[styles.assignmentDate, isMissed && styles.assignmentDateMissed]}>
                            {item.due_date} 마감
                        </Text>
                    </View>
                </View>

                <TouchableOpacity
                    onPress={onComplete}
                    style={styles.checkButton}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                    <Ionicons
                        name={item.is_completed ? 'checkmark-circle' : 'ellipse-outline'}
                        size={26}
                        color={item.is_completed ? Colors.success : Colors.border}
                    />
                </TouchableOpacity>
            </View>
        </Swipeable>
    );
};

// ============================================
// MAIN DASHBOARD SCREEN
// ============================================
const DashboardScreen = () => {
    const navigation = useNavigation();
    const { profile } = useUser();
    const { showSuccess, showError } = useToast();
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [data, setData] = useState<any>(null);
    const [syncing, setSyncing] = useState(false);

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
        try {
            const result = await getDashboardOverview();
            setData(result);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const onRefresh = useCallback(() => {
        setRefreshing(true);
        loadDashboard();
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

    const handleCompleteAssignment = async (id: number) => {
        try {
            const isUpcoming = data.upcoming_assignments?.some((item: any) => item.id === id);

            // Find the current assignment to get its current completion status
            const currentAssignment = isUpcoming
                ? data.upcoming_assignments?.find((item: any) => item.id === id)
                : data.missed_assignments?.find((item: any) => item.id === id);

            const newCompletedStatus = !currentAssignment?.is_completed;

            LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);

            if (isUpcoming) {
                const updatedUpcoming = data.upcoming_assignments.map((item: any) =>
                    item.id === id ? { ...item, is_completed: newCompletedStatus } : item
                );
                setData({ ...data, upcoming_assignments: updatedUpcoming });
            } else {
                // For missed assignments, toggle instead of removing
                const updatedMissed = data.missed_assignments.map((item: any) =>
                    item.id === id ? { ...item, is_completed: newCompletedStatus } : item
                );
                setData({ ...data, missed_assignments: updatedMissed });
            }

            // Pass the new completion status to the API
            await completeAssignments([id], newCompletedStatus);
        } catch (e) {
            console.error(e);
            showError('오류', '과제 완료 처리에 실패했습니다.');
            loadDashboard();
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
                <ActivityIndicator size="large" color={Colors.primary} />
            </View>
        );
    }

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <StatusBar barStyle="dark-content" backgroundColor={Colors.background} />

            <ScrollView
                contentContainerStyle={styles.scrollContent}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={onRefresh}
                        tintColor={Colors.primary}
                        colors={[Colors.primary]}
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

                    <TouchableOpacity
                        style={[styles.syncButton, syncing && styles.syncButtonActive]}
                        onPress={handleSyncAll}
                        disabled={syncing}
                        activeOpacity={0.8}
                    >
                        <Animated.View style={{ transform: [{ rotate: spin }] }}>
                            <Ionicons
                                name="refresh"
                                size={22}
                                color={syncing ? Colors.primary : Colors.textSecondary}
                            />
                        </Animated.View>
                    </TouchableOpacity>
                </Animated.View>

                {/* Stats Card */}
                <View style={styles.statsCard}>
                    <Text style={styles.statsTitle}>이번 주 학습 현황</Text>
                    <View style={styles.statsGrid}>
                        <StatItem
                            label="과제/퀴즈"
                            value={data?.stats?.completed_assignments_due || 0}
                            total={data?.stats?.total_assignments_due || 0}
                            color={Colors.primary}
                            icon="clipboard-outline"
                        />
                        <View style={styles.statsDivider} />
                        <StatItem
                            label="놓친 강의"
                            value={data?.stats?.missed_vods_count || 0}
                            color={(data?.stats?.missed_vods_count || 0) > 0 ? Colors.error : Colors.success}
                            icon="videocam-outline"
                        />
                        <View style={styles.statsDivider} />
                        <StatItem
                            label="놓친 과제"
                            value={data?.stats?.missed_assignments_count || 0}
                            color={(data?.stats?.missed_assignments_count || 0) > 0 ? Colors.error : Colors.success}
                            icon="alert-circle-outline"
                        />
                    </View>
                </View>

                {/* AI Briefing Section */}
                <View style={styles.section}>
                    <SectionHeader
                        title="AI 브리핑"
                        icon="sparkles"
                        iconColor={Colors.secondary}
                    />

                    {!loadingAI && aiSummaries.length === 0 && (
                        <Button
                            title="요약 생성하기"
                            onPress={loadAISummaries}
                            variant="primary"
                            size="md"
                            icon={<Ionicons name="sparkles" size={18} color={Colors.textInverse} />}
                            style={styles.generateButton}
                            rounded
                        />
                    )}

                    {loadingAI && (
                        <View style={styles.aiLoading}>
                            <ActivityIndicator size="small" color={Colors.primary} />
                            <Text style={styles.aiLoadingText}>AI가 요약을 생성하고 있어요...</Text>
                        </View>
                    )}

                    {aiSummaries.length > 0 && (
                        <ScrollView
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            contentContainerStyle={{ paddingRight: Spacing.l }}
                            decelerationRate="fast"
                            snapToInterval={CARD_WIDTH + Spacing.m}
                            snapToAlignment="start"
                        >
                            {aiSummaries.map((item, index) => (
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
                            iconColor={Colors.error}
                            count={data.missed_assignments.length}
                            isCollapsible
                            isCollapsed={collapsedSections.missedAssignments}
                            onToggle={() => toggleSection('missedAssignments')}
                        />
                        {!collapsedSections.missedAssignments &&
                            data.missed_assignments.map((item: any) => (
                                <AssignmentItem
                                    key={item.id}
                                    item={item}
                                    onComplete={() => handleCompleteAssignment(item.id)}
                                    isMissed
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
                            iconColor={Colors.primary}
                        />
                        {data.upcoming_assignments.map((item: any) => (
                            <AssignmentItem
                                key={item.id}
                                item={item}
                                onComplete={() => handleCompleteAssignment(item.id)}
                            />
                        ))}
                    </View>
                )}

                {/* Empty state */}
                {!data?.missed_assignments?.length && !data?.upcoming_assignments?.length && (
                    <View style={styles.emptyState}>
                        <View style={styles.emptyIcon}>
                            <Ionicons name="checkmark-done" size={48} color={Colors.success} />
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
const aiStyles = StyleSheet.create({
    card: {
        width: CARD_WIDTH,
        height: CARD_HEIGHT,
        marginRight: Spacing.m,
        borderRadius: 20,
        backgroundColor: Colors.surface,
        borderWidth: 1.5,
        overflow: 'hidden',
        ...Layout.shadow.default,
    },
    statusBar: {
        height: 3,
        width: '100%',
    },
    cardContent: {
        flex: 1,
        padding: Spacing.m,
        paddingTop: Spacing.sm,
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: Spacing.sm,
    },
    courseInfo: {
        flex: 1,
        marginRight: Spacing.s,
    },
    statusBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'flex-start',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 10,
        marginBottom: 6,
    },
    statusLabel: {
        fontSize: 11,
        fontWeight: '600',
        marginLeft: 4,
    },
    courseName: {
        fontSize: 15,
        fontWeight: '700',
        color: Colors.textPrimary,
        letterSpacing: -0.3,
    },
    aiTag: {
        width: 22,
        height: 22,
        borderRadius: 11,
        backgroundColor: 'rgba(139, 92, 246, 0.1)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    statsRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 6,
        marginBottom: Spacing.sm,
    },
    statChip: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
        gap: 4,
    },
    urgentChip: {
        backgroundColor: 'rgba(239, 68, 68, 0.08)',
    },
    upcomingChip: {
        backgroundColor: 'rgba(245, 158, 11, 0.08)',
    },
    announcementChip: {
        backgroundColor: `${Colors.primary}10`,
    },
    calmChip: {
        backgroundColor: 'rgba(16, 185, 129, 0.08)',
    },
    statText: {
        fontSize: 11,
        fontWeight: '600',
    },
    statusMessage: {
        fontSize: 13,
        lineHeight: 19,
        color: Colors.textSecondary,
        marginBottom: Spacing.sm,
    },
    priorityPreview: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(239, 68, 68, 0.05)',
        paddingHorizontal: 10,
        paddingVertical: 8,
        borderRadius: 10,
        marginBottom: Spacing.sm,
    },
    priorityDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: '#EF4444',
        marginRight: 8,
    },
    priorityText: {
        flex: 1,
        fontSize: 12,
        color: Colors.textPrimary,
        fontWeight: '500',
    },
    priorityDue: {
        fontSize: 11,
        fontWeight: '700',
        color: '#EF4444',
    },
    cardFooter: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'flex-end',
        marginTop: 'auto',
    },
    viewMore: {
        fontSize: 12,
        color: Colors.textTertiary,
        marginRight: 2,
    },
});

// ============================================
// AI MODAL STYLES
// ============================================
const modalStyles = StyleSheet.create({
    backdrop: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0, 0, 0, 0.4)',
    },
    container: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: Colors.background,
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        maxHeight: '85%',
        ...Layout.shadow.lg,
    },
    handleContainer: {
        alignItems: 'center',
        paddingVertical: 12,
    },
    handle: {
        width: 36,
        height: 4,
        borderRadius: 2,
        backgroundColor: Colors.border,
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
        color: Colors.textPrimary,
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
        backgroundColor: Colors.surfaceAlt || Colors.surface,
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
        marginBottom: Spacing.sm,
    },
    sectionIcon: {
        width: 28,
        height: 28,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: Spacing.s,
    },
    sectionTitle: {
        fontSize: 15,
        fontWeight: '700',
        color: Colors.textPrimary,
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
    itemsList: {
        backgroundColor: Colors.surface,
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
        borderBottomColor: Colors.border,
    },
    itemLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
        marginRight: Spacing.s,
    },
    itemTitle: {
        fontSize: 14,
        color: Colors.textPrimary,
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
        color: Colors.textTertiary,
        fontStyle: 'italic',
        paddingVertical: Spacing.s,
    },
    announcementBox: {
        backgroundColor: Colors.surface,
        borderRadius: 12,
        padding: Spacing.m,
        borderLeftWidth: 3,
        borderLeftColor: '#6366F1',
    },
    announcementText: {
        fontSize: 14,
        lineHeight: 21,
        color: Colors.textPrimary,
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
        color: Colors.secondary,
        marginLeft: 6,
    },
    insightText: {
        fontSize: 14,
        lineHeight: 22,
        color: Colors.textPrimary,
    },
});

// ============================================
// STYLES
// ============================================
const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.background,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: Colors.background,
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
        ...Typography.header1,
        fontSize: 26,
        letterSpacing: -0.5,
    },
    date: {
        ...Typography.body2,
        marginTop: 4,
    },
    syncButton: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: Colors.surface,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: Colors.border,
        ...Layout.shadow.sm,
    },
    syncButtonActive: {
        backgroundColor: Colors.primaryLighter,
        borderColor: Colors.primary,
    },

    // Stats Card
    statsCard: {
        backgroundColor: Colors.surface,
        borderRadius: Layout.borderRadius.xl,
        padding: Spacing.l,
        marginBottom: Spacing.xl,
        borderWidth: 1,
        borderColor: Colors.border,
        ...Layout.shadow.default,
    },
    statsTitle: {
        ...Typography.subtitle1,
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
        ...Typography.caption,
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
        color: Colors.textTertiary,
    },
    statsDivider: {
        width: 1,
        height: 60,
        backgroundColor: Colors.divider,
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
        ...Typography.header3,
        flex: 1,
    },
    countBadge: {
        backgroundColor: Colors.error,
        borderRadius: 12,
        paddingHorizontal: 10,
        paddingVertical: 3,
        marginLeft: 8,
    },
    countText: {
        color: Colors.textInverse,
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
        ...Typography.body2,
        marginLeft: Spacing.s,
    },
    // Assignment Cards
    assignmentCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: Colors.surface,
        padding: Spacing.m,
        marginBottom: Spacing.s,
        borderRadius: Layout.borderRadius.l,
        borderWidth: 1,
        borderColor: Colors.border,
        ...Layout.shadow.sm,
    },
    assignmentCardCompleted: {
        opacity: 0.7,
        backgroundColor: Colors.surfaceMuted,
    },
    assignmentIcon: {
        width: 44,
        height: 44,
        borderRadius: 14,
        backgroundColor: Colors.primaryLighter,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: Spacing.m,
    },
    assignmentIconMissed: {
        backgroundColor: Colors.errorLight,
    },
    assignmentContent: {
        flex: 1,
        marginRight: Spacing.s,
    },
    assignmentCourse: {
        ...Typography.caption,
        marginBottom: 2,
    },
    assignmentTitle: {
        ...Typography.subtitle1,
        fontSize: 15,
        marginBottom: 4,
    },
    assignmentTitleCompleted: {
        color: Colors.textTertiary,
        textDecorationLine: 'line-through',
    },
    assignmentMeta: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    assignmentDate: {
        ...Typography.caption,
        marginLeft: 4,
    },
    assignmentDateMissed: {
        color: Colors.error,
    },
    checkButton: {
        padding: Spacing.xs,
    },
    swipeAction: {
        backgroundColor: Colors.success,
        justifyContent: 'center',
        alignItems: 'center',
        width: 80,
        marginBottom: Spacing.s,
        borderRadius: Layout.borderRadius.l,
        marginLeft: -Layout.borderRadius.l,
    },
    swipeActionText: {
        color: Colors.textInverse,
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
        backgroundColor: Colors.successLight,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: Spacing.l,
    },
    emptyTitle: {
        ...Typography.header3,
        marginBottom: Spacing.xs,
    },
    emptySubtitle: {
        ...Typography.body2,
    },
});

export default DashboardScreen;
