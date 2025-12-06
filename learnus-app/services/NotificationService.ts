import * as Notifications from 'expo-notifications';
import * as BackgroundFetch from 'expo-background-fetch';
import * as TaskManager from 'expo-task-manager';
import * as Device from 'expo-device';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { getDashboardOverview, fetchAISummary } from './api';
import { NotificationSettings } from '../NotificationSettingsScreen';

const BACKGROUND_FETCH_TASK = 'BACKGROUND_NOTIFICATION_TASK';
const NOTIFICATION_SETTINGS_KEY = 'notification_settings';

// Configure notification handler
Notifications.setNotificationHandler({
    handleNotification: async () => ({
        shouldShowAlert: true,
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

async function checkAndScheduleNotifications() {
    try {
        const settings = await getSettings();
        if (!settings) return BackgroundFetch.BackgroundFetchResult.NoData;

        // TODO: Add notification scheduling logic here using getDashboardOverview and fetchAISummary

        return BackgroundFetch.BackgroundFetchResult.NewData;
    } catch (e) {
        console.error("Background fetch failed", e);
        return BackgroundFetch.BackgroundFetchResult.Failed;
    }
}

async function scheduleNotification(title: string, body: string) {
    await Notifications.scheduleNotificationAsync({
        content: {
            title,
            body,
            sound: true,
        },
        trigger: null, // Immediate
    });
}

TaskManager.defineTask(BACKGROUND_FETCH_TASK, checkAndScheduleNotifications);

export async function registerBackgroundFetchAsync() {
    return BackgroundFetch.registerTaskAsync(BACKGROUND_FETCH_TASK, {
        minimumInterval: 15 * 60, // 15 minutes
        stopOnTerminate: false, // android only,
        startOnBoot: true, // android only
    });
}

export async function unregisterBackgroundFetchAsync() {
    return BackgroundFetch.unregisterTaskAsync(BACKGROUND_FETCH_TASK);
}
