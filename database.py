import os
import logging
from sqlalchemy import create_engine, Column, Integer, String, Boolean, DateTime, ForeignKey, Text, UniqueConstraint, JSON, Enum as SAEnum

logger = logging.getLogger(__name__)


from sqlalchemy.orm import declarative_base, relationship, sessionmaker
from datetime import datetime

Base = declarative_base()

class User(Base):
    __tablename__ = 'users'
    
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True)
    hashed_password = Column(String)
    
    # API Auth
    api_token = Column(String, unique=True, index=True, nullable=True)
    
    # Moodle Credentials/Session
    moodle_username = Column(String, nullable=True)
    moodle_password = Column(String, nullable=True)
    moodle_cookies = Column(Text, nullable=True) # JSON
    
    # Push Notifications
    push_token = Column(String, nullable=True)
    notification_preferences = Column(JSON, default={})
    notifications_initialized = Column(Boolean, default=False)  # False = first sync pending (no notifications)

    # Session health
    session_expired_notified = Column(Boolean, default=False)  # True = already sent "session expired" push

    # AI Chat rate limiting
    chat_count_today = Column(Integer, default=0)
    chat_count_date = Column(String, nullable=True)  # ISO date "2026-03-16"
    
    courses = relationship("Course", back_populates="owner", cascade="all, delete-orphan")
    push_tokens = relationship("PushToken", back_populates="owner", cascade="all, delete-orphan")
    notification_history = relationship("NotificationHistory", back_populates="owner", cascade="all, delete-orphan")

class PushToken(Base):
    """One user can have multiple devices, each with its own Expo push token."""
    __tablename__ = 'push_tokens'

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey('users.id'), nullable=False)
    token = Column(String, nullable=False, index=True)
    device_name = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.now)

    owner = relationship("User", back_populates="push_tokens")

    __table_args__ = (UniqueConstraint('token', name='_push_token_uc'),)


class NotificationHistory(Base):
    __tablename__ = 'notification_history'

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey('users.id'), nullable=False)
    title = Column(String, nullable=False)
    body = Column(Text, nullable=True)
    type = Column(String, default='general')  # assignment, vod, announcement, ai_summary, etc.
    data = Column(JSON, nullable=True)
    read = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.now)

    owner = relationship("User", back_populates="notification_history")


class Course(Base):
    __tablename__ = 'courses'
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    moodle_id = Column(Integer, index=True)
    owner_id = Column(Integer, ForeignKey('users.id'), nullable=False)
    
    name = Column(String)
    last_updated = Column(DateTime, default=datetime.now)
    is_active = Column(Boolean, default=True)
    is_initialized = Column(Boolean, default=False)  # True = first sync done, notifications enabled for this course

    owner = relationship("User", back_populates="courses")
    
    assignments = relationship("Assignment", back_populates="course", cascade="all, delete-orphan")
    vods = relationship("VOD", back_populates="course", cascade="all, delete-orphan")
    files = relationship("FileResource", back_populates="course", cascade="all, delete-orphan")
    boards = relationship("Board", back_populates="course", cascade="all, delete-orphan")
    
    __table_args__ = (UniqueConstraint('moodle_id', 'owner_id', name='_user_moodle_course_uc'),)

class Assignment(Base):
    __tablename__ = 'assignments'
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    moodle_id = Column(Integer)
    course_id = Column(Integer, ForeignKey('courses.id'))
    
    title = Column(String)
    due_date = Column(String)
    is_completed = Column(Boolean, default=False)
    url = Column(String)
    
    course = relationship("Course", back_populates="assignments")

class VOD(Base):
    __tablename__ = 'vods'
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    moodle_id = Column(Integer)
    course_id = Column(Integer, ForeignKey('courses.id'))
    
    title = Column(String)
    start_date = Column(String)
    end_date = Column(String)
    is_completed = Column(Boolean, default=False)
    has_tracking = Column(Boolean, default=True)
    url = Column(String)
    duration = Column(Integer, nullable=True)  # video duration in seconds, scraped from course page

    course = relationship("Course", back_populates="vods")

class VodTranscript(Base):
    __tablename__ = 'vod_transcripts'

    id = Column(Integer, primary_key=True, autoincrement=True)
    moodle_id = Column(Integer, unique=True, index=True, nullable=False)
    is_processing = Column(Boolean, default=False)
    transcript = Column(Text, nullable=True)
    summary = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.now)

class FileResource(Base):
    __tablename__ = 'files'
    id = Column(Integer, primary_key=True, autoincrement=True)
    moodle_id = Column(Integer)
    course_id = Column(Integer, ForeignKey('courses.id'))
    
    title = Column(String)
    url = Column(String)
    
    is_completed = Column(Boolean, default=False)
    local_path = Column(String, nullable=True)
    
    course = relationship("Course", back_populates="files")

class Board(Base):
    __tablename__ = 'boards'
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    moodle_id = Column(Integer)
    course_id = Column(Integer, ForeignKey('courses.id'))
    
    title = Column(String)
    url = Column(String)
    
    course = relationship("Course", back_populates="boards")
    posts = relationship("Post", back_populates="board", cascade="all, delete-orphan")

class Post(Base):
    __tablename__ = 'posts'
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    board_id = Column(Integer, ForeignKey('boards.id'))
    
    title = Column(String)
    writer = Column(String)
    date = Column(String)
    content = Column(Text)
    url = Column(String)
    
    board = relationship("Board", back_populates="posts")

class Job(Base):
    """Persistent job queue — processed by the worker container."""
    __tablename__ = 'jobs'

    id = Column(Integer, primary_key=True, autoincrement=True)
    type = Column(String, nullable=False)           # 'transcribe' | 'watch_all' | 'watch_one'
    payload = Column(JSON, nullable=False)          # job-specific data
    status = Column(String, default='pending')      # pending | processing | done | failed
    created_at = Column(DateTime, default=datetime.now)
    started_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)
    error = Column(Text, nullable=True)


class LoginDebugReport(Base):
    __tablename__ = 'login_debug_reports'

    id = Column(Integer, primary_key=True, autoincrement=True)
    device_info = Column(String, nullable=True)
    log_json = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.now)

def init_db(db_url=None):
    if not db_url:
        db_url = os.getenv('DATABASE_URL', 'sqlite:///learnus.db')
    if db_url.startswith("postgres://"):
        db_url = db_url.replace("postgres://", "postgresql://", 1)
    engine = create_engine(db_url)
    Base.metadata.create_all(engine)

    # Migration: add notifications_initialized column if it doesn't exist yet.
    # Existing users are marked True (already past first sync); new users default False.
    from sqlalchemy import text, inspect as sa_inspect
    inspector = sa_inspect(engine)
    existing_cols = [col['name'] for col in inspector.get_columns('users')]
    if 'notifications_initialized' not in existing_cols:
        with engine.connect() as conn:
            conn.execute(text("ALTER TABLE users ADD COLUMN notifications_initialized BOOLEAN"))
            conn.execute(text("UPDATE users SET notifications_initialized = TRUE"))
            conn.commit()

    # Migration: add is_initialized to courses.
    # Existing courses belonging to initialized users are marked True.
    # New courses default to False so their first sync is silent.
    course_cols = [col['name'] for col in inspector.get_columns('courses')]
    if 'is_initialized' not in course_cols:
        with engine.connect() as conn:
            conn.execute(text("ALTER TABLE courses ADD COLUMN is_initialized BOOLEAN DEFAULT FALSE"))
            conn.execute(text("""
                UPDATE courses SET is_initialized = TRUE
                WHERE owner_id IN (SELECT id FROM users WHERE notifications_initialized = TRUE)
            """))
            conn.commit()

    # Migration: add AI chat rate limit columns to users
    if 'chat_count_today' not in existing_cols:
        with engine.connect() as conn:
            conn.execute(text("ALTER TABLE users ADD COLUMN chat_count_today INTEGER DEFAULT 0"))
            conn.execute(text("ALTER TABLE users ADD COLUMN chat_count_date TEXT"))
            conn.commit()

    # Migration: add session_expired_notified column to users
    if 'session_expired_notified' not in existing_cols:
        with engine.connect() as conn:
            conn.execute(text("ALTER TABLE users ADD COLUMN session_expired_notified BOOLEAN DEFAULT FALSE"))
            conn.commit()

    # Migration: create jobs table if it doesn't exist yet
    # (Base.metadata.create_all handles new tables automatically, but explicit check for clarity)
    if 'jobs' not in inspector.get_table_names():
        Job.__table__.create(engine)
        logger.info("Created jobs table")

    # Migration: create push_tokens table and migrate existing single-token data
    if 'push_tokens' not in inspector.get_table_names():
        PushToken.__table__.create(engine)
        logger.info("Created push_tokens table")
        # Migrate existing push_token values from users table
        with engine.connect() as conn:
            rows = conn.execute(text("SELECT id, push_token FROM users WHERE push_token IS NOT NULL AND push_token != ''")).fetchall()
            for row in rows:
                conn.execute(text("INSERT INTO push_tokens (user_id, token) VALUES (:uid, :tok)"), {"uid": row[0], "tok": row[1]})
            if rows:
                conn.commit()
                logger.info(f"Migrated {len(rows)} push tokens to push_tokens table")

    # Migration: create notification_history table
    if 'notification_history' not in inspector.get_table_names():
        NotificationHistory.__table__.create(engine)
        logger.info("Created notification_history table")

    return sessionmaker(bind=engine)
