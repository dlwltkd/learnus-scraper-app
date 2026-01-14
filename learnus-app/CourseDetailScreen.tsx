import React, { useEffect, useState, useRef } from 'react';
import {
    StyleSheet,
    View,
    Text,
    TouchableOpacity,
    ActivityIndicator,
    ScrollView,
    StatusBar,
    Animated,
    RefreshControl,
} from 'react-native';
import { getAssignments, getBoards, getVods } from './services/api';
import { useRoute, useNavigation } from '@react-navigation/native';
import { Colors, Spacing, Layout, Typography } from './constants/theme';
import { Ionicons } from '@expo/vector-icons';
import Card from './components/Card';
import Badge from './components/Badge';
import EmptyState, { InlineEmpty } from './components/EmptyState';

// ============================================
// SECTION HEADER
// ============================================
interface SectionHeaderProps {
    title: string;
    icon: keyof typeof Ionicons.glyphMap;
    iconColor?: string;
    count?: number;
}

const SectionHeader = ({ title, icon, iconColor = Colors.primary, count }: SectionHeaderProps) => (
    <View style={styles.sectionHeader}>
        <View style={[styles.sectionIconContainer, { backgroundColor: iconColor + '15' }]}>
            <Ionicons name={icon} size={18} color={iconColor} />
        </View>
        <Text style={styles.sectionTitle}>{title}</Text>
        {count !== undefined && count > 0 && (
            <View style={styles.countPill}>
                <Text style={styles.countText}>{count}</Text>
            </View>
        )}
    </View>
);

// ============================================
// BOARD ITEM
// ============================================
interface BoardItemProps {
    board: any;
    onPress: () => void;
    isFirst: boolean;
    isLast: boolean;
}

const BoardItem = ({ board, onPress, isFirst, isLast }: BoardItemProps) => (
    <TouchableOpacity
        style={[
            styles.boardItem,
            isFirst && styles.boardItemFirst,
            isLast && styles.boardItemLast,
            !isLast && styles.boardItemBorder,
        ]}
        onPress={onPress}
        activeOpacity={0.7}
    >
        <View style={styles.boardIconContainer}>
            <Ionicons name="chatbubble-outline" size={18} color={Colors.primary} />
        </View>
        <Text style={styles.boardTitle} numberOfLines={1}>
            {board.title}
        </Text>
        <Ionicons name="chevron-forward" size={18} color={Colors.textTertiary} />
    </TouchableOpacity>
);

// ============================================
// VOD ITEM
// ============================================
interface VodItemProps {
    vod: any;
    index: number;
}

const VodItem = ({ vod, index }: VodItemProps) => {
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const slideAnim = useRef(new Animated.Value(20)).current;

    useEffect(() => {
        Animated.parallel([
            Animated.timing(fadeAnim, {
                toValue: 1,
                duration: 300,
                delay: index * 50,
                useNativeDriver: true,
            }),
            Animated.timing(slideAnim, {
                toValue: 0,
                duration: 300,
                delay: index * 50,
                useNativeDriver: true,
            }),
        ]).start();
    }, []);

    return (
        <Animated.View
            style={{
                opacity: fadeAnim,
                transform: [{ translateY: slideAnim }],
            }}
        >
            <View style={[styles.vodCard, vod.is_completed && styles.vodCardCompleted]}>
                <View style={[styles.vodIcon, vod.is_completed && styles.vodIconCompleted]}>
                    <Ionicons
                        name="play-circle"
                        size={22}
                        color={vod.is_completed ? Colors.textTertiary : Colors.primary}
                    />
                </View>

                <View style={styles.vodContent}>
                    <Text
                        style={[styles.vodTitle, vod.is_completed && styles.vodTitleCompleted]}
                        numberOfLines={2}
                    >
                        {vod.title}
                    </Text>
                    <View style={styles.vodMeta}>
                        <Ionicons name="calendar-outline" size={12} color={Colors.textTertiary} />
                        <Text style={styles.vodDate}>
                            {vod.start_date ? `${vod.start_date} ~ ${vod.end_date}` : '날짜 없음'}
                        </Text>
                    </View>
                </View>

                {vod.is_completed && (
                    <View style={styles.completedBadge}>
                        <Ionicons name="checkmark" size={14} color={Colors.success} />
                    </View>
                )}
            </View>
        </Animated.View>
    );
};

// ============================================
// ASSIGNMENT ITEM
// ============================================
interface AssignmentItemProps {
    assignment: any;
    index: number;
}

const AssignmentItem = ({ assignment, index }: AssignmentItemProps) => {
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const slideAnim = useRef(new Animated.Value(20)).current;

    useEffect(() => {
        Animated.parallel([
            Animated.timing(fadeAnim, {
                toValue: 1,
                duration: 300,
                delay: index * 50,
                useNativeDriver: true,
            }),
            Animated.timing(slideAnim, {
                toValue: 0,
                duration: 300,
                delay: index * 50,
                useNativeDriver: true,
            }),
        ]).start();
    }, []);

    const isPastDue = assignment.due_date && new Date(assignment.due_date) < new Date();

    return (
        <Animated.View
            style={{
                opacity: fadeAnim,
                transform: [{ translateY: slideAnim }],
            }}
        >
            <View style={[styles.assignmentCard, assignment.is_completed && styles.assignmentCardCompleted]}>
                <View style={[
                    styles.assignmentIcon,
                    assignment.is_completed && styles.assignmentIconCompleted,
                    !assignment.is_completed && isPastDue && styles.assignmentIconOverdue,
                ]}>
                    <Ionicons
                        name="document-text"
                        size={20}
                        color={
                            assignment.is_completed
                                ? Colors.textTertiary
                                : isPastDue
                                    ? Colors.error
                                    : Colors.primary
                        }
                    />
                </View>

                <View style={styles.assignmentContent}>
                    <Text
                        style={[styles.assignmentTitle, assignment.is_completed && styles.assignmentTitleCompleted]}
                        numberOfLines={2}
                    >
                        {assignment.title}
                    </Text>
                    <View style={styles.assignmentMeta}>
                        <Ionicons
                            name="time-outline"
                            size={12}
                            color={isPastDue && !assignment.is_completed ? Colors.error : Colors.textTertiary}
                        />
                        <Text style={[
                            styles.assignmentDate,
                            isPastDue && !assignment.is_completed && styles.assignmentDateOverdue,
                        ]}>
                            마감: {assignment.due_date || '날짜 없음'}
                        </Text>
                    </View>
                </View>

                {assignment.is_completed && (
                    <View style={styles.completedBadge}>
                        <Ionicons name="checkmark" size={14} color={Colors.success} />
                    </View>
                )}
            </View>
        </Animated.View>
    );
};

// ============================================
// MAIN COURSE DETAIL SCREEN
// ============================================
export default function CourseDetailScreen() {
    const route = useRoute();
    const navigation = useNavigation();
    const { course } = route.params as { course: any };

    const [assignments, setAssignments] = useState<any[]>([]);
    const [boards, setBoards] = useState<any[]>([]);
    const [vods, setVods] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    useEffect(() => {
        navigation.setOptions({
            title: course.name,
            headerStyle: {
                backgroundColor: Colors.background,
                elevation: 0,
                shadowOpacity: 0,
            },
            headerTintColor: Colors.textPrimary,
            headerTitleStyle: {
                ...Typography.subtitle1,
                fontSize: 16,
            },
        });
        loadData();
    }, []);

    const loadData = async () => {
        try {
            const [assigns, brds, vds] = await Promise.all([
                getAssignments(course.id),
                getBoards(course.id),
                getVods(course.id),
            ]);
            setAssignments(assigns);
            setBoards(brds);
            setVods(vds);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const onRefresh = () => {
        setRefreshing(true);
        loadData();
    };

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={Colors.primary} />
            </View>
        );
    }

    const completedVods = vods.filter(v => v.is_completed).length;
    const completedAssignments = assignments.filter(a => a.is_completed).length;

    return (
        <View style={styles.container}>
            <StatusBar barStyle="dark-content" backgroundColor={Colors.background} />

            <ScrollView
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={onRefresh}
                        tintColor={Colors.primary}
                        colors={[Colors.primary]}
                    />
                }
            >
                {/* Course Header */}
                <View style={styles.courseHeader}>
                    <Text style={styles.courseName} numberOfLines={3}>
                        {course.name}
                    </Text>
                    <View style={styles.statsRow}>
                        <View style={styles.statItem}>
                            <Text style={styles.statValue}>{vods.length}</Text>
                            <Text style={styles.statLabel}>동강</Text>
                        </View>
                        <View style={styles.statDivider} />
                        <View style={styles.statItem}>
                            <Text style={styles.statValue}>{assignments.length}</Text>
                            <Text style={styles.statLabel}>과제</Text>
                        </View>
                        <View style={styles.statDivider} />
                        <View style={styles.statItem}>
                            <Text style={styles.statValue}>{boards.length}</Text>
                            <Text style={styles.statLabel}>게시판</Text>
                        </View>
                    </View>
                </View>

                {/* Boards Section */}
                {boards.length > 0 && (
                    <View style={styles.section}>
                        <SectionHeader
                            title="게시판"
                            icon="chatbubbles"
                            iconColor={Colors.secondary}
                            count={boards.length}
                        />
                        <View style={styles.boardsContainer}>
                            {boards.map((board, index) => (
                                <BoardItem
                                    key={board.id}
                                    board={board}
                                    onPress={() => (navigation as any).navigate('Board', { board })}
                                    isFirst={index === 0}
                                    isLast={index === boards.length - 1}
                                />
                            ))}
                        </View>
                    </View>
                )}

                {/* VODs Section */}
                <View style={styles.section}>
                    <SectionHeader
                        title="동영상 강의"
                        icon="play-circle"
                        iconColor={Colors.primary}
                        count={vods.length > 0 ? `${completedVods}/${vods.length}` as any : undefined}
                    />
                    {vods.length === 0 ? (
                        <InlineEmpty message="동영상 강의가 없습니다." />
                    ) : (
                        <View style={styles.itemsList}>
                            {vods.map((vod, index) => (
                                <VodItem key={vod.id} vod={vod} index={index} />
                            ))}
                        </View>
                    )}
                </View>

                {/* Assignments Section */}
                <View style={styles.section}>
                    <SectionHeader
                        title="과제"
                        icon="document-text"
                        iconColor={Colors.accent}
                        count={assignments.length > 0 ? `${completedAssignments}/${assignments.length}` as any : undefined}
                    />
                    {assignments.length === 0 ? (
                        <InlineEmpty message="과제가 없습니다." />
                    ) : (
                        <View style={styles.itemsList}>
                            {assignments.map((assignment, index) => (
                                <AssignmentItem key={assignment.id} assignment={assignment} index={index} />
                            ))}
                        </View>
                    )}
                </View>

                <View style={{ height: 40 }} />
            </ScrollView>
        </View>
    );
}

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
        paddingTop: Spacing.m,
    },

    // Course Header
    courseHeader: {
        backgroundColor: Colors.surface,
        borderRadius: Layout.borderRadius.xl,
        padding: Spacing.l,
        marginBottom: Spacing.xl,
        borderWidth: 1,
        borderColor: Colors.border,
        ...Layout.shadow.default,
    },
    courseName: {
        ...Typography.header2,
        marginBottom: Spacing.l,
    },
    statsRow: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        alignItems: 'center',
        paddingTop: Spacing.m,
        borderTopWidth: 1,
        borderTopColor: Colors.divider,
    },
    statItem: {
        alignItems: 'center',
    },
    statValue: {
        ...Typography.number,
        fontSize: 24,
        marginBottom: 2,
    },
    statLabel: {
        ...Typography.caption,
    },
    statDivider: {
        width: 1,
        height: 32,
        backgroundColor: Colors.divider,
    },

    // Section
    section: {
        marginBottom: Spacing.xl,
    },
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: Spacing.m,
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
    countPill: {
        backgroundColor: Colors.surfaceMuted,
        paddingHorizontal: Spacing.s,
        paddingVertical: 2,
        borderRadius: Layout.borderRadius.full,
    },
    countText: {
        ...Typography.caption,
        fontWeight: '600',
    },

    // Boards
    boardsContainer: {
        backgroundColor: Colors.surface,
        borderRadius: Layout.borderRadius.l,
        borderWidth: 1,
        borderColor: Colors.border,
        overflow: 'hidden',
        ...Layout.shadow.sm,
    },
    boardItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: Spacing.m,
        backgroundColor: Colors.surface,
    },
    boardItemFirst: {
        borderTopLeftRadius: Layout.borderRadius.l,
        borderTopRightRadius: Layout.borderRadius.l,
    },
    boardItemLast: {
        borderBottomLeftRadius: Layout.borderRadius.l,
        borderBottomRightRadius: Layout.borderRadius.l,
    },
    boardItemBorder: {
        borderBottomWidth: 1,
        borderBottomColor: Colors.divider,
    },
    boardIconContainer: {
        width: 36,
        height: 36,
        borderRadius: 12,
        backgroundColor: Colors.primaryLighter,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: Spacing.m,
    },
    boardTitle: {
        ...Typography.subtitle1,
        fontSize: 15,
        flex: 1,
        marginRight: Spacing.s,
    },

    // Items List
    itemsList: {
        gap: Spacing.s,
    },

    // VOD Card
    vodCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: Colors.surface,
        padding: Spacing.m,
        borderRadius: Layout.borderRadius.l,
        borderWidth: 1,
        borderColor: Colors.border,
        ...Layout.shadow.sm,
    },
    vodCardCompleted: {
        opacity: 0.7,
        backgroundColor: Colors.surfaceMuted,
    },
    vodIcon: {
        width: 44,
        height: 44,
        borderRadius: 14,
        backgroundColor: Colors.primaryLighter,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: Spacing.m,
    },
    vodIconCompleted: {
        backgroundColor: Colors.surfaceMuted,
    },
    vodContent: {
        flex: 1,
    },
    vodTitle: {
        ...Typography.subtitle1,
        fontSize: 15,
        marginBottom: 4,
    },
    vodTitleCompleted: {
        color: Colors.textTertiary,
    },
    vodMeta: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    vodDate: {
        ...Typography.caption,
    },

    // Assignment Card
    assignmentCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: Colors.surface,
        padding: Spacing.m,
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
    assignmentIconCompleted: {
        backgroundColor: Colors.surfaceMuted,
    },
    assignmentIconOverdue: {
        backgroundColor: Colors.errorLight,
    },
    assignmentContent: {
        flex: 1,
    },
    assignmentTitle: {
        ...Typography.subtitle1,
        fontSize: 15,
        marginBottom: 4,
    },
    assignmentTitleCompleted: {
        color: Colors.textTertiary,
    },
    assignmentMeta: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    assignmentDate: {
        ...Typography.caption,
    },
    assignmentDateOverdue: {
        color: Colors.error,
    },

    // Completed Badge
    completedBadge: {
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: Colors.successLight,
        alignItems: 'center',
        justifyContent: 'center',
        marginLeft: Spacing.s,
    },
});
