import React, { useEffect, useState, useMemo } from 'react';
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
import { Spacing } from './constants/theme';
import type { ColorScheme, TypographyType, LayoutType } from './constants/theme';
import { useTheme } from './context/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ScreenOrientation from 'expo-screen-orientation';
import { InlineEmpty } from './components/EmptyState';
import { useToast } from './context/ToastContext';
import ItemRow from './components/ItemRow';
import VodActionSheet from './components/VodActionSheet';
import VodWebViewer from './components/VodWebViewer';
import { useLabs } from './context/LabsContext';
import { formatDeadline } from './utils/datetime';

// ============================================
// SECTION HEADER
// ============================================
interface SectionHeaderProps {
    title: string;
    icon: keyof typeof Ionicons.glyphMap;
    iconColor?: string;
    count?: number;
}

const SectionHeader = ({ title, icon, iconColor, count, styles }: SectionHeaderProps & { styles: any }) => (
    <View style={styles.sectionHeader}>
        <View style={[styles.sectionIconContainer, { backgroundColor: (iconColor || '#000') + '15' }]}>
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
const BoardItem = ({ board, onPress, isFirst, isLast, colors, styles }: { board: any; onPress: () => void; isFirst: boolean; isLast: boolean; colors: ColorScheme; styles: any }) => (
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
            <Ionicons name="chatbubble-outline" size={18} color={colors.primary} />
        </View>
        <Text style={styles.boardTitle} numberOfLines={1}>
            {board.title}
        </Text>
        <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
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
    const { autoWatchEnabled, brainEnabled } = useLabs();
    const { colors, typography, layout, isDark } = useTheme();
    const styles = useMemo(() => createStyles(colors, typography, layout, isDark), [colors, typography, layout, isDark]);

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
                backgroundColor: colors.background,
                elevation: 0,
                shadowOpacity: 0,
            },
            headerTintColor: colors.textPrimary,
            headerTitleStyle: {
                ...typography.subtitle1,
                fontSize: 16,
            },
        });
        loadData();
    }, [navigation, course.name, colors.background, colors.textPrimary]);

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
            if (e?.response?.status === 403) {
                showError('비활성화됨', '설정의 개발자 옵션에서 자동 시청을 켜주세요.');
            } else if (e?.response?.status === 409) {
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
                <ActivityIndicator size="large" color={colors.primary} />
            </View>
        );
    }

    const completedVods = vods.filter(v => v.is_completed).length;
    const completedAssignments = assignments.filter(a => a.is_completed).length;

    return (
        <View style={styles.container}>
            <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={colors.background} />

            <ScrollView
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={onRefresh}
                        tintColor={colors.primary}
                        colors={[colors.primary]}
                    />
                }
            >
                {/* Course Header — the name is already in the nav bar directly above,
                    so repeating it here just pushed the actual content down a screen. */}
                <View style={styles.courseHeader}>
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

                {/* Course brain. Hidden entirely unless the lab toggle is on, like the
                    auto-watch controls — an experiment should not advertise itself. */}
                {brainEnabled && (
                    <TouchableOpacity
                        style={styles.brainRow}
                        activeOpacity={0.6}
                        onPress={() => (navigation as any).navigate('CourseLibrary', {
                            courseId: course.id,
                            courseName: course.name,
                        })}
                    >
                        <View style={styles.brainText}>
                            <Text style={styles.brainTitle}>강의 자료 둘러보기</Text>
                            <Text style={styles.brainSubtitle}>주차별로 정리된 자료·강의·과제</Text>
                        </View>
                        <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
                    </TouchableOpacity>
                )}

                {brainEnabled && (
                    <TouchableOpacity
                        style={styles.brainRow}
                        activeOpacity={0.6}
                        onPress={() => (navigation as any).navigate('CourseBrainChat', {
                            courseId: course.id,
                            courseName: course.name,
                        })}
                    >
                        <View style={styles.brainText}>
                            <Text style={styles.brainTitle}>강의 브레인에게 질문하기</Text>
                            <Text style={styles.brainSubtitle}>자료를 근거로 답하고 출처를 알려줘요</Text>
                        </View>
                        <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
                    </TouchableOpacity>
                )}

                {/* Boards Section */}
                {boards.length > 0 && (
                    <View style={styles.section}>
                        <SectionHeader
                            title="게시판"
                            icon="chatbubbles"
                            iconColor={colors.secondary}
                            count={boards.length}
                            styles={styles}
                        />
                        <View style={styles.boardsContainer}>
                            {boards.map((board, index) => (
                                <BoardItem
                                    key={board.id}
                                    board={board}
                                    onPress={() => (navigation as any).navigate('Board', { board })}
                                    isFirst={index === 0}
                                    isLast={index === boards.length - 1}
                                    colors={colors}
                                    styles={styles}
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
                        iconColor={colors.primary}
                        count={vods.length > 0 ? `${completedVods}/${vods.length}` as any : undefined}
                        styles={styles}
                    />
                    {vods.length === 0 ? (
                        <InlineEmpty message="동영상 강의가 없어요." />
                    ) : (
                        [...vods].sort((a, b) => (a.end_date ? new Date(a.end_date).getTime() : Infinity) - (b.end_date ? new Date(b.end_date).getTime() : Infinity)).map((vod) => (
                            <ItemRow
                                key={vod.id}
                                title={vod.title}
                                courseName={course.name}
                                meta={formatDeadline(vod.end_date) || undefined}
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
                        iconColor={colors.accent}
                        count={assignments.length > 0 ? `${completedAssignments}/${assignments.length}` as any : undefined}
                        styles={styles}
                    />
                    {assignments.length === 0 ? (
                        <InlineEmpty message="과제가 없어요." />
                    ) : (
                        [...assignments].sort((a, b) => (a.due_date ? new Date(a.due_date).getTime() : Infinity) - (b.due_date ? new Date(b.due_date).getTime() : Infinity)).map((a) => (
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
                    showAutoWatch={autoWatchEnabled}
                />
            )}
        </View>
    );
}

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
        paddingTop: Spacing.m,
    },

    // Course Header
    courseHeader: {
        backgroundColor: colors.surface,
        borderRadius: layout.borderRadius.xl,
        padding: Spacing.l,
        marginBottom: Spacing.xl,
        borderWidth: 1,
        borderColor: colors.border,
        ...layout.shadow.default,
    },
    courseName: {
        ...typography.header2,
        marginBottom: Spacing.l,
    },
    brainRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.m,
        backgroundColor: colors.surface,
        borderRadius: layout.borderRadius.l,
        borderWidth: 1,
        borderColor: colors.border,
        paddingHorizontal: Spacing.m,
        paddingVertical: 14,
        marginBottom: Spacing.xl,
    },
    brainText: { flex: 1, gap: 2 },
    brainTitle: { ...typography.subtitle1 },
    brainSubtitle: { ...typography.caption },
    statsRow: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        alignItems: 'center',
    },
    statItem: {
        alignItems: 'center',
    },
    statValue: {
        ...typography.number,
        fontSize: 24,
        marginBottom: 2,
    },
    statLabel: {
        ...typography.caption,
    },
    statDivider: {
        width: 1,
        height: 32,
        backgroundColor: colors.divider,
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
        ...typography.header3,
        flex: 1,
    },
    countPill: {
        backgroundColor: colors.surfaceMuted,
        paddingHorizontal: Spacing.s,
        paddingVertical: 2,
        borderRadius: layout.borderRadius.full,
    },
    countText: {
        ...typography.caption,
        fontWeight: '600',
    },

    // Boards
    boardsContainer: {
        backgroundColor: colors.surface,
        borderRadius: layout.borderRadius.l,
        borderWidth: 1,
        borderColor: colors.border,
        overflow: 'hidden',
        ...layout.shadow.sm,
    },
    boardItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: Spacing.m,
        backgroundColor: colors.surface,
    },
    boardItemFirst: {
        borderTopLeftRadius: layout.borderRadius.l,
        borderTopRightRadius: layout.borderRadius.l,
    },
    boardItemLast: {
        borderBottomLeftRadius: layout.borderRadius.l,
        borderBottomRightRadius: layout.borderRadius.l,
    },
    boardItemBorder: {
        borderBottomWidth: 1,
        borderBottomColor: colors.divider,
    },
    boardIconContainer: {
        width: 36,
        height: 36,
        borderRadius: 12,
        backgroundColor: colors.primaryLighter,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: Spacing.m,
    },
    boardTitle: {
        ...typography.subtitle1,
        fontSize: 15,
        flex: 1,
        marginRight: Spacing.s,
    },
});
