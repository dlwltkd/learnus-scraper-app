# Deployment

The backend deploys from `main` through GitHub Actions. The mobile app is built separately with EAS.

## Server topology

`docker-compose.yml` runs four containers:

| Container | Role | Persistent state |
|---|---|---|
| `learnus_caddy` | TLS termination, API proxy, and Expo Web static hosting | `caddy_data` volume; `web-dist/` release artifact |
| `learnus_api` | FastAPI service on port 8000 | PostgreSQL; bind-mounted `api_debug.log` |
| `learnus_worker` | queued and scheduled work | PostgreSQL; bind-mounted `error_log/` |
| `learnus_db` | PostgreSQL 15 | `postgres_data` volume |

PostgreSQL and the API's direct port are published only on loopback. Do not make either bind public. Caddy is the only public HTTP entry point on ports 80 and 443; it forwards the original client address to Uvicorn over the private Compose network.

## GitHub Actions deployment

`.github/workflows/deploy.yml` runs on every push to `main`:

1. Install Python 3.11 test dependencies and run `pytest tests/ -v --tb=short` with `TESTING=1`.
2. Install the repository Node version, type-check and export Expo Web, and test/package the browser helper.
3. Upload the static web artifact, SSH to the server, pull `main`, atomically install the web release, rebuild the API, and recreate Caddy.
4. Validate Caddy and the loopback API health endpoint.
5. Rebuild the worker when its Python sources, requirements, or Dockerfile changed.

The workflow requires these repository secrets:

| Secret | Value |
|---|---|
| `DROPLET_HOST` | server hostname or IP |
| `DROPLET_USER` | SSH user that owns the checkout |
| `DROPLET_SSH_KEY` | private key authorized on the server |
| `DEPLOY_PATH` | absolute path to the repository checkout |

The server checkout also needs a read-only GitHub deploy key so `git pull origin main` works non-interactively. These are two different keypairs: the Actions private key connects GitHub Actions to the server; the server deploy key connects the server to GitHub.

Check a release in the Actions run, then verify the containers on the server:

```bash
cd "$DEPLOY_PATH"
docker compose ps
docker compose logs --tail=100 api worker caddy
curl https://api.dlwltkd.com/version
curl https://luconnect.dlwltkd.com/api/version
```

For a replacement server or lost volume, use the [Droplet recovery runbook](runbooks/droplet-recovery.md).

## Server environment

Copy `.env.example` to `.env` on the server and replace placeholders. At minimum, Compose requires:

```dotenv
POSTGRES_PASSWORD=<strong database password>
OPENAI_API_KEY=<provider key>
```

`.env` is ignored by Git and must be restored separately after a server rebuild. The API and worker share `DATABASE_URL` and `OPENAI_API_KEY`; keep shared values aligned in `docker-compose.yml`.

Browser authentication also requires these API values:

```dotenv
WEB_ALLOWED_ORIGINS=https://luconnect.dlwltkd.com
WEB_LOGIN_TICKET_TTL_SECONDS=90
WEB_SESSION_TTL_DAYS=7
WEB_SESSION_COOKIE_NAME=__Host-luconnect_session
WEB_SESSION_COOKIE_SECURE=true
```

Before the first `docker compose up`, create the bind-mount targets with the correct types:

```bash
mkdir -p error_log
touch api_debug.log
```

Docker otherwise creates a missing `api_debug.log` target as a directory, and the application cannot write the log file.

## Web build and SSO helper

The Caddy/Compose topology serves the Expo export and API from one browser origin:

```text
https://luconnect.dlwltkd.com/      -> Expo Web static files, with SPA fallback
https://luconnect.dlwltkd.com/api/  -> FastAPI, with /api stripped upstream
```

Build the static client with the repository's Node version:

```bash
cd learnus-app
nvm use
npm ci
npx tsc --noEmit
EXPO_NO_TELEMETRY=1 npx expo export --platform web
test -s dist/index.html
```

Production web builds are fixed to same-origin `/api`; inherited native or EAS values such as `https://api.dlwltkd.com` are deliberately ignored because they cannot receive the luconnect host-only cookie. CI publishes the export atomically to the ignored `web-dist/` directory, keeps `index.html` non-cacheable, and retains old content-addressed assets for open tabs. Verify both `/auth/extension` (SPA fallback) and `/api/version` through the public origin before publishing the helper. In browser developer tools, confirm the session check goes to `https://luconnect.dlwltkd.com/api/auth/web-session` and that no request targets localhost or `api.dlwltkd.com`.

Build and validate the helper separately:

```bash
cd browser-extension
npm test
npm run build:production
```

The production manifest is fixed to `ys.learnus.org` and `luconnect.dlwltkd.com`; the development manifest is a separate build with localhost access. Never add localhost, wildcard hosts, content scripts, storage, or API-token handling to the production package. Before rollout, complete a real Chrome/Edge SSO test and confirm the exact LearnUs host permission can read every cookie the session needs.

Confirm the public hostname before packaging the store build. The host permission and completion URL are compiled into the extension, so changing the hostname later requires a new reviewed package.

The extension endpoints are intentionally rate-limited, so Uvicorn must see the real client address through Caddy. Compose binds port 8000 to loopback only and trusts forwarded headers received over the private container network. Do not restore a public port 8000 bind while `FORWARDED_ALLOW_IPS=*` is enabled. Verify the production topology with two distinct external clients before publishing the extension.

For the local extension flow, start the web client on `http://localhost:8081`, set `EXPO_PUBLIC_WEB_API_URL=http://localhost:8000`, and start the API with:

```dotenv
WEB_ALLOWED_ORIGINS=http://localhost:8081
WEB_SESSION_COOKIE_NAME=luconnect_session
WEB_SESSION_COOKIE_SECURE=false
```

The API enables credentialed CORS only for `WEB_ALLOWED_ORIGINS`; production still uses same-origin `/api`.

## Web-auth migration check

The first API or worker start after this change creates the browser-auth tables and clears values from the compatibility-only `users.moodle_password` and `users.hashed_password` columns. Back up PostgreSQL before either process starts. The backup contains cookies, tokens, and any legacy credential fields, so store it outside the checkout with restrictive permissions and remove it after the rollback window.

Count affected rows without selecting credential values:

```bash
umask 077
mkdir -p ../learnus-backups
LEARNUS_BACKUP_PATH="../learnus-backups/learnus-pre-web-auth-$(date +%Y%m%d%H%M%S).dump"
docker compose exec -T db pg_dump -U user -d learnus -Fc > "$LEARNUS_BACKUP_PATH"
docker compose exec -T db psql -U user -d learnus -Atc \
  "SELECT count(*) FROM users WHERE moodle_password IS NOT NULL OR hashed_password IS NOT NULL;"
```

After the API has started successfully, run the same count again and require `0`:

```bash
test "$(docker compose exec -T db psql -U user -d learnus -Atc \
  "SELECT count(*) FROM users WHERE moodle_password IS NOT NULL OR hashed_password IS NOT NULL;")" = "0"
```

## Mobile releases

Run EAS commands from `learnus-app/`. The production profile reads the release metadata from `app.json`, auto-increments Android builds, and submits to the production track.

```bash
cd learnus-app
npx tsc --noEmit
eas env:list preview
eas env:list production
eas build --platform android --profile production
eas submit --platform android --profile production
```

`EXPO_PUBLIC_API_URL` is compiled into the app. Each EAS environment must contain exactly one current value, and it should agree with `eas.json`. `GOOGLE_SERVICES_JSON` remains a secret file variable consumed by `app.config.js`.

This app requires a custom native build because it uses native cookie handling, a React Native patch, and `expo-dev-client`; Expo Go is not supported. See [Mobile builds](mobile-builds.md) for local build and device-debugging notes.
