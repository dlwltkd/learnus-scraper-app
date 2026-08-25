import logging

import requests
from api import _parse_cookie_string
from moodle_client import MoodleClient
from requests import Request


def test_standard_cookies():
    result = _parse_cookie_string("MoodleSession=abc123; MOODLEID1_=xyz")
    assert result == {"MoodleSession": "abc123", "MOODLEID1_": "xyz"}


def test_keyless_token():
    result = _parse_cookie_string("MoodleSession=abc; some_device_uuid")
    assert result["MoodleSession"] == "abc"
    assert "some_device_uuid" in result
    assert result["some_device_uuid"] == ""


def test_empty_string():
    assert _parse_cookie_string("") == {}


def test_whitespace_handling():
    result = _parse_cookie_string(" key = value ; key2=val2 ")
    assert result["key"] == "value"
    assert result["key2"] == "val2"


def test_value_with_equals():
    result = _parse_cookie_string("token=abc=def=ghi")
    assert result["token"] == "abc=def=ghi"


def test_captured_cookies_are_scoped_to_the_learnus_origin():
    client = MoodleClient("https://ys.learnus.org")
    client.refresh_sesskey = lambda: None
    client.set_cookies({"MoodleSession": "secret-session"})

    learnus_request = client.session.prepare_request(
        Request("GET", "https://ys.learnus.org/my/")
    )
    external_request = client.session.prepare_request(
        Request("GET", "https://example.com/")
    )
    sibling_request = client.session.prepare_request(
        Request("GET", "https://other.ys.learnus.org/")
    )
    downgrade_request = client.session.prepare_request(
        Request("GET", "http://ys.learnus.org/my/")
    )

    assert "MoodleSession=secret-session" in learnus_request.headers.get("Cookie", "")
    assert "MoodleSession" not in external_request.headers.get("Cookie", "")
    assert "MoodleSession" not in sibling_request.headers.get("Cookie", "")
    assert "MoodleSession" not in downgrade_request.headers.get("Cookie", "")
    assert all(cookie.secure for cookie in client.session.cookies)


def test_redirect_prepared_request_cannot_bypass_cookie_origin_guard(monkeypatch):
    client = MoodleClient("https://ys.learnus.org")
    prepared = Request("GET", "https://other.ys.learnus.org/").prepare()
    prepared.headers["Cookie"] = "MoodleSession=secret-session"

    monkeypatch.setattr(requests.Session, "send", lambda _session, request, **_kwargs: request)

    sent = client.session.send(prepared)
    assert "Cookie" not in sent.headers


class _Response:
    def __init__(self, url, text, status_code=200):
        self.url = url
        self.text = text
        self.status_code = status_code
        self.headers = {"content-type": "text/html"}


def test_session_validation_requires_an_authenticated_page_on_exact_origin():
    client = MoodleClient("https://ys.learnus.org")

    client.session.get = lambda *_args, **_kwargs: _Response(
        "https://ys.learnus.org/my/",
        '<a href="/login/logout.php?sesskey=present">Logout</a>',
    )
    assert client.is_session_valid() is True

    client.session.get = lambda *_args, **_kwargs: _Response(
        "https://ys.learnus.org/my/",
        "<html>public page</html>",
    )
    assert client.is_session_valid() is False

    client.session.get = lambda *_args, **_kwargs: _Response(
        "https://sso.yonsei.ac.kr/saml/continue?client_id=12345",
        '<a href="/login/logout.php">misleading marker</a>',
    )
    assert client.is_session_valid() is False


def test_user_id_rejects_query_suffixes_and_never_falls_back_to_sesskey(caplog):
    client = MoodleClient("https://ys.learnus.org")
    client.sesskey = "must-not-become-an-identity"
    private_html = "ultra-secret-html-marker"

    def get(url, **_kwargs):
        path = url.split("?", 1)[0]
        if path.endswith("/grade/report/overview/index.php"):
            return _Response(
                url,
                f'{private_html}<a href="/course/user.php?courseid=99123">Course</a>',
            )
        if path.endswith("/my/"):
            return _Response(url, private_html)
        if path.endswith("/user/preferences.php"):
            return _Response(
                url,
                f'{private_html}<a href="/user/profile.php?client_id=44556">Profile</a>',
            )
        return _Response(
            "https://ys.learnus.org/user/profile.php?client_id=44556&courseid=77889",
            private_html,
        )

    client.session.get = get
    caplog.set_level(logging.INFO)

    assert client.get_user_id() is None
    assert private_html not in caplog.text
    assert client.sesskey not in caplog.text


def test_user_id_parses_only_the_exact_profile_id_parameter():
    client = MoodleClient("https://ys.learnus.org")

    def get(url, **_kwargs):
        path = url.split("?", 1)[0]
        if path.endswith("/user/profile.php"):
            return _Response(
                "https://ys.learnus.org/user/profile.php?client_id=44556&id=73142",
                "",
            )
        return _Response(url, "")

    client.session.get = get

    assert client.get_user_id() == 73142
