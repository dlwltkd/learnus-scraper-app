from unittest.mock import patch


class _AuthenticatedMoodleClient:
    def __init__(self, base_url):
        self.session = type(
            "Session",
            (),
            {"cookies": type("Cookies", (), {"get_dict": lambda self: {"MoodleSession": "abc"}})()},
        )()

    def login(self, username, password):
        return None


def test_missing_token_returns_401(client):
    resp = client.get("/courses")
    assert resp.status_code == 401
    assert "Missing" in resp.json()["detail"]


def test_invalid_token_returns_401(client, test_user):
    resp = client.get("/courses", headers={"X-API-Token": "bad-token"})
    assert resp.status_code == 401
    assert "Invalid" in resp.json()["detail"]


def test_valid_token_returns_200(client, test_user, auth_headers):
    resp = client.get("/courses", headers=auth_headers)
    assert resp.status_code == 200


def test_push_token_registration(client, test_user, auth_headers):
    resp = client.post(
        "/auth/push-token",
        json={"token": "ExponentPushToken[xxxxx]"},
        headers=auth_headers,
    )
    assert resp.status_code == 200
    assert resp.json()["status"] == "success"


def test_push_token_empty_rejected(client, test_user, auth_headers):
    resp = client.post(
        "/auth/push-token",
        json={"token": ""},
        headers=auth_headers,
    )
    assert resp.status_code == 400


def test_preferences_update(client, test_user, auth_headers):
    resp = client.post(
        "/auth/preferences",
        json={"new_assignment": False, "new_vod": True, "notice": False},
        headers=auth_headers,
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "success"
    prefs = data["preferences"]
    assert prefs["new_assignment"] is False
    assert prefs["new_vod"] is True
    assert prefs["notice"] is False


def test_sync_session_no_cookies(client):
    resp = client.post("/auth/sync-session", json={"cookies": ""})
    assert resp.status_code == 400


def test_login_does_not_persist_plaintext_password(client, db):
    with patch("api.MoodleClient", _AuthenticatedMoodleClient):
        resp = client.post(
            "/auth/login",
            json={"username": "new-user", "password": "plaintext-secret"},
        )

    assert resp.status_code == 200
    from database import User

    user = db.query(User).filter(User.username == "new-user").one()
    assert user.moodle_password is None
    assert "plaintext-secret" not in user.moodle_cookies
