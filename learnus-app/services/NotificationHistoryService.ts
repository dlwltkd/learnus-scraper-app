import {
    getNotificationHistoryFromServer,
    markNotificationReadOnServer,
    markAllNotificationsReadOnServer,
    deleteNotificationOnServer,
    clearNotificationsOnServer,
} from './api';

export interface NotificationHistoryItem {
    id: string;
    title: string;
    body: string;
    timestamp: number;
    read: boolean;
    type: 'assignment' | 'vod' | 'announcement' | 'ai_summary' | 'transcription_complete' | 'general';
    data?: {
        courseId?: number;
        courseName?: string;
        boardId?: number;
        postId?: number;
        postUrl?: string;
        postTitle?: string;
        vodMoodleId?: number;
        vodTitle?: string;
    };
}

export async function getNotificationHistory(): Promise<NotificationHistoryItem[]> {
    try {
        const items = await getNotificationHistoryFromServer();
        return items.map((item: any) => ({
            id: String(item.id),
            title: item.title,
            body: item.body || '',
            timestamp: item.timestamp,
            read: item.read,
            type: item.type || 'general',
            data: item.data,
        }));
    } catch (e) {
        console.error('Failed to get notification history:', e);
        return [];
    }
}

export async function addNotification(
    _title: string,
    _body: string,
    _type: NotificationHistoryItem['type'] = 'general',
    _data?: NotificationHistoryItem['data'],
    _notificationId?: string
): Promise<void> {
    // Notifications are now saved server-side when the backend sends them.
    // This function is kept for local notifications (scheduled reminders) — they
    // will still appear on the device that fired them but won't persist to server.
    // No-op: server handles persistence.
}

export async function markAsRead(id: string): Promise<void> {
    try {
        await markNotificationReadOnServer(Number(id));
    } catch (e) {
        console.error('Failed to mark notification as read:', e);
    }
}

export async function markAllAsRead(): Promise<void> {
    try {
        await markAllNotificationsReadOnServer();
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
        await clearNotificationsOnServer();
    } catch (e) {
        console.error('Failed to clear notification history:', e);
    }
}

export async function deleteNotification(id: string): Promise<void> {
    try {
        await deleteNotificationOnServer(Number(id));
    } catch (e) {
        console.error('Failed to delete notification:', e);
    }
}
