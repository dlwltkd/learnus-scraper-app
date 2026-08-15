# Stale API URL in EAS builds

- Date: 2026-08-15
- Status: resolved; affected installed builds still require replacement

## Impact

LearnUs authentication completed in the WebView, but the app remained on `로그인 중…` for about 133 seconds and never reached the rebuilt API. A new build using the corrected endpoint completed login in about nine seconds.

## Cause

A project-scoped EAS variable named `EXPO_PUBLIC_API_URL` used secret visibility and overrode the matching `eas.json` value. It compiled the destroyed Droplet IP into the app even though that address did not appear in the repository.

The build log said profile configuration values would be used, while the project-scoped secret took precedence. EAS cannot display secret values through `env:get`, and `env:exec` loads only plaintext or sensitive variables.

## Evidence

| Check | Result |
|---|---|
| Device DNS for `api.dlwltkd.com` | resolved to the replacement server |
| Browser on the same emulator requesting `/version` | `200 OK`, present in server logs |
| Direct request to `/auth/sync-session` | expected `401` |
| App Axios request | TCP `SYN_SENT` to `167.172.208.209:8000` for more than 110 seconds |
| `adb reverse` trap on `localhost:8000` | no request |
| Droplet API logs | no app request |

The destination was decoded from the device socket table during the hang:

```bash
adb shell "cat /proc/net/tcp /proc/net/tcp6" | awk '$4=="02" {print $3}'
# 0000000000000000FFFF0000D1D0ACA7:1F40
# A7 AC D0 D1 in little-endian -> 167.172.208.209; 1F40 -> 8000
```

Searching the APK did not disprove the embedded URL because Expo release builds store JavaScript as Hermes bytecode. Emulator `ping` was also inconclusive because its NAT blocked ICMP to reachable hosts.

## Resolution

Remove every duplicate project-scoped variable in the Expo web UI or an interactive terminal, then create one plaintext value:

```bash
eas env:delete --scope project --variable-name EXPO_PUBLIC_API_URL
eas env:create --scope project --name EXPO_PUBLIC_API_URL \
  --value https://api.dlwltkd.com --visibility plaintext \
  --environment development --environment preview --environment production
```

Verify all environments:

```bash
eas env:list development
eas env:list preview
eas env:list production
```

Each environment should show one `EXPO_PUBLIC_API_URL=https://api.dlwltkd.com`. `GOOGLE_SERVICES_JSON` remains secret.

The fixed build produced successful `/auth/sync-session` and `/dashboard/overview` requests. Because the URL is compiled at build time, affected installations require a new production build and store release.

## Follow-up work

- `learnus-app/services/api.ts` has no Axios timeout. A 15-second timeout would surface unreachable hosts sooner.
- The `LoginScreen.tsx` debug-report button still logs only the event count locally and does not transmit the report.

The login screen now distinguishes a network failure from a rejected login and shows an error to the user. The remaining items above are recorded observations, not completed fixes.
