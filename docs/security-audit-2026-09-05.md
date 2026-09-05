# Security audit — 2026-09-05

The service has confirmed authorization, request-limiting, spending, and credential-handling weaknesses. No direct public download of a provider key or ordinary-user-to-administrator takeover was demonstrated. A normal authenticated account can nevertheless reach internal network addresses through media processing, bypass endpoint limits, and influence data shared with other accounts.

The application does not define an administrator role in its user model or a general administrator login. Its relevant elevated capabilities are operator-granted labs access, debug endpoints, and background jobs. Supplying an `admin` or `labs_unlocked` field did not grant access. The `role` values accepted in chat messages concern provider instructions, not application permissions; their lack of validation still permits misuse of the paid chat interface. The PostgreSQL superuser credential belongs to the backend process, as discussed below.

This audit covered the current working tree, all 64 explicitly declared API routes, authentication and database boundaries, scraper/worker/provider flows, browser authentication and extension code, web/native credential handling, Git history, locked JavaScript dependencies, and production inspection through `ssh learnus-droplet`. Production inspections were read-only. Exploit reproductions used synthetic accounts, isolated SQLite databases, mocked paid providers, and a harmless local audio server. No production account was modified and no paid provider request was made by the audit.

Production reported version `0.6.3`, with checkout revision `1cfa933c7092159615beb2f570c0c8a05c23edea`. API and worker source hashes matched each other. After normalizing newlines, their audited backend files matched this working tree except for the browser-login binding additions in `api.py`/`auth_service.py` and stricter ticket validation in `schemas.py`. Those changes exist locally but are absent from the running containers.

Severity reflects impact and prerequisites. A confirmed insecure configuration does not by itself establish that an outside attacker has already exploited it.

| ID | Severity | Finding | Production status |
|---|---|---|---|
| S01 | High | User-supplied media URLs allow server-side requests to internal destinations | Deployed code reproduced locally |
| S02 | High | Endpoint rate limits reset with alternate numeric paths and credentials | Deployed code reproduced locally |
| S03 | High | Daily spending controls have races and uncovered provider calls | Deployed code reproduced locally |
| S04 | High | Active credentials are copied into production container files | Verified on running API and worker |
| S05 | Medium | A watch job updates another account's VOD completion | Deployed code reproduced locally |
| S06 | High | User-selected audio can populate another student's shared transcript | Deployed code reproduced locally |
| S07 | Medium | Production browser login accepts a ticket from another browser | Reproduced from deployed source; local fix exists |
| S08 | Medium | Reauthentication revives the same expired native bearer | Deployed code reproduced locally |
| S09 | Medium | Raw provider/worker exceptions reach API responses | Deployed code reproduced with synthetic secrets |
| S10 | Medium | Queued brain work does not recheck revoked account permissions | Deployed code reproduced locally |

**S01 — Internal-network requests and unbounded media work**

Evidence: [`api.py`](../api.py), `transcribe_vod`, lines 1398–1449; [`ai_service.py`](../ai_service.py), `_probe_duration_seconds` and `_extract_audio_with_progress`, lines 241–314. Line numbers refer to the audited working tree; deployed API lines after login completion are 14 lines earlier.

`POST /vods/{id}/transcribe` accepts a caller-controlled `media_url`. It checks only that the string starts with HTTP or HTTPS, then queues it for FFprobe/FFmpeg. Supplying this URL also skips the upstream-session validity check. Ownership of a VOD is required, but account labs access is not.

The reproduction accepted a loopback URL for an ordinary account with labs disabled. A separate test ran the actual `_probe_duration_seconds` method against a local HTTP redirect and verified that FFprobe followed it to a second loopback resource. The application supplies no destination-IP restrictions for the initial fetch, redirects, or playlist resources. Internal service and metadata addresses are therefore within the reachable destination set unless network controls outside this code block them. Production metadata was not queried, and arbitrary local-file read or code execution was not demonstrated.

There is also no enforced media duration or download-size cap. The `wait(timeout=900)` call occurs after iterating FFmpeg's stdout until EOF; a stalled or endless input can prevent the timeout from being reached. Four such tasks can occupy the configured worker concurrency. Both production application containers lack memory and process limits.

Fix: derive media URLs from verified upstream resources, or restrict manual input to exact approved HTTPS origins. Enforce destination restrictions at connection time and on redirects and nested media resources; use network egress isolation as a second boundary. Add a wall-clock watchdog covering the complete process lifetime, network timeouts, duration/byte limits, and concurrent-work quotas. Protocol restrictions alone do not restrict destination IPs. [FFmpeg's protocol documentation](https://ffmpeg.org/ffmpeg-protocols.html) documents protocol allowlists and network timeouts.

**S02 — Rate limits can be reset without changing accounts**

Evidence: [`api.py`](../api.py), `_get_user_key` and limiter construction, lines 82–95; deployed SlowAPI `0.1.10` configuration and source.

The limiter uses the actual request path as its default scope. FastAPI interprets both `9101` and `09101` as the same integer, while the limiter stores different buckets. A test exhausted the five-request summary limit for an owned VOD, received 429, then received 200 and the same cached summary through the leading-zero path. This also affects other numeric-resource endpoints with explicit limits.

Separately, `_get_user_key` hashes an unverified header or cookie instead of a verified account identifier. A test exhausted `/version`'s 120-request allowance, then obtained 200 with an invented `X-API-Token`. That invented token still received 401 on authenticated resources: this bypasses the request limiter, not authentication. Two valid browser sessions for one account also received independent endpoint allowances.

The claimed global 120/minute ceiling is not an aggregate application ceiling. Default limits apply by route scope, explicit decorators replace defaults unless configured otherwise, and the configured storage is process-local memory. Multiple processes or restarts introduce further independent budgets. SlowAPI distinguishes `application_limits`, default limits, shared limits, and `override_defaults`. [Official API reference](https://slowapi.readthedocs.io/en/latest/api/).

Fix: use endpoint/route-template scopes rather than concrete paths; key authenticated budgets by verified user ID; retain a separate IP limit before authentication; use shared durable limiter storage and an explicit application-wide ceiling. Test leading zeros, multiple valid sessions, invalid credential rotation, process restarts, and multiple workers. Keep the explicit IP limits on login/exchange routes.

**S03 — The daily caps do not cap all spending**

Evidence: [`spend_limits.py`](../spend_limits.py), `claim_transcription`, lines 41–60; [`api.py`](../api.py), chat/transcription counters and `get_ai_summary`, lines 1696–1725; [`course_brain.py`](../course_brain.py), file captioning.

Budget claims read a count into an ORM object, increment it in Python, and commit an absolute value. Two sessions that both read `2` with a limit of `3` both successfully claimed the last slot, while the persisted count remained `3`. Committing does not make this sequence atomic. The API's chat, flashcard, and manual-transcription counters use the same pattern.

`POST /dashboard/ai-summary` calls the provider once per active course without claiming the daily AI budget or caching the response. The test set the account to its daily chat limit and confirmed that this endpoint still invoked the mocked provider and returned 200. VOD summarization also lacks a daily claim, although completed summaries are cached. Slide captioning has a per-file cap but no account-wide daily token/cost budget. A single allowed transcription can also contain an arbitrarily long user-supplied recording.

Fix: use an atomic conditional SQL update or a short row-locked transaction for each reservation; share it across every spending path. Claim before external work, release database transactions before network calls, and define retry/refund semantics. Add account-level input-token/audio-duration budgets, limits on queued work, and a service-wide spending ceiling. Input `messages` also needs bounds on message count, content size, allowed roles, and supported content types; the current schemas accept an unrestricted list.

**S04 — Active provider credentials are baked into both containers**

Evidence: [`Dockerfile`](../Dockerfile), `COPY . .`; [`.dockerignore`](../.dockerignore), exclusion of `.env` only; read-only inspection of both production containers.

The API and worker each contain two `.env.bak.*` files under `/app`, mode `0644`. Comparisons performed inside the API container confirmed that both backups contain the currently active provider key and database passwords. Values were not printed or exported. Excluding `.env` does not exclude its backups, and Git ignore rules do not exclude files from a Docker build context.

Someone who obtains the image, a readable exported layer, or an application-container file-read capability can recover these copies. The public site probes for `/.env`, `/.git/HEAD`, and `/credentials.json` returned the ordinary SPA HTML, byte-for-byte identical to `/`; no public credential download was found. There is no evidence from this audit that the images or credentials have already been obtained by an unauthorized party.

Fix: allowlist runtime files in the image build, or comprehensively exclude `.env*`, backup files, credentials, databases, logs, and local agent configuration while deliberately retaining safe examples. Store backups outside the build context. Rebuild clean images and retire affected image layers/build caches; deleting the files from a running container is insufficient. Rotate the copied credentials after containment, particularly if images or backups have been distributed or their access cannot be accounted for.

There is another credential-retention issue in [`api.py`](../api.py), the transcription job payload: raw Moodle cookies are copied into `jobs`, and [`worker.py`](../worker.py) restores that copy. Production contained three jobs with a cookie field. Prefer an account/resource reference and load the current authorized session when executing work, then purge credential copies from completed payloads through a deliberate maintenance change. No job-payload read endpoint was found.

**S05 — Watch worker crosses the ownership boundary**

Evidence: [`worker.py`](../worker.py), `_run_watch_one`, lines 335–352.

The API verifies that the requesting user owns a VOD. The worker then looks it up globally with `VOD.moodle_id == vod_moodle_id`, without joining its course owner. When two students have rows for the same Moodle VOD, the worker can select the first student's row while using the second student's session.

The two-account reproduction processed the second account's watch job. It marked the first account's stored VOD complete and left the second account's row incomplete. This demonstrates unauthorized modification of application state; it does not demonstrate changing another student's attendance at Moodle.

Fix: include the internal VOD ID in the job and prove ownership again in the worker, using a course-owner join. Recheck relevant feature permissions and current session validity before execution. Cover both enqueue and execution boundaries in the regression.

**S06 — Manual audio contaminates a globally shared transcript**

Evidence: [`api.py`](../api.py), `transcribe_vod`; [`worker.py`](../worker.py), `_run_transcribe`; [`database.py`](../database.py), `VodTranscript.moodle_id` global uniqueness.

An enrolled user can associate arbitrary external audio with an owned VOD. The worker stores the result in the globally shared transcript row keyed only by Moodle VOD ID. Other users enrolled in that VOD then receive this result as its lecture transcript and can use it for summaries, flashcards, and course chat.

With the provider mocked, the reproduction queued attacker-selected audio for one account, processed it, and read the substituted text from the other account. The normal endpoint requires that the shared transcript is absent or retryable; this is not an unrestricted overwrite of every completed transcript.

Fix: admit only verified canonical media into the shared cache. Store user-supplied transcriptions under a user-scoped resource, or disable the manual URL option. Record source identity/provenance and make concurrent creation and retries idempotent.

**S07 — Browser login is not bound to its initiating browser in production**

Evidence: deployed `api.py`, `complete_extension_login`, line 881 onward. The working tree adds `matches_web_login_cookie` at [`api.py`](../api.py), lines 885–896, and corresponding helpers in [`auth_service.py`](../auth_service.py).

Production checks the request Origin and ticket expiry/one-use status but does not require the helper's browser-binding cookie. An attacker can create a ticket for their own account and send its completion link to another browser. The completion page itself sends an allowed-origin POST, so the Origin check succeeds.

The isolated production-source test started with another account's browser session and submitted the attacker's ticket without a binding cookie. It returned 200 and set a new cookie for the attacker's account. The same test against the working tree returned 401. This is login CSRF/account confusion; it does not mint a ticket for an arbitrary victim account or grant an admin role.

Fix: deploy the existing browser-binding implementation and distribute helper version 0.1.1 or later in the order documented in [deployment guidance](deployment.md). Verify copied-link rejection and successful legitimate login before considering this resolved. The audit did not deploy the pending changes.

**S08 — Native token expiry can be undone by the legitimate user's next login**

Evidence: [`auth_service.py`](../auth_service.py), `upsert_moodle_user`, lines 195–198; the legacy login handler in [`api.py`](../api.py) behaves similarly.

Reauthentication keeps the same bearer value and resets its issuance time. A stolen bearer can therefore regain validity whenever its legitimate owner signs in again. The test first received 401 for a token older than 30 days, performed the verified-user upsert, and received 200 using the identical token.

Fix: use device-scoped, hashed, independently revocable native sessions with a true absolute expiry, or rotate the bearer on reauthentication with an explicit multi-device migration. Retaining the same secret and renewing its timestamp does not bound the lifetime of a stolen copy.

**S09 — Exception strings can expose sensitive diagnostics**

Evidence: [`api.py`](../api.py), `summarize_vod`, line 1486; [`worker.py`](../worker.py), transcription failure handling, line 310; transcript/status routes; course/file build error responses.

Summarization returns `str(e)` directly. The worker persists exception text into transcript errors, which the API returns to authorized readers. Tests injected a fake secret into provider exceptions and recovered it from both response paths. This proves the disclosure mechanism, not that the provider currently returns a complete real API key in its errors. Depending on the failing component, exposed text can include key fragments, URLs, file paths, request details, or database diagnostics.

Fix: return stable public error codes/messages, keep a correlation ID for operator diagnosis, and redact credentials from restricted logs. Store public error status separately from private diagnostic detail. Apply this consistently to stream, transcript, brain, file-extraction, and debug paths.

**S10 — Background work ignores revoked account labs permission**

Evidence: [`worker.py`](../worker.py), `_run_brain_build` and `_run_brain_learn_item`; [`scheduler.py`](../scheduler.py), `_top_up_brain`.

The HTTP brain gates check both account flags, but queued execution does not. A synthetic account with `labs_unlocked=False` and `brain_enabled=False` still reached the item builder when an already-queued job was dispatched. Course top-up scheduling checks the course toggle without the account gates. The main build checks the course toggle once before execution, not the account permissions before spending.

An ordinary account cannot directly submit a new labs job through the protected API using these false flags. The defect concerns revocation and continued background authority. The production aggregate check found no locked account with a stale enabled account flag at inspection time.

Fix: recheck account and course authorization at dispatch and before each billable item, and define what happens to queued work on opt-out, logout, or operator revocation. The auto-watch gate should likewise require labs access as well as its feature flag.

**Additional production and client risks**

| Area | Observed condition | Recommended action and limit of finding |
|---|---|---|
| SSH administration | Public SSH; effective `PermitRootLogin yes` and `PasswordAuthentication yes` | Use a dedicated key-only administrative account and disable root/password login after verifying alternate access. No password attack was performed and no remote root compromise was demonstrated. |
| Container and database privileges | API and worker run as UID 0 with writable root filesystems, no memory/PID limits, and default capabilities. The application's PostgreSQL role is a superuser with role/database-creation rights. | Use unprivileged container users, resource limits, reduced capabilities, and a least-privilege database role. These amplify another vulnerability; they do not establish an application-to-host escape. |
| Host firewall | API and PostgreSQL bind to loopback; UFW also retains an unnecessary public allow rule for port 8000 | Remove the stale rule so a future bind change does not expose a service that trusts all forwarded-header sources. Current socket/container inspection showed no public API/database listener. |
| Browser response policy | Production HTML lacks CSP, HSTS, frame restrictions, and `X-Content-Type-Options` | Add a tested CSP with `frame-ancestors`, HSTS after checking subdomain requirements, and content-type/referrer protections. No working site XSS or authenticated framing exploit was demonstrated. |
| Debug routes | Disabled publicly: both API origins return 404 for login reports. Enabling `ENABLE_DEBUG` makes the report listing available without user authentication. | Remove these routes from production or require separate operator authorization. A synthetic test demonstrated unauthenticated report access when the flag is enabled; production currently has it disabled. |
| Native WebViews | The VOD viewer attaches an explicit Cookie header to its input URL and uses string-prefix host checks; a lookalike hostname passes those checks. Native post detail inserts upstream HTML/title/metadata without escaping into a script-capable WebView. | Parse and compare exact origins before attaching credentials; restrict navigation and disable script execution for static post content or sanitize it. Exploitation requires control over an upstream/view URL or content; device-level exploitation was not tested. |
| Native credential migration | Several VOD screens still read `userToken` from AsyncStorage while current authentication uses SecureStore | Remove stale plaintext credentials during a deliberate upgrade migration and make storage ownership consistent. Existing device storage was not inspected. |
| Resource consumption | Chat/deck schemas lack useful size limits; course-file downloads buffer the whole response before checking the 80 MB cap | Enforce request-body and field limits and stream downloads with an early byte cap. No large-payload or production exhaustion test was performed. |

**Dependency review**

`npm audit --omit=dev --json` reported 30 affected dependency entries: 11 high and 19 moderate, with no critical entries. These are dependency-tree counts, not 30 independently verified application exploits. Several findings are in Expo/Metro/PostCSS build tooling, which is not the production static HTTP server. The Markdown renderer is used in application screens and deserves direct review. For example, the maintained [linkify-it advisory](https://github.com/markdown-it/linkify-it/security/advisories/GHSA-v245-v573-v5vm) describes expensive processing of crafted text. The [PostCSS advisory](https://github.com/postcss/postcss/security/advisories/GHSA-6g55-p6wh-862q) concerns processing attacker-controlled CSS/source-map input; reachability in this build was not demonstrated.

The deployed Python-package inventory produced advisory matches for `pip 24.0` and `setuptools 79.0.1` only. After deduplication, there were seven advisory IDs across those packages. These concern package installation/build behavior, including conditions that may not apply to the deployed Linux/Python version; they are not seven confirmed request-time server vulnerabilities. No advisories were reported for the other inventoried Python packages. This does not cover all native OS packages or undisclosed vulnerabilities.

The fresh isolated test environment resolved newer permitted packages and reported no known Python advisories. Because `requirements.txt` uses lower bounds rather than a lock, that result alone would have missed the older deployed build tools. Pin tested dependency sets, review and update the Expo/Markdown dependency chain, and add backend dependency scanning. The existing workflow fails npm audit only at critical severity, so its current gate does not reject the reported high findings.

**Controls that held in this audit**

- API authentication rejected missing/invalid native tokens; an invalid supplied bearer did not fall back to a valid browser cookie.
- Moodle session verification derives the account from upstream identity. Client-supplied identity and extra admin/labs fields did not grant another account or labs access in the exercised paths.
- The ordinary course, file, post, deck, notification, and transcript read paths reviewed enforce ownership. The concrete cross-account failures are identified above.
- Browser-session and ticket values are hashed in the database. Production browser-cookie configuration is host-only, Secure, HttpOnly, and SameSite Strict. One-use tickets and unsafe-request Origin checks are implemented; production's missing browser binding is S07.
- The production bundle scanned contained no matching provider key, private-key block, or AWS access key, and contained no source-map reference. Targeted scans of 255 current tracked/untracked non-ignored files and 1,325 historical Git blobs found no matches for the selected provider/private-key/AWS/GitHub-token patterns. These scans do not detect every secret format and deliberately do not claim that ignored local secret files are absent.
- The browser helper's production permissions are limited to the two intended HTTPS hosts. It has no broad content-script or storage permission and does not receive the native API bearer.
- Public sensitive-file probes returned SPA HTML rather than the requested files. Public unauthenticated session checks returned 401, and debug report endpoints returned 404.
- Caddy is the public application entry point; API and database ports are loopback-only. The same audited source version runs in both application containers.

**Verification and retained evidence**

| Check | Result |
|---|---|
| Backend suite: `python -m pytest tests/ -v --tb=short -p no:cacheprovider` | 147 passed |
| Security reproductions against working tree | 17 passed; tests intentionally assert reproduced weaknesses and selected controls |
| Same reproductions against copied deployed source | 17 passed; includes the production-only unbound-login outcome |
| App: `node node_modules/typescript/bin/tsc --noEmit` | Passed; equivalent installed compiler to `npx tsc --noEmit` |
| Browser auth: `node tests/browser-auth.test.cjs` | 35 passed |
| Extension: `npm test` | All 5 test files passed |
| Targeted Bandit review | No high findings; reviewed medium reports were debug timeout/bind configuration and migration SQL constructed from fixed internal identifiers, not confirmed request-driven SQL injection |
| `git diff --check` | Fails on pre-existing CRLF/trailing-whitespace differences, beginning at `.dockerignore:1`; those changes were preserved |

Tests ran locally on Python 3.14.7; production reports Python 3.11.16, FFmpeg 7.1.5, and Poppler 25.03.0. The production-source tests use the copied deployed code with the isolated test environment's dependencies, not an exact replica of every production binary. The genuine local FFprobe request test establishes URL/redirect behavior but does not test production metadata services or native media-parser exploits.

Reproduction file: `/tmp/learnus-security-audit/test_reproductions.py`. Deployed-source snapshot: `/tmp/learnus-security-audit/deployed/`. Logs and redacted inventories use `/tmp/learnus-security-*`. The source snapshot contains the explicitly selected application source files, not `.env`, databases, user content, or backup credentials.

Run the isolated reproductions with:

```bash
PYTHONDONTWRITEBYTECODE=1 /tmp/learnus-security-audit-venv/bin/python -m pytest /tmp/learnus-security-audit/test_reproductions.py -v --tb=short -p no:cacheprovider
LEARNUS_AUDIT_SOURCE_ROOT=/tmp/learnus-security-audit/deployed PYTHONDONTWRITEBYTECODE=1 /tmp/learnus-security-audit-venv/bin/python -m pytest /tmp/learnus-security-audit/test_reproductions.py -v --tb=short -p no:cacheprovider
```

Address S01–S04 and S06 first, and ship the already-written S07 browser-binding fix with the compatible helper. Then repair worker ownership/revocation, native-session lifetime, and error disclosure; reduce infrastructure privileges and update affected dependencies. Turn each reproduction into a regression that expects secure behavior as its corresponding fix lands. This audit changed no application code or production configuration.
