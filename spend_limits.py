"""
Spend limits shared by the API and the worker.

Named spend_limits rather than limits: a top-level `limits` module would shadow the
PyPI package slowapi imports, breaking rate limiting itself.

These used to live inside api.py, which meant the worker — the process that actually
spends money on transcription — could not see them. Anything that can bill the OpenAI
account needs the same ceiling, so the rule lives in one place both can import.
"""
import os
from datetime import date

DAILY_CHAT_LIMIT = int(os.getenv('DAILY_CHAT_LIMIT', '30'))
DAILY_TRANSCRIBE_LIMIT = int(os.getenv('DAILY_TRANSCRIBE_LIMIT', '3'))


def is_transcribe_limit_bypassed(user) -> bool:
    """
    Whether this user is exempt from the daily transcription cap.

    Configured by env var rather than a database flag on purpose: it is an operator
    decision about spend, not a user-facing setting, so it cannot be granted by anything
    a request can reach.
    """
    bypass_users = {
        u.strip() for u in os.getenv("TRANSCRIBE_BYPASS_USERS", "").split(",") if u.strip()
    }
    bypass_tokens = {
        t.strip() for t in os.getenv("TRANSCRIBE_BYPASS_TOKENS", "").split(",") if t.strip()
    }
    user_keys = {
        getattr(user, 'username', '') or "",
        getattr(user, 'moodle_username', '') or "",
        getattr(user, 'api_token', '') or "",
    }
    return (any(k in bypass_users for k in user_keys if k)
            or any(k in bypass_tokens for k in user_keys if k))


def claim_transcription(db, user) -> bool:
    """
    Take one unit of today's transcription budget, returning False when it is spent.

    Rolls the counter over at the date boundary and commits, so concurrent workers see
    each other's claims. Callers that get False should defer rather than fail: brain
    builds are resumable, so a course simply continues tomorrow.
    """
    if is_transcribe_limit_bypassed(user):
        return True

    today = date.today().isoformat()
    if user.transcribe_count_date != today:
        user.transcribe_count_today = 0
        user.transcribe_count_date = today
    if (user.transcribe_count_today or 0) >= DAILY_TRANSCRIBE_LIMIT:
        return False
    user.transcribe_count_today = (user.transcribe_count_today or 0) + 1
    db.commit()
    return True
