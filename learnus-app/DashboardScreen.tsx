import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    RefreshControl,
    TouchableOpacity,
    ActivityIndicator,
    Alert,
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
import Markdown from 'react-native-markdown-display';

import { getDashboardOverview, syncAllActiveCourses, completeAssignments, fetchAISummary } from './services/api';
import { Colors, Spacing, Layout, Typography, Animation } from './constants/theme';
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
// AI SUMMARY CARD
// ============================================
const AISummaryCard = ({ summary, onPress, index }: { summary: any; onPress: () => void; index: number }) => {
    const slideAnim = useRef(new Animated.Value(50)).current;
    const opacityAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        Animated.parallel([
            Animated.timing(slideAnim, {
                toValue: 0,
                duration: 400,
                delay: index * 100,
                useNativeDriver: true,
            }),
            Animated.timing(opacityAnim, {
                toValue: 1,
                duration: 400,
                delay: index * 100,
                useNativeDriver: true,
            }),
        ]).start();
    }, []);

    return (
        <Animated.View
            style={{
                transform: [{ translateX: slideAnim }],
                opacity: opacityAnim,
            }}
        >
            <TouchableOpacity
                style={styles.aiCard}
                onPress={onPress}
                activeOpacity={0.9}
            >
                <View style={styles.aiCardGradient}>
                    <View style={styles.aiHeader}>
                        <View style={styles.aiIconContainer}>
                            <Ionicons name="sparkles" size={16} color={Colors.textInverse} />
                        </View>
                        <Text style={styles.aiCourseName} numberOfLines={1}>
                            {summary.course_name}
                        </Text>
                    </View>

                    <View style={styles.aiContentContainer}>
                        <Markdown style={cardMarkdownStyles}>
                            {summary.summary}
                        </Markdown>
                    </View>

                    <View style={styles.aiFooter}>
                        <Text style={styles.readMore}>자세히 보기</Text>
                        <Ionicons name="arrow-forward" size={14} color={Colors.primary} />
                    </View>
                </View>
            </TouchableOpacity>
        </Animated.View>
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
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [data, setData] = useState<any>(null);
    const [syncing, setSyncing] = useState(false);

    // Collapsible state
    const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({
        missedAssignments: false,
    });

    // AI Summary state
    const [aiSummaries, setAiSummaries] = useState<any[]>([]);
    const [loadingAI, setLoadingAI] = useState(false);
    const [selectedSummary, setSelectedSummary] = useState<any>(null);

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
            Alert.alert('오류', 'AI 요약을 불러오는데 실패했습니다.');
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
            Alert.alert('동기화 완료', '모든 활성 강의가 동기화되었습니다.');
        } catch (e) {
            Alert.alert('동기화 실패', '일부 강의 동기화에 실패했습니다.');
        } finally {
            setSyncing(false);
            syncRotation.stopAnimation();
            syncRotation.setValue(0);
        }
    };

    const handleCompleteAssignment = async (id: number) => {
        try {
            const isUpcoming = data.upcoming_assignments?.some((item: any) => item.id === id);

            LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);

            if (isUpcoming) {
                const updatedUpcoming = data.upcoming_assignments.map((item: any) =>
                    item.id === id ? { ...item, is_completed: !item.is_completed } : item
                );
                setData({ ...data, upcoming_assignments: updatedUpcoming });
            } else {
                const updatedMissed = data.missed_assignments.filter((item: any) => item.id !== id);
                setData({ ...data, missed_assignments: updatedMissed });
            }

            await completeAssignments([id]);
        } catch (e) {
            console.error(e);
            Alert.alert('오류', '과제 완료 처리에 실패했습니다.');
            loadDashboard();
        }
    };

    const spin = syncRotation.interpolate({
        inputRange: [0, 1],
        outputRange: ['0deg', '360deg'],
    });

    const getGreeting = () => {
        const hour = new Date().getHours();
        if (hour < 12) return '좋은 아침이에요';
        if (hour < 18) return '좋은 오후에요';
        return '좋은 저녁이에요';
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
                            contentContainerStyle={styles.aiScroll}
                            decelerationRate="fast"
                            snapToInterval={SCREEN_WIDTH * 0.7 + Spacing.m}
                        >
                            {aiSummaries.map((item, index) => (
                                <AISummaryCard
                                    key={index}
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
            <Modal
                animationType="fade"
                transparent
                visible={!!selectedSummary}
                onRequestClose={() => setSelectedSummary(null)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <View style={styles.modalTitleRow}>
                                <View style={styles.modalIcon}>
                                    <Ionicons name="sparkles" size={20} color={Colors.textInverse} />
                                </View>
                                <Text style={styles.modalTitle} numberOfLines={2}>
                                    {selectedSummary?.course_name}
                                </Text>
                            </View>
                            <IconButton
                                icon={<Ionicons name="close" size={22} color={Colors.textPrimary} />}
                                onPress={() => setSelectedSummary(null)}
                                variant="ghost"
                                size="sm"
                            />
                        </View>
                        <ScrollView
                            style={styles.modalBody}
                            showsVerticalScrollIndicator={false}
                        >
                            <Markdown style={modalMarkdownStyles}>
                                {selectedSummary?.summary}
                            </Markdown>
                        </ScrollView>
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
};

// ============================================
// MARKDOWN STYLES
// ============================================
const cardMarkdownStyles = StyleSheet.create({
    body: {
        fontSize: 13,
        color: Colors.textSecondary,
        lineHeight: 19,
    },
    strong: {
        fontWeight: '600',
        color: Colors.textPrimary,
    },
    heading1: {
        fontSize: 14,
        fontWeight: '700',
        marginBottom: 4,
        color: Colors.textPrimary,
    },
    paragraph: {
        marginTop: 0,
        marginBottom: 6,
    },
    bullet_list: {
        marginBottom: 6,
    },
    list_item: {
        flexDirection: 'row',
    },
});

const modalMarkdownStyles = StyleSheet.create({
    body: {
        fontSize: 16,
        color: Colors.textPrimary,
        lineHeight: 26,
    },
    strong: {
        fontWeight: '700',
        color: Colors.primary,
    },
    heading1: {
        fontSize: 20,
        fontWeight: '700',
        marginBottom: 12,
        marginTop: 16,
        color: Colors.textPrimary,
    },
    heading2: {
        fontSize: 18,
        fontWeight: '600',
        marginBottom: 8,
        marginTop: 12,
        color: Colors.textPrimary,
    },
    paragraph: {
        marginBottom: 12,
    },
    bullet_list: {
        marginBottom: 12,
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
    aiScroll: {
        paddingRight: Spacing.l,
    },
    aiCard: {
        width: SCREEN_WIDTH * 0.7,
        marginRight: Spacing.m,
        borderRadius: Layout.borderRadius.xl,
        overflow: 'hidden',
        backgroundColor: Colors.surface,
        borderWidth: 1,
        borderColor: Colors.border,
        ...Layout.shadow.default,
    },
    aiCardGradient: {
        padding: Spacing.l,
        minHeight: 180,
    },
    aiHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: Spacing.m,
    },
    aiIconContainer: {
        width: 32,
        height: 32,
        borderRadius: 10,
        backgroundColor: Colors.secondary,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: Spacing.s,
    },
    aiCourseName: {
        ...Typography.subtitle1,
        flex: 1,
    },
    aiContentContainer: {
        flex: 1,
        overflow: 'hidden',
    },
    aiFooter: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'flex-end',
        marginTop: Spacing.s,
    },
    readMore: {
        ...Typography.buttonSmall,
        color: Colors.primary,
        marginRight: 4,
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

    // Modal
    modalOverlay: {
        flex: 1,
        backgroundColor: Colors.overlay,
        justifyContent: 'center',
        alignItems: 'center',
        padding: Spacing.l,
    },
    modalContent: {
        backgroundColor: Colors.surface,
        borderRadius: Layout.borderRadius.xl,
        width: '100%',
        maxHeight: '85%',
        overflow: 'hidden',
        ...Layout.shadow.lg,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        padding: Spacing.l,
        paddingBottom: Spacing.m,
        borderBottomWidth: 1,
        borderBottomColor: Colors.divider,
    },
    modalTitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
        marginRight: Spacing.m,
    },
    modalIcon: {
        width: 36,
        height: 36,
        borderRadius: 12,
        backgroundColor: Colors.secondary,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: Spacing.m,
    },
    modalTitle: {
        ...Typography.header3,
        flex: 1,
    },
    modalBody: {
        padding: Spacing.l,
    },
});

export default DashboardScreen;
