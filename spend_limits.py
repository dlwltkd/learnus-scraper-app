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

from sqlalchemy import case, func, or_, update
from sqlalchemy.exc import IntegrityError

from database import DailySpendBudget, User

DAILY_CHAT_LIMIT = int(os.getenv('DAILY_CHAT_LIMIT', '30'))
DAILY_TRANSCRIBE_LIMIT = int(os.getenv('DAILY_TRANSCRIBE_LIMIT', '3'))
DAILY_SERVICE_CHAT_LIMIT = int(os.getenv('DAILY_SERVICE_CHAT_LIMIT', '1000'))
DAILY_SERVICE_TRANSCRIBE_LIMIT = int(os.getenv('DAILY_SERVICE_TRANSCRIBE_LIMIT', '100'))
DAILY_TRANSCRIBE_SECONDS_LIMIT = int(os.getenv('DAILY_TRANSCRIBE_SECONDS_LIMIT', '21600'))


def _claim_service_daily(db, column, limit: int, units: int) -> bool:
    if units < 1 or units > limit:
        return False
    today = date.today().isoformat()
    result = db.execute(
        update(DailySpendBudget)
        .where(DailySpendBudget.spend_date == today, column <= limit - units)
        .values({column: column + units})
    )
    if result.rowcount == 1:
        db.commit()
        return True
    db.rollback()
    try:
        with db.begin_nested():
            db.add(DailySpendBudget(
                spend_date=today,
                chat_units=units if column.key == 'chat_units' else 0,
                transcription_units=units if column.key == 'transcription_units' else 0,
            ))
            db.flush()
        db.commit()
        return units <= limit
    except IntegrityError:
        db.rollback()
        result = db.execute(
            update(DailySpendBudget)
            .where(DailySpendBudget.spend_date == today, column <= limit - units)
            .values({column: column + units})
        )
        db.commit()
        return result.rowcount == 1


def _refund_service_daily(db, column, units: int) -> None:
    today = date.today().isoformat()
    db.execute(
        update(DailySpendBudget)
        .where(DailySpendBudget.spend_date == today)
        .values({column: case((column >= units, column - units), else_=0)})
    )
    db.commit()


def _claim_daily(db, user, *, counter, counter_date, limit: int, units: int = 1) -> bool:
    """Atomically reserve daily units without holding a transaction across network I/O."""
    if units < 1 or limit < units:
        return False
    today = date.today().isoformat()
    current_count = func.coalesce(counter, 0)
    same_day = counter_date == today
    result = db.execute(
        update(User)
        .where(
            User.id == user.id,
            or_(counter_date.is_(None), counter_date != today, current_count <= limit - units),
        )
        .values({
            counter: case((same_day, current_count + units), else_=units),
            counter_date: today,
        })
    )
    db.commit()
    db.expire(user)
    return result.rowcount == 1


def _refund_daily(db, user_id: int, *, counter, counter_date, units: int = 1) -> None:
    today = date.today().isoformat()
    db.execute(
        update(User)
        .where(User.id == user_id, counter_date == today)
        .values({counter: case((counter >= units, counter - units), else_=0)})
    )
    db.commit()


def claim_chat(db, user, units: int = 1) -> bool:
    if not _claim_service_daily(db, DailySpendBudget.chat_units, DAILY_SERVICE_CHAT_LIMIT, units):
        return False
    claimed = _claim_daily(
        db,
        user,
        counter=User.chat_count_today,
        counter_date=User.chat_count_date,
        limit=DAILY_CHAT_LIMIT,
        units=units,
    )
    if not claimed:
        _refund_service_daily(db, DailySpendBudget.chat_units, units)
    return claimed


def refund_chat(db, user_id: int, units: int = 1) -> None:
    _refund_daily(
        db,
        user_id,
        counter=User.chat_count_today,
        counter_date=User.chat_count_date,
        units=units,
    )
    _refund_service_daily(db, DailySpendBudget.chat_units, units)


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
    if not _claim_service_daily(
        db,
        DailySpendBudget.transcription_units,
        DAILY_SERVICE_TRANSCRIBE_LIMIT,
        1,
    ):
        return False
    if is_transcribe_limit_bypassed(user):
        return True

    claimed = _claim_daily(
        db,
        user,
        counter=User.transcribe_count_today,
        counter_date=User.transcribe_count_date,
        limit=DAILY_TRANSCRIBE_LIMIT,
    )
    if not claimed:
        _refund_service_daily(db, DailySpendBudget.transcription_units, 1)
    return claimed


def claim_transcription_seconds(db, user, seconds: int) -> bool:
    units = max(1, int(seconds))
    return _claim_daily(
        db,
        user,
        counter=User.transcribe_seconds_today,
        counter_date=User.transcribe_seconds_date,
        limit=DAILY_TRANSCRIBE_SECONDS_LIMIT,
        units=units,
    )


# ─── API token lifetime ───────────────────────────────────────────────────────

API_TOKEN_TTL_DAYS = int(os.getenv('API_TOKEN_TTL_DAYS', '30'))


def is_labs_allowed(user) -> bool:
    """
    Whether this account may unlock the lab features.

    Lab access gates transcription and brain builds, which spend real money, so it is an
    operator decision held in env rather than something a request can grant itself. The
    unlock used to be a five-tap gesture in the app with no server check at all — and the
    gesture is in a public repo.

    Empty allowlist means nobody new can unlock. Accounts already unlocked keep working;
    this only governs granting it.
    """
    allowed = {u.strip() for u in os.getenv("LABS_ALLOWED_USERS", "").split(",") if u.strip()}
    if not allowed:
        return False
    keys = {
        getattr(user, 'username', '') or "",
        getattr(user, 'moodle_username', '') or "",
    }
    return any(k in allowed for k in keys if k)
