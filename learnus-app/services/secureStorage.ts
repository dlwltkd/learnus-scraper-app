import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';

const clearedLegacyKeys = new Set<string>();

const clearLegacyValue = async (key: string): Promise<void> => {
    if (clearedLegacyKeys.has(key)) return;
    await AsyncStorage.removeItem(key);
    clearedLegacyKeys.add(key);
};

export const secureStorage = {
    async getItem(key: string): Promise<string | null> {
        try {
            const value = await SecureStore.getItemAsync(key);
            await clearLegacyValue(key);
            return value;
        } catch {
            return null;
        }
    },
    async setItem(key: string, value: string): Promise<void> {
        await SecureStore.setItemAsync(key, value);
        await clearLegacyValue(key);
    },
    async removeItem(key: string): Promise<void> {
        await SecureStore.deleteItemAsync(key);
        await clearLegacyValue(key);
    },
};
