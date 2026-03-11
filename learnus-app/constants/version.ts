// ============================================================
// APP VERSION — Reads from app.json (the single source of truth).
// To release a new version: update "version" in app.json only.
// The backend (api.py) also reads app.json automatically.
// ============================================================
import Constants from 'expo-constants';

export const APP_VERSION: string = Constants.expoConfig?.version ?? '0.0.0';
