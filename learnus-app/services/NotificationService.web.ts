const emptySubscription = () => ({ remove: () => {} });


export async function registerForPushNotificationsAsync(): Promise<undefined> {
    return undefined;
}


export function setupNotificationReceivedListener() {
    return emptySubscription();
}


export async function saveNotificationResponseToHistory(_notification: unknown): Promise<void> {
    return;
}


export async function checkAndScheduleNotifications() {
    return { count: 0, details: [] as string[] };
}


export async function registerBackgroundFetchAsync(): Promise<void> {
    return;
}


export async function unregisterBackgroundFetchAsync(): Promise<void> {
    return;
}


export async function testScheduleNotification(): Promise<void> {
    return;
}


export async function sendAnnouncementNotification(): Promise<void> {
    return;
}


export async function sendAISummaryNotification(): Promise<void> {
    return;
}
