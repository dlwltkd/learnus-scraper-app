import React, { useEffect, useState } from 'react';
import {
    StyleSheet,
    View,
    Text,
    TouchableOpacity,
    ActivityIndicator,
    ScrollView,
    StatusBar,
    RefreshControl,
} from 'react-native';
import { getAssignments, getBoards, getVods, watchSingleVod } from './services/api';
import { useRoute, useNavigation } from '@react-navigation/native';
import { Colors, Spacing, Layout, Typography } from './constants/theme';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ScreenOrientation from 'expo-screen-orientation';
import { InlineEmpty } from './components/EmptyState';
import { useToast } from './context/ToastContext';
import ItemRow from './components/ItemRow';
import VodActionSheet from './components/VodActionSheet';
import VodWebViewer from './components/VodWebViewer';

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
const BoardItem = ({ board, onPress, isFirst, isLast }: { board: any; onPress: () => void; isFirst: boolean; isLast: boolean }) => (
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
// MAIN COURSE DETAIL SCREEN
// ============================================
export default function CourseDetailScreen() {
    const route = useRoute();
    const navigation = useNavigation();
    const { course } = route.params as { course: any };
    const { showSuccess, showError } = useToast();

    const [assignments, setAssignments] = useState<any[]>([]);
    const [boards, setBoards] = useState<any[]>([]);
    const [vods, setVods] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [actionSheet, setActionSheet] = useState<any | null>(null);
    const [webViewer, setWebViewer] = useState<{ url: string; title: string; cookies: string } | null>(null);

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

    const openWebViewer = async (item: any) => {
        const cookies = await AsyncStorage.getItem('userToken') || '';
        const viewerUrl = item.url || `https://ys.learnus.org/mod/vod/viewer.php?id=${item.id}`;
        await ScreenOrientation.unlockAsync();
        setWebViewer({ url: viewerUrl, title: item.title, cookies });
    };

    const closeWebViewer = async () => {
        await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
        setWebViewer(null);
    };

    const handleWatch = async () => {
        const item = actionSheet;
        setActionSheet(null);
        await openWebViewer(item);
    };

    const handleAutoWatch = async () => {
        const item = actionSheet;
        setActionSheet(null);
        if (item.is_completed) {
            showSuccess('이미 완료', '이미 시청 완료된 강의예요.');
            return;
        }
        try {
            await watchSingleVod(item.id);
            showSuccess('시청 시작', '백그라운드에서 강의를 시청하고 있어요.');
        } catch (e: any) {
            if (e?.response?.status === 409) {
                showError('진행 중', '전체 시청이 이미 실행 중이에요. 완료 후 다시 시도해주세요.');
            } else {
                showError('오류', '자동 시청을 시작할 수 없어요.');
            }
        }
    };

    const handleTranscribe = () => {
        const item = actionSheet;
        setActionSheet(null);
        (navigation as any).navigate('VodTranscript', {
            vodMoodleId: item.id,
            title: item.title,
            courseName: course.name,
        });
    };

    const getVodState = (vod: any) => {
        if (vod.is_completed) return 'completed' as const;
        const now = new Date();
        if (vod.end_date && new Date(vod.end_date) < now) return 'missed' as const;
        if (vod.start_date && new Date(vod.start_date) > now) return 'upcoming' as const;
        return 'pending' as const;
    };

    const getAssignmentState = (a: any) => {
        if (a.is_completed) return 'completed' as const;
        if (a.due_date && new Date(a.due_date) < new Date()) return 'missed' as const;
        return 'pending' as const;
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
                        vods.map((vod) => (
                            <ItemRow
                                key={vod.id}
                                title={vod.title}
                                courseName={course.name}
                                meta={vod.end_date ? `~ ${new Date(vod.end_date).toLocaleDateString()} 마감` : undefined}
                                state={getVodState(vod)}
                                type="vod"
                                onMenuPress={() => setActionSheet(vod)}
                            />
                        ))
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
                        assignments.map((a) => (
                            <ItemRow
                                key={a.id}
                                title={a.title}
                                courseName={course.name}
                                meta={a.due_date ? `마감: ${a.due_date}` : undefined}
                                state={getAssignmentState(a)}
                                type="assignment"
                            />
                        ))
                    )}
                </View>

                <View style={{ height: 40 }} />
            </ScrollView>

            {webViewer && (
                <VodWebViewer
                    url={webViewer.url}
                    title={webViewer.title}
                    cookies={webViewer.cookies}
                    onClose={closeWebViewer}
                />
            )}

            {actionSheet && (
                <VodActionSheet
                    item={actionSheet}
                    onWatch={handleWatch}
                    onTranscribe={handleTranscribe}
                    onAutoWatch={handleAutoWatch}
                    onClose={() => setActionSheet(null)}
                />
            )}
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
});
