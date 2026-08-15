"""Shared parsers used at external-system boundaries."""

import re
from datetime import datetime


def parse_cookie_string(raw: str) -> dict[str, str]:
    """Parse cookie text, retaining keyless tokens with an empty value."""
    cookies = {}
    for item in raw.split(';'):
        item = item.strip()
        if not item:
            continue
        if '=' in item:
            key, value = item.split('=', 1)
            cookies[key.strip()] = value.strip()
        else:
            cookies[item] = ''
    return cookies


def parse_date(date_str):
    """Parse the date formats currently returned by LearnUs/Moodle."""
    if not date_str or date_str == 'None':
        return None

    normalized = " ".join(date_str.replace('&nbsp;', ' ').rstrip('.').split())
    for date_format in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%d %H:%M", "%Y-%m-%d"):
        try:
            return datetime.strptime(normalized, date_format)
        except ValueError:
            pass

    try:
        clean = " ".join(re.sub(r'[년월일\(\)요일]', ' ', normalized).split())
        return datetime.strptime(clean, "%Y %m %d %H:%M")
    except ValueError:
        pass

    try:
        clean = re.sub(r'^[A-Za-z]+,\s*', '', normalized)
        return datetime.strptime(clean, "%d %B %Y, %I:%M %p")
    except ValueError:
        pass

    clean = re.sub(r'\([A-Za-z]+\)', '', normalized)
    clean = re.sub(
        r'\((\d{1,2}:\d{2}\s*[ap]m)\)',
        r' \1',
        clean,
        flags=re.IGNORECASE,
    )
    clean = " ".join(clean.split())
    current_year = datetime.now().year
    for date_format in ("%Y %b %d %I:%M %p", "%Y %b %d %I:%M%p"):
        try:
            return datetime.strptime(f"{current_year} {clean}", date_format)
        except ValueError:
            pass
    return None
