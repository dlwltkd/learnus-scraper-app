// Demo mode for Google Play review.
//
// Play reviewers cannot complete Yonsei SSO, so the app ships a hidden manual login that
// accepts a fixed demo account and then runs entirely on local mock data. Nothing here
// touches the API: no request is made, no real account exists, and the reviewer sees the
// same fabricated courses used by the in-app tour.
//
// The credentials below are compiled into the bundle and are therefore public. That is
// acceptable precisely because they unlock nothing — demo mode is read-only local data.
// Never wire these to a real account or to a server-side bypass.

export const DEMO_USERNAME = 'playreview';
export const DEMO_PASSWORD = 'LearnUs2026!';

// Stored in place of a real api_token so demo mode survives an app restart. AuthContext
// recognises this sentinel and skips every network call it would normally make.
export const DEMO_TOKEN = '__demo_mode__';

let demoModeActive = false;

export const isDemoMode = () => demoModeActive;

export const setDemoMode = (active: boolean) => {
    demoModeActive = active;
};

export const isDemoCredentials = (username: string, password: string) =>
    username.trim() === DEMO_USERNAME && password === DEMO_PASSWORD;
