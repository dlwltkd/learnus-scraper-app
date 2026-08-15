# LearnUs Connect mobile app

Expo 54 and React Native 0.81 application for Android, iOS, and web. The native app requires a custom development build; Expo Go is not supported.

## Source map

```text
App.tsx             navigation root and application providers
*Screen.tsx         screen-level UI and data orchestration
components/         reusable visual components
context/            authentication, user, theme, labs, tour, and toast state
hooks/              shared React hooks
constants/          theme, version, and tour data
services/api.ts     backend wire types, Axios client, and SSE calls
services/           notifications, secure storage, and demo-mode boundaries
assets/             application and store artwork
```

Trace a feature from its screen through context or shared components into `services/api.ts`, then follow the matching route in `../api.py`. Store secrets and tokens through `services/secureStorage.ts`; do not add direct HTTP clients inside screens.

## Development

```powershell
npm install
npx tsc --noEmit
npm run start
```

Use `npm run android`, `npm run ios`, or `npm run web` for a target. The API base URL is `EXPO_PUBLIC_API_URL`, with `http://localhost:8000` as the source fallback. Android emulators may need `http://10.0.2.2:8000` to reach a host API.

See [mobile build and device debugging](../docs/mobile-builds.md) for native builds, EAS environment behavior, and request tracing. Repository-wide setup and validation rules are in [CONTRIBUTING.md](../CONTRIBUTING.md).
