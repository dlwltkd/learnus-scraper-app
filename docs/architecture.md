# Architecture

LearnUs Connect is a monorepo containing an Expo mobile app, a FastAPI service, a persistent worker, and deployment configuration.

## Runtime overview

```text
Expo app (learnus-app/)
  -> Axios and SSE (learnus-app/services/api.ts, X-API-Token)
  -> FastAPI (api.py)
       -> SQLAlchemy (database.py)
       -> LearnUs HTTP session and scraping (moodle_client.py)
       -> AI and transcription provider (ai_service.py)
       -> persistent jobs table

Worker (worker.py)
  -> claims transcription and VOD watch jobs
  -> hosts scheduled sync, session, and notification work (scheduler.py)
  -> writes to the same database and sends Expo push notifications

Caddy -> FastAPI
PostgreSQL in Docker; SQLite for local backend development and in-memory tests
```

The API and worker are separate processes. Both initialize their own SQLAlchemy session factory. Work that must survive an API restart is stored in the `jobs` table and claimed by the worker.

## Repository map

```text
.
├── api.py                    HTTP app, dependencies, authentication, routes
├── schemas.py                Pydantic request and response contracts
├── database.py               ORM models, engine setup, additive migrations
├── parsing.py                Shared boundary parsers
├── moodle_client.py          LearnUs session handling and HTML parsing
├── ai_service.py             Provider calls, usage logging, AI operations
├── scheduler.py              Periodic sync, notifications, VOD orchestration
├── worker.py                 Persistent job claiming and dispatch
├── learnus-app/
│   ├── *Screen.tsx           Screen-level UI and navigation targets
│   ├── components/           Shared visual primitives
│   ├── context/              Cross-screen state
│   ├── hooks/                Shared hooks
│   ├── constants/            Theme and application constants
│   └── services/             API, notifications, demo mode, secure storage
├── tests/                    Backend pytest suite
├── scripts/                  Operational and maintenance scripts
├── docs/                     Architecture, deployment, and runbooks
├── .github/workflows/        CI and deployment automation
├── docker-compose.yml        API, worker, PostgreSQL, and Caddy topology
└── Caddyfile                 Public reverse proxy configuration
```

## Source boundaries

| Area | Start here | Follow to |
|---|---|---|
| Mobile feature | relevant `learnus-app/*Screen.tsx` | context/component -> `services/api.ts` -> backend route |
| HTTP endpoint | route in `api.py` | schema -> ownership query -> service, scraper, or job |
| Database change | model and `init_db()` in `database.py` | migration-path tests and all callers |
| LearnUs parsing | `moodle_client.py` | stable fixture tests in `tests/` |
| Transcription | VOD route in `api.py` | `jobs` row -> `worker.py` -> `ai_service.py` |
| Notifications | `scheduler.py` | history row -> all user push tokens -> Expo push service |
| Deployment | `.github/workflows/deploy.yml` | `Dockerfile`, Compose, Caddy, environment configuration |

Request schemas do not belong in `api.py`, ORM models do not belong in route modules, and HTTP calls from the app go through `learnus-app/services/api.ts`.

## Primary flows

### Login and session sync

1. The app completes LearnUs authentication in a WebView.
2. The app sends the resulting cookie string to the API.
3. The API normalizes the cookies, resolves the LearnUs identity, and stores the session.
4. The API returns a service token used as `X-API-Token` on later requests.

Passwords are transient and must never be persisted or logged.

### Course synchronization

1. The API or scheduler opens the user's stored LearnUs session.
2. `moodle_client.py` retrieves and parses upstream pages.
3. The synchronization path upserts courses and their assignments, VODs, files, boards, and posts.
4. Initial synchronization remains silent; later changes can create notification history and push notifications.

Manual assignment completion overrides must survive scraper refreshes.

### Transcription

1. A route proves the requested VOD belongs to the current user through its course.
2. The API creates or updates `vod_transcripts` state and enqueues a `jobs` row.
3. The worker atomically claims the job and persists extraction, transcription, and finalization progress.
4. The completed transcript can feed summaries, chat, and flashcards.

`vod_transcripts.moodle_id` is globally unique and has no user foreign key, so it is never sufficient for authorization by itself.

## Persistence constraints

`database.py` is the schema source of truth. There is no Alembic migration history: `Base.metadata.create_all()` creates missing tables, then `init_db()` performs guarded additive migrations for existing databases.

Production uses PostgreSQL 15. Local backend development falls back to `sqlite:///learnus.db`; tests use in-memory SQLite with foreign keys enabled. Schema changes must work for both the fresh-schema and existing-schema paths.

The complete entity graph, ownership rules, and state values live in [AGENTS.md](../AGENTS.md#database-quick-context).

## Configuration sources

| Configuration | Location |
|---|---|
| Backend and worker environment | `.env` loaded by Docker Compose; safe keys are listed in `.env.example` |
| Mobile API base URL | `EXPO_PUBLIC_API_URL`; localhost fallback in `learnus-app/services/api.ts` |
| Expo build profiles | `learnus-app/eas.json` |
| Native Expo metadata | `learnus-app/app.json` and `learnus-app/app.config.js` |
| Deployment secrets | GitHub Actions secrets documented in [deployment.md](deployment.md) |

Never commit `.env`, cookies, API tokens, service-account files, local databases, logs, or user media.
