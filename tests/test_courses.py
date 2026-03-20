from database import Course, Assignment, VOD


def test_get_courses_empty(client, test_user, auth_headers):
    resp = client.get("/courses", headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json() == []


def test_get_courses_with_data(client, test_user, auth_headers, db):
    c1 = Course(moodle_id=100, owner_id=test_user.id, name="Math 101", is_active=True)
    c2 = Course(moodle_id=101, owner_id=test_user.id, name="Physics 201", is_active=False)
    db.add_all([c1, c2])
    db.commit()

    resp = client.get("/courses", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 2

    names = {c["name"] for c in data}
    assert "Math 101" in names
    assert "Physics 201" in names

    for c in data:
        assert "id" in c
        assert "name" in c
        assert "is_active" in c


def test_toggle_course_active(client, test_user, auth_headers, db):
    course = Course(moodle_id=100, owner_id=test_user.id, name="Math 101", is_active=True)
    db.add(course)
    db.commit()
    db.refresh(course)

    resp = client.put(
        f"/courses/{course.id}/active",
        json={"is_active": False},
        headers=auth_headers,
    )
    assert resp.status_code == 200

    db.refresh(course)
    assert course.is_active is False


def test_toggle_course_not_found(client, test_user, auth_headers):
    resp = client.put(
        "/courses/99999/active",
        json={"is_active": False},
        headers=auth_headers,
    )
    assert resp.status_code == 404


def test_get_assignments_for_course(client, test_user, auth_headers, db):
    course = Course(moodle_id=100, owner_id=test_user.id, name="Math 101", is_active=True)
    db.add(course)
    db.commit()
    db.refresh(course)

    a = Assignment(
        moodle_id=50, course_id=course.id, title="Assignment 1",
        due_date="2025-12-01 23:59:00", is_completed=False, url="http://example.com/a1",
    )
    db.add(a)
    db.commit()

    resp = client.get(f"/courses/{course.id}/assignments", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 1
    assert data[0]["title"] == "Assignment 1"
    assert data[0]["id"] == 50  # moodle_id
    assert data[0]["course_name"] == "Math 101"


def test_get_vods_for_course(client, test_user, auth_headers, db):
    course = Course(moodle_id=100, owner_id=test_user.id, name="Math 101", is_active=True)
    db.add(course)
    db.commit()
    db.refresh(course)

    v = VOD(
        moodle_id=60, course_id=course.id, title="Lecture 1",
        start_date="2025-03-01 09:00:00", end_date="2025-03-08 23:59:00",
        is_completed=False, has_tracking=True, url="http://example.com/v1",
    )
    db.add(v)
    db.commit()

    resp = client.get(f"/courses/{course.id}/vods", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 1
    assert data[0]["title"] == "Lecture 1"
    assert data[0]["id"] == 60  # moodle_id
