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
    # When the current api_token was last established. Tokens age out from here, so a
    # copied token stops working even if the thief never triggers a logout.
    token_issued_at = Column(DateTime, nullable=True)
    
    # Push Notifications
    push_token = Column(String, nullable=True)
    notification_preferences = Column(JSON, default=dict)
    notifications_initialized = Column(Boolean, default=False)  # False = first sync pending (no notifications)

    # Session health
    session_expired_notified = Column(Boolean, default=False)  # True = already sent "session expired" push

    # AI Chat rate limiting
    chat_count_today = Column(Integer, default=0)
    chat_count_date = Column(String, nullable=True)  # ISO date "2026-03-16"

    # Transcription rate limiting
    transcribe_count_today = Column(Integer, default=0)
    transcribe_count_date = Column(String, nullable=True)

    # Hidden lab settings
    labs_unlocked = Column(Boolean, default=False)
    auto_watch_enabled = Column(Boolean, default=False)
    brain_enabled = Column(Boolean, default=False)
    
    courses = relationship("Course", back_populates="owner", cascade="all, delete-orphan")
    push_tokens = relationship("PushToken", back_populates="owner", cascade="all, delete-orphan")
    notification_history = relationship("NotificationHistory", back_populates="owner", cascade="all, delete-orphan")
    flashcard_decks = relationship("FlashcardDeck", back_populates="owner", cascade="all, delete-orphan")

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

    # Who teaches it. Absent from both the course page and the enrolment list, so it
    # costs one extra request against the participants list — fetched once and cached
    # here rather than asked for on every sync.
    professor = Column(String, nullable=True)
    professor_fetched_at = Column(DateTime, nullable=True)

    # Course brain. Opting a course in triggers one full sweep (transcribe every
    # lecture, extract and caption every file); afterwards each sync tops it up with
    # whatever is new. Kept per-course because a sweep costs real money and time, so
    # it is the student's choice which courses are worth it.
    brain_enabled = Column(Boolean, default=False)
    # Which kinds of material this course learns, e.g. {"vods": true, "files": true,
    # "assignments": false}. Per-course because the cost is lopsided: transcribing
    # lectures dominates a build, and a course may be worth reading without being worth
    # listening to. Missing keys default to on — see course_brain.scope_of.
    brain_scope = Column(JSON, nullable=True)
    brain_status = Column(String, nullable=True)     # queued | building | ready | error
    brain_progress = Column(Integer, default=0)      # 0-100, for the progress bar
    brain_stage = Column(String, nullable=True)      # human label, e.g. "강의 4/12 변환 중"
    brain_error = Column(Text, nullable=True)
    brain_built_at = Column(DateTime, nullable=True)

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
    completion_overridden = Column(Boolean, default=False)
    url = Column(String)

    # Which course section (week) this sits under, captured at scrape time.
    section = Column(Integer, nullable=True)
    week = Column(String, nullable=True)

    # The activity's own instructions, fetched lazily from its page. The course listing
    # carries only a title and a deadline, which is not enough to answer what the work
    # actually is.
    description = Column(Text, nullable=True)
    description_fetched_at = Column(DateTime, nullable=True)
    
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

    # Which course section (week) this sits under, captured at scrape time.
    section = Column(Integer, nullable=True)
    week = Column(String, nullable=True)
    duration = Column(Integer, nullable=True)  # video duration in seconds, scraped from course page

    course = relationship("Course", back_populates="vods")

class VodTranscript(Base):
    __tablename__ = 'vod_transcripts'

    id = Column(Integer, primary_key=True, autoincrement=True)
    moodle_id = Column(Integer, unique=True, index=True, nullable=False)
    is_processing = Column(Boolean, default=False)
    status = Column(String, default='queued')  # queued | running | done | failed
    stage = Column(String, nullable=True)      # queued | extracting_audio | transcribing | finalizing | completed | failed
    progress_pct = Column(Integer, default=0)
    transcript = Column(Text, nullable=True)
    summary = Column(Text, nullable=True)
    error_message = Column(Text, nullable=True)
    started_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.now)

class FileResource(Base):
    __tablename__ = 'files'
    id = Column(Integer, primary_key=True, autoincrement=True)
    moodle_id = Column(Integer)
    course_id = Column(Integer, ForeignKey('courses.id'))
    
    title = Column(String)
    url = Column(String)

    # Which course section (week) this sits under, captured at scrape time.
    section = Column(Integer, nullable=True)
    week = Column(String, nullable=True)
    
    is_completed = Column(Boolean, default=False)

    # The downloaded original, kept as the source of truth. Extraction is lossy and its
    # quality keeps improving, so holding the file means every future pass is a local
    # re-run rather than a re-download needing a live LearnUs session.
    local_path = Column(String, nullable=True)
    file_bytes = Column(Integer, nullable=True)
    file_kind = Column(String, nullable=True)          # pdf | ipynb | txt | ...

    # Extracted text, plus captions folded in for pages whose content was visual.
    content = Column(Text, nullable=True)
    content_chars = Column(Integer, nullable=True)
    page_count = Column(Integer, nullable=True)
    captioned_pages = Column(Integer, default=0)
    extract_status = Column(String, nullable=True)     # ok | empty | unsupported | too_large | error
    extract_error = Column(Text, nullable=True)
    extracted_at = Column(DateTime, nullable=True)

    course = relationship("Course", back_populates="files")

class Board(Base):
    __tablename__ = 'boards'
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    moodle_id = Column(Integer)
    course_id = Column(Integer, ForeignKey('courses.id'))
    
    title = Column(String)
    url = Column(String)

    # Which course section (week) this sits under, captured at scrape time.
    section = Column(Integer, nullable=True)
    week = Column(String, nullable=True)
    
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


class AIUsageLog(Base):
    """Tracks OpenAI token usage per user per request for cost monitoring."""
    __tablename__ = 'ai_usage_logs'

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey('users.id'), nullable=True)  # null for system/scheduler calls
    endpoint = Column(String, nullable=False)       # e.g. "chat", "summarize", "transcribe", "dashboard"
    model = Column(String, nullable=False)           # e.g. "gpt-4o-mini", "whisper-1"
    prompt_tokens = Column(Integer, default=0)
    completion_tokens = Column(Integer, default=0)
    total_tokens = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.now)


class FlashcardDeck(Base):
    __tablename__ = 'flashcard_decks'

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey('users.id'), nullable=False)
    vod_moodle_id = Column(Integer, nullable=False)
    name = Column(String, nullable=False)
    course_name = Column(String, nullable=True)
    card_count = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.now)

    owner = relationship("User", back_populates="flashcard_decks")
    cards = relationship("Flashcard", back_populates="deck", cascade="all, delete-orphan", order_by="Flashcard.position")


class Flashcard(Base):
    __tablename__ = 'flashcards'

    id = Column(Integer, primary_key=True, autoincrement=True)
    deck_id = Column(Integer, ForeignKey('flashcard_decks.id'), nullable=False)
    position = Column(Integer, nullable=False)
    front = Column(Text, nullable=False)
    back = Column(Text, nullable=False)

    deck = relationship("FlashcardDeck", back_populates="cards")


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

    # Inspect BEFORE create_all so we can detect which tables/columns are missing
    from sqlalchemy import text, inspect as sa_inspect
    inspector = sa_inspect(engine)
    existing_tables = inspector.get_table_names()

    # Migration: migrate existing push_token data BEFORE create_all creates the new table
    needs_push_token_migration = 'push_tokens' not in existing_tables and 'users' in existing_tables
    needs_notif_history_table = 'notification_history' not in existing_tables

    Base.metadata.create_all(engine)

    if needs_push_token_migration:
        logger.info("Migrating existing push tokens to push_tokens table...")
        with engine.connect() as conn:
            rows = conn.execute(text("SELECT id, push_token FROM users WHERE push_token IS NOT NULL AND push_token != ''")).fetchall()
            for row in rows:
                conn.execute(text("INSERT INTO push_tokens (user_id, token) VALUES (:uid, :tok)"), {"uid": row[0], "tok": row[1]})
            if rows:
                conn.commit()
                logger.info(f"Migrated {len(rows)} push tokens to push_tokens table")

    if needs_notif_history_table:
        logger.info("Created notification_history table")

    # Refresh inspector after create_all
    inspector = sa_inspect(engine)

    def _add_column_if_missing(table_name: str, column_name: str, ddl_sql: str) -> bool:
        """Returns True when the column was actually added, so callers can backfill it."""
        cols = [col['name'] for col in sa_inspect(engine).get_columns(table_name)]
        if column_name in cols:
            return False
        with engine.connect() as conn:
            conn.execute(text(ddl_sql))
            conn.commit()
        return True

    # Migration: add notifications_initialized column if it doesn't exist yet.
    # Existing users are marked True (already past first sync); new users default False.
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

    # Migration: add transcription rate limit columns to users
    if 'transcribe_count_today' not in existing_cols:
        with engine.connect() as conn:
            conn.execute(text("ALTER TABLE users ADD COLUMN transcribe_count_today INTEGER DEFAULT 0"))
            conn.execute(text("ALTER TABLE users ADD COLUMN transcribe_count_date TEXT"))
            conn.commit()

    # Migration: add hidden lab settings to users. Existing and new users default off.
    user_cols = [col['name'] for col in sa_inspect(engine).get_columns('users')]
    if 'labs_unlocked' not in user_cols:
        with engine.connect() as conn:
            conn.execute(text("ALTER TABLE users ADD COLUMN labs_unlocked BOOLEAN DEFAULT FALSE"))
            conn.commit()
    user_cols = [col['name'] for col in sa_inspect(engine).get_columns('users')]
    if 'auto_watch_enabled' not in user_cols:
        with engine.connect() as conn:
            conn.execute(text("ALTER TABLE users ADD COLUMN auto_watch_enabled BOOLEAN DEFAULT FALSE"))
            conn.commit()

    # Migration: create ai_usage_logs table
    refreshed_tables = sa_inspect(engine).get_table_names()
    if 'ai_usage_logs' not in refreshed_tables:
        AIUsageLog.__table__.create(engine)
        logger.info("Created ai_usage_logs table")

    # Migration: allow preserving manually overridden assignment completion state
    refreshed_tables = sa_inspect(engine).get_table_names()
    if 'assignments' in refreshed_tables:
        _add_column_if_missing(
            'assignments',
            'completion_overridden',
            "ALTER TABLE assignments ADD COLUMN completion_overridden BOOLEAN DEFAULT FALSE",
        )

    # Migration: record which course section (week) each item belongs to.
    #
    # Only recoverable while parsing the course page — the activity markup carries no
    # back reference to its section, so anything synced before this migration has NULL
    # until its course is re-synced.
    refreshed_tables = sa_inspect(engine).get_table_names()
    for _tbl in ('assignments', 'vods', 'files', 'boards'):
        if _tbl in refreshed_tables:
            _add_column_if_missing(_tbl, 'section', f"ALTER TABLE {_tbl} ADD COLUMN section INTEGER")
            _add_column_if_missing(_tbl, 'week', f"ALTER TABLE {_tbl} ADD COLUMN week VARCHAR")

    # Migration: vods.duration was added to the model without one, so any database
    # created before it exists on disk without the column and every VOD query fails.
    if 'vods' in refreshed_tables:
        _add_column_if_missing('vods', 'duration', "ALTER TABLE vods ADD COLUMN duration INTEGER")

    # Migration: course brain opt-in, separate from auto-watch.
    if 'users' in refreshed_tables:
        _add_column_if_missing('users', 'brain_enabled',
                               "ALTER TABLE users ADD COLUMN brain_enabled BOOLEAN DEFAULT FALSE")

    # Migration: API token expiry. Existing tokens are stamped now rather than left
    # null, so adding expiry does not sign every current user out on deploy.
    if 'users' in refreshed_tables:
        if _add_column_if_missing('users', 'token_issued_at',
                                  "ALTER TABLE users ADD COLUMN token_issued_at TIMESTAMP"):
            try:
                with engine.begin() as conn:
                    conn.execute(text(
                        "UPDATE users SET token_issued_at = CURRENT_TIMESTAMP "
                        "WHERE token_issued_at IS NULL AND api_token IS NOT NULL"
                    ))
            except Exception as e:
                logger.warning(f"token_issued_at backfill skipped: {e}")

    # Migration: course teaching staff.
    if 'courses' in refreshed_tables:
        for _col, _ddl in (
            ('professor',            "ALTER TABLE courses ADD COLUMN professor VARCHAR"),
            ('professor_fetched_at', "ALTER TABLE courses ADD COLUMN professor_fetched_at TIMESTAMP"),
        ):
            _add_column_if_missing('courses', _col, _ddl)

    # Migration: per-course brain opt-in and build state.
    if 'courses' in refreshed_tables:
        for _col, _ddl in (
            ('brain_enabled',  "ALTER TABLE courses ADD COLUMN brain_enabled BOOLEAN DEFAULT FALSE"),
            ('brain_scope',    "ALTER TABLE courses ADD COLUMN brain_scope JSON"),
            ('brain_status',   "ALTER TABLE courses ADD COLUMN brain_status VARCHAR"),
            ('brain_progress', "ALTER TABLE courses ADD COLUMN brain_progress INTEGER DEFAULT 0"),
            ('brain_stage',    "ALTER TABLE courses ADD COLUMN brain_stage VARCHAR"),
            ('brain_error',    "ALTER TABLE courses ADD COLUMN brain_error TEXT"),
            ('brain_built_at', "ALTER TABLE courses ADD COLUMN brain_built_at TIMESTAMP"),
        ):
            _add_column_if_missing('courses', _col, _ddl)

        # Backfill: a course built before the per-course toggle existed already has a
        # corpus, and defaulting it to disabled would silently 403 a chat that worked
        # yesterday. Anything with extracted file text counts as already built.
        try:
            with engine.begin() as conn:
                conn.execute(text("""
                    UPDATE courses SET brain_enabled = TRUE,
                                       brain_status = 'ready',
                                       brain_progress = 100
                    WHERE COALESCE(brain_enabled, FALSE) = FALSE
                      AND brain_status IS NULL
                      AND id IN (SELECT DISTINCT course_id FROM files
                                 WHERE content IS NOT NULL AND content <> '')
                """))
        except Exception as e:
            logger.warning(f"brain backfill skipped: {e}")

    # Migration: assignment instructions, fetched from the activity page.
    if 'assignments' in refreshed_tables:
        _add_column_if_missing('assignments', 'description',
                               "ALTER TABLE assignments ADD COLUMN description TEXT")
        _add_column_if_missing('assignments', 'description_fetched_at',
                               "ALTER TABLE assignments ADD COLUMN description_fetched_at TIMESTAMP")

    # Migration: downloaded originals and their extracted text.
    if 'files' in refreshed_tables:
        for _col, _ddl in (
            ('file_bytes',      "ALTER TABLE files ADD COLUMN file_bytes INTEGER"),
            ('file_kind',       "ALTER TABLE files ADD COLUMN file_kind VARCHAR"),
            ('content',         "ALTER TABLE files ADD COLUMN content TEXT"),
            ('content_chars',   "ALTER TABLE files ADD COLUMN content_chars INTEGER"),
            ('page_count',      "ALTER TABLE files ADD COLUMN page_count INTEGER"),
            ('captioned_pages', "ALTER TABLE files ADD COLUMN captioned_pages INTEGER DEFAULT 0"),
            ('extract_status',  "ALTER TABLE files ADD COLUMN extract_status VARCHAR"),
            ('extract_error',   "ALTER TABLE files ADD COLUMN extract_error TEXT"),
            ('extracted_at',    "ALTER TABLE files ADD COLUMN extracted_at TIMESTAMP"),
        ):
            _add_column_if_missing('files', _col, _ddl)

    # Migration: add transcription status columns
    refreshed_tables = sa_inspect(engine).get_table_names()
    if 'vod_transcripts' in refreshed_tables:
        _add_column_if_missing('vod_transcripts', 'status', "ALTER TABLE vod_transcripts ADD COLUMN status TEXT DEFAULT 'queued'")
        _add_column_if_missing('vod_transcripts', 'stage', "ALTER TABLE vod_transcripts ADD COLUMN stage TEXT")
        _add_column_if_missing('vod_transcripts', 'progress_pct', "ALTER TABLE vod_transcripts ADD COLUMN progress_pct INTEGER DEFAULT 0")
        _add_column_if_missing('vod_transcripts', 'error_message', "ALTER TABLE vod_transcripts ADD COLUMN error_message TEXT")
        _add_column_if_missing('vod_transcripts', 'started_at', "ALTER TABLE vod_transcripts ADD COLUMN started_at TIMESTAMP")
        _add_column_if_missing('vod_transcripts', 'completed_at', "ALTER TABLE vod_transcripts ADD COLUMN completed_at TIMESTAMP")

        # Backfill legacy rows
        with engine.connect() as conn:
            conn.execute(text("""
                UPDATE vod_transcripts
                SET status = CASE
                    WHEN is_processing = TRUE THEN 'running'
                    WHEN transcript IS NOT NULL AND transcript != '' THEN 'done'
                    ELSE COALESCE(status, 'queued')
                END
                WHERE status IS NULL OR status = ''
            """))
            conn.execute(text("""
                UPDATE vod_transcripts
                SET stage = CASE
                    WHEN status = 'running' THEN COALESCE(stage, 'transcribing')
                    WHEN status = 'done' THEN COALESCE(stage, 'completed')
                    WHEN status = 'failed' THEN COALESCE(stage, 'failed')
                    ELSE COALESCE(stage, 'queued')
                END
                WHERE stage IS NULL OR stage = ''
            """))
            conn.execute(text("""
                UPDATE vod_transcripts
                SET progress_pct = CASE
                    WHEN status = 'done' THEN 100
                    WHEN status = 'failed' THEN 0
                    WHEN status = 'running' THEN COALESCE(progress_pct, 10)
                    ELSE COALESCE(progress_pct, 0)
                END
                WHERE progress_pct IS NULL
            """))
            conn.commit()

    return sessionmaker(bind=engine)
