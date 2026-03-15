from fastapi import FastAPI, HTTPException, Depends, BackgroundTasks, Header
from fastapi.security import APIKeyHeader
from pydantic import BaseModel
from typing import List, Optional
from sqlalchemy.orm import Session
from concurrent.futures import ThreadPoolExecutor, as_completed
from database import init_db, User, Course, Assignment, VOD, Board, Post, VodTranscript, LoginDebugReport
from moodle_client import MoodleClient
import logging
import uuid
import json
from datetime import datetime, timedelta
import re
from scheduler import check_notices_job, sync_dashboard_job, watch_vods_for_user, _watch_running
from apscheduler.schedulers.background import BackgroundScheduler

logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

SessionLocal = init_db()
sched = BackgroundScheduler()

# ============================================================
# APP VERSION — Reads from learnus-app/app.json automatically.
# To release a new version: update "version" in app.json only.
# ============================================================
def _read_app_version() -> str:
    try:
        with open('./learnus-app/app.json', 'r', encoding='utf-8') as f:
            data = json.load(f)
            return data['expo']['version']
    except Exception:
        return '0.0.0'

LATEST_VERSION = _read_app_version()

app = FastAPI(title="LearnUs Connect API (Beta)")

@app.on_event("startup")
def startup_event():
    logger.info("Starting Background Scheduler...")
    sched.add_job(check_notices_job, 'interval', minutes=5, args=[SessionLocal])
    sched.add_job(sync_dashboard_job, 'interval', minutes=60, args=[SessionLocal])
    sched.start()

    # Clear any stuck transcription rows left over from a previous container crash/restart
    db = SessionLocal()
    try:
        stuck = db.query(VodTranscript).filter(VodTranscript.is_processing == True).count()
        if stuck:
            db.query(VodTranscript).filter(VodTranscript.is_processing == True).delete()
            db.commit()
            logger.info(f"Cleared {stuck} stuck transcription row(s) from previous run.")
    finally:
        db.close()

@app.on_event("shutdown")
def shutdown_event():
    sched.shutdown()


@app.get("/version")
def get_version():
    return {"version": LATEST_VERSION}


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

class PreferencesRequest(BaseModel):
    new_assignment: bool = True
    new_vod: bool = True
    notice: bool = True

class LoginDebugReportRequest(BaseModel):
    device_info: Optional[str] = None
    logs: list

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
def login(creds: LoginRequest, db: Session = Depends(get_db)):
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

@app.post("/auth/push-token")
def register_push_token(req: PushTokenRequest, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if not req.token: raise HTTPException(400, "Token required")
    user.push_token = req.token
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

def _run_transcription(vod_moodle_id: int, m3u8_url: str, cookies):
    """Background thread: transcribes and updates VodTranscript row."""
    db = SessionLocal()
    try:
        from ai_service import AIService
        client = MoodleClient("https://ys.learnus.org")
        if isinstance(cookies, str):
            client.set_cookies(_parse_cookie_string(cookies))
        elif cookies:
            client.set_cookies(cookies)
        transcript = AIService().transcribe_vod(m3u8_url)
        row = db.query(VodTranscript).filter(VodTranscript.moodle_id == vod_moodle_id).first()
        if row:
            row.transcript = transcript
            row.is_processing = False
            db.commit()
        logger.info(f"Transcription complete for VOD {vod_moodle_id}")
    except Exception as e:
        logger.error(f"Background transcription failed for VOD {vod_moodle_id}: {e}")
        row = db.query(VodTranscript).filter(VodTranscript.moodle_id == vod_moodle_id).first()
        if row:
            db.delete(row)
            db.commit()
    finally:
        db.close()

@app.get("/vods/{vod_moodle_id}/transcript")
def get_vod_transcript(vod_moodle_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    vod = db.query(VOD).join(Course).filter(VOD.moodle_id == vod_moodle_id, Course.owner_id == user.id).first()
    if not vod:
        raise HTTPException(404, "VOD not found")
    row = db.query(VodTranscript).filter(VodTranscript.moodle_id == vod_moodle_id).first()
    if not row:
        return {"status": "not_found"}
    if row.is_processing:
        return {"status": "processing"}
    return {"status": "ok", "transcript": row.transcript}

@app.post("/vods/{vod_moodle_id}/transcribe")
def transcribe_vod(vod_moodle_id: int, background_tasks: BackgroundTasks, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    import threading
    vod = db.query(VOD).join(Course).filter(VOD.moodle_id == vod_moodle_id, Course.owner_id == user.id).first()
    if not vod:
        raise HTTPException(404, "VOD not found")

    row = db.query(VodTranscript).filter(VodTranscript.moodle_id == vod_moodle_id).first()

    # Already done
    if row and not row.is_processing:
        return {"status": "cached", "transcript": row.transcript}

    # Already in progress — just tell client to poll
    # But if stuck for >30 min, assume it failed and allow retry
    if row and row.is_processing:
        if row.created_at and (datetime.now() - row.created_at).total_seconds() > 1800:
            db.delete(row)
            db.commit()
        else:
            return {"status": "processing"}

    # Start transcription: get stream URL, insert placeholder row, fire background thread
    client = get_moodle_client(user)
    m3u8_url = client.get_vod_stream_url(vod_moodle_id)
    if not m3u8_url:
        raise HTTPException(502, "Could not find stream URL for this VOD")

    raw_cookies = user.moodle_cookies or ''
    if raw_cookies.startswith('{'):
        try:
            cookies = json.loads(raw_cookies)
        except Exception:
            cookies = {}
    else:
        cookies = raw_cookies  # _run_transcription will call _parse_cookie_string on this
    db.add(VodTranscript(moodle_id=vod_moodle_id, is_processing=True))
    db.commit()

    threading.Thread(target=_run_transcription, args=(vod_moodle_id, m3u8_url, cookies), daemon=True).start()
    return {"status": "processing"}

@app.post("/vods/{vod_moodle_id}/summarize")
def summarize_vod(vod_moodle_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
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
        summary = AIService().summarize_transcript(cached.transcript, course.name if course else "")
    except Exception as e:
        logger.error(f"Summarization failed for VOD {vod_moodle_id}: {e}")
        raise HTTPException(500, f"Summarization failed: {str(e)}")

    cached.summary = summary
    db.commit()
    return {"status": "ok", "summary": summary}

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
def get_ai_summary(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
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

        # Merge course info with AI-generated summary data
        summaries.append({
            "course_id": course.id,
            "course_name": course.name,
            **summary_data  # Spread the AI response (status, urgent, upcoming, etc.)
        })
    return {"summaries": summaries}



@app.get("/debug/vod-inspect/{vod_id}")
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
def watch_single_vod(vod_moodle_id: int, background_tasks: BackgroundTasks, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    vod = db.query(VOD).join(Course).filter(VOD.moodle_id == vod_moodle_id, Course.owner_id == user.id).first()
    if not vod:
        raise HTTPException(404, "VOD not found")
    if user.id in _watch_running:
        raise HTTPException(409, "Watch all is already running — wait for it to finish")
    client = get_moodle_client(user)
    background_tasks.add_task(client.watch_vod, vod_moodle_id, vod.duration)
    return {"status": "started"}

@app.post("/vods/watch-all")
def trigger_watch_all(background_tasks: BackgroundTasks, user: User = Depends(get_current_user)):
    """Manually trigger background VOD watching for the current user only."""
    background_tasks.add_task(watch_vods_for_user, user.id, SessionLocal)
    return {"status": "started", "message": "VOD watching started in background"}

@app.post("/debug/vod-watch-fast/{vod_id}")
def debug_vod_watch_fast(vod_id: int, user: User = Depends(get_current_user)):
    """Run watch_vod with fake spread logtimes. Completes instantly, checks attendance page after."""
    client = get_moodle_client(user)
    success = client.watch_vod(vod_id)
    return {"vod_id": vod_id, "success": success}

@app.post("/debug/vod-time-test/{vod_id}")
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

@app.post("/debug/vod-action-test/{vod_id}")
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

@app.post("/debug/create-test-assignment")
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



@app.post("/debug/delete-test-assignments")
def delete_test_assignments(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    test_course = db.query(Course).filter(Course.owner_id == user.id, Course.name == "[TEST] Debug Course").first()
    if not test_course:
        return {"status": "success", "message": "No test course found, nothing to delete."}

    deleted_count = db.query(Assignment).filter(Assignment.course_id == test_course.id).delete()
    db.commit()

    return {"status": "success", "message": f"Deleted {deleted_count} test assignments."}

@app.post("/debug/create-test-vod")
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

@app.post("/debug/delete-test-vods")
def delete_test_vods(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    test_course = db.query(Course).filter(Course.owner_id == user.id, Course.name == "[TEST] Debug Course").first()
    if not test_course:
        return {"status": "success", "message": "No test course found, nothing to delete."}

    deleted_count = db.query(VOD).filter(VOD.course_id == test_course.id).delete()
    db.commit()

    return {"status": "success", "message": f"Deleted {deleted_count} test VODs."}

@app.post("/debug/send-push")
def send_push_direct(
    payload: dict,
    user: User = Depends(get_current_user),
):
    """Send a push notification directly to the authenticated user's device."""
    import requests as req_lib
    import json as json_lib

    if not user.push_token:
        return {"status": "error", "message": "No push token registered for this user."}

    message = {
        "to": user.push_token,
        "sound": "default",
        "title": payload.get("title", "알림"),
        "body": payload.get("body", ""),
        "data": {**payload.get("data", {}), "saveToHistory": True},
    }

    try:
        res = req_lib.post(
            "https://exp.host/--/api/v2/push/send",
            data=json_lib.dumps(message, ensure_ascii=False).encode("utf-8"),
            headers={"Content-Type": "application/json; charset=utf-8", "Accept": "application/json"},
        )
        return {"status": "success", "expo_response": res.json()}
    except Exception as e:
        return {"status": "error", "message": str(e)}


@app.post("/debug/login-report")
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
