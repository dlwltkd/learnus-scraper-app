# Repository Operating Contract

Scope: entire repository. Read this file and `CONTRIBUTING.md` before inspecting or changing code. If a nested `AGENTS.md` exists, its rules add to or override this file for that subtree.

## Documentation map

- `README.md`: product overview and repository entry point.
- `docs/README.md`: task-oriented documentation index.
- `docs/architecture.md`: runtime components, source boundaries, and data flows.
- `CONTRIBUTING.md`: development setup, change workflow, and validation.
- `docs/deployment.md`: current server and mobile release paths.
- `docs/mobile-builds.md` and `learnus-app/README.md`: native build guidance and app source map.
- `docs/runbooks/`: operational recovery procedures.
- `docs/incidents/`: evidence and follow-up from dated incidents.
- `docs/legal/`: user-facing privacy policy and terms of service.

Keep detailed guidance in its owning document and link to it instead of copying it into multiple files. Keep this contract accurate when architecture, schema, commands, or invariants change.

## Session bootstrap

1. Run `git status --short` and preserve unrelated user changes.
2. Read `AGENTS.md`, `CONTRIBUTING.md`, and the files directly involved in the task.
3. For backend or data work, read `database.py`, then trace the relevant route in `api.py` and its scraper/worker call path.
4. For app work, trace screen -> `learnus-app/services/api.ts` -> backend route. Check the related context and shared component before adding state or UI primitives.
5. Run the narrowest relevant check before editing when practical; run it again after editing.

Do not infer behavior from filenames or documentation when executable code can answer it. Do not alter generated files, secrets, local build output, or unrelated dirty-worktree changes.

## System map

```text
Expo app (`learnus-app/`)
  -> native Axios/SSE (`learnus-app/services/api.ts`, X-API-Token)
  -> web same-origin `/api` (host-only HttpOnly browser-session cookie)
  -> FastAPI (`api.py`)
       -> SQLAlchemy (`database.py`)
       -> LearnUs HTTP scraping/session (`moodle_client.py`)
       -> language/transcription provider (`ai_service.py`)
       -> persistent `jobs` rows
  -> worker (`worker.py`)
       -> queued transcription/watch jobs
       -> scheduled sync/session/notification work (`scheduler.py`)
       -> Expo push service
  -> PostgreSQL in Docker; SQLite fallback for local backend; in-memory SQLite in tests
MV3 SSO helper (`browser-extension/`) -> captured `ys.learnus.org` cookies -> one-use web ticket
Caddy (`Caddyfile`) -> API in deployment
```

### Source ownership

| Path | Responsibility | Change notes |
|---|---|---|
| `api.py` | App construction, dependencies, auth, routes, request orchestration | Keep routes thin; do not add ORM models or request schemas here. |
| `auth_service.py` | Moodle-cookie verification, canonical user upsert, one-time web tickets, hashed browser sessions | Remote Moodle validation must finish before the database transaction. Persist verified Moodle cookies only in `users.moodle_cookies`. Never persist or log raw ticket or browser-session secrets; expose a ticket only in its one-time response and a browser session only through `Set-Cookie`. |
| `schemas.py` | Pydantic HTTP request/response contracts | Coordinate shape changes with `learnus-app/services/api.ts`. |
| `database.py` | ORM models, engine creation, additive startup migrations | This is the schema source of truth; there is no Alembic setup. |
| `parsing.py` | Shared boundary parsers | Preserve malformed/legacy input behavior with regression tests. |
| `moodle_client.py` | LearnUs/Moodle HTTP session and HTML parsing | Treat upstream HTML as unstable; use fixture-based parsing tests. |
| `scheduler.py` | Periodic sync, session health, notification persistence/delivery, VOD watch orchestration | Functions receive `SessionLocal` or `Session`; preserve first-sync silence. |
| `worker.py` | Persistent job claiming/dispatch, transcription progress, scheduler host | Must remain safe with multiple worker threads/processes. |
| `ai_service.py` | Provider calls, usage extraction, summaries/chat/transcription | Log usage through `ai_usage_logs`; never log secrets or full credentials. |
| `course_brain.py` | Course corpus: per-file build, library tree, corpus assembly, item detail, build/learn queueing | Every stage is idempotent and commits per item so an interrupted build resumes. Respects `Course.brain_scope`. |
| `content_extract.py` | File bytes to text: PDF page extraction, sparse-page detection, page rendering, notebook/HTML handling | Pure extraction; no database or network. Page renders are a cache over the stored original. |
| `spend_limits.py` | Daily chat/transcription caps, bypass allowlist, labs allowlist, API token TTL | Imported by both `api.py` and `worker.py`; must not import either. Never name this module `limits` — that shadows the PyPI package slowapi imports. |
| `tests/` | Backend pytest suite and fixtures | New backend behavior requires a regression test. |
| `learnus-app/` | Expo/React Native TypeScript application | Strict TypeScript; shared UI lives in `components/`, state in `context/`, I/O in `services/`. |
| `browser-extension/` | Explicit Chrome/Edge bridge from a completed LearnUs SSO session to one-time web login | MV3; exact host permissions only; no content scripts, storage, logging, or API-token access. |
| Docker/Caddy/workflow files | Deployment topology | Keep API and worker environment variables aligned where shared. |

Known concentration: `api.py`, `moodle_client.py`, and several screens are large. Extract a boundary only when touching that area; preserve public imports used by tests and avoid broad rewrites unrelated to the task.

## Database quick context

### Engine and lifecycle

- `init_db(db_url=None)` reads `DATABASE_URL`; default is `sqlite:///learnus.db`. It normalizes legacy `postgres://` to `postgresql://`.
- Production uses PostgreSQL 15 at database `learnus` through Docker Compose. Tests replace `get_db` with a `StaticPool` in-memory SQLite session and enable SQLite foreign keys.
- `api.py` creates the session factory at import unless `TESTING` is set. `worker.py` creates its own factory and sessions.
- `Base.metadata.create_all()` creates missing tables. `init_db()` then performs idempotent, additive, raw-SQL column migrations/backfills. There is no migration version table and no downgrade path.
- Any schema edit must update the ORM declaration and provide a guarded migration for existing databases. Test both a fresh schema and, when migration logic changes, an old-schema fixture. Use PostgreSQL-compatible SQL and check SQLite compatibility where tests exercise it.
- Commit/rollback explicitly. Close sessions. Do not hold a transaction across Moodle, provider, media, or push-network calls.

### Entity graph and ownership

```text
users
  1 -> * courses
           1 -> * assignments
           1 -> * vods
           1 -> * files
           1 -> * boards -> * posts
  1 -> * push_tokens
  1 -> * notification_history
  1 -> * flashcard_decks -> * flashcards
  1 -> * web_login_tickets
  1 -> * web_sessions
  1 -> * ai_usage_logs (nullable user_id; no ORM relationship)

vod_transcripts  keyed globally by unique moodle_id; no FK to vods/users
jobs             standalone queue; ownership/resource IDs live in JSON payload
login_debug_reports standalone diagnostic records
```

### Tables and invariants

| Table/model | Identity and constraints | Important state |
|---|---|---|
| `users` / `User` | unique `username`, unique nullable `api_token` | Moodle identity/session cookie text, notification flags/preferences, daily chat/transcribe counters, labs flags. `token_issued_at` dates the current token; `get_current_user` rejects tokens older than `API_TOKEN_TTL_DAYS` and stamps a null value rather than rejecting it. `moodle_password` and `hashed_password` are compatibility-only columns; startup clears legacy values and application code must not persist passwords. |
| `web_login_tickets` / `WebLoginTicket` | unique SHA-256 `token_hash`; required user FK | 30-300 second ticket bridge from the SSO extension; raw ticket is returned once, never stored, and `consumed_at` makes exchange one-use. |
| `web_sessions` / `WebSession` | unique SHA-256 `token_hash`; required user FK | Independently expiring/revocable browser sessions. The raw secret exists only in a host-only HttpOnly cookie. |
| `push_tokens` / `PushToken` | unique token; required `user_id` | One row per device. Legacy `users.push_token` may be migrated into this table. |
| `notification_history` / `NotificationHistory` | required `user_id` | title/body/type/data/read/created timestamp. |
| `courses` / `Course` | unique (`moodle_id`, `owner_id`) | `is_active` controls sync; `is_initialized` prevents notifications during first sync. `professor`/`professor_fetched_at` cache the instructor; the timestamp is stamped even when none is found so a course is not re-queried forever. Brain state: `brain_enabled` (per-course opt-in), `brain_scope` (JSON `{vods,files,assignments}`, missing keys default true), `brain_status` queued/building/ready/error, `brain_progress` 0..100, `brain_stage`, `brain_error`, `brain_built_at`. |
| `assignments` / `Assignment` | DB PK plus Moodle ID, course FK | Date is stored as text. `completion_overridden` protects a manual completion choice from scraper refresh. `section`/`week` come from the course-page scrape; `description`/`description_fetched_at` are filled by a brain build, not by normal sync. |
| `vods` / `VOD` | DB PK plus Moodle ID, course FK | Start/end dates are text; duration seconds optional; `has_tracking` distinguishes trackable content. `section`/`week` locate it in the course tree. |
| `files` / `FileResource` | DB PK plus Moodle ID, course FK | completion and optional `local_path` to the stored original. Brain fields: `content`/`content_chars` extracted text, `page_count`, `captioned_pages`, `file_kind`, `file_bytes`, `extract_status` (null = never built; ok/skipped/empty/error/too_large), `extract_error`, `extracted_at`, plus `section`/`week`. A null `extract_status` is what marks a file as outstanding work. |
| `boards` / `Board`; `posts` / `Post` | nested course -> board -> post | Post content may be populated after listing. `section`/`week` locate the board in the course tree. Posts are stored by normal sync, so announcements are in the corpus without a brain build. |
| `vod_transcripts` / `VodTranscript` | globally unique `moodle_id` | `status`: queued/running/done/failed; `stage`: queued/extracting_audio/transcribing/finalizing/completed/failed; progress 0..100; transcript, summary, errors, timing. Keep `is_processing` compatible with legacy rows. |
| `jobs` / `Job` | standalone PK | type: transcribe/watch_all/watch_one/brain_build/brain_learn_item; status: pending/processing/done/failed; JSON payload, timestamps, error. Claiming must remain atomic. Brain jobs are de-duplicated by scanning pending/processing payloads before enqueueing, so a frequent sync cannot pile up duplicate builds. |
| `ai_usage_logs` / `AIUsageLog` | optional user FK | endpoint/model and prompt/completion/total token counts. |
| `flashcard_decks` / `FlashcardDeck` | required user FK | Moodle VOD ID is not an FK; cached card count. |
| `flashcards` / `Flashcard` | required deck FK | stable `position`; relationship orders by position. |
| `login_debug_reports` / `LoginDebugReport` | standalone PK | device info and serialized logs; treat contents as sensitive. |

ORM cascades delete course children, user courses/push tokens/history/decks/web tickets/web sessions, board posts, and deck cards. Foreign-key columns do not consistently declare database-level `ON DELETE CASCADE`; delete through ORM relationships unless a deliberate migration changes that invariant.

Every user-scoped query must prove ownership through `owner_id`/`user_id` or a parent join. Never authorize access by a client-supplied Moodle ID, deck ID, course ID, board ID, post ID, notification ID, or job payload alone. `VodTranscript.moodle_id` is global, so transcript routes must first resolve a VOD through a course owned by the current user.

### Primary data flows

- Native login: Moodle authentication -> verified session cookies -> `users.api_token` and `users.moodle_cookies`; password input is transient and must not be stored or logged.
- Web login: explicit MV3 extension capture -> verified Moodle UID and canonical `users.moodle_cookies` update -> hashed one-time ticket -> same-origin completion -> hashed `web_sessions` row and host-only HttpOnly cookie. It never mints or returns `users.api_token`.
- Session sync: mobile WebView cookie string -> normalized cookie storage -> Moodle identity/course synchronization.
- Course sync: Moodle scrape -> upsert course children; preserve manual assignment overrides and first-sync notification rules.
- Transcription: authorized VOD -> `vod_transcripts` state + `jobs` row -> worker claim -> media/audio/transcription stages -> persisted transcript -> optional summary/chat/flashcards.
- Notifications: scheduler detects changes -> writes `notification_history` -> broadcasts to all `push_tokens`; history persistence and push delivery are separate failure surfaces.
- Course brain: per-course opt-in -> `brain_build` job -> assignment instructions, lecture transcripts, then file text/slide captions -> `courses.brain_*` progress. Every later sync calls `scheduler._top_up_brain`, which enqueues another build only when `course_brain.pending_work` reports outstanding items, so an unchanged course costs three counts and no job. `brain_learn_item` teaches one library row on demand and is deliberately independent of the course toggle.

## Security invariants

These were each a real defect. Re-breaking any of them is a security regression, not a style change.

- **The account comes from the session, never the request body.** `/auth/sync-session` derives the Moodle user with `get_user_id()`; a client-supplied `user_id` is only ever compared and logged on mismatch. Trusting it previously minted a valid API token for any account whose Moodle ID could be guessed.
- **Browser authentication is not the native bearer.** Extension capture validates LearnUs remotely, updates the canonical Moodle cookie session used for synchronization, stores only hashes of one-use tickets and browser sessions, and makes browser sessions independently revocable. Ticket and browser-session secrets never enter localStorage or extension storage. A supplied `X-API-Token` takes precedence and an invalid one never falls back to a cookie.
- **Cookie-authenticated writes are same-origin only.** Completion and every unsafe browser request require an exact `Origin` from `WEB_ALLOWED_ORIGINS`; native bearer requests remain exempt.
- **Never log credential values.** Cookie strings are live Moodle sessions, and a keyless cookie value can appear as a parsed key. Log only counts and the presence of fixed, non-secret fields.
- **Brain surfaces require both flags.** `_require_brain_enabled` checks `labs_unlocked` *and* `brain_enabled`, so revoking lab access actually revokes it. Chat additionally requires `_require_course_brain` (the per-course opt-in). This covers the library, item detail, page renders, status, and every mutation.
- **Lab access is operator-granted.** `/settings/labs/unlock` checks `LABS_ALLOWED_USERS`; the in-app gesture is obscurity, not access control. An empty allowlist grants nobody.
- **Tokens expire and can be revoked.** `API_TOKEN_TTL_DAYS` bounds native lifetime. `POST /auth/logout` revokes the current browser session without breaking native or other browser sessions; native logout clears its bearer and clears Moodle cookies only when no browser session remains.
- **Anything that can spend must claim budget.** The worker calls `spend_limits.claim_transcription` per lecture, the same cap the manual endpoint enforces; builds are resumable, so exhausting the budget defers rather than fails.
- **Every route is rate limited.** The limiter carries a global `120/minute` default via `SlowAPIMiddleware`, so a new route is limited before anyone remembers to decorate it. Expensive or LearnUs-facing routes set tighter explicit limits.
- **Never echo exception text to clients.** SQLAlchemy errors embed the database connection string.

## Implementation rules

### Python

- Python 3.11 deployment target; 4 spaces; `snake_case` functions/variables; `PascalCase` ORM/Pydantic classes.
- Keep route functions limited to validation, authorization, transaction orchestration, and response mapping. Put shared contracts in `schemas.py`, parsers in `parsing.py`, provider logic in its owning service, and reusable domain logic in a focused module.
- Catch specific exceptions. Translate expected boundary failures to stable HTTP errors. Log enough context to diagnose without tokens, cookies, passwords, transcript content, or personal data.
- Do not use mutable defaults such as `default={}` or mutable function arguments.
- Preserve public compatibility when extracting code: re-export an existing helper if tests or callers import it from the old module.

### TypeScript/React Native

- Strict TypeScript, functional components, hooks, single quotes, semicolons.
- `PascalCase` component/screen filenames, `camelCase` helpers, `useXxx` hooks.
- Keep HTTP calls and wire types in `services/api.ts`; secrets/tokens go through `services/secureStorage.ts`; shared visual primitives go in `components/`; cross-screen state belongs in a focused context.
- Handle loading, empty, error, offline/timeout, and unauthorized states. Clean up listeners, timers, subscriptions, and SSE connections in effect cleanup.
- Use constants/theme tokens before introducing literal spacing/color values. Avoid `any`; when boundary data is unknown, validate/narrow it.

### Comments and readability

- Prefer clear names and small cohesive functions. Comment decisions, invariants, upstream quirks, concurrency assumptions, and non-obvious security constraints—not line-by-line mechanics.
- Delete stale banners, narrated steps, commented-out code, and comments that merely restate syntax.
- Docstrings belong on public or non-obvious behavior. Keep them factual and update them with the code.
- A reader should be able to identify ownership, side effects, transaction boundaries, units, and state transitions without reconstructing hidden assumptions.

## Validation matrix

| Change | Required minimum |
|---|---|
| Backend logic/API/schema | focused pytest file, then `pytest tests/ -v --tb=short` |
| Parser/scraper | focused fixture tests including malformed/missing input |
| ORM/migration | fresh-schema test plus migration-path regression; full backend suite |
| Worker/scheduler/concurrency | focused state-transition/failure test; full backend suite |
| App TypeScript | `cd learnus-app && npx tsc --noEmit` |
| Browser extension | `cd browser-extension && npm test`, then build the intended production/development package |
| App UI | typecheck plus manual Expo check; attach screenshot/video to PR when visible |
| Deployment/config | validate syntax and run the narrowest available container/config check |

If an established check cannot run, report the exact command, failure, and what remains unverified. Do not weaken tests to make a change pass.

## Change and commit discipline

- Keep diffs scoped. Do not reformat untouched files or silently repair unrelated behavior.
- Never commit `.env`, credentials, cookies, tokens, local databases, logs, user media, Expo/Node caches, native generated folders, or temporary tool marker files.
- Commit format: `<type>: <concise imperative summary>`; common types are `fix`, `feat`, `refactor`, `test`, `docs`, and `chore`.
- Commit messages and PR text describe the product change only. Do not mention assistants, generation tools, prompts, or automated authorship. Do not add co-author trailers unless the user explicitly supplies a human co-author.
- Before handoff: inspect `git diff --check`, review the full diff for secrets/unrelated edits, run applicable checks, and state verified results and remaining risk.
