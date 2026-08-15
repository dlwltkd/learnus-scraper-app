# Contributing

`AGENTS.md` is the repository operating contract and technical context source. Read it before starting and keep it accurate whenever architecture, schema, commands, or invariants change.

## Workflow

1. Inspect `git status --short`; preserve unrelated changes.
2. Trace the complete path affected by the change. For app features this normally means screen/context -> `learnus-app/services/api.ts` -> `api.py` -> database/service/worker. For backend changes, include the caller and persistence path.
3. Reproduce the problem or run a focused baseline check when practical.
4. Make the smallest cohesive change that solves the root cause. Extract shared logic when duplication or file responsibility makes the boundary clear; do not combine feature work with broad cleanup.
5. Add or update regression tests.
6. Run focused checks, then the broader check required by `AGENTS.md`.
7. Review `git diff --check`, the complete diff, security-sensitive data, and documentation accuracy.

## Local setup

Backend (Python 3.11 deployment target):

```powershell
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements-test.txt
$env:TESTING = '1'  # only for isolated imports/tests; omit when running the real API
pytest tests/ -v --tb=short
```

Run locally with SQLite by leaving `DATABASE_URL` unset:

```powershell
Remove-Item Env:TESTING -ErrorAction SilentlyContinue
python api.py
```

Run the deployed topology locally:

```powershell
docker compose up --build
```

Mobile app:

```powershell
cd learnus-app
npm install
npx tsc --noEmit
npm run start
```

Use `npm run android`, `npm run ios`, or `npm run web` for the target platform. Configure `EXPO_PUBLIC_API_URL` outside source control when the API is not at `http://localhost:8000`.

## Change requirements

### Backend and API

- Keep HTTP contracts in `schemas.py` and synchronize wire-shape changes with `learnus-app/services/api.ts`.
- Authenticate with `X-API-Token`. Every resource lookup must enforce the current user's ownership through a direct owner column or parent join.
- Never persist or log passwords, API tokens, cookies, authorization headers, full personal records, or private transcript content.
- Add a pytest regression for new behavior. Reuse the in-memory database and dependency overrides in `tests/conftest.py`.

### Database

- Read the database section in `AGENTS.md` before any persistence change.
- Update both the SQLAlchemy model and the guarded startup migration. `create_all()` does not alter existing columns.
- Migrations must be idempotent and safe for existing PostgreSQL data. Do not rename/drop/backfill destructively without an explicit rollout and recovery plan.
- Make transaction boundaries explicit; never keep a transaction open across remote requests or long media processing.

### Mobile app

- Preserve strict TypeScript and the existing single-quote/semicolon style.
- Reuse theme tokens, shared components, contexts, and service helpers before adding equivalents.
- Clean up effects and represent loading, empty, error, and unauthorized states.
- Run `npx tsc --noEmit`; manually verify visible behavior on the relevant Expo target.

### Documentation and comments

- Comments explain why a constraint or workaround exists. Do not narrate obvious code, retain dead code, or add tutorial-style sections.
- Update `AGENTS.md` in the same change when a table, relationship, state machine, module responsibility, environment variable, or validation command changes.
- Update user-facing docs when behavior, privacy, setup, or deployment changes.

## Tests and evidence

Standard backend gate:

```powershell
pytest tests/ -v --tb=short
```

Examples of focused runs:

```powershell
pytest tests/test_auth.py -v
pytest tests/test_parse_date.py tests/test_cookie_parsing.py -v
pytest tests/test_vods.py -v
```

Test behavior and failure modes, not private implementation details. Parser tests should use stable local fixtures. Worker tests should assert legal status transitions and retry/failure behavior. Database tests should exercise ownership and foreign-key behavior.

PR descriptions include scope/rationale, linked issue when available, exact commands/results, migration or rollout notes, and screenshots/video for visible mobile changes.

## Commits

Use `<type>: <concise imperative summary>`, for example:

```text
fix: preserve keyless cookie tokens
refactor: separate API schemas from routes
docs: document database ownership rules
```

Keep commits reviewable and product-focused. Do not mention assistants, generation tools, prompts, or automated authorship in commit messages or PR text. Do not add tool-based co-author trailers. Never commit secrets, `.env` files, local databases, logs, caches, build output, test recordings, or temporary marker files.
