from datetime import datetime, timedelta
from database import Course, Assignment, VOD


def test_dashboard_overview_empty_user(client, test_user, auth_headers):
    resp = client.get("/dashboard/overview", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["upcoming_assignments"] == []
    assert data["missed_assignments"] == []
    assert data["available_vods"] == []
    assert data["missed_vods"] == []
    assert data["unchecked_vods"] == []
    assert data["upcoming_vods"] == []
    assert data["stats"]["total_assignments_due"] == 0
    assert data["stats"]["missed_assignments_count"] == 0


def test_dashboard_stats_calculation(client, test_user, auth_headers, db):
    now = datetime.now()
    course = Course(moodle_id=100, owner_id=test_user.id, name="Test Course", is_active=True)
    db.add(course)
    db.commit()
    db.refresh(course)

    # Upcoming, not completed (due in 3 days)
    a1 = Assignment(
        moodle_id=1, course_id=course.id, title="HW1",
        due_date=(now + timedelta(days=3)).strftime("%Y-%m-%d %H:%M:%S"),
        is_completed=False, url="http://example.com/1",
    )
    # Upcoming, completed (due in 2 days)
    a2 = Assignment(
        moodle_id=2, course_id=course.id, title="HW2",
        due_date=(now + timedelta(days=2)).strftime("%Y-%m-%d %H:%M:%S"),
        is_completed=True, url="http://example.com/2",
    )
    # Missed (due yesterday, not completed)
    a3 = Assignment(
        moodle_id=3, course_id=course.id, title="HW3",
        due_date=(now - timedelta(days=1)).strftime("%Y-%m-%d %H:%M:%S"),
        is_completed=False, url="http://example.com/3",
    )
    db.add_all([a1, a2, a3])
    db.commit()

    resp = client.get("/dashboard/overview", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()

    stats = data["stats"]
    # total_assignments_due = upcoming assignments this week (a1 not completed + a2 completed)
    assert stats["total_assignments_due"] == 2
    assert stats["completed_assignments_due"] == 1
    assert stats["missed_assignments_count"] == 1

    assert len(data["missed_assignments"]) == 1
    assert data["missed_assignments"][0]["title"] == "HW3"


def test_dashboard_vod_categorization(client, test_user, auth_headers, db):
    now = datetime.now()
    course = Course(moodle_id=200, owner_id=test_user.id, name="VOD Course", is_active=True)
    db.add(course)
    db.commit()
    db.refresh(course)

    fmt = "%Y-%m-%d %H:%M:%S"

    # Available (started, not ended, not completed)
    v1 = VOD(
        moodle_id=10, course_id=course.id, title="Lecture 1",
        start_date=(now - timedelta(days=3)).strftime(fmt),
        end_date=(now + timedelta(days=3)).strftime(fmt),
        is_completed=False, has_tracking=True, url="http://example.com/v1",
    )
    # Missed (ended, not completed)
    v2 = VOD(
        moodle_id=11, course_id=course.id, title="Lecture 2",
        start_date=(now - timedelta(days=10)).strftime(fmt),
        end_date=(now - timedelta(days=1)).strftime(fmt),
        is_completed=False, has_tracking=True, url="http://example.com/v2",
    )
    # Upcoming (starts in the future)
    v3 = VOD(
        moodle_id=12, course_id=course.id, title="Lecture 3",
        start_date=(now + timedelta(days=5)).strftime(fmt),
        end_date=(now + timedelta(days=12)).strftime(fmt),
        is_completed=False, has_tracking=True, url="http://example.com/v3",
    )
    # Unchecked (no tracking)
    v4 = VOD(
        moodle_id=13, course_id=course.id, title="Lecture 4",
        start_date=(now - timedelta(days=1)).strftime(fmt),
        end_date=(now + timedelta(days=5)).strftime(fmt),
        is_completed=False, has_tracking=False, url="http://example.com/v4",
    )
    db.add_all([v1, v2, v3, v4])
    db.commit()

    resp = client.get("/dashboard/overview", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()

    available_titles = [v["title"] for v in data["available_vods"]]
    missed_titles = [v["title"] for v in data["missed_vods"]]
    upcoming_titles = [v["title"] for v in data["upcoming_vods"]]
    unchecked_titles = [v["title"] for v in data["unchecked_vods"]]

    assert "Lecture 1" in available_titles
    assert "Lecture 2" in missed_titles
    assert "Lecture 3" in upcoming_titles
    assert "Lecture 4" in unchecked_titles

    assert data["stats"]["missed_vods_count"] == 1
