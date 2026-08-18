# Deploys reported success while shipping nothing

- Date: 2026-08-17
- Status: resolved; guard added to the workflow

## Impact

Every "Deploy to Droplet" run between `14ebbfd` and `0d2d86b` reported ✅ while the
droplet kept running older code. The API container was rebuilt each time, so the job
genuinely succeeded — it just rebuilt the same unchanged checkout.

The window covers at least the `b6784bb` corpus-cap change, which appeared deployed and
was not. It went unnoticed because the same edit had been applied by hand on the droplet
during an earlier debugging session, so the running code happened to be correct by
coincidence rather than by deployment.

## Cause

The deploy step ran an unguarded script:

```bash
cd ${{ secrets.DEPLOY_PATH }}
git pull origin main
docker compose up -d --no-deps --build api
```

A stray working-tree edit to `course_brain.py` on the droplet — the hand-applied
`MAX_CORPUS_CHARS` bump — made `git pull` abort:

```
error: Your local changes to the following files would be overwritten by merge:
	course_brain.py
Aborting
```

`appleboy/ssh-action` does not enable `set -e`, so the failed pull did not stop the
script. The build that followed succeeded against the stale checkout and the job exited
`0`.

## Evidence

| Check | Result |
|---|---|
| GitHub Actions run for the deploy | `completed success` |
| `git log --oneline -1` on the droplet | `14ebbfd`, several commits behind `main` |
| `grep -c brain_enabled database.py` inside the API container | pre-change value |
| `git pull origin main` run by hand on the droplet | aborted on local changes |
| `git diff --ignore-all-space course_brain.py` | 16 substantive lines, identical to `b6784bb` |

The local diff was confirmed byte-equivalent to the committed change before it was
discarded, so nothing unique was lost.

## Fix

The deploy script now fails loudly and proves what it deployed:

```bash
set -euo pipefail
cd ${{ secrets.DEPLOY_PATH }}
git pull origin main
test "$(git rev-parse HEAD)" = "${{ github.sha }}"
docker compose up -d --no-deps --build api
```

The `rev-parse` assertion is the important half: a green run now means the droplet is on
the commit that triggered it, not merely that a container rebuilt. Verified on the next
push, which failed nothing and left the droplet on the exact triggering commit.

## Lessons

- A deploy that cannot fail is not a deploy. Any remote script run through an action that
  does not set `-e` needs it set explicitly.
- Success should assert the intended end state, not the completion of the last command.
- Editing files directly on the droplet leaves a trap that outlives the debugging session.
  Apply the fix in the repository and deploy it, even when the immediate need is urgent.
