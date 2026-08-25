"""Authentication boundaries shared by native SSO sync and browser sessions."""

from __future__ import annotations

import hashlib
import logging
import os
import secrets
import uuid
from dataclasses import dataclass
from datetime import datetime, timedelta

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from starlette.responses import Response

from database import User, WebLoginTicket, WebSession
from moodle_client import MoodleClient
from parsing import parse_cookie_string


logger = logging.getLogger(__name__)

MOODLE_BASE_URL = "https://ys.learnus.org"
MAX_MOODLE_COOKIE_LENGTH = 32_768


class InvalidMoodleSession(Exception):
    pass


class InvalidWebLoginTicket(Exception):
    pass


class ExpiredWebLoginTicket(Exception):
    pass


class ConsumedWebLoginTicket(Exception):
    pass


@dataclass(frozen=True)
class VerifiedMoodleSession:
    client: MoodleClient
    user_id: int


def _bounded_int_env(name: str, default: int, minimum: int, maximum: int) -> int:
    try:
        value = int(os.getenv(name, str(default)))
    except (TypeError, ValueError):
        return default
    return max(minimum, min(value, maximum))


def web_login_ticket_ttl_seconds() -> int:
    return _bounded_int_env("WEB_LOGIN_TICKET_TTL_SECONDS", 90, 30, 300)


def web_session_ttl_days() -> int:
    return _bounded_int_env("WEB_SESSION_TTL_DAYS", 7, 1, 30)


def web_session_cookie_secure() -> bool:
    return os.getenv("WEB_SESSION_COOKIE_SECURE", "true").lower() == "true"


def web_session_cookie_name() -> str:
    return os.getenv("WEB_SESSION_COOKIE_NAME", "__Host-luconnect_session")


def allowed_web_origins() -> set[str]:
    configured = os.getenv("WEB_ALLOWED_ORIGINS", "https://luconnect.dlwltkd.com")
    return {origin.strip().rstrip("/") for origin in configured.split(",") if origin.strip()}


def set_web_session_cookie(response: Response, raw_session: str) -> None:
    response.set_cookie(
        key=web_session_cookie_name(),
        value=raw_session,
        max_age=web_session_ttl_days() * 24 * 60 * 60,
        path="/",
        secure=web_session_cookie_secure(),
        httponly=True,
        samesite="strict",
    )


def clear_web_session_cookie(response: Response) -> None:
    response.delete_cookie(
        key=web_session_cookie_name(),
        path="/",
        secure=web_session_cookie_secure(),
        httponly=True,
        samesite="strict",
    )


def hash_secret(secret: str) -> str:
    return hashlib.sha256(secret.encode("utf-8")).hexdigest()


def verify_moodle_cookie_session(raw_cookies: str) -> VerifiedMoodleSession:
    """Validate captured LearnUs cookies and derive the account from Moodle itself."""
    if not raw_cookies or len(raw_cookies) > MAX_MOODLE_COOKIE_LENGTH:
        raise InvalidMoodleSession

    cookies = parse_cookie_string(raw_cookies)
    if (
        len(cookies) > 64
        or any(not name or len(name) > 256 for name in cookies)
        or any(len(value) > 8_192 for value in cookies.values())
    ):
        raise InvalidMoodleSession
    moodle_session = cookies.get("MoodleSession", "")
    if not moodle_session or moodle_session.lower() == "deleted":
        raise InvalidMoodleSession

    # A keyless browser cookie is represented by its value as the dictionary key, so
    # even logging "keys only" can disclose live device-binding material.
    logger.info(
        "SSO session validation: cookie_count=%s moodle_session_present=%s",
        len(cookies),
        bool(moodle_session),
    )
    try:
        client = MoodleClient(MOODLE_BASE_URL, cookies=cookies)
        if not client.is_session_valid():
            raise InvalidMoodleSession
        user_id = client.get_user_id()
    except InvalidMoodleSession:
        raise
    except Exception:
        logger.warning("SSO session validation failed at the LearnUs boundary")
        raise InvalidMoodleSession

    if isinstance(user_id, bool) or not isinstance(user_id, int) or user_id <= 0:
        raise InvalidMoodleSession
    return VerifiedMoodleSession(client=client, user_id=user_id)


def upsert_moodle_user(
    db: Session,
    moodle_user_id: int,
    raw_cookies: str,
    *,
    issue_native_token: bool,
) -> User:
    """Persist a verified Moodle session without widening the caller's auth scope."""
    username = f"moodle_{moodle_user_id}"
    user = db.query(User).filter(User.username == username).first()
    if user is None:
        candidate = User(username=username, moodle_username=str(moodle_user_id))
        try:
            # Two first logins for one Moodle account can arrive together. Keep the
            # unique-key retry inside a savepoint so the caller's ticket transaction
            # remains usable and remote validation is not repeated.
            with db.begin_nested():
                db.add(candidate)
                db.flush()
            user = candidate
        except IntegrityError:
            user = db.query(User).filter(User.username == username).one()

    user.moodle_username = str(moodle_user_id)
    user.moodle_password = None
    user.moodle_cookies = raw_cookies
    user.session_expired_notified = False

    if issue_native_token:
        if not user.api_token:
            user.api_token = str(uuid.uuid4())
        user.token_issued_at = datetime.now()

    db.flush()
    return user


def issue_web_login_ticket(db: Session, user: User) -> tuple[str, WebLoginTicket]:
    raw_ticket = secrets.token_urlsafe(32)
    now = datetime.now()
    ticket = WebLoginTicket(
        user_id=user.id,
        token_hash=hash_secret(raw_ticket),
        created_at=now,
        expires_at=now + timedelta(seconds=web_login_ticket_ttl_seconds()),
    )
    db.add(ticket)
    db.flush()
    return raw_ticket, ticket


def consume_web_login_ticket(db: Session, raw_ticket: str) -> tuple[str, WebSession, User]:
    """Atomically consume one ticket and create a browser session."""
    if not raw_ticket or len(raw_ticket) > 512:
        raise InvalidWebLoginTicket

    now = datetime.now()
    ticket = db.query(WebLoginTicket).filter(
        WebLoginTicket.token_hash == hash_secret(raw_ticket)
    ).first()
    if ticket is None:
        raise InvalidWebLoginTicket
    if ticket.consumed_at is not None:
        raise ConsumedWebLoginTicket
    if ticket.expires_at <= now:
        raise ExpiredWebLoginTicket

    updated = db.query(WebLoginTicket).filter(
        WebLoginTicket.id == ticket.id,
        WebLoginTicket.consumed_at.is_(None),
        WebLoginTicket.expires_at > now,
    ).update({WebLoginTicket.consumed_at: now}, synchronize_session=False)
    if updated != 1:
        db.rollback()
        raise ConsumedWebLoginTicket

    raw_session = secrets.token_urlsafe(32)
    web_session = WebSession(
        user_id=ticket.user_id,
        token_hash=hash_secret(raw_session),
        created_at=now,
        expires_at=now + timedelta(days=web_session_ttl_days()),
    )
    db.add(web_session)
    db.flush()
    user = db.query(User).filter(User.id == ticket.user_id).one()
    return raw_session, web_session, user


def authenticate_web_session(db: Session, raw_session: str) -> tuple[WebSession, User] | None:
    if not raw_session or len(raw_session) > 512:
        return None
    now = datetime.now()
    web_session = db.query(WebSession).filter(
        WebSession.token_hash == hash_secret(raw_session),
        WebSession.revoked_at.is_(None),
        WebSession.expires_at > now,
    ).first()
    if web_session is None:
        return None
    user = db.query(User).filter(User.id == web_session.user_id).first()
    if user is None:
        return None
    return web_session, user


def has_active_web_session(db: Session, user_id: int) -> bool:
    return db.query(WebSession.id).filter(
        WebSession.user_id == user_id,
        WebSession.revoked_at.is_(None),
        WebSession.expires_at > datetime.now(),
    ).first() is not None
