# Deployment

The backend deploys from `main` through GitHub Actions. The mobile app is built separately with EAS.

## Server topology

`docker-compose.yml` runs four containers:

| Container | Role | Persistent state |
|---|---|---|
| `learnus_caddy` | TLS termination and reverse proxy | `caddy_data` volume |
| `learnus_api` | FastAPI service on port 8000 | PostgreSQL; bind-mounted `api_debug.log` |
| `learnus_worker` | queued and scheduled work | PostgreSQL; bind-mounted `error_log/` |
| `learnus_db` | PostgreSQL 15 | `postgres_data` volume |

PostgreSQL is published only on `127.0.0.1:5432`. Do not change it to a public bind. Port 8000 remains public temporarily for older clients; Caddy serves the HTTPS endpoint on ports 80 and 443.

## GitHub Actions deployment

`.github/workflows/deploy.yml` runs on every push to `main`:

1. Install Python 3.11 test dependencies.
2. Run `pytest tests/ -v --tb=short` with `TESTING=1`.
3. SSH to the server, pull `main`, rebuild the API, and start Caddy.
4. Rebuild the worker when its Python sources, requirements, or Dockerfile changed.

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
```

For a replacement server or lost volume, use the [Droplet recovery runbook](runbooks/droplet-recovery.md).

## Server environment

Copy `.env.example` to `.env` on the server and replace placeholders. At minimum, Compose requires:

```dotenv
POSTGRES_PASSWORD=<strong database password>
OPENAI_API_KEY=<provider key>
```

`.env` is ignored by Git and must be restored separately after a server rebuild. The API and worker share `DATABASE_URL` and `OPENAI_API_KEY`; keep shared values aligned in `docker-compose.yml`.

Before the first `docker compose up`, create the bind-mount targets with the correct types:

```bash
mkdir -p error_log
touch api_debug.log
```

Docker otherwise creates a missing `api_debug.log` target as a directory, and the application cannot write the log file.

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
