import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    TouchableOpacity,
    Animated,
    RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { Swipeable, RectButton } from 'react-native-gesture-handler';
import { Spacing } from './constants/theme';
import type { ColorScheme, TypographyType, LayoutType } from './constants/theme';
import { useTheme } from './context/ThemeContext';
import {
    NotificationHistoryItem,
    getNotificationHistory,
    markAsRead,
    markAllAsRead,
    deleteNotification,
} from './services/NotificationHistoryService';

function getTypeConfig(colors: ColorScheme) {
    return {
        assignment: {
            icon: 'document-text-outline' as const,
            color: colors.primary,
            label: '과제',
        },
        vod: {
            icon: 'play-circle-outline' as const,
            color: '#8B5CF6',
            label: '강의',
        },
        announcement: {
            icon: 'megaphone-outline' as const,
            color: '#6366F1',
            label: '공지',
        },
        ai_summary: {
            icon: 'sparkles' as const,
            color: colors.secondary,
            label: '공지 요약',
        },
        transcription_complete: {
            icon: 'document-text' as const,
            color: '#10B981',
            label: '텍스트 추출',
        },
        general: {
            icon: 'notifications-outline' as const,
            color: colors.textSecondary,
            label: '알림',
        },
    };
}

function formatTimeAgo(timestamp: number): string {
    const now = Date.now();
    const diff = now - timestamp;

    const minutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (minutes < 1) return '방금 전';
    if (minutes < 60) return `${minutes}분 전`;
    if (hours < 24) return `${hours}시간 전`;
    if (days < 7) return `${days}일 전`;

    const date = new Date(timestamp);
    return `${date.getMonth() + 1}/${date.getDate()}`;
}

interface NotificationItemProps {
    item: NotificationHistoryItem;
    onPress: () => void;
    onDelete: () => void;
    colors: ColorScheme;
    styles: any;
}

const NotificationItem = ({ item, onPress, onDelete, colors, styles }: NotificationItemProps) => {
    const swipeableRef = useRef<Swipeable>(null);
    const TYPE_CONFIG = getTypeConfig(colors);
    const config = TYPE_CONFIG[item.type] || TYPE_CONFIG.general;

    const renderRightActions = () => (
        <RectButton
            style={styles.deleteAction}
            onPress={() => {
                swipeableRef.current?.close();
                onDelete();
            }}
        >
            <Ionicons name="trash-outline" size={20} color="#FFF" />
        </RectButton>
    );

    return (
        <Swipeable
            ref={swipeableRef}
            overshootRight={false}
            renderRightActions={renderRightActions}
            friction={2}
        >
            <TouchableOpacity
                style={[styles.notificationItem, !item.read && styles.unreadItem]}
                onPress={onPress}
                activeOpacity={0.7}
            >
                {/* Unread indicator */}
                {!item.read && <View style={styles.unreadDot} />}

                {/* Icon */}
                <View style={[styles.iconContainer, { backgroundColor: `${config.color}15` }]}>
                    <Ionicons name={config.icon} size={20} color={config.color} />
                </View>

                {/* Content */}
                <View style={styles.contentContainer}>
                    <View style={styles.headerRow}>
                        <View style={[styles.typeBadge, { backgroundColor: `${config.color}15` }]}>
                            <Text style={[styles.typeText, { color: config.color }]}>
                                {config.label}
                            </Text>
                        </View>
                        <Text style={styles.timeText}>{formatTimeAgo(item.timestamp)}</Text>
                    </View>

                    <Text style={[styles.titleText, !item.read && styles.unreadText]} numberOfLines={1}>
                        {item.title}
                    </Text>

                    <Text style={styles.bodyText} numberOfLines={2}>
                        {item.body}
                    </Text>
                </View>

                {/* Arrow for clickable items */}
                {(item.type === 'announcement' || item.type === 'ai_summary' || item.type === 'transcription_complete') && (
                    <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />
                )}
            </TouchableOpacity>
        </Swipeable>
    );
};

export default function NotificationHistoryScreen() {
    const navigation = useNavigation();
    const { colors, typography, layout, isDark } = useTheme();
    const styles = useMemo(() => createStyles(colors, typography, layout, isDark), [colors, typography, layout, isDark]);

    const [notifications, setNotifications] = useState<NotificationHistoryItem[]>([]);
    const [refreshing, setRefreshing] = useState(false);

    const loadNotifications = async () => {
        const history = await getNotificationHistory();
        setNotifications(history);
    };

    useFocusEffect(
        useCallback(() => {
            loadNotifications();
        }, [])
    );

    const onRefresh = async () => {
        setRefreshing(true);
        await loadNotifications();
        setRefreshing(false);
    };

    const handleMarkAllRead = async () => {
        await markAllAsRead();
        await loadNotifications();
    };

    const handleNotificationPress = async (item: NotificationHistoryItem) => {
        // Mark as read
        await markAsRead(item.id);
        await loadNotifications();

        // Navigate based on type
        if (item.type === 'announcement' || item.type === 'ai_summary') {
            if (item.data?.postUrl) {
                (navigation as any).navigate('PostDetail', {
                    post: {
                        url: item.data.postUrl,
                        title: item.data.postTitle || '공지사항',
                    },
                });
            } else if (item.data?.courseId) {
                (navigation as any).navigate('CourseDetail', {
                    course: {
                        id: item.data.courseId,
                        name: item.data.courseName || 'Course',
                    },
                    initialTab: 'boards',
                });
            }
        } else if (item.type === 'transcription_complete') {
            if (item.data?.vodMoodleId) {
                (navigation as any).navigate('VodTranscript', {
                    vodMoodleId: item.data.vodMoodleId,
                    title: item.data.vodTitle || '강의 텍스트',
                    courseName: item.data.courseName || '',
                });
            }
        }
    };

    const handleDelete = async (id: string) => {
        await deleteNotification(id);
        await loadNotifications();
    };

    const unreadCount = notifications.filter(n => !n.read).length;

    const renderEmpty = () => (
        <View style={styles.emptyContainer}>
            <View style={styles.emptyIcon}>
                <Ionicons name="notifications-off-outline" size={48} color={colors.textTertiary} />
            </View>
            <Text style={styles.emptyTitle}>알림이 없습니다</Text>
            <Text style={styles.emptySubtitle}>새로운 알림이 도착하면 여기에 표시됩니다</Text>
        </View>
    );

    return (
        <SafeAreaView style={styles.container} edges={['bottom']}>
            {/* Header Action */}
            {notifications.length > 0 && unreadCount > 0 && (
                <View style={styles.actionBar}>
                    <TouchableOpacity
                        style={styles.markAllButton}
                        onPress={handleMarkAllRead}
                        activeOpacity={0.7}
                    >
                        <Ionicons name="checkmark-done-outline" size={18} color={colors.primary} />
                        <Text style={styles.markAllText}>모두 읽음 처리</Text>
                    </TouchableOpacity>
                </View>
            )}

            <FlatList
                data={notifications}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                    <NotificationItem
                        item={item}
                        onPress={() => handleNotificationPress(item)}
                        onDelete={() => handleDelete(item.id)}
                        colors={colors}
                        styles={styles}
                    />
                )}
                contentContainerStyle={[
                    styles.listContent,
                    notifications.length === 0 && styles.emptyList,
                ]}
                showsVerticalScrollIndicator={false}
                ListEmptyComponent={renderEmpty}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={onRefresh}
                        tintColor={colors.primary}
                        colors={[colors.primary]}
                    />
                }
                ItemSeparatorComponent={() => <View style={styles.separator} />}
            />
        </SafeAreaView>
    );
}

const createStyles = (colors: ColorScheme, typography: TypographyType, layout: LayoutType, isDark: boolean) => StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },
    actionBar: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        paddingHorizontal: Spacing.l,
        paddingVertical: Spacing.s,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
        backgroundColor: colors.surface,
    },
    markAllButton: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: Spacing.m,
        paddingVertical: Spacing.xs,
        backgroundColor: colors.primaryLighter,
        borderRadius: layout.borderRadius.m,
    },
    markAllText: {
        ...typography.caption,
        color: colors.primary,
        fontWeight: '600',
        marginLeft: 4,
    },
    listContent: {
        paddingVertical: Spacing.s,
    },
    emptyList: {
        flex: 1,
    },
    separator: {
        height: 1,
        backgroundColor: colors.border,
        marginLeft: 72,
    },
    notificationItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: Spacing.l,
        paddingVertical: Spacing.m,
        backgroundColor: colors.surface,
    },
    unreadItem: {
        backgroundColor: colors.primaryLighter + '30',
    },
    unreadDot: {
        position: 'absolute',
        left: 8,
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: colors.primary,
    },
    iconContainer: {
        width: 44,
        height: 44,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: Spacing.m,
    },
    contentContainer: {
        flex: 1,
        marginRight: Spacing.s,
    },
    headerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 4,
    },
    typeBadge: {
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 6,
    },
    typeText: {
        fontSize: 10,
        fontWeight: '700',
    },
    timeText: {
        ...typography.caption,
        color: colors.textTertiary,
    },
    titleText: {
        ...typography.subtitle1,
        fontSize: 15,
        marginBottom: 2,
    },
    unreadText: {
        fontWeight: '700',
    },
    bodyText: {
        ...typography.body2,
        color: colors.textSecondary,
        lineHeight: 18,
    },
    deleteAction: {
        backgroundColor: colors.error,
        justifyContent: 'center',
        alignItems: 'center',
        width: 70,
    },
    emptyContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: Spacing.xl,
    },
    emptyIcon: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: colors.surfaceMuted,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: Spacing.l,
    },
    emptyTitle: {
        ...typography.header3,
        color: colors.textSecondary,
        marginBottom: Spacing.xs,
    },
    emptySubtitle: {
        ...typography.body2,
        color: colors.textTertiary,
        textAlign: 'center',
    },
});
