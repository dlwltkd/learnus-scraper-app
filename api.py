from fastapi import FastAPI, HTTPException, Depends
from pydantic import BaseModel
from typing import List, Optional
from sqlalchemy.orm import Session
from database import init_db, Course, Assignment, VOD, Board, Post
from moodle_client import MoodleClient
import logging

# Setup Logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize DB
SessionLocal = init_db('learnus.db')

app = FastAPI(title="LearnUs Connect API")

# Dependency
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# Initialize Client (Global for now, ideally per session)
# We will load from session.json initially
client = MoodleClient("https://ys.learnus.org", session_file='session.json')

# --- Pydantic Models for Response ---
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

# --- Endpoints ---

@app.get("/courses", response_model=List[CourseResponse])
def get_courses(db: Session = Depends(get_db)):
    courses = db.query(Course).all()
    return [{"id": c.id, "name": c.name, "is_active": c.is_active} for c in courses]

@app.put("/courses/{course_id}/active")
def update_course_active(course_id: int, update: CourseActiveUpdate, db: Session = Depends(get_db)):
    course = db.query(Course).filter(Course.id == course_id).first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    
    course.is_active = update.is_active
    db.commit()
    return {"status": "success", "message": f"Course {course_id} active status set to {update.is_active}"}

@app.post("/sync/courses")
def sync_courses_list(db: Session = Depends(get_db)):
    if not client.sesskey:
        raise HTTPException(status_code=401, detail="Not authenticated. Please login first.")
    
    try:
        # 1. Fetch from Moodle
        courses_data = client.get_courses()
        
        # 2. Update DB
        synced_count = 0
        for c_data in courses_data:
            course = db.query(Course).filter(Course.id == c_data['id']).first()
            if not course:
                course = Course(id=c_data['id'], name=c_data['fullname'])
                db.add(course)
                synced_count += 1
            else:
                # Update name if changed
                if course.name != c_data['fullname']:
                    course.name = c_data['fullname']
                    synced_count += 1
        
        db.commit()
        return {"status": "success", "message": f"Synced {len(courses_data)} courses. New/Updated: {synced_count}"}
    except Exception as e:
        logger.error(f"Sync courses failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/sync/all-active")
def sync_all_active_courses(db: Session = Depends(get_db)):
    if not client.sesskey:
        raise HTTPException(status_code=401, detail="Not authenticated. Please login first.")
    
    active_courses = db.query(Course).filter(Course.is_active == True).all()
    
    results = []
    errors = []
    
    for course in active_courses:
        try:
            client.sync_course_to_db(course.id, db)
            results.append(f"{course.name}: Success")
        except Exception as e:
            logger.error(f"Failed to sync {course.name}: {e}")
            errors.append(f"{course.name}: Failed")
            
    return {
        "status": "success" if not errors else "partial_success",
        "message": f"Synced {len(results)} courses. Failed: {len(errors)}",
        "details": results + errors
    }

@app.post("/sync/{course_id}")
def sync_course(course_id: int, db: Session = Depends(get_db)):
    if not client.sesskey:
        raise HTTPException(status_code=401, detail="Not authenticated. Please login first.")
    
    try:
        summary = client.sync_course_to_db(course_id, db)
        return {"status": "success", "message": summary}
    except Exception as e:
        logger.error(f"Sync failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/courses/{course_id}/assignments", response_model=List[AssignmentResponse])
def get_assignments(course_id: int, db: Session = Depends(get_db)):
    assigns = db.query(Assignment).filter(Assignment.course_id == course_id).all()
    return [
        {
            "id": a.id, "title": a.title, "due_date": a.due_date, 
            "is_completed": a.is_completed, "url": a.url
        } 
        for a in assigns
    ]

@app.get("/courses/{course_id}/vods", response_model=List[VODResponse])
def get_vods(course_id: int, db: Session = Depends(get_db)):
    vods = db.query(VOD).filter(VOD.course_id == course_id).all()
    return [
        {
            "id": v.id, "title": v.title, "start_date": v.start_date,
            "end_date": v.end_date, "is_completed": v.is_completed, "url": v.url
        }
        for v in vods
    ]

@app.get("/courses/{course_id}/boards", response_model=List[BoardResponse])
def get_boards(course_id: int, db: Session = Depends(get_db)):
    boards = db.query(Board).filter(Board.course_id == course_id).all()
    return [{"id": b.id, "title": b.title, "url": b.url} for b in boards]

@app.get("/boards/{board_id}/posts", response_model=List[PostResponse])
def get_posts(board_id: int, db: Session = Depends(get_db)):
    posts = db.query(Post).filter(Post.board_id == board_id).order_by(Post.date.desc()).all()
    return [
        {
            "id": p.id, "title": p.title, "writer": p.writer,
            "date": p.date, "url": p.url, "content": p.content
        }
        for p in posts
    ]

class LoginRequest(BaseModel):
    username: str
    password: str

@app.post("/login/credentials")
def login_credentials(creds: LoginRequest):
    try:
        cookie_string = client.login(creds.username, creds.password)
        return {"status": "success", "cookie_string": cookie_string}
    except Exception as e:
        logger.error(f"Credential login failed: {e}")
        return {"status": "error", "message": str(e)}

class LoginCookieRequest(BaseModel):
    cookie_string: str

@app.post("/login")
def login(request: LoginCookieRequest):
    """
    Endpoint to update the session cookie from the frontend.
    """
    try:
        cookie_string = request.cookie_string
        # Simple parsing of the cookie string
        # Format: "key=value; key2=value2"
        cookies = {}
        for item in cookie_string.split(';'):
            if '=' in item:
                key, value = item.strip().split('=', 1)
                cookies[key] = value
        
        # Update client session
        client.session.cookies.update(cookies)
        
        return {"status": "success", "message": "Session updated"}
    except Exception as e:
        logger.error(f"Login update failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# --- Helper for Date Parsing ---
from datetime import datetime
import re

def parse_date(date_str):
    if not date_str or date_str == 'None':
        return None
    
    # Clean up the string
    # Remove &nbsp;
    date_str = date_str.replace('&nbsp;', ' ')
    # Remove trailing dots
    date_str = date_str.rstrip('.')
    # Normalize spaces
    date_str = " ".join(date_str.split())
    
    # 1. ISO-like: 2025-09-22 00:00:00
    try:
        return datetime.strptime(date_str, "%Y-%m-%d %H:%M:%S")
    except:
        pass
        
    # 1. ISO format: 2025-09-20 23:59
    try:
        return datetime.strptime(date_str, "%Y-%m-%d %H:%M")
    except:
        pass

    # 2. Korean format: 2025년 10월 12일 (금) 23:59
    try:
        clean_str = re.sub(r'[년월일\(\)요일]', ' ', date_str)
        clean_str = " ".join(clean_str.split())
        return datetime.strptime(clean_str, "%Y %m %d %H:%M")
    except:
        pass

    # 3. English format: Friday, 12 October 2025, 11:59 PM
    try:
        clean_str = re.sub(r'^[A-Za-z]+,\s*', '', date_str)
        return datetime.strptime(clean_str, "%d %B %Y, %I:%M %p")
    except:
        pass
        
    # 4. Short English format without year: Sep 28 (Sunday) 11:59 pm
    #    or Nov 9 (11:59pm)
    try:
        # Remove day name in parens: (Sunday)
        clean_str = re.sub(r'\([A-Za-z]+\)', '', date_str)
        # Remove parens around time: (11:59pm) -> 11:59pm
        clean_str = re.sub(r'\((\d{1,2}:\d{2}\s*[ap]m)\)', r' \1', clean_str, flags=re.IGNORECASE)
        
        clean_str = " ".join(clean_str.split())
        
        # Try parsing: Sep 28 11:59 pm
        # We need to add a year. Let's assume current year or next year if month is earlier?
        # For simplicity, let's use current year.
        current_year = datetime.now().year
        
        # Try %b %d %I:%M %p (Sep 28 11:59 pm)
        try:
            dt = datetime.strptime(f"{current_year} {clean_str}", "%Y %b %d %I:%M %p")
            return dt
        except:
            pass
            
        # Try %b %d %I:%M%p (Sep 28 11:59pm)
        try:
            dt = datetime.strptime(f"{current_year} {clean_str}", "%Y %b %d %I:%M%p")
            return dt
        except:
            pass
            
    except:
        pass
        
    return None

# --- Dashboard Models ---
class DashboardOverviewResponse(BaseModel):
    upcoming_assignments: List[AssignmentResponse]
    missed_assignments: List[AssignmentResponse]
    unwatched_vods: List[VODResponse]
    missed_vods: List[VODResponse]
    unchecked_vods: List[VODResponse]
    summary: str

@app.get("/dashboard/overview", response_model=DashboardOverviewResponse)
def get_dashboard_overview(db: Session = Depends(get_db)):
    # Filter assignments and VODs by active courses
    # We can join with Course table
    assignments = db.query(Assignment).join(Course).filter(Course.is_active == True).all()
    vods = db.query(VOD).join(Course).filter(Course.is_active == True).all()
    
    now = datetime.now()
    
    upcoming = []
    missed = []
    unwatched_vods = []
    missed_vods = []
    unchecked_vods = []
    
    # Process Assignments
    for a in assignments:
        if a.is_completed:
            continue
            
        dt = parse_date(a.due_date)
        if dt:
            if dt > now:
                upcoming.append(a)
            else:
                missed.append(a)
        else:
            # If no date, maybe treat as upcoming or separate category?
            # For now, append to upcoming if not completed
            upcoming.append(a)
            
    # Process VODs
    for v in vods:
        if not v.has_tracking:
            unchecked_vods.append(v)
            continue
            
        if not v.is_completed:
            # Check end_date
            dt = parse_date(v.end_date)
            if dt and dt < now:
                missed_vods.append(v)
            else:
                unwatched_vods.append(v)
            
    # Sort by date
    upcoming.sort(key=lambda x: parse_date(x.due_date) or datetime.max)
    missed.sort(key=lambda x: parse_date(x.due_date) or datetime.min, reverse=True)
    unwatched_vods.sort(key=lambda x: parse_date(x.end_date) or datetime.max)
    missed_vods.sort(key=lambda x: parse_date(x.end_date) or datetime.min, reverse=True)
    # Sort unchecked by ID (creation order) or name
    unchecked_vods.sort(key=lambda x: x.id, reverse=True)
    
    summary = f"이번 주 마감 과제: {len(upcoming)}개, 미시청 강의: {len(unwatched_vods)}개"
    
    return {
        "upcoming_assignments": [
            {
                "id": a.id, "title": a.title, "course_name": a.course.name, 
                "due_date": a.due_date, "is_completed": a.is_completed, "url": a.url
            }
            for a in upcoming
        ],
        "missed_assignments": [
            {
                "id": a.id, "title": a.title, "course_name": a.course.name, 
                "due_date": a.due_date, "is_completed": a.is_completed, "url": a.url
            }
            for a in missed
        ],
        "unwatched_vods": [
            {
                "id": v.id, "title": v.title, "course_name": v.course.name,
                "start_date": v.start_date, "end_date": v.end_date,
                "is_completed": v.is_completed, "url": v.url
            }
            for v in unwatched_vods
        ],
        "missed_vods": [
            {
                "id": v.id, "title": v.title, "course_name": v.course.name,
                "start_date": v.start_date, "end_date": v.end_date,
                "is_completed": v.is_completed, "url": v.url
            }
            for v in missed_vods
        ],
        "unchecked_vods": [
            {
                "id": v.id, "title": v.title, "course_name": v.course.name,
                "start_date": v.start_date, "end_date": v.end_date,
                "is_completed": v.is_completed, "url": v.url
            }
            for v in unchecked_vods
        ],
        "summary": summary
    }

@app.post("/sync/all-active")
def sync_all_active_courses(db: Session = Depends(get_db)):
    if not client.sesskey:
        raise HTTPException(status_code=401, detail="Not authenticated. Please login first.")
    
    active_courses = db.query(Course).filter(Course.is_active == True).all()
    
    results = []
    errors = []
    
    for course in active_courses:
        try:
            client.sync_course_to_db(course.id, db)
            results.append(f"{course.name}: Success")
        except Exception as e:
            logger.error(f"Failed to sync {course.name}: {e}")
            errors.append(f"{course.name}: Failed")
            
    return {
        "status": "success" if not errors else "partial_success",
        "message": f"Synced {len(results)} courses. Failed: {len(errors)}",
        "details": results + errors
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
