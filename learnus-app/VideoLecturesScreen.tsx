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
    Animated,
    LayoutAnimation,
    Platform,
    UIManager
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { RectButton, Swipeable } from 'react-native-gesture-handler';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getDashboardOverview, watchVods } from './services/api';
import { Colors, Spacing, Layout, Typography } from './constants/theme';

if (Platform.OS === 'android') {
    if (UIManager.setLayoutAnimationEnabledExperimental) {
        UIManager.setLayoutAnimationEnabledExperimental(true);
    }
}

const SectionHeader = ({ title, count, icon, iconColor, isCollapsible, isCollapsed, onToggle, action }: any) => (
    <View style={styles.sectionHeader}>
        <TouchableOpacity
            style={styles.sectionHeaderLeft}
            onPress={isCollapsible ? onToggle : undefined}
            activeOpacity={isCollapsible ? 0.7 : 1}
        >
            <Ionicons name={icon} size={20} color={iconColor || Colors.primary} style={{ marginRight: 8 }} />
            <Text style={styles.sectionTitle}>{title}</Text>
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

const VideoLecturesScreen = () => {
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState<any>(null);
    const [watchingVods, setWatchingVods] = useState(false);

    // Collapsible State
    const [collapsedSections, setCollapsedSections] = useState<{ [key: string]: boolean }>({
        missedVods: false,
    });

    useEffect(() => {
        loadData();
    }, []);

    const toggleSection = (key: string) => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setCollapsedSections(prev => ({ ...prev, [key]: !prev[key] }));
    };

    const loadData = async () => {
        try {
            const result = await getDashboardOverview();
            setData(result);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const handleWatchAll = async () => {
        if (!data?.available_vods?.length) return;

        setWatchingVods(true);
        try {
            const vodIds = data.available_vods.map((v: any) => v.id);
            await watchVods(vodIds);
            Alert.alert("처리 시작", "강의 시청 처리가 백그라운드에서 시작되었습니다.");

            // Mark all as completed locally
            const updatedAvailable = data.available_vods.map((item: any) => ({ ...item, is_completed: true }));
            setData({ ...data, available_vods: updatedAvailable });

        } catch (e) {
            Alert.alert("오류", "강의 시청 처리에 실패했습니다.");
        } finally {
            setWatchingVods(false);
        }
    };

    const handleCompleteVod = async (id: number) => {
        try {
            const isAvailable = data.available_vods.some((item: any) => item.id === id);

            if (isAvailable) {
                // Toggle completion for available
                const updatedAvailable = data.available_vods.map((item: any) =>
                    item.id === id ? { ...item, is_completed: !item.is_completed } : item
                );
                setData({ ...data, available_vods: updatedAvailable });
            } else {
                // Remove from missed
                const updatedMissed = data.missed_vods.filter((item: any) => item.id !== id);
                setData({ ...data, missed_vods: updatedMissed });
            }

            await watchVods([id]);
        } catch (e) {
            console.error(e);
            Alert.alert("오류", "강의 완료 처리에 실패했습니다.");
            loadData();
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
            <View style={styles.header}>
                <Text style={styles.headerTitle}>동영상 강의</Text>
            </View>
            <ScrollView
                contentContainerStyle={styles.scrollContent}
                refreshControl={<RefreshControl refreshing={loading} onRefresh={loadData} />}
                showsVerticalScrollIndicator={false}
            >
                {/* 1. Missed VODs (놓친 강의) */}
                {data?.missed_vods?.length > 0 && (
                    <View style={styles.section}>
                        <SectionHeader
                            title="놓친 강의"
                            count={data.missed_vods.length}
                            icon="alert-circle"
                            iconColor={Colors.error}
                            isCollapsible
                            isCollapsed={collapsedSections.missedVods}
                            onToggle={() => toggleSection('missedVods')}
                        />
                        {!collapsedSections.missedVods && data.missed_vods.map((item: any) => (
                            <Swipeable
                                key={item.id}
                                renderRightActions={(progress, dragX) => renderRightActions(progress, dragX, () => handleCompleteVod(item.id))}
                            >
                                <View style={styles.itemCard}>
                                    <View style={styles.itemIcon}>
                                        <Ionicons name="play-circle" size={24} color={Colors.error} />
                                    </View>
                                    <View style={styles.itemContent}>
                                        <Text style={styles.itemCourse}>{item.course_name}</Text>
                                        <Text style={styles.itemTitle} numberOfLines={1}>{item.title}</Text>
                                    </View>
                                    <TouchableOpacity onPress={() => handleCompleteVod(item.id)} style={styles.checkButton}>
                                        <Ionicons name="checkmark-circle-outline" size={24} color={Colors.textTertiary} />
                                    </TouchableOpacity>
                                </View>
                            </Swipeable>
                        ))}
                    </View>
                )}

                {/* 2. Available VODs (시청 가능 강의) */}
                {data?.available_vods?.length > 0 && (
                    <View style={styles.section}>
                        <SectionHeader
                            title="시청 가능 강의"
                            icon="play-circle-outline"
                            action={
                                <TouchableOpacity onPress={handleWatchAll} disabled={watchingVods}>
                                    <Text style={styles.actionLink}>
                                        {watchingVods ? "처리 중..." : "모두 시청"}
                                    </Text>
                                </TouchableOpacity>
                            }
                        />
                        {data.available_vods.map((item: any) => (
                            <Swipeable
                                key={item.id}
                                renderRightActions={(progress, dragX) => renderRightActions(progress, dragX, () => handleCompleteVod(item.id))}
                            >
                                <View style={styles.itemCard}>
                                    <View style={styles.itemIcon}>
                                        <Ionicons
                                            name={item.is_completed ? "checkmark-circle" : "play-circle-outline"}
                                            size={24}
                                            color={item.is_completed ? Colors.textTertiary : Colors.primary}
                                        />
                                    </View>
                                    <View style={styles.itemContent}>
                                        <Text style={[styles.itemCourse, item.is_completed && { color: Colors.textTertiary }]}>{item.course_name}</Text>
                                        <Text style={[styles.itemTitle, item.is_completed && { color: Colors.textTertiary, textDecorationLine: 'line-through' }]} numberOfLines={1}>{item.title}</Text>
                                        <Text style={[styles.itemDate, { color: Colors.textSecondary }, item.is_completed && { color: Colors.textTertiary }]}>
                                            {item.start_date && item.end_date ?
                                                `${new Date(item.start_date).toLocaleDateString()} ~ ${new Date(item.end_date).toLocaleDateString()}` :
                                                (item.end_date ? `~ ${new Date(item.end_date).toLocaleDateString()}` : '기한 없음')
                                            }
                                        </Text>
                                    </View>
                                    <TouchableOpacity onPress={() => handleCompleteVod(item.id)} style={styles.checkButton}>
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

                {/* 3. Scheduled VODs (예정 오픈 강의) */}
                {data?.upcoming_vods?.length > 0 && (
                    <View style={styles.section}>
                        <SectionHeader title="예정 오픈 강의" icon="time-outline" />
                        {data.upcoming_vods.map((item: any) => (
                            <View key={item.id} style={[styles.itemCard, { opacity: 0.7 }]}>
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

                {/* 4. Unchecked VODs (미확인 강의) */}
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
                                        {item.start_date && item.end_date ?
                                            `${new Date(item.start_date).toLocaleDateString()} ~ ${new Date(item.end_date).toLocaleDateString()}` :
                                            '기간 정보 없음'}
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
    container: {
        flex: 1,
        backgroundColor: Colors.background,
    },
    centered: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    header: {
        paddingHorizontal: Spacing.l,
        paddingVertical: Spacing.m,
        marginBottom: Spacing.s,
    },
    headerTitle: {
        ...Typography.header1,
        fontSize: 28,
    },
    scrollContent: {
        padding: Spacing.l,
        paddingBottom: Spacing.xxl,
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
});

export default VideoLecturesScreen;
