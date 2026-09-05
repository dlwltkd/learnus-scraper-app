# LearnUs Connect app

Expo 54 and React Native 0.81 application for Android, iOS, and web. The native app requires a custom development build; Expo Go is not supported.

## Source map

```text
App.tsx             native navigation root and application providers
App.web.tsx         desktop web shell, navigation, search, and feature guide
*Screen.tsx         screen-level UI and data orchestration
*Screen.web.tsx     desktop layouts, including Brain chat, learning controls, and the course library
components/         reusable visual components
components/web/     shared web primitives, theme variables, and page styles
context/            authentication, user, theme, labs, tour, and toast state
hooks/              shared React hooks
constants/          theme, version, and tour data
services/api.ts     backend wire types, Axios client, and SSE calls
services/           notifications, secure storage, and demo-mode boundaries
tests/              browser-auth and web-navigation regression tests
assets/             application and store artwork
```

Trace a feature from its screen through context or shared components into `services/api.ts`, then follow the matching route in `../api.py`. Store secrets and tokens through `services/secureStorage.ts`; do not add direct HTTP clients inside screens.

## Development

```powershell
nvm use
npm install
npx tsc --noEmit
npm run start
```

Use `npm run android`, `npm run ios`, or `npm run web` for a target. Native uses `EXPO_PUBLIC_API_URL` and falls back to `http://localhost:8000`; Android emulators may need `http://10.0.2.2:8000`. Production web is fixed to same-origin `/api`. Only local web development may override it with `EXPO_PUBLIC_WEB_API_URL`.

Native authentication uses the LearnUs WebView and stores the returned API bearer in SecureStore. Web authentication is separate: `LoginScreen.web.tsx` presents the SSO connection instructions; `AuthContext` exchanges the browser helper's short-lived ticket through `services/api.ts`, then uses only the backend's HttpOnly cookie. Never add the native bearer to browser storage.

For desktop UI work, start `npm run web` and open `http://localhost:8081/preview`. Use its login-preview link, or open `/preview/login`, to inspect sign-in and return to the sample workspace. Both exact paths use the existing local demo data and adapter, so navigation, themes, and layouts work without a backend account or API requests. Their `__DEV__` guard disables preview access in production exports. Test actual SSO and session behavior with a running backend using the [web setup instructions](../docs/deployment.md#web-build-and-sso-helper); the normal `/` route requires that backend.

Metro selects `.web.tsx` files automatically. If a running development server keeps loading a native screen after adding a web variant, restart with `npx expo start --web --clear`. Web UI changes require `npx tsc --noEmit` plus browser checks at desktop and narrow widths, including dark mode; exporting the client is covered in the [deployment guide](../docs/deployment.md#web-build-and-sso-helper).

Browser Back/Forward follows screen visits within the open workspace, including sidebar changes and nested pages. Navigation snapshots stay in memory; the address remains `/` (or `/preview` in development), with no course objects, post content, or flashcards serialized into URLs or browser storage. Reloading starts at the dashboard. Keep normal sidebar navigation separate from explicit Back actions.

For browser-auth client changes, also run `node tests/browser-auth.test.cjs` from this directory. It checks response validation, session state, and demo behavior without network access.

For web-navigation changes, run `node tests/web-navigation.test.cjs` against the running web server. The test uses isolated Playwright Chromium and mocked API responses. Set `LEARNUS_QA_BASE` to override `http://localhost:8081`, `PLAYWRIGHT_MODULE` if Playwright is installed outside this app, and `CHROMIUM_PATH` to select the browser executable.

See [mobile build and device debugging](../docs/mobile-builds.md) for native builds, EAS environment behavior, and request tracing. Repository-wide setup and validation rules are in [CONTRIBUTING.md](../CONTRIBUTING.md).
