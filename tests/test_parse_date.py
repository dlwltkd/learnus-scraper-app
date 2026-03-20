from datetime import datetime
from api import parse_date


def test_iso_datetime():
    assert parse_date("2025-03-15 14:30:00") == datetime(2025, 3, 15, 14, 30, 0)


def test_iso_datetime_no_seconds():
    assert parse_date("2025-03-15 14:30") == datetime(2025, 3, 15, 14, 30)


def test_iso_date_only():
    assert parse_date("2025-03-15") == datetime(2025, 3, 15, 0, 0)


def test_korean_format():
    result = parse_date("2025년 03월 15일 14:30")
    assert result is not None
    assert result.year == 2025
    assert result.month == 3
    assert result.day == 15
    assert result.hour == 14
    assert result.minute == 30


def test_english_format():
    result = parse_date("Monday, 15 March 2025, 2:30 PM")
    assert result is not None
    assert result.year == 2025
    assert result.month == 3
    assert result.day == 15


def test_nbsp_cleanup():
    result = parse_date("2025-03-15&nbsp;14:30")
    assert result is not None
    assert result == datetime(2025, 3, 15, 14, 30)


def test_trailing_dot_cleanup():
    result = parse_date("2025-03-15 14:30.")
    assert result is not None
    assert result == datetime(2025, 3, 15, 14, 30)


def test_none_input():
    assert parse_date(None) is None


def test_empty_string():
    assert parse_date("") is None


def test_none_string():
    assert parse_date("None") is None


def test_garbage_string():
    assert parse_date("not a date") is None
