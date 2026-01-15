import logging
import time
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.interval import IntervalTrigger
from sqlalchemy.orm import Session
from database import init_db, User, Course, Board, Post, Assignment, VOD
from moodle_client import MoodleClient
from ai_service import AIService

from exponent_server_sdk import PushClient, PushMessage

SessionLocal = init_db()

# Setup Logger
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("Watcher")

# Helper to get client for user
def get_client(user: User):
    client = MoodleClient(user.moodle_username, user.moodle_password)
    # Restore session if available
    if user.moodle_cookies:
        client.set_cookies(user.moodle_cookies)
        # Check validity? Only if needed.
        # if not client.is_session_valid(): login...
    else:
        # Full login
        if not client.login(user.moodle_username, user.moodle_password):
            logger.error(f"Failed to login user {user.moodle_username}")
    return client

def send_push_notification(user: User, course: Course, post: Post):
    try:
        # Use AI to summarize the post content
        ai = AIService()
        msg_body = ai.summarize_text(post.content or post.title)
        
        # Fallback if AI fails or returns empty/too long (though logic inside handles it)
        if not msg_body:
            msg_body = post.title
        
        try:
             res = PushClient().publish(
                PushMessage(
                    to=user.push_token,
                    sound="default",
                    title=f"📢 {course.name}",
                    body=msg_body,
                    data={
                        "type": "notice",
                        "postId": post.id,
                        "courseId": course.id
                    }
                )
             )
             print(f"✅ Expo Response: {res}") # DEBUG PRINT
        except Exception as exc:
            logger.error(f"Expo Send Error: {exc}")
            print(f"❌ Expo Send Error: {exc}") # DEBUG PRINT

        logger.info(f"Sent push to {user.username} for post {post.id}")
    except Exception as e:
        logger.error(f"Failed to send push: {e}")


def process_user_updates(user: User, db: Session):
    try:
        client = get_client(user)
        if not user.moodle_cookies: return

        # Load Prefs
        prefs = user.notification_preferences or {}
        if isinstance(prefs, str):
            import json
            try: prefs = json.loads(prefs)
            except: prefs = {}
        
        # Default True if not set
        notify_assignment = prefs.get('new_assignment', True)
        notify_vod = prefs.get('new_vod', True)
        notify_notice = prefs.get('notice', True)

        courses = db.query(Course).filter(Course.owner_id == user.id, Course.is_active == True).all()

        for course in courses:
            try:
                # 1. Fetch ALL content for the course (Assignments, VODs, Boards logic)
                # This scrapes 'view.php?id=...' which contains almost everything except full board posts
                contents = client.get_course_contents(course.moodle_id)

                # --- Assignments ---
                for item in contents.get('assignments', []):
                    # Check DB
                    exists = db.query(Course).session.query(type('Assignment', (object,), {'id':1})).filter(
                        # We need actual Assignment model import here or rely on global scope if available.
                        # Since 'from database import ... Assignment' is at top, we use 'Assignment'.
                        # Wait, imports are at top.
                        Assignment.moodle_id == item['id'], 
                        Assignment.course_id == course.id
                    ).first()
                    
                    # Real query
                    assign = db.query(Assignment).filter(Assignment.moodle_id == item['id'], Assignment.course_id == course.id).first()
                    if not assign:
                        # NEW Assignment
                        new_assign = Assignment(
                            moodle_id=item['id'],
                            course_id=course.id,
                            title=item['name'],
                            url=item['url'],
                            is_completed=item['is_completed'],
                            due_date=item.get('deadline_text')
                        )
                        # Deep fetch deadline if needed
                        if not new_assign.due_date and '/mod/assign/' in item['url']:
                            new_assign.due_date = client.get_assignment_deadline(item['url'])
                            
                        db.add(new_assign)
                        db.commit() # Commit to save
                        
                        if notify_assignment:
                            # Send Push
                            send_simple_push(user, f"[{course.name}] 새로운 과제 등장!", f"{item['name']}")

                    else:
                        # Update existing
                        assign.is_completed = item['is_completed']
                        if item.get('deadline_text'): assign.due_date = item.get('deadline_text')
                
                # --- VODs ---
                for item in contents.get('vods', []):
                    vod = db.query(VOD).filter(VOD.moodle_id == item['id'], VOD.course_id == course.id).first()
                    if not vod:
                        # NEW VOD
                        new_vod = VOD(
                            moodle_id=item['id'],
                            course_id=course.id,
                            title=item['name'],
                            url=item['url'],
                            is_completed=item['is_completed'],
                            has_tracking=item['has_tracking'],
                            start_date=item.get('start_date'),
                            end_date=item.get('end_date')
                        )
                        db.add(new_vod)
                        db.commit()
                        
                        if notify_vod:
                            # "Open: {start_date} ~ {end_date}"
                            body = f"새로운 동영상 강의\n시청 기한: {item.get('start_date', '?')} ~ {item.get('end_date', '?')}"
                            send_simple_push(user, f"[{course.name}] {item['name']}", body)
                    else:
                        vod.is_completed = item['is_completed']

                db.commit()

                # --- Notices (Board) ---
                if notify_notice:
                     # Identify Notice board
                     # We can iterate contents['boards'] to find '공지'
                     notice_board_info = next((b for b in contents.get('boards', []) if '공지' in b['name'] or 'Notice' in b['name']), None)
                     if notice_board_info:
                         # Ensure Board exists in DB
                         board = db.query(Board).filter(Board.moodle_id == notice_board_info['id'], Board.course_id == course.id).first()
                         if not board:
                             board = Board(moodle_id=notice_board_info['id'], course_id=course.id, title=notice_board_info['name'], url=notice_board_info['url'])
                             db.add(board)
                             db.commit()
                         
                         # Check posts
                         posts_data = client.get_board_posts(board.moodle_id)
                         for p_data in posts_data:
                             exists = db.query(Post).filter(
                                 Post.board_id == board.id, 
                                 Post.title == p_data['subject'],
                                 Post.date == p_data['date']
                             ).first()
                             
                             if not exists:
                                 new_post = Post(
                                     board_id=board.id,
                                     title=p_data['subject'],
                                     writer=p_data['writer'],
                                     date=p_data['date'],
                                     url=p_data['url']
                                 )
                                 # Fetch content for AI
                                 new_post.content = client.get_post_content(p_data['url'])
                                 db.add(new_post)
                                 db.commit()
                                 
                                 # AI Summary Push
                                 send_push_notification(user, course, new_post)

            except Exception as e:
                logger.error(f"Error processing course {course.name} for user {user.username}: {e}")
                continue

    except Exception as e:
        logger.error(f"Error updating user {user.username}: {e}")
        pass

def send_simple_push(user: User, title: str, body: str):
    try:
         res = PushClient().publish(
            PushMessage(
                to=user.push_token,
                sound="default",
                title=title,
                body=body,
                data={"type": "info"}
            )
         )
         logger.info(f"Sent simple push to {user.username}: {title}")
    except Exception as exc:
        logger.error(f"Simple Expo Send Error: {exc}")


def check_notices_job(SessionLocal):
    """
    Runs every 5 minutes.
    Checks for NEW posts in 'Notices' boards for all active users.
    """
    # logger.info("Running Check Notices Job...")
    db = SessionLocal()
    try:
        users = db.query(User).filter(User.push_token.isnot(None)).all()
        for user in users:
            process_user_updates(user, db)
    except Exception as e:
        logger.error(f"Check Notices Job Failed: {e}")
    finally:
        db.close()

def sync_dashboard_job(SessionLocal):
    """
    Runs every 60 minutes.
    Full Sync.
    """
    logger.info("Running Hourly Full Sync Job...")
    db = SessionLocal()
    try:
        users = db.query(User).filter(User.is_active == True).all() # Or active only?
        for user in users:
             try:
                client = get_client(user)
                # We can reuse the `sync_all_active_courses` logic from API but we need to import or replicate.
                # Simplest is to replicate loop:
                courses = db.query(Course).filter(Course.owner_id == user.id, Course.is_active == True).all()
                for course in courses:
                     # This logic exists in api.py's `sync_course_task`. 
                     # Ideally we refactor `sync_course_to_db` out of API and into `services/` or `moodle_client`.
                     # For now, let's just log placeholder.
                     pass 
             except: pass
    finally:
        db.close()
