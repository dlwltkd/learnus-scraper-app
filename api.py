from fastapi import FastAPI, HTTPException, Depends, BackgroundTasks, Header
from fastapi.security import APIKeyHeader
from pydantic import BaseModel
from typing import List, Optional
from sqlalchemy.orm import Session
from concurrent.futures import ThreadPoolExecutor, as_completed
from database import init_db, User, Course, Assignment, VOD, Board, Post
from moodle_client import MoodleClient
import logging
import uuid
import json
from datetime import datetime, timedelta
import re
from scheduler import check_notices_job, sync_dashboard_job
from apscheduler.schedulers.background import BackgroundScheduler

logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

SessionLocal = init_db()
sched = BackgroundScheduler()

app = FastAPI(title="LearnUs Connect API (Beta)")

@app.on_event("startup")
def startup_event():
    logger.info("Starting Background Scheduler...")
    # Add jobs - passed 'SessionLocal' to allow jobs to create their own sessions
    sched.add_job(check_notices_job, 'interval', minutes=5, args=[SessionLocal])
    sched.add_job(sync_dashboard_job, 'interval', minutes=60, args=[SessionLocal])
    sched.start()

@app.on_event("shutdown")
def shutdown_event():
    sched.shutdown()


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

def get_moodle_client(user: User):
    cookies = None
    if user.moodle_cookies:
        try: cookies = json.loads(user.moodle_cookies)
        except: pass
    return MoodleClient("https://ys.learnus.org", cookies=cookies)

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

class PushTokenRequest(BaseModel):
    token: str

class PreferencesRequest(BaseModel):
    new_assignment: bool = True
    new_vod: bool = True
    notice: bool = True

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

    logger.info(f"Raw cookies received: {req.cookies[:50]}...") # Log start of cookies
    
    for item in req.cookies.split(';'):
        if '=' in item:
            k,v = item.strip().split('=', 1)
            cookies[k] = v
    
    logger.info(f"Parsed cookies keys: {list(cookies.keys())}")

    client = MoodleClient("https://ys.learnus.org", cookies=cookies)
    
    # DEBUG: Check connectivity and auth status
    try:
        res = client.session.get("https://ys.learnus.org/my/", timeout=15)
        logger.info(f"Auth check status: {res.status_code}")
        logger.info(f"Auth check URL: {res.url}") # Did we redirect to login?
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
    
    user.moodle_cookies = json.dumps(cookies)
    db.commit()
    db.refresh(user)

    # Auto-sync courses list immediately to ensure DB is populated
    try:
        logger.info(f"Auto-syncing courses list for user {user.username} (ID: {user.id})...")
        courses_data = client.get_courses()
        synced_cnt = 0
        for c_data in courses_data:
            course = db.query(Course).filter(Course.moodle_id == c_data['id'], Course.owner_id == user.id).first()
            if not course:
                # Default new courses to ACTIVE so sync works immediately
                course = Course(moodle_id=c_data['id'], owner_id=user.id, name=c_data['fullname'], is_active=True)
                db.add(course)
                synced_cnt += 1
            else:
                if course.name != c_data['fullname']:
                    course.name = c_data['fullname']
        db.commit()
        logger.info(f"Auto-sync complete. Found {len(courses_data)} courses, {synced_cnt} new.")
    except Exception as e:
        logger.error(f"Auto-sync courses failed during session sync: {e}")

    return {"status": "success", "api_token": user.api_token, "username": user.username}

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
        summary_text = ai_service.generate_course_summary(course.name, announcements, assignments, vods)
        summaries.append({"course_id": course.id, "course_name": course.name, "summary": summary_text})
    return {"summaries": summaries}

class WatchVodsRequest(BaseModel):
    vod_ids: List[int]

def process_vod_watching(vod_ids: List[int], db: Session, user_id: int):
    logger.info(f"Starting background VOD watching for User {user_id} with VOD IDs: {vod_ids}")
    user = db.query(User).get(user_id)
    if not user:
        logger.error(f"User {user_id} not found")
        return

    client = get_moodle_client(user)

    # Query VODs using the provided vod_ids (which are moodle_ids)
    vods = db.query(VOD).join(Course).filter(
        VOD.moodle_id.in_(vod_ids),
        Course.owner_id == user_id
    ).all()

    if not vods:
        logger.warning(f"No VODs found for ids: {vod_ids}")
        return

    logger.info(f"Found {len(vods)} VODs to watch in parallel")

    # Watch all VODs in parallel
    def watch_single_vod(vod):
        try:
            logger.info(f"Starting to watch VOD: {vod.title} (moodle_id: {vod.moodle_id})")
            success = client.watch_vod(vod.moodle_id, speed=1.0)
            logger.info(f"Finished watching VOD {vod.title}: {success}")
            return vod, success
        except Exception as e:
            logger.error(f"Error watching {vod.title}: {e}")
            return vod, False

    with ThreadPoolExecutor(max_workers=len(vods)) as executor:
        futures = [executor.submit(watch_single_vod, vod) for vod in vods]
        for future in as_completed(futures):
            vod, success = future.result()

    # After all VODs watched, sync courses to update completion status
    logger.info("All VODs watched, syncing courses...")
    course_ids = set(v.course_id for v in vods)
    for course_id in course_ids:
        course = db.query(Course).get(course_id)
        if course:
            try:
                client.sync_course_to_db(course.moodle_id, db, user_id)
                logger.info(f"Synced course {course.name}")
            except Exception as e:
                logger.error(f"Sync error for course {course_id}: {e}")

@app.post("/vod/watch")
def watch_vods(request: WatchVodsRequest, background_tasks: BackgroundTasks, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    background_tasks.add_task(process_vod_watching, request.vod_ids, db, user.id)
    return {"status": "success", "message": "VOD watching started in background"}

class CompleteAssignmentsRequest(BaseModel):
    assignment_ids: List[int]
    completed: Optional[bool] = True  # Default to True for backwards compatibility

@app.post("/assignment/complete")
def complete_assignments(request: CompleteAssignmentsRequest, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    count = 0
    for assign_id in request.assignment_ids:
        # Filter by moodle_id instead of id
        assign = db.query(Assignment).join(Course).filter(Assignment.moodle_id == assign_id, Course.owner_id == user.id).first()
        if assign:
            assign.is_completed = request.completed
            count += 1
    db.commit()
    return {"status": "success", "updated_count": count, "completed": request.completed}

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

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
