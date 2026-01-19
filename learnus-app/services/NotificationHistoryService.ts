import AsyncStorage from '@react-native-async-storage/async-storage';

const NOTIFICATION_HISTORY_KEY = 'notification_history';
const MAX_NOTIFICATIONS = 50;

export interface NotificationHistoryItem {
    id: string;
    title: string;
    body: string;
    timestamp: number;
    read: boolean;
    type: 'assignment' | 'vod' | 'announcement' | 'ai_summary' | 'general';
    data?: {
        courseId?: number;
        courseName?: string;
        boardId?: number;
        postId?: number;
    };
}

export async function getNotificationHistory(): Promise<NotificationHistoryItem[]> {
    try {
        const stored = await AsyncStorage.getItem(NOTIFICATION_HISTORY_KEY);
        if (!stored) return [];
        return JSON.parse(stored);
    } catch (e) {
        console.error('Failed to get notification history:', e);
        return [];
    }
}

export async function addNotification(
    title: string,
    body: string,
    type: NotificationHistoryItem['type'] = 'general',
    data?: NotificationHistoryItem['data']
): Promise<void> {
    try {
        const history = await getNotificationHistory();

        const newNotification: NotificationHistoryItem = {
            id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            title,
            body,
            timestamp: Date.now(),
            read: false,
            type,
            data,
        };

        // Add to beginning, limit to max
        const updated = [newNotification, ...history].slice(0, MAX_NOTIFICATIONS);
        await AsyncStorage.setItem(NOTIFICATION_HISTORY_KEY, JSON.stringify(updated));
    } catch (e) {
        console.error('Failed to add notification:', e);
    }
}

export async function markAsRead(id: string): Promise<void> {
    try {
        const history = await getNotificationHistory();
        const updated = history.map(item =>
            item.id === id ? { ...item, read: true } : item
        );
        await AsyncStorage.setItem(NOTIFICATION_HISTORY_KEY, JSON.stringify(updated));
    } catch (e) {
        console.error('Failed to mark notification as read:', e);
    }
}

export async function markAllAsRead(): Promise<void> {
    try {
        const history = await getNotificationHistory();
        const updated = history.map(item => ({ ...item, read: true }));
        await AsyncStorage.setItem(NOTIFICATION_HISTORY_KEY, JSON.stringify(updated));
    } catch (e) {
        console.error('Failed to mark all notifications as read:', e);
    }
}

export async function getUnreadCount(): Promise<number> {
    try {
        const history = await getNotificationHistory();
        return history.filter(item => !item.read).length;
    } catch (e) {
        console.error('Failed to get unread count:', e);
        return 0;
    }
}

export async function clearNotificationHistory(): Promise<void> {
    try {
        await AsyncStorage.removeItem(NOTIFICATION_HISTORY_KEY);
    } catch (e) {
        console.error('Failed to clear notification history:', e);
    }
}

export async function deleteNotification(id: string): Promise<void> {
    try {
        const history = await getNotificationHistory();
        const updated = history.filter(item => item.id !== id);
        await AsyncStorage.setItem(NOTIFICATION_HISTORY_KEY, JSON.stringify(updated));
    } catch (e) {
        console.error('Failed to delete notification:', e);
    }
}
