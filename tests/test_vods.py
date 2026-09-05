from database import Course, VOD, VodTranscript, Job


def test_get_transcript_not_found(client, test_user, auth_headers, db):
    course = Course(moodle_id=100, owner_id=test_user.id, name="Test", is_active=True)
    db.add(course)
    db.commit()
    db.refresh(course)

    vod = VOD(
        moodle_id=99999, course_id=course.id, title="No Transcript",
        is_completed=False, has_tracking=True, url="http://example.com/v",
    )
    db.add(vod)
    db.commit()

    resp = client.get("/vods/99999/transcript", headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json()["status"] == "not_found"


def test_get_transcript_cached(client, test_user, auth_headers, db):
    course = Course(moodle_id=100, owner_id=test_user.id, name="Test", is_active=True)
    db.add(course)
    db.commit()
    db.refresh(course)

    vod = VOD(
        moodle_id=500, course_id=course.id, title="Has Transcript",
        is_completed=False, has_tracking=True, url="http://example.com/v",
    )
    db.add(vod)
    transcript = VodTranscript(moodle_id=500, is_processing=False, transcript="Hello world transcript")
    db.add(transcript)
    db.commit()

    resp = client.get("/vods/500/transcript", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "ok"
    assert data["transcript"] == "Hello world transcript"


def test_get_transcript_processing(client, test_user, auth_headers, db):
    course = Course(moodle_id=100, owner_id=test_user.id, name="Test", is_active=True)
    db.add(course)
    db.commit()
    db.refresh(course)

    vod = VOD(
        moodle_id=501, course_id=course.id, title="Processing",
        is_completed=False, has_tracking=True, url="http://example.com/v",
    )
    db.add(vod)
    transcript = VodTranscript(moodle_id=501, is_processing=True)
    db.add(transcript)
    db.commit()

    resp = client.get("/vods/501/transcript", headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json()["status"] == "processing"


def test_get_transcribe_status_queued_with_queue_position(client, test_user, auth_headers, db):
    course = Course(moodle_id=100, owner_id=test_user.id, name="Test", is_active=True)
    db.add(course)
    db.commit()
    db.refresh(course)

    vod = VOD(
        moodle_id=502, course_id=course.id, title="Queued",
        is_completed=False, has_tracking=True, url="http://example.com/v",
    )
    db.add(vod)
    db.add(VodTranscript(moodle_id=502, is_processing=True, status="queued", stage="queued"))
    db.add(Job(type="transcribe", status="pending", payload={"vod_moodle_id": 111}))
    db.add(Job(type="transcribe", status="pending", payload={"vod_moodle_id": 502}))
    db.commit()

    resp = client.get("/vods/502/transcribe/status", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "queued"
    assert data["progress_pct"] == 0
    assert data["queue_position"] == 2
    assert data["queue_ahead"] == 1


def test_get_transcribe_status_failed(client, test_user, auth_headers, db):
    course = Course(moodle_id=100, owner_id=test_user.id, name="Test", is_active=True)
    db.add(course)
    db.commit()
    db.refresh(course)

    vod = VOD(
        moodle_id=503, course_id=course.id, title="Failed",
        is_completed=False, has_tracking=True, url="http://example.com/v",
    )
    db.add(vod)
    db.add(VodTranscript(moodle_id=503, is_processing=False, status="failed", stage="failed", error_message="boom"))
    db.commit()

    status_resp = client.get("/vods/503/transcribe/status", headers=auth_headers)
    assert status_resp.status_code == 200
    assert status_resp.json()["status"] == "failed"
    assert status_resp.json()["progress_pct"] == 0
    assert status_resp.json()["error_message"] == "Transcription failed. Please retry."

    transcript_resp = client.get("/vods/503/transcript", headers=auth_headers)
    assert transcript_resp.status_code == 200
    assert transcript_resp.json()["status"] == "failed"
    assert transcript_resp.json()["error_message"] == "Transcription failed. Please retry."


def test_transcribe_vod_queues_owned_resource_without_credentials(client, test_user, auth_headers, db, monkeypatch):
    from types import SimpleNamespace
    import api

    test_user.labs_unlocked = True
    monkeypatch.setattr(api, "get_moodle_client", lambda user: SimpleNamespace(is_session_valid=lambda: True))
    course = Course(moodle_id=100, owner_id=test_user.id, name="Test", is_active=True)
    db.add(course)
    db.commit()
    db.refresh(course)

    vod = VOD(
        moodle_id=504, course_id=course.id, title="Manual VOD",
        is_completed=False, has_tracking=True, url="http://example.com/v",
    )
    db.add(vod)
    db.commit()

    resp = client.post(
        "/vods/504/transcribe",
        headers=auth_headers,
        json={},
    )

    assert resp.status_code == 200
    assert resp.json()["status"] == "processing"

    row = db.query(VodTranscript).filter(VodTranscript.moodle_id == 504).first()
    assert row is not None
    assert row.status == "queued"
    assert row.is_processing is True

    job = db.query(Job).filter(Job.type == "transcribe").first()
    assert job is not None
    assert job.payload["vod_id"] == vod.id
    assert job.payload["vod_moodle_id"] == 504
    assert "m3u8_url" not in job.payload
    assert "cookies" not in job.payload


def test_transcribe_vod_rejects_manual_media_url(client, test_user, auth_headers, db):
    course = Course(moodle_id=100, owner_id=test_user.id, name="Test", is_active=True)
    db.add(course)
    db.commit()
    db.refresh(course)

    vod = VOD(
        moodle_id=505, course_id=course.id, title="Manual VOD",
        is_completed=False, has_tracking=True, url="http://example.com/v",
    )
    db.add(vod)
    db.commit()

    resp = client.post(
        "/vods/505/transcribe",
        headers=auth_headers,
        json={"media_url": "https://attacker.invalid/audio.mp3"},
    )

    assert resp.status_code == 422
    assert db.query(Job).filter(Job.type == "transcribe").count() == 0


def test_get_transcript_wrong_user(client, test_user, auth_headers, db):
    """VOD owned by another user should return 404."""
    from database import User

    other = User(username="other", api_token="other-token")
    db.add(other)
    db.commit()
    db.refresh(other)

    course = Course(moodle_id=999, owner_id=other.id, name="Other Course", is_active=True)
    db.add(course)
    db.commit()
    db.refresh(course)

    vod = VOD(
        moodle_id=777, course_id=course.id, title="Other VOD",
        is_completed=False, has_tracking=True, url="http://example.com/v",
    )
    db.add(vod)
    db.commit()

    resp = client.get("/vods/777/transcript", headers=auth_headers)
    assert resp.status_code == 404
