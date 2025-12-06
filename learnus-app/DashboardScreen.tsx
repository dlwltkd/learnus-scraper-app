import React, { useState, useEffect } from 'react';
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
    UIManager
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { MaterialCommunityIcons as Icon, Ionicons } from '@expo/vector-icons';
import { RectButton, Swipeable } from 'react-native-gesture-handler';
import { SafeAreaView } from 'react-native-safe-area-context';
import Markdown from 'react-native-markdown-display';

import { getDashboardOverview, syncAllActiveCourses, completeAssignments, fetchAISummary } from './services/api';
import { Colors, Spacing, Layout, Typography } from './constants/theme';

if (Platform.OS === 'android') {
    if (UIManager.setLayoutAnimationEnabledExperimental) {
        UIManager.setLayoutAnimationEnabledExperimental(true);
    }
}

const CourseSummaryCard = ({ summary, onPress }: { summary: any, onPress: () => void }) => (
    <TouchableOpacity style={styles.aiCard} onPress={onPress}>
        <View style={styles.aiHeader}>
            <View style={styles.aiIconContainer}>
                <Icon name="robot" size={20} color="#fff" />
            </View>
            <Text style={styles.aiCourseName} numberOfLines={1}>{summary.course_name}</Text>
        </View>
        <View style={styles.aiContentContainer}>
            <Markdown style={cardMarkdownStyles}>
                {summary.summary}
            </Markdown>
        </View>
        <View style={styles.aiFooter}>
            <Text style={styles.readMore}>더 보기</Text>
            <Ionicons name="chevron-forward" size={12} color={Colors.primary} />
        </View>
    </TouchableOpacity>
);

const SectionHeader = ({ title, count, icon, iconColor, isCollapsible, isCollapsed, onToggle, action }: any) => (
    <View style={styles.sectionHeader}>
        <TouchableOpacity
            style={styles.sectionHeaderLeft}
            onPress={isCollapsible ? onToggle : undefined}
            activeOpacity={isCollapsible ? 0.7 : 1}
        >
            <Ionicons name={icon} size={20} color={iconColor || Colors.primary} style={{ marginRight: 8 }} />
            <Text style={styles.sectionTitle} numberOfLines={1}>{title}</Text>
            {isCollapsible && isCollapsed && count !== undefined && count > 0 && (
                <View style={styles.countBadge}>
                    <Text style={styles.countText}>{count}</Text>
                </View>
            )}
            {isCollapsible && (
                <Ionicons
                    name={isCollapsed ? "chevron-down" : "chevron-up"}
                    size={20}
                    color={Colors.textTertiary}
                    style={{ marginLeft: 8 }}
                />
            )}
        </TouchableOpacity>
        {action}
    </View>
);

const DashboardScreen = () => {
    const navigation = useNavigation();
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState<any>(null);
    const [syncing, setSyncing] = useState(false);

    // Collapsible State
    const [collapsedSections, setCollapsedSections] = useState<{ [key: string]: boolean }>({
        missedAssignments: false,
    });

    // AI Summary State
    const [aiSummaries, setAiSummaries] = useState<any[]>([]);
    const [loadingAI, setLoadingAI] = useState(false);
    const [selectedSummary, setSelectedSummary] = useState<any>(null);

    useEffect(() => {
        loadDashboard();
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
            Alert.alert("오류", "AI 요약을 불러오는데 실패했습니다.");
        } finally {
            setLoadingAI(false);
        }
    };

    const handleSyncAll = async () => {
        setSyncing(true);
        try {
            await syncAllActiveCourses();
            await loadDashboard();
            Alert.alert("동기화 완료", "모든 활성 강의가 동기화되었습니다.");
        } catch (e) {
            Alert.alert("동기화 실패", "일부 강의 동기화에 실패했습니다.");
        } finally {
            setSyncing(false);
        }
    };

    const handleCompleteAssignment = async (id: number) => {
        try {
            const isUpcoming = data.upcoming_assignments.some((item: any) => item.id === id);

            if (isUpcoming) {
                // Toggle completion for upcoming
                const updatedUpcoming = data.upcoming_assignments.map((item: any) =>
                    item.id === id ? { ...item, is_completed: !item.is_completed } : item
                );
                setData({ ...data, upcoming_assignments: updatedUpcoming });
            } else {
                // Remove from missed
                const updatedMissed = data.missed_assignments.filter((item: any) => item.id !== id);
                setData({ ...data, missed_assignments: updatedMissed });
            }

            await completeAssignments([id]);
        } catch (e) {
            console.error(e);
            Alert.alert("오류", "과제 완료 처리에 실패했습니다.");
            loadDashboard();
        }
    };

    const renderRightActions = (progress: any, dragX: any, onPress: () => void) => {
        const trans = dragX.interpolate({
            inputRange: [0, 50, 100, 101],
            outputRange: [-20, 0, 0, 1],
        });
        return (
            <RectButton style={styles.rightAction} onPress={onPress}>
                <Animated.Text style={[styles.actionText, { transform: [{ translateX: trans }] }]}>
                    완료
                </Animated.Text>
            </RectButton>
        );
    };

    if (loading) {
        return (
            <View style={styles.centered}>
                <ActivityIndicator size="large" color={Colors.primary} />
            </View>
        );
    }

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <StatusBar barStyle="dark-content" backgroundColor={Colors.background} />
            <ScrollView
                contentContainerStyle={styles.scrollContent}
                refreshControl={<RefreshControl refreshing={loading} onRefresh={loadDashboard} />}
                showsVerticalScrollIndicator={false}
            >
                {/* Header */}
                <View style={styles.header}>
                    <View>
                        <Text style={styles.greeting}>안녕하세요!</Text>
                        <Text style={styles.date}>{new Date().toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'long' })}</Text>
                    </View>
                    <TouchableOpacity
                        style={[styles.syncButton, syncing && styles.syncButtonActive]}
                        onPress={handleSyncAll}
                        disabled={syncing}
                    >
                        <Ionicons name={syncing ? "sync" : "refresh"} size={20} color={Colors.primary} />
                    </TouchableOpacity>
                </View>

                {/* Main Stats Card */}
                <View style={styles.summaryCard}>
                    <Text style={styles.summaryTitle}>이번 주 학습 현황</Text>
                    <View style={styles.statsRow}>
                        <View style={styles.statItem}>
                            <Text style={styles.statLabel}>과제/퀴즈</Text>
                            <Text style={styles.statValue}>
                                <Text style={{ color: Colors.primary }}>{data?.stats?.completed_assignments_due || 0}</Text>
                                <Text style={{ color: Colors.textTertiary }}>/{data?.stats?.total_assignments_due || 0}</Text>
                            </Text>
                        </View>
                        <View style={styles.divider} />
                        <View style={styles.statItem}>
                            <Text style={styles.statLabel}>놓친 강의</Text>
                            <Text style={[styles.statValue, { color: (data?.stats?.missed_vods_count || 0) > 0 ? Colors.error : Colors.textPrimary }]}>
                                {data?.stats?.missed_vods_count || 0}
                            </Text>
                        </View>
                        <View style={styles.divider} />
                        <View style={styles.statItem}>
                            <Text style={styles.statLabel}>놓친 과제</Text>
                            <Text style={[styles.statValue, { color: (data?.stats?.missed_assignments_count || 0) > 0 ? Colors.error : Colors.textPrimary }]}>
                                {data?.stats?.missed_assignments_count || 0}
                            </Text>
                        </View>
                    </View>
                </View>

                {/* AI Section */}
                <View style={styles.section}>
                    <SectionHeader title="AI 브리핑" icon="sparkles" />

                    {!loadingAI && aiSummaries.length === 0 && (
                        <TouchableOpacity style={styles.generateButton} onPress={loadAISummaries}>
                            <Ionicons name="sparkles" size={16} color="#fff" style={{ marginRight: 6 }} />
                            <Text style={styles.generateButtonText}>요약 생성하기</Text>
                        </TouchableOpacity>
                    )}
                    {loadingAI && <ActivityIndicator size="small" color={Colors.primary} style={{ alignSelf: 'flex-start', marginLeft: Spacing.s }} />}

                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalScroll}>
                        {aiSummaries.map((item, index) => (
                            <CourseSummaryCard
                                key={index}
                                summary={item}
                                onPress={() => setSelectedSummary(item)}
                            />
                        ))}
                    </ScrollView>
                </View>

                {/* 1. Missed Assignments (마감 지난 과제) */}
                {data?.missed_assignments?.length > 0 && (
                    <View style={styles.section}>
                        <SectionHeader
                            title="마감 지난 과제"
                            count={data.missed_assignments.length}
                            icon="warning"
                            iconColor={Colors.error}
                            isCollapsible
                            isCollapsed={collapsedSections.missedAssignments}
                            onToggle={() => toggleSection('missedAssignments')}
                        />
                        {!collapsedSections.missedAssignments && data.missed_assignments.map((item: any) => (
                            <Swipeable
                                key={item.id}
                                renderRightActions={(progress, dragX) => renderRightActions(progress, dragX, () => handleCompleteAssignment(item.id))}
                            >
                                <View style={styles.itemCard}>
                                    <View style={styles.itemIcon}>
                                        <Ionicons name="alert-circle" size={24} color={Colors.error} />
                                    </View>
                                    <View style={styles.itemContent}>
                                        <Text style={styles.itemCourse}>{item.course_name}</Text>
                                        <Text style={styles.itemTitle} numberOfLines={1}>{item.title}</Text>
                                        <Text style={styles.itemDate}>{item.due_date} 마감</Text>
                                    </View>
                                    <TouchableOpacity onPress={() => handleCompleteAssignment(item.id)} style={styles.checkButton}>
                                        <Ionicons name="checkmark-circle-outline" size={24} color={Colors.textTertiary} />
                                    </TouchableOpacity>
                                </View>
                            </Swipeable>
                        ))}
                    </View>
                )}

                {/* 2. Upcoming Assignments (다가오는 과제) */}
                {data?.upcoming_assignments?.length > 0 && (
                    <View style={styles.section}>
                        <SectionHeader title="다가오는 과제" icon="calendar" />
                        {data.upcoming_assignments.map((item: any) => (
                            <Swipeable
                                key={item.id}
                                renderRightActions={(progress, dragX) => renderRightActions(progress, dragX, () => handleCompleteAssignment(item.id))}
                            >
                                <View style={styles.itemCard}>
                                    <View style={styles.itemIcon}>
                                        <Ionicons
                                            name="clipboard-outline"
                                            size={24}
                                            color={item.is_completed ? Colors.textTertiary : Colors.primary}
                                        />
                                    </View>
                                    <View style={styles.itemContent}>
                                        <Text style={[styles.itemCourse, item.is_completed && { color: Colors.textTertiary }]}>{item.course_name}</Text>
                                        <Text style={[styles.itemTitle, item.is_completed && { color: Colors.textTertiary, textDecorationLine: 'line-through' }]} numberOfLines={1}>{item.title}</Text>
                                        <Text style={[styles.itemDate, { color: Colors.textSecondary }, item.is_completed && { color: Colors.textTertiary }]}>
                                            {item.due_date} 마감
                                        </Text>
                                    </View>
                                    <TouchableOpacity onPress={() => handleCompleteAssignment(item.id)} style={styles.checkButton}>
                                        <Ionicons
                                            name={item.is_completed ? "checkmark-circle" : "checkmark-circle-outline"}
                                            size={24}
                                            color={item.is_completed ? Colors.primary : Colors.textTertiary}
                                        />
                                    </TouchableOpacity>
                                </View>
                            </Swipeable>
                        ))}
                    </View>
                )}
            </ScrollView>

            {/* AI Summary Modal */}
            <Modal
                animationType="fade"
                transparent={true}
                visible={!!selectedSummary}
                onRequestClose={() => setSelectedSummary(null)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>{selectedSummary?.course_name}</Text>
                            <TouchableOpacity onPress={() => setSelectedSummary(null)} style={styles.closeButton}>
                                <Ionicons name="close" size={24} color={Colors.textPrimary} />
                            </TouchableOpacity>
                        </View>
                        <ScrollView style={styles.modalBody}>
                            <Markdown style={markdownStyles}>
                                {selectedSummary?.summary}
                            </Markdown>
                        </ScrollView>
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
};

const markdownStyles = StyleSheet.create({
    body: {
        fontSize: 16,
        color: Colors.textPrimary,
        lineHeight: 24,
    },
    strong: {
        fontWeight: 'bold',
        color: Colors.primary,
    },
    heading1: {
        fontSize: 20,
        fontWeight: 'bold',
        marginBottom: 10,
        color: Colors.textPrimary,
    },
    // Add other markdown styles if needed
});

const cardMarkdownStyles = StyleSheet.create({
    body: {
        fontSize: 13,
        color: Colors.textSecondary,
        lineHeight: 18,
    },
    strong: {
        fontWeight: 'bold',
        color: Colors.primary,
    },
    heading1: {
        fontSize: 14,
        fontWeight: 'bold',
        marginBottom: 4,
        color: Colors.textPrimary,
    },
    paragraph: {
        marginTop: 0,
        marginBottom: 8,
    },
    list_item: {
        flexDirection: 'row',
        justifyContent: 'flex-start',
    },
    bullet_list: {
        marginBottom: 8,
    },
});

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.background,
    },
    centered: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    scrollContent: {
        padding: Spacing.l, // Increased padding for cleaner look
        paddingBottom: Spacing.xxl,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: Spacing.xl,
        marginTop: Spacing.m,
    },
    greeting: {
        ...Typography.header1,
        fontSize: 28, // Slightly larger for impact
    },
    date: {
        ...Typography.body2,
        marginTop: 4,
    },
    syncButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: Colors.surface, // Or Colors.secondary if we want a slight contrast
        justifyContent: 'center',
        alignItems: 'center',
        // ...Layout.shadow.sm, // Removed shadow for cleaner flat look or keep subtle
    },
    syncButtonActive: {
        opacity: 0.7,
    },
    summaryCard: {
        backgroundColor: Colors.surface,
        borderRadius: Layout.borderRadius.l,
        padding: Spacing.l,
        marginBottom: Spacing.xl,
        borderWidth: 1,
        borderColor: Colors.border,
        ...Layout.shadow.default,
    },
    summaryTitle: {
        ...Typography.subtitle1,
        marginBottom: Spacing.m,
    },
    statsRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    statItem: {
        flex: 1,
        alignItems: 'center',
    },
    statLabel: {
        ...Typography.caption,
        marginBottom: 4,
    },
    statValue: {
        fontSize: 24,
        fontWeight: '700',
        color: Colors.textPrimary,
    },
    divider: {
        width: 1,
        height: 40,
        backgroundColor: Colors.divider,
    },
    section: {
        marginBottom: Spacing.xl,
    },
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: Spacing.m,
        paddingHorizontal: Spacing.xs,
    },
    sectionHeaderLeft: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    sectionTitle: {
        ...Typography.header2,
        fontSize: 20,
        flexShrink: 1, // Prevent text from pushing out but allow wrapping if absolutely necessary (though here we want to avoid premature wrapping)
    },
    countBadge: {
        backgroundColor: Colors.error,
        borderRadius: 12,
        paddingHorizontal: 8,
        paddingVertical: 2,
        marginLeft: 8,
    },
    countText: {
        color: '#fff',
        fontSize: 12,
        fontWeight: 'bold',
    },
    actionLink: {
        ...Typography.body2,
        color: Colors.primary,
        fontWeight: '600',
    },
    horizontalScroll: {
        paddingRight: Spacing.m,
    },
    aiCard: {
        backgroundColor: Colors.surface,
        borderWidth: 1,
        borderColor: Colors.primary + '20', // Slight tint
        borderRadius: Layout.borderRadius.l,
        padding: Spacing.l,
        marginRight: Spacing.m,
        width: 240,
        height: 180,
        ...Layout.shadow.default,
        // justifyContent: 'space-between', // Removed to let content fill space
    },
    aiHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: Spacing.s,
    },
    aiIconContainer: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: Colors.primary,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: Spacing.s,
    },
    aiCourseName: {
        ...Typography.subtitle1,
        fontSize: 16,
        flex: 1,
    },
    aiContentContainer: {
        flex: 1,
        overflow: 'hidden', // Clip the markdown content
        marginBottom: Spacing.s, // Add some space at bottom so text doesn't run tightly into edge
    },
    aiFooter: {
        position: 'absolute',
        bottom: Spacing.l, // Align with padding
        right: Spacing.l,  // Align with padding
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'flex-end',
        backgroundColor: Colors.surface, // Cover text behind it
        paddingLeft: 8,
        paddingTop: 4,
        borderRadius: 4,
    },
    readMore: {
        fontSize: 13,
        color: Colors.primary,
        fontWeight: '600',
        marginRight: 4,
    },
    generateButton: {
        flexDirection: 'row',
        backgroundColor: Colors.primary,
        paddingVertical: 14,
        paddingHorizontal: 24,
        borderRadius: 30, // Pill shape
        alignItems: 'center',
        alignSelf: 'flex-start',
        marginLeft: Spacing.xs,
        ...Layout.shadow.sm,
    },
    generateButtonText: {
        color: Colors.primaryForeground,
        fontWeight: '600',
        fontSize: 16,
    },
    itemCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: Colors.surface,
        padding: Spacing.l,
        borderRadius: Layout.borderRadius.l,
        marginBottom: Spacing.s,
        borderWidth: 1,
        borderColor: Colors.border,
        ...Layout.shadow.sm,
    },
    itemIcon: {
        marginRight: Spacing.m,
    },
    itemContent: {
        flex: 1,
    },
    itemCourse: {
        ...Typography.caption,
        marginBottom: 4,
    },
    itemTitle: {
        ...Typography.body1,
        fontWeight: '600',
    },
    itemDate: {
        ...Typography.caption,
        color: Colors.error,
        marginTop: 4,
    },
    checkButton: {
        padding: 8,
        marginLeft: Spacing.s,
    },
    rightAction: {
        backgroundColor: Colors.success,
        justifyContent: 'center',
        alignItems: 'flex-end',
        marginBottom: Spacing.s,
        paddingHorizontal: 24,
        borderRadius: Layout.borderRadius.l,
        flex: 1,
    },
    actionText: {
        color: '#fff',
        fontWeight: '600',
        fontSize: 16,
    },
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
        maxHeight: '80%',
        padding: Spacing.xl,
        ...Layout.shadow.default,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: Spacing.l,
        paddingBottom: Spacing.m,
        borderBottomWidth: 1,
        borderBottomColor: Colors.divider,
    },
    modalTitle: {
        ...Typography.header2,
        flex: 1,
    },
    closeButton: {
        padding: 4,
    },
    modalBody: {
        marginBottom: Spacing.s,
    },
    modalText: {
        ...Typography.body1,
        lineHeight: 28,
    },
});

export default DashboardScreen;
