"""
Collect HTML fixtures from LearnUs for moodle_client parsing tests.

Run on the Droplet inside the api container:
    docker compose exec api python scripts/collect_fixtures.py

Outputs HTML files to tests/fixtures/ organized by page type.
Fetches ALL courses (active + inactive), ALL assignments, ALL VODs,
ALL boards, ALL posts — maximizing fixture coverage.
"""

import os
import sys
import json
import re
import logging
import time
import requests
from pathlib import Path

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from database import init_db, User, Course, Assignment, VOD, Board, Post, FileResource

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
log = logging.getLogger(__name__)

FIXTURES_DIR = Path(__file__).parent.parent / "tests" / "fixtures"
BASE_URL = "https://ys.learnus.org"

# Small delay between requests to avoid hammering LearnUs
REQUEST_DELAY = 0.5


def parse_cookie_string(raw: str) -> dict:
    cookies = {}
    for item in raw.split(";"):
        item = item.strip()
        if not item:
            continue
        if "=" in item:
            k, v = item.split("=", 1)
            cookies[k.strip()] = v.strip()
        else:
            cookies[item] = ""
    return cookies


def make_session(user) -> requests.Session | None:
    """Build a requests.Session from user's stored cookies. Returns None if no cookies."""
    raw = user.moodle_cookies
    if not raw:
        return None

    session = requests.Session()
    session.headers.update({
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
    })

    if raw.startswith("{"):
        try:
            cookies = json.loads(raw)
        except Exception:
            return None
    else:
        cookies = parse_cookie_string(raw)

    session.cookies.update(cookies)
    return session


def is_session_valid(session: requests.Session) -> bool:
    try:
        resp = session.get(f"{BASE_URL}/my/", timeout=15, allow_redirects=True)
        return "login" not in resp.url
    except Exception:
        return False


def fetch(session: requests.Session, url: str) -> str | None:
    time.sleep(REQUEST_DELAY)
    try:
        resp = session.get(url, timeout=20)
        resp.raise_for_status()
        if "login/index.php" in resp.url or "Log in to the site" in resp.text:
            return None
        return resp.text
    except Exception as e:
        log.warning(f"  Failed to fetch {url}: {e}")
        return None


def sanitize_html(html: str, username: str = "") -> str:
    """Remove personal info from HTML before saving as a fixture."""
    if username:
        html = html.replace(username, "REDACTED_USER")
    # Sesskey values in JSON
    html = re.sub(r'"sesskey"\s*:\s*"[^"]+"', '"sesskey":"REDACTED"', html)
    # Sesskey in URL params
    html = re.sub(r'sesskey=[a-zA-Z0-9]+', 'sesskey=REDACTED', html)
    # MoodleSession cookie values
    html = re.sub(r'MoodleSession=[a-zA-Z0-9]+', 'MoodleSession=REDACTED', html)
    # Email addresses
    html = re.sub(r'[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+', 'REDACTED@example.com', html)
    return html


def save(html: str, category: str, name: str) -> bool:
    """Save HTML to tests/fixtures/<category>/<name>.html. Returns True if saved."""
    out_dir = FIXTURES_DIR / category
    out_dir.mkdir(parents=True, exist_ok=True)
    path = out_dir / f"{name}.html"
    if path.exists():
        return False
    path.write_text(html, encoding="utf-8")
    log.info(f"  Saved {path.relative_to(FIXTURES_DIR)}")
    return True


def collect_for_user(session: requests.Session, username: str, db_session, user):
    """Scrape all fixture types for one user — ALL courses, not just active."""
    saved = 0

    # ── 1. Dashboard (/my/) — used by get_user_id() ──
    log.info("  [dashboard] /my/")
    html = fetch(session, f"{BASE_URL}/my/")
    if html and save(sanitize_html(html, username), "dashboard", f"dashboard_{user.id}"):
        saved += 1

    # ── 2. Grade report — used by scrape_courses() ──
    log.info("  [grade_report] /grade/report/overview/index.php")
    html = fetch(session, f"{BASE_URL}/grade/report/overview/index.php")
    if html and save(sanitize_html(html, username), "grade_report", f"grade_report_{user.id}"):
        saved += 1

    # ── 3. Ubion active courses page — used by scrape_active_courses() ──
    log.info("  [ubion_courses] /local/ubion/user/index.php")
    html = fetch(session, f"{BASE_URL}/local/ubion/user/index.php")
    if html and save(sanitize_html(html, username), "ubion_courses", f"ubion_courses_{user.id}"):
        saved += 1

    # ── 4. User preferences page — used as fallback in get_user_id() ──
    log.info("  [preferences] /user/preferences.php")
    html = fetch(session, f"{BASE_URL}/user/preferences.php")
    if html and save(sanitize_html(html, username), "preferences", f"preferences_{user.id}"):
        saved += 1

    # ── 5. User profile page — used as fallback in get_user_id() ──
    log.info("  [profile] /user/profile.php")
    html = fetch(session, f"{BASE_URL}/user/profile.php")
    if html and save(sanitize_html(html, username), "profile", f"profile_{user.id}"):
        saved += 1

    # ── 6. Course pages — ALL courses (active + inactive) ──
    courses = db_session.query(Course).filter(Course.owner_id == user.id).all()
    log.info(f"  [course_page] {len(courses)} courses (active + inactive)")
    for course in courses:
        log.info(f"    course {course.moodle_id}: {course.name} (active={course.is_active})")
        html = fetch(session, f"{BASE_URL}/course/view.php?id={course.moodle_id}")
        if html and save(sanitize_html(html, username), "course_page", f"course_{course.moodle_id}"):
            saved += 1

    # ── 7. Assignment pages — ALL assignments across all courses ──
    assignments = (
        db_session.query(Assignment)
        .join(Course)
        .filter(Course.owner_id == user.id, Assignment.url.isnot(None))
        .all()
    )
    log.info(f"  [assignment/quiz/feedback] {len(assignments)} assignments")
    for a in assignments:
        if not a.url:
            continue
        if "/mod/quiz/" in a.url:
            page_type = "quiz"
        elif "/mod/feedback/" in a.url:
            page_type = "feedback"
        else:
            page_type = "assignment"
        log.info(f"    {page_type} {a.moodle_id}: {a.title}")
        html = fetch(session, a.url)
        if html and save(sanitize_html(html, username), f"{page_type}_page", f"{page_type}_{a.moodle_id}"):
            saved += 1

    # ── 8. VOD viewer pages — ALL VODs (for parse_progress_args, get_vod_stream_url) ──
    vods = (
        db_session.query(VOD)
        .join(Course)
        .filter(Course.owner_id == user.id, VOD.url.isnot(None))
        .all()
    )
    log.info(f"  [vod_viewer] {len(vods)} VODs")
    for v in vods:
        if not v.url:
            continue
        # Determine if laby or regular vod
        if "/mod/laby/" in v.url:
            page_type = "laby_viewer"
        else:
            page_type = "vod_viewer"
        log.info(f"    {page_type} {v.moodle_id}: {v.title}")
        html = fetch(session, v.url)
        if html and save(sanitize_html(html, username), page_type, f"{page_type}_{v.moodle_id}"):
            saved += 1

    # ── 9. Board pages — ALL boards across all courses ──
    boards = (
        db_session.query(Board)
        .join(Course)
        .filter(Course.owner_id == user.id)
        .all()
    )
    log.info(f"  [board_page] {len(boards)} boards")
    for b in boards:
        log.info(f"    board {b.moodle_id}: {b.title}")
        html = fetch(session, f"{BASE_URL}/mod/ubboard/view.php?id={b.moodle_id}")
        if html and save(sanitize_html(html, username), "board_page", f"board_{b.moodle_id}"):
            saved += 1

    # ── 10. Post pages — ALL posts across all boards ──
    posts = (
        db_session.query(Post)
        .join(Board)
        .join(Course)
        .filter(Course.owner_id == user.id, Post.url.isnot(None))
        .all()
    )
    log.info(f"  [post_page] {len(posts)} posts")
    for p in posts:
        if not p.url:
            continue
        log.info(f"    post {p.id}: {p.title}")
        html = fetch(session, p.url)
        if html and save(sanitize_html(html, username), "post_page", f"post_{p.id}"):
            saved += 1

    # ── 11. File resource pages — ALL file resources ──
    files = (
        db_session.query(FileResource)
        .join(Course)
        .filter(Course.owner_id == user.id, FileResource.url.isnot(None))
        .all()
    )
    log.info(f"  [file_page] {len(files)} file resources")
    for f in files:
        if not f.url:
            continue
        log.info(f"    file {f.moodle_id}: {f.title}")
        html = fetch(session, f.url)
        if html and save(sanitize_html(html, username), "file_page", f"file_{f.moodle_id}"):
            saved += 1

    return saved


def main():
    SessionLocal = init_db()
    db = SessionLocal()

    FIXTURES_DIR.mkdir(parents=True, exist_ok=True)

    users = db.query(User).filter(User.moodle_cookies.isnot(None)).all()
    log.info(f"Found {len(users)} users with cookies")

    valid_count = 0
    total_saved = 0
    for user in users:
        log.info(f"\n{'='*60}")
        log.info(f"User: {user.username} (id={user.id})")

        session = make_session(user)
        if not session:
            log.warning(f"  Could not build session, skipping")
            continue

        log.info(f"  Validating session...")
        if not is_session_valid(session):
            log.warning(f"  Session expired, skipping")
            continue

        log.info(f"  Session valid!")
        valid_count += 1
        total_saved += collect_for_user(session, user.username, db, user)

    db.close()

    # Summary
    total_files = sum(1 for _ in FIXTURES_DIR.rglob("*.html"))
    categories = sorted(set(p.parent.name for p in FIXTURES_DIR.rglob("*.html")))
    log.info(f"\n{'='*60}")
    log.info(f"Done! {valid_count} valid sessions, {total_saved} new files saved ({total_files} total on disk)")
    log.info(f"Categories: {', '.join(categories)}")
    for cat in categories:
        count = sum(1 for _ in (FIXTURES_DIR / cat).glob("*.html"))
        log.info(f"  {cat}: {count} files")
    log.info(f"\nFixtures saved to: {FIXTURES_DIR}")


if __name__ == "__main__":
    main()
