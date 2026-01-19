import * as Notifications from 'expo-notifications';
import * as BackgroundFetch from 'expo-background-fetch';
import * as TaskManager from 'expo-task-manager';
import * as Device from 'expo-device';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { getDashboardOverview, fetchAISummary, loadAuthToken } from './api';
import { NotificationSettings } from '../NotificationSettingsScreen';
import { addNotification, NotificationHistoryItem } from './NotificationHistoryService';

const BACKGROUND_FETCH_TASK = 'BACKGROUND_NOTIFICATION_TASK';
const NOTIFICATION_SETTINGS_KEY = 'notification_settings';

// Configure notification handler
Notifications.setNotificationHandler({
    handleNotification: async () => ({
        shouldPlaySound: true,
        shouldSetBadge: false,
        shouldShowBanner: true,
        shouldShowList: true,
        priority: Notifications.AndroidNotificationPriority.HIGH,
    }),
});

export async function registerForPushNotificationsAsync() {
    if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
            name: 'default',
            importance: Notifications.AndroidImportance.MAX,
            vibrationPattern: [0, 250, 250, 250],
            lightColor: '#FF231F7C',
        });
    }

    if (Device.isDevice) {
        const { status: existingStatus } = await Notifications.getPermissionsAsync();
        let finalStatus = existingStatus;
        if (existingStatus !== 'granted') {
            const { status } = await Notifications.requestPermissionsAsync();
            finalStatus = status;
        }
        if (finalStatus !== 'granted') {
            console.log('Failed to get push token for push notification!');
            return;
        }

        // Get the token
        const token = (await Notifications.getExpoPushTokenAsync()).data;
        console.log("Got push token:", token);
        return token;
    } else {
        console.log('Must use physical device for Push Notifications');
    }
}

async function getSettings(): Promise<NotificationSettings | null> {
    try {
        const saved = await AsyncStorage.getItem(NOTIFICATION_SETTINGS_KEY);
        return saved ? JSON.parse(saved) : null;
    } catch (e) {
        return null;
    }
}

function getTimeOffset(setting: string): number {
    switch (setting) {
        case '1h': return 60 * 60 * 1000;
        case '5h': return 5 * 60 * 60 * 1000;
        case '12h': return 12 * 60 * 60 * 1000;
        case '1d': return 24 * 60 * 60 * 1000;
        default: return 0;
    }
}

// Helper to schedule a notification for a specific date
async function scheduleReminder(
    title: string,
    body: string,
    triggerDate: Date,
    type: NotificationHistoryItem['type'] = 'general',
    data?: NotificationHistoryItem['data']
) {
    if (triggerDate <= new Date()) return false; // Don't schedule for past

    try {
        await Notifications.scheduleNotificationAsync({
            content: {
                title,
                body,
                sound: true,
                data: { type, saveToHistory: true, ...data },
            },
            trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: triggerDate },
        });
        // console.log(`Scheduled: ${title} at ${triggerDate.toLocaleString()}`);
        return true;
    } catch (e) {
        console.log("Failed to schedule notification", e);
        return false;
    }
}

// Listener to save received notifications to history
export function setupNotificationReceivedListener() {
    return Notifications.addNotificationReceivedListener(async (notification) => {
        const { title, body, data } = notification.request.content;
        if (data?.saveToHistory && title && body) {
            const type = (data.type as NotificationHistoryItem['type']) || 'general';
            await addNotification(title, body, type, {
                courseId: data.courseId as number | undefined,
                courseName: data.courseName as string | undefined,
            });
        }
    });
}

export async function checkAndScheduleNotifications() {
    try {
        // Ensure we have the auth token loaded for API requests
        await loadAuthToken();

        const settings = await getSettings();
        if (!settings) return { result: BackgroundFetch.BackgroundFetchResult.NoData, count: 0, details: [] };

        // Fetch latest data
        // Note: usage of getDashboardOverview might fail if auth token is not persistent/valid in background
        // However, assuming token is in memory or handled by api.ts interceptors/storage
        const data = await getDashboardOverview();
        if (!data) return { result: BackgroundFetch.BackgroundFetchResult.Failed, count: 0, details: [] };

        // Cancel existing to avoid duplicates (Reschedule strategy)
        await Notifications.cancelAllScheduledNotificationsAsync();

        const now = new Date();

        // 1. Assignments
        const assignments = data.upcoming_assignments || [];
        // Map settings to milliseconds
        const unfinishedOffsets = (settings.unfinishedAssignments || []).map(getTimeOffset);
        const finishedOffsets = (settings.finishedAssignments || []).map(getTimeOffset);

        const scheduledDetails: string[] = [];

        for (const a of assignments) {
            const dueDate = new Date(a.due_date);
            if (isNaN(dueDate.getTime())) continue;

            const offsets = a.is_completed ? finishedOffsets : unfinishedOffsets;

            for (const offset of offsets) {
                if (offset === 0) continue;
                const fireDate = new Date(dueDate.getTime() - offset);
                // Simple body text
                const status = a.is_completed ? "(제출됨)" : "(미제출)";

                if (await scheduleReminder(
                    `과제 마감 알림 ${status}`,
                    `'${a.title}' 과제가 곧 마감됩니다. (${a.course_name})`,
                    fireDate,
                    'assignment',
                    { courseId: a.course_id, courseName: a.course_name }
                )) {
                    scheduledDetails.push(`[과제] ${a.title} (${fireDate.toLocaleString()})`);
                }
            }
        }

        // 2. VODs (Video Lectures)
        const vods = data.upcoming_vods || []; // or available_vods? 'upcoming_vods' usually means future start.
        // We probably want to remind about 'end_date' (closing) for available/unfinished vods
        // Let's look at available_vods + upcoming_vods + unchecked_vods
        // For 'closing', we care about 'end_date'

        // combine relevant lists
        const allVods = [...(data.available_vods || []), ...(data.unchecked_vods || [])];
        const vodOffsets = (settings.unfinishedVods || []).map(getTimeOffset);

        for (const v of allVods) {
            if (v.is_completed) continue; // Only care about unfinished for now? Setting name is 'unfinishedVods'

            // For VODs, we typically remind before 'end_date'
            if (!v.end_date) continue;
            const endDate = new Date(v.end_date);
            if (isNaN(endDate.getTime())) continue;

            for (const offset of vodOffsets) {
                if (offset === 0) continue;
                const fireDate = new Date(endDate.getTime() - offset);
                if (await scheduleReminder(
                    `강의 출석 마감 임박`,
                    `'${v.title}' 강의 수강이 곧 마감됩니다. (${v.course_name})`,
                    fireDate,
                    'vod',
                    { courseId: v.course_id, courseName: v.course_name }
                )) {
                    scheduledDetails.push(`[강의] ${v.title} (${fireDate.toLocaleString()})`);
                }
            }
        }

        // 3. VOD Open Reminder
        if (settings.vodOpen) {
            const upcomingVods = data.upcoming_vods || [];
            for (const v of upcomingVods) {
                if (!v.start_date) continue;
                const startDate = new Date(v.start_date);
                if (isNaN(startDate.getTime())) continue;

                // Schedule for start time
                if (await scheduleReminder(
                    `강의 오픈 알림`,
                    `'${v.title}' 강의가 열렸습니다. (${v.course_name})\n~ ${v.end_date || '?'}까지 시청 가능`,
                    startDate,
                    'vod',
                    { courseId: v.course_id, courseName: v.course_name }
                )) {
                    scheduledDetails.push(`[오픈] ${v.title} (${startDate.toLocaleString()})`);
                }
            }
        }

        // 3. AI Summary (Optional - mostly for new notices)
        if (settings.aiSummary) {
            // AI Summary fetch might be expensive, maybe skip for background task 
            // or check if there are *new* items. 
            // For now, let's keep it simple and just do assignment/vod reminders.
        }

        return {
            result: BackgroundFetch.BackgroundFetchResult.NewData,
            count: scheduledDetails.length,
            details: scheduledDetails
        };
    } catch (e) {
        console.error("Background notify failed", e);
        return { result: BackgroundFetch.BackgroundFetchResult.Failed, count: 0, details: [] };
    }
}

// Helper for immediate test (can be called from UI)
export async function testScheduleNotification() {
    await scheduleReminder("테스트 알림", "5초 후 알림이 도착합니다.", new Date(Date.now() + 5000));
}

async function scheduleNotification(
    title: string,
    body: string,
    type: NotificationHistoryItem['type'] = 'general',
    data?: NotificationHistoryItem['data']
) {
    await Notifications.scheduleNotificationAsync({
        content: {
            title,
            body,
            sound: true,
            data: { type, ...data },
        },
        trigger: null, // Immediate
    });

    // Save to notification history
    await addNotification(title, body, type, data);
}

// Send and save notification for announcements/공지
export async function sendAnnouncementNotification(
    title: string,
    body: string,
    courseId: number,
    courseName: string
) {
    await scheduleNotification(title, body, 'announcement', { courseId, courseName });
}

// Send and save AI summary notification
export async function sendAISummaryNotification(
    title: string,
    body: string,
    courseId: number,
    courseName: string
) {
    await scheduleNotification(title, body, 'ai_summary', { courseId, courseName });
}

TaskManager.defineTask(BACKGROUND_FETCH_TASK, async () => {
    const res = await checkAndScheduleNotifications();
    return res.result;
});

export async function registerBackgroundFetchAsync() {
    // Register background fetch
    return BackgroundFetch.registerTaskAsync(BACKGROUND_FETCH_TASK, {
        minimumInterval: 60 * 60, // 1 hour (minimize battery usage, we schedule ahead anyway)
        stopOnTerminate: false,
        startOnBoot: true,
    });
}

export async function unregisterBackgroundFetchAsync() {
    return BackgroundFetch.unregisterTaskAsync(BACKGROUND_FETCH_TASK);
}
