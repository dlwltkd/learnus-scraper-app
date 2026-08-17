"""
Access control around the course brain, and the session-sync authentication bypass.

These are regression tests for real holes that existed, not hypotheticals:

* `/auth/sync-session` trusted a `user_id` supplied in the request body and skipped
  session validation whenever it was present, so anyone could mint a working API token
  for any account whose Moodle ID they could guess.
* Every brain surface checked `brain_enabled` alone, so an account whose lab access had
  been revoked kept working off the stale flag.
"""
from database import Course, User


def test_sync_session_rejects_claimed_user_id_without_valid_session(client):
    """
    The account must come from the session, never from the request body.

    A request carrying junk cookies and someone else's Moodle ID must not return a
    token. This is the bypass that previously granted full account takeover.
    """
    resp = client.post(
        "/auth/sync-session",
        json={"cookies": "MoodleSession=not-a-real-session", "user_id": "585309"},
    )

    assert resp.status_code == 401
    assert "api_token" not in resp.json()


def test_sync_session_requires_cookies(client):
    resp = client.post("/auth/sync-session", json={"cookies": ""})
    assert resp.status_code == 400


def _brain_routes(course_id: int) -> list[tuple[str, str]]:
    """Every surface that exposes learned course content or spends money."""
    return [
        ("get", f"/courses/{course_id}/library"),
        ("get", f"/courses/{course_id}/library/file/1"),
        ("get", f"/courses/{course_id}/brain/status"),
        ("get", "/brain/courses"),
        ("put", f"/courses/{course_id}/brain"),
        ("post", f"/courses/{course_id}/brain/rebuild"),
        ("post", f"/courses/{course_id}/brain/learn/file/1"),
        ("get", "/files/1/page/1"),
    ]


def _call(client, method: str, url: str, headers):
    if method == "put":
        return client.put(url, json={"enabled": True}, headers=headers)
    if method == "post":
        return client.post(url, json={}, headers=headers)
    return client.get(url, headers=headers)


def test_brain_routes_require_authentication(client, db, test_user):
    course = Course(moodle_id=1, owner_id=test_user.id, name="Test")
    db.add(course)
    db.commit()

    for method, url in _brain_routes(course.id):
        resp = _call(client, method, url, headers={})
        assert resp.status_code == 401, f"{method.upper()} {url} allowed anonymous access"


def test_brain_routes_blocked_without_labs_unlocked(client, db, auth_headers, test_user):
    """brain_enabled alone is not enough — a re-locked account must lose access."""
    course = Course(moodle_id=1, owner_id=test_user.id, name="Test")
    db.add(course)
    test_user.brain_enabled = True
    test_user.labs_unlocked = False
    db.commit()

    for method, url in _brain_routes(course.id):
        resp = _call(client, method, url, headers=auth_headers)
        assert resp.status_code == 403, f"{method.upper()} {url} served a re-locked account"


def test_brain_routes_blocked_when_brain_disabled(client, db, auth_headers, test_user):
    course = Course(moodle_id=1, owner_id=test_user.id, name="Test")
    db.add(course)
    test_user.labs_unlocked = True
    test_user.brain_enabled = False
    db.commit()

    for method, url in _brain_routes(course.id):
        resp = _call(client, method, url, headers=auth_headers)
        assert resp.status_code == 403, f"{method.upper()} {url} served a disabled brain"


def test_brain_cannot_reach_another_users_course(client, db, auth_headers, test_user):
    """Course ownership is enforced, so a valid token cannot read a stranger's material."""
    other = User(username="someone_else", api_token="other-token")
    db.add(other)
    db.commit()
    their_course = Course(moodle_id=999, owner_id=other.id, name="Not Yours")
    db.add(their_course)
    test_user.labs_unlocked = True
    test_user.brain_enabled = True
    db.commit()

    for method, url in _brain_routes(their_course.id):
        if url in ("/brain/courses",):
            continue  # scoped to the caller by construction, no id to confuse
        resp = _call(client, method, url, headers=auth_headers)
        assert resp.status_code == 404, f"{method.upper()} {url} leaked another user's course"
