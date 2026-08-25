/** Browser authentication lives only in the backend's HttpOnly cookie. */
export const secureStorage = {
    async getItem(_key: string): Promise<string | null> {
        return null;
    },
    async setItem(_key: string, _value: string): Promise<void> {
        return;
    },
    async removeItem(_key: string): Promise<void> {
        return;
    },
};
