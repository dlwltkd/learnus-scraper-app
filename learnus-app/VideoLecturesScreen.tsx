import React, { useState, useEffect } from 'react';
import {
    View, Text, StyleSheet, ScrollView, RefreshControl,
    TouchableOpacity, ActivityIndicator, StatusBar,
    LayoutAnimation, Platform, UIManager,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { useNavigation } from '@react-navigation/native';
import * as ScreenOrientation from 'expo-screen-orientation';
import { getDashboardOverview, watchAllVods, watchSingleVod, getFlashcardDecks, getFlashcardDeck } from './services/api';
import type { FlashcardDeckSummary } from './services/api';
import { Spacing } from './constants/theme';
import type { ColorScheme, TypographyType, LayoutType } from './constants/theme';
import { useTheme } from './context/ThemeContext';
import { useToast } from './context/ToastContext';
import ItemRow from './components/ItemRow';
import VodActionSheet from './components/VodActionSheet';
import VodWebViewer from './components/VodWebViewer';
import { useTourRef } from './hooks/useTourRef';
import { useTour } from './context/TourContext';
import { TOUR_MOCK_OVERVIEW } from './constants/tourMockData';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
}


// ─── SectionHeader ────────────────────────────────────────────────────────────

const SectionHeader = ({ title, count, icon, iconColor, isCollapsible, isCollapsed, onToggle, action }: any) => {
    const { colors, typography, layout, isDark } = useTheme();
    const styles = React.useMemo(() => createStyles(colors, typography, layout, isDark), [colors, typography, layout, isDark]);
    const content = (
        <>
            <Ionicons name={icon} size={20} color={iconColor || colors.primary} style={{ marginRight: 8 }} />
            <Text style={styles.sectionTitle}>{title}</Text>
            {isCollapsible && isCollapsed && count > 0 && (
                <View style={styles.countBadge}><Text style={styles.countText}>{count}</Text></View>
            )}
            {isCollapsible && (
                <Ionicons name={isCollapsed ? 'chevron-down' : 'chevron-up'} size={20} color={colors.textTertiary} style={{ marginLeft: 8 }} />
            )}
        </>
    );
    return (
        <View style={styles.sectionHeader}>
            {isCollapsible
                ? <TouchableOpacity style={styles.sectionHeaderLeft} onPress={onToggle} activeOpacity={0.7}>{content}</TouchableOpacity>
                : <View style={styles.sectionHeaderLeft}>{content}</View>}
            {action}
        </View>
    );
};

// ─── Main Screen ──────────────────────────────────────────────────────────────

const VideoLecturesScreen = () => {
    const { colors, typography, layout, isDark } = useTheme();
    const styles = React.useMemo(() => createStyles(colors, typography, layout, isDark), [colors, typography, layout, isDark]);
    const { showSuccess, showError } = useToast();
    const { notifyInteraction, isActive: tourActive, currentStep } = useTour();
    const navigation = useNavigation<any>();
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState<any>(null);
    const [watching, setWatching] = useState(false);
    const [collapsed, setCollapsed] = useState<{ [k: string]: boolean }>({ missed: false });
    const [webViewer, setWebViewer] = useState<{ url: string; title: string; cookies: string } | null>(null);
    const [actionSheet, setActionSheet] = useState<any | null>(null);
    const [flashcardDecks, setFlashcardDecks] = useState<FlashcardDeckSummary[]>([]);

    // Tour refs
    const watchAllRef = useTourRef('vod-watch-all-btn');
    const availableSectionRef = useTourRef('vod-available-section');
    const firstItemMenuRef = useTourRef('vod-first-item-menu');
    const actionSheetRef = useTourRef('vod-action-sheet-area');

    useEffect(() => { loadData(); }, []);

    // Mock data during tour, revert when done
    const tourActiveRef = React.useRef(false);
    const prevTourActive = React.useRef(false);
    useEffect(() => {
        tourActiveRef.current = tourActive;
        if (tourActive) {
            setData(TOUR_MOCK_OVERVIEW);
            setLoading(false);
        } else if (prevTourActive.current) {
            setActionSheet(null);
            loadData();
        }
        prevTourActive.current = tourActive;
    }, [tourActive]);

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

    const openActionSheet = (item: any) => {
        setActionSheet(item);
        if (tourActive) {
            notifyInteraction('vod-tap-item');
        }
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
        navigation.navigate('VodTranscript', {
            vodMoodleId: item.id,
            title: item.title,
            courseName: item.course_name,
        });
    };

    const toggleSection = (k: string) => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setCollapsed(p => ({ ...p, [k]: !p[k] }));
    };

    const loadData = async () => {
        if (tourActiveRef.current) return;
        try {
            const [result, decksResult] = await Promise.all([
                getDashboardOverview(),
                getFlashcardDecks().catch(() => ({ decks: [] })),
            ]);
            if (tourActiveRef.current) return;
            setData(result);
            setFlashcardDecks(decksResult.decks);
        } catch (e) { console.error(e); }
        finally { setLoading(false); }
    };

    const handleWatchAll = async () => {
        setWatching(true);
        try {
            const result = await watchAllVods();
            if (result.status === 'already_running') {
                showSuccess('이미 진행 중', '백그라운드에서 이미 시청이 진행되고 있어요.');
            } else {
                showSuccess('시청 시작', '백그라운드에서 강의를 시청하고 있어요. 앱을 닫아도 계속 진행됩니다.');
            }
        } catch (e) {
            showError('오류', '시청을 시작할 수 없어요. 다시 시도해주세요.');
        } finally {
            setWatching(false);
        }
    };

    const unwatchedCount = (data?.available_vods ?? []).filter((v: any) => !v.is_completed).length;

    if (loading) {
        return <View style={styles.centered}><ActivityIndicator size="large" color={colors.primary} /></View>;
    }

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <View style={styles.header}>
                <Text style={styles.headerTitle} numberOfLines={1}>동영상 강의</Text>
                {unwatchedCount > 0 && (
                    <View ref={watchAllRef} collapsable={false}>
                    <TouchableOpacity
                        style={[styles.watchAllBtn, watching && { opacity: 0.6 }]}
                        onPress={handleWatchAll}
                        disabled={watching}
                    >
                        {watching
                            ? <ActivityIndicator size="small" color="#fff" />
                            : <Ionicons name="play-circle" size={16} color="#fff" />
                        }
                        <Text style={styles.watchAllText}>
                            {watching ? '시작 중...' : `모두 시청 (${unwatchedCount})`}
                        </Text>
                    </TouchableOpacity>
                    </View>
                )}
            </View>

            <ScrollView
                contentContainerStyle={styles.scrollContent}
                refreshControl={<RefreshControl refreshing={loading} onRefresh={loadData} />}
                showsVerticalScrollIndicator={false}
            >
              {/* Flashcard Decks */}
              {flashcardDecks.length > 0 && (
                  <View style={styles.section}>
                      <SectionHeader
                          title="내 플래시카드"
                          icon="albums-outline"
                          action={
                              <TouchableOpacity onPress={() => navigation.navigate('FlashcardDeckList')} activeOpacity={0.7}>
                                  <Text style={{ ...typography.buttonSmall, color: colors.primary }}>전체보기</Text>
                              </TouchableOpacity>
                          }
                      />
                      {flashcardDecks.slice(0, 3).map(deck => (
                          <TouchableOpacity
                              key={deck.id}
                              style={styles.flashcardDeckRow}
                              activeOpacity={0.7}
                              onPress={async () => {
                                  try {
                                      const d = await getFlashcardDeck(deck.id);
                                      navigation.navigate('FlashcardStudy', {
                                          cards: d.cards, deckName: d.name, deckId: d.id,
                                          courseName: d.course_name, isPreview: false,
                                      });
                                  } catch { showError('오류', '덱을 불러올 수 없어요.'); }
                              }}
                          >
                              <View style={styles.flashcardDeckIcon}>
                                  <Ionicons name="albums" size={18} color={colors.primary} />
                              </View>
                              <View style={{ flex: 1 }}>
                                  <Text style={styles.flashcardDeckName} numberOfLines={1}>{deck.name}</Text>
                                  <Text style={styles.flashcardDeckMeta} numberOfLines={1}>
                                      {deck.course_name ? `${deck.course_name} · ` : ''}{deck.card_count}장
                                  </Text>
                              </View>
                              <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
                          </TouchableOpacity>
                      ))}
                  </View>
              )}

              <View ref={availableSectionRef} collapsable={false}>
                {/* Missed */}
                {data?.missed_vods?.length > 0 && (
                    <View style={styles.section}>
                        <SectionHeader
                            title="놓친 강의" count={data.missed_vods.length}
                            icon="alert-circle" iconColor={colors.error}
                            isCollapsible isCollapsed={collapsed.missed}
                            onToggle={() => toggleSection('missed')}
                        />
                        {!collapsed.missed && [...data.missed_vods].sort((a: any, b: any) => (a.end_date ? new Date(a.end_date).getTime() : Infinity) - (b.end_date ? new Date(b.end_date).getTime() : Infinity)).map((item: any) => (
                            <ItemRow
                                key={item.id}
                                title={item.title}
                                courseName={item.course_name}
                                state="missed"
                                type="vod"
                                onMenuPress={() => openActionSheet(item)}
                            />
                        ))}
                    </View>
                )}

                {/* Available */}
                {data?.available_vods?.length > 0 && (
                    <View style={styles.section}>
                        <SectionHeader
                            title="시청 가능 강의" icon="play-circle-outline"
                        />
                        {[...data.available_vods].sort((a: any, b: any) => (a.end_date ? new Date(a.end_date).getTime() : Infinity) - (b.end_date ? new Date(b.end_date).getTime() : Infinity)).map((item: any, index: number) => (
                            index === 0 ? (
                                <View key={item.id} ref={firstItemMenuRef} collapsable={false}>
                                    <ItemRow
                                        title={item.title}
                                        courseName={item.course_name}
                                        meta={item.end_date ? `~ ${new Date(item.end_date).toLocaleDateString()} 마감` : undefined}
                                        state={item.is_completed ? 'completed' : 'pending'}
                                        type="vod"
                                        onMenuPress={() => openActionSheet(item)}
                                        highlightMenu={tourActive && currentStep?.id === 'vod-tap-item'}
                                    />
                                </View>
                            ) : (
                                <ItemRow
                                    key={item.id}
                                    title={item.title}
                                    courseName={item.course_name}
                                    meta={item.end_date ? `~ ${new Date(item.end_date).toLocaleDateString()} 마감` : undefined}
                                    state={item.is_completed ? 'completed' : 'pending'}
                                    type="vod"
                                    onMenuPress={() => openActionSheet(item)}
                                />
                            )
                        ))}
                    </View>
                )}

                {/* Upcoming */}
                {data?.upcoming_vods?.length > 0 && (
                    <View style={styles.section}>
                        <SectionHeader title="예정 오픈 강의" icon="time-outline" />
                        {[...data.upcoming_vods].sort((a: any, b: any) => (a.start_date ? new Date(a.start_date).getTime() : Infinity) - (b.start_date ? new Date(b.start_date).getTime() : Infinity)).map((item: any) => (
                            <ItemRow
                                key={item.id}
                                title={item.title}
                                courseName={item.course_name}
                                meta={item.start_date ? `${new Date(item.start_date).toLocaleDateString()} 오픈` : undefined}
                                state="upcoming"
                                type="vod"
                            />
                        ))}
                    </View>
                )}

                {/* Unchecked */}
                {data?.unchecked_vods?.length > 0 && (
                    <View style={styles.section}>
                        <SectionHeader title="출석 미반영 강의" icon="help-circle-outline" />
                        {[...data.unchecked_vods].sort((a: any, b: any) => (a.end_date ? new Date(a.end_date).getTime() : Infinity) - (b.end_date ? new Date(b.end_date).getTime() : Infinity)).map((item: any) => (
                            <ItemRow
                                key={item.id}
                                title={item.title}
                                courseName={item.course_name}
                                meta={item.end_date ? `~ ${new Date(item.end_date).toLocaleDateString()} 마감` : undefined}
                                state="unchecked"
                                type="vod"
                                onMenuPress={() => openActionSheet(item)}
                            />
                        ))}
                    </View>
                )}
              </View>
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
                    tourRef={actionSheetRef}
                    tourActive={tourActive}
                />
            )}
        </SafeAreaView>
    );
};

const createStyles = (colors: ColorScheme, typography: TypographyType, layout: LayoutType, isDark: boolean) => StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    header: { paddingHorizontal: Spacing.l, paddingVertical: Spacing.m, marginBottom: Spacing.s, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    headerTitle: { ...typography.header1, fontSize: 28, flexShrink: 1 },
    watchAllBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.primary, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20 },
    watchAllText: { color: '#fff', fontSize: 13, fontWeight: '600' },
    scrollContent: { padding: Spacing.l, paddingBottom: Spacing.xxl },
    section: { marginBottom: Spacing.xl },
    sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.m },
    sectionHeaderLeft: { flexDirection: 'row', alignItems: 'center' },
    sectionTitle: { ...typography.header3 },
    countBadge: { backgroundColor: colors.error, borderRadius: 12, paddingHorizontal: 8, paddingVertical: 2, marginLeft: 8 },
    countText: { color: '#fff', fontSize: 12, fontWeight: 'bold' },
    actionLink: { ...typography.body2, color: colors.primary, fontWeight: '600' },

    // Flashcard deck rows
    flashcardDeckRow: {
        flexDirection: 'row', alignItems: 'center',
        backgroundColor: colors.surface, borderRadius: layout.borderRadius.m,
        padding: Spacing.m, marginBottom: Spacing.s,
        borderWidth: 1, borderColor: colors.borderLight,
    },
    flashcardDeckIcon: {
        width: 36, height: 36, borderRadius: layout.borderRadius.s,
        backgroundColor: colors.primaryLighter,
        alignItems: 'center', justifyContent: 'center', marginRight: Spacing.m,
    },
    flashcardDeckName: { ...typography.subtitle2, color: colors.textPrimary },
    flashcardDeckMeta: { ...typography.caption, color: colors.textTertiary, marginTop: 2 },
});

export default VideoLecturesScreen;
