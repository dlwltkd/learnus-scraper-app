from api import _parse_cookie_string


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
