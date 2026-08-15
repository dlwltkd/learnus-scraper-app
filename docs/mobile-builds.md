# Mobile builds and device debugging

The app uses native cookie handling, `expo-dev-client`, and a patched React Native package. Build a custom client; Expo Go cannot run it.

## Local Android build

Install dependencies and type-check first:

```powershell
cd learnus-app
npm install
npx tsc --noEmit
```

`expo run:android` can wait on an invisible prompt in non-interactive environments. When that happens, generate the native project and run `android\gradlew.bat assembleDebug` directly. If `ANDROID_HOME` is unset, `android/local.properties` must contain `sdk.dir=<Android SDK path>`.

Use the `Medium_Phone_API_36.1` emulator with `-no-snapshot-load` when the default emulator becomes stuck offline. Wait for the package manager, not only `sys.boot_completed`, before installing an APK.

## EAS environment

`EXPO_PUBLIC_API_URL` is public build-time configuration. Keep exactly one value in each EAS environment and verify it before a release:

```bash
eas env:list development
eas env:list preview
eas env:list production
```

A project-scoped EAS variable can override the value in `eas.json`. Secret-visibility variables cannot be read back with normal environment commands, so do not store `EXPO_PUBLIC_API_URL` as a secret. `GOOGLE_SERVICES_JSON` should remain secret.

After changing the API URL, build and distribute a new binary. Server-side changes cannot update a URL already compiled into installed copies.

## End-to-end request tracing

Watch both sides and correlate timestamps:

```bash
# Server
ssh root@<droplet> "cd /root/learnus && docker compose logs -f --tail=0 api caddy"

# Android device
adb logcat ReactNativeJS:V "*:S"
```

Send a known request such as `curl https://api.dlwltkd.com/version` before relying on an empty server log.

If an Android request hangs, inspect the device socket table to confirm the destination. Expo release bundles use Hermes bytecode, so searching the APK for a URL is not a reliable negative test. Emulator ICMP can also be blocked; a failed `ping` does not prove the API is unreachable.

```bash
adb shell "cat /proc/net/tcp /proc/net/tcp6" | awk '$4=="02" {print $3}'
```

## Build failures

- Check disk space before investigating EAS upload or corrupted Gradle class errors. A failed write can leave a zero-byte class file.
- Use a clean emulator boot when ADB reports `device offline` or package installation says the device is still booting.
- Keep `google-services.json`, native generated directories, build output, and local SDK paths out of Git.
