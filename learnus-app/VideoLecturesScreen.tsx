import React, { useState, useEffect, useRef } from 'react';
import {
    View, Text, StyleSheet, ScrollView, RefreshControl,
    TouchableOpacity, ActivityIndicator, Dimensions,
    LayoutAnimation, Platform, UIManager,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { getDashboardOverview } from './services/api';
import { Colors, Spacing, Layout, Typography } from './constants/theme';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
}

const VOD_BASE = 'https://ys.learnus.org';
const SCREEN_WIDTH = Dimensions.get('window').width;

// JS injected into every VOD WebView:
// 1. Mutes video (parallel play, no noise)
// 2. Dismisses any popup button (not cancel)
// 3. Auto-plays as soon as player is ready
// 4. Posts 'ended' to RN when video ends (with currentTime fallback)
const AUTO_PLAY_JS = `
(function() {
    var _listening = false;

    function dismissPopup() {
        var btns = document.querySelectorAll('button, .btn, input[type="button"], input[type="submit"]');
        for (var i = 0; i < btns.length; i++) {
            var el = btns[i];
            if (el.offsetParent === null) continue;
            var t = (el.textContent || el.value || '').trim();
            if (t.length === 0 || t.length > 15) continue;
            if (/취소|cancel/i.test(t)) continue;
            el.click();
            return;
        }
    }

    function tryPlay() {
        var vid = document.querySelector('video');
        if (vid) {
            vid.muted = true;
            if (vid.paused) vid.play().catch(function(){});
            return;
        }
        var btn = document.querySelector('.vjs-big-play-button');
        if (btn && btn.offsetParent !== null) btn.click();
    }

    function attachEnded() {
        if (_listening) return;
        var vid = document.querySelector('video');
        if (!vid) return;
        _listening = true;
        vid.muted = true;
        vid.addEventListener('ended', function() {
            window.ReactNativeWebView.postMessage('ended');
        });
        setInterval(function() {
            if (vid.duration > 0 && vid.currentTime >= vid.duration - 1.5) {
                window.ReactNativeWebView.postMessage('ended');
            }
        }, 2000);
    }

    var ticker = setInterval(function() {
        dismissPopup();
        tryPlay();
        attachEnded();
    }, 400);

    setTimeout(function() { clearInterval(ticker); }, 30000);
})();
true;
`;

// ─── VodAutoWatcher ───────────────────────────────────────────────────────────
// Renders all VODs as off-screen WebViews (invisible to user).
// Positioned to the right of the screen so video elements initialize at full size.
// Auto-plays all simultaneously (muted). Calls onDone when all finish.

interface WatchVod { id: number; title: string; }

const VodAutoWatcher = ({ vods, onDone }: { vods: WatchVod[]; onDone: () => void }) => {
    const [cookie, setCookie] = useState('');
    const doneRef = useRef<Set<number>>(new Set());
    const notifiedRef = useRef(false);

    useEffect(() => {
        AsyncStorage.getItem('userToken').then(t => { if (t) setCookie(t); });
    }, []);

    const markDone = (id: number) => {
        doneRef.current.add(id);
        if (!notifiedRef.current && doneRef.current.size >= vods.length) {
            notifiedRef.current = true;
            setTimeout(onDone, 1000);
        }
    };

    if (!cookie) return null;

    return (
        // Positioned off-screen to the right — full size so video elements initialize properly
        <View
            style={{
                position: 'absolute',
                left: SCREEN_WIDTH + 100,
                top: 0,
                width: SCREEN_WIDTH,
            }}
            pointerEvents="none"
        >
            {vods.map(vod => (
                <WebView
                    key={vod.id}
                    style={{ width: SCREEN_WIDTH, height: 180 }}
                    source={{
                        uri: `${VOD_BASE}/mod/vod/viewer.php?id=${vod.id}`,
                        headers: { Cookie: cookie },
                    }}
                    sharedCookiesEnabled
                    thirdPartyCookiesEnabled
                    javaScriptEnabled
                    domStorageEnabled
                    mediaPlaybackRequiresUserAction={false}
                    allowsInlineMediaPlayback
                    userAgent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
                    injectedJavaScriptBeforeContentLoaded="window.confirm = function(){ return true; }; true;"
                    injectedJavaScript={AUTO_PLAY_JS}
                    onMessage={e => {
                        if (e.nativeEvent.data === 'ended') markDone(vod.id);
                    }}
                />
            ))}
        </View>
    );
};

// ─── SectionHeader ────────────────────────────────────────────────────────────

const SectionHeader = ({ title, count, icon, iconColor, isCollapsible, isCollapsed, onToggle, action }: any) => {
    const content = (
        <>
            <Ionicons name={icon} size={20} color={iconColor || Colors.primary} style={{ marginRight: 8 }} />
            <Text style={styles.sectionTitle}>{title}</Text>
            {isCollapsible && isCollapsed && count > 0 && (
                <View style={styles.countBadge}><Text style={styles.countText}>{count}</Text></View>
            )}
            {isCollapsible && (
                <Ionicons name={isCollapsed ? 'chevron-down' : 'chevron-up'} size={20} color={Colors.textTertiary} style={{ marginLeft: 8 }} />
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
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState<any>(null);
    const [watcherVods, setWatcherVods] = useState<WatchVod[] | null>(null);
    const [collapsed, setCollapsed] = useState<{ [k: string]: boolean }>({ missed: false });
    const autoWatchTriggered = useRef(false);

    useEffect(() => { loadData(); }, []);

    const toggleSection = (k: string) => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setCollapsed(p => ({ ...p, [k]: !p[k] }));
    };

    const loadData = async () => {
        try {
            const d = await getDashboardOverview();
            setData(d);
            // Auto-start background watcher once on initial load
            if (!autoWatchTriggered.current) {
                const unwatched = (d?.available_vods ?? []).filter((v: any) => !v.is_completed);
                if (unwatched.length > 0) {
                    autoWatchTriggered.current = true;
                    setWatcherVods(unwatched.map((v: any) => ({ id: v.id, title: v.title })));
                }
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const onWatcherDone = () => {
        setWatcherVods(null);
        loadData();
    };

    if (loading) {
        return <View style={styles.centered}><ActivityIndicator size="large" color={Colors.primary} /></View>;
    }

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            {/* Invisible background watcher — no UI, auto-triggered */}
            {watcherVods && <VodAutoWatcher vods={watcherVods} onDone={onWatcherDone} />}

            <View style={styles.header}>
                <Text style={styles.headerTitle}>동영상 강의</Text>
            </View>

            <ScrollView
                contentContainerStyle={styles.scrollContent}
                refreshControl={<RefreshControl refreshing={loading} onRefresh={loadData} />}
                showsVerticalScrollIndicator={false}
            >
                {/* Missed */}
                {data?.missed_vods?.length > 0 && (
                    <View style={styles.section}>
                        <SectionHeader
                            title="놓친 강의" count={data.missed_vods.length}
                            icon="alert-circle" iconColor={Colors.error}
                            isCollapsible isCollapsed={collapsed.missed}
                            onToggle={() => toggleSection('missed')}
                        />
                        {!collapsed.missed && data.missed_vods.map((item: any) => (
                            <View key={item.id} style={styles.itemCard}>
                                <View style={styles.itemIcon}>
                                    <Ionicons name="play-circle" size={24} color={Colors.error} />
                                </View>
                                <View style={styles.itemContent}>
                                    <Text style={styles.itemCourse}>{item.course_name}</Text>
                                    <Text style={styles.itemTitle} numberOfLines={1}>{item.title}</Text>
                                </View>
                            </View>
                        ))}
                    </View>
                )}

                {/* Available */}
                {data?.available_vods?.length > 0 && (
                    <View style={styles.section}>
                        <SectionHeader
                            title="시청 가능 강의" icon="play-circle-outline"
                        />
                        {data.available_vods.map((item: any) => (
                            <View key={item.id} style={styles.itemCard}>
                                <View style={styles.itemIcon}>
                                    <Ionicons
                                        name={item.is_completed ? 'checkmark-circle' : 'play-circle-outline'}
                                        size={24}
                                        color={item.is_completed ? Colors.textTertiary : Colors.primary}
                                    />
                                </View>
                                <View style={styles.itemContent}>
                                    <Text style={[styles.itemCourse, item.is_completed && { color: Colors.textTertiary }]}>
                                        {item.course_name}
                                    </Text>
                                    <Text style={[styles.itemTitle, item.is_completed && { color: Colors.textTertiary, textDecorationLine: 'line-through' }]} numberOfLines={1}>
                                        {item.title}
                                    </Text>
                                    <Text style={[styles.itemDate, item.is_completed && { color: Colors.textTertiary }]}>
                                        {item.start_date && item.end_date
                                            ? `${new Date(item.start_date).toLocaleDateString()} ~ ${new Date(item.end_date).toLocaleDateString()}`
                                            : item.end_date ? `~ ${new Date(item.end_date).toLocaleDateString()}` : '기한 없음'}
                                    </Text>
                                </View>
                                {item.is_completed
                                    ? <Ionicons name="checkmark" size={18} color={Colors.textTertiary} />
                                    : <ActivityIndicator size="small" color={Colors.primary} style={{ opacity: watcherVods ? 1 : 0 }} />
                                }
                            </View>
                        ))}
                    </View>
                )}

                {/* Upcoming */}
                {data?.upcoming_vods?.length > 0 && (
                    <View style={styles.section}>
                        <SectionHeader title="예정 오픈 강의" icon="time-outline" />
                        {data.upcoming_vods.map((item: any) => (
                            <View key={item.id} style={[styles.itemCard, { opacity: 0.6 }]}>
                                <View style={styles.itemIcon}>
                                    <Ionicons name="time-outline" size={24} color={Colors.textSecondary} />
                                </View>
                                <View style={styles.itemContent}>
                                    <Text style={styles.itemCourse}>{item.course_name}</Text>
                                    <Text style={styles.itemTitle} numberOfLines={1}>{item.title}</Text>
                                    <Text style={[styles.itemDate, { color: Colors.textSecondary }]}>
                                        {new Date(item.start_date).toLocaleDateString()} 오픈
                                    </Text>
                                </View>
                            </View>
                        ))}
                    </View>
                )}

                {/* Unchecked */}
                {data?.unchecked_vods?.length > 0 && (
                    <View style={styles.section}>
                        <SectionHeader title="미확인 강의" icon="help-circle-outline" />
                        {data.unchecked_vods.map((item: any) => (
                            <View key={item.id} style={styles.itemCard}>
                                <View style={styles.itemIcon}>
                                    <Ionicons name="document-text-outline" size={24} color={Colors.textSecondary} />
                                </View>
                                <View style={styles.itemContent}>
                                    <Text style={styles.itemCourse}>{item.course_name}</Text>
                                    <Text style={styles.itemTitle} numberOfLines={1}>{item.title}</Text>
                                    <Text style={[styles.itemDate, { color: Colors.textSecondary }]}>
                                        {item.start_date && item.end_date
                                            ? `${new Date(item.start_date).toLocaleDateString()} ~ ${new Date(item.end_date).toLocaleDateString()}`
                                            : '기간 정보 없음'}
                                    </Text>
                                </View>
                            </View>
                        ))}
                    </View>
                )}
            </ScrollView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.background },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    header: { paddingHorizontal: Spacing.l, paddingVertical: Spacing.m, marginBottom: Spacing.s },
    headerTitle: { ...Typography.header1, fontSize: 28 },
    scrollContent: { padding: Spacing.l, paddingBottom: Spacing.xxl },
    section: { marginBottom: Spacing.xl },
    sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.m },
    sectionHeaderLeft: { flexDirection: 'row', alignItems: 'center' },
    sectionTitle: { ...Typography.header3 },
    countBadge: { backgroundColor: Colors.error, borderRadius: 12, paddingHorizontal: 8, paddingVertical: 2, marginLeft: 8 },
    countText: { color: '#fff', fontSize: 12, fontWeight: 'bold' },
    actionLink: { ...Typography.body2, color: Colors.primary, fontWeight: '600' },
    itemCard: {
        flexDirection: 'row', alignItems: 'center',
        backgroundColor: Colors.surface, padding: Spacing.l,
        borderRadius: Layout.borderRadius.l, marginBottom: Spacing.s,
        borderWidth: 1, borderColor: Colors.border, ...Layout.shadow.sm,
    },
    itemIcon: { marginRight: Spacing.m },
    itemContent: { flex: 1 },
    itemCourse: { ...Typography.caption, marginBottom: 4 },
    itemTitle: { ...Typography.body1, fontWeight: '600' },
    itemDate: { ...Typography.caption, color: Colors.error, marginTop: 4 },
});

export default VideoLecturesScreen;
