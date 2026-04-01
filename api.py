import os
from fastapi import FastAPI, HTTPException, Depends, Header, Request
from fastapi.responses import StreamingResponse
from fastapi.security import APIKeyHeader
from pydantic import BaseModel
from typing import List, Optional
from sqlalchemy.orm import Session
from concurrent.futures import ThreadPoolExecutor, as_completed
from database import init_db, User, Course, Assignment, VOD, Board, Post, VodTranscript, LoginDebugReport, Job, PushToken, NotificationHistory, AIUsageLog, FlashcardDeck, Flashcard
from moodle_client import MoodleClient
from slowapi import Limiter
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address
import logging
import uuid
import json
from datetime import datetime, timedelta
import re

logging.basicConfig(level=logging.INFO)
logging.getLogger('urllib3').setLevel(logging.WARNING)
logging.getLogger('httpcore').setLevel(logging.WARNING)
logging.getLogger('openai').setLevel(logging.WARNING)
logging.getLogger('httpx').setLevel(logging.WARNING)
logger = logging.getLogger(__name__)

SessionLocal = None if os.getenv("TESTING") else init_db()


# --- Rate limiting (per-IP + per-user) ---

def _get_user_key(request: Request) -> str:
    """Rate limit key: use authenticated user token if available, else IP."""
    token = request.headers.get("X-API-Token")
    if token:
        return f"user:{token}"
    return get_remote_address(request)

limiter = Limiter(key_func=_get_user_key)

# ============================================================
# APP VERSION — Reads from learnus-app/app.json automatically.
# To release a new version: update "version" in app.json only.
# ============================================================
def _read_app_version() -> str:
    # Check paths relative to this file, then CWD
    import pathlib
    this_dir = pathlib.Path(__file__).resolve().parent
    candidates = [
        this_dir / 'learnus-app' / 'app.json',
        pathlib.Path('./learnus-app/app.json'),
    ]
    for path in candidates:
        try:
            with open(path, 'r', encoding='utf-8') as f:
                data = json.load(f)
                return data['expo']['version']
        except Exception:
            continue
    return '0.0.0'

app = FastAPI(title="LearnUs Connect API (Beta)")
app.state.limiter = limiter

@app.exception_handler(RateLimitExceeded)
async def rate_limit_handler(request: Request, exc: RateLimitExceeded):
    from fastapi.responses import JSONResponse
    return JSONResponse(
        status_code=429,
        content={"detail": "요청이 너무 많아요. 잠시 후 다시 시도해주세요."},
    )

ENABLE_DEBUG = os.getenv("ENABLE_DEBUG", "false").lower() == "true"


FORCE_UPDATE_MIN_VERSION = "0.4.1"

@app.get("/version")
def get_version():
    return {
        "version": _read_app_version(),
        "force_update_min": FORCE_UPDATE_MIN_VERSION or None,
    }


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

api_key_header = APIKeyHeader(name="X-API-Token", auto_error=False)

def get_current_user(token: str = Depends(api_key_header), db: Session = Depends(get_db)):
    if not token:
        raise HTTPException(status_code=401, detail="Missing Authentication Token")
    user = db.query(User).filter(User.api_token == token).first()
    if not user:
        raise HTTPException(status_code=401, detail="Invalid Authentication Token")
    return user

def _parse_cookie_string(raw: str) -> dict:
    """Parse a raw cookie string into a dict, preserving keyless tokens as empty-value entries."""
    cookies = {}
    for item in raw.split(';'):
        item = item.strip()
        if not item:
            continue
        if '=' in item:
            k, v = item.split('=', 1)
            cookies[k.strip()] = v.strip()
        else:
            # Keyless token (e.g. device UUID) — store with empty value so it's included in requests
            cookies[item] = ''
    return cookies

def get_moodle_client(user: User):
    client = MoodleClient("https://ys.learnus.org")
    if user.moodle_cookies:
        raw = user.moodle_cookies
        if raw.startswith('{'):
            # Legacy format: JSON dict
            try:
                cookies = json.loads(raw)
                client.set_cookies(cookies)
            except Exception:
                pass
        else:
            # New format: raw cookie string
            client.set_cookies(_parse_cookie_string(raw))
    return client


def _is_transcribe_limit_bypassed(user: User) -> bool:
    """Allow test-only transcription limit bypass for selected users/tokens via env vars."""
    bypass_users = {
        u.strip() for u in os.getenv("TRANSCRIBE_BYPASS_USERS", "").split(",") if u.strip()
    }
    bypass_tokens = {
        t.strip() for t in os.getenv("TRANSCRIBE_BYPASS_TOKENS", "").split(",") if t.strip()
    }
    user_keys = {user.username or "", user.moodle_username or "", user.api_token or ""}
    return any(k in bypass_users for k in user_keys if k) or any(k in bypass_tokens for k in user_keys if k)

class CourseResponse(BaseModel):
    id: int
    name: str
    is_active: bool

class CourseActiveUpdate(BaseModel):
    is_active: bool

class AssignmentResponse(BaseModel):
    id: int
    title: str
    course_name: Optional[str] = None
    due_date: Optional[str]
    is_completed: bool
    url: str

class VODResponse(BaseModel):
    id: int
    title: str
    course_name: Optional[str] = None
    start_date: Optional[str]
    end_date: Optional[str]
    is_completed: bool
    url: str

class PostResponse(BaseModel):
    id: int
    title: str
    writer: str
    date: str
    url: str
    content: Optional[str]

class BoardResponse(BaseModel):
    id: int
    title: str
    url: str

class LoginRequest(BaseModel):
    username: str
    password: str

class SessionSyncRequest(BaseModel):
    cookies: str
    user_id: Optional[int] = None

class PushTokenRequest(BaseModel):
    token: str
    device_name: Optional[str] = None

class PreferencesRequest(BaseModel):
    new_assignment: bool = True
    new_vod: bool = True
    notice: bool = True

class ChatRequest(BaseModel):
    messages: list  # [{role: "user"|"assistant", content: str}, ...]

class LoginDebugReportRequest(BaseModel):
    device_info: Optional[str] = None
    logs: list

class FlashcardItem(BaseModel):
    front: str
    back: str

class GenerateFlashcardsRequest(BaseModel):
    count: int = 10

class SaveDeckRequest(BaseModel):
    name: str
    vod_moodle_id: int
    cards: List[FlashcardItem]

class FlashcardDeckResponse(BaseModel):
    id: int
    name: str
    vod_moodle_id: int
    course_name: Optional[str]
    card_count: int
    created_at: str

# Date Parser helper...
class StatsResponse(BaseModel):
    total_assignments_due: int
    completed_assignments_due: int
    missed_assignments_count: int
    missed_vods_count: int

class DashboardOverviewResponse(BaseModel):
    stats: StatsResponse
    upcoming_assignments: List[AssignmentResponse]
    missed_assignments: List[AssignmentResponse]
    available_vods: List[VODResponse]
    missed_vods: List[VODResponse]
    unchecked_vods: List[VODResponse]
    upcoming_vods: List[VODResponse]
    summary: Optional[str] = None

def parse_date(date_str):
    if not date_str or date_str == 'None': return None
    date_str = date_str.replace('&nbsp;', ' ').rstrip('.')
    date_str = " ".join(date_str.split())
    # Further cleanup for potentially trailing dots after split/join or specific formats
    date_str = date_str.rstrip('.')

    try: return datetime.strptime(date_str, "%Y-%m-%d %H:%M:%S")
    except: pass
    try: return datetime.strptime(date_str, "%Y-%m-%d %H:%M")
    except: pass
    try: return datetime.strptime(date_str, "%Y-%m-%d")
    except: pass
    try:
        clean = re.sub(r'[년월일\(\)요일]', ' ', date_str)
        clean = " ".join(clean.split())
        return datetime.strptime(clean, "%Y %m %d %H:%M")
    except: pass
    try:
        clean = re.sub(r'^[A-Za-z]+,\s*', '', date_str)
        return datetime.strptime(clean, "%d %B %Y, %I:%M %p")
    except: pass
    try:
        clean = re.sub(r'\([A-Za-z]+\)', '', date_str)
        clean = re.sub(r'\((\d{1,2}:\d{2}\s*[ap]m)\)', r' \1', clean, flags=re.IGNORECASE)
        clean = " ".join(clean.split())
        current_year = datetime.now().year
        try: return datetime.strptime(f"{current_year} {clean}", "%Y %b %d %I:%M %p")
        except: pass
        try: return datetime.strptime(f"{current_year} {clean}", "%Y %b %d %I:%M%p")
        except: pass
    except: pass

    return None

@app.post("/auth/login")
@limiter.limit("5/minute", key_func=get_remote_address)
def login(request: Request, creds: LoginRequest, db: Session = Depends(get_db)):
    client = MoodleClient("https://ys.learnus.org")
    try:
        client.login(creds.username, creds.password)
    except Exception as e:
        logger.error(f"Moodle Login Failed: {e}")
        raise HTTPException(status_code=401, detail="Moodle Login Failed")
    
    cookies_json = json.dumps(client.session.cookies.get_dict())
    
    user = db.query(User).filter(User.username == creds.username).first()
    if not user:
        user = User(username=creds.username, moodle_username=creds.username, api_token=str(uuid.uuid4()))
        db.add(user)
    else:
        if not user.api_token: user.api_token = str(uuid.uuid4())
            
    user.moodle_password = creds.password
    user.moodle_cookies = cookies_json
    db.commit()
    db.refresh(user)
    db.refresh(user)
    return {"status": "success", "api_token": user.api_token, "username": user.username}

@app.get("/auth/validate-session")
def validate_session(user: User = Depends(get_current_user)):
    """Check if the user's Moodle session (cookies) is still valid."""
    if not user.moodle_cookies:
        return {"valid": False, "reason": "no_cookies"}
    client = get_moodle_client(user)
    if not client.is_session_valid():
        return {"valid": False, "reason": "session_expired"}
    return {"valid": True}

@app.post("/auth/push-token")
def register_push_token(req: PushTokenRequest, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if not req.token: raise HTTPException(400, "Token required")
    # Keep legacy field in sync for backwards compatibility
    user.push_token = req.token
    # Upsert into multi-device push_tokens table
    existing = db.query(PushToken).filter(PushToken.token == req.token).first()
    if existing:
        # Token already registered — reassign to current user if needed
        existing.user_id = user.id
        existing.device_name = req.device_name
    else:
        db.add(PushToken(user_id=user.id, token=req.token, device_name=req.device_name))
    db.commit()
    logger.info(f"Registered push token for {user.username}: {req.token[:15]}...")
    return {"status": "success"}

@app.post("/auth/preferences")
def update_preferences(req: PreferencesRequest, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    # Update preferences. Note: sqlalchemy requires re-assigning for JSON mutation detection sometimes, 
    # but we can just overwrite the whole dict.
    # Current prefs might be None or Dict
    current = user.notification_preferences or {}
    if isinstance(current, str): # Handle potential string from migration if sqlite returns text
        try: current = json.loads(current)
        except: current = {}
        
    current['new_assignment'] = req.new_assignment
    current['new_vod'] = req.new_vod
    current['notice'] = req.notice
    
    user.notification_preferences = current
    # Force mutation flag if needed
    from sqlalchemy.orm.attributes import flag_modified
    flag_modified(user, "notification_preferences")
    
    db.commit()
    logger.info(f"Updated preferences for {user.username}: {user.notification_preferences}")
    return {"status": "success", "preferences": user.notification_preferences}

# ============================================================
# Notification History
# ============================================================

@app.get("/notifications")
def get_notifications(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Get notification history for the current user, newest first."""
    items = (
        db.query(NotificationHistory)
        .filter(NotificationHistory.user_id == user.id)
        .order_by(NotificationHistory.created_at.desc())
        .limit(100)
        .all()
    )
    return [
        {
            "id": n.id,
            "title": n.title,
            "body": n.body,
            "type": n.type,
            "data": n.data,
            "read": n.read,
            "timestamp": int(n.created_at.timestamp() * 1000) if n.created_at else 0,
        }
        for n in items
    ]

@app.put("/notifications/{notif_id}/read")
def mark_notification_read(notif_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    notif = db.query(NotificationHistory).filter(
        NotificationHistory.id == notif_id, NotificationHistory.user_id == user.id
    ).first()
    if not notif:
        raise HTTPException(404, "Notification not found")
    notif.read = True
    db.commit()
    return {"status": "success"}

@app.put("/notifications/read-all")
def mark_all_notifications_read(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    db.query(NotificationHistory).filter(
        NotificationHistory.user_id == user.id, NotificationHistory.read.is_(False)
    ).update({"read": True}, synchronize_session=False)
    db.commit()
    return {"status": "success"}

@app.delete("/notifications/{notif_id}")
def delete_notification(notif_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    notif = db.query(NotificationHistory).filter(
        NotificationHistory.id == notif_id, NotificationHistory.user_id == user.id
    ).first()
    if not notif:
        raise HTTPException(404, "Notification not found")
    db.delete(notif)
    db.commit()
    return {"status": "success"}

@app.delete("/notifications")
def clear_notifications(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    db.query(NotificationHistory).filter(NotificationHistory.user_id == user.id).delete()
    db.commit()
    return {"status": "success"}

@app.post("/auth/sync-session")
def sync_session(req: SessionSyncRequest, db: Session = Depends(get_db)):
    cookies = {}
    if not req.cookies:
        logger.error("No cookies provided in request")
        raise HTTPException(status_code=400, detail="No cookies provided")

    logger.info(f"Raw cookies received (full): {req.cookies}")

    for item in req.cookies.split(';'):
        if '=' in item:
            k, v = item.strip().split('=', 1)
            cookies[k.strip()] = v.strip()

    logger.info(f"Parsed cookie keys: {list(cookies.keys())}")
    moodle_session = cookies.get('MoodleSession', '')
    logger.info(f"MoodleSession value (first 20 chars): {moodle_session[:20]!r}")

    client = MoodleClient("https://ys.learnus.org", cookies=cookies)

    if req.user_id:
        # User ID provided by the WebView — trust it and skip server-side session validation
        uid = req.user_id
        logger.info(f"Using client-provided user_id: {uid}")
    else:
        # Fall back to server-side session validation
        try:
            res = client.session.get("https://ys.learnus.org/my/", timeout=15)
            logger.info(f"Auth check status: {res.status_code}, URL: {res.url}")
            if "login" in res.url:
                logger.warning("Redirected to login page - Cookies invalid!")
        except Exception as e:
            logger.error(f"Network error during auth check: {e}")

        uid = client.get_user_id()
        if not uid:
            logger.error("get_user_id returned None")
            raise HTTPException(status_code=401, detail="Invalid Session or Could not verify user")
    
    # Use moodle_uid as username: "moodle_12345"
    username = f"moodle_{uid}"
    
    user = db.query(User).filter(User.username == username).first()
    if not user:
        user = User(username=username, moodle_username=str(uid), api_token=str(uuid.uuid4()))
        db.add(user)
    else:
        if not user.api_token: user.api_token = str(uuid.uuid4())
    
    # Store raw cookie string to preserve all cookies including keyless tokens (e.g. device UUID)
    user.moodle_cookies = req.cookies
    user.session_expired_notified = False  # Reset — user just re-authenticated
    db.commit()
    db.refresh(user)

    # Auto-sync courses list immediately to ensure DB is populated
    # This may fail on first login if the session is SSO-bound and not yet usable server-side.
    # In that case we return success anyway — the user will need to re-login once their
    # device session matures (Moodle sets the device token on first dashboard load).
    session_usable = True
    try:
        logger.info(f"Auto-syncing courses list for user {user.username} (ID: {user.id})...")
        # Use a fresh client built from the stored raw cookies
        sync_client = get_moodle_client(user)
        courses_data = sync_client.get_courses()

        if not courses_data:
            # Empty list may mean session was rejected — verify
            check = sync_client.session.get("https://ys.learnus.org/my/", timeout=10, allow_redirects=True)
            if "login" in check.url:
                session_usable = False
                logger.warning(f"Session not usable server-side for {user.username} — skipping auto-sync. User should re-login.")
                courses_data = []

        if session_usable:
            existing_count = db.query(Course).filter(Course.owner_id == user.id).count()
            is_new_user = existing_count == 0

            active_ids = set()
            if is_new_user:
                active_ids = sync_client.scrape_active_courses()
                logger.info(f"New user: fetched {len(active_ids)} active course IDs from ubion page.")

            synced_cnt = 0
            for c_data in courses_data:
                course = db.query(Course).filter(Course.moodle_id == c_data['id'], Course.owner_id == user.id).first()
                if not course:
                    is_active = (c_data['id'] in active_ids) if is_new_user else True
                    course = Course(moodle_id=c_data['id'], owner_id=user.id, name=c_data['fullname'], is_active=is_active)
                    db.add(course)
                    synced_cnt += 1
                else:
                    if course.name != c_data['fullname']:
                        course.name = c_data['fullname']
            db.commit()
            logger.info(f"Auto-sync complete. Found {len(courses_data)} courses, {synced_cnt} new.")
    except Exception as e:
        session_usable = False
        logger.error(f"Auto-sync courses failed during session sync: {e}")

    return {
        "status": "success",
        "api_token": user.api_token,
        "username": user.username,
        "session_usable": session_usable,
    }

@app.get("/courses", response_model=List[CourseResponse])
def get_courses(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    courses = db.query(Course).filter(Course.owner_id == user.id).all()
    return [{"id": c.id, "name": c.name, "is_active": c.is_active} for c in courses]

@app.put("/courses/{course_id}/active")
def update_course_active(course_id: int, update: CourseActiveUpdate, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    course = db.query(Course).filter(Course.id == course_id, Course.owner_id == user.id).first()
    if not course: raise HTTPException(404, "Course not found")
    course.is_active = update.is_active
    db.commit()
    return {"status": "success"}

@app.post("/sync/courses")
def sync_courses_list(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    client = get_moodle_client(user)
    try:
        courses_data = client.get_courses()
        synced_count = 0
        for c_data in courses_data:
            course = db.query(Course).filter(Course.moodle_id == c_data['id'], Course.owner_id == user.id).first()
            if not course:
                course = Course(moodle_id=c_data['id'], owner_id=user.id, name=c_data['fullname'])
                db.add(course)
                synced_count += 1
            else:
                if course.name != c_data['fullname']:
                    course.name = c_data['fullname']
                    synced_count += 1
        db.commit()
        return {"status": "success", "message": f"Synced {len(courses_data)} courses."}
    except Exception as e:
        logger.error(f"Sync failed: {e}")
        raise HTTPException(500, str(e))

@app.post("/sync/all-active")
def sync_all_active_courses(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    client = get_moodle_client(user)
    active_courses = db.query(Course).filter(Course.is_active == True, Course.owner_id == user.id).all()
    results, errors = [], []
    for course in active_courses:
        try:
            client.sync_course_to_db(course.moodle_id, db, user.id)
            results.append(f"{course.name}: Success")
        except Exception as e:
            logger.error(f"Failed to sync {course.name}: {e}")
            errors.append(f"{course.name}: Failed")
    return {"status": "success", "details": results + errors}

@app.post("/sync/{course_id}")
def sync_course(course_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    course = db.query(Course).filter(Course.id == course_id, Course.owner_id == user.id).first()
    if not course: raise HTTPException(404, "Course not found")
    client = get_moodle_client(user)
    try:
        summary = client.sync_course_to_db(course.moodle_id, db, user.id)
        return {"status": "success", "message": summary}
    except Exception as e:
        logger.error(f"Sync failed: {e}")
        raise HTTPException(500, str(e))

@app.get("/courses/{course_id}/assignments", response_model=List[AssignmentResponse])
def get_assignments(course_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    course = db.query(Course).filter(Course.id == course_id, Course.owner_id == user.id).first()
    if not course: raise HTTPException(404, "Course not found")
    assigns = db.query(Assignment).filter(Assignment.course_id == course_id).all()
    # Use moodle_id as the exposed id
    return [{"id": a.moodle_id, "title": a.title, "due_date": a.due_date, "is_completed": a.is_completed, "url": a.url, "course_name": course.name} for a in assigns]

@app.get("/courses/{course_id}/vods", response_model=List[VODResponse])
def get_vods(course_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    course = db.query(Course).filter(Course.id == course_id, Course.owner_id == user.id).first()
    if not course: raise HTTPException(404, "Course not found")
    vods = db.query(VOD).filter(VOD.course_id == course_id).all()
    # Use moodle_id as the exposed id
    return [{"id": v.moodle_id, "title": v.title, "start_date": v.start_date, "end_date": v.end_date, "is_completed": v.is_completed, "url": v.url} for v in vods]


def _extract_vod_moodle_id_from_job(job: Job) -> Optional[int]:
    payload = job.payload
    if isinstance(payload, dict):
        return payload.get("vod_moodle_id")
    if isinstance(payload, str):
        try:
            parsed = json.loads(payload)
            if isinstance(parsed, dict):
                return parsed.get("vod_moodle_id")
        except Exception:
            return None
    return None


def _estimate_transcribe_eta_seconds(vod_duration: Optional[int], queue_ahead: int, stage: Optional[str]):
    # Approximate only: extraction + Whisper latency + queue delay.
    base = 180 if not vod_duration else max(120, min(1800, int(vod_duration * 0.7)))
    low = base
    high = int(base * 1.8)

    if queue_ahead > 0:
        low += queue_ahead * 90
        high += queue_ahead * 210

    if stage == "transcribing":
        low = max(30, int(low * 0.35))
        high = max(90, int(high * 0.60))
    elif stage == "finalizing":
        low = 10
        high = 45

    return {"low": low, "high": high}


def _build_transcribe_status(db: Session, vod: VOD, row: Optional[VodTranscript]):
    if not row:
        return {"status": "not_found", "stage": "idle", "progress_pct": 0}

    now = datetime.now()
    stage = row.stage or ("running" if row.is_processing else None)
    status = row.status or ("running" if row.is_processing else ("done" if row.transcript else "queued"))

    if row.transcript and not row.is_processing:
        status = "done"
        stage = "completed"
    elif status == "failed" and not row.is_processing:
        stage = "failed"
    elif row.is_processing and status not in ("running", "queued"):
        status = "running"

    queue_position = None
    queue_ahead = None
    jobs = (
        db.query(Job)
        .filter(Job.type == "transcribe", Job.status.in_(["pending", "processing"]))
        .order_by(Job.created_at, Job.id)
        .all()
    )

    vod_job_index = None
    for idx, job in enumerate(jobs):
        if _extract_vod_moodle_id_from_job(job) == vod.moodle_id:
            vod_job_index = idx
            if job.status == "processing":
                status = "running"
            break

    if status in ("queued", "running"):
        if vod_job_index is not None:
            queue_position = vod_job_index + 1
            queue_ahead = max(0, vod_job_index)
        else:
            # Fallback for legacy rows where queue linkage is missing.
            queue_position = 1 if status == "running" else None
            queue_ahead = 0 if status == "running" else None

    elapsed_seconds = None
    if status in ("queued", "running") and row.created_at:
        elapsed_seconds = int((now - row.created_at).total_seconds())
    elif status in ("done", "failed") and row.started_at and row.completed_at:
        elapsed_seconds = int((row.completed_at - row.started_at).total_seconds())

    eta_seconds = None
    if status in ("queued", "running"):
        eta_seconds = _estimate_transcribe_eta_seconds(vod.duration, queue_ahead or 0, stage)

    progress_pct = row.progress_pct if row.progress_pct is not None else 0
    if status == "done":
        progress_pct = 100
    elif status == "failed":
        progress_pct = 0
    elif status == "queued":
        progress_pct = min(progress_pct, 25)

    return {
        "status": status,
        "stage": stage or "queued",
        "progress_pct": progress_pct,
        "queue_position": queue_position,
        "queue_ahead": queue_ahead,
        "elapsed_seconds": elapsed_seconds,
        "eta_seconds": eta_seconds,
        "error_message": row.error_message or None,
        "updated_at": (row.completed_at or row.started_at or row.created_at).isoformat() if (row.completed_at or row.started_at or row.created_at) else None,
    }


@app.get("/vods/{vod_moodle_id}/transcribe/status")
def get_vod_transcribe_status(vod_moodle_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    vod = db.query(VOD).join(Course).filter(VOD.moodle_id == vod_moodle_id, Course.owner_id == user.id).first()
    if not vod:
        raise HTTPException(404, "VOD not found")
    row = db.query(VodTranscript).filter(VodTranscript.moodle_id == vod_moodle_id).first()
    return _build_transcribe_status(db, vod, row)


@app.get("/vods/{vod_moodle_id}/transcript")
def get_vod_transcript(vod_moodle_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    vod = db.query(VOD).join(Course).filter(VOD.moodle_id == vod_moodle_id, Course.owner_id == user.id).first()
    if not vod:
        raise HTTPException(404, "VOD not found")
    row = db.query(VodTranscript).filter(VodTranscript.moodle_id == vod_moodle_id).first()
    if not row:
        return {"status": "not_found"}
    if row.transcript and not row.is_processing:
        return {"status": "ok", "transcript": row.transcript}
    if row.status == "failed" and not row.is_processing:
        return {"status": "failed", "error_message": row.error_message or "Transcription failed"}
    if row.is_processing or row.status in ("queued", "running"):
        status_meta = _build_transcribe_status(db, vod, row)
        return {
            "status": "processing",
            "stage": status_meta.get("stage"),
            "progress_pct": status_meta.get("progress_pct"),
            "queue_position": status_meta.get("queue_position"),
            "queue_ahead": status_meta.get("queue_ahead"),
            "elapsed_seconds": status_meta.get("elapsed_seconds"),
            "eta_seconds": status_meta.get("eta_seconds"),
        }
    return {"status": "not_found"}

@app.post("/vods/{vod_moodle_id}/transcribe")
def transcribe_vod(request: Request, vod_moodle_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    vod = db.query(VOD).join(Course).filter(VOD.moodle_id == vod_moodle_id, Course.owner_id == user.id).first()
    if not vod:
        raise HTTPException(404, "VOD not found")

    row = db.query(VodTranscript).filter(VodTranscript.moodle_id == vod_moodle_id).first()

    # Already done
    if row and row.transcript and not row.is_processing:
        return {"status": "cached", "transcript": row.transcript}

    # Already in progress — just tell client to poll
    # But if stuck for >30 min (worker crashed mid-job), allow retry
    if row and row.is_processing:
        if row.created_at and (datetime.now() - row.created_at).total_seconds() > 1800:
            row.is_processing = False
            row.status = "failed"
            row.stage = "failed"
            row.error_message = "Processing timeout. Please retry."
            row.progress_pct = 0
            row.completed_at = datetime.now()
            db.commit()
        else:
            return {"status": "processing"}

    # Daily transcription cap (optionally bypassed for designated test users)
    if not _is_transcribe_limit_bypassed(user):
        from datetime import date as date_type
        today_str = date_type.today().isoformat()
        if user.transcribe_count_date != today_str:
            user.transcribe_count_today = 0
            user.transcribe_count_date = today_str
        if user.transcribe_count_today >= DAILY_TRANSCRIBE_LIMIT:
            raise HTTPException(429, f"일일 텍스트 추출 한도({DAILY_TRANSCRIBE_LIMIT}회)에 도달했어요. 내일 다시 이용해주세요.")
        user.transcribe_count_today += 1
        db.commit()
    else:
        logger.info(f"Transcribe limit bypass enabled for user {user.username}")

    # Get stream URL now (requires active Moodle session)
    client = get_moodle_client(user)
    m3u8_url = client.get_vod_stream_url(vod_moodle_id)
    if not m3u8_url:
        raise HTTPException(502, "Could not find stream URL for this VOD")

    vod_title = vod.title
    course_obj = db.query(Course).filter(Course.id == vod.course_id).first()
    course_name = course_obj.name if course_obj else None

    # Insert/update processing placeholder so the status endpoint can expose queue and ETA hints.
    now = datetime.now()
    if row:
        row.is_processing = True
        row.status = "queued"
        row.stage = "queued"
        row.progress_pct = 0
        row.error_message = ""
        row.transcript = None
        row.summary = None
        row.started_at = None
        row.completed_at = None
        row.created_at = now
    else:
        db.add(VodTranscript(
            moodle_id=vod_moodle_id,
            is_processing=True,
            status="queued",
            stage="queued",
            progress_pct=0,
            error_message="",
            created_at=now,
        ))

    # Enqueue job for the worker
    db.add(Job(type='transcribe', payload={
        'vod_moodle_id': vod_moodle_id,
        'm3u8_url': m3u8_url,
        'cookies': user.moodle_cookies or '',
        'user_id': user.id,
        'vod_title': vod_title,
        'course_name': course_name,
    }))
    db.commit()
    return {"status": "processing", "stage": "queued", "progress_pct": 0}

@app.post("/vods/{vod_moodle_id}/summarize")
@limiter.limit("5/minute")
def summarize_vod(request: Request, vod_moodle_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    vod = db.query(VOD).join(Course).filter(VOD.moodle_id == vod_moodle_id, Course.owner_id == user.id).first()
    if not vod:
        raise HTTPException(404, "VOD not found")

    cached = db.query(VodTranscript).filter(VodTranscript.moodle_id == vod_moodle_id).first()
    if not cached or not cached.transcript:
        raise HTTPException(400, "Transcript not available — transcribe first")

    if cached.summary:
        return {"status": "cached", "summary": cached.summary}

    try:
        from ai_service import AIService
        course = db.query(Course).filter(Course.id == vod.course_id).first()
        summary, usage = AIService().summarize_transcript(cached.transcript, course.name if course else "")
        _log_ai_usage(db, user.id, "summarize", usage)
    except Exception as e:
        logger.error(f"Summarization failed for VOD {vod_moodle_id}: {e}")
        raise HTTPException(500, f"Summarization failed: {str(e)}")

    cached.summary = summary
    db.commit()
    return {"status": "ok", "summary": summary}

DAILY_CHAT_LIMIT = int(os.getenv('DAILY_CHAT_LIMIT', '30'))
DAILY_TRANSCRIBE_LIMIT = int(os.getenv('DAILY_TRANSCRIBE_LIMIT', '3'))


def _log_ai_usage(db: Session, user_id: int | None, endpoint: str, usage: dict):
    """Persist AI token usage to the database."""
    try:
        db.add(AIUsageLog(
            user_id=user_id,
            endpoint=endpoint,
            model=usage.get("model", "unknown"),
            prompt_tokens=usage.get("prompt_tokens", 0),
            completion_tokens=usage.get("completion_tokens", 0),
            total_tokens=usage.get("total_tokens", 0),
        ))
        db.commit()
    except Exception as e:
        logger.warning(f"Failed to log AI usage: {e}")

@app.post("/vods/{vod_moodle_id}/chat")
@limiter.limit("10/minute")
def chat_with_vod(request: Request, vod_moodle_id: int, req: ChatRequest, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Multi-turn AI chat about a VOD transcript."""
    from datetime import date as date_type

    # Rate limiting
    today_str = date_type.today().isoformat()
    if user.chat_count_date != today_str:
        user.chat_count_today = 0
        user.chat_count_date = today_str

    if user.chat_count_today >= DAILY_CHAT_LIMIT:
        raise HTTPException(429, f"일일 채팅 한도({DAILY_CHAT_LIMIT}회)에 도달했어요. 내일 다시 이용해주세요.")

    # Get transcript
    vod = db.query(VOD).join(Course).filter(VOD.moodle_id == vod_moodle_id, Course.owner_id == user.id).first()
    if not vod:
        raise HTTPException(404, "VOD not found")

    cached = db.query(VodTranscript).filter(VodTranscript.moodle_id == vod_moodle_id).first()
    if not cached or not cached.transcript:
        raise HTTPException(400, "Transcript not available — transcribe first")

    course = db.query(Course).filter(Course.id == vod.course_id).first()
    course_name = course.name if course else ""
    lecture_title = vod.title or ""

    # Increment count before calling API
    user.chat_count_today += 1
    db.commit()

    try:
        from ai_service import AIService
        reply, usage = AIService().chat_about_transcript(
            cached.transcript, course_name, lecture_title, req.messages
        )
        _log_ai_usage(db, user.id, "chat", usage)
    except Exception as e:
        # Refund the count on failure
        user.chat_count_today = max(0, user.chat_count_today - 1)
        db.commit()
        logger.error(f"Chat failed for VOD {vod_moodle_id}: {e}")
        raise HTTPException(500, "AI 응답을 생성할 수 없어요.")

    remaining = DAILY_CHAT_LIMIT - user.chat_count_today
    return {"status": "ok", "reply": reply, "remaining": remaining}

@app.post("/vods/{vod_moodle_id}/chat/stream")
@limiter.limit("10/minute")
def chat_with_vod_stream(request: Request, vod_moodle_id: int, req: ChatRequest, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Streaming version of chat — returns SSE events with tokens."""
    from datetime import date as date_type

    today_str = date_type.today().isoformat()
    if user.chat_count_date != today_str:
        user.chat_count_today = 0
        user.chat_count_date = today_str

    if user.chat_count_today >= DAILY_CHAT_LIMIT:
        raise HTTPException(429, f"일일 채팅 한도({DAILY_CHAT_LIMIT}회)에 도달했어요. 내일 다시 이용해주세요.")

    vod = db.query(VOD).join(Course).filter(VOD.moodle_id == vod_moodle_id, Course.owner_id == user.id).first()
    if not vod:
        raise HTTPException(404, "VOD not found")

    cached = db.query(VodTranscript).filter(VodTranscript.moodle_id == vod_moodle_id).first()
    if not cached or not cached.transcript:
        raise HTTPException(400, "Transcript not available — transcribe first")

    course = db.query(Course).filter(Course.id == vod.course_id).first()
    course_name = course.name if course else ""
    lecture_title = vod.title or ""

    user.chat_count_today += 1
    db.commit()
    remaining = DAILY_CHAT_LIMIT - user.chat_count_today
    user_id = user.id

    def event_generator():
        try:
            from ai_service import AIService
            for event_type, event_data in AIService().chat_about_transcript_stream(
                cached.transcript, course_name, lecture_title, req.messages
            ):
                if event_type == "token":
                    data = json.dumps({"token": event_data}, ensure_ascii=False)
                    yield f"data: {data}\n\n"
                elif event_type == "usage":
                    # Log usage at end of stream
                    usage_db = SessionLocal()
                    try:
                        _log_ai_usage(usage_db, user_id, "chat_stream", event_data)
                    finally:
                        usage_db.close()
            yield f"event: done\ndata: {json.dumps({'remaining': remaining})}\n\n"
        except Exception as e:
            logger.error(f"Stream failed for VOD {vod_moodle_id}: {e}")
            refund_db = SessionLocal()
            try:
                u = refund_db.query(User).filter(User.id == user_id).first()
                if u:
                    u.chat_count_today = max(0, u.chat_count_today - 1)
                    refund_db.commit()
            finally:
                refund_db.close()
            error_data = json.dumps({"error": "AI 응답 생성 중 오류가 발생했어요."}, ensure_ascii=False)
            yield f"event: error\ndata: {error_data}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )

@app.get("/courses/{course_id}/boards", response_model=List[BoardResponse])
def get_boards(course_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    course = db.query(Course).filter(Course.id == course_id, Course.owner_id == user.id).first()
    if not course: raise HTTPException(404, "Course not found")
    boards = db.query(Board).filter(Board.course_id == course_id).all()
    return [{"id": b.moodle_id, "title": b.title, "url": b.url} for b in boards]

@app.get("/boards/{board_id}/posts", response_model=List[PostResponse])
def get_posts(board_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    # board_id here might be moodle_id if client sends moodle_id. 
    # But wait, get_boards returned moodle_id. So client will send moodle_id.
    # We must query Board by moodle_id now.
    board = db.query(Board).filter(Board.moodle_id == board_id).first()
    if not board: raise HTTPException(404, "Board not found")
    course = db.query(Course).filter(Course.id == board.course_id, Course.owner_id == user.id).first()
    if not course: raise HTTPException(403, "Access denied")
    posts = db.query(Post).filter(Post.board_id == board.id).order_by(Post.date.desc()).all()
    return [{"id": p.id, "title": p.title, "writer": p.writer, "date": p.date, "url": p.url, "content": p.content} for p in posts]

@app.get("/posts/{post_id}", response_model=PostResponse)
def get_post_detail(post_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    # post_id here is internal DB ID because notification sends internal ID
    post = db.query(Post).filter(Post.id == post_id).first()
    if not post: raise HTTPException(404, "Post not found")
    
    # Security: Ensure user has access to the board/course?
    board = post.board
    course = db.query(Course).filter(Course.id == board.course_id, Course.owner_id == user.id).first()
    if not course: raise HTTPException(403, "Access denied")
    
    return {"id": post.id, "title": post.title, "writer": post.writer, "date": post.date, "url": post.url, "content": post.content}

@app.get("/dashboard/overview", response_model=DashboardOverviewResponse)
def get_dashboard_overview(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    assignments = db.query(Assignment).join(Course).filter(Course.owner_id == user.id, Course.is_active == True).all()
    vods = db.query(VOD).join(Course).filter(Course.owner_id == user.id, Course.is_active == True).all()
    now = datetime.now()
    upcoming, missed, unwatched_vods, missed_vods, unchecked_vods, upcoming_vods = [], [], [], [], [], []
    
    for a in assignments:
        dt = parse_date(a.due_date)
        if a.is_completed:
            if dt and dt > now: upcoming.append(a)
        else:
            if dt:
                if dt > now: upcoming.append(a)
                else: missed.append(a)
            else: upcoming.append(a)
            
    for v in vods:
        if not v.has_tracking:
            unchecked_vods.append(v); continue
        dt_end = parse_date(v.end_date); dt_start = parse_date(v.start_date)
        if dt_end and dt_end < now:
            if not v.is_completed: missed_vods.append(v)
        elif dt_start and dt_start > now: upcoming_vods.append(v)
        else: unwatched_vods.append(v)
            
    upcoming.sort(key=lambda x: parse_date(x.due_date) or datetime.max)
    missed.sort(key=lambda x: parse_date(x.due_date) or datetime.min, reverse=True)
    
    # Updated mapping to use moodle_id
    def map_assign(l): return [{"id": a.moodle_id, "title": a.title, "course_name": a.course.name, "due_date": a.due_date, "is_completed": a.is_completed, "url": a.url} for a in l]
    def map_vod(l): return [{"id": v.moodle_id, "title": v.title, "course_name": v.course.name, "start_date": v.start_date, "end_date": v.end_date, "is_completed": v.is_completed, "url": v.url} for v in l]

    one_week_later = now + timedelta(days=7)
    assignments_this_week = [a for a in upcoming if parse_date(a.due_date) and parse_date(a.due_date) <= one_week_later]
    stats = {"total_assignments_due": len(assignments_this_week), "completed_assignments_due": sum(1 for a in assignments_this_week if a.is_completed), "missed_assignments_count": len(missed), "missed_vods_count": len(missed_vods)}
    return {"stats": stats, "upcoming_assignments": map_assign(upcoming), "missed_assignments": map_assign(missed), "available_vods": map_vod(unwatched_vods), "missed_vods": map_vod(missed_vods), "unchecked_vods": map_vod(unchecked_vods), "upcoming_vods": map_vod(upcoming_vods), "summary": None}

from ai_service import AIService
@app.post("/dashboard/ai-summary")
@limiter.limit("3/minute")
def get_ai_summary(request: Request, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    ai_service = AIService()
    courses = db.query(Course).filter(Course.owner_id == user.id, Course.is_active == True).all()
    summaries = []
    for course in courses:
        assignments = db.query(Assignment).filter(Assignment.course_id == course.id).all()
        vods = db.query(VOD).filter(VOD.course_id == course.id).all()
        announcements = []
        notice_board = db.query(Board).filter(Board.course_id == course.id, Board.title.like('%공지%')).first()
        if notice_board:
            announcements = db.query(Post).filter(Post.board_id == notice_board.id).limit(5).all()

        # generate_course_summary now returns structured JSON
        summary_data = ai_service.generate_course_summary(course.name, announcements, assignments, vods)

        # Log AI usage if present
        usage = summary_data.pop("_usage", None)
        if usage:
            _log_ai_usage(db, user.id, "dashboard", usage)

        # Merge course info with AI-generated summary data
        summaries.append({
            "course_id": course.id,
            "course_name": course.name,
            **summary_data  # Spread the AI response (status, urgent, upcoming, etc.)
        })
    return {"summaries": summaries}


# ─── Flashcard Endpoints ─────────────────────────────────────────────────────

@app.post("/vods/{vod_moodle_id}/flashcards/generate")
@limiter.limit("5/minute")
def generate_flashcards(request: Request, vod_moodle_id: int, req: GenerateFlashcardsRequest = GenerateFlashcardsRequest(), user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Generate flashcards from a VOD transcript using AI."""
    from datetime import date as date_type

    # Rate limiting (counts against daily chat limit)
    today_str = date_type.today().isoformat()
    if user.chat_count_date != today_str:
        user.chat_count_today = 0
        user.chat_count_date = today_str
    if user.chat_count_today >= DAILY_CHAT_LIMIT:
        raise HTTPException(429, f"일일 AI 사용 한도({DAILY_CHAT_LIMIT}회)에 도달했어요. 내일 다시 이용해주세요.")

    vod = db.query(VOD).join(Course).filter(VOD.moodle_id == vod_moodle_id, Course.owner_id == user.id).first()
    if not vod:
        raise HTTPException(404, "VOD not found")

    cached = db.query(VodTranscript).filter(VodTranscript.moodle_id == vod_moodle_id).first()
    if not cached or not cached.transcript:
        raise HTTPException(400, "Transcript not available — transcribe first")

    course = db.query(Course).filter(Course.id == vod.course_id).first()
    course_name = course.name if course else ""
    lecture_title = vod.title or ""

    user.chat_count_today += 1
    db.commit()

    try:
        from ai_service import AIService
        cards, usage = AIService().generate_flashcards(cached.transcript, course_name, lecture_title, req.count)
        _log_ai_usage(db, user.id, "flashcard_generate", usage)
    except Exception as e:
        user.chat_count_today = max(0, user.chat_count_today - 1)
        db.commit()
        logger.error(f"Flashcard generation failed for VOD {vod_moodle_id}: {e}")
        raise HTTPException(500, "플래시카드를 생성할 수 없어요.")

    remaining = DAILY_CHAT_LIMIT - user.chat_count_today
    return {"status": "ok", "cards": cards, "remaining": remaining, "course_name": course_name}


@app.post("/flashcards/decks")
@limiter.limit("10/minute")
def save_flashcard_deck(request: Request, req: SaveDeckRequest, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Save a flashcard deck."""
    if len(req.cards) < 1 or len(req.cards) > 30:
        raise HTTPException(400, "카드는 1~30장이어야 해요.")
    if not req.name.strip():
        raise HTTPException(400, "덱 이름을 입력해주세요.")

    # Look up course name from VOD
    vod = db.query(VOD).join(Course).filter(VOD.moodle_id == req.vod_moodle_id, Course.owner_id == user.id).first()
    course_name = None
    if vod:
        course = db.query(Course).filter(Course.id == vod.course_id).first()
        course_name = course.name if course else None

    deck = FlashcardDeck(
        user_id=user.id,
        vod_moodle_id=req.vod_moodle_id,
        name=req.name.strip(),
        course_name=course_name,
        card_count=len(req.cards),
    )
    db.add(deck)
    db.flush()  # get deck.id

    for i, card in enumerate(req.cards):
        db.add(Flashcard(deck_id=deck.id, position=i, front=card.front, back=card.back))
    db.commit()

    return {"status": "ok", "id": deck.id, "name": deck.name, "card_count": deck.card_count}


@app.get("/flashcards/decks")
@limiter.limit("30/minute")
def list_flashcard_decks(request: Request, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """List all flashcard decks for the current user."""
    decks = db.query(FlashcardDeck).filter(FlashcardDeck.user_id == user.id).order_by(FlashcardDeck.created_at.desc()).all()
    return {"decks": [
        {
            "id": d.id,
            "name": d.name,
            "vod_moodle_id": d.vod_moodle_id,
            "course_name": d.course_name,
            "card_count": d.card_count,
            "created_at": d.created_at.isoformat() if d.created_at else None,
        }
        for d in decks
    ]}


@app.get("/flashcards/decks/{deck_id}")
@limiter.limit("30/minute")
def get_flashcard_deck(request: Request, deck_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Get a flashcard deck with all its cards."""
    deck = db.query(FlashcardDeck).filter(FlashcardDeck.id == deck_id, FlashcardDeck.user_id == user.id).first()
    if not deck:
        raise HTTPException(404, "덱을 찾을 수 없어요.")
    return {
        "id": deck.id,
        "name": deck.name,
        "vod_moodle_id": deck.vod_moodle_id,
        "course_name": deck.course_name,
        "cards": [{"front": c.front, "back": c.back} for c in deck.cards],
    }


@app.delete("/flashcards/decks/{deck_id}")
@limiter.limit("10/minute")
def delete_flashcard_deck(request: Request, deck_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Delete a flashcard deck."""
    deck = db.query(FlashcardDeck).filter(FlashcardDeck.id == deck_id, FlashcardDeck.user_id == user.id).first()
    if not deck:
        raise HTTPException(404, "덱을 찾을 수 없어요.")
    db.delete(deck)
    db.commit()
    return {"status": "ok"}


def require_debug():
    """Dependency that blocks debug endpoints unless ENABLE_DEBUG=true."""
    if not ENABLE_DEBUG:
        raise HTTPException(404, "Not found")

@app.get("/debug/vod-inspect/{vod_id}", dependencies=[Depends(require_debug)])
def debug_vod_inspect(vod_id: int, user: User = Depends(get_current_user)):
    """Fetch a VOD viewer page and return parsed amd.progress args for debugging."""
    import re as _re, ast as _ast
    client = get_moodle_client(user)
    viewer_url = f"https://ys.learnus.org/mod/vod/viewer.php?id={vod_id}"
    try:
        resp = client.session.get(viewer_url, timeout=15)
        html = resp.text
        match = _re.search(r'amd\.progress\((.*?)\);', html, _re.DOTALL)
        if not match:
            return {
                "vod_id": vod_id, "status_code": resp.status_code,
                "final_url": str(resp.url), "amd_progress_found": False,
                "html_snippet": html[:2000]
            }
        args_str = match.group(1).replace('true', 'True').replace('false', 'False').replace(r'\/', '/')
        try:
            args = _ast.literal_eval(f"[{args_str}]")
        except Exception as e:
            return {"vod_id": vod_id, "amd_progress_found": True, "parse_error": str(e), "args_str_preview": args_str[:500]}
        return {
            "vod_id": vod_id, "status_code": resp.status_code, "final_url": str(resp.url),
            "amd_progress_found": True,
            "isProgress": args[1], "isProgressPeriodCheck": args[5],
            "courseid": args[6], "cmid": args[7], "trackid": args[8],
            "attempt": args[9], "duration_sec": args[10], "interval_ms": args[12],
            "logtime_from_page": args[22],
        }
    except Exception as e:
        return {"error": str(e)}

@app.post("/vods/{vod_moodle_id}/watch")
def watch_single_vod(vod_moodle_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    vod = db.query(VOD).join(Course).filter(VOD.moodle_id == vod_moodle_id, Course.owner_id == user.id).first()
    if not vod:
        raise HTTPException(404, "VOD not found")
    # Validate Moodle session before queuing — prevents silent failure
    client = get_moodle_client(user)
    if not client.is_session_valid():
        raise HTTPException(401, "Moodle session expired. Please re-login.")
    db.add(Job(type='watch_one', payload={'user_id': user.id, 'vod_moodle_id': vod_moodle_id}))
    db.commit()
    return {"status": "started"}

@app.post("/vods/watch-all")
def trigger_watch_all(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Manually trigger background VOD watching for the current user only."""
    # Validate Moodle session before queuing — prevents silent failure
    client = get_moodle_client(user)
    if not client.is_session_valid():
        raise HTTPException(401, "Moodle session expired. Please re-login.")
    # Avoid duplicate: if a watch_all job is already pending/processing for this user, skip
    existing = db.query(Job).filter(
        Job.type == 'watch_all',
        Job.status.in_(['pending', 'processing']),
    ).filter(Job.payload['user_id'].as_integer() == user.id).first()
    if existing:
        return {"status": "already_running", "message": "VOD watching is already queued"}
    db.add(Job(type='watch_all', payload={'user_id': user.id}))
    db.commit()
    return {"status": "started", "message": "VOD watching started in background"}

@app.post("/debug/vod-watch-fast/{vod_id}", dependencies=[Depends(require_debug)])
def debug_vod_watch_fast(vod_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Run watch_vod with fake spread logtimes. Completes instantly, checks attendance page after."""
    client = get_moodle_client(user)
    vod = db.query(VOD).filter(VOD.moodle_id == vod_id).first()
    success = client.watch_vod(vod_id, duration=vod.duration if vod else None, viewer_url=vod.url if vod else None)
    return {"vod_id": vod_id, "success": success}

@app.post("/debug/vod-time-test/{vod_id}", dependencies=[Depends(require_debug)])
def debug_vod_time_test(vod_id: int, user: User = Depends(get_current_user)):
    """Send open signal, wait 30s with 2 progress ticks, then close. Check attendance page after."""
    import re as _re, ast as _ast, time as _time
    client = get_moodle_client(user)
    viewer_url = f"https://ys.learnus.org/mod/vod/viewer.php?id={vod_id}"
    try:
        resp = client.session.get(viewer_url, headers={"Referer": "https://ys.learnus.org"}, timeout=15)
        html = resp.text
        match = _re.search(r'amd\.progress\((.*?)\);', html, _re.DOTALL)
        if not match:
            return {"error": "amd.progress not found"}
        args_str = match.group(1).replace('true', 'True').replace('false', 'False').replace(r'\/', '/')
        args = _ast.literal_eval(f"[{args_str}]")
        courseid, cmid, trackid, attempt = args[6], args[7], args[8], args[9]
        duration = int(args[10]) or 900
        interval_ms = args[12]
        sesskey = client.sesskey or ""
        action_url = "https://ys.learnus.org/mod/vod/action.php"
        headers = {
            "Referer": viewer_url,
            "X-Requested-With": "XMLHttpRequest",
            "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        }
        log = []

        def post(data):
            t = int(_time.time())
            r = client.session.post(action_url, headers=headers,
                                    data={"sesskey": sesskey, "logtime": t, **data}, timeout=15)
            log.append({"time": t, "type": data.get("type"), "state": data.get("state"),
                        "pos": data.get("positionto"), "response": r.text[:100]})

        # 1. Open viewer
        post({"type": "vod_track_for_onwindow", "track": trackid, "state": 3,
              "position": 0, "attempts": attempt, "interval": interval_ms})
        post({"type": "vod_log", "courseid": courseid, "cmid": cmid, "track": trackid,
              "attempt": attempt, "state": 1, "positionfrom": 0, "positionto": 0})

        # 2. Wait 15s, send progress tick
        _time.sleep(15)
        post({"type": "vod_log", "courseid": courseid, "cmid": cmid, "track": trackid,
              "attempt": attempt, "state": 8, "positionfrom": 0, "positionto": 15})

        # 3. Wait another 15s, send progress tick
        _time.sleep(15)
        post({"type": "vod_log", "courseid": courseid, "cmid": cmid, "track": trackid,
              "attempt": attempt, "state": 8, "positionfrom": 15, "positionto": 30})

        # 4. Close viewer
        post({"type": "vod_track_for_onwindow", "track": trackid, "state": 5,
              "position": 30, "attempts": attempt, "interval": interval_ms})

        elapsed = log[-1]["time"] - log[0]["time"]
        return {"vod_id": vod_id, "elapsed_sec": elapsed, "signals": log}
    except Exception as e:
        return {"error": str(e)}

@app.post("/debug/vod-action-test/{vod_id}", dependencies=[Depends(require_debug)])
def debug_vod_action_test(vod_id: int, user: User = Depends(get_current_user)):
    """Fire one start_log POST to action.php and return the raw response for debugging."""
    import re as _re, ast as _ast, time as _time
    client = get_moodle_client(user)
    viewer_url = f"https://ys.learnus.org/mod/vod/viewer.php?id={vod_id}"
    try:
        resp = client.session.get(viewer_url, headers={"Referer": "https://ys.learnus.org"}, timeout=15)
        html = resp.text
        match = _re.search(r'amd\.progress\((.*?)\);', html, _re.DOTALL)
        if not match:
            return {"error": "amd.progress not found", "final_url": str(resp.url), "html_snippet": html[:500]}
        args_str = match.group(1).replace('true', 'True').replace('false', 'False').replace(r'\/', '/')
        args = _ast.literal_eval(f"[{args_str}]")
        courseid, cmid, trackid, attempt, interval_ms = args[6], args[7], args[8], args[9], args[12]
        sesskey = client.sesskey or ""
        action_url = "https://ys.learnus.org/mod/vod/action.php"
        headers = {
            "Referer": viewer_url,
            "X-Requested-With": "XMLHttpRequest",
            "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        }
        r = client.session.post(action_url, headers=headers, data={
            "sesskey": sesskey, "courseid": courseid, "cmid": cmid,
            "type": "vod_log", "track": trackid, "attempt": attempt,
            "state": 1, "positionfrom": 0, "positionto": 0, "logtime": int(_time.time())
        }, timeout=15)
        return {
            "sesskey_used": sesskey[:8] + "..." if sesskey else "(empty)",
            "action_status_code": r.status_code,
            "action_final_url": str(r.url),
            "action_response": r.text[:500],
            "looks_like_homepage": "<html" in r.text[:100].lower(),
        }
    except Exception as e:
        return {"error": str(e)}

@app.post("/debug/create-test-assignment", dependencies=[Depends(require_debug)])
def create_test_assignment(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    # 1. Find or Create Test Course
    test_course = db.query(Course).filter(Course.owner_id == user.id, Course.name == "[TEST] Debug Course").first()
    if not test_course:
        test_course = Course(moodle_id=999999, owner_id=user.id, name="[TEST] Debug Course", is_active=True)
        db.add(test_course)
        db.commit()
        db.refresh(test_course)
    
    # 2. Create Dummy Assignments for ALL offsets (1h, 5h, 12h, 1d)
    # We add 1 minute to ensure the notification schedule time is in the future (Time > Now)
    offsets = [1, 5, 12, 24]
    created_count = 0
    
    for hours in offsets:
        due_date = (datetime.now() + timedelta(hours=hours, minutes=2)).strftime("%Y-%m-%d %H:%M")
        assignment = Assignment(
            moodle_id=int(datetime.now().timestamp()) + hours, # Unique-ish ID
            course_id=test_course.id,
            title=f"Test Assign ({hours}h) {datetime.now().strftime('%H:%M:%S')}",
            due_date=due_date,
            is_completed=False,
            url="https://example.com"
        )
        db.add(assignment)
        created_count += 1
    
    db.commit()
    
    return {"status": "success", "message": f"Created {created_count} assignments (Due in 1h, 5h, 12h, 24h from now). Notification should appear in ~2 minutes depending on your settings."}



@app.post("/debug/delete-test-assignments", dependencies=[Depends(require_debug)])
def delete_test_assignments(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    test_course = db.query(Course).filter(Course.owner_id == user.id, Course.name == "[TEST] Debug Course").first()
    if not test_course:
        return {"status": "success", "message": "No test course found, nothing to delete."}

    deleted_count = db.query(Assignment).filter(Assignment.course_id == test_course.id).delete()
    db.commit()

    return {"status": "success", "message": f"Deleted {deleted_count} test assignments."}

@app.post("/debug/create-test-vod", dependencies=[Depends(require_debug)])
def create_test_vod(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    # 1. Find or Create Test Course
    test_course = db.query(Course).filter(Course.owner_id == user.id, Course.name == "[TEST] Debug Course").first()
    if not test_course:
        test_course = Course(moodle_id=999999, owner_id=user.id, name="[TEST] Debug Course", is_active=True)
        db.add(test_course)
        db.commit()
        db.refresh(test_course)

    # 2. Create VODs with different end times (currently watchable)
    # start_date = 1 hour ago (already available)
    # end_date = varies (1h, 5h, 12h, 24h from now)
    start_date = (datetime.now() - timedelta(hours=1)).strftime("%Y-%m-%d %H:%M:%S")
    offsets = [1, 5, 12, 24]
    created_count = 0

    for hours in offsets:
        end_date = (datetime.now() + timedelta(hours=hours, minutes=2)).strftime("%Y-%m-%d %H:%M:%S")
        vod = VOD(
            moodle_id=int(datetime.now().timestamp()) + hours + 1000,  # Unique-ish ID (offset from assignments)
            course_id=test_course.id,
            title=f"Test VOD ({hours}h left) {datetime.now().strftime('%H:%M:%S')}",
            start_date=start_date,
            end_date=end_date,
            is_completed=False,
            has_tracking=True,
            url="https://example.com/vod"
        )
        db.add(vod)
        created_count += 1

    db.commit()

    return {"status": "success", "message": f"Created {created_count} VODs (Ending in 1h, 5h, 12h, 24h from now). They should appear in 'available_vods' on dashboard."}

@app.post("/debug/delete-test-vods", dependencies=[Depends(require_debug)])
def delete_test_vods(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    test_course = db.query(Course).filter(Course.owner_id == user.id, Course.name == "[TEST] Debug Course").first()
    if not test_course:
        return {"status": "success", "message": "No test course found, nothing to delete."}

    deleted_count = db.query(VOD).filter(VOD.course_id == test_course.id).delete()
    db.commit()

    return {"status": "success", "message": f"Deleted {deleted_count} test VODs."}

@app.post("/debug/send-push", dependencies=[Depends(require_debug)])
def send_push_direct(
    payload: dict,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Send a push notification directly to all of the authenticated user's devices."""
    import requests as req_lib
    import json as json_lib

    tokens = [pt.token for pt in db.query(PushToken).filter(PushToken.user_id == user.id).all()]
    if not tokens and user.push_token:
        tokens = [user.push_token]
    if not tokens:
        return {"status": "error", "message": "No push token registered for this user."}

    title = payload.get("title", "알림")
    body = payload.get("body", "")
    data = {**payload.get("data", {}), "saveToHistory": True}

    results = []
    for token in tokens:
        message = {"to": token, "sound": "default", "title": title, "body": body, "data": data}
        try:
            res = req_lib.post(
                "https://exp.host/--/api/v2/push/send",
                data=json_lib.dumps(message, ensure_ascii=False).encode("utf-8"),
                headers={"Content-Type": "application/json; charset=utf-8", "Accept": "application/json"},
            )
            results.append({"token": token[:15] + "...", "response": res.json()})
        except Exception as e:
            results.append({"token": token[:15] + "...", "error": str(e)})

    return {"status": "success", "devices": len(tokens), "results": results}


@app.get("/debug/login-reports", dependencies=[Depends(require_debug)])
def get_login_debug_reports(db: Session = Depends(get_db)):
    reports = db.query(LoginDebugReport).order_by(LoginDebugReport.created_at.desc()).all()
    return [
        {
            "id": r.id,
            "device_info": r.device_info,
            "created_at": r.created_at,
            "logs": json.loads(r.log_json),
        }
        for r in reports
    ]

@app.post("/debug/login-report", dependencies=[Depends(require_debug)])
def submit_login_debug_report(req: LoginDebugReportRequest, db: Session = Depends(get_db)):
    """Accept login debug logs from unauthenticated users stuck on login."""
    report = LoginDebugReport(
        device_info=req.device_info,
        log_json=json.dumps(req.logs, ensure_ascii=False),
    )
    db.add(report)
    db.commit()
    logger.info(f"Saved login debug report #{report.id} ({len(req.logs)} events, device: {req.device_info})")
    return {"status": "success", "report_id": report.id}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
