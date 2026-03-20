import os
import sys

# Must set TESTING before importing api so init_db() is skipped
os.environ["TESTING"] = "1"

# Ensure project root is on the path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import pytest
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from fastapi.testclient import TestClient

from database import Base, User, Course, Assignment, VOD, Board, Post, VodTranscript, Job
from api import app, get_db


@pytest.fixture()
def db():
    """In-memory SQLite database, fresh per test.

    Uses StaticPool + check_same_thread=False so the same connection
    is shared across the test thread and FastAPI's TestClient thread.
    """
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    # SQLite doesn't enforce FK constraints by default
    @event.listens_for(engine, "connect")
    def _set_sqlite_pragma(dbapi_conn, connection_record):
        cursor = dbapi_conn.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()

    Base.metadata.create_all(engine)
    TestingSession = sessionmaker(bind=engine)
    session = TestingSession()
    try:
        yield session
    finally:
        session.close()
        engine.dispose()


@pytest.fixture()
def test_user(db):
    """Insert a test user and return it."""
    user = User(
        username="testuser",
        api_token="test-token-123",
        moodle_username="testuser",
        moodle_cookies="MoodleSession=abc123; MOODLEID1_=xyz",
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@pytest.fixture()
def client(db):
    """FastAPI TestClient with DB dependency overridden to use in-memory SQLite."""

    def _override_get_db():
        try:
            yield db
        finally:
            pass

    app.dependency_overrides[get_db] = _override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


@pytest.fixture()
def auth_headers():
    """Standard auth headers using the test user's token."""
    return {"X-API-Token": "test-token-123"}
