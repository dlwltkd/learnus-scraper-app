# Runbook: Droplet Rebuild & the Dead IP Incident

Written 2026-08-15 after rebuilding the production droplet from scratch and fixing a
login failure that had nothing to do with the rebuild.

---

## 1. Rebuilding the droplet from nothing

The GitHub Action (`.github/workflows/deploy.yml`) only runs `git pull` + `docker compose up`
inside `$DEPLOY_PATH`. It assumes an already-bootstrapped droplet. A fresh droplet needs the
manual setup below **once**; after that, pushes auto-deploy again.

### Not in git — recreate by hand

| Path | Why it's missing |
|---|---|
| `.env` | `.gitignore:30` — holds `POSTGRES_PASSWORD`, `OPENAI_API_KEY` |
| `error_log/` | `.gitignore:60` — bind-mounted at `docker-compose.yml:51` |
| `api_debug.log` | `.gitignore:61` — bind-mounted at `docker-compose.yml:35` |

If `error_log/` and `api_debug.log` don't exist before the first `up`, **Docker creates them
as directories** and the app then fails to write logs. Create them with the right type first.

### Steps

```bash
# 1. DNS first — Caddy can't get a cert until api.dlwltkd.com resolves to the new IP.
#    The record lives in Cloudflare. Grey-cloud (DNS only) is simplest; an orange-cloud
#    proxy intercepts the ACME challenge and does not forward port 8000 at all.

# 2. Firewall: allow 22, 80, 443, 8000.
#    NOTE: ufw does NOT filter Docker's published ports — Docker writes iptables rules
#    ahead of ufw's chain. The DigitalOcean cloud firewall is the real enforcement point.

# 3. Docker + compose v2 (Ubuntu's docker.io ships no compose plugin)
apt-get update && apt-get install -y docker-compose-v2
docker compose version          # must work; the workflow uses `docker compose`, not `docker-compose`
systemctl enable --now docker   # restart:always only helps if the daemon starts at boot

# 4. Clone (private repo — needs the deploy key, see §2)
git clone git@github.com:dlwltkd/learnus-app-server.git ~/learnus
cd ~/learnus
mkdir -p error_log
touch api_debug.log             # must be a FILE

# 5. Write .env
cat > .env <<'EOF'
POSTGRES_PASSWORD=<new strong password>
OPENAI_API_KEY=<key>
EOF

# 6. Boot
docker compose up -d --build
docker logs -f learnus_api
```

Expect four containers: `learnus_caddy`, `learnus_api`, `learnus_worker`, `learnus_db`.

Tables are created automatically — `init_db()` runs at import time (`api.py:48`) and
`Base.metadata.create_all` (`database.py:272`) builds the schema. No manual migration.

### Data loss is total without a snapshot

`postgres_data` was a local volume on the destroyed droplet. Auth is **not** JWT — it's a
UUID stored as a row (`api.py:119` looks up `User.api_token`). An empty `users` table means
**every user's stored token 401s and everyone must log in again**. Push tokens are gone too,
so `scripts/broadcast_push.py` has no recipients until users reopen the app.

---

## 2. The two SSH keys

Easy to conflate. They point in opposite directions.

| Keypair | Public half goes to | Private half goes to |
|---|---|---|
| deploy key | GitHub repo → Settings → Deploy keys (read-only) | stays on the droplet |
| actions key | droplet `~/.ssh/authorized_keys` | GitHub secret `DROPLET_SSH_KEY` |

Deploy key = public on GitHub. Actions secret = **private** key, full `-----BEGIN-----`
block including trailing newline, or `appleboy/ssh-action` fails with a vague parse error.

Both must belong to the user the Action logs in as (`DROPLET_USER`), and the repo at
`DEPLOY_PATH` must be owned by that user or `git pull` fails on dubious ownership.
Run `ssh-keyscan github.com >> ~/.ssh/known_hosts` or the non-interactive pull hangs on
host-key verification.

Secrets to verify: `DROPLET_HOST`, `DROPLET_USER`, `DEPLOY_PATH`, `DROPLET_SSH_KEY`.

---

## 3. The dead IP incident

**Symptom:** LearnUs login succeeded in the WebView, then the app sat on "로그인 중…"
forever. Looked like the rebuilt server was rejecting logins.

**Actual cause:** a project-scoped EAS environment variable named `EXPO_PUBLIC_API_URL`,
stored with *secret* visibility, was overriding the `env` block in `eas.json` and baking the
**old, destroyed droplet IP** into every build. The value existed nowhere in the repo.

### Why it was hard to see

- The IP is not in the source — `grep` finds nothing.
- Secret EAS variables **cannot be read back**: `env:get` refuses, and `env:exec` only loads
  plaintext/sensitive visibility.
- The build log actively misleads: it says *"values from the build profile configuration will
  be used"* while the secret is what actually lands in the bundle.
- Failure mode is silent. The app hung ~133 s in TCP `SYN_SENT` and surfaced
  `AxiosError: Network Error` — identical to any other network failure.
- `LoginScreen.tsx:318` catches the error into `addDebugLog`, which only pushes to an
  in-memory array. The "디버그 정보 전송" button just does `console.log` (line 330), so the
  debug report built for exactly this situation never leaves the device.

### The evidence that settled it

| Check | Result |
|---|---|
| Device DNS for `api.dlwltkd.com` | resolved correctly to the new droplet |
| Chrome on the same emulator → `/version` | `200 OK`, visible in the server log |
| `curl` → `/auth/sync-session` | proper `401` |
| App's axios request | `SYN_SENT` to **`167.172.208.209:8000`** for 110 s+ |
| Trap on `localhost:8000` (`adb reverse` + local listener) | never hit |
| Droplet uvicorn | never hit |

Read the destination straight off the device socket table during the hang:

```bash
adb shell "cat /proc/net/tcp /proc/net/tcp6" | awk '$4=="02" {print $3}'
# 0000000000000000FFFF0000D1D0ACA7:1F40
#                          ^^^^^^^^ ^^^^
# little-endian: A7=167 AC=172 D0=208 D1=209  →  167.172.208.209:8000
```

Two traps to avoid when repeating this:

- **Don't grep the APK.** Expo release builds use Hermes bytecode; neither `grep -a` nor
  `strings` finds URLs that are definitely present. Always test such a method against a
  string you *know* exists before trusting a negative.
- **Don't use `ping`.** The emulator NAT blocks ICMP, so a reachable host also shows
  100% loss.

### The fix

```bash
# Delete the secret in preview AND production. Duplicate names force an interactive
# picker that needs a real TTY — use the Expo web UI or a normal terminal.
eas env:delete --scope project --variable-name EXPO_PUBLIC_API_URL

# Then one clean value
eas env:update --variable-name EXPO_PUBLIC_API_URL \
  --value https://api.dlwltkd.com --visibility plaintext
```

Verify before rebuilding:

```bash
eas env:list preview && eas env:list production && eas env:list development
```

Each should show exactly one `EXPO_PUBLIC_API_URL=https://api.dlwltkd.com`.
`GOOGLE_SERVICES_JSON` stays secret — that one is legitimate.

### Confirmed fixed

```
POST /auth/sync-session HTTP/1.1" 200 OK
INFO:api:New user: fetched 7 active course IDs from ubion page.
INFO:api:Auto-sync complete. Found 46 courses, 46 new.
GET /dashboard/overview HTTP/1.1" 200 OK
```

133-second timeout → 9-second login.

**This ships or it doesn't count.** The URL is compiled in at build time. Every installed
copy still holds the dead IP and cannot be reached by any server-side change. Bump
`versionCode` in `app.json`, build production, submit to the Play Store.

---

## 4. Verifying a client change end to end

Watch both sides and correlate by timestamp.

```bash
# Server (Caddy has no access log — uvicorn is the ground truth for arrival)
ssh root@<droplet> "cd /root/learnus && docker compose logs -f --tail=0 api caddy"

# App
adb logcat ReactNativeJS:V "*:S"
```

Prove the monitor works before trusting its silence — fire a known request
(`curl https://api.dlwltkd.com/version`) and confirm it appears. Only then does an absent
log line mean anything.

---

## 5. Gotchas that cost real time

- **Disk full presents as everything else.** A full `C:` produced an EAS tarball upload
  failure *and* Gradle's `Incompatible magic value 0` (a zero-byte class file from a failed
  write). Check free space before debugging build errors.
- **`expo run:android` hangs silently** when run non-interactively — it blocks on a prompt
  with no stdin and produces no output. Drive `./gradlew.bat assembleDebug` directly.
- **Gradle needs `android/local.properties`** with `sdk.dir` if `ANDROID_HOME` isn't set.
- **Emulator:** use `Medium_Phone_API_36.1` with `-no-snapshot-load`. `Pixel_9` boots to
  `device offline`, or reports `sys.boot_completed=1` while the package manager is still
  down, so `adb install` fails with "device is still booting".
- **Expo Go will not run this app** — `@react-native-cookies/cookies`, a patched React
  Native core, and `expo-dev-client` all require a custom build.
- **Postgres must stay on loopback.** `docker-compose.yml:58` binds `127.0.0.1:5432:5432`.
  Changing it to `5432:5432` exposes the database to the internet regardless of firewall.

---

## 6. Known-weak spots worth fixing

- `api.ts:13` sets no axios `timeout`, so an unreachable host hangs ~133 s instead of
  failing fast. 15 s would make this class of bug obvious immediately.
- `LoginScreen.tsx:318` records the error but nothing surfaces it to the user, and the
  debug-report button never transmits. Surfacing `api_error` in the UI would have turned a
  multi-hour investigation into a glance.
