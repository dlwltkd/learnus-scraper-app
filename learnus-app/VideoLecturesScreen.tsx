import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
    View, Text, StyleSheet, ScrollView, RefreshControl,
    TouchableOpacity, ActivityIndicator, Modal, StatusBar,
    LayoutAnimation, Platform, UIManager, Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { useNavigation } from '@react-navigation/native';
import { getDashboardOverview, watchAllVods, watchSingleVod } from './services/api';
import { Colors, Spacing, Layout, Typography } from './constants/theme';
import { useToast } from './context/ToastContext';
import ItemRow from './components/ItemRow';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
}


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

// ─── VOD Action Sheet ─────────────────────────────────────────────────────────

const VodActionSheet = ({ item, onWatch, onTranscribe, onAutoWatch, onClose }: {
    item: any;
    onWatch: () => void;
    onTranscribe: () => void;
    onAutoWatch: () => void;
    onClose: () => void;
}) => {
    const backdropOpacity = useRef(new Animated.Value(0)).current;
    const slideY = useRef(new Animated.Value(300)).current;

    useEffect(() => {
        Animated.parallel([
            Animated.timing(backdropOpacity, { toValue: 1, duration: 250, useNativeDriver: true }),
            Animated.spring(slideY, { toValue: 0, damping: 22, stiffness: 220, useNativeDriver: true }),
        ]).start();
    }, []);

    const dismiss = useCallback(() => {
        Animated.parallel([
            Animated.timing(backdropOpacity, { toValue: 0, duration: 200, useNativeDriver: true }),
            Animated.timing(slideY, { toValue: 300, duration: 200, useNativeDriver: true }),
        ]).start(() => onClose());
    }, [onClose]);

    return (
        <Modal animationType="none" transparent statusBarTranslucent onRequestClose={dismiss}>
            <Animated.View style={[sheetStyles.backdrop, { opacity: backdropOpacity }]}>
                <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={dismiss} />
            </Animated.View>
            <Animated.View style={[sheetStyles.sheet, { transform: [{ translateY: slideY }] }]}>
                <View style={sheetStyles.handle} />
                <Text style={sheetStyles.vodTitle} numberOfLines={2}>{item.title}</Text>
                <Text style={sheetStyles.vodCourse} numberOfLines={1}>{item.course_name}</Text>
                <View style={sheetStyles.divider} />
                <TouchableOpacity style={sheetStyles.action} onPress={onWatch} activeOpacity={0.7}>
                    <View style={[sheetStyles.actionIcon, { backgroundColor: Colors.primaryLighter }]}>
                        <Ionicons name="play-circle" size={22} color={Colors.primary} />
                    </View>
                    <View style={sheetStyles.actionText}>
                        <Text style={sheetStyles.actionLabel}>강의 시청</Text>
                        <Text style={sheetStyles.actionSub}>브라우저에서 열기</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={Colors.textTertiary} />
                </TouchableOpacity>
                <TouchableOpacity style={sheetStyles.action} onPress={onTranscribe} activeOpacity={0.7}>
                    <View style={[sheetStyles.actionIcon, { backgroundColor: Colors.tertiaryLight }]}>
                        <Ionicons name="text" size={22} color={Colors.tertiary} />
                    </View>
                    <View style={sheetStyles.actionText}>
                        <Text style={sheetStyles.actionLabel}>텍스트 추출</Text>
                        <Text style={sheetStyles.actionSub}>AI로 강의 내용 변환</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={Colors.textTertiary} />
                </TouchableOpacity>
                <TouchableOpacity style={[sheetStyles.action, item.is_completed && sheetStyles.actionDisabled]} onPress={onAutoWatch} activeOpacity={0.7}>
                    <View style={[sheetStyles.actionIcon, { backgroundColor: item.is_completed ? Colors.surfaceAlt : Colors.successLight }]}>
                        <Ionicons name="checkmark-circle-outline" size={22} color={item.is_completed ? Colors.textTertiary : Colors.success} />
                    </View>
                    <View style={sheetStyles.actionText}>
                        <Text style={[sheetStyles.actionLabel, item.is_completed && { color: Colors.textTertiary }]}>자동 시청</Text>
                        <Text style={sheetStyles.actionSub}>{item.is_completed ? '이미 시청 완료된 강의예요' : '백그라운드에서 자동으로 시청'}</Text>
                    </View>
                    {!item.is_completed && <Ionicons name="chevron-forward" size={18} color={Colors.textTertiary} />}
                </TouchableOpacity>
                <TouchableOpacity style={sheetStyles.cancelBtn} onPress={dismiss} activeOpacity={0.7}>
                    <Text style={sheetStyles.cancelText}>취소</Text>
                </TouchableOpacity>
            </Animated.View>
        </Modal>
    );
};

const sheetStyles = StyleSheet.create({
    backdrop: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: Colors.overlay,
    },
    sheet: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: Colors.surface,
        borderTopLeftRadius: Layout.borderRadius.xl,
        borderTopRightRadius: Layout.borderRadius.xl,
        paddingBottom: Spacing.xxl,
        paddingHorizontal: Spacing.l,
        paddingTop: Spacing.m,
        ...Layout.shadow.lg,
    },
    handle: {
        width: 40,
        height: 4,
        borderRadius: 2,
        backgroundColor: Colors.border,
        alignSelf: 'center',
        marginBottom: Spacing.m,
    },
    vodTitle: {
        ...Typography.subtitle1,
        marginBottom: 4,
    },
    vodCourse: {
        ...Typography.caption,
        marginBottom: Spacing.m,
    },
    divider: {
        height: 1,
        backgroundColor: Colors.divider,
        marginBottom: Spacing.m,
    },
    action: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: Spacing.m,
        gap: Spacing.m,
    },
    actionDisabled: { opacity: 0.6 },
    actionIcon: {
        width: 44,
        height: 44,
        borderRadius: Layout.borderRadius.m,
        alignItems: 'center',
        justifyContent: 'center',
    },
    actionText: {
        flex: 1,
    },
    actionLabel: {
        fontSize: 16,
        fontWeight: '600',
        color: Colors.textPrimary,
        marginBottom: 2,
    },
    actionSub: {
        ...Typography.caption,
    },
    cancelBtn: {
        marginTop: Spacing.s,
        paddingVertical: Spacing.m,
        alignItems: 'center',
        backgroundColor: Colors.surfaceAlt,
        borderRadius: Layout.borderRadius.l,
    },
    cancelText: {
        fontSize: 16,
        fontWeight: '600',
        color: Colors.textSecondary,
    },
});

// ─── VOD WebViewer Modal ───────────────────────────────────────────────────────

const VodWebViewer = ({ url, title, cookies, onClose }: { url: string; title: string; cookies: string; onClose: () => void }) => {
    const [loading, setLoading] = useState(true);

    // Set each cookie on the domain before the page content loads
    const cookieScript = cookies
        ? cookies.split(';').map(c => c.trim()).filter(Boolean)
            .map(c => `document.cookie = ${JSON.stringify(c + '; domain=ys.learnus.org; path=/')};`)
            .join('\n') + '\ntrue;'
        : 'true;';

    return (
        <Modal animationType="slide" statusBarTranslucent>
            <SafeAreaView style={{ flex: 1, backgroundColor: Colors.background }} edges={['top']}>
                {/* Header */}
                <View style={webStyles.header}>
                    <TouchableOpacity onPress={onClose} style={webStyles.closeBtn} activeOpacity={0.7}>
                        <Ionicons name="close" size={22} color={Colors.textPrimary} />
                    </TouchableOpacity>
                    <Text style={webStyles.headerTitle} numberOfLines={1}>{title}</Text>
                    <View style={{ width: 36 }} />
                </View>

                {/* WebView with session cookies injected */}
                <WebView
                    source={{ uri: url, headers: { Cookie: cookies } }}
                    style={{ flex: 1 }}
                    injectedJavaScriptBeforeContentLoaded={cookieScript}
                    onLoadStart={() => setLoading(true)}
                    onLoadEnd={() => setLoading(false)}
                    allowsInlineMediaPlayback
                    mediaPlaybackRequiresUserAction={false}
                    javaScriptEnabled
                    sharedCookiesEnabled
                    thirdPartyCookiesEnabled
                />
                {loading && (
                    <View style={webStyles.loadingOverlay}>
                        <ActivityIndicator size="large" color={Colors.primary} />
                    </View>
                )}
            </SafeAreaView>
        </Modal>
    );
};

// ─── Main Screen ──────────────────────────────────────────────────────────────

const VideoLecturesScreen = () => {
    const { showSuccess, showError } = useToast();
    const navigation = useNavigation<any>();
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState<any>(null);
    const [watching, setWatching] = useState(false);
    const [collapsed, setCollapsed] = useState<{ [k: string]: boolean }>({ missed: false });
    const [webViewer, setWebViewer] = useState<{ url: string; title: string; cookies: string } | null>(null);
    const [actionSheet, setActionSheet] = useState<any | null>(null);

    useEffect(() => { loadData(); }, []);

    const openWebViewer = async (item: any) => {
        const cookies = await AsyncStorage.getItem('userToken') || '';
        const viewerUrl = `https://ys.learnus.org/mod/vod/viewer.php?id=${item.id}`;
        setWebViewer({ url: viewerUrl, title: item.title, cookies });
    };

    const openActionSheet = (item: any) => setActionSheet(item);

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
        try { setData(await getDashboardOverview()); }
        catch (e) { console.error(e); }
        finally { setLoading(false); }
    };

    const handleWatchAll = async () => {
        setWatching(true);
        try {
            await watchAllVods();
            showSuccess('시청 시작', '백그라운드에서 강의를 시청하고 있어요. 앱을 닫아도 계속 진행됩니다.');
        } catch (e) {
            showError('오류', '시청을 시작할 수 없어요. 다시 시도해주세요.');
        } finally {
            setWatching(false);
        }
    };

    const unwatchedCount = (data?.available_vods ?? []).filter((v: any) => !v.is_completed).length;

    if (loading) {
        return <View style={styles.centered}><ActivityIndicator size="large" color={Colors.primary} /></View>;
    }

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <View style={styles.header}>
                <Text style={styles.headerTitle} numberOfLines={1}>동영상 강의</Text>
                {unwatchedCount > 0 && (
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
                )}
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
                        {data.available_vods.map((item: any) => (
                            <ItemRow
                                key={item.id}
                                title={item.title}
                                courseName={item.course_name}
                                meta={item.end_date ? `~ ${new Date(item.end_date).toLocaleDateString()} 마감` : undefined}
                                state={item.is_completed ? 'completed' : 'pending'}
                                type="vod"
                                onMenuPress={() => openActionSheet(item)}
                            />
                        ))}
                    </View>
                )}

                {/* Upcoming */}
                {data?.upcoming_vods?.length > 0 && (
                    <View style={styles.section}>
                        <SectionHeader title="예정 오픈 강의" icon="time-outline" />
                        {data.upcoming_vods.map((item: any) => (
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
                        {data.unchecked_vods.map((item: any) => (
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
            </ScrollView>

            {webViewer && (
                <VodWebViewer
                    url={webViewer.url}
                    title={webViewer.title}
                    cookies={webViewer.cookies}
                    onClose={() => setWebViewer(null)}
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
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.background },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    header: { paddingHorizontal: Spacing.l, paddingVertical: Spacing.m, marginBottom: Spacing.s, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    headerTitle: { ...Typography.header1, fontSize: 28, flexShrink: 1 },
    watchAllBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: Colors.primary, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20 },
    watchAllText: { color: '#fff', fontSize: 13, fontWeight: '600' },
    scrollContent: { padding: Spacing.l, paddingBottom: Spacing.xxl },
    section: { marginBottom: Spacing.xl },
    sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.m },
    sectionHeaderLeft: { flexDirection: 'row', alignItems: 'center' },
    sectionTitle: { ...Typography.header3 },
    countBadge: { backgroundColor: Colors.error, borderRadius: 12, paddingHorizontal: 8, paddingVertical: 2, marginLeft: 8 },
    countText: { color: '#fff', fontSize: 12, fontWeight: 'bold' },
    actionLink: { ...Typography.body2, color: Colors.primary, fontWeight: '600' },
});

const webStyles = StyleSheet.create({
    header: {
        flexDirection: 'row', alignItems: 'center',
        backgroundColor: Colors.surface,
        paddingHorizontal: Spacing.m, paddingVertical: 10,
        borderBottomWidth: 1, borderBottomColor: Colors.border,
    },
    closeBtn: {
        width: 36, height: 36, borderRadius: 18,
        alignItems: 'center', justifyContent: 'center',
    },
    headerTitle: {
        flex: 1, textAlign: 'center',
        ...Typography.body1, fontWeight: '600',
        marginHorizontal: Spacing.s,
    },
    loadingOverlay: {
        ...StyleSheet.absoluteFillObject,
        alignItems: 'center', justifyContent: 'center',
        backgroundColor: Colors.background,
    },
});

export default VideoLecturesScreen;
