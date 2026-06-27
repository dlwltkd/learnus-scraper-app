from database import Course, VOD


def test_labs_settings_default_disabled(client, auth_headers, test_user):
    resp = client.get("/settings/labs", headers=auth_headers)

    assert resp.status_code == 200
    assert resp.json() == {
        "labs_unlocked": False,
        "auto_watch_enabled": False,
    }


def test_unlock_labs_enables_settings_menu_flag(client, auth_headers, test_user):
    resp = client.post("/settings/labs/unlock", headers=auth_headers)

    assert resp.status_code == 200
    assert resp.json() == {
        "labs_unlocked": True,
        "auto_watch_enabled": False,
    }


def test_auto_watch_toggle_requires_labs_unlock(client, auth_headers, test_user):
    resp = client.put(
        "/settings/labs",
        json={"auto_watch_enabled": True},
        headers=auth_headers,
    )

    assert resp.status_code == 403


def test_auto_watch_toggle_after_unlock(client, auth_headers, test_user):
    client.post("/settings/labs/unlock", headers=auth_headers)

    resp = client.put(
        "/settings/labs",
        json={"auto_watch_enabled": True},
        headers=auth_headers,
    )

    assert resp.status_code == 200
    assert resp.json() == {
        "labs_unlocked": True,
        "auto_watch_enabled": True,
    }


def test_watch_single_requires_auto_watch_enabled(client, auth_headers, db, test_user):
    course = Course(moodle_id=100, owner_id=test_user.id, name="Test", is_active=True)
    db.add(course)
    db.commit()
    db.refresh(course)
    db.add(VOD(moodle_id=200, course_id=course.id, title="Lecture", url="http://example.com"))
    db.commit()

    resp = client.post("/vods/200/watch", headers=auth_headers)

    assert resp.status_code == 403
