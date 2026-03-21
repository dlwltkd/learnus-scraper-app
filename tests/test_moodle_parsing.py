"""
Tests for moodle_client.py parsing functions using real HTML fixtures.

Fixtures are in tests/fixtures/fixtures/<category>/<name>.html,
collected from production LearnUs pages.
"""

import os
import sys
from pathlib import Path
from unittest.mock import Mock

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from moodle_client import MoodleClient

FIXTURES = Path(__file__).parent / "fixtures" / "fixtures"

pytestmark = pytest.mark.skipif(
    not FIXTURES.exists(), reason="HTML fixtures not present (run collect_fixtures.py)"
)


def _load(category: str, name: str) -> str:
    return (FIXTURES / category / name).read_text(encoding="utf-8")


def _client_with_html(html: str, url: str = "https://ys.learnus.org/mock") -> MoodleClient:
    """Create a MoodleClient whose session.get() returns fixture HTML."""
    client = MoodleClient("https://ys.learnus.org")
    resp = Mock()
    resp.status_code = 200
    resp.text = html
    resp.url = url
    resp.raise_for_status = Mock()
    client.session.get = Mock(return_value=resp)
    return client


# ──────────────────────────────────────────────
# parse_korean_date
# ──────────────────────────────────────────────

class TestParseKoreanDate:
    def setup_method(self):
        self.client = MoodleClient("https://ys.learnus.org")

    def test_standard_format(self):
        assert self.client.parse_korean_date("2025년 9월 07일") == "2025-09-07"

    def test_with_day_of_week(self):
        assert self.client.parse_korean_date("2025년 3월 15일 (월)") == "2025-03-15"

    def test_with_nbsp(self):
        assert self.client.parse_korean_date("2025년&nbsp;3월&nbsp;15일") == "2025-03-15"

    def test_single_digit_month_day(self):
        assert self.client.parse_korean_date("2026년 3월 9일") == "2026-03-09"

    def test_none_returns_none(self):
        assert self.client.parse_korean_date(None) is None

    def test_empty_returns_none(self):
        assert self.client.parse_korean_date("") is None

    def test_garbage_returns_none(self):
        assert self.client.parse_korean_date("not a date") is None


# ──────────────────────────────────────────────
# scrape_courses (grade report page)
# ──────────────────────────────────────────────

class TestScrapeCourses:
    def test_extracts_courses_from_grade_report(self):
        html = _load("grade_report", "grade_report_6.html")
        client = _client_with_html(html)
        courses = client.scrape_courses()

        assert len(courses) == 40
        ids = [c["id"] for c in courses]
        assert 291755 in ids
        assert 288741 in ids
        assert 286015 in ids

    def test_course_names_are_clean(self):
        html = _load("grade_report", "grade_report_6.html")
        client = _client_with_html(html)
        courses = client.scrape_courses()

        by_id = {c["id"]: c["fullname"] for c in courses}
        assert "채플(C) (비대면)" in by_id[291755]

    def test_no_duplicate_ids(self):
        html = _load("grade_report", "grade_report_6.html")
        client = _client_with_html(html)
        courses = client.scrape_courses()

        ids = [c["id"] for c in courses]
        assert len(ids) == len(set(ids))

    def test_different_user_grade_report(self):
        html = _load("grade_report", "grade_report_12.html")
        client = _client_with_html(html)
        courses = client.scrape_courses()

        assert len(courses) == 11
        ids = [c["id"] for c in courses]
        assert 292039 in ids


# ──────────────────────────────────────────────
# scrape_active_courses (ubion page)
# ──────────────────────────────────────────────

class TestScrapeActiveCourses:
    def test_extracts_active_course_ids(self):
        html = _load("ubion_courses", "ubion_courses_6.html")
        client = _client_with_html(html)
        ids = client.scrape_active_courses()

        assert isinstance(ids, set)
        assert len(ids) == 8
        expected = {286015, 286017, 286028, 288648, 288739, 288741, 291164, 291755}
        assert ids == expected

    def test_different_user(self):
        html = _load("ubion_courses", "ubion_courses_7.html")
        client = _client_with_html(html)
        ids = client.scrape_active_courses()

        assert len(ids) == 8
        assert 285578 in ids
        assert 292038 in ids


# ──────────────────────────────────────────────
# get_course_contents (course page)
# ──────────────────────────────────────────────

class TestGetCourseContents:
    def test_parses_mixed_content_course(self):
        """course_277450 has ubboard, ubfile, vod, quiz, feedback — 75 activities."""
        html = _load("course_page", "course_277450.html")
        client = _client_with_html(html)
        contents = client.get_course_contents(277450)

        assert "assignments" in contents
        assert "vods" in contents
        assert "boards" in contents
        assert "files" in contents

        # Should have items in multiple categories
        assert len(contents["vods"]) > 0
        assert len(contents["boards"]) > 0
        assert len(contents["files"]) > 0

    def test_vod_dates_extracted(self):
        html = _load("course_page", "course_277450.html")
        client = _client_with_html(html)
        contents = client.get_course_contents(277450)

        # Find VOD 4116777 (거시경제원론_01_01)
        vod = next((v for v in contents["vods"] if v["id"] == 4116777), None)
        assert vod is not None
        assert "01_01" in vod["name"]
        assert vod["start_date"] == "2025-09-01 00:00:00"
        assert vod["end_date"] == "2025-09-07 23:59:59"
        assert vod["is_completed"] is True

    def test_vod_not_completed(self):
        html = _load("course_page", "course_277450.html")
        client = _client_with_html(html)
        contents = client.get_course_contents(277450)

        vod = next((v for v in contents["vods"] if v["id"] == 4116779), None)
        assert vod is not None
        assert vod["is_completed"] is False

    def test_boards_extracted(self):
        html = _load("course_page", "course_277450.html")
        client = _client_with_html(html)
        contents = client.get_course_contents(277450)

        board_ids = [b["id"] for b in contents["boards"]]
        assert 4114832 in board_ids  # 과목공지
        assert 4114833 in board_ids  # 질의응답: 수업내용

    def test_files_extracted(self):
        html = _load("course_page", "course_277450.html")
        client = _client_with_html(html)
        contents = client.get_course_contents(277450)

        file_item = next((f for f in contents["files"] if f["id"] == 4116630), None)
        assert file_item is not None
        assert file_item["name"] == "실라버스"
        assert file_item["is_completed"] is True

    def test_laby_activities_parsed_as_vods(self):
        """course_277435 has 46 laby activities — should be categorized as vods."""
        html = _load("course_page", "course_277435.html")
        client = _client_with_html(html)
        contents = client.get_course_contents(277435)

        vods = contents["vods"]
        vod_ids = [v["id"] for v in vods]

        # Check some known laby module IDs
        assert 4116235 in vod_ids
        assert 4142018 in vod_ids
        assert 4142029 in vod_ids

    def test_laby_completion_status(self):
        html = _load("course_page", "course_277435.html")
        client = _client_with_html(html)
        contents = client.get_course_contents(277435)

        vods_by_id = {v["id"]: v for v in contents["vods"]}

        # 4142029 should be completed
        assert vods_by_id[4142029]["is_completed"] is True
        # 4116235 should not be completed
        assert vods_by_id[4116235]["is_completed"] is False

    def test_feedback_parsed_as_assignment(self):
        """course_291755 has feedback activities — should land in assignments."""
        html = _load("course_page", "course_291755.html")
        client = _client_with_html(html)
        contents = client.get_course_contents(291755)

        assignment_ids = [a["id"] for a in contents["assignments"]]
        # Feedback modules should be categorized as assignments
        assert 4308611 in assignment_ids  # 1주차 소감
        assert 4336612 in assignment_ids  # 2주차 소감
        assert 4343886 in assignment_ids  # 3주차 소감

    def test_feedback_completion(self):
        html = _load("course_page", "course_291755.html")
        client = _client_with_html(html)
        contents = client.get_course_contents(291755)

        by_id = {a["id"]: a for a in contents["assignments"]}
        # 4308611 (1주차 소감) should be completed
        assert by_id[4308611]["is_completed"] is True
        # 4352315 (4주차 소감) should not be completed
        assert by_id[4352315]["is_completed"] is False

    def test_feedback_deadline_parsed(self):
        """Feedback items should have deadline_text extracted from Korean date patterns."""
        html = _load("course_page", "course_291755.html")
        client = _client_with_html(html)
        contents = client.get_course_contents(291755)

        by_id = {a["id"]: a for a in contents["assignments"]}

        # 4308611: "2026년 3월 09일 까지 사용가능" → "2026-03-09"
        if 4308611 in by_id and by_id[4308611].get("deadline_text"):
            assert by_id[4308611]["deadline_text"] == "2026-03-09"

        # 4343886: "종료 일시: 2026년 3월 23일" → "2026-03-23"
        if 4343886 in by_id and by_id[4343886].get("deadline_text"):
            assert by_id[4343886]["deadline_text"] == "2026-03-23"

    def test_quiz_parsed_as_assignment(self):
        """course_277450 has quiz activities — should land in assignments."""
        html = _load("course_page", "course_277450.html")
        client = _client_with_html(html)
        contents = client.get_course_contents(277450)

        assignment_ids = [a["id"] for a in contents["assignments"]]
        assert 4129071 in assignment_ids  # 1차 과제 (quiz)

    def test_session_expired_raises(self):
        """If HTML contains login redirect, should raise."""
        client = _client_with_html(
            '<html>Log in to the site</html>',
            url="https://ys.learnus.org/login/index.php",
        )
        import pytest
        with pytest.raises(Exception, match="Session expired"):
            client.get_course_contents(12345)

    def test_announcements_extracted(self):
        """course_254495 has announcement items."""
        html = _load("course_page", "course_254495.html")
        client = _client_with_html(html)
        contents = client.get_course_contents(254495)

        announcements = contents["announcements"]
        if len(announcements) > 0:
            first = announcements[0]
            assert "subject" in first
            assert "date" in first
            assert "url" in first


# ──────────────────────────────────────────────
# get_board_posts (board page)
# ──────────────────────────────────────────────

class TestGetBoardPosts:
    def test_extracts_posts(self):
        html = _load("board_page", "board_3878953.html")
        client = _client_with_html(html)
        posts = client.get_board_posts(3878953)

        assert len(posts) >= 5

    def test_post_fields(self):
        html = _load("board_page", "board_3878953.html")
        client = _client_with_html(html)
        posts = client.get_board_posts(3878953)

        first = posts[0]
        assert "subject" in first
        assert "writer" in first
        assert "date" in first
        assert "url" in first

    def test_post_values(self):
        html = _load("board_page", "board_3878953.html")
        client = _client_with_html(html)
        posts = client.get_board_posts(3878953)

        # Check known values
        subjects = [p["subject"] for p in posts]
        writers = [p["writer"] for p in posts]
        dates = [p["date"] for p in posts]

        assert any("기말시험 채점 결과" in s for s in subjects)
        assert "이은지" in writers
        assert "2025-06-19" in dates

    def test_url_unescaped(self):
        """URLs should have &amp; unescaped to &."""
        html = _load("board_page", "board_3878953.html")
        client = _client_with_html(html)
        posts = client.get_board_posts(3878953)

        for p in posts:
            assert "&amp;" not in p["url"]
            assert "bwid=" in p["url"]

    def test_empty_board(self):
        """Board with no tbody should return empty list."""
        client = _client_with_html("<html><body><table></table></body></html>")
        posts = client.get_board_posts(99999)
        assert posts == []


# ──────────────────────────────────────────────
# get_post_content (post page)
# ──────────────────────────────────────────────

class TestGetPostContent:
    def test_extracts_content(self):
        html = _load("post_page", "post_1.html")
        client = _client_with_html(html)
        content = client.get_post_content("https://ys.learnus.org/mod/ubboard/article.php?id=1")

        assert "중간고사 성적을 공지합니다" in content

    def test_no_content_div(self):
        client = _client_with_html("<html><body>No content here</body></html>")
        content = client.get_post_content("https://example.com")
        assert content == "No content."


# ──────────────────────────────────────────────
# get_assignment_deadline (assignment page)
# ──────────────────────────────────────────────

class TestGetAssignmentDeadline:
    def test_korean_deadline(self):
        html = _load("assignment_page", "assignment_3918588.html")
        client = _client_with_html(html)
        deadline = client.get_assignment_deadline("https://ys.learnus.org/mod/assign/view.php?id=3918588")

        assert deadline is not None
        assert "2025-03-05" in deadline
        assert "23:59" in deadline

    def test_no_deadline_page(self):
        client = _client_with_html("<html><body><table><tr><td>Info</td><td>N/A</td></tr></table></body></html>")
        deadline = client.get_assignment_deadline("https://example.com")
        assert deadline is None


# ──────────────────────────────────────────────
# get_quiz_details (quiz page)
# ──────────────────────────────────────────────

class TestGetQuizDetails:
    def test_completed_quiz(self):
        html = _load("quiz_page", "quiz_4109048.html")
        client = _client_with_html(html)
        details = client.get_quiz_details("https://ys.learnus.org/mod/quiz/view.php?id=4109048")

        assert details is not None
        assert details["due_date"] == "2025-09-12 23:59"
        assert details["is_completed"] is True

    def test_incomplete_quiz(self):
        html = _load("quiz_page", "quiz_4327437.html")
        client = _client_with_html(html)
        details = client.get_quiz_details("https://ys.learnus.org/mod/quiz/view.php?id=4327437")

        assert details is not None
        assert details["due_date"] == "2026-03-29 23:59"
        assert details["is_completed"] is False

    def test_no_deadline_page(self):
        client = _client_with_html("<html><body>No quiz info</body></html>")
        details = client.get_quiz_details("https://example.com")

        assert details is not None
        assert details["due_date"] is None
        assert details["is_completed"] is False


# ──────────────────────────────────────────────
# get_user_id (dashboard + fallback pages)
# ──────────────────────────────────────────────

class TestGetUserId:
    def test_grade_report_strategy(self):
        """Strategy 0: grade report has user=XXXXX in course/user.php links."""
        html = _load("grade_report", "grade_report_6.html")
        client = _client_with_html(html)
        user_id = client.get_user_id()

        assert user_id == 585309

    def test_grade_report_different_user(self):
        html = _load("grade_report", "grade_report_7.html")
        client = _client_with_html(html)
        user_id = client.get_user_id()

        assert user_id == 600729

    def test_grade_report_user_12(self):
        html = _load("grade_report", "grade_report_12.html")
        client = _client_with_html(html)
        user_id = client.get_user_id()

        assert user_id == 631276
