import * as SecureStore from 'expo-secure-store';

export const secureStorage = {
    async getItem(key: string): Promise<string | null> {
        try {
            return await SecureStore.getItemAsync(key);
        } catch {
            return null;
        }
    },
    async setItem(key: string, value: string): Promise<void> {
        await SecureStore.setItemAsync(key, value);
    },
    async removeItem(key: string): Promise<void> {
        await SecureStore.deleteItemAsync(key);
    },
};
