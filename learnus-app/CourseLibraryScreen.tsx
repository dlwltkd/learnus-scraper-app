import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    LayoutAnimation,
    Platform,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    UIManager,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';

import { Spacing } from './constants/theme';
import type { ColorScheme, TypographyType, LayoutType } from './constants/theme';
import { useTheme } from './context/ThemeContext';
import { getCourseLibrary, learnLibraryItem } from './services/api';
import type { CourseLibrary, LibraryItem, LibraryItemType } from './services/api';
import { shortenWeek } from './utils/week';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
}

// The glyph is the one icon on the row, and it earns its place: a week mixes decks,
// videos, assignments and notices, so the type is what distinguishes siblings. This is
// the same rule that says a section header shouldn't repeat its own icon on every child.
const TYPE_ICON: Record<LibraryItemType, keyof typeof Ionicons.glyphMap> = {
    file: 'document-text-outline',
    label: 'information-circle-outline',
    vod: 'play-circle-outline',
    assignment: 'create-outline',
    board: 'chatbubbles-outline',
};

// Boards are already in the corpus through their posts, and labels carry their text
// inline from the course page, so neither has anything to learn on demand.
const LEARNABLE: LibraryItemType[] = ['file', 'vod', 'assignment'];

const FILTERS: { key: 'all' | LibraryItemType; label: string }[] = [
    { key: 'all', label: '전체' },
    { key: 'file', label: '자료' },
    { key: 'vod', label: '강의' },
    { key: 'assignment', label: '과제' },
    { key: 'board', label: '공지' },
];

function itemMeta(item: LibraryItem): string {
    switch (item.type) {
        case 'file':
            return item.pages ? `${item.pages}쪽` : '';
        case 'vod': {
            const mins = item.duration ? Math.round(item.duration / 60) : 0;
            return mins ? `${mins}분` : '';
        }
        case 'assignment':
            return item.due_date ? String(item.due_date).slice(0, 16) : '';
        case 'board':
            return item.posts ? `글 ${item.posts}개` : '';
        default:
            return '';
    }
}

export default function CourseLibraryScreen() {
    const { colors, typography, layout, isDark } = useTheme();
    const styles = useMemo(
        () => createStyles(colors, typography, layout, isDark),
        [colors, typography, layout, isDark],
    );
    const navigation = useNavigation<any>();
    const route = useRoute();
    const { courseId, courseName } = route.params as { courseId: number; courseName?: string };

    const [library, setLibrary] = useState<CourseLibrary | null>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [filter, setFilter] = useState<'all' | LibraryItemType>('all');
    const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
    // Items this screen just queued. The server is the source of truth via item.learning,
    // but that only updates on the next fetch, and the row has to react to the tap now.
    const [justQueued, setJustQueued] = useState<Record<string, boolean>>({});

    const itemKey = (item: LibraryItem) => `${item.type}-${item.id}`;
    const isLearning = (item: LibraryItem) => Boolean(item.learning || justQueued[itemKey(item)]);

    const learnItem = useCallback(async (item: LibraryItem) => {
        setJustQueued(prev => ({ ...prev, [itemKey(item)]: true }));
        try {
            await learnLibraryItem(courseId, item.type as 'file' | 'vod' | 'assignment', item.id);
        } catch {
            setJustQueued(prev => {
                const next = { ...prev };
                delete next[itemKey(item)];
                return next;
            });
        }
    }, [courseId]);

    const load = useCallback(async () => {
        try {
            setLibrary(await getCourseLibrary(courseId));
        } catch (e) {
            console.log('Failed to load library', e);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [courseId]);

    useEffect(() => {
        navigation.setOptions({ title: courseName || '강의 자료' });
        load();
    }, [navigation, courseName, load]);

    // While anything is being learned, refresh so rows flip to learned on their own.
    // Stops as soon as nothing is outstanding, so a settled library makes no requests.
    const anyLearning = useMemo(
        () => Boolean(library?.sections.some(sec => sec.items.some(i => i.learning)))
            || Object.keys(justQueued).length > 0,
        [library, justQueued],
    );

    useEffect(() => {
        if (!anyLearning) return;
        const timer = setInterval(async () => {
            const fresh = await getCourseLibrary(courseId).catch(() => null);
            if (!fresh) return;
            setLibrary(fresh);
            // Drop optimistic marks the server now reports on, so the two cannot disagree.
            setJustQueued(prev => {
                const next: Record<string, boolean> = {};
                for (const sec of fresh.sections) {
                    for (const item of sec.items) {
                        const key = `${item.type}-${item.id}`;
                        if (prev[key] && !item.in_corpus && !item.learning) next[key] = true;
                    }
                }
                return next;
            });
        }, 5000);
        return () => clearInterval(timer);
    }, [anyLearning, courseId]);

    const toggleSection = (key: string) => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setCollapsed(prev => ({ ...prev, [key]: !prev[key] }));
    };

    if (loading) {
        return (
            <View style={styles.centered}>
                <ActivityIndicator size="large" color={colors.primary} />
            </View>
        );
    }

    if (!library) {
        return (
            <View style={styles.centered}>
                <Text style={styles.emptyText}>자료를 불러오지 못했어요.</Text>
            </View>
        );
    }

    const { stats } = library;
    // "유형별" is a predicate over the same tree, not a second structure.
    const sections = library.sections
        .map(s => ({ ...s, items: filter === 'all' ? s.items : s.items.filter(i => i.type === filter || (filter === 'file' && i.type === 'label')) }))
        .filter(s => s.items.length > 0);

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
                {/* Provenance, stated plainly: what the brain can and cannot answer from.
                    Counts boards rather than posts so these four numbers add up to the
                    denominator on the line below; each board's post count is on its row. */}
                <Text style={styles.provenance}>
                    자료 {stats.files} · 강의 {stats.vods} · 과제 {stats.assignments} · 공지 {stats.boards}
                </Text>
                <Text style={styles.provenanceSub}>
                    {stats.in_corpus}/{stats.total_items}개 학습됨
                </Text>

                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    style={styles.filterStrip}
                    contentContainerStyle={styles.filterRow}
                >
                    {FILTERS.map(f => (
                        <TouchableOpacity
                            key={f.key}
                            style={[styles.chip, filter === f.key && styles.chipActive]}
                            onPress={() => setFilter(f.key)}
                            activeOpacity={0.7}
                        >
                            <Text style={[styles.chipText, filter === f.key && styles.chipTextActive]}>
                                {f.label}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>

                {sections.map(section => {
                    const key = String(section.section ?? 'none');
                    const isCollapsed = collapsed[key];
                    return (
                        <View key={key} style={styles.section}>
                            <TouchableOpacity
                                style={styles.sectionHeader}
                                onPress={() => toggleSection(key)}
                                activeOpacity={0.7}
                            >
                                <Ionicons
                                    name={isCollapsed ? 'chevron-forward' : 'chevron-down'}
                                    size={16}
                                    color={colors.textTertiary}
                                />
                                <Text style={styles.sectionTitle} numberOfLines={1}>{shortenWeek(section.week)}</Text>
                                <Text style={styles.sectionCount}>{section.items.length}</Text>
                            </TouchableOpacity>

                            {!isCollapsed && (
                                <View style={styles.group}>
                                    {section.items.map((item, index) => (
                                        <TouchableOpacity
                                            key={`${item.type}-${item.id}`}
                                            style={[styles.row, index > 0 && styles.rowBorderTop]}
                                            activeOpacity={0.6}
                                            onPress={() => navigation.navigate('LibraryItem', { item, courseId, courseName })}
                                        >
                                            <Ionicons
                                                name={TYPE_ICON[item.type]}
                                                size={20}
                                                color={colors.textSecondary}
                                            />
                                            <View style={styles.rowText}>
                                                {/* Title keeps full weight even when the brain has not
                                                    learned the item: the file still opens and reads
                                                    normally, and dimming it read as disabled. The
                                                    caption below carries the state instead. */}
                                                <Text style={styles.rowTitle} numberOfLines={2}>
                                                    {item.title}
                                                </Text>
                                                {/* Not-yet-learned items stay visible and say why. A
                                                    library that hides them teaches you not to trust it. */}
                                                {!item.in_corpus && (
                                                    <Text style={styles.rowPending}>
                                                        {isLearning(item)
                                                            ? '학습 중'
                                                            : item.type === 'vod' ? '아직 텍스트 변환 안 됨' : '아직 학습 안 됨'}
                                                    </Text>
                                                )}
                                            </View>
                                            {item.completed && (
                                                <Ionicons name="checkmark-circle" size={16} color={colors.success} />
                                            )}
                                            {/* Teach the brain this one item. Only offered where there is
                                                something to learn — boards are already in the corpus via
                                                their posts, and a learned item needs nothing. */}
                                            {!item.in_corpus && LEARNABLE.includes(item.type) ? (
                                                isLearning(item) ? (
                                                    <ActivityIndicator size="small" color={colors.primary} style={styles.learnBusy} />
                                                ) : (
                                                    <TouchableOpacity
                                                        style={styles.learnButton}
                                                        activeOpacity={0.7}
                                                        onPress={() => learnItem(item)}
                                                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                                    >
                                                        <Text style={styles.learnButtonText}>학습</Text>
                                                    </TouchableOpacity>
                                                )
                                            ) : (
                                                <Text style={styles.rowMeta}>{itemMeta(item)}</Text>
                                            )}
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            )}
                        </View>
                    );
                })}

                {sections.length === 0 && (
                    <Text style={styles.emptyText}>이 조건에 맞는 자료가 없어요.</Text>
                )}
            </ScrollView>
        </SafeAreaView>
    );
}

const createStyles = (colors: ColorScheme, typography: TypographyType, layout: LayoutType, isDark: boolean) =>
    StyleSheet.create({
        container: { flex: 1, backgroundColor: colors.background },
        centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
        content: { paddingHorizontal: Spacing.l, paddingBottom: Spacing.xxl },

        provenance: { ...typography.subtitle2, color: colors.textSecondary, marginTop: Spacing.m },
        provenanceSub: { ...typography.caption, marginTop: 2 },

        filterStrip: { marginHorizontal: -Spacing.l, marginTop: Spacing.m },
        filterRow: { paddingHorizontal: Spacing.l, gap: Spacing.s },
        chip: {
            paddingHorizontal: 14,
            paddingVertical: 7,
            borderRadius: layout.borderRadius.full,
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.border,
        },
        chipActive: { backgroundColor: colors.primaryLighter, borderColor: colors.primary },
        chipText: { ...typography.buttonSmall, color: colors.textSecondary },
        chipTextActive: { color: colors.primary },

        section: { marginTop: Spacing.l },
        sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.s, paddingVertical: Spacing.xs, marginBottom: Spacing.s },
        sectionTitle: { ...typography.subtitle1, flex: 1 },
        sectionCount: { ...typography.caption, color: colors.textTertiary },

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
            gap: Spacing.m,
            paddingHorizontal: Spacing.m,
            paddingVertical: 14,
        },
        rowBorderTop: { borderTopWidth: 1, borderTopColor: colors.divider },
        rowText: { flex: 1, gap: 2 },
        rowTitle: { ...typography.body1, fontSize: 15 },
        learnButton: {
            paddingHorizontal: Spacing.m,
            paddingVertical: 6,
            borderRadius: layout.borderRadius.full,
            borderWidth: 1,
            borderColor: colors.primary,
        },
        learnButtonText: {
            ...typography.caption,
            color: colors.primary,
            fontWeight: '600',
        },
        learnBusy: {
            // Same footprint as the button so rows do not shift when one starts.
            width: 56,
        },
        rowPending: { ...typography.caption, color: colors.textTertiary },
        rowMeta: { ...typography.caption, color: colors.textTertiary },

        emptyText: { ...typography.body2, color: colors.textTertiary, textAlign: 'center', marginTop: Spacing.xl },
    });
