import hashlib
import logging
from datetime import datetime, timedelta
from http.cookies import SimpleCookie

import pytest
from sqlalchemy.exc import IntegrityError
from starlette.responses import Response

import api
import auth_service
from database import User, WebLoginTicket, WebSession


MOODLE_UID = 73142
USERNAME = f"moodle_{MOODLE_UID}"
NATIVE_TOKEN = "native-token-that-must-survive"
KEYLESS_COOKIE_SECRET = "keyless-device-cookie-secret"
CAPTURED_COOKIES = f"MoodleSession=captured-session; {KEYLESS_COOKIE_SECRET}"
ALLOWED_ORIGIN = "http://testserver"
SESSION_COOKIE_NAME = "luconnect_session"
LOGIN_COOKIE_NAME = "luconnect_login"


class _MoodleSession:
    def get(self, *_args, **_kwargs):
        return type("Response", (), {"url": "https://ys.learnus.org/my/"})()


class _VerifiedMoodleClient:
    captured_cookie_dicts = []

    def __init__(self, _base_url, cookies=None):
        self.captured_cookie_dicts.append(cookies)
        self.session = _MoodleSession()

    def is_session_valid(self):
        return True

    def get_user_id(self):
        return MOODLE_UID


class _RejectedMoodleClient(_VerifiedMoodleClient):
    def is_session_valid(self):
        return False

    def get_user_id(self):
        return None


class _MissingCanonicalMoodleClient(_VerifiedMoodleClient):
    def get_user_id(self):
        return None


class _RaceQuery:
    def __init__(self, result):
        self.result = result

    def filter(self, *_args):
        return self

    def first(self):
        return self.result

    def one(self):
        return self.result


class _NestedTransaction:
    def __enter__(self):
        return self

    def __exit__(self, _exc_type, _exc, _traceback):
        return False


class _ConcurrentUserInsertSession:
    """Minimal session double for a unique-key race resolved by another request."""

    def __init__(self, winner):
        self.winner = winner
        self.query_count = 0
        self.flush_count = 0
        self.added = []

    def query(self, _model):
        self.query_count += 1
        return _RaceQuery(None if self.query_count == 1 else self.winner)

    def begin_nested(self):
        return _NestedTransaction()

    def add(self, value):
        self.added.append(value)

    def flush(self):
        self.flush_count += 1
        if self.flush_count == 1:
            raise IntegrityError("INSERT INTO users", {}, Exception("duplicate username"))


@pytest.fixture(autouse=True)
def _web_auth_configuration(monkeypatch):
    """Keep browser-cookie behavior deterministic under TestClient's HTTP origin."""
    monkeypatch.setenv("WEB_SESSION_COOKIE_NAME", SESSION_COOKIE_NAME)
    monkeypatch.setenv("WEB_SESSION_COOKIE_SECURE", "false")
    monkeypatch.setenv("WEB_ALLOWED_ORIGINS", ALLOWED_ORIGIN)
    _VerifiedMoodleClient.captured_cookie_dicts.clear()
    api.limiter._storage.reset()
    yield
    api.limiter._storage.reset()


@pytest.fixture()
def web_user(db):
    issued_at = datetime.now() - timedelta(hours=1)
    user = User(
        username=USERNAME,
        moodle_username=str(MOODLE_UID),
        api_token=NATIVE_TOKEN,
        token_issued_at=issued_at,
        moodle_cookies="MoodleSession=older-session",
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def test_user_upsert_recovers_when_another_first_login_wins_the_insert():
    winner = User(username=USERNAME, moodle_username=str(MOODLE_UID))
    race_db = _ConcurrentUserInsertSession(winner)

    result = auth_service.upsert_moodle_user(
        race_db,
        MOODLE_UID,
        CAPTURED_COOKIES,
        issue_native_token=True,
    )

    assert result is winner
    assert winner.moodle_cookies == CAPTURED_COOKIES
    assert winner.api_token
    assert winner.token_issued_at is not None
    assert race_db.query_count == 2
    assert race_db.flush_count == 2


def _exchange(client, monkeypatch):
    monkeypatch.setattr(auth_service, "MoodleClient", _VerifiedMoodleClient)
    response = client.post(
        "/auth/extension/exchange",
        json={"cookies": CAPTURED_COOKIES},
    )
    assert response.status_code == 200, response.text
    body = response.json()
    assert "api_token" not in body
    assert "cookies" not in body
    assert response.headers["cache-control"] == "no-store"
    ticket = body.get("ticket")
    assert isinstance(ticket, str) and ticket
    assert "set-cookie" not in response.headers
    return ticket


def _bind_ticket(client, ticket):
    # The extension sets this cookie locally; the exchange response cannot set it.
    client.cookies.set(LOGIN_COOKIE_NAME, ticket, domain="testserver.local", path="/")


def _complete(client, ticket):
    _bind_ticket(client, ticket)
    response = client.post(
        "/auth/extension/complete",
        json={"ticket": ticket},
        headers={"Origin": ALLOWED_ORIGIN},
    )
    assert response.status_code == 200, response.text
    assert response.headers["cache-control"] == "no-store"
    return response


def _session_cookie(response):
    cookies = SimpleCookie()
    for header in response.headers.get_list("set-cookie"):
        cookies.load(header)
    return cookies[SESSION_COOKIE_NAME]


def test_production_web_session_cookie_is_host_only_secure_and_strict(monkeypatch):
    monkeypatch.delenv("WEB_SESSION_COOKIE_NAME")
    monkeypatch.delenv("WEB_SESSION_COOKIE_SECURE")
    monkeypatch.delenv("WEB_SESSION_TTL_DAYS", raising=False)
    response = Response()

    auth_service.set_web_session_cookie(response, "raw-browser-session")

    cookies = SimpleCookie()
    cookies.load(response.headers["set-cookie"])
    morsel = cookies["__Host-luconnect_session"]
    assert morsel.value == "raw-browser-session"
    assert morsel["httponly"] is True
    assert morsel["secure"] is True
    assert morsel["path"] == "/"
    assert morsel["samesite"].lower() == "strict"
    assert morsel["domain"] == ""
    assert morsel["max-age"] == str(7 * 24 * 60 * 60)


def test_extension_exchange_derives_owner_and_stores_only_ticket_hash(
    client,
    db,
    monkeypatch,
    web_user,
    caplog,
):
    original_issued_at = web_user.token_issued_at
    caplog.set_level(logging.INFO)

    raw_ticket = _exchange(client, monkeypatch)

    row = db.query(WebLoginTicket).one()
    assert row.user_id == web_user.id
    assert row.token_hash == hashlib.sha256(raw_ticket.encode()).hexdigest()
    assert row.token_hash != raw_ticket
    assert row.consumed_at is None
    assert datetime.now() < row.expires_at <= datetime.now() + timedelta(minutes=10)
    assert _VerifiedMoodleClient.captured_cookie_dicts == [
        {"MoodleSession": "captured-session", KEYLESS_COOKIE_SECRET: ""}
    ]

    db.refresh(web_user)
    assert web_user.username == USERNAME
    assert web_user.moodle_cookies == CAPTURED_COOKIES
    assert web_user.api_token == NATIVE_TOKEN
    assert web_user.token_issued_at == original_issued_at
    assert raw_ticket not in row.token_hash
    assert "captured-session" not in caplog.text
    assert KEYLESS_COOKIE_SECRET not in caplog.text
    assert raw_ticket not in caplog.text


def test_extension_exchange_rejects_unverified_moodle_session(
    client,
    db,
    monkeypatch,
):
    monkeypatch.setattr(auth_service, "MoodleClient", _RejectedMoodleClient)

    response = client.post(
        "/auth/extension/exchange",
        json={"cookies": CAPTURED_COOKIES},
    )

    assert response.status_code == 401
    assert "ticket" not in response.json()
    assert db.query(WebLoginTicket).count() == 0
    assert db.query(WebSession).count() == 0
    assert db.query(User).filter(User.username == USERNAME).count() == 0


def test_extension_exchange_rejects_session_without_canonical_user_id(
    client,
    db,
    monkeypatch,
):
    monkeypatch.setattr(auth_service, "MoodleClient", _MissingCanonicalMoodleClient)

    response = client.post(
        "/auth/extension/exchange",
        json={"cookies": CAPTURED_COOKIES},
    )

    assert response.status_code == 401
    assert db.query(WebLoginTicket).count() == 0
    assert db.query(WebSession).count() == 0
    assert db.query(User).filter(User.username == USERNAME).count() == 0


@pytest.mark.parametrize(
    "cookies",
    [
        "",
        "device_binding=present",
        "MoodleSession=",
        "MoodleSession=deleted",
        f"MoodleSession={'x' * 32_768}",
    ],
)
def test_extension_exchange_rejects_missing_or_malformed_moodle_cookie(client, db, cookies):
    response = client.post("/auth/extension/exchange", json={"cookies": cookies})

    assert response.status_code in {401, 422}
    if cookies:
        assert cookies not in response.text
    assert db.query(WebLoginTicket).count() == 0
    assert db.query(WebSession).count() == 0


def test_extension_exchange_rejects_client_supplied_user_id(client):
    response = client.post(
        "/auth/extension/exchange",
        json={"cookies": CAPTURED_COOKIES, "user_id": 12345},
    )

    assert response.status_code == 422


def test_extension_completion_validation_does_not_echo_ticket(client):
    raw_ticket = "secret-ticket-that-is-too-short"

    response = client.post(
        "/auth/extension/complete",
        json={"ticket": raw_ticket},
        headers={"Origin": ALLOWED_ORIGIN},
    )

    assert response.status_code == 422
    assert raw_ticket not in response.text


def test_extension_complete_consumes_once_and_hashes_browser_session(
    client,
    db,
    monkeypatch,
    web_user,
):
    raw_ticket = _exchange(client, monkeypatch)

    response = _complete(client, raw_ticket)

    assert response.json()["username"] == USERNAME
    assert "api_token" not in response.json()
    assert LOGIN_COOKIE_NAME not in client.cookies
    morsel = _session_cookie(response)
    raw_session = morsel.value
    assert raw_session
    assert morsel["httponly"] is True
    assert morsel["path"] == "/"
    assert morsel["samesite"].lower() == "strict"
    assert morsel["domain"] == ""
    assert not morsel["secure"]

    ticket = db.query(WebLoginTicket).one()
    session = db.query(WebSession).one()
    assert ticket.consumed_at is not None
    assert session.user_id == web_user.id
    assert session.token_hash == hashlib.sha256(raw_session.encode()).hexdigest()
    assert session.token_hash != raw_session
    assert session.revoked_at is None
    assert session.expires_at > datetime.now()

    _bind_ticket(client, raw_ticket)
    replay = client.post(
        "/auth/extension/complete",
        json={"ticket": raw_ticket},
        headers={"Origin": ALLOWED_ORIGIN},
    )
    assert replay.status_code in {401, 409, 410}
    assert db.query(WebSession).count() == 1


def test_extension_complete_rejects_expired_ticket(
    client,
    db,
    monkeypatch,
    web_user,
):
    raw_ticket = _exchange(client, monkeypatch)
    _bind_ticket(client, raw_ticket)
    ticket = db.query(WebLoginTicket).one()
    ticket.expires_at = datetime.now() - timedelta(seconds=1)
    db.commit()

    response = client.post(
        "/auth/extension/complete",
        json={"ticket": raw_ticket},
        headers={"Origin": ALLOWED_ORIGIN},
    )

    assert response.status_code in {401, 410}
    assert db.query(WebSession).count() == 0
    db.refresh(ticket)
    assert ticket.consumed_at is None


@pytest.mark.parametrize("binding", [None, "other-browser-ticket"])
def test_completion_rejects_a_copied_link_without_consuming_it(
    client, db, monkeypatch, web_user, binding,
):
    raw_ticket = _exchange(client, monkeypatch)
    if binding is not None:
        _bind_ticket(client, binding)

    response = client.post(
        "/auth/extension/complete",
        json={"ticket": raw_ticket},
        headers={"Origin": ALLOWED_ORIGIN},
    )

    assert response.status_code == 401
    assert response.headers["cache-control"] == "no-store"
    assert raw_ticket not in response.text
    assert db.query(WebSession).count() == 0
    assert db.query(WebLoginTicket).one().consumed_at is None
    assert _complete(client, raw_ticket).status_code == 200


@pytest.mark.parametrize("binding", [None, "", "다른-브라우저", "x" * 513])
def test_malformed_browser_binding_fails_closed(binding):
    assert not auth_service.matches_web_login_cookie("valid-ticket", binding)


def test_copied_login_link_cannot_replace_an_existing_browser_account(
    client, db, monkeypatch, web_user, test_user,
):
    victim_session = WebSession(
        user_id=test_user.id,
        token_hash=auth_service.hash_secret("victim-browser-session"),
        expires_at=datetime.now() + timedelta(days=1),
    )
    db.add(victim_session)
    db.commit()
    raw_ticket = _exchange(client, monkeypatch)
    client.cookies.set(
        SESSION_COOKIE_NAME, "victim-browser-session", domain="testserver.local", path="/",
    )

    response = client.post(
        "/auth/extension/complete",
        json={"ticket": raw_ticket},
        headers={"Origin": ALLOWED_ORIGIN},
    )

    assert response.status_code == 401
    assert "set-cookie" not in response.headers
    assert client.get("/auth/web-session").json()["username"] == test_user.username
    assert db.query(WebSession).count() == 1
    assert db.query(WebLoginTicket).one().consumed_at is None


def test_login_binding_cookie_uses_the_host_prefix_and_is_cleared_securely(monkeypatch):
    monkeypatch.setenv("WEB_SESSION_COOKIE_SECURE", "true")
    response = Response()

    auth_service.clear_web_login_cookie(response)

    cookies = SimpleCookie()
    cookies.load(response.headers["set-cookie"])
    morsel = cookies["__Host-luconnect_login"]
    assert morsel["max-age"] == "0"
    assert morsel["path"] == "/"
    assert morsel["domain"] == ""
    assert morsel["httponly"] is True
    assert morsel["secure"] is True
    assert morsel["samesite"] == "strict"


def test_extension_complete_requires_the_exact_web_origin(
    client,
    monkeypatch,
    web_user,
):
    raw_ticket = _exchange(client, monkeypatch)

    assert client.post(
        "/auth/extension/complete",
        json={"ticket": raw_ticket},
    ).status_code == 403
    assert client.post(
        "/auth/extension/complete",
        json={"ticket": raw_ticket},
        headers={"Origin": "http://testserver.evil.example"},
    ).status_code == 403
    assert _complete(client, raw_ticket).status_code == 200


def test_web_cors_allows_only_the_configured_origin(client):
    allowed = client.options(
        "/auth/extension/complete",
        headers={
            "Origin": ALLOWED_ORIGIN,
            "Access-Control-Request-Method": "POST",
        },
    )
    denied = client.options(
        "/auth/extension/complete",
        headers={
            "Origin": "https://evil.example",
            "Access-Control-Request-Method": "POST",
        },
    )

    assert allowed.status_code == 200
    assert allowed.headers["access-control-allow-origin"] == ALLOWED_ORIGIN
    assert allowed.headers["access-control-allow-credentials"] == "true"
    assert denied.status_code == 400


def test_web_cors_allows_sse_client_headers(client):
    response = client.options(
        "/vods/123/chat/stream",
        headers={
            "Origin": ALLOWED_ORIGIN,
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "content-type,x-requested-with",
        },
    )

    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == ALLOWED_ORIGIN
    assert response.headers["access-control-allow-credentials"] == "true"
    allowed_headers = response.headers["access-control-allow-headers"].lower()
    assert "content-type" in allowed_headers
    assert "x-requested-with" in allowed_headers


def test_browser_cookie_authenticates_web_session_and_protected_routes(
    client,
    monkeypatch,
    web_user,
):
    response = _complete(client, _exchange(client, monkeypatch))
    assert _session_cookie(response).value

    session_response = client.get("/auth/web-session")
    assert session_response.status_code == 200
    assert session_response.json()["username"] == USERNAME
    assert client.get("/courses").status_code == 200


def test_expired_and_revoked_browser_sessions_are_rejected(
    client,
    db,
    monkeypatch,
    web_user,
):
    _complete(client, _exchange(client, monkeypatch))
    session = db.query(WebSession).one()

    session.expires_at = datetime.now() - timedelta(seconds=1)
    db.commit()
    assert client.get("/auth/web-session").status_code == 401

    session.expires_at = datetime.now() + timedelta(days=1)
    session.revoked_at = datetime.now()
    db.commit()
    assert client.get("/auth/web-session").status_code == 401


def test_invalid_header_does_not_fall_back_to_valid_browser_cookie(
    client,
    monkeypatch,
    web_user,
):
    _complete(client, _exchange(client, monkeypatch))

    for token in ("invalid-native-token", ""):
        response = client.get(
            "/courses",
            headers={"X-API-Token": token},
        )

        assert response.status_code == 401
        assert "invalid" in response.json()["detail"].lower()


def test_unsafe_browser_requests_require_the_exact_allowed_origin(
    client,
    monkeypatch,
    web_user,
):
    _complete(client, _exchange(client, monkeypatch))
    payload = {"new_assignment": False, "new_vod": True, "notice": False}

    assert client.post("/auth/preferences", json=payload).status_code == 403
    assert client.post(
        "/auth/preferences",
        json=payload,
        headers={"Origin": "https://testserver"},
    ).status_code == 403
    assert client.post(
        "/auth/preferences",
        json=payload,
        headers={"Origin": ALLOWED_ORIGIN},
    ).status_code == 200

    native_response = client.post(
        "/auth/preferences",
        json=payload,
        headers={"X-API-Token": NATIVE_TOKEN},
    )
    assert native_response.status_code == 200


def test_browser_logout_revokes_only_current_session(
    client,
    db,
    monkeypatch,
    web_user,
):
    completion = _complete(client, _exchange(client, monkeypatch))
    current_session_hash = hashlib.sha256(
        _session_cookie(completion).value.encode()
    ).hexdigest()
    other_session = WebSession(
        user_id=web_user.id,
        token_hash=hashlib.sha256(b"other-browser-session").hexdigest(),
        created_at=datetime.now(),
        expires_at=datetime.now() + timedelta(days=1),
    )
    db.add(other_session)
    db.commit()
    captured_cookies = web_user.moodle_cookies
    issued_at = web_user.token_issued_at

    response = client.post(
        "/auth/logout",
        headers={"Origin": ALLOWED_ORIGIN},
    )

    assert response.status_code == 200
    current_session = db.query(WebSession).filter(
        WebSession.token_hash == current_session_hash
    ).one()
    assert current_session.revoked_at is not None
    db.refresh(other_session)
    assert other_session.revoked_at is None
    db.refresh(web_user)
    assert web_user.api_token == NATIVE_TOKEN
    assert web_user.token_issued_at == issued_at
    assert web_user.moodle_cookies == captured_cookies

    assert client.get("/auth/web-session").status_code == 401
    assert client.get(
        "/courses",
        headers={"X-API-Token": NATIVE_TOKEN},
    ).status_code == 200


def test_native_logout_preserves_an_active_browser_session(
    client,
    db,
    monkeypatch,
    web_user,
):
    _complete(client, _exchange(client, monkeypatch))
    captured_cookies = web_user.moodle_cookies

    response = client.post(
        "/auth/logout",
        headers={"X-API-Token": NATIVE_TOKEN},
    )

    assert response.status_code == 200
    db.refresh(web_user)
    assert web_user.api_token is None
    assert web_user.moodle_cookies == captured_cookies
    assert client.get("/auth/web-session").status_code == 200


def test_last_browser_logout_clears_stored_moodle_session(
    client,
    db,
    monkeypatch,
    web_user,
):
    web_user.api_token = None
    web_user.token_issued_at = None
    db.commit()
    _complete(client, _exchange(client, monkeypatch))

    response = client.post(
        "/auth/logout",
        headers={"Origin": ALLOWED_ORIGIN},
    )

    assert response.status_code == 200
    db.refresh(web_user)
    assert web_user.moodle_cookies is None
