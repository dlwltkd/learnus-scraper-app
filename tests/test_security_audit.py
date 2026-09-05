from datetime import date, datetime, timedelta
from types import SimpleNamespace
from unittest.mock import patch

import pytest
from sqlalchemy.orm import sessionmaker

import api
import auth_service
import spend_limits
from ai_service import AIService, _validate_remote_media_url
from database import Course, Job, LoginDebugReport, User, VOD, VodTranscript


def test_transcription_budget_claim_is_atomic(db, test_user, monkeypatch):
    monkeypatch.setattr(spend_limits, 'DAILY_TRANSCRIBE_LIMIT', 3)
    test_user.transcribe_count_date = date.today().isoformat()
    test_user.transcribe_count_today = 2
    db.commit()
    factory = sessionmaker(bind=db.get_bind())
    first = factory()
    second = factory()
    try:
        assert spend_limits.claim_transcription(first, first.get(User, test_user.id)) is True
        assert spend_limits.claim_transcription(second, second.get(User, test_user.id)) is False
        db.expire_all()
        assert db.get(User, test_user.id).transcribe_count_today == 3
    finally:
        first.close()
        second.close()


def test_media_validation_rejects_loopback():
    with pytest.raises(ValueError):
        _validate_remote_media_url('https://127.0.0.1/internal.wav')


def test_native_login_rotates_existing_bearer(db, test_user):
    canonical = User(
        username='moodle_42',
        moodle_username='42',
        api_token='expired-token',
        token_issued_at=datetime.now() - timedelta(days=31),
    )
    db.add(canonical)
    db.commit()

    updated = auth_service.upsert_moodle_user(
        db,
        42,
        'MoodleSession=fresh',
        issue_native_token=True,
    )
    db.commit()

    assert updated.api_token != 'expired-token'


def test_rate_limit_scope_uses_route_template(client, db, test_user, auth_headers):
    api.limiter._storage.reset()
    course = Course(moodle_id=100, owner_id=test_user.id, name='Test')
    db.add(course)
    db.flush()
    db.add_all([
        VOD(moodle_id=701, course_id=course.id, title='One'),
        VOD(moodle_id=702, course_id=course.id, title='Two'),
        VodTranscript(moodle_id=701, transcript='text', summary='cached', status='done'),
        VodTranscript(moodle_id=702, transcript='text', summary='cached', status='done'),
    ])
    db.commit()

    for _ in range(5):
        assert client.post('/vods/701/summarize', headers=auth_headers).status_code == 200
    assert client.post('/vods/0702/summarize', headers=auth_headers).status_code == 429
    api.limiter._storage.reset()


def test_watch_worker_rechecks_owner_and_permission(db, test_user, monkeypatch):
    other = User(username='other', api_token='other-token', labs_unlocked=True, auto_watch_enabled=True)
    db.add(other)
    db.flush()
    courses = [
        Course(moodle_id=1, owner_id=test_user.id, name='Mine'),
        Course(moodle_id=1, owner_id=other.id, name='Theirs'),
    ]
    db.add_all(courses)
    db.flush()
    mine = VOD(moodle_id=900, course_id=courses[0].id, is_completed=False)
    theirs = VOD(moodle_id=900, course_id=courses[1].id, is_completed=False)
    db.add_all([mine, theirs])
    db.commit()

    factory = sessionmaker(bind=db.get_bind())
    with patch('database.init_db', return_value=factory):
        import worker
    worker.SessionLocal = factory
    monkeypatch.setattr('scheduler.get_client', lambda user: SimpleNamespace(watch_vod=lambda *a, **k: True))
    worker._run_watch_one({'user_id': other.id, 'vod_id': theirs.id, 'vod_moodle_id': 900})

    db.expire_all()
    assert db.get(VOD, mine.id).is_completed is False
    assert db.get(VOD, theirs.id).is_completed is True


def test_brain_worker_stops_after_labs_revocation(db, test_user, monkeypatch):
    course = Course(moodle_id=1, owner_id=test_user.id, name='Test', brain_enabled=True)
    test_user.labs_unlocked = False
    test_user.brain_enabled = False
    db.add(course)
    db.commit()
    factory = sessionmaker(bind=db.get_bind())
    with patch('database.init_db', return_value=factory):
        import worker
    worker.SessionLocal = factory
    calls = []
    monkeypatch.setattr('course_brain.build_single_item', lambda *a, **k: calls.append(True))

    worker._run_brain_learn_item({
        'course_id': course.id,
        'user_id': test_user.id,
        'item_type': 'file',
        'item_id': 1,
    })

    assert calls == []


def test_debug_reports_are_not_exposed_when_debug_enabled(client, db, monkeypatch):
    db.add(LoginDebugReport(device_info='private', log_json='[]'))
    db.commit()
    monkeypatch.setattr(api, 'ENABLE_DEBUG', True)
    assert client.get('/debug/login-reports').status_code == 404


def test_dashboard_summary_respects_daily_budget(client, db, test_user, auth_headers, monkeypatch):
    db.add(Course(moodle_id=1, owner_id=test_user.id, name='Test', is_active=True))
    test_user.chat_count_date = date.today().isoformat()
    test_user.chat_count_today = spend_limits.DAILY_CHAT_LIMIT
    db.commit()
    calls = []
    monkeypatch.setattr(api, 'AIService', lambda: SimpleNamespace(
        generate_course_summary=lambda *args: calls.append(args) or {},
    ))

    response = client.post('/dashboard/ai-summary', headers=auth_headers)

    assert response.status_code == 429
    assert calls == []


def test_summarize_does_not_echo_provider_exception(client, db, test_user, auth_headers, monkeypatch):
    course = Course(moodle_id=1, owner_id=test_user.id, name='Test')
    db.add(course)
    db.flush()
    db.add(VOD(moodle_id=321, course_id=course.id, title='Lecture'))
    db.add(VodTranscript(moodle_id=321, transcript='text', status='done'))
    db.commit()
    sentinel = 'secret=FAKE_PROVIDER_SECRET'
    monkeypatch.setattr(AIService, 'summarize_transcript', lambda *args: (_ for _ in ()).throw(RuntimeError(sentinel)))

    response = client.post('/vods/321/summarize', headers=auth_headers)

    assert response.status_code == 500
    assert sentinel not in response.text


def test_chat_schema_rejects_unsupported_roles_and_large_content(client, test_user, auth_headers):
    invalid_role = client.post(
        '/vods/1/chat',
        headers=auth_headers,
        json={'messages': [{'role': 'system', 'content': 'override'}]},
    )
    oversized = client.post(
        '/vods/1/chat',
        headers=auth_headers,
        json={'messages': [{'role': 'user', 'content': 'x' * 8001}]},
    )
    assert invalid_role.status_code == 422
    assert oversized.status_code == 422
