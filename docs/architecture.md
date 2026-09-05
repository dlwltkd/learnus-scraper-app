# Architecture

LearnUs Connect is a monorepo containing an Expo mobile/web app, a FastAPI service, a persistent worker, a browser SSO helper, and deployment configuration.

## Runtime overview

```text
Expo app (learnus-app/)
  -> native: Axios and SSE with X-API-Token
  -> web: same-origin /api with an HttpOnly browser-session cookie
  -> FastAPI (api.py)
       -> auth_service.py (verified SSO cookies, one-time tickets, browser sessions)
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

Chrome/Edge MV3 helper (browser-extension/)
  -> reads cookies applicable only to https://ys.learnus.org/my/ after a click
  -> sends them to the fixed luconnect exchange endpoint
  -> opens the fixed web completion page with a short-lived one-use ticket
```

The API and worker are separate processes. Both initialize their own SQLAlchemy session factory. Work that must survive an API restart is stored in the `jobs` table and claimed by the worker.

## Repository map

```text
.
├── api.py                    HTTP app, dependencies, authentication, routes
├── auth_service.py           Moodle-session proof, web tickets and sessions
├── schemas.py                Pydantic request and response contracts
├── database.py               ORM models, engine setup, additive migrations
├── parsing.py                Shared boundary parsers
├── moodle_client.py          LearnUs session handling and HTML parsing
├── ai_service.py             Provider calls, usage logging, AI operations
├── course_brain.py           Course corpus build, library tree, corpus assembly
├── content_extract.py        File bytes to text; PDF extraction and page rendering
├── spend_limits.py           Daily caps, bypass and labs allowlists, token TTL
├── scheduler.py              Periodic sync, notifications, VOD orchestration
├── worker.py                 Persistent job claiming and dispatch
├── learnus-app/
│   ├── *Screen.tsx           Screen-level UI and navigation targets
│   ├── components/           Shared visual primitives
│   ├── context/              Cross-screen state
│   ├── hooks/                Shared hooks
│   ├── constants/            Theme and application constants
│   └── services/             API, notifications, demo mode, secure storage
├── browser-extension/        Explicit MV3 bridge for LearnUs SSO on the web
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
| Web authentication | `browser-extension/src/bridge.js` and `LoginScreen.web.tsx` | `auth_service.py` -> `WebLoginTicket` -> `WebSession` |
| HTTP endpoint | route in `api.py` | schema -> ownership query -> service, scraper, or job |
| Database change | model and `init_db()` in `database.py` | migration-path tests and all callers |
| LearnUs parsing | `moodle_client.py` | stable fixture tests in `tests/` |
| Transcription | VOD route in `api.py` | `jobs` row -> `worker.py` -> `ai_service.py` |
| Course brain | brain route in `api.py` | `course_brain.py` -> `jobs` row -> `worker.py` -> `content_extract.py`/`ai_service.py` |
| Spend or access limit | `spend_limits.py` | the API gate and the worker claim that share it |
| Notifications | `scheduler.py` | history row -> all user push tokens -> Expo push service |
| Deployment | `.github/workflows/deploy.yml` | `Dockerfile`, Compose, Caddy, environment configuration |

Request schemas do not belong in `api.py`, ORM models do not belong in route modules, and HTTP calls from the app go through `learnus-app/services/api.ts`.

## Primary flows

### Login and session sync

Native:

1. The app completes LearnUs authentication in a WebView.
2. The app sends the resulting cookie string to the API.
3. The API validates the cookies against LearnUs, resolves the LearnUs identity, and stores the session.
4. The API returns a service token used as `X-API-Token` on later requests.

Web:

1. The user completes Yonsei SSO in a normal LearnUs tab.
2. After an explicit click, the MV3 helper reads the HttpOnly cookies applicable to the exact LearnUs origin and sends them to the fixed exchange endpoint.
3. The API validates the same Moodle identity boundary without minting a native API token, stores only the hash of a 90-second one-use ticket, and returns the raw ticket once.
4. The helper binds the ticket to the initiating browser in a short-lived host-only `Secure; HttpOnly; SameSite=Strict` login cookie, then opens the fixed luconnect completion page with the ticket in the URL fragment. The page removes the fragment immediately and exchanges it same-origin.
5. The API requires the login cookie to match the ticket, atomically consumes the ticket, clears the login cookie, and sets a new host-only `Secure; HttpOnly; SameSite=Strict` browser-session cookie. Only a SHA-256 digest is stored in `web_sessions`. A copied completion link cannot establish a session in another browser.

Cookie-authenticated mutations and ticket completion require an exact allowed `Origin`. A browser logout revokes only that `WebSession`; it does not invalidate the native bearer or another browser.

Passwords are transient and must never be persisted or logged.

`users.moodle_cookies` remains one canonical upstream LearnUs session per account. A web capture can therefore replace the Moodle session used by native/background work; making upstream credentials device-scoped is a later schema change.

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

### Course brain

1. A student opts one course in. Enabling queues a `brain_build` job; the sweep is the expensive moment, so it follows an explicit per-course choice rather than running for every course at once.
2. The worker fetches assignment instructions, transcribes each lecture, then extracts and captions each file, writing progress to `courses.brain_*`. Every stage skips finished work and commits per item, so a deploy or an exhausted transcription budget resumes instead of restarting.
3. Each later sync calls `_top_up_brain`, which enqueues another build only when `pending_work` finds outstanding items.
4. Chat assembles the whole corpus deterministically for prompt-cache hits, and citations are resolved server-side: the answer is scanned for `[S<n>]` markers and only markers matching a real assembled source are returned.

`Course.brain_scope` gates which material is learned, and the progress weights renormalise around whatever is in scope. Access requires both the account-level flags and the per-course opt-in — see [AGENTS.md](../AGENTS.md#security-invariants).

## Persistence constraints

`database.py` is the schema source of truth. There is no Alembic migration history: `Base.metadata.create_all()` creates missing tables, then `init_db()` performs guarded additive migrations for existing databases.

Production uses PostgreSQL 15. Local backend development falls back to `sqlite:///learnus.db`; tests use in-memory SQLite with foreign keys enabled. Schema changes must work for both the fresh-schema and existing-schema paths.

The complete entity graph, ownership rules, and state values live in [AGENTS.md](../AGENTS.md#database-quick-context).

## Configuration sources

| Configuration | Location |
|---|---|
| Backend and worker environment | `.env` loaded by Docker Compose; safe keys are listed in `.env.example`. Compose passes variables **explicitly** per service, so a new key must be added to `docker-compose.yml` for the API, the worker, or both — otherwise it silently reads as unset inside the container. |
| Downloaded course material | `COURSE_FILES_ROOT`, backed by the `course_files` Docker volume; without the volume a rebuild destroys the corpus |
| Native API base URL | `EXPO_PUBLIC_API_URL`; localhost fallback in `learnus-app/services/api.ts` |
| Web API base URL | Production is fixed to same-origin `/api`; local web may use `EXPO_PUBLIC_WEB_API_URL` |
| Browser authentication | `WEB_ALLOWED_ORIGINS`, `WEB_LOGIN_TICKET_TTL_SECONDS`, `WEB_SESSION_TTL_DAYS`, `WEB_SESSION_COOKIE_NAME`, and `WEB_SESSION_COOKIE_SECURE` |
| Expo build profiles | `learnus-app/eas.json` |
| Native Expo metadata | `learnus-app/app.json` and `learnus-app/app.config.js` |
| Deployment secrets | GitHub Actions secrets documented in [deployment.md](deployment.md) |

Never commit `.env`, cookies, API tokens, service-account files, local databases, logs, or user media.
